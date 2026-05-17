"""
Azure Function: Mollie Webhook
Trigger: HTTP POST van Mollie na statuswijziging betaling

Stappen:
  1. Ontvang payment ID van Mollie (form-encoded: id=tr_xxxxx)
  2. Verifieer betaling via Mollie API
  3. Sla niet-betaalde statussen stil over (Mollie stuurt ook bij open, canceled, etc.)
  4. Haal klantgegevens op uit webhook query params (email, wc_klant_id)
  5. Zoek FunnelKit contact op via e-mailadres
  6. Zet tag StuurAssessment op het contact

Authenticatie:
  authLevel=anonymous — Mollie kan geen Azure function key meesturen.
  Beveiliging loopt via verificatie van de betaling bij de Mollie API zelf.

Omgevingsvariabelen:
  MOLLIE_API_KEY                    -- live_... of test_...
  GROVIA_FUNNELKIT_API_KEY          -- FunnelKit REST API sleutel
  GROVIA_WORDPRESS_URL              -- bijv. https://grovia.nl
  FUNNELKIT_TAG_STUUR_ASSESSMENT_ID -- numerieke tag-ID van StuurAssessment in FunnelKit
"""

import logging
import os

import azure.functions as func
import requests


MOLLIE_API_KEY                    = os.environ.get("MOLLIE_API_KEY", "")
GROVIA_FUNNELKIT_API_KEY          = os.environ.get("GROVIA_FUNNELKIT_API_KEY", "")
GROVIA_WORDPRESS_URL              = os.environ.get("GROVIA_WORDPRESS_URL", "").rstrip("/")
FUNNELKIT_TAG_STUUR_ASSESSMENT_ID = os.environ.get("FUNNELKIT_TAG_STUUR_ASSESSMENT_ID", "")


# ── Mollie ────────────────────────────────────────────────────────────────────

def _haal_betaling_op(payment_id: str) -> dict:
    response = requests.get(
        f"https://api.mollie.com/v2/payments/{payment_id}",
        headers={"Authorization": f"Bearer {MOLLIE_API_KEY}"},
        timeout=15,
    )
    response.raise_for_status()
    return response.json()


# ── FunnelKit ─────────────────────────────────────────────────────────────────

def _zoek_contact_op(email: str) -> str:
    """Geeft contact_id terug, of raise ValueError als niet gevonden."""
    response = requests.get(
        f"{GROVIA_WORDPRESS_URL}/wp-json/funnelkit-automations/contact",
        params={"api_key": GROVIA_FUNNELKIT_API_KEY, "email": email},
        timeout=15,
    )
    response.raise_for_status()
    data = response.json()

    try:
        contact_id = data["data"]["contact"]["contact"]["id"]
    except (KeyError, TypeError):
        raise ValueError(f"Contact niet gevonden voor e-mail: {email}")

    return contact_id


def _zet_tag(contact_id: str, tag_id: int) -> None:
    response = requests.post(
        f"{GROVIA_WORDPRESS_URL}/wp-json/funnelkit-automations/contact/tag-assign/{contact_id}",
        params={"api_key": GROVIA_FUNNELKIT_API_KEY},
        json={"tags": [tag_id]},
        timeout=15,
    )
    response.raise_for_status()


# ── Handler ───────────────────────────────────────────────────────────────────

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("Mollie Webhook ontvangen.")

    # Mollie stuurt form-encoded body: id=tr_xxxxx
    payment_id = req.form.get("id") or req.params.get("id")
    if not payment_id:
        logging.warning("Webhook ontvangen zonder payment ID.")
        return func.HttpResponse("Geen payment ID.", status_code=200)

    logging.info(f"Payment ID: {payment_id}")

    try:
        betaling = _haal_betaling_op(payment_id)
    except requests.HTTPError as e:
        logging.error(f"Mollie API fout bij ophalen betaling: {e.response.status_code} — {e.response.text}")
        # 200 teruggeven zodat Mollie niet blijft herprobeert voor een structureel probleem
        return func.HttpResponse("Mollie API fout.", status_code=200)

    status = betaling.get("status")
    logging.info(f"Betaalstatus voor {payment_id}: {status}")

    if status != "paid":
        return func.HttpResponse(f"Status '{status}' — geen actie.", status_code=200)

    # Email en wc_klant_id zitten als query params in de webhook URL (Mollie payment-links
    # ondersteunen geen metadata — de klantidentificatie is ingebed door mollie-betaallink).
    email = req.params.get("email")
    wc_klant_id = req.params.get("wc_klant_id", "onbekend")

    if not email:
        logging.error(f"Geen e-mail in webhook query params voor betaling {payment_id}.")
        return func.HttpResponse("Geen e-mail in query params.", status_code=200)

    logging.info(f"Betaling voldaan — email: {email}, wc_klant_id: {wc_klant_id}")

    if not FUNNELKIT_TAG_STUUR_ASSESSMENT_ID:
        logging.error("FUNNELKIT_TAG_STUUR_ASSESSMENT_ID niet geconfigureerd.")
        return func.HttpResponse("Tag-ID niet geconfigureerd.", status_code=200)

    try:
        tag_id = int(FUNNELKIT_TAG_STUUR_ASSESSMENT_ID)
    except ValueError:
        logging.error(f"FUNNELKIT_TAG_STUUR_ASSESSMENT_ID is geen getal: {FUNNELKIT_TAG_STUUR_ASSESSMENT_ID}")
        return func.HttpResponse("Ongeldige tag-ID configuratie.", status_code=200)

    try:
        contact_id = _zoek_contact_op(email)
        logging.info(f"FunnelKit contact gevonden: {contact_id}")
    except (ValueError, requests.HTTPError) as e:
        logging.error(f"FunnelKit contact ophalen mislukt voor {email}: {e}")
        return func.HttpResponse("Contact niet gevonden.", status_code=200)

    try:
        _zet_tag(contact_id, tag_id)
        logging.info(f"Tag StuurAssessment (ID {tag_id}) gezet op contact {contact_id}.")
    except requests.HTTPError as e:
        logging.error(f"FunnelKit tag zetten mislukt: {e.response.status_code} — {e.response.text}")
        return func.HttpResponse("Tag zetten mislukt.", status_code=200)

    return func.HttpResponse("OK", status_code=200)
