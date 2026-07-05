"""
Azure Function: Ixly Aanmelding
Trigger: HTTP POST vanuit FunnelKit (na toewijzen Assessment-tag), of via mollie-webhook
na een geslaagde betaling (fase C2/C3).

Stappen:
  1. Ontvang kandidaatgegevens van FunnelKit
  2. Haal user access token op via managed organizations flow
  3. Candidate upsert — zoek op via api_identifier, maak aan als niet gevonden
  4. Maak assignments aan voor alle taken in TAKEN
  5. Stuur ÉÉN e-mail met de game-links + de Action Type test-link, alleen voor KA/SU.
     Voor MM (of een ontbrekend/onbekend school_code) wordt géén mail verstuurd --
     assignments in Ixly worden nog wel aangemaakt, alleen de notificatiemail niet.

Verwachte payload (JSON, via FunnelKit Send Data, of via mollie-webhook):
  {
    "voornaam":    "Jan",
    "achternaam":  "Jansen",
    "email":       "jan@voorbeeld.nl",
    "wc_klant_id": "12345",
    "naam_kind":   "Lisa Jansen",
    "order_id":    "42",
    "school_code": "KA"        -- KA/SU: combinatie-mail wordt verstuurd. MM/ontbrekend: geen mail.
  }

Response (JSON):
  {
    "candidate_uuid": "...",
    "assignments": [
      {"naam": "Blocks Game", "assignment_uuid": "...", "login_url": "..."},
      {"naam": "Rally Game",  "assignment_uuid": "...", "login_url": "..."}
    ]
  }
"""

import json
import logging
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import azure.functions as func
import requests


IXLY_BASE_URL          = os.environ.get("IXLY_BASE_URL", "")
IXLY_CLIENT_ID         = os.environ.get("IXLY_CLIENT_ID", "")
IXLY_CLIENT_SECRET     = os.environ.get("IXLY_CLIENT_SECRET", "")
IXLY_ORGANIZATION_UUID = os.environ.get("IXLY_ORGANIZATION_UUID", "")
IXLY_REDIRECT_URI      = os.environ.get("IXLY_REDIRECT_URI", "")

SMTP_HOST       = os.environ.get("SMTP_HOST", "")
SMTP_PORT       = int(os.environ.get("SMTP_PORT", "587"))
SMTP_GEBRUIKER  = os.environ.get("SMTP_GEBRUIKER", "")
SMTP_WACHTWOORD = os.environ.get("SMTP_WACHTWOORD", "")
SMTP_AFZENDER   = os.environ.get("SMTP_AFZENDER", "")

GROVIA_DEBUG_EMAIL = os.environ.get("GROVIA_DEBUG_EMAIL", "")

TAKEN = [
    {"naam": "Blocks Game", "uuid": "2a04b8bc-486f-4b9a-924a-26199b75be9c", "type": "Task"},
    {"naam": "Rally Game",  "uuid": "4464b991-268f-45f7-860a-e5b109160612", "type": "Task"},
]

# Action Type test -- alleen KA/SU, MM heeft geen Action Type test.
# Overgenomen uit de voormalige action-type-uitnodiging Azure Function (samengevoegd
# met deze mail zodat games + Action Type in één bericht gaan).
SCHOOL_DATA = {
    "KA": {
        "naam":       "Kolping Academie",
        "form_url":   os.environ.get(
            "ACTION_TYPE_FORM_URL_KA",
            "https://docs.google.com/forms/d/e/1FAIpQLSc6HIBgffV-rQiM4KDFW4weK3JGOzGKWrGwUP1D7HtNYg_Qiw/viewform",
        ),
        "kleur":      "#ed6c02",
        "afsluiting": "Kolping Academie",
    },
    "SU": {
        "naam":       "Schagen United Academie",
        "form_url":   os.environ.get(
            "ACTION_TYPE_FORM_URL_SU",
            "https://docs.google.com/forms/d/e/1FAIpQLSd521BhxYq3L27FNmqZ5w2D1Bra6Sk9NwB_dvgRlKHRIDbl8g/viewform",
        ),
        "kleur":      "#d32f2f",
        "afsluiting": "Schagen United Academie",
    },
}


def _ixly_headers(token: str) -> dict:
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }


# ── Auth ──────────────────────────────────────────────────────────────────────

def _haal_app_token_op() -> str:
    response = requests.post(
        f"{IXLY_BASE_URL}/oauth/token",
        data={
            "grant_type":    "client_credentials",
            "client_id":     IXLY_CLIENT_ID,
            "client_secret": IXLY_CLIENT_SECRET,
        },
        timeout=15,
    )
    response.raise_for_status()
    return response.json()["access_token"]


