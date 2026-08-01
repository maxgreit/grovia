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
import sys

import azure.functions as func
import requests

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from grovia_shared import grovia_mail


IXLY_BASE_URL          = os.environ.get("IXLY_BASE_URL", "")
IXLY_CLIENT_ID         = os.environ.get("IXLY_CLIENT_ID", "")
IXLY_CLIENT_SECRET     = os.environ.get("IXLY_CLIENT_SECRET", "")
IXLY_ORGANIZATION_UUID = os.environ.get("IXLY_ORGANIZATION_UUID", "")
IXLY_REDIRECT_URI      = os.environ.get("IXLY_REDIRECT_URI", "")

GROVIA_WORDPRESS_URL       = os.environ.get("GROVIA_WORDPRESS_URL", "")
GROVIA_WOO_CONSUMER_KEY    = os.environ.get("GROVIA_WOO_CONSUMER_KEY", "")
GROVIA_WOO_CONSUMER_SECRET = os.environ.get("GROVIA_WOO_CONSUMER_SECRET", "")

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


def _bewaar_ixly_taken(order_id: str, assignments: list) -> None:
    """
    Bewaart naam+assignment-uuid per taak als WooCommerce order-meta
    (_grovia_ixly_taken), zodat ixly-status en grovia-herinnering later de status/
    login_url kunnen opvragen via het bewezen werkende GET /assignments/{uuid} --
    in plaats van het niet-gedocumenteerde, altijd lege assignments-lijst-endpoint.

    Mag de rest van de aanroepende flow nooit blokkeren: de assignments zijn op dit
    moment al succesvol aangemaakt in Ixly en de uitnodigingsmail moet nog uit. Een
    mislukking hier wordt alleen gelogd; de rij valt dan terug op handmatige
    Ixly-controle, net als een order van vóór deze fix. Vangt daarom bewust ALLE
    fouten af (best-effort side-write), niet alleen HTTP-fouten.
    """
    if not assignments:
        return

    if not GROVIA_WORDPRESS_URL or not GROVIA_WOO_CONSUMER_KEY or not GROVIA_WOO_CONSUMER_SECRET:
        logging.warning("GROVIA_WORDPRESS_URL/GROVIA_WOO_CONSUMER_KEY/SECRET niet (volledig) gezet -- ixly_taken niet bewaard.")
        return

    try:
        waarde = ",".join(f"{a['naam']}:{a['assignment_uuid']}" for a in assignments)
        response = requests.put(
            f"{GROVIA_WORDPRESS_URL}/wp-json/wc/v3/orders/{order_id}",
            auth=(GROVIA_WOO_CONSUMER_KEY, GROVIA_WOO_CONSUMER_SECRET),
            json={"meta_data": [{"key": "_grovia_ixly_taken", "value": waarde}]},
            timeout=15,
        )
        response.raise_for_status()
        logging.info(f"_grovia_ixly_taken bewaard voor order {order_id}.")
    except Exception as e:
        logging.error(f"Kon _grovia_ixly_taken niet bewaren voor order {order_id}: {e}")


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

        _bewaar_ixly_taken(str(body["order_id"]), assignments)

        # Let op: dit is de voornaam van de ouder (billing), niet van het kind -- naam_kind
        # is een vrij ingetypt veld en kan niet betrouwbaar in voor-/achternaam gesplitst
        # worden (bijv. samengestelde achternamen). _splits_naam wordt daarom alleen nog
        # gebruikt voor het Ixly-kandidaatprofiel (_maak_candidate_aan), niet voor de mail.
        # school_code is optioneel: alleen KA/SU krijgen de Action Type-sectie in de mail,
        # MM (en een ontbrekend/onbekend school_code) krijgt alleen de games-mail.
        mail = grovia_mail.bouw_uitnodiging(
            body["voornaam"],
            assignments,
            body.get("school_code"),
            body["order_id"],
            body["naam_kind"],
        )
        if mail:
            onderwerp, tekst, html = mail
            grovia_mail.verstuur(body["email"], onderwerp, tekst, html)
        else:
            logging.info(
                f"Geen (herkend) school_code ('{body.get('school_code')}') -- mail overgeslagen."
            )

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
