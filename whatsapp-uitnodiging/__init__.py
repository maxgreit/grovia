"""
Azure Function: WhatsApp Uitnodiging
Trigger: HTTP POST vanuit FunnelKit (na WooCommerce-order)

Stappen:
  1. Ontvang klantgegevens van FunnelKit
  2. Normaliseer telefoonnummer naar E.164
  3. Stuur WhatsApp-template via Meta Cloud API

Verwachte payload (JSON, via FunnelKit Send Data):
  {
    "voornaam":   "Jan",
    "achternaam": "Jansen",
    "telefoon":   "0612345678",
    "order_id":   "42"
  }

Response (JSON):
  {
    "bericht_id": "wamid...."
  }
"""

import json
import logging
import os
import re

import azure.functions as func
import requests


WHATSAPP_PHONE_NUMBER_ID = os.environ.get("WHATSAPP_PHONE_NUMBER_ID", "")
WHATSAPP_ACCESS_TOKEN    = os.environ.get("WHATSAPP_ACCESS_TOKEN", "")
WHATSAPP_TEMPLATE_NAAM   = os.environ.get("WHATSAPP_TEMPLATE_NAAM", "hello_world")


def _normaliseer_telefoon(telefoon: str) -> str:
    """
    Normaliseer telefoonnummer naar E.164-formaat (zonder +).

    Ondersteunde formats:
    - 0612345678 -> 31612345678
    - +31612345678 -> 31612345678
    - 0031612345678 -> 31612345678
    - 06 12 34 56 78 -> 31612345678
    - 06-12-34-56-78 -> 31612345678
    """
    # Verwijder spaties, koppeltekens en haakjes
    telefoon = re.sub(r'[\s\-\(\)]', '', telefoon)

    # Verwijder + prefix
    if telefoon.startswith('+'):
        return telefoon[1:]

    # Zet 00 prefix om naar landcode
    if telefoon.startswith('00'):
        return telefoon[2:]

    # Zet 0 prefix om naar landcode (alleen voor 10-cijferige nummers)
    if telefoon.startswith('0') and len(telefoon) == 10:
        return '31' + telefoon[1:]

    # Retourneer as-is (al in E.164 formaat)
    return telefoon


def _stuur_whatsapp_template(telefoon_e164: str, voornaam: str) -> dict:
    """
    Stuur WhatsApp-template via Meta Cloud API.

    Args:
        telefoon_e164: Telefoonnummer in E.164-formaat (bijv. 31612345678)
        voornaam: Voornaam van de klant

    Returns:
        JSON response van Meta Cloud API (bevat message ID)

    Raises:
        requests.exceptions.HTTPError: Bij API-fout
    """
    url = f"https://graph.facebook.com/v21.0/{WHATSAPP_PHONE_NUMBER_ID}/messages"
    headers = {
        "Authorization": f"Bearer {WHATSAPP_ACCESS_TOKEN}",
        "Content-Type": "application/json",
    }
    body = {
        "messaging_product": "whatsapp",
        "to": telefoon_e164,
        "type": "template",
        "template": {
            "name": WHATSAPP_TEMPLATE_NAAM,
            "language": {"code": "en_US"},
            # TODO: components met voornaam ({{1}}) + groepslink ({{2}}) toevoegen zodra klant echte template heeft bepaald
        },
    }
    response = requests.post(url, headers=headers, json=body, timeout=15)
    response.raise_for_status()
    return response.json()


def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("WhatsApp Uitnodiging gestart.")

    try:
        body = req.get_json()
    except ValueError:
        return func.HttpResponse("Ongeldige JSON in request body.", status_code=400)

    ontbrekend = [v for v in ["voornaam", "achternaam", "telefoon", "order_id"] if not body.get(v)]
    if ontbrekend:
        return func.HttpResponse(
            json.dumps({"fout": f"Ontbrekende velden: {', '.join(ontbrekend)}"}),
            mimetype="application/json",
            status_code=400,
        )

    try:
        telefoon_e164 = _normaliseer_telefoon(body["telefoon"])
        result = _stuur_whatsapp_template(telefoon_e164, body["voornaam"])

        bericht_id = result.get("messages", [{}])[0].get("id", "")
        logging.info(f"WhatsApp verstuurd naar {telefoon_e164}, order {body['order_id']}, id {bericht_id}")

        return func.HttpResponse(
            json.dumps({"bericht_id": bericht_id}),
            mimetype="application/json",
            status_code=200,
        )

    except requests.HTTPError as e:
        logging.error(f"Meta API fout: {e.response.status_code} — {e.response.text}")
        return func.HttpResponse(
            json.dumps({"fout": f"Meta API fout: {e.response.status_code}"}),
            mimetype="application/json",
            status_code=502,
        )
    except Exception as e:
        logging.exception("Onverwachte fout")
        return func.HttpResponse(
            json.dumps({"fout": str(e)}),
            mimetype="application/json",
            status_code=500,
        )
