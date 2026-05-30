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


WHATSAPP_PHONE_NUMBER_ID       = os.environ.get("WHATSAPP_PHONE_NUMBER_ID", "")
WHATSAPP_ACCESS_TOKEN          = os.environ.get("WHATSAPP_ACCESS_TOKEN", "")
WHATSAPP_TEMPLATE_NAAM         = os.environ.get("WHATSAPP_TEMPLATE_NAAM", "grovia_trainingsgroep")
WHATSAPP_GROEP_UITNODIGING_URL = os.environ.get("WHATSAPP_GROEP_UITNODIGING_URL", "")


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
