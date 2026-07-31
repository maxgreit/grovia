"""
Gedeelde mailopmaak en -verzending voor de Grovia Azure Functions.

Zowel de uitnodiging (ixly-aanmelding) als de reminder (grovia-herinnering)
gebruikt deze module, zodat de huisstijl op één plek staat.
"""
import logging
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from urllib.parse import urlencode

SMTP_HOST       = os.environ.get("SMTP_HOST", "")
SMTP_PORT       = int(os.environ.get("SMTP_PORT", "587"))
SMTP_GEBRUIKER  = os.environ.get("SMTP_GEBRUIKER", "")
SMTP_WACHTWOORD = os.environ.get("SMTP_WACHTWOORD", "")
SMTP_AFZENDER   = os.environ.get("SMTP_AFZENDER", "")

# Als dit gevuld is, gaat ALLE mail naar dit adres in plaats van naar de ouder.
GROVIA_DEBUG_EMAIL = os.environ.get("GROVIA_DEBUG_EMAIL", "")

# Action Type test -- alleen KA/SU, MM heeft geen Action Type test.
# ENTRY_ID's komen uit de Google Forms; zie het `Config`-tabblad van het werkboek
# "Grovia Deelnemers" en google-apps-script/action-type-setup.gs (leesEntryIds).
SCHOOL_DATA = {
    "KA": {
        "naam":       "Kolping Academie",
        "form_url":   os.environ.get(
            "ACTION_TYPE_FORM_URL_KA",
            "https://docs.google.com/forms/d/e/1FAIpQLSc6HIBgffV-rQiM4KDFW4weK3JGOzGKWrGwUP1D7HtNYg_Qiw/viewform",
        ),
        "entry_ids": {
            "code": os.environ.get("ACTION_TYPE_ENTRY_CODE_KA", ""),
            "naam": os.environ.get("ACTION_TYPE_ENTRY_NAAM_KA", ""),
        },
        "kleur":      "#ed6c02",
        "afsluiting": "Kolping Academie",
    },
    "SU": {
        "naam":       "Schagen United Academie",
        "form_url":   os.environ.get(
            "ACTION_TYPE_FORM_URL_SU",
            "https://docs.google.com/forms/d/e/1FAIpQLSd521BhxYq3L27FNmqZ5w2D1Bra6Sk9NwB_dvgRlKHRIDbl8g/viewform",
        ),
        "entry_ids": {
            "code": os.environ.get("ACTION_TYPE_ENTRY_CODE_SU", ""),
            "naam": os.environ.get("ACTION_TYPE_ENTRY_NAAM_SU", ""),
        },
        "kleur":      "#d32f2f",
        "afsluiting": "Schagen United Academie",
    },
}


def bouw_prefill_url(basis_url: str, entry_ids: dict, code: str, naam_kind: str) -> str:
    """
    Bouw een Google Forms-link met vooringevulde controlecode en naam.

    Args:
        basis_url: de publieke viewform-URL van het formulier
        entry_ids: {'code': '<entry-id>', 'naam': '<entry-id>'} — leeg dict geeft de basis-URL terug
        code: de controlecode (het order_id)
        naam_kind: volledige naam van het kind

    Returns:
        De volledige URL, of basis_url als er geen entry-id's bekend zijn.
    """
    if not entry_ids:
        return basis_url

    parameters = {"usp": "pp_url"}
    if entry_ids.get("code"):
        parameters[f"entry.{entry_ids['code']}"] = code
    if entry_ids.get("naam"):
        parameters[f"entry.{entry_ids['naam']}"] = naam_kind

    return f"{basis_url}?{urlencode(parameters)}"


