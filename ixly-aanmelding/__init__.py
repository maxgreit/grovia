"""
Azure Function: Ixly Aanmelding
Trigger: HTTP POST vanuit FunnelKit (na toewijzen StuurAssessment-tag)

Stappen:
  1. Ontvang kandidaatgegevens van FunnelKit
  2. Haal user access token op via managed organizations flow
  3. Candidate upsert — zoek op via api_identifier, maak aan als niet gevonden
  4. Maak assignments aan voor alle taken in TAKEN
  5. Stuur e-mail met één link per game naar kandidaat

Verwachte payload (JSON, via FunnelKit Send Data):
  {
    "voornaam":    "Jan",
    "achternaam":  "Jansen",
    "email":       "jan@voorbeeld.nl",
    "wc_klant_id": "12345",
    "naam_kind":   "Lisa Jansen",
    "order_id":    "42"
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

def _stuur_email(ontvanger: str, voornaam: str, achternaam: str, assignments: list) -> None:
    if not SMTP_HOST:
        logging.warning("SMTP niet geconfigureerd — e-mail wordt overgeslagen.")
        return

    doel_adres = GROVIA_DEBUG_EMAIL if GROVIA_DEBUG_EMAIL else ontvanger

    bericht = MIMEMultipart("alternative")
    bericht["Subject"] = "Jouw uitnodiging voor de Grovia games"
    bericht["From"]    = SMTP_AFZENDER
    bericht["To"]      = doel_adres

    links_tekst = "\n".join(
        f"- {a['naam']}: {a['login_url']}" for a in assignments if a.get("login_url")
    )
    links_html = "\n".join(
        f'<p><strong>{a["naam"]}:</strong><br>'
        f'<a href="{a["login_url"]}" style="font-size:16px;font-weight:bold;">Klik hier om te starten</a><br>'
        f'Of kopieer: {a["login_url"]}</p>'
        for a in assignments if a.get("login_url")
    )

    tekst = (
        f"Beste {voornaam} {achternaam},\n\n"
        f"De games Rally en Blocks zijn voor jou klaargezet. De instructies wijzen voor zich. "
        f"We verwachten dat je ongeveer een uur bezig bent.\n\n"
        f"Gebruik de onderstaande links om te starten:\n\n"
        f"{links_tekst}\n\n"
        f"Tips:\n"
        f"- Speel de games op een rustig moment.\n"
        f"- Speel de games zonder hulp van papa of mama. Dit kan het resultaat negatief beïnvloeden.\n"
        f"- Laat papa of mama helpen tot het moment dat de game begint.\n"
        f"- Lees de instructies goed voor je begint.\n"
        f"- Zet de game niet op pauze.\n"
        f"- Laat je niet afleiden en blijf de game spelen tot deze is afgelopen.\n"
        f"- Speel de game op een pc of laptop. Niet op een telefoon of tablet.\n\n"
        f"Veel succes!\n\n"
        f"Met vriendelijke groet,\n"
        f"Team Grovia"
    )
    html = f"""
    <p>Beste {voornaam} {achternaam},</p>
    <p>De games <strong>Rally</strong> en <strong>Blocks</strong> zijn voor jou klaargezet.
    De instructies wijzen voor zich. We verwachten dat je ongeveer een uur bezig bent.</p>
    {links_html}
    <p><strong>Tips:</strong></p>
    <ul>
      <li>Speel de games op een rustig moment.</li>
      <li>Speel de games zonder hulp van papa of mama. Dit kan het resultaat negatief beïnvloeden.</li>
      <li>Laat papa of mama helpen tot het moment dat de game begint.</li>
      <li>Lees de instructies goed voor je begint.</li>
      <li>Zet de game niet op pauze.</li>
      <li>Laat je niet afleiden en blijf de game spelen tot deze is afgelopen.</li>
      <li>Speel de game op een pc of laptop. Niet op een telefoon of tablet.</li>
    </ul>
    <p>Veel succes!</p>
    <p>Met vriendelijke groet,<br>Team Grovia</p>
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

        voornaam, achternaam = _splits_naam(body["naam_kind"])
        _stuur_email(body["email"], voornaam, achternaam, assignments)

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
