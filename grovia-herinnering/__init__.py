"""
Azure Function: remindermail versturen.

Aangeroepen door het Apps Script van het werkboek "Grovia Deelnemers", zowel door
de dagelijkse trigger als door de handmatige knop. Bepaalt zelf niets over wie een
reminder verdient -- dat doet het Apps Script.

De login-urls worden per taak opgehaald via de bewaarde `assignment_uuid`
(WooCommerce order-meta `_grovia_ixly_taken`, geschreven door `ixly-aanmelding`) --
daarbij wordt de afrondingsstatus ook vers gecontroleerd, zodat een verouderde
ixly_af uit de Sheet nooit tot een onterechte "staat nog open"-mail leidt.

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
    Haal de login-urls op voor de meegegeven taken via hun bewaarde assignment-uuid --
    én controleer daarbij vers of de taken inmiddels al zijn afgerond.

    De Sheet's ixly_af-vlag kan verouderd zijn: de dagelijkse Ixly-statuscheck
    (IxlyStatus.gs) draait weliswaar vóór de reminder-stap in dezelfde run, maar Ixly's
    eigen 'finished'-status bleek niet altijd meteen opvraagbaar (geverifieerd
    2026-09-26/27 -- Lev Klaver: Ixly's completed_at gaf 24-9, terwijl de reminder op
    26-9 nog "Ixly staat nog open" meldde en de Sheet pas op 27-9 ixly_af=JA kreeg). Om
    nooit een "staat nog open"-mail te sturen voor iets dat al af is, doet deze functie
    zelf een verse statuscheck vlak vóór het versturen, i.p.v. te vertrouwen op de
    mogelijk verouderde ixly_af uit de Sheet.

    Args:
        taken_refs: [{'naam': 'Blocks Game', 'assignment_uuid': '...'}]

    Returns:
        [{'naam': ..., 'login_url': ...}] -- alleen taken waarvoor een link gevonden is.
        Lege lijst als het token niet op te halen is, als er geen link gevonden is, of
        als de verse controle uitwijst dat alle taken al zijn afgerond.
    """
    try:
        tokens = ixly_api.haal_alle_tokens()
    except requests.HTTPError as e:
        logging.error(f"Kon geen Ixly-token(s) ophalen voor login-urls: {e.response.status_code}")
        return []

    details = ixly_api.haal_taken_details(tokens, taken_refs)

    if ixly_api.bepaal_afronding(details)["af"]:
        logging.info("Ixly-taken blijken bij verse controle al afgerond -- reminder daarvoor overgeslagen.")
        return []

    return [
        {"naam": d["naam"], "login_url": d["login_url"]}
        for d in details
        if d.get("login_url")
    ]


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