def _haal_grant_token_op(app_token: str) -> str:
    response = requests.get(
        f"{IXLY_BASE_URL}/api/public/managed_organizations/{IXLY_ORGANIZATION_UUID}",
        headers={"Authorization": f"Bearer {app_token}", "Accept": "application/json"},
        timeout=15,
    )
    response.raise_for_status()
    data = response.json()

    included = data.get("included", [])
    grant_token = next(
        (item["attributes"]["access_grant"]
         for item in included
         if item.get("type") == "api_user" and item.get("attributes", {}).get("access_grant")),
        None,
    )
    if not grant_token:
        logging.error(f"access_grant niet gevonden in response: {json.dumps(data)}")
        raise ValueError("access_grant niet gevonden in managed_organizations response.")
    return grant_token


def _wissel_grant_token_in(grant_token: str) -> str:
    body = {
        "grant_type":    "authorization_code",
        "client_id":     IXLY_CLIENT_ID,
        "client_secret": IXLY_CLIENT_SECRET,
        "code":          grant_token,
    }
    if IXLY_REDIRECT_URI:
        body["redirect_uri"] = IXLY_REDIRECT_URI
    response = requests.post(f"{IXLY_BASE_URL}/oauth/token", data=body, timeout=15)
    response.raise_for_status()
    return response.json()["access_token"]


def _haal_user_token_op() -> str:
    app_token   = _haal_app_token_op()
    grant_token = _haal_grant_token_op(app_token)
    return _wissel_grant_token_in(grant_token)


# ── Candidate upsert ──────────────────────────────────────────────────────────

def _zoek_candidate_op(token: str, api_identifier: str) -> dict | None:
    response = requests.get(
        f"{IXLY_BASE_URL}/api/public/candidates/api_identifier/{api_identifier}",
        headers=_ixly_headers(token),
        timeout=15,
    )
    if response.status_code == 404:
        return None
    response.raise_for_status()
    return response.json()["data"]


def _splits_naam(naam: str) -> tuple[str, str]:
    delen = naam.strip().split(" ", 1)
    return delen[0], delen[1] if len(delen) > 1 else ""


def _maak_candidate_aan(token: str, payload: dict) -> dict:
    voornaam, achternaam = _splits_naam(payload["naam_kind"])
    response = requests.post(
        f"{IXLY_BASE_URL}/api/public/candidates",
        headers=_ixly_headers(token),
        json={
            "candidate": {
                "first_name":     voornaam,
                "last_name":      achternaam,
                "email":          payload["email"],
                "language":       "nl",
                "api_identifier": str(payload["order_id"]),
            }
        },
        timeout=15,
    )
    response.raise_for_status()
    return response.json()["data"]


def _candidate_upsert(token: str, payload: dict) -> tuple[dict, bool]:
    candidate = _zoek_candidate_op(token, str(payload["order_id"]))
    if candidate:
        logging.info(f"Bestaande candidate gevonden: {candidate['id']}")
        return candidate, False
    candidate = _maak_candidate_aan(token, payload)
    logging.info(f"Nieuwe candidate aangemaakt: {candidate['id']}")
    return candidate, True


# ── Assignments ───────────────────────────────────────────────────────────────

def _haal_bestaande_assignments_op(token: str, candidate_uuid: str) -> list:
    response = requests.get(
        f"{IXLY_BASE_URL}/api/public/assignments",
        headers=_ixly_headers(token),
        params={"candidate_uuid": candidate_uuid},
        timeout=15,
    )
    if response.status_code == 404:
        return []
    response.raise_for_status()
    return response.json().get("data", [])


def _maak_assignment_aan(token: str, candidate_uuid: str, taak: dict) -> dict:
    response = requests.post(
        f"{IXLY_BASE_URL}/api/public/assignments",
        headers=_ixly_headers(token),
        json={
            "assignment": {
                "candidate_uuid": candidate_uuid,
                "task_type":      taak["type"],
                "task_uuid":      taak["uuid"],
            }
        },
        timeout=15,
    )
    response.raise_for_status()
    return response.json()["data"]


def _maak_assignments_aan_met_guard(token: str, candidate_uuid: str) -> list:
    bestaande = _haal_bestaande_assignments_op(token, candidate_uuid)
    bestaande_task_uuids = {
        a["relationships"]["task"]["data"]["id"]
        for a in bestaande
        if a.get("relationships", {}).get("task", {}).get("data")
    }

    assignments = []
    for taak in TAKEN:
        if taak["uuid"] in bestaande_task_uuids:
            logging.info(f"Assignment al aanwezig voor {taak['naam']} — overgeslagen.")
            continue
        assignment = _maak_assignment_aan(token, candidate_uuid, taak)
        logging.info(f"Assignment aangemaakt voor {taak['naam']}: {assignment['id']}")
        assignments.append({
            "naam":            taak["naam"],
            "assignment_uuid": assignment["id"],
            "login_url":       assignment.get("links", {}).get("login_url"),
        })

    return assignments