def bouw_uitnodiging(voornaam: str, assignments: list, school_code: str | None, code: str, naam_kind: str) -> tuple[str, str, str] | None:
    """
    Bouw de uitnodigingsmail (games + Action Type test) voor de gegeven school.

    Args:
        voornaam: voornaam van de ouder (billing), niet van het kind
        assignments: lijst met {'naam': ..., 'login_url': ...} per game
        school_code: 'KA' / 'SU' / iets anders (of None) -- alleen KA/SU krijgen een mail
        code: de controlecode (het order_id)
        naam_kind: volledige naam van het kind

    Returns:
        (onderwerp, tekst, html), of None als school_code niet herkend wordt (bijv. MM).
    """
    school = SCHOOL_DATA.get(school_code) if school_code else None
    if not school:
        # MM (of een ontbrekend/onbekend school_code) doet niet mee aan de games/Action
        # Type-flow -- geen mail versturen. Kandidaat/assignments in Ixly blijven wel
        # gewoon aangemaakt (dat is een aparte, technische stap richting Ixly zelf).
        return None

    if not school.get("entry_ids", {}).get("code"):
        logging.error(
            f"ACTION_TYPE_ENTRY_CODE_{school_code} is niet gezet -- de formulierlink krijgt geen "
            f"controlecode mee, waardoor de uitslag niet automatisch te koppelen is."
        )
    formulier_url = bouw_prefill_url(
        school["form_url"], school.get("entry_ids", {}), code, naam_kind
    )

    links_tekst = "\n".join(
        f"- {a['naam']}: {a['login_url']}" for a in assignments if a.get("login_url")
    )
    links_html = "\n".join(
        f'<p style="text-align: center; margin: 0 0 16px;">'
        f'<a href="{a["login_url"]}" '
        f'style="background: #5b4fc7; color: #ffffff; text-decoration: none; padding: 12px 24px; '
        f'border-radius: 6px; font-weight: bold; display: inline-block;">Start {a["naam"]}</a></p>'
        for a in assignments if a.get("login_url")
    )

    afsluiting = school["afsluiting"]

    action_type_tekst = (
        f"\nEr is nog iets: om de training zo goed mogelijk af te stemmen, vragen we ook "
        f"een korte test in te vullen: de Action Type test. 20 korte vraagjes, steeds "
        f"kiezen tussen zin a of zin b, ongeveer 5 tot 10 minuten. De test wordt zelf "
        f"gemaakt, zonder verdere hulp van papa of mama -- alleen voorlezen mag.\n\n"
        f"Start de Action Type test: {formulier_url}\n"
    )
    action_type_html = f"""
      <div style="background: #f4f6f8; border-radius: 8px; padding: 16px 20px; margin: 24px 0;">
        <p style="margin: 0 0 12px;">Er is nog iets: om de training zo goed mogelijk af te
        stemmen, vragen we ook een korte test in te vullen: de <strong>Action Type test</strong>.
        20 korte vraagjes, steeds kiezen tussen zin a of zin b, ongeveer 5 tot 10 minuten.</p>
        <p style="margin: 0;">De test wordt zelf gemaakt, zonder verdere hulp van papa of mama
        &mdash; alleen voorlezen mag.</p>
      </div>
      <p style="text-align: center; margin: 0 0 28px;">
        <a href="{formulier_url}"
           style="background: {school['kleur']}; color: #ffffff; text-decoration: none; padding: 14px 28px;
                  border-radius: 6px; font-weight: bold; display: inline-block;">
          Start de Action Type test
        </a>
      </p>
"""

    onderwerp = "Tijd voor de Grovia games en de Action Type test"

    tekst = (
        f"Hoi {voornaam},\n\n"
        f"De twee cognitieve games — Rally en Blocks — staan klaar om te spelen. "
        f"Reken op ongeveer een uur speeltijd.\n\n"
        f"Gebruik de onderstaande links om te starten:\n\n"
        f"{links_tekst}\n\n"
        f"Zo haal je het beste resultaat:\n"
        f"- Speel op een rustig moment, op een pc of laptop (niet op een telefoon of tablet).\n"
        f"- Speel zelf, zonder hulp van papa of mama — dat kan het resultaat beïnvloeden.\n"
        f"- Papa of mama mag wel helpen tot het moment dat de game begint.\n"
        f"- Lees de instructies goed door voor je begint.\n"
        f"- Zet de game niet op pauze en blijf spelen tot deze is afgelopen.\n"
        f"{action_type_tekst}\n"
        f"Veel succes!\n\n"
        f"Sportieve groet,\n"
        f"{afsluiting}"
    )
    html = f"""
    <div style="font-family: Arial, Helvetica, sans-serif; color: #2b2b2b; line-height: 1.6; max-width: 600px; margin: 0 auto;">
      <h1 style="font-size: 24px; margin: 0 0 24px;">Tijd voor de Grovia games</h1>
      <p style="margin: 0 0 18px;">Hoi {voornaam},</p>
      <p style="margin: 0 0 18px;">De twee cognitieve games — <strong>Rally</strong> en <strong>Blocks</strong> —
      staan klaar om te spelen. Reken op ongeveer een uur speeltijd.</p>
      {links_html}
      <div style="background: #f4f6f8; border-radius: 8px; padding: 16px 20px; margin: 24px 0;">
        <p style="margin: 0 0 8px;"><strong>Zo haal je het beste resultaat:</strong></p>
        <ul style="margin: 0; padding-left: 20px;">
          <li>Speel op een rustig moment, op een pc of laptop (niet op een telefoon of tablet).</li>
          <li>Speel zelf, zonder hulp van papa of mama — dat kan het resultaat beïnvloeden.</li>
          <li>Papa of mama mag wel helpen tot het moment dat de game begint.</li>
          <li>Lees de instructies goed door voor je begint.</li>
          <li>Zet de game niet op pauze en blijf spelen tot deze is afgelopen.</li>
        </ul>
      </div>
      {action_type_html}
      <p style="margin: 0;">Veel succes!<br>Sportieve groet,<br>{afsluiting}</p>
    </div>
    """

    return onderwerp, tekst, html


