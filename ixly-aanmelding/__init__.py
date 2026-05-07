"""
Azure Function: Ixly Aanmelding
Trigger: HTTP POST vanuit FunnelKit (na toewijzen StuurAssessment-tag)

Stappen:
  1. Ontvang kandidaatgegevens van FunnelKit/WordPress
  2. Haal user access token op via managed organizations flow:
       a. app token via client_credentials
       b. grant token via managed_organizations/{uuid}
       c. user access token via grant token
  3. Maak kandidaatprofiel aan (of zoek bestaande op via api_identifier)
  4. Maak assignment aan voor het juiste assessment
  5. Geef login_url terug zodat FunnelKit die kan meesturen in de e-mail

Verwachte payload (JSON):
  {
    "voornaam":        "Jan",
    "achternaam":      "Jansen",
    "email":           "jan@voorbeeld.nl",
    "wc_klant_id":     "12345",        -- gebruikt als api_identifier (voorkomt duplicaten)
    "assessment_uuid": "...",          -- UUID van het assessment in Ixly (per school/fase)
    "task_type":       "Task"          -- "Task" of "Program"
  }
"""

import json
import logging
import os

import azure.functions as func
import requests


IXLY_BASE_URL          = os.environ.get("IXLY_BASE_URL", "")
IXLY_CLIENT_ID         = os.environ.get("IXLY_CLIENT_ID", "")
IXLY_CLIENT_SECRET     = os.environ.get("IXLY_CLIENT_SECRET", "")
IXLY_ORGANIZATION_UUID = os.environ.get("IXLY_ORGANIZATION_UUID", "")


def _haal_app_token_op() -> str:
    """Stap 1: app token via client_credentials."""
    response = requests.post(
        f"{IXLY_BASE_URL}/oauth/token",
        data={
            "grant_type": "client_credentials",
            "client_id": IXLY_CLIENT_ID,
            "client_secret": IXLY_CLIENT_SECRET,
        },
        timeout=15,
    )
    response.raise_for_status()
    return response.json()["access_token"]


def _haal_grant_token_op(app_token: str) -> str:
    """Stap 2: grant token via managed organization detail."""
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
    """Stap 3: user access token via grant token."""
    response = requests.post(
        f"{IXLY_BASE_URL}/oauth/token",
        data={
            "grant_type": "authorization_code",
            "client_id": IXLY_CLIENT_ID,
            "client_secret": IXLY_CLIENT_SECRET,
            "code": grant_token,
        },
        timeout=15,
    )
    response.raise_for_status()
    return response.json()["access_token"]


def _haal_user_token_op() -> str:
    """Volledige managed organizations flow — geeft user access token terug."""
    app_token   = _haal_app_token_op()
    grant_token = _haal_grant_token_op(app_token)
    return _wissel_grant_token_in(grant_token)


def _maak_kandidaat_aan(token: str, payload: dict) -> dict:
    """Maak een kandidaatprofiel aan in Ixly. Geeft het volledige candidate-object terug."""
    response = requests.post(
        f"{IXLY_BASE_URL}/api/public/candidates",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        json={
            "candidate": {
                "first_name": payload["voornaam"],
                "last_name":  payload["achternaam"],
                "email":      payload["email"],
                "language":   "nl",
                "api_identifier": str(payload["wc_klant_id"]),
            }
        },
        timeout=15,
    )
    response.raise_for_status()
    return response.json()["data"]


def _maak_assignment_aan(token: str, candidate_uuid: str, payload: dict) -> dict:
    """Koppel het assessment aan de kandidaat. Geeft het assignment-object terug (incl. login_url)."""
    response = requests.post(
        f"{IXLY_BASE_URL}/api/public/assignments",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        json={
            "assignment": {
                "candidate_uuid": candidate_uuid,
                "task_type":      payload.get("task_type", "Task"),
                "task_uuid":      payload["assessment_uuid"],
            }
        },
        timeout=15,
    )
    response.raise_for_status()
    return response.json()["data"]


def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("Ixly Aanmelding gestart.")

    try:
        body = req.get_json()
    except ValueError:
        return func.HttpResponse("Ongeldige JSON in request body.", status_code=400)

    verplichte_velden = ["voornaam", "achternaam", "email", "wc_klant_id", "assessment_uuid"]
    ontbrekend = [v for v in verplichte_velden if not body.get(v)]
    if ontbrekend:
        return func.HttpResponse(
            f"Ontbrekende velden: {', '.join(ontbrekend)}", status_code=400
        )

    try:
        token = _haal_user_token_op()

        kandidaat = _maak_kandidaat_aan(token, body)
        candidate_uuid = kandidaat["id"]
        logging.info(f"Kandidaat aangemaakt: {candidate_uuid}")

        assignment = _maak_assignment_aan(token, candidate_uuid, body)
        login_url = assignment.get("links", {}).get("login_url")
        logging.info(f"Assignment aangemaakt, login_url: {login_url}")

        return func.HttpResponse(
            json.dumps({"login_url": login_url, "candidate_uuid": candidate_uuid}),
            mimetype="application/json",
            status_code=200,
        )

    except requests.HTTPError as e:
        logging.error(f"Ixly API fout: {e.response.status_code} — {e.response.text}")
        return func.HttpResponse(f"Ixly API fout: {e.response.status_code}", status_code=502)
    except Exception as e:
        logging.exception("Onverwachte fout")
        return func.HttpResponse(f"Interne fout: {str(e)}", status_code=500)