# ── E-mail ────────────────────────────────────────────────────────────────────

def _stuur_email(ontvanger: str, voornaam: str, assignments: list, school_code: str | None = None) -> None:
    if not SMTP_HOST:
        logging.warning("SMTP niet geconfigureerd — e-mail wordt overgeslagen.")
        return

    school = SCHOOL_DATA.get(school_code) if school_code else None
    if not school:
        # MM (of een ontbrekend/onbekend school_code) doet niet mee aan de games/Action
        # Type-flow -- geen mail versturen. Kandidaat/assignments in Ixly blijven wel
        # gewoon aangemaakt (dat is een aparte, technische stap richting Ixly zelf).
        logging.info(
            f"Geen (herkend) school_code ('{school_code}') -- mail overgeslagen voor {ontvanger}."
        )
        return

    doel_adres = GROVIA_DEBUG_EMAIL if GROVIA_DEBUG_EMAIL else ontvanger

    bericht = MIMEMultipart("alternative")
    bericht["Subject"] = "Tijd voor de Grovia games en de Action Type test"
    bericht["From"]    = SMTP_AFZENDER
    bericht["To"]      = doel_adres

    links_tekst = "\n".join(
        f"- {a['naam']}: {a['login_url']}" for a in assignments if a.get("login_url")
    )
    links_html = "\n".join(
        f'<p style="text-align: center; margin: 0 0 16px;">'
        f'<a href="{a["login_url"]}" '
        f'style="background: #5b4fc7; color: #ffffff; text-decoration: none; padding: 12px 24px; '
        f'border-radius: 6px; font-weight: bold; display: inline-block;">Start {a["naam"]}</a></p>'
        for a in assignments if a.get("login_url")
    )

    afsluiting = school["afsluiting"]

    action_type_tekst = (
        f"\nEr is nog iets: om de training zo goed mogelijk af te stemmen, vragen we ook "
        f"een korte test in te vullen: de Action Type test. 20 korte vraagjes, steeds "
        f"kiezen tussen zin a of zin b, ongeveer 5 tot 10 minuten. De test wordt zelf "
        f"gemaakt, zonder verdere hulp van papa of mama -- alleen voorlezen mag.\n\n"
        f"Let op: vul bij de vraag 'Naam' de volledige naam in (voornaam en achternaam), "
        f"zodat we de uitslag aan de juiste speler kunnen koppelen.\n\n"
        f"Start de Action Type test: {school['form_url']}\n"
    )
    action_type_html = f"""
      <div style="background: #f4f6f8; border-radius: 8px; padding: 16px 20px; margin: 24px 0;">
        <p style="margin: 0 0 12px;">Er is nog iets: om de training zo goed mogelijk af te
        stemmen, vragen we ook een korte test in te vullen: de <strong>Action Type test</strong>.
        20 korte vraagjes, steeds kiezen tussen zin a of zin b, ongeveer 5 tot 10 minuten.</p>
        <p style="margin: 0;">De test wordt zelf gemaakt, zonder verdere hulp van papa of mama
        &mdash; alleen voorlezen mag.</p>
      </div>
      <p style="margin: 0 0 18px;"><strong>Let op:</strong> vul bij de vraag "Naam" de
      <strong>volledige naam</strong> in (voornaam en achternaam), zodat we de uitslag aan de
      juiste speler kunnen koppelen.</p>
      <p style="text-align: center; margin: 0 0 28px;">
        <a href="{school['form_url']}"
           style="background: {school['kleur']}; color: #ffffff; text-decoration: none; padding: 14px 28px;
                  border-radius: 6px; font-weight: bold; display: inline-block;">
          Start de Action Type test
        </a>
      </p>
"""

    tekst = (
        f"Hoi {voornaam},\n\n"
        f"De twee cognitieve games — Rally en Blocks — staan klaar om te spelen. "
        f"Reken op ongeveer een uur speeltijd.\n\n"
        f"Gebruik de onderstaande links om te starten:\n\n"
        f"{links_tekst}\n\n"
        f"Zo haal je het beste resultaat:\n"
        f"- Speel op een rustig moment, op een pc of laptop (niet op een telefoon of tablet).\n"
        f"- Speel zelf, zonder hulp van papa of mama — dat kan het resultaat beïnvloeden.\n"
        f"- Papa of mama mag wel helpen tot het moment dat de game begint.\n"
        f"- Lees de instructies goed door voor je begint.\n"
        f"- Zet de game niet op pauze en blijf spelen tot deze is afgelopen.\n"
        f"{action_type_tekst}\n"
        f"Veel succes!\n\n"
        f"Sportieve groet,\n"
        f"{afsluiting}"
    )
    html = f"""
    <div style="font-family: Arial, Helvetica, sans-serif; color: #2b2b2b; line-height: 1.6; max-width: 600px; margin: 0 auto;">
      <h1 style="font-size: 24px; margin: 0 0 24px;">Tijd voor de Grovia games</h1>
      <p style="margin: 0 0 18px;">Hoi {voornaam},</p>
      <p style="margin: 0 0 18px;">De twee cognitieve games — <strong>Rally</strong> en <strong>Blocks</strong> —
      staan klaar om te spelen. Reken op ongeveer een uur speeltijd.</p>
      {links_html}
      <div style="background: #f4f6f8; border-radius: 8px; padding: 16px 20px; margin: 24px 0;">
        <p style="margin: 0 0 8px;"><strong>Zo haal je het beste resultaat:</strong></p>
        <ul style="margin: 0; padding-left: 20px;">
          <li>Speel op een rustig moment, op een pc of laptop (niet op een telefoon of tablet).</li>
          <li>Speel zelf, zonder hulp van papa of mama — dat kan het resultaat beïnvloeden.</li>
          <li>Papa of mama mag wel helpen tot het moment dat de game begint.</li>
          <li>Lees de instructies goed door voor je begint.</li>
          <li>Zet de game niet op pauze en blijf spelen tot deze is afgelopen.</li>
        </ul>
      </div>
      {action_type_html}
      <p style="margin: 0;">Veel succes!<br>Sportieve groet,<br>{afsluiting}</p>
    </div>
    """

    bericht.attach(MIMEText(tekst, "plain"))
    bericht.attach(MIMEText(html, "html"))

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        server.starttls()
        server.login(SMTP_GEBRUIKER, SMTP_WACHTWOORD)
        server.sendmail(SMTP_AFZENDER, doel_adres, bericht.as_string())

    if GROVIA_DEBUG_EMAIL:
        logging.info(f"DEBUG: e-mail gestuurd naar {GROVIA_DEBUG_EMAIL} (i.p.v. {ontvanger})")
    else:
        logging.info(f"E-mail verstuurd naar {ontvanger}")


