"""
Azure Function: remindermail versturen.

Aangeroepen door het Apps Script van het werkboek "Grovia Deelnemers", zowel door
de dagelijkse trigger als door de handmatige knop. Bepaalt zelf niets over wie een
reminder verdient -- dat doet het Apps Script.

De login-urls worden per taak opgehaald via de bewaarde `assignment_uuid`
(WooCommerce order-meta `_grovia_ixly_taken`, geschreven door `ixly-aanmelding`).

Payload:
  {"email": "...", "voornaam": "...", "naam_kind": "...", "school_code": "KA",
   "code": "935", "open_testen": ["action_type", "ixly"],
   "taken": [{"naam": "...", "assignment_uuid": "..."}]}

Respons:
  {"verstuurd": true}
"""
import json
import logging
import os
import sys

import azure.functions as func
import requests

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from grovia_shared import grovia_mail, ixly_api

VERPLICHT = ["email", "voornaam", "naam_kind", "school_code", "code", "open_testen"]


def _haal_login_urls(taken_refs: list) -> list:
    """
    Haal de login-urls op voor de meegegeven taken via hun bewaarde assignment-uuid.

    Args:
        taken_refs: [{'naam': 'Blocks Game', 'assignment_uuid': '...'}]

    Returns:
        [{'naam': ..., 'login_url': ...}] -- alleen taken waarvoor een link gevonden is.
        Lege lijst als het token niet op te halen is.
    """
    try:
        token = ixly_api.haal_token()
    except requests.HTTPError as e:
        logging.error(f"Kon geen Ixly-token ophalen voor login-urls: {e.response.status_code}")
        return []

    resultaat = []
    for ref in taken_refs:
        assignment = ixly_api.haal_assignment(token, ref["assignment_uuid"])
        if not assignment:
            logging.warning(f"Assignment {ref['assignment_uuid']} niet gevonden voor {ref['naam']}.")
            continue
        login_url = assignment.get("links", {}).get("login_url")
        if login_url:
            resultaat.append({"naam": ref["naam"], "login_url": login_url})

    return resultaat


def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("Grovia Herinnering gestart.")

    try:
        body = req.get_json()
    except ValueError:
        return func.HttpResponse("Ongeldige JSON in request body.", status_code=400)

    ontbrekend = [v for v in VERPLICHT if not body.get(v)]
    if ontbrekend:
        return func.HttpResponse(
            json.dumps({"fout": f"Ontbrekende velden: {', '.join(ontbrekend)}"}),
            mimetype="application/json",
            status_code=400,
        )

    open_testen = body["open_testen"]
    taken_refs  = body.get("taken", [])
    assignments = _haal_login_urls(taken_refs) if "ixly" in open_testen else []

    if "ixly" in open_testen and not assignments:
        # Zonder links is een Ixly-reminder waardeloos; val terug op alleen Action Type.
        open_testen = [t for t in open_testen if t != "ixly"]
        logging.warning(f"Geen login-urls voor {body['code']} — Ixly uit de reminder gelaten.")

    mail = grovia_mail.bouw_herinnering(
        body["voornaam"], body["naam_kind"], body["school_code"],
        body["code"], open_testen, assignments,
    )

    if not mail:
        return func.HttpResponse(
            json.dumps({"verstuurd": False, "reden": "niets om te herinneren"}),
            mimetype="application/json",
            status_code=200,
        )

    onderwerp, tekst, html = mail
    school = grovia_mail.SCHOOL_DATA.get(body["school_code"], {})
    try:
        grovia_mail.verstuur(
            body["email"], onderwerp, tekst, html,
            afzender_naam=school.get("afzender_naam"),
            afzender_email=school.get("afzender_email"),
        )
    except Exception as e:
        logging.exception("Verzending mislukt")
        return func.HttpResponse(
            json.dumps({"verstuurd": False, "fout": str(e)}),
            mimetype="application/json",
            status_code=502,
        )

    return func.HttpResponse(
        json.dumps({"verstuurd": True}),
        mimetype="application/json",
        status_code=200,
    )
