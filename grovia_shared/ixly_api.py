"""
Gedeelde Ixly API-calls voor de Grovia Azure Functions.
"""
import json
import logging
import os
import requests

IXLY_BASE_URL          = os.environ.get("IXLY_BASE_URL", "")
IXLY_CLIENT_ID         = os.environ.get("IXLY_CLIENT_ID", "")
IXLY_CLIENT_SECRET     = os.environ.get("IXLY_CLIENT_SECRET", "")
IXLY_ORGANIZATION_UUID = os.environ.get("IXLY_ORGANIZATION_UUID", "")
IXLY_REDIRECT_URI      = os.environ.get("IXLY_REDIRECT_URI", "")

# Een assignment verwijst naar precies één van deze drie, afhankelijk van het taaktype.
TAAK_RELATIES = {
    "candidate_task":    "candidate_tasks",
    "candidate_program": "candidate_programs",
    "candidate_process": "candidate_processes",
}

# Statische mapping van Ixly task_uuid naar leesbare naam. Overgenomen uit de TAKEN-lijst
# in ixly-aanmelding/__init__.py -- de assignment-response zelf bevat geen naam/title
# (geverifieerd tegen swagger.yaml: het attributes-schema van 'assignment' heeft geen
# title-veld, alleen candidate_uuid, task_type, task_uuid, invited_at, mail_template_uuid,
# reminder_mail_delivery_date, reminder_mail_template_uuid, deadline, api_identifier).
TAAK_NAMEN = {
    "2a04b8bc-486f-4b9a-924a-26199b75be9c": "Blocks Game",
    "4464b991-268f-45f7-860a-e5b109160612": "Rally Game",
}


def _headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ── Auth ──────────────────────────────────────────────────────────────────────
# Letterlijk overgenomen uit ixly-aanmelding/__init__.py (_haal_app_token_op,
# _haal_grant_token_op, _wissel_grant_token_in, _haal_user_token_op) — dit
# patroon is al bewezen in productie en mag niet afwijken.

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


def haal_token() -> str:
    """Haal een user access token op via de managed organizations flow."""
    app_token   = _haal_app_token_op()
    grant_token = _haal_grant_token_op(app_token)
    return _wissel_grant_token_in(grant_token)


def haal_alle_tokens() -> list:
    """
    Haal een user access token op voor ELKE adviseur (api_user) in de organisatie,
    niet alleen de eerste.

    De organisatie heeft meerdere adviseurs met een eigen access_grant (geverifieerd
    2026-08-12: Max Rood, Berry Moolenaar, Jeffry Moolenaar, Ruben Mogge). Een
    candidate_task is bij Ixly alleen zichtbaar voor de adviseur die de kandidaat
    bezit -- hetzelfde uuid geeft met een ander adviseur-token 404. haal_token()
    gebruikte altijd de EERSTE api_user uit de response, een volgorde die niet
    gegarandeerd is; daardoor zag elke run maar een deel van de kandidaten en leek de
    rest stil 'niet afgerond'. haal_taak_status() probeert deze lijst tokens langs tot
    er een de taak ziet.

    Returns:
        Lijst met een token per adviseur met een access_grant. Nooit leeg als
        haal_token() ook zou slagen (dezelfde managed_organizations-call).
    """
    app_token = _haal_app_token_op()
    response = requests.get(
        f"{IXLY_BASE_URL}/api/public/managed_organizations/{IXLY_ORGANIZATION_UUID}",
        headers={"Authorization": f"Bearer {app_token}", "Accept": "application/json"},
        timeout=15,
    )
    response.raise_for_status()

    grants = [
        item["attributes"]["access_grant"]
        for item in response.json().get("included", [])
        if item.get("type") == "api_user" and item.get("attributes", {}).get("access_grant")
    ]
    if not grants:
        raise ValueError("Geen enkele access_grant gevonden in managed_organizations response.")

    return [_wissel_grant_token_in(grant) for grant in grants]


# ── Candidate & assignments ───────────────────────────────────────────────────

def zoek_candidate(token: str, api_identifier: str) -> dict | None:
    """Zoek een candidate op api_identifier (= het order_id). None als niet gevonden."""
    response = requests.get(
        f"{IXLY_BASE_URL}/api/public/candidates/api_identifier/{api_identifier}",
        headers=_headers(token),
        timeout=15,
    )
    if response.status_code == 404:
        return None
    response.raise_for_status()
    return response.json().get("data")


def haal_assignment(token: str, assignment_uuid: str) -> dict | None:
    """
    Haal een assignment op via zijn eigen uuid (GET /api/public/assignments/{uuid}).

    None als niet gevonden (bijv. een verouderde of foutieve uuid) -- de aanroeper
    behandelt dat dan als 'niet afgerond', net als haal_taak_status al doet bij een
    onbekende taak. Geeft zowel relationships (welke candidate_task/_program/_process)
    als links.login_url in één keer terug -- dit is het enige publieke Ixly-endpoint dat
    een candidate se assignments betrouwbaar teruggeeft; GET /assignments (zonder uuid)
    heeft geen lijst/filter-variant.
    """
    response = requests.get(
        f"{IXLY_BASE_URL}/api/public/assignments/{assignment_uuid}",
        headers=_headers(token),
        timeout=15,
    )
    if response.status_code == 404:
        return None
    response.raise_for_status()
    return response.json().get("data")


def haal_assignments(token: str, candidate_uuid: str) -> list:
    """Alle assignments van een candidate. Lege lijst als er geen zijn."""
    response = requests.get(
        f"{IXLY_BASE_URL}/api/public/assignments",
        headers=_headers(token),
        params={"candidate_uuid": candidate_uuid},
        timeout=15,
    )
    if response.status_code == 404:
        return []
    response.raise_for_status()
    return response.json().get("data", [])


def haal_taak_status(tokens, soort: str, uuid: str) -> dict:
    """
    Haal state en completed_at van een candidate_task, _program of _process.

    Args:
        tokens: één token (str) of een lijst tokens, één per adviseur (zie
            haal_alle_tokens()). Een candidate_task is alleen zichtbaar voor de
            adviseur die de kandidaat bezit -- met de tokens van de andere adviseurs
            geeft hetzelfde uuid 404. Probeert de tokens op volgorde tot er een de
            taak vindt; een enkel token blijft ook werken (bijv. in tests).
        soort: sleutel uit TAAK_RELATIES
        uuid: het id uit de assignment-relatie

    Returns:
        {'state': str, 'completed_at': str} — leeg als GEEN van de tokens de taak kan
        zien. Een echte fout (bijv. HTTP 500) van een token stopt direct en propageert
        -- dat is geen 'verkeerde adviseur', dus niet stil doorlopen naar het volgende
        token.
    """
    pad = TAAK_RELATIES.get(soort)
    if not pad:
        return {"state": "", "completed_at": ""}

    if isinstance(tokens, str):
        tokens = [tokens]

    for token in tokens:
        response = requests.get(
            f"{IXLY_BASE_URL}/api/public/{pad}/{uuid}",
            headers=_headers(token),
            timeout=15,
        )
        if response.status_code == 404:
            continue
        response.raise_for_status()

        attributen = response.json().get("data", {}).get("attributes", {})
        # candidate_process gebruikt 'status' en 'finished_at'; de andere twee 'state'/'completed_at'.
        return {
            "state":        attributen.get("state") or attributen.get("status") or "",
            "completed_at": attributen.get("completed_at") or attributen.get("finished_at") or "",
        }

    return {"state": "", "completed_at": ""}