def bouw_herinnering(
    voornaam: str,
    naam_kind: str,
    school_code: str,
    code: str,
    open_testen: list,
    assignments: list,
) -> tuple | None:
    """
    Bouw een remindermail die alleen de nog openstaande testen noemt.

    Args:
        voornaam: voornaam van de ouder
        naam_kind: volledige naam van het kind
        school_code: 'KA' of 'SU'
        code: de controlecode (het order_id)
        open_testen: lijst met 'action_type' en/of 'ixly'
        assignments: [{'naam': ..., 'login_url': ...}] — alleen gebruikt als 'ixly' open staat

    Returns:
        (onderwerp, tekst, html), of None als er niets open staat of de school onbekend is.
    """
    school = SCHOOL_DATA.get(school_code) if school_code else None
    if not school or not open_testen:
        return None

    kind_voornaam = naam_kind.split()[0] if naam_kind else "je kind"
    onderwerp = f"Herinnering: de test van {kind_voornaam} staat nog open"

    blokken_tekst = []
    blokken_html  = []

    if "ixly" in open_testen:
        links = "\n".join(
            f"- {a['naam']}: {a['login_url']}" for a in assignments if a.get("login_url")
        )
        blokken_tekst.append(
            f"De twee cognitieve games staan nog klaar. Reken op ongeveer een uur speeltijd.\n\n{links}\n"
        )
        knoppen = "\n".join(
            f'<p style="text-align: center; margin: 0 0 16px;">'
            f'<a href="{a["login_url"]}" '
            f'style="background: #5b4fc7; color: #ffffff; text-decoration: none; padding: 12px 24px; '
            f'border-radius: 6px; font-weight: bold; display: inline-block;">Start {a["naam"]}</a></p>'
            for a in assignments if a.get("login_url")
        )
        blokken_html.append(
            '<p style="margin: 0 0 18px;">De twee cognitieve games staan nog klaar. Reken op '
            'ongeveer een uur speeltijd.</p>' + knoppen
        )

    if "action_type" in open_testen:
        if not school.get("entry_ids", {}).get("code"):
            logging.error(
                f"ACTION_TYPE_ENTRY_CODE_{school_code} is niet gezet -- de formulierlink krijgt geen "
                f"controlecode mee, waardoor de uitslag niet automatisch te koppelen is."
            )
        formulier_url = bouw_prefill_url(
            school["form_url"], school.get("entry_ids", {}), code, naam_kind
        )
        blokken_tekst.append(
            f"De Action Type test duurt ongeveer 5 tot 10 minuten: 20 korte vraagjes, steeds "
            f"kiezen tussen zin a of zin b.\n\nStart de Action Type test: {formulier_url}\n"
        )
        blokken_html.append(
            '<p style="margin: 0 0 18px;">De Action Type test duurt ongeveer 5 tot 10 minuten: '
            '20 korte vraagjes, steeds kiezen tussen zin a of zin b.</p>'
            f'<p style="text-align: center; margin: 0 0 28px;">'
            f'<a href="{formulier_url}" style="background: {school["kleur"]}; color: #ffffff; '
            f'text-decoration: none; padding: 14px 28px; border-radius: 6px; font-weight: bold; '
            f'display: inline-block;">Start de Action Type test</a></p>'
        )

    tekst = (
        f"Hoi {voornaam},\n\n"
        f"Een korte herinnering: voor {kind_voornaam} staat nog iets open.\n\n"
        + "\n".join(blokken_tekst)
        + f"\nAlvast bedankt!\n\nSportieve groet,\n{school['afsluiting']}"
    )
    html = f"""
    <div style="font-family: Arial, Helvetica, sans-serif; color: #2b2b2b; line-height: 1.6; max-width: 600px; margin: 0 auto;">
      <h1 style="font-size: 24px; margin: 0 0 24px;">Nog even dit</h1>
      <p style="margin: 0 0 18px;">Hoi {voornaam},</p>
      <p style="margin: 0 0 18px;">Een korte herinnering: voor <strong>{kind_voornaam}</strong> staat nog iets open.</p>
      {"".join(blokken_html)}
      <p style="margin: 0;">Alvast bedankt!<br>Sportieve groet,<br>{school['afsluiting']}</p>
    </div>
    """

    return onderwerp, tekst, html


def verstuur(ontvanger: str, onderwerp: str, tekst: str, html: str) -> None:
    """
    Verstuur een mail via SMTP. Respecteert GROVIA_DEBUG_EMAIL.

    Doet niets (met een waarschuwing in het log) als SMTP niet geconfigureerd is.
    """
    if not SMTP_HOST:
        logging.warning("SMTP niet geconfigureerd — e-mail wordt overgeslagen.")
        return

    doel_adres = GROVIA_DEBUG_EMAIL if GROVIA_DEBUG_EMAIL else ontvanger

    bericht = MIMEMultipart("alternative")
    bericht["Subject"] = onderwerp
    bericht["From"]    = SMTP_AFZENDER
    bericht["To"]      = doel_adres
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
