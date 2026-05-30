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
