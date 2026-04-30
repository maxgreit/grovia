"""
Azure Function: Mollie Betaallink
Trigger: HTTP POST vanuit FunnelKit (na toewijzen StuurBetaallinkAssessment-tag)

Stappen:
  1. Ontvang klantgegevens van FunnelKit/WordPress
  2. Maak een Mollie Payment Link aan
  3. Stuur een e-mail naar de klant met de betaallink
  4. Geef de betaallink terug in de response

Verwachte payload (JSON):
  {
    "voornaam":     "Jan",
    "achternaam":   "Jansen",
    "email":        "jan@voorbeeld.nl",
    "wc_klant_id":  "12345",
    "bedrag":       "75.00",         -- in euro, twee decimalen
    "beschrijving": "...",           -- optioneel, default wordt gegenereerd
    "seizoen":      "2627"           -- optioneel, gebruikt in beschrijving
  }

Omgevingsvariabelen:
  MOLLIE_API_KEY          -- live_... of test_...
  MOLLIE_REDIRECT_URL     -- redirect na geslaagde betaling
  MOLLIE_WEBHOOK_URL      -- optioneel, voor betaalstatus callbacks
  SMTP_HOST               -- e.g. smtp.sendgrid.net
  SMTP_PORT               -- e.g. 587
  SMTP_GEBRUIKER          -- SMTP-gebruikersnaam
  SMTP_WACHTWOORD         -- SMTP-wachtwoord
  SMTP_AFZENDER           -- bijv. noreply@grovia.nl
  GROVIA_DEBUG_EMAIL      -- indien ingesteld: stuur e-mail hierheen i.p.v. naar klant
"""

import json
import logging
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import azure.functions as func
import requests


MOLLIE_API_KEY      = os.environ["MOLLIE_API_KEY"]
MOLLIE_REDIRECT_URL = os.environ["MOLLIE_REDIRECT_URL"]
MOLLIE_WEBHOOK_URL  = os.environ.get("MOLLIE_WEBHOOK_URL", "")

SMTP_HOST       = os.environ.get("SMTP_HOST", "")
SMTP_PORT       = int(os.environ.get("SMTP_PORT", "587"))
SMTP_GEBRUIKER  = os.environ.get("SMTP_GEBRUIKER", "")
SMTP_WACHTWOORD = os.environ.get("SMTP_WACHTWOORD", "")
SMTP_AFZENDER   = os.environ.get("SMTP_AFZENDER", "")

GROVIA_DEBUG_EMAIL = os.environ.get("GROVIA_DEBUG_EMAIL", "")


def _maak_mollie_betaallink(voornaam: str, achternaam: str, bedrag: str, beschrijving: str) -> str:
    """Maakt een Mollie Payment Link aan en geeft de URL terug."""
    payload = {
        "description": beschrijving,
        "amount": {
            "currency": "EUR",
            "value": bedrag,
        },
        "redirectUrl": MOLLIE_REDIRECT_URL,
    }
    if MOLLIE_WEBHOOK_URL:
        payload["webhookUrl"] = MOLLIE_WEBHOOK_URL

    response = requests.post(
        "https://api.mollie.com/v2/payment-links",
        headers={"Authorization": f"Bearer {MOLLIE_API_KEY}"},
        json=payload,
        timeout=15,
    )
    response.raise_for_status()
    return response.json()["_links"]["paymentLink"]["href"]


def _stuur_email(ontvanger: str, voornaam: str, betaallink: str) -> None:
    """Stuurt de betaallink per e-mail naar de klant (of debug-adres)."""
    if not SMTP_HOST:
        logging.warning("SMTP niet geconfigureerd — e-mail wordt overgeslagen.")
        return

    doel_adres = GROVIA_DEBUG_EMAIL if GROVIA_DEBUG_EMAIL else ontvanger

    bericht = MIMEMultipart("alternative")
    bericht["Subject"] = "Jouw betaallink voor Grovia"
    bericht["From"]    = SMTP_AFZENDER
    bericht["To"]      = doel_adres

    tekst = (
        f"Hoi {voornaam},\n\n"
        f"Je kunt je inschrijving afronden via de volgende betaallink:\n\n"
        f"{betaallink}\n\n"
        f"Na betaling ontvang je verdere informatie over je plek bij Grovia.\n\n"
        f"Met sportieve groet,\n"
        f"Team Grovia"
    )
    html = f"""
    <p>Hoi {voornaam},</p>
    <p>Je kunt je inschrijving afronden via de onderstaande betaallink:</p>
    <p><a href="{betaallink}" style="font-size:16px;font-weight:bold;">Klik hier om te betalen</a></p>
    <p>Of kopieer deze link in je browser:<br>{betaallink}</p>
    <p>Na betaling ontvang je verdere informatie over je plek bij Grovia.</p>
    <p>Met sportieve groet,<br>Team Grovia</p>
    """

    bericht.attach(MIMEText(tekst, "plain"))
    bericht.attach(MIMEText(html, "html"))

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        server.starttls()
        server.login(SMTP_GEBRUIKER, SMTP_WACHTWOORD)
        server.sendmail(SMTP_AFZENDER, doel_adres, bericht.as_string())

    if GROVIA_DEBUG_EMAIL:
        logging.info(f"DEBUG: e-mail gestuurd naar {GROVIA_DEBUG_EMAIL} (i.p.v. {ontvanger})")
    else:
        logging.info(f"E-mail verstuurd naar {ontvanger}")


def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("Mollie Betaallink gestart.")

    try:
        body = req.get_json()
    except ValueError:
        return func.HttpResponse("Ongeldige JSON in request body.", status_code=400)

    verplichte_velden = ["voornaam", "achternaam", "email", "wc_klant_id", "bedrag"]
    ontbrekend = [v for v in verplichte_velden if not body.get(v)]
    if ontbrekend:
        return func.HttpResponse(
            f"Ontbrekende velden: {', '.join(ontbrekend)}", status_code=400
        )

    voornaam    = body["voornaam"]
    achternaam  = body["achternaam"]
    email       = body["email"]
    bedrag      = body["bedrag"]
    seizoen     = body.get("seizoen", "")
    beschrijving = body.get(
        "beschrijving",
        f"Grovia voetbaltraining — inschrijving{' seizoen ' + seizoen if seizoen else ''}",
    )

    # Zorg dat bedrag altijd twee decimalen heeft (Mollie-vereiste)
    try:
        bedrag = f"{float(bedrag):.2f}"
    except ValueError:
        return func.HttpResponse("Ongeldig bedrag — gebruik bijv. '75.00'.", status_code=400)

    try:
        betaallink = _maak_mollie_betaallink(voornaam, achternaam, bedrag, beschrijving)
        logging.info(f"Betaallink aangemaakt voor {email}: {betaallink}")

        _stuur_email(email, voornaam, betaallink)

        return func.HttpResponse(
            json.dumps({
                "betaallink":   betaallink,
                "email":        email,
                "bedrag":       bedrag,
                "beschrijving": beschrijving,
            }),
            mimetype="application/json",
            status_code=200,
        )

    except requests.HTTPError as e:
        logging.error(f"Mollie API fout: {e.response.status_code} — {e.response.text}")
        return func.HttpResponse(f"Mollie API fout: {e.response.status_code}", status_code=502)
    except smtplib.SMTPException as e:
        logging.error(f"E-mail versturen mislukt: {e}")
        return func.HttpResponse("E-mail versturen mislukt.", status_code=500)
    except Exception as e:
        logging.exception("Onverwachte fout")
        return func.HttpResponse(f"Interne fout: {str(e)}", status_code=500)