# ── Handler ───────────────────────────────────────────────────────────────────

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("Ixly Aanmelding gestart.")

    try:
        body = req.get_json()
    except ValueError:
        return func.HttpResponse("Ongeldige JSON in request body.", status_code=400)

    ontbrekend = [v for v in ["voornaam", "achternaam", "email", "wc_klant_id", "naam_kind", "order_id"] if not body.get(v)]
    if ontbrekend:
        return func.HttpResponse(
            json.dumps({"fout": f"Ontbrekende velden: {', '.join(ontbrekend)}"}),
            mimetype="application/json",
            status_code=400,
        )

    try:
        token = _haal_user_token_op()

        candidate, _ = _candidate_upsert(token, body)
        candidate_uuid = candidate["id"]

        assignments = _maak_assignments_aan_met_guard(token, candidate_uuid)

        # Let op: dit is de voornaam van de ouder (billing), niet van het kind -- naam_kind
        # is een vrij ingetypt veld en kan niet betrouwbaar in voor-/achternaam gesplitst
        # worden (bijv. samengestelde achternamen). _splits_naam wordt daarom alleen nog
        # gebruikt voor het Ixly-kandidaatprofiel (_maak_candidate_aan), niet voor de mail.
        # school_code is optioneel: alleen KA/SU krijgen de Action Type-sectie in de mail,
        # MM (en een ontbrekend/onbekend school_code) krijgt alleen de games-mail.
        _stuur_email(body["email"], body["voornaam"], assignments, body.get("school_code"))

        return func.HttpResponse(
            json.dumps({"candidate_uuid": candidate_uuid, "assignments": assignments}),
            mimetype="application/json",
            status_code=200,
        )

    except requests.HTTPError as e:
        logging.error(f"Ixly API fout: {e.response.status_code} — {e.response.text}")
        return func.HttpResponse(
            json.dumps({"fout": f"Ixly API fout: {e.response.status_code}"}),
            mimetype="application/json",
            status_code=502,
        )
    except smtplib.SMTPException as e:
        logging.error(f"E-mail versturen mislukt: {e}")
        return func.HttpResponse(
            json.dumps({"fout": "E-mail versturen mislukt."}),
            mimetype="application/json",
            status_code=500,
        )
    except Exception as e:
        logging.exception("Onverwachte fout")
        return func.HttpResponse(
            json.dumps({"fout": str(e)}),
            mimetype="application/json",
            status_code=500,
        )
