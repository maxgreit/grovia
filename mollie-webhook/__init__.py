"""
Azure Function: Mollie Webhook
Trigger: HTTP POST van Mollie na statuswijziging betaling

Stappen:
  1. Ontvang ID van Mollie (form-encoded: id=pl_xxxxx voor payment links, id=tr_xxxxx voor losse betalingen)
  2. Bij pl_: haal de bijbehorende betaling op via /v2/payment-links/{id}/payments
     Bij tr_: haal de betaling direct op via /v2/payments/{id}
  3. Sla niet-betaalde statussen stil over (Mollie stuurt ook bij open, canceled, etc.)
  4. Lees klantcontext uit webhook query params (ingebed door mollie-betaallink)
  5. Roep ixly-aanmelding direct aan met de volledige klantcontext

Authenticatie:
  authLevel=anonymous — Mollie kan geen Azure function key meesturen.
  Beveiliging loopt via verificatie van de betaling bij de Mollie API zelf.

Omgevingsvariabelen:
  MOLLIE_API_KEY        -- live_... of test_...
  IXLY_AANMELDING_URL   -- volledige URL incl. ?code=KEY, bijv. https://.../api/ixly-aanmelding?code=...
"""

import logging
import os

import azure.functions as func
import requests


MOLLIE_API_KEY      = os.environ.get("MOLLIE_API_KEY", "")
IXLY_AANMELDING_URL = os.environ.get("IXLY_AANMELDING_URL", "")


# ── Mollie ────────────────────────────────────────────────────────────────────

def _haal_betaling_op(payment_id: str) -> dict:
    response = requests.get(
        f"https://api.mollie.com/v2/payments/{payment_id}",
        headers={"Authorization": f"Bearer {MOLLIE_API_KEY}"},
        timeout=15,
    )
    response.raise_for_status()
    return response.json()


def _haal_betaalde_betaling_van_link_op(payment_link_id: str) -> dict | None:
    """Geeft de eerste betaalde betaling terug voor een payment link, of None."""
    response = requests.get(
        f"https://api.mollie.com/v2/payment-links/{payment_link_id}/payments",
        headers={"Authorization": f"Bearer {MOLLIE_API_KEY}"},
        timeout=15,
    )
    response.raise_for_status()
    betalingen = response.json().get("_embedded", {}).get("payments", [])
    return next((b for b in betalingen if b.get("status") == "paid"), None)


# ── Handler ───────────────────────────────────────────────────────────────────

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("Mollie Webhook ontvangen.")

    payment_id = req.form.get("id") or req.params.get("id")
    if not payment_id:
        logging.warning("Webhook ontvangen zonder payment ID.")
        return func.HttpResponse("Geen payment ID.", status_code=200)

    logging.info(f"Ontvangen ID: {payment_id}")

    try:
        if payment_id.startswith("pl_"):
            betaling = _haal_betaalde_betaling_van_link_op(payment_id)
            if betaling is None:
                logging.info(f"Payment link {payment_id} nog niet betaald — geen actie.")
                return func.HttpResponse("Nog niet betaald.", status_code=200)
            logging.info(f"Betaalde betaling gevonden: {betaling.get('id')}")
        else:
            betaling = _haal_betaling_op(payment_id)
            status = betaling.get("status")
            logging.info(f"Betaalstatus voor {payment_id}: {status}")
            if status != "paid":
                return func.HttpResponse(f"Status '{status}' — geen actie.", status_code=200)
    except requests.HTTPError as e:
        logging.error(f"Mollie API fout bij ophalen betaling: {e.response.status_code} — {e.response.text}")
        return func.HttpResponse("Mollie API fout.", status_code=200)

    # Klantcontext zit als query params in de webhook URL (ingebed door mollie-betaallink).
    vereiste_params = ["email", "wc_klant_id", "order_id", "naam_kind", "voornaam", "achternaam"]
    ontbrekend = [p for p in vereiste_params if not req.params.get(p)]
    if ontbrekend:
        logging.error(f"Ontbrekende query params voor betaling {payment_id}: {', '.join(ontbrekend)}")
        return func.HttpResponse("Ontbrekende query params.", status_code=200)

    payload = {p: req.params.get(p) for p in vereiste_params}
    logging.info(f"Betaling voldaan — order_id: {payload['order_id']}, email: {payload['email']}")

    if not IXLY_AANMELDING_URL:
        logging.error("IXLY_AANMELDING_URL niet geconfigureerd.")
        return func.HttpResponse("IXLY_AANMELDING_URL niet geconfigureerd.", status_code=200)

    try:
        response = requests.post(IXLY_AANMELDING_URL, json=payload, timeout=30)
        response.raise_for_status()
        logging.info(f"Ixly aanmelding geslaagd voor order {payload['order_id']}.")
    except requests.HTTPError as e:
        logging.error(f"Ixly aanmelding mislukt: {e.response.status_code} — {e.response.text}")
        return func.HttpResponse("Ixly aanmelding mislukt.", status_code=200)
    except requests.RequestException as e:
        logging.error(f"Ixly aanmelding request fout: {e}")
        return func.HttpResponse("Ixly aanmelding request fout.", status_code=200)

    return func.HttpResponse("OK", status_code=200)
