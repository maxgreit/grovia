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
    "order_id":     "42",            -- WooCommerce order ID; wordt in webhookUrl gezet
    "beschrijving": "...",           -- optioneel, default wordt gegenereerd
    "seizoen":      "2627",          -- optioneel, gebruikt in beschrijving
    "school_code":  "KA"             -- optioneel, reist mee in webhookUrl naar mollie-webhook
                                         -- -> ixly-aanmelding, voor de combinatie-mail na betaling
  }

  Bedrag is altijd €20,00 (hardcoded) — het bijdragebedrag voor de cognitieve games.

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


def _maak_mollie_betaallink(
    voornaam: str, achternaam: str, naam_kind: str, email: str, wc_klant_id: str, order_id: str,
    bedrag: str, beschrijving: str, school_code: str = "",
) -> str:
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
        # Alle klantcontext als query params in de webhookUrl — Mollie payment-links ondersteunen
        # geen metadata. De mollie-webhook roept hiermee direct ixly-aanmelding aan bij betaling.
        # school_code reist zo mee tot na betaling, zodat de combinatie-mail (games + eventueel
        # Action Type) daar met de juiste schoolgegevens verstuurd kan worden.
        from urllib.parse import urlencode
        params = urlencode({
            "email":       email,
            "wc_klant_id": wc_klant_id,
            "order_id":    order_id,
            "naam_kind":   naam_kind,
            "voornaam":    voornaam,
            "achternaam":  achternaam,
            "school_code": school_code,
        })
        payload["webhookUrl"] = f"{MOLLIE_WEBHOOK_URL}?{params}"

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
    bericht["Subject"] = "Nog één stapje: jouw bijdrage voor de Grovia games"
    bericht["From"]    = SMTP_AFZENDER
    bericht["To"]      = doel_adres

    tekst = (
        f"Hoi {voornaam},\n\n"
        f"Omdat je dit seizoen op een later moment instroomt, vragen we een kleine bijdrage voor "
        f"de twee cognitieve games die klaarstaan. Zodra we je betaling ontvangen, sturen we direct "
        f"de speellink door.\n\n"
        f"Betaal je bijdrage:\n{betaallink}\n\n"
        f"Alvast bedankt!\n\n"
        f"Sportieve groet,\n"
        f"Team Grovia"
    )
    html = f"""
    <div style="font-family: Arial, Helvetica, sans-serif; color: #2b2b2b; line-height: 1.6; max-width: 600px; margin: 0 auto;">
      <h1 style="font-size: 24px; margin: 0 0 24px;">Nog één stapje voor de Grovia games</h1>
      <p style="margin: 0 0 18px;">Hoi {voornaam},</p>
      <p style="margin: 0 0 18px;">Omdat je dit seizoen op een later moment instroomt, vragen we een kleine
      bijdrage voor de twee cognitieve games die klaarstaan. Zodra we je betaling ontvangen, sturen we
      direct de speellink door.</p>
      <p style="text-align: center; margin: 0 0 28px;">
        <a href="{betaallink}"
           style="background: #5b4fc7; color: #ffffff; text-decoration: none; padding: 14px 28px;
                  border-radius: 6px; font-weight: bold; display: inline-block;">
          Betaal je bijdrage
        </a>
      </p>
      <p style="font-size: 13px; color: #666; margin: 0 0 24px;">Lukt de knop niet? Kopieer dan deze link in je browser:<br>
      {betaallink}</p>
      <p style="margin: 0;">Alvast bedankt!<br>Sportieve groet,<br>Team Grovia</p>
    </div>
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

    verplichte_velden = ["voornaam", "achternaam", "naam_kind", "email", "wc_klant_id", "order_id"]
    ontbrekend = [v for v in verplichte_velden if not body.get(v)]
    if ontbrekend:
        return func.HttpResponse(
            f"Ontbrekende velden: {', '.join(ontbrekend)}", status_code=400
        )

    voornaam    = body["voornaam"]
    achternaam  = body["achternaam"]
    naam_kind   = body["naam_kind"]
    email       = body["email"]
    order_id    = str(body["order_id"])
    seizoen     = body.get("seizoen", "")
    beschrijving = body.get(
        "beschrijving",
        f"Grovia voetbaltraining — inschrijving{' seizoen ' + seizoen if seizoen else ''}",
    )

    # Bijdrage is altijd €20,00 — ongeacht wat de payload meestuurt
    bedrag = "20.00"

    school_code = body.get("school_code", "")

    try:
        betaallink = _maak_mollie_betaallink(
            voornaam, achternaam, naam_kind, email, str(body["wc_klant_id"]), order_id,
            bedrag, beschrijving, school_code,
        )
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
        return func.HttpResponse(
            f"Mollie API fout: {e.response.status_code} — {e.response.text}",
            status_code=502,
        )
    except smtplib.SMTPException as e:
        logging.error(f"E-mail versturen mislukt: {e}")
        return func.HttpResponse("E-mail versturen mislukt.", status_code=500)
    except Exception as e:
        logging.exception("Onverwachte fout")
        return func.HttpResponse(f"Interne fout: {str(e)}", status_code=500)
