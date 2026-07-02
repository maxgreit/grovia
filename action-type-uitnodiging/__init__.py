"""
Azure Function: Action Type Uitnodiging
Trigger: HTTP POST vanuit grovia-test-router.php (na ActionType-guard-tag)

Stuurt een e-mail met de school-specifieke Action Type test-link naar de ouder.

Verwachte payload (JSON):
  {
    "voornaam":    "Jan",
    "naam_kind":   "Lisa Jansen",
    "email":       "jan@voorbeeld.nl",
    "school_code": "KA"
  }

Response (JSON):
  {"status": "ok", "school": "Kolping Academie"}
"""

import json
import logging
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import azure.functions as func


SMTP_HOST       = os.environ.get("SMTP_HOST", "")
SMTP_PORT       = int(os.environ.get("SMTP_PORT", "587"))
SMTP_GEBRUIKER  = os.environ.get("SMTP_GEBRUIKER", "")
SMTP_WACHTWOORD = os.environ.get("SMTP_WACHTWOORD", "")
SMTP_AFZENDER   = os.environ.get("SMTP_AFZENDER", "")

SCHOOL_DATA = {
    "KA": {
        "naam":       "Kolping Academie",
        "form_url":   os.environ.get(
            "ACTION_TYPE_FORM_URL_KA",
            "https://docs.google.com/forms/d/e/1FAIpQLSc6HIBgffV-rQiM4KDFW4weK3JGOzGKWrGwUP1D7HtNYg_Qiw/viewform",
        ),
        "kleur":      "#ed6c02",
        "afsluiting": "Kolping Academie",
    },
    "SU": {
        "naam":       "Schagen United Academie",
        "form_url":   os.environ.get(
            "ACTION_TYPE_FORM_URL_SU",
            "https://docs.google.com/forms/d/e/1FAIpQLSd521BhxYq3L27FNmqZ5w2D1Bra6Sk9NwB_dvgRlKHRIDbl8g/viewform",
        ),
        "kleur":      "#d32f2f",
        "afsluiting": "Schagen United Academie",
    },
}


def _stuur_email(ontvanger: str, voornaam: str, school: dict) -> None:
    if not SMTP_HOST:
        logging.warning("SMTP niet geconfigureerd -- e-mail wordt overgeslagen.")
        return

    form_url   = school["form_url"]
    naam       = school["naam"]
    kleur      = school["kleur"]
    afsluiting = school["afsluiting"]

    bericht = MIMEMultipart("alternative")
    bericht["Subject"] = "Ontdek hoe jouw kind denkt en speelt"
    bericht["From"]    = SMTP_AFZENDER
    bericht["To"]      = ontvanger

    tekst = (
        f"Hoi {voornaam},\n\n"
        f"Leuk dat jouw kind meetraint bij {naam}! Om de trainers te helpen jouw kind zo "
        f"goed mogelijk te begeleiden, vragen we je kind een korte test in te vullen: "
        f"de Action Type test.\n\n"
        f"Wat is het? 20 korte vraagjes, steeds kiezen tussen zin a of zin b. Het duurt "
        f"ongeveer 5 tot 10 minuten. Er zijn geen goede of foute antwoorden; het gaat "
        f"erom hoe jouw kind denkt en doet. Het is de bedoeling dat je kind de test zelf maakt, "
        f"zonder verdere hulp van papa of mama -- alleen voorlezen mag.\n\n"
        f"Let op: vul bij de vraag 'Naam' de volledige naam van je kind in (voornaam en "
        f"achternaam), zodat we de uitslag aan de juiste speler kunnen koppelen.\n\n"
        f"Start de test: {form_url}\n\n"
        f"Alvast bedankt!\n"
        f"Sportieve groet,\n{afsluiting}"
    )

    html = f"""
    <div style="font-family: Arial, Helvetica, sans-serif; color: #2b2b2b; line-height: 1.6; max-width: 600px; margin: 0 auto;">
      <h1 style="font-size: 26px; margin: 0 0 24px;">Welkom bij {naam}!</h1>
      <p style="margin: 0 0 18px;">Hoi {voornaam},</p>
      <p style="margin: 0 0 18px;">Leuk dat jouw kind meetraint bij {naam}! Om de trainers te helpen
      jouw kind zo goed mogelijk te begeleiden, vragen we je kind een korte test in te vullen:
      de <strong>Action Type test</strong>.</p>
      <p style="margin: 0 0 18px;"><strong>Wat is het?</strong> 20 korte vraagjes, steeds kiezen tussen zin a of
      zin b. Het duurt ongeveer 5 tot 10 minuten. Er zijn geen goede of foute antwoorden; het
      gaat erom hoe jouw kind denkt en doet. Het is de bedoeling dat je kind de test zelf maakt,
      zonder verdere hulp van papa of mama &mdash; alleen voorlezen mag.</p>
      <p style="background: #f4f6f8; border-radius: 8px; padding: 16px 20px; margin: 0 0 24px;">
      <strong>Let op:</strong> vul bij de vraag "Naam" de <strong>volledige naam van je kind</strong>
      in (voornaam en achternaam), zodat we de uitslag aan de juiste speler kunnen koppelen.</p>
      <p style="text-align: center; margin: 0 0 28px;">
        <a href="{form_url}"
           style="background: {kleur}; color: #ffffff; text-decoration: none; padding: 14px 28px;
                  border-radius: 6px; font-weight: bold; display: inline-block;">
          Start de test
        </a>
      </p>
      <p style="font-size: 13px; color: #666; margin: 0 0 24px;">Lukt de knop niet? Kopieer dan deze link in je browser:<br>
      {form_url}</p>
      <p style="margin: 0;">Alvast bedankt!<br>Sportieve groet,<br>{afsluiting}</p>
    </div>
    """

    bericht.attach(MIMEText(tekst, "plain"))
    bericht.attach(MIMEText(html, "html"))

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        server.starttls()
        server.login(SMTP_GEBRUIKER, SMTP_WACHTWOORD)
        server.sendmail(SMTP_AFZENDER, ontvanger, bericht.as_string())

    logging.info(f"Action Type uitnodiging verstuurd naar {ontvanger} (school: {naam})")


def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("Action Type Uitnodiging gestart.")

    try:
        body = req.get_json()
    except ValueError:
        return func.HttpResponse("Ongeldige JSON in request body.", status_code=400)

    ontbrekend = [v for v in ["voornaam", "naam_kind", "email", "school_code"] if not body.get(v)]
    if ontbrekend:
        return func.HttpResponse(
            json.dumps({"fout": f"Ontbrekende velden: {', '.join(ontbrekend)}"}),
            mimetype="application/json",
            status_code=400,
        )

    school_code = body["school_code"]
    school = SCHOOL_DATA.get(school_code)
    if not school:
        return func.HttpResponse(
            json.dumps({"fout": f"Onbekende school_code: {school_code}"}),
            mimetype="application/json",
            status_code=400,
        )

    try:
        _stuur_email(body["email"], body["voornaam"], school)
        return func.HttpResponse(
            json.dumps({"status": "ok", "school": school["naam"]}),
            mimetype="application/json",
            status_code=200,
        )
    except smtplib.SMTPException as e:
        logging.error(f"E-mail versturen mislukt: {e}")
        return func.HttpResponse(
            json.dumps({"fout": "E-mail versturen mislukt."}),
            mimetype="application/json",
            status_code=500,
        )
    except Exception as e:
        logging.exception("Onverwachte fout")
        return func.HttpResponse(
            json.dumps({"fout": str(e)}),
            mimetype="application/json",
            status_code=500,
        )
