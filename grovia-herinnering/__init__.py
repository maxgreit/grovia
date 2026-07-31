"""
Azure Function: remindermail versturen.

Aangeroepen door het Apps Script van het werkboek "Grovia Deelnemers", zowel door
de dagelijkse trigger als door de handmatige knop. Bepaalt zelf niets over wie een
reminder verdient -- dat doet het Apps Script.

De Ixly-login-urls worden hier opnieuw opgehaald, omdat ze nergens bewaard worden.

Payload:
  {"email": "...", "voornaam": "...", "naam_kind": "...", "school_code": "KA",
   "code": "935", "open_testen": ["action_type", "ixly"]}

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


def _haal_login_urls(code: str) -> list:
    """
    Haal de Ixly-login-urls opnieuw op. Lege lijst als het niet lukt of de candidate onbekend is.

    Een reminder over alleen de Action Type-test heeft deze links niet nodig, dus een
    mislukking hier mag de mail niet blokkeren.
    """
    try:
        token     = ixly_api.haal_token()
        candidate = ixly_api.zoek_candidate(token, code)
        if not candidate:
            logging.warning(f"Geen Ixly-candidate voor code {code}.")
            return []

        return [
            {"naam": a.get("attributes", {}).get("title", "de game"),
             "login_url": a.get("links", {}).get("login_url", "")}
            for a in ixly_api.haal_assignments(token, candidate["id"])
            if a.get("links", {}).get("login_url")
        ]
    except requests.HTTPError as e:
        logging.error(f"Kon login-urls niet ophalen voor {code}: {e.response.status_code}")
        return []


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
    assignments = _haal_login_urls(body["code"]) if "ixly" in open_testen else []

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
    try:
        grovia_mail.verstuur(body["email"], onderwerp, tekst, html)
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
