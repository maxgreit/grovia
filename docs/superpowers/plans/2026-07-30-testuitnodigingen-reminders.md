# Testuitnodigingen, reminders en deelnemersoverzicht — implementatieplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Grovia inzicht geven in wie de Action Type-test en de Ixly-games wel en niet heeft gemaakt, met automatische reminders op 7/14/21/35/49 dagen en handmatige knoppen, bediend vanuit één Google Sheet.

**Architecture:** Een Google Sheet is de database en het bedieningspaneel; Apps Script bepaalt wie wat nodig heeft en haalt de deelnemers uit WooCommerce. Mailen gebeurt niet in de Sheet maar in Azure Functions, die de bestaande SMTP en huisstijl al hebben. De sleutel die alles verbindt is de controlecode, en dat is simpelweg het `order_id` — dat is al de `api_identifier` bij Ixly en wordt nu ook als vooringevuld veld in de Google Forms gezet.

**Tech Stack:** Python 3.12 (Azure Functions, `azure-functions` 1.21.3, `requests` 2.33.0), Google Apps Script (V8), Google Sheets, WooCommerce REST API v3, Ixly Assessments API. Tests: `unittest` via pytest voor Python, `node --test` voor de pure Apps Script-logica.

**Spec:** [`docs/superpowers/specs/2026-07-30-testuitnodigingen-reminders-design.md`](../specs/2026-07-30-testuitnodigingen-reminders-design.md)

## Global Constraints

- **Code, docs, commits en UI in het Nederlands.** Functienamen, variabelen en comments Nederlands, conform [CLAUDE.md](../../../CLAUDE.md).
- **Nooit secrets in code.** WCAPI-sleutels en Azure-functiesleutels in Apps Script **Script Properties**; Ixly- en SMTP-credentials in **Azure App Settings**. Nooit in een cel in de Sheet — die is deelbaar.
- **Reminderdrempels: 7, 14, 21, 35, 49 dagen na `uitgenodigd_op`, maximaal 5 per kind.** Configureerbaar via `Config`, maar dit zijn de waarden waarmee we live gaan.
- **De controlecode is het `order_id`.** Nooit een hash, nooit een slug.
- **De bestaande resultaten-sheets worden alleen gelezen, nooit geschreven.** Google Forms overschrijft kolommen in en naast het reactie-tabblad bij elke inzending.
- **Alleen KA en SU.** MiniMove doet niet mee en komt niet in de Sheet.
- **Elke externe call krijgt een timeout** (Python: 15s zoals bestaand; Apps Script: `UrlFetchApp` met `muteHttpExceptions: true` en expliciete statuscheck).
- **PHP-lint kan niet lokaal** (geen `php`-binary, Docker-daemon staat uit). Er wordt in dit plan geen PHP gewijzigd, dus dat blokkeert niets.

## Bestandsstructuur

**Nieuw — Python:**

| Bestand | Verantwoordelijkheid |
|---|---|
| `grovia_shared/grovia_mail.py` | Mailopmaak en verzending, gedeeld door beide mail-endpoints |
| `grovia_shared/__init__.py` | Maakt `grovia_shared` importeerbaar |
| `ixly-status/__init__.py` | Order-id's in, afrondingsstatus per taak uit |
| `ixly-status/function.json` | HTTP-trigger, POST, authLevel `function` |
| `grovia-herinnering/__init__.py` | Verstuurt de remindermail |
| `grovia-herinnering/function.json` | HTTP-trigger, POST, authLevel `function` |
| `grovia_shared/ixly_api.py` | Ixly-token, candidate- en assignment-calls, gedeeld |

**Nieuw — Apps Script** (in `google-apps-script/deelnemers/`, één map zodat het als één project te deployen is):

| Bestand | Verantwoordelijkheid |
|---|---|
| `Config.gs` | Script Properties en het `Config`-tabblad uitlezen |
| `Woo.gs` | orders en producten ophalen via de WCAPI |
| `Deelnemers.gs` | `upsertDeelnemers` — pure functie, rijen samenvoegen |
| `ActionType.gs` | `koppelReacties` — pure functie, reacties aan rijen koppelen |
| `IxlyStatus.gs` | `ixly-status` aanroepen en kolommen bijwerken |
| `Reminders.gs` | `bepaalReminders` — pure functie, plus de verzendwrapper |
| `Sheet.gs` | lezen en schrijven van tabbladen — de enige plek die `SpreadsheetApp` aanraakt |
| `Menu.gs` | het menu "Grovia" met de handmatige acties |
| `Dagelijks.gs` | de trigger die de vijf stappen orkestreert |
| `Dashboard.gs` | het `Dashboard`-tabblad opbouwen |

**Nieuw — tests:**

| Bestand | Dekt |
|---|---|
| `tests/conftest.py` | module-loader zodat meerdere `__init__.py`'s naast elkaar kunnen |
| `tests/test_grovia_mail.py` | mailopmaak, prefill-URL, alleen-open-testen-logica |
| `tests/test_ixly_status.py` | statusbepaling en foutgevallen |
| `tests/test_grovia_herinnering.py` | validatie en verzending |
| `tests/gs/deelnemers.test.js` | `upsertDeelnemers` |
| `tests/gs/actiontype.test.js` | `koppelReacties` |
| `tests/gs/reminders.test.js` | `bepaalReminders` |

**Gewijzigd:**

| Bestand | Wijziging |
|---|---|
| `ixly-aanmelding/__init__.py` | mailopmaak eruit, `grovia_mail` erin, controlecode in de formulierlink |
| `google-apps-script/action-type-setup.gs` | `Controlecode`-veld toevoegen + entry-id's uitlezen |
| `tests/test_whatsapp_uitnodiging.py` | verouderde signatuur repareren |
| `local.settings.json.example` | nieuwe omgevingsvariabelen |
| `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, `docs/ACTION-TYPE-TEST.md`, `docs/TODO.md` | documentatie |

## Interface-contract: de deelnemersrij

Elke rij is in Apps Script een plat object. Alle taken die rijen aanraken gebruiken exact deze
sleutels:

```javascript
{
  seizoen: '2526',                 // string
  naam_slug: 'freddie-rood',       // string, alleen intern — hoeft NIET gelijk te zijn aan de PHP-slug
  naam_kind: 'Freddie Rood',       // string
  vereniging: 'KA',                // 'KA' of 'SU'
  ouder_naam: 'Max Rood',          // string
  ouder_email: 'max@voorbeeld.nl', // string
  order_ids: ['935', '941'],       // array van strings, oplopend
  code: '935',                     // string, het laagste order_id
  uitgenodigd_op: '2026-08-01',    // 'YYYY-MM-DD'
  action_type_af: false,           // boolean
  action_type_op: '',              // 'YYYY-MM-DD' of ''
  action_type: '',                 // bijv. 'ISTJ' of ''
  ixly_af: false,                  // boolean
  ixly_op: '',                     // 'YYYY-MM-DD' of ''
  reminders_verzonden: 0,          // number, 0..5
  laatste_reminder_op: '',         // 'YYYY-MM-DD' of ''
  laatste_poging_op: ''            // 'YYYY-MM-DD' of ''
}
```

Kolomvolgorde in het `Deelnemers`-tabblad is exact deze volgorde. `Sheet.gs` is de enige plek die
die volgorde kent.

---

### Task 1: Groene testbasis

De testsuite is nu rood: `tests/test_whatsapp_uitnodiging.py` test een verouderde signatuur, en
omdat elke function-map een `__init__.py` heeft, geeft Python de eerste geïmporteerde module terug
bij de tweede import. Zonder dit opgelost is TDD op de nieuwe functions niet te doen — je kunt je
eigen falende test niet van de bestaande ruis onderscheiden.

**Files:**
- Create: `tests/conftest.py`
- Modify: `tests/test_whatsapp_uitnodiging.py`
- Modify: `tests/test_ixly_aanmelding_unit.py:1-11`

**Interfaces:**
- Consumes: niets
- Produces: `laad_function_module(mapnaam: str) -> module` in `tests/conftest.py`, te importeren als
  `from conftest import laad_function_module`. Elke latere Python-test gebruikt deze in plaats van
  `sys.path.insert` + `import __init__`.

- [ ] **Step 1: Stel de huidige, rode basis vast**

Run: `python -m pytest tests/ -q 2>&1 | tail -3`
Expected: `15 failed, 26 passed`. Leg dit vast — dit is het vertrekpunt.

- [ ] **Step 2: Schrijf de module-loader**

Create `tests/conftest.py`:

```python
"""
Gedeelde testhulp: laadt een Azure Function-module onder een unieke naam.

Elke function-map heeft een __init__.py. Met `sys.path.insert` + `import __init__`
geeft Python bij de tweede import de eerste module terug uit sys.modules, waardoor
tests elkaar besmetten. Deze loader geeft elke module een eigen naam.
"""
import importlib.util
import os

WORTEL = os.path.join(os.path.dirname(__file__), '..')


def laad_function_module(mapnaam: str):
    """
    Laad de __init__.py van een Azure Function-map als losse module.

    Args:
        mapnaam: naam van de function-map, bijv. 'ixly-status'

    Returns:
        De geladen module. De modulenaam is 'grovia_test_<mapnaam met _>'.
    """
    bestand = os.path.join(WORTEL, mapnaam, '__init__.py')
    modulenaam = 'grovia_test_' + mapnaam.replace('-', '_')

    spec = importlib.util.spec_from_file_location(modulenaam, bestand)
    module = importlib.util.module_from_spec(spec)

    # Registreren vóór exec_module: unittest.mock.patch lost een string-target op via
    # importlib.import_module, dus zonder deze regel faalt elke @patch("grovia_test_...")
    # met een ModuleNotFoundError. Dit is ook het canonieke PEP 451-patroon.
    sys.modules[modulenaam] = module

    spec.loader.exec_module(module)
    return module
```

Importeer bovenaan ook `sys`, naast `importlib.util` en `os`.

- [ ] **Step 3: Zet de bestaande tests op de loader over**

In `tests/test_ixly_aanmelding_unit.py`, vervang de regels 5 t/m 11:

```python
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'ixly-aanmelding'))

import unittest
from unittest.mock import MagicMock, patch
import __init__ as ixly
```

door:

```python
import unittest
from unittest.mock import MagicMock, patch
from conftest import laad_function_module

ixly = laad_function_module('ixly-aanmelding')
```

Alle `@patch("__init__.requests.post")`-decorators moeten mee. Vervang in dit bestand elke
`"__init__."` door `"grovia_test_ixly_aanmelding."`.

In `tests/test_whatsapp_uitnodiging.py`, vervang regels 5 t/m 12 door:

```python
import json
import unittest
from unittest.mock import MagicMock, patch
from conftest import laad_function_module

wa = laad_function_module('whatsapp-uitnodiging')
```

en vervang in dat bestand elke `"__init__."` door `"grovia_test_whatsapp_uitnodiging."`.

- [ ] **Step 4: Repareer de verouderde signatuur**

`_stuur_whatsapp_template` heeft vier parameters — `(telefoon_e164, voornaam, schoolnaam, groepslink)` — en de
template-parameters zijn `{{1}}` voornaam, `{{2}}` schoolnaam, `{{3}}` groepslink
([`whatsapp-uitnodiging/__init__.py:68`](../../../whatsapp-uitnodiging/__init__.py)). De constante
`WHATSAPP_GROEP_UITNODIGING_URL` bestaat niet meer; de groepslink komt uit de payload.

In `tests/test_whatsapp_uitnodiging.py`, vervang de hele klasse `TestStuurWhatsappTemplate` door:

```python
class TestStuurWhatsappTemplate(unittest.TestCase):
    """Meta Cloud API wordt correct aangeroepen."""

    def _mock_respons(self):
        return MagicMock(**{"json.return_value": {"messages": [{"id": "wamid.test123"}]}})

    @patch("grovia_test_whatsapp_uitnodiging.requests.post")
    def test_stuurt_naar_juiste_url(self, mock_post):
        mock_post.return_value = self._mock_respons()
        with patch("grovia_test_whatsapp_uitnodiging.WHATSAPP_PHONE_NUMBER_ID", "12345"):
            wa._stuur_whatsapp_template("31612345678", "Jan", "Kolping Academie", "https://chat.whatsapp.com/test")

        url = mock_post.call_args.args[0]
        self.assertIn("12345", url)
        self.assertIn("graph.facebook.com", url)

    @patch("grovia_test_whatsapp_uitnodiging.requests.post")
    def test_stuurt_voornaam_als_eerste_parameter(self, mock_post):
        mock_post.return_value = self._mock_respons()

        wa._stuur_whatsapp_template("31612345678", "Jan", "Kolping Academie", "https://chat.whatsapp.com/test")

        params = mock_post.call_args.kwargs["json"]["template"]["components"][0]["parameters"]
        self.assertEqual(params[0]["text"], "Jan")

    @patch("grovia_test_whatsapp_uitnodiging.requests.post")
    def test_stuurt_schoolnaam_als_tweede_parameter(self, mock_post):
        mock_post.return_value = self._mock_respons()

        wa._stuur_whatsapp_template("31612345678", "Jan", "Kolping Academie", "https://chat.whatsapp.com/test")

        params = mock_post.call_args.kwargs["json"]["template"]["components"][0]["parameters"]
        self.assertEqual(params[1]["text"], "Kolping Academie")

    @patch("grovia_test_whatsapp_uitnodiging.requests.post")
    def test_stuurt_groepslink_als_derde_parameter(self, mock_post):
        mock_post.return_value = self._mock_respons()

        wa._stuur_whatsapp_template("31612345678", "Jan", "Kolping Academie", "https://chat.whatsapp.com/test")

        params = mock_post.call_args.kwargs["json"]["template"]["components"][0]["parameters"]
        self.assertEqual(params[2]["text"], "https://chat.whatsapp.com/test")

    @patch("grovia_test_whatsapp_uitnodiging.requests.post")
    def test_messaging_product_is_whatsapp(self, mock_post):
        mock_post.return_value = self._mock_respons()

        wa._stuur_whatsapp_template("31612345678", "Jan", "Kolping Academie", "https://chat.whatsapp.com/test")

        self.assertEqual(mock_post.call_args.kwargs["json"]["messaging_product"], "whatsapp")

    @patch("grovia_test_whatsapp_uitnodiging.requests.post")
    def test_geeft_json_response_terug(self, mock_post):
        mock_post.return_value = self._mock_respons()

        result = wa._stuur_whatsapp_template("31612345678", "Jan", "Kolping Academie", "https://chat.whatsapp.com/test")

        self.assertEqual(result["messages"][0]["id"], "wamid.test123")
```

En vervang `_goed_payload` (regel 112-120), want `main` eist nu ook `schoolnaam` en `groepslink`:

```python
    def _goed_payload(self, **overrides):
        base = {
            "voornaam":   "Jan",
            "achternaam": "Jansen",
            "telefoon":   "0612345678",
            "schoolnaam": "Kolping Academie",
            "groepslink": "https://chat.whatsapp.com/test",
            "order_id":   "42",
        }
        base.update(overrides)
        return base
```

Let op: `main` valideert `voornaam`, `telefoon`, `schoolnaam` en `groepslink` — **niet** `order_id`
([`whatsapp-uitnodiging/__init__.py:122`](../../../whatsapp-uitnodiging/__init__.py)). De bestaande
test `test_ontbrekend_order_id_geeft_400` test dus gedrag dat de code niet heeft. Vervang die test
door de twee die er wél horen:

```python
    def test_ontbrekend_schoolnaam_geeft_400(self):
        body = self._goed_payload()
        del body["schoolnaam"]
        self.assertEqual(wa.main(self._maak_request(body)).status_code, 400)

    def test_ontbrekend_groepslink_geeft_400(self):
        body = self._goed_payload()
        del body["groepslink"]
        self.assertEqual(wa.main(self._maak_request(body)).status_code, 400)
```

- [ ] **Step 5: Draai de hele suite en verifieer groen**

Run: `python -m pytest tests/ -q 2>&1 | tail -3`
Expected: alles passeert, 0 failed. Draai ook `python -m pytest tests/test_ixly_aanmelding_unit.py tests/test_whatsapp_uitnodiging.py -q` los, om te bevestigen dat de modulebesmetting weg is.

- [ ] **Step 6: Commit**

```bash
git add tests/conftest.py tests/test_whatsapp_uitnodiging.py tests/test_ixly_aanmelding_unit.py
git commit -m "test: groene basis — module-loader per function + verouderde whatsapp-tests bijgewerkt"
```

---

### Task 2: Gedeelde mailmodule `grovia_mail.py`

De mailopmaak zit inline in `ixly-aanmelding` ([`__init__.py:264-378`](../../../ixly-aanmelding/__init__.py)).
De reminder heeft dezelfde huisstijl nodig. Deze taak verplaatst de opmaak **zonder
gedragsverandering**: dezelfde mail, dezelfde tekst, alleen ergens anders vandaan.

**Files:**
- Create: `grovia_shared/__init__.py`
- Create: `grovia_shared/grovia_mail.py`
- Create: `tests/test_grovia_mail.py`
- Modify: `ixly-aanmelding/__init__.py`

**Interfaces:**
- Consumes: `laad_function_module` uit Task 1
- Produces:
  - `SCHOOL_DATA: dict` — verhuist hierheen uit `ixly-aanmelding`
  - `bouw_prefill_url(basis_url: str, entry_ids: dict, code: str, naam_kind: str) -> str`
  - `bouw_uitnodiging(voornaam: str, assignments: list, school_code: str, code: str, naam_kind: str) -> tuple[str, str, str]` → `(onderwerp, tekst, html)`
  - `verstuur(ontvanger: str, onderwerp: str, tekst: str, html: str) -> None`

- [ ] **Step 1: Schrijf de falende test voor de prefill-URL**

Create `tests/test_grovia_mail.py`:

```python
"""
Unit tests voor de gedeelde mailmodule.
Gebruik: pytest tests/test_grovia_mail.py -v
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from grovia_shared import grovia_mail


class TestBouwPrefillUrl(unittest.TestCase):
    """De formulierlink krijgt code en naam als vooringevulde velden."""

    BASIS = "https://docs.google.com/forms/d/e/FORMID/viewform"
    ENTRIES = {"code": "123456", "naam": "654321"}

    def test_bevat_pp_url_marker(self):
        url = grovia_mail.bouw_prefill_url(self.BASIS, self.ENTRIES, "935", "Freddie Rood")
        self.assertIn("usp=pp_url", url)

    def test_bevat_code_als_entry(self):
        url = grovia_mail.bouw_prefill_url(self.BASIS, self.ENTRIES, "935", "Freddie Rood")
        self.assertIn("entry.123456=935", url)

    def test_naam_wordt_url_gecodeerd(self):
        url = grovia_mail.bouw_prefill_url(self.BASIS, self.ENTRIES, "935", "Freddie Rood")
        self.assertIn("entry.654321=Freddie+Rood", url)

    def test_zonder_entry_ids_blijft_basis_url(self):
        url = grovia_mail.bouw_prefill_url(self.BASIS, {}, "935", "Freddie Rood")
        self.assertEqual(url, self.BASIS)
```

- [ ] **Step 2: Draai de test en verifieer dat hij faalt**

Run: `python -m pytest tests/test_grovia_mail.py -v`
Expected: FAIL met `ModuleNotFoundError: No module named 'grovia_shared'`

- [ ] **Step 3: Maak het pakket en de prefill-functie**

Create `grovia_shared/__init__.py` (leeg bestand, maakt de map importeerbaar).

Create `grovia_shared/grovia_mail.py`:

```python
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
```

- [ ] **Step 4: Draai de test en verifieer dat hij passeert**

Run: `python -m pytest tests/test_grovia_mail.py -v`
Expected: 4 passed

- [ ] **Step 5: Verplaats `SCHOOL_DATA` en de uitnodigingsopmaak**

Voeg aan `grovia_shared/grovia_mail.py` toe, direct onder de SMTP-constanten. Neem
`SCHOOL_DATA` **letterlijk** over uit [`ixly-aanmelding/__init__.py:69`](../../../ixly-aanmelding/__init__.py),
inclusief de `os.environ.get`-defaults, en breid het uit met de entry-id's:

```python
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
```

**De hardcoded fallback-URL's moeten blijven staan.** Zonder die vallen de formulierlinks weg zodra
de omgevingsvariabele niet gezet is, en dat is een regressie ten opzichte van het huidige gedrag.
Ze zijn letterlijk overgenomen uit [`ixly-aanmelding/__init__.py:69`](../../../ixly-aanmelding/__init__.py),
net als de kleuren `#ed6c02` (KA) en `#d32f2f` (SU).

Verplaats daarna de functie `_stuur_email` uit `ixly-aanmelding/__init__.py` hierheen, opgesplitst in
`bouw_uitnodiging` (die `(onderwerp, tekst, html)` teruggeeft) en `verstuur` (die mailt). De
tekst- en HTML-inhoud gaat **ongewijzigd** mee, met twee uitzonderingen die in Task 3 aan de orde
komen. Voeg toe:

```python
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
```

- [ ] **Step 6: Schrijf de test die bewijst dat de mail niet veranderd is**

Voeg toe aan `tests/test_grovia_mail.py`:

```python
class TestBouwUitnodiging(unittest.TestCase):
    """De uitnodigingsmail houdt zijn bestaande inhoud."""

    ASSIGNMENTS = [
        {"naam": "Blocks Game", "login_url": "https://ixly.test/blocks"},
        {"naam": "Rally Game",  "login_url": "https://ixly.test/rally"},
    ]

    def _bouw(self, school_code="KA"):
        return grovia_mail.bouw_uitnodiging(
            "Max", self.ASSIGNMENTS, school_code, "935", "Freddie Rood"
        )

    def test_onderwerp_ongewijzigd(self):
        onderwerp, _, _ = self._bouw()
        self.assertEqual(onderwerp, "Tijd voor de Grovia games en de Action Type test")

    def test_beide_gamelinks_in_tekst(self):
        _, tekst, _ = self._bouw()
        self.assertIn("https://ixly.test/blocks", tekst)
        self.assertIn("https://ixly.test/rally", tekst)

    def test_beide_gamelinks_in_html(self):
        _, _, html = self._bouw()
        self.assertIn("https://ixly.test/blocks", html)
        self.assertIn("https://ixly.test/rally", html)

    def test_afsluiting_per_vereniging(self):
        _, tekst, _ = self._bouw("KA")
        self.assertIn("Kolping Academie", tekst)

    def test_onbekende_school_geeft_none(self):
        self.assertIsNone(grovia_mail.bouw_uitnodiging("Max", self.ASSIGNMENTS, "MM", "935", "Kind"))


class TestVerstuur(unittest.TestCase):
    """Verzending respecteert de SMTP-configuratie."""

    def test_zonder_smtp_host_geen_verzending(self):
        with unittest.mock.patch.object(grovia_mail, "SMTP_HOST", ""), \
             unittest.mock.patch.object(grovia_mail, "smtplib") as mock_smtp:
            grovia_mail.verstuur("a@b.nl", "Onderwerp", "tekst", "<p>html</p>")
            mock_smtp.SMTP.assert_not_called()

    def test_debug_adres_overschrijft_ontvanger(self):
        with unittest.mock.patch.object(grovia_mail, "SMTP_HOST", "smtp.test"), \
             unittest.mock.patch.object(grovia_mail, "GROVIA_DEBUG_EMAIL", "debug@test.nl"), \
             unittest.mock.patch.object(grovia_mail, "smtplib") as mock_smtp:
            grovia_mail.verstuur("ouder@test.nl", "Onderwerp", "tekst", "<p>html</p>")
            server = mock_smtp.SMTP.return_value.__enter__.return_value
            self.assertEqual(server.sendmail.call_args.args[1], "debug@test.nl")
```

Voeg `import unittest.mock` bovenaan het testbestand toe.

`bouw_uitnodiging` geeft `None` terug bij een onbekende `school_code` — dat vervangt de huidige
`return`-in-`_stuur_email` voor MM, zodat de beslissing "wel of geen mail" bij de aanroeper ligt.

- [ ] **Step 7: Draai de tests**

Run: `python -m pytest tests/test_grovia_mail.py -v`
Expected: alles passeert

- [ ] **Step 8: Laat `ixly-aanmelding` de module gebruiken**

In `ixly-aanmelding/__init__.py`: verwijder `SCHOOL_DATA`, `_stuur_email` en de
`smtplib`/`MIMEMultipart`/`MIMEText`-imports en de SMTP-constanten. Voeg bovenaan toe:

```python
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from grovia_shared import grovia_mail
```

Vervang de aanroep op regel 413 (`_stuur_email(...)`) door:

```python
        mail = grovia_mail.bouw_uitnodiging(
            body["voornaam"],
            assignments,
            body.get("school_code"),
            body["order_id"],
            body["naam_kind"],
        )
        if mail:
            onderwerp, tekst, html = mail
            grovia_mail.verstuur(body["email"], onderwerp, tekst, html)
        else:
            logging.info(
                f"Geen (herkend) school_code ('{body.get('school_code')}') -- mail overgeslagen."
            )
```

- [ ] **Step 9: Draai de volledige suite**

Run: `python -m pytest tests/ -q`
Expected: alles passeert. De bestaande `ixly-aanmelding`-tests mogen niet breken.

- [ ] **Step 10: Commit**

```bash
git add grovia_shared/ tests/test_grovia_mail.py ixly-aanmelding/__init__.py
git commit -m "refactor: mailopmaak naar gedeelde module grovia_mail"
```

---

### Task 3: Controlecode in de uitnodigingsmail

De Action Type-link in de uitnodiging wordt een vooringevulde link, en de instructie om zelf een
naam te typen verdwijnt.

**Files:**
- Modify: `grovia_shared/grovia_mail.py`
- Modify: `tests/test_grovia_mail.py`
- Modify: `local.settings.json.example`

**Interfaces:**
- Consumes: `bouw_prefill_url`, `SCHOOL_DATA`, `bouw_uitnodiging` uit Task 2
- Produces: geen nieuwe functies; `bouw_uitnodiging` gebruikt nu intern de prefill-URL

- [ ] **Step 1: Schrijf de falende tests**

Voeg toe aan `tests/test_grovia_mail.py`, in `TestBouwUitnodiging`:

```python
    def test_action_type_link_bevat_controlecode(self):
        with unittest.mock.patch.dict(
            grovia_mail.SCHOOL_DATA["KA"],
            {"form_url": "https://forms.test/ka", "entry_ids": {"code": "111", "naam": "222"}},
        ):
            _, tekst, html = self._bouw()
        self.assertIn("entry.111=935", tekst)
        self.assertIn("entry.111=935", html)

    def test_action_type_link_bevat_naam_kind(self):
        with unittest.mock.patch.dict(
            grovia_mail.SCHOOL_DATA["KA"],
            {"form_url": "https://forms.test/ka", "entry_ids": {"code": "111", "naam": "222"}},
        ):
            _, tekst, _ = self._bouw()
        self.assertIn("entry.222=Freddie+Rood", tekst)

    def test_geen_instructie_om_naam_te_typen(self):
        _, tekst, html = self._bouw()
        self.assertNotIn("volledige naam", tekst)
        self.assertNotIn("volledige naam", html)
```

- [ ] **Step 2: Draai de tests en verifieer dat ze falen**

Run: `python -m pytest tests/test_grovia_mail.py -v`
Expected: de drie nieuwe tests FAIL — de link is nog de basis-URL en de instructietekst staat er nog.

- [ ] **Step 3: Gebruik de prefill-URL en verwijder de instructie**

In `grovia_mail.bouw_uitnodiging`: bepaal de link één keer, bovenaan de functie:

```python
    formulier_url = bouw_prefill_url(
        school["form_url"], school.get("entry_ids", {}), code, naam_kind
    )
```

Vervang elk gebruik van `school['form_url']` in `action_type_tekst` en `action_type_html` door
`formulier_url`.

Verwijder uit `action_type_tekst` de regel:

```
Let op: vul bij de vraag 'Naam' de volledige naam in (voornaam en achternaam), zodat we de uitslag aan de juiste speler kunnen koppelen.
```

en uit `action_type_html` de bijbehorende paragraaf:

```html
<p style="margin: 0 0 18px;"><strong>Let op:</strong> vul bij de vraag "Naam" de
<strong>volledige naam</strong> in (voornaam en achternaam), zodat we de uitslag aan de
juiste speler kunnen koppelen.</p>
```

Die instructie is niet alleen overbodig maar misleidend: het veld is nu vooringevuld.

- [ ] **Step 4: Draai de tests**

Run: `python -m pytest tests/test_grovia_mail.py -v`
Expected: alles passeert

- [ ] **Step 5: Documenteer de nieuwe omgevingsvariabelen**

In `local.settings.json.example`, voeg toe onder `ACTION_TYPE_FORM_URL_SU`:

```json
    "ACTION_TYPE_ENTRY_CODE_KA": "",
    "ACTION_TYPE_ENTRY_NAAM_KA": "",
    "ACTION_TYPE_ENTRY_CODE_SU": "",
    "ACTION_TYPE_ENTRY_NAAM_SU": "",
    "IXLY_STATUS_URL": "",
    "GROVIA_HERINNERING_URL": ""
```

- [ ] **Step 6: Commit**

```bash
git add grovia_shared/grovia_mail.py tests/test_grovia_mail.py local.settings.json.example
git commit -m "feat: controlecode vooringevuld in de Action Type-formulierlink"
```

---

### Task 4: Azure Function `ixly-status`

**Files:**
- Create: `grovia_shared/ixly_api.py`
- Create: `ixly-status/__init__.py`
- Create: `ixly-status/function.json`
- Create: `tests/test_ixly_status.py`

**Interfaces:**
- Consumes: `laad_function_module` uit Task 1
- Produces:
  - `grovia_shared.ixly_api.haal_token() -> str`
  - `grovia_shared.ixly_api.zoek_candidate(token: str, api_identifier: str) -> dict | None`
  - `grovia_shared.ixly_api.haal_assignments(token: str, candidate_uuid: str) -> list`
  - `grovia_shared.ixly_api.haal_taak_status(token: str, soort: str, uuid: str) -> dict` → `{'state': str, 'completed_at': str}`
  - HTTP-contract: `POST /api/ixly-status` met `{"order_ids": ["935", "941"]}` → `200` met
    `{"resultaten": {"935": {"gevonden": true, "af": true, "completed_at": "2026-07-20", "taken": [...]}}}`

- [ ] **Step 1: Schrijf de falende test voor de statusbepaling**

Create `tests/test_ixly_status.py`:

```python
"""
Unit tests voor de ixly-status Azure Function.
Gebruik: pytest tests/test_ixly_status.py -v
"""
import json
import unittest
from unittest.mock import MagicMock, patch
from conftest import laad_function_module

status = laad_function_module('ixly-status')


class TestBepaalAfronding(unittest.TestCase):
    """Afgerond betekent: alle taken afgerond."""

    def test_alle_taken_afgerond_is_af(self):
        taken = [
            {"naam": "Blocks Game", "state": "completed", "completed_at": "2026-07-18T10:00:00Z"},
            {"naam": "Rally Game",  "state": "completed", "completed_at": "2026-07-20T10:00:00Z"},
        ]
        resultaat = status._bepaal_afronding(taken)
        self.assertTrue(resultaat["af"])

    def test_laatste_afrondingsdatum_wordt_gebruikt(self):
        taken = [
            {"naam": "Blocks Game", "state": "completed", "completed_at": "2026-07-18T10:00:00Z"},
            {"naam": "Rally Game",  "state": "completed", "completed_at": "2026-07-20T10:00:00Z"},
        ]
        resultaat = status._bepaal_afronding(taken)
        self.assertEqual(resultaat["completed_at"], "2026-07-20")

    def test_een_taak_open_is_niet_af(self):
        taken = [
            {"naam": "Blocks Game", "state": "completed", "completed_at": "2026-07-18T10:00:00Z"},
            {"naam": "Rally Game",  "state": "started",   "completed_at": ""},
        ]
        self.assertFalse(status._bepaal_afronding(taken)["af"])

    def test_geen_taken_is_niet_af(self):
        self.assertFalse(status._bepaal_afronding([])["af"])
```

- [ ] **Step 2: Draai de test en verifieer dat hij faalt**

Run: `python -m pytest tests/test_ixly_status.py -v`
Expected: FAIL — `ixly-status/__init__.py` bestaat niet

- [ ] **Step 3: Maak de gedeelde Ixly-module**

Create `grovia_shared/ixly_api.py`. Neem `haal_token`, de candidate-lookup en de
assignments-lookup over uit [`ixly-aanmelding/__init__.py`](../../../ixly-aanmelding/__init__.py)
(`_haal_token`, `_zoek_candidate_op_api_identifier`, `_haal_bestaande_assignments_op`) en
generaliseer ze. Voeg de taakstatus-lookup toe:

```python
"""
Gedeelde Ixly API-calls voor de Grovia Azure Functions.
"""
import logging
import os
import requests

IXLY_BASE_URL          = os.environ.get("IXLY_BASE_URL", "")
IXLY_CLIENT_ID         = os.environ.get("IXLY_CLIENT_ID", "")
IXLY_CLIENT_SECRET     = os.environ.get("IXLY_CLIENT_SECRET", "")
IXLY_ORGANIZATION_UUID = os.environ.get("IXLY_ORGANIZATION_UUID", "")

# Een assignment verwijst naar precies één van deze drie, afhankelijk van het taaktype.
TAAK_RELATIES = {
    "candidate_task":    "candidate_tasks",
    "candidate_program": "candidate_programs",
    "candidate_process": "candidate_processes",
}


def _headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def zoek_candidate(token: str, api_identifier: str) -> dict | None:
    """Zoek een candidate op api_identifier (= het order_id). None als niet gevonden."""
    response = requests.get(
        f"{IXLY_BASE_URL}/api/public/candidates/api_identifier/{api_identifier}",
        headers=_headers(token),
        timeout=15,
    )
    if response.status_code == 404:
        return None
    response.raise_for_status()
    return response.json().get("data")


def haal_assignments(token: str, candidate_uuid: str) -> list:
    """Alle assignments van een candidate. Lege lijst als er geen zijn."""
    response = requests.get(
        f"{IXLY_BASE_URL}/api/public/assignments",
        headers=_headers(token),
        params={"candidate_uuid": candidate_uuid},
        timeout=15,
    )
    if response.status_code == 404:
        return []
    response.raise_for_status()
    return response.json().get("data", [])


def haal_taak_status(token: str, soort: str, uuid: str) -> dict:
    """
    Haal state en completed_at van een candidate_task, _program of _process.

    Args:
        soort: sleutel uit TAAK_RELATIES
        uuid: het id uit de assignment-relatie

    Returns:
        {'state': str, 'completed_at': str} — leeg bij een onbekende taak.
    """
    pad = TAAK_RELATIES.get(soort)
    if not pad:
        return {"state": "", "completed_at": ""}

    response = requests.get(
        f"{IXLY_BASE_URL}/api/public/{pad}/{uuid}",
        headers=_headers(token),
        timeout=15,
    )
    if response.status_code == 404:
        return {"state": "", "completed_at": ""}
    response.raise_for_status()

    attributen = response.json().get("data", {}).get("attributes", {})
    # candidate_process gebruikt 'status' en 'finished_at'; de andere twee 'state'/'completed_at'.
    return {
        "state":        attributen.get("state") or attributen.get("status") or "",
        "completed_at": attributen.get("completed_at") or attributen.get("finished_at") or "",
    }
```

Neem `haal_token` letterlijk over uit `ixly-aanmelding` — die logica (client credentials +
managed organization) is al bewezen en mag niet afwijken.

- [ ] **Step 4: Schrijf de function**

Create `ixly-status/function.json`:

```json
{
  "scriptFile": "__init__.py",
  "bindings": [
    {
      "authLevel": "function",
      "type": "httpTrigger",
      "direction": "in",
      "name": "req",
      "methods": ["post"]
    },
    {
      "type": "http",
      "direction": "out",
      "name": "$return"
    }
  ]
}
```

Create `ixly-status/__init__.py`:

```python
"""
Azure Function: Ixly status opvragen.

Krijgt een lijst order-id's en geeft per order terug of de Ixly-taken afgerond zijn.
Aangeroepen door het Apps Script van het werkboek "Grovia Deelnemers".

Payload:
  {"order_ids": ["935", "941"]}

Respons:
  {"resultaten": {
     "935": {"gevonden": true, "af": true, "completed_at": "2026-07-20",
             "taken": [{"naam": "...", "state": "completed", "completed_at": "..."}]},
     "941": {"gevonden": false, "af": false, "completed_at": "", "taken": []}
  }}
"""
import json
import logging
import os
import sys

import azure.functions as func
import requests

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from grovia_shared import ixly_api

# Bovengrens per aanroep, zodat één verzoek de function niet laat aflopen.
MAX_ORDERS_PER_AANROEP = 100


def _bepaal_afronding(taken: list) -> dict:
    """
    Alles afgerond betekent afgerond. Geen taken betekent niet afgerond.

    Returns:
        {'af': bool, 'completed_at': 'YYYY-MM-DD' of ''}
    """
    if not taken:
        return {"af": False, "completed_at": ""}

    afgerond = [t for t in taken if t.get("state") == "completed"]
    if len(afgerond) != len(taken):
        return {"af": False, "completed_at": ""}

    datums = sorted(t.get("completed_at", "") for t in afgerond if t.get("completed_at"))
    laatste = datums[-1][:10] if datums else ""
    return {"af": True, "completed_at": laatste}


def _haal_taken_voor_order(token: str, order_id: str) -> dict:
    """Zoek de candidate, haal zijn assignments op en bepaal per taak de status."""
    candidate = ixly_api.zoek_candidate(token, order_id)
    if not candidate:
        return {"gevonden": False, "af": False, "completed_at": "", "taken": []}

    taken = []
    for assignment in ixly_api.haal_assignments(token, candidate["id"]):
        relaties = assignment.get("relationships", {})
        for soort in ixly_api.TAAK_RELATIES:
            verwijzing = relaties.get(soort, {}).get("data")
            if not verwijzing:
                continue
            status = ixly_api.haal_taak_status(token, soort, verwijzing["id"])
            taken.append({
                "naam":         soort,
                "state":        status["state"],
                "completed_at": status["completed_at"],
            })

    resultaat = _bepaal_afronding(taken)
    return {"gevonden": True, "taken": taken, **resultaat}


def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("Ixly Status gestart.")

    try:
        body = req.get_json()
    except ValueError:
        return func.HttpResponse("Ongeldige JSON in request body.", status_code=400)

    order_ids = body.get("order_ids")
    if not order_ids or not isinstance(order_ids, list):
        return func.HttpResponse(
            json.dumps({"fout": "order_ids ontbreekt of is geen lijst."}),
            mimetype="application/json",
            status_code=400,
        )

    if len(order_ids) > MAX_ORDERS_PER_AANROEP:
        return func.HttpResponse(
            json.dumps({"fout": f"Maximaal {MAX_ORDERS_PER_AANROEP} order-id's per aanroep."}),
            mimetype="application/json",
            status_code=400,
        )

    try:
        token = ixly_api.haal_token()
    except requests.HTTPError as e:
        logging.error(f"Ixly token fout: {e.response.status_code} — {e.response.text}")
        return func.HttpResponse(
            json.dumps({"fout": "Kon geen Ixly-token ophalen."}),
            mimetype="application/json",
            status_code=502,
        )

    resultaten = {}
    for order_id in order_ids:
        order_id = str(order_id)
        try:
            resultaten[order_id] = _haal_taken_voor_order(token, order_id)
        except requests.HTTPError as e:
            # Eén stukke order blokkeert de rest niet.
            logging.error(f"Order {order_id}: Ixly-fout {e.response.status_code}")
            resultaten[order_id] = {
                "gevonden": False, "af": False, "completed_at": "", "taken": [],
                "fout": f"Ixly-fout {e.response.status_code}",
            }

    logging.info(f"Status bepaald voor {len(resultaten)} orders.")
    return func.HttpResponse(
        json.dumps({"resultaten": resultaten}),
        mimetype="application/json",
        status_code=200,
    )
```

- [ ] **Step 5: Draai de tests**

Run: `python -m pytest tests/test_ixly_status.py -v`
Expected: 4 passed

- [ ] **Step 6: Schrijf de tests voor de handler**

Voeg toe aan `tests/test_ixly_status.py`:

```python
class TestHandler(unittest.TestCase):
    """De handler valideert en geeft per order een resultaat."""

    def _maak_request(self, body):
        import azure.functions as func
        return func.HttpRequest(
            method="POST",
            url="/api/ixly-status",
            body=json.dumps(body).encode(),
            headers={"Content-Type": "application/json"},
            params={},
        )

    def test_ontbrekende_order_ids_geeft_400(self):
        self.assertEqual(status.main(self._maak_request({})).status_code, 400)

    def test_order_ids_geen_lijst_geeft_400(self):
        self.assertEqual(status.main(self._maak_request({"order_ids": "935"})).status_code, 400)

    def test_te_veel_orders_geeft_400(self):
        veel = [str(n) for n in range(status.MAX_ORDERS_PER_AANROEP + 1)]
        self.assertEqual(status.main(self._maak_request({"order_ids": veel})).status_code, 400)

    def test_ongeldige_json_geeft_400(self):
        import azure.functions as func
        req = func.HttpRequest(
            method="POST", url="/api/ixly-status", body=b"geen json",
            headers={"Content-Type": "application/json"}, params={},
        )
        self.assertEqual(status.main(req).status_code, 400)

    @patch("grovia_test_ixly_status.ixly_api.haal_assignments")
    @patch("grovia_test_ixly_status.ixly_api.zoek_candidate")
    @patch("grovia_test_ixly_status.ixly_api.haal_token")
    def test_onbekende_candidate_geeft_niet_gevonden(self, mock_token, mock_zoek, mock_assign):
        mock_token.return_value = "token"
        mock_zoek.return_value = None

        response = status.main(self._maak_request({"order_ids": ["999"]}))
        data = json.loads(response.get_body())

        self.assertEqual(response.status_code, 200)
        self.assertFalse(data["resultaten"]["999"]["gevonden"])
        mock_assign.assert_not_called()

    @patch("grovia_test_ixly_status.ixly_api.haal_taak_status")
    @patch("grovia_test_ixly_status.ixly_api.haal_assignments")
    @patch("grovia_test_ixly_status.ixly_api.zoek_candidate")
    @patch("grovia_test_ixly_status.ixly_api.haal_token")
    def test_afgeronde_taken_geven_af(self, mock_token, mock_zoek, mock_assign, mock_status):
        mock_token.return_value = "token"
        mock_zoek.return_value = {"id": "cand-uuid"}
        mock_assign.return_value = [
            {"relationships": {"candidate_task": {"data": {"id": "taak-1"}}}},
        ]
        mock_status.return_value = {"state": "completed", "completed_at": "2026-07-20T10:00:00Z"}

        response = status.main(self._maak_request({"order_ids": ["935"]}))
        data = json.loads(response.get_body())

        self.assertTrue(data["resultaten"]["935"]["af"])
        self.assertEqual(data["resultaten"]["935"]["completed_at"], "2026-07-20")

    @patch("grovia_test_ixly_status.ixly_api.haal_token")
    def test_token_fout_geeft_502(self, mock_token):
        import requests as req_lib
        respons = MagicMock(status_code=401, text="unauthorized")
        mock_token.side_effect = req_lib.HTTPError(response=respons)

        self.assertEqual(status.main(self._maak_request({"order_ids": ["935"]})).status_code, 502)
```

- [ ] **Step 7: Draai de tests**

Run: `python -m pytest tests/test_ixly_status.py -v`
Expected: alles passeert

- [ ] **Step 8: Draai de volledige suite en commit**

Run: `python -m pytest tests/ -q`
Expected: alles passeert

```bash
git add grovia_shared/ixly_api.py ixly-status/ tests/test_ixly_status.py
git commit -m "feat: ixly-status endpoint voor afrondingsstatus per order"
```

---

### Task 5: Azure Function `grovia-herinnering`

**Files:**
- Create: `grovia-herinnering/__init__.py`
- Create: `grovia-herinnering/function.json`
- Create: `tests/test_grovia_herinnering.py`
- Modify: `grovia_shared/grovia_mail.py`

**Interfaces:**
- Consumes: `grovia_mail.bouw_prefill_url`, `grovia_mail.SCHOOL_DATA`, `grovia_mail.verstuur`,
  `ixly_api.zoek_candidate`, `ixly_api.haal_assignments`, `ixly_api.haal_token`
- Produces:
  - `grovia_mail.bouw_herinnering(voornaam, naam_kind, school_code, code, open_testen, assignments) -> tuple[str, str, str] | None`
  - HTTP-contract: `POST /api/grovia-herinnering` met
    `{"email": "...", "voornaam": "...", "naam_kind": "...", "school_code": "KA", "code": "935", "open_testen": ["action_type", "ixly"]}` → `200` met `{"verstuurd": true}`

- [ ] **Step 1: Schrijf de falende tests voor de reminderopmaak**

Create `tests/test_grovia_herinnering.py`:

```python
"""
Unit tests voor de grovia-herinnering Azure Function.
Gebruik: pytest tests/test_grovia_herinnering.py -v
"""
import json
import os
import sys
import unittest
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from grovia_shared import grovia_mail
from conftest import laad_function_module

herinnering = laad_function_module('grovia-herinnering')

ASSIGNMENTS = [
    {"naam": "Blocks Game", "login_url": "https://ixly.test/blocks"},
    {"naam": "Rally Game",  "login_url": "https://ixly.test/rally"},
]


class TestBouwHerinnering(unittest.TestCase):
    """De reminder noemt alleen wat nog open staat."""

    def test_alleen_action_type_noemt_geen_games(self):
        _, tekst, _ = grovia_mail.bouw_herinnering(
            "Max", "Freddie Rood", "KA", "935", ["action_type"], ASSIGNMENTS
        )
        self.assertIn("Action Type", tekst)
        self.assertNotIn("https://ixly.test/blocks", tekst)

    def test_alleen_ixly_noemt_geen_formulier(self):
        _, tekst, _ = grovia_mail.bouw_herinnering(
            "Max", "Freddie Rood", "KA", "935", ["ixly"], ASSIGNMENTS
        )
        self.assertIn("https://ixly.test/blocks", tekst)
        self.assertNotIn("Action Type", tekst)

    def test_beide_open_noemt_beide(self):
        _, tekst, _ = grovia_mail.bouw_herinnering(
            "Max", "Freddie Rood", "KA", "935", ["action_type", "ixly"], ASSIGNMENTS
        )
        self.assertIn("Action Type", tekst)
        self.assertIn("https://ixly.test/blocks", tekst)

    def test_niets_open_geeft_none(self):
        self.assertIsNone(grovia_mail.bouw_herinnering(
            "Max", "Freddie Rood", "KA", "935", [], ASSIGNMENTS
        ))

    def test_onbekende_school_geeft_none(self):
        self.assertIsNone(grovia_mail.bouw_herinnering(
            "Max", "Freddie Rood", "MM", "935", ["ixly"], ASSIGNMENTS
        ))

    def test_naam_kind_in_de_mail(self):
        _, tekst, _ = grovia_mail.bouw_herinnering(
            "Max", "Freddie Rood", "KA", "935", ["action_type"], ASSIGNMENTS
        )
        self.assertIn("Freddie", tekst)
```

- [ ] **Step 2: Draai de tests en verifieer dat ze falen**

Run: `python -m pytest tests/test_grovia_herinnering.py -v`
Expected: FAIL — `grovia-herinnering/__init__.py` bestaat niet

- [ ] **Step 3: Schrijf `bouw_herinnering`**

Voeg toe aan `grovia_shared/grovia_mail.py`:

```python
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
```

- [ ] **Step 4: Schrijf de function**

Create `grovia-herinnering/function.json`:

```json
{
  "scriptFile": "__init__.py",
  "bindings": [
    {
      "authLevel": "function",
      "type": "httpTrigger",
      "direction": "in",
      "name": "req",
      "methods": ["post"]
    },
    {
      "type": "http",
      "direction": "out",
      "name": "$return"
    }
  ]
}
```

Create `grovia-herinnering/__init__.py`:

```python
"""
Azure Function: remindermail versturen.

Aangeroepen door het Apps Script van het werkboek "Grovia Deelnemers", zowel door
de dagelijkse trigger als door de handmatige knop. Bepaalt zelf niets over wie een
reminder verdient -- dat doet het Apps Script.

De Ixly-login-urls worden hier opnieuw opgehaald, omdat ze nergens bewaard worden.

Payload:
  {"email": "...", "voornaam": "...", "naam_kind": "...", "school_code": "KA",
   "code": "935", "open_testen": ["action_type", "ixly"]}

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


def _haal_login_urls(code: str) -> list:
    """
    Haal de Ixly-login-urls opnieuw op. Lege lijst als het niet lukt of de candidate onbekend is.

    Een reminder over alleen de Action Type-test heeft deze links niet nodig, dus een
    mislukking hier mag de mail niet blokkeren.
    """
    try:
        token     = ixly_api.haal_token()
        candidate = ixly_api.zoek_candidate(token, code)
        if not candidate:
            logging.warning(f"Geen Ixly-candidate voor code {code}.")
            return []

        return [
            {"naam": a.get("attributes", {}).get("title", "de game"),
             "login_url": a.get("links", {}).get("login_url", "")}
            for a in ixly_api.haal_assignments(token, candidate["id"])
            if a.get("links", {}).get("login_url")
        ]
    except requests.HTTPError as e:
        logging.error(f"Kon login-urls niet ophalen voor {code}: {e.response.status_code}")
        return []


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
    assignments = _haal_login_urls(body["code"]) if "ixly" in open_testen else []

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
    try:
        grovia_mail.verstuur(body["email"], onderwerp, tekst, html)
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
```

- [ ] **Step 5: Draai de tests en verifieer dat de opmaaktests passeren**

Run: `python -m pytest tests/test_grovia_herinnering.py -v`
Expected: de zes `TestBouwHerinnering`-tests passeren

- [ ] **Step 6: Schrijf de handler-tests**

Voeg toe aan `tests/test_grovia_herinnering.py`:

```python
class TestHandler(unittest.TestCase):
    """De handler valideert, haalt links op en verstuurt."""

    def _maak_request(self, body):
        import azure.functions as func
        return func.HttpRequest(
            method="POST",
            url="/api/grovia-herinnering",
            body=json.dumps(body).encode(),
            headers={"Content-Type": "application/json"},
            params={},
        )

    def _goed_payload(self, **overrides):
        base = {
            "email":       "ouder@test.nl",
            "voornaam":    "Max",
            "naam_kind":   "Freddie Rood",
            "school_code": "KA",
            "code":        "935",
            "open_testen": ["action_type"],
        }
        base.update(overrides)
        return base

    def test_ontbrekend_email_geeft_400(self):
        body = self._goed_payload()
        del body["email"]
        self.assertEqual(herinnering.main(self._maak_request(body)).status_code, 400)

    def test_ontbrekende_open_testen_geeft_400(self):
        body = self._goed_payload(open_testen=[])
        self.assertEqual(herinnering.main(self._maak_request(body)).status_code, 400)

    def test_ongeldige_json_geeft_400(self):
        import azure.functions as func
        req = func.HttpRequest(
            method="POST", url="/api/grovia-herinnering", body=b"geen json",
            headers={"Content-Type": "application/json"}, params={},
        )
        self.assertEqual(herinnering.main(req).status_code, 400)

    @patch("grovia_test_grovia_herinnering.grovia_mail.verstuur")
    def test_action_type_reminder_haalt_geen_ixly_op(self, mock_verstuur):
        with patch.object(herinnering, "_haal_login_urls") as mock_links:
            response = herinnering.main(self._maak_request(self._goed_payload()))
            mock_links.assert_not_called()

        self.assertEqual(response.status_code, 200)
        self.assertTrue(json.loads(response.get_body())["verstuurd"])
        mock_verstuur.assert_called_once()

    @patch("grovia_test_grovia_herinnering.grovia_mail.verstuur")
    @patch("grovia_test_grovia_herinnering._haal_login_urls")
    def test_ixly_reminder_haalt_links_op(self, mock_links, mock_verstuur):
        mock_links.return_value = ASSIGNMENTS

        response = herinnering.main(self._maak_request(self._goed_payload(open_testen=["ixly"])))

        mock_links.assert_called_once_with("935")
        self.assertTrue(json.loads(response.get_body())["verstuurd"])

    @patch("grovia_test_grovia_herinnering.grovia_mail.verstuur")
    @patch("grovia_test_grovia_herinnering._haal_login_urls")
    def test_zonder_links_valt_ixly_weg(self, mock_links, mock_verstuur):
        mock_links.return_value = []

        response = herinnering.main(self._maak_request(self._goed_payload(open_testen=["ixly"])))
        data = json.loads(response.get_body())

        self.assertFalse(data["verstuurd"])
        mock_verstuur.assert_not_called()

    @patch("grovia_test_grovia_herinnering.grovia_mail.verstuur")
    def test_verzendfout_geeft_502(self, mock_verstuur):
        mock_verstuur.side_effect = OSError("smtp weg")
        response = herinnering.main(self._maak_request(self._goed_payload()))
        self.assertEqual(response.status_code, 502)
```

- [ ] **Step 7: Draai de tests**

Run: `python -m pytest tests/test_grovia_herinnering.py -v`
Expected: alles passeert

- [ ] **Step 8: Verifieer dat de functions lokaal starten**

Run: `func start`
Expected: `ixly-status` en `grovia-herinnering` staan bij de gevonden functions. Stop met Ctrl-C.

- [ ] **Step 9: Draai de volledige suite en commit**

Run: `python -m pytest tests/ -q`
Expected: alles passeert

```bash
git add grovia-herinnering/ grovia_shared/grovia_mail.py tests/test_grovia_herinnering.py
git commit -m "feat: grovia-herinnering endpoint voor remindermails"
```

---

### Task 6: Controlecode-veld in de Google Forms

Beide formulieren krijgen een `Controlecode`-veld, en het script leest de entry-id's uit die nodig
zijn om een vooringevulde link te bouwen.

**Files:**
- Modify: `google-apps-script/action-type-setup.gs`
- Modify: `docs/ACTION-TYPE-TEST.md`

**Interfaces:**
- Consumes: niets uit eerdere taken
- Produces: entry-id's die als omgevingsvariabelen in Azure gezet worden
  (`ACTION_TYPE_ENTRY_CODE_KA` etc., uit Task 3)

- [ ] **Step 1: Voeg het veld toe aan de formulier-opbouw**

In `google-apps-script/action-type-setup.gs`, in `maakFormEnSheet`, direct ná de regel die het
`Naam`-veld maakt (regel 176):

```javascript
  form.addTextItem().setTitle('Naam').setRequired(true);
```

voeg toe:

```javascript
  // Controlecode -- wordt via de URL vooringevuld door de uitnodigingsmail en koppelt
  // de uitslag aan het juiste kind. Google Forms kent geen verborgen velden, dus dit
  // veld is zichtbaar; de titel vraagt daarom expliciet om het te laten staan.
  form.addTextItem().setTitle('Controlecode (niet aanpassen)').setRequired(false);
```

**Niet verplicht maken.** Een verplicht veld dat leeg is blokkeert de inzending, en dan verliest
Grovia de uitslag helemaal. Een ontbrekende code kost alleen een handmatige koppeling.

- [ ] **Step 2: Schrijf de functie die de entry-id's uitleest**

De `entry.NNNN`-id's zijn niet gelijk aan de item-id's. De betrouwbare manier is een lege respons
maken en de prefilled URL uitlezen. Voeg onderaan `action-type-setup.gs` toe:

```javascript
/**
 * Leest de entry-id's van de velden 'Naam' en 'Controlecode' uit een formulier.
 *
 * De entry-id's die je in een prefill-URL nodig hebt zijn niet de item-id's; de enige
 * betrouwbare manier is een respons opbouwen en de prefilled URL laten genereren.
 *
 * Zet de uitkomst als omgevingsvariabelen in de Azure Function App:
 *   ACTION_TYPE_ENTRY_NAAM_KA / ACTION_TYPE_ENTRY_CODE_KA (en idem _SU)
 *
 * @param {string} formId Het bewerk-id van het formulier.
 * @return {Object} {naam: '<entry-id>', code: '<entry-id>'}
 */
function leesEntryIds(formId) {
  var form = FormApp.openById(formId);
  var ids  = {};

  form.getItems(FormApp.ItemType.TEXT).forEach(function (item) {
    var titel = item.getTitle();
    var sleutel = titel === 'Naam' ? 'naam'
                : titel.indexOf('Controlecode') === 0 ? 'code'
                : null;
    if (!sleutel) {
      return;
    }

    var respons = form.createResponse();
    respons.withItemResponse(item.asTextItem().createResponse('x'));

    var gevonden = respons.toPrefilledUrl().match(/entry\.(\d+)=x/);
    if (gevonden) {
      ids[sleutel] = gevonden[1];
    }
  });

  Logger.log('Entry-ids: ' + JSON.stringify(ids));
  return ids;
}

/**
 * Voegt het Controlecode-veld toe aan de twee bestaande formulieren en logt de entry-id's.
 * Draai deze eenmalig; hij slaat formulieren over die het veld al hebben.
 */
function herstelControlecode() {
  var FORM_IDS = {
    KA: '1228GYdB01e4jAAyzzu0Yb4NgXUnxK0Ph84dhHCSQjKo',
    SU: '1SoQJr6xLtN6cXo1yN7ztjUBiFrq_3jEwyIHtTsubk3U'
  };

  Object.keys(FORM_IDS).forEach(function (code) {
    var form = FormApp.openById(FORM_IDS[code]);

    var bestaat = form.getItems(FormApp.ItemType.TEXT).some(function (item) {
      return item.getTitle().indexOf('Controlecode') === 0;
    });

    if (!bestaat) {
      form.addTextItem().setTitle('Controlecode (niet aanpassen)').setRequired(false);
      Logger.log(code + ': Controlecode-veld toegevoegd.');
    } else {
      Logger.log(code + ': Controlecode-veld bestond al.');
    }

    Logger.log(code + ' entry-ids: ' + JSON.stringify(leesEntryIds(FORM_IDS[code])));
  });
}
```

De twee form-id's komen uit [`docs/ACTION-TYPE-TEST.md`](../../ACTION-TYPE-TEST.md); controleer ze
daar voor je draait.

- [ ] **Step 3: Draai `herstelControlecode` in de Apps Script-editor**

Open het script van de Drive-map, draai `herstelControlecode`, en noteer de vier entry-id's uit het
log. Verifieer daarna in beide formulieren met de voorbeeldweergave dat het veld onderaan staat.

- [ ] **Step 4: Verifieer een prefilled link met de hand**

Bouw met de gelogde id's een URL en open die:

```
https://docs.google.com/forms/d/e/<FORM_ID>/viewform?usp=pp_url&entry.<CODE_ID>=999&entry.<NAAM_ID>=Test+Kind
```

Expected: het formulier opent met `999` in Controlecode en `Test Kind` in Naam. Vul hem **niet** in.

- [ ] **Step 5: Zet de entry-id's in Azure**

Zet `ACTION_TYPE_ENTRY_CODE_KA`, `ACTION_TYPE_ENTRY_NAAM_KA`, `ACTION_TYPE_ENTRY_CODE_SU` en
`ACTION_TYPE_ENTRY_NAAM_SU` in de Application Settings van de Function App. Zonder deze waarden
valt `bouw_prefill_url` terug op de basis-URL — geen crash, maar ook geen koppeling.

- [ ] **Step 6: Documenteer het in ACTION-TYPE-TEST.md**

Voeg onder `## Scoring` een nieuwe sectie toe:

```markdown
## Controlecode

Beide formulieren hebben een veld **"Controlecode (niet aanpassen)"** dat via de URL
vooringevuld wordt met het `order_id`. Daarmee wordt de uitslag aan het juiste kind
gekoppeld zonder op de getypte naam te hoeven vertrouwen. Het veld is bewust **niet
verplicht**: een lege code kost een handmatige koppeling, een blokkerende inzending kost
de hele uitslag.

Kolomvolgorde reactie-tabblad is daarmee `A=Timestamp B=Naam C..V=Vraag 1..20
W=Begrijpelijkheid X=Controlecode`.

De `entry.NNNN`-id's die je in een prefill-URL nodig hebt, lees je uit met `leesEntryIds`
in [`google-apps-script/action-type-setup.gs`](../google-apps-script/action-type-setup.gs).
Ze staan als omgevingsvariabelen in de Azure Function App.
```

**Let op:** verifieer bij stap 3 waar het nieuwe veld in de kolomvolgorde landt en corrigeer
bovenstaande tekst als het niet kolom X is. De `ARRAYFORMULA` in het `Resultaten`-tabblad verwijst
naar vaste kolommen (`B2:B` voor Naam, `C..V` voor de vragen) en blijft ongewijzigd zolang het
nieuwe veld áchter de bestaande komt.

- [ ] **Step 7: Commit**

```bash
git add google-apps-script/action-type-setup.gs docs/ACTION-TYPE-TEST.md
git commit -m "feat: controlecode-veld in beide Action Type-formulieren"
```

---

### Task 7: Werkboek, Config en de WooCommerce-ingest

**Files:**
- Create: `google-apps-script/deelnemers/Config.gs`
- Create: `google-apps-script/deelnemers/Sheet.gs`
- Create: `google-apps-script/deelnemers/Woo.gs`
- Create: `google-apps-script/deelnemers/Deelnemers.gs`
- Create: `tests/gs/deelnemers.test.js`

**Interfaces:**
- Consumes: niets uit eerdere taken
- Produces:
  - `KOLOMMEN: string[]` in `Sheet.gs` — de kolomvolgorde uit het interface-contract
  - `leesConfig() -> Object` in `Config.gs` → `{startdatum, ixly_batch_per_run, max_mails_per_run, testmodus, testmodus_adres, reminder_dagen: number[], mapping: {scholen, fases, uitgesloten}}`
  - `leesDeelnemers() -> Object[]` en `schrijfDeelnemers(rijen)` in `Sheet.gs`
  - `haalOrders(sinds: string) -> Object[]` in `Woo.gs` → genormaliseerde orders
  - `upsertDeelnemers(bestaandeRijen, orders, mapping) -> {rijen, controleren}` in `Deelnemers.gs`

- [ ] **Step 1: Maak het werkboek met de hand aan**

Maak in de Grovia Drive-map (`https://drive.google.com/drive/folders/1rquUBAEV3z7emUm53mKIMfst3tvbIT8G`)
een werkboek **"Grovia Deelnemers"** met zeven tabbladen: `Deelnemers`, `Dashboard`, `Log`,
`Config`, `Handmatig koppelen`, `Controleren`.

Zet in `Deelnemers` rij 1 exact deze koppen, in deze volgorde:

```
seizoen | naam_slug | naam_kind | vereniging | ouder_naam | ouder_email | order_ids | code | uitgenodigd_op | action_type_af | action_type_op | action_type | ixly_af | ixly_op | reminders_verzonden | laatste_reminder_op | laatste_poging_op
```

Zet in `Log` rij 1: `tijdstip | soort | naam_kind | ouder_email | open_testen | resultaat | melding`

Zet in `Config` de instellingen in A/B en de mappings in D/E, G/H en J:

| Cel | Waarde |
|---|---|
| A1 | `instelling` |
| B1 | `waarde` |
| A2 | `startdatum` |
| B2 | de datum waarop automatische reminders mogen beginnen, bijv. `2026-08-01` |
| A3 | `ixly_batch_per_run` |
| B3 | `50` |
| A4 | `max_mails_per_run` |
| B4 | `25` |
| A5 | `testmodus` |
| B5 | `JA` |
| A6 | `testmodus_adres` |
| B6 | je eigen adres |
| A7 | `reminder_dagen` |
| B7 | `7,14,21,35,49` |
| D1:E1 | `categorie-slug` / `schoolcode` |
| D2:E4 | `schagen-united`/`SU`, `kolping-academie`/`KA`, `minimove`/`MM` |
| G1:H1 | `attribuut-waarde` / `fasecode` |
| G2:H6 | de vijf fases uit [`grovia-automations.php:85`](../../../plugins/grovia-automations/grovia-automations.php) |
| J1 | `uitgesloten-categorie` |
| J2:J3 | `evenement`, `proef-training` |

**`testmodus` staat op `JA`** tot de end-to-end doorloop in Task 13 klaar is.

- [ ] **Step 2: Zet de Script Properties**

Maak in WooCommerce een **read-only** REST API-sleutelpaar aan (WooCommerce → Instellingen →
Geavanceerd → REST API). Open in het werkboek Extensies → Apps Script, en zet onder
Projectinstellingen → Scripteigenschappen:

| Eigenschap | Waarde |
|---|---|
| `WOO_BASIS_URL` | `https://grovia.nl` |
| `WOO_CONSUMER_KEY` | de `ck_...`-sleutel |
| `WOO_CONSUMER_SECRET` | de `cs_...`-sleutel |
| `IXLY_STATUS_URL` | de volledige URL van `ixly-status`, inclusief `?code=` |
| `GROVIA_HERINNERING_URL` | de volledige URL van `grovia-herinnering`, inclusief `?code=` |

Nooit in een cel in de Sheet: die is deelbaar.

- [ ] **Step 3: Schrijf de falende test voor `upsertDeelnemers`**

Create `tests/gs/deelnemers.test.js`:

```javascript
/**
 * Tests voor de pure upsert-logica.
 * Gebruik: node --test tests/gs/
 */
const test = require('node:test');
const assert = require('node:assert');
const { upsertDeelnemers } = require('../../google-apps-script/deelnemers/Deelnemers.gs');

const MAPPING = {
  scholen: { 'kolping-academie': 'KA', 'schagen-united': 'SU', 'minimove': 'MM' },
  fases: { 'cyclus-1': 'C1', 'cyclus-2': 'C2' },
  uitgesloten: ['evenement', 'proef-training']
};

function order(overschrijf) {
  return Object.assign({
    order_id: '935',
    datum: '2026-08-01',
    naam_kind: 'Freddie Rood',
    ouder_naam: 'Max Rood',
    ouder_email: 'max@test.nl',
    categorieen: ['kolping-academie', 'voetbaltraining'],
    fase: 'cyclus-1'
  }, overschrijf);
}

test('nieuwe order geeft een nieuwe rij', () => {
  const { rijen } = upsertDeelnemers([], [order()], MAPPING);
  assert.strictEqual(rijen.length, 1);
  assert.strictEqual(rijen[0].naam_slug, 'freddie-rood');
  assert.strictEqual(rijen[0].vereniging, 'KA');
  assert.strictEqual(rijen[0].code, '935');
  assert.strictEqual(rijen[0].seizoen, '2526');
});

test('tweede order van hetzelfde kind komt bij order_ids, geen nieuwe rij', () => {
  const eerste = upsertDeelnemers([], [order()], MAPPING).rijen;
  const { rijen } = upsertDeelnemers(eerste, [order({ order_id: '941', datum: '2026-09-01' })], MAPPING);

  assert.strictEqual(rijen.length, 1);
  assert.deepStrictEqual(rijen[0].order_ids, ['935', '941']);
});

test('code blijft het laagste order_id', () => {
  const eerste = upsertDeelnemers([], [order({ order_id: '941' })], MAPPING).rijen;
  const { rijen } = upsertDeelnemers(eerste, [order({ order_id: '935' })], MAPPING);

  assert.strictEqual(rijen[0].code, '935');
});

test('uitgenodigd_op blijft de datum van de eerste order', () => {
  const eerste = upsertDeelnemers([], [order({ datum: '2026-08-01' })], MAPPING).rijen;
  const { rijen } = upsertDeelnemers(eerste, [order({ order_id: '941', datum: '2026-09-01' })], MAPPING);

  assert.strictEqual(rijen[0].uitgenodigd_op, '2026-08-01');
});

test('bestaande afrondingsstatus wordt niet overschreven', () => {
  const bestaand = upsertDeelnemers([], [order()], MAPPING).rijen;
  bestaand[0].action_type_af = true;
  bestaand[0].action_type = 'ISTJ';

  const { rijen } = upsertDeelnemers(bestaand, [order()], MAPPING);

  assert.strictEqual(rijen[0].action_type_af, true);
  assert.strictEqual(rijen[0].action_type, 'ISTJ');
});

test('minimove wordt overgeslagen', () => {
  const { rijen } = upsertDeelnemers([], [order({ categorieen: ['minimove', 'voetbaltraining'] })], MAPPING);
  assert.strictEqual(rijen.length, 0);
});

test('uitgesloten categorie wordt overgeslagen', () => {
  const { rijen } = upsertDeelnemers([], [order({ categorieen: ['kolping-academie', 'evenement'] })], MAPPING);
  assert.strictEqual(rijen.length, 0);
});

test('order zonder naam kind gaat naar controleren', () => {
  const { rijen, controleren } = upsertDeelnemers([], [order({ naam_kind: '' })], MAPPING);
  assert.strictEqual(rijen.length, 0);
  assert.strictEqual(controleren.length, 1);
  assert.strictEqual(controleren[0].order_id, '935');
});

test('order zonder bekende vereniging gaat naar controleren', () => {
  const { rijen, controleren } = upsertDeelnemers([], [order({ categorieen: ['iets-anders'] })], MAPPING);
  assert.strictEqual(rijen.length, 0);
  assert.strictEqual(controleren.length, 1);
});

test('seizoen kantelt in augustus', () => {
  const juli = upsertDeelnemers([], [order({ datum: '2026-07-31' })], MAPPING).rijen;
  const augustus = upsertDeelnemers([], [order({ datum: '2026-08-01' })], MAPPING).rijen;

  assert.strictEqual(juli[0].seizoen, '2526');
  assert.strictEqual(augustus[0].seizoen, '2627');
});

test('hetzelfde kind in een ander seizoen geeft een nieuwe rij', () => {
  const eerste = upsertDeelnemers([], [order({ datum: '2026-07-01' })], MAPPING).rijen;
  const { rijen } = upsertDeelnemers(eerste, [order({ order_id: '941', datum: '2026-09-01' })], MAPPING);

  assert.strictEqual(rijen.length, 2);
});
```

- [ ] **Step 4: Draai de test en verifieer dat hij faalt**

Run: `node --test tests/gs/`
Expected: FAIL — `Cannot find module '.../Deelnemers.gs'`

- [ ] **Step 5: Schrijf `Deelnemers.gs`**

Create `google-apps-script/deelnemers/Deelnemers.gs`:

```javascript
/**
 * Pure upsert-logica voor het Deelnemers-tabblad.
 *
 * Dit bestand raakt bewust geen SpreadsheetApp of UrlFetchApp aan, zodat de logica
 * met `node --test tests/gs/` te testen is. Alle Sheet-toegang zit in Sheet.gs.
 */

/**
 * Zet een naam om naar een slug voor gebruik als rij-identiteit.
 *
 * Hoeft NIET identiek te zijn aan grovia_naam_slug() in PHP: deze slug wordt nergens
 * met een PHP-waarde vergeleken en dient alleen om rijen binnen dit werkboek te
 * identificeren. Vereiste is enkel dat hij consistent is met zichzelf.
 *
 * @param {string} naam
 * @return {string}
 */
function naarSlug(naam) {
  return String(naam || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Bepaal de seizoencode uit een datum. Augustus is de start van een nieuw seizoen.
 *
 * @param {string} datum 'YYYY-MM-DD'
 * @return {string} bijv. '2526'
 */
function bepaalSeizoen(datum) {
  const jaar  = Number(String(datum).slice(0, 4));
  const maand = Number(String(datum).slice(5, 7));
  const start = maand >= 8 ? jaar : jaar - 1;
  return String(start).slice(2) + String(start + 1).slice(2);
}

/**
 * Voeg orders samen met de bestaande rijen.
 *
 * @param {Object[]} bestaandeRijen rijen zoals gelezen uit het Deelnemers-tabblad
 * @param {Object[]} orders genormaliseerde orders uit Woo.gs
 * @param {Object} mapping {scholen, fases, uitgesloten} uit het Config-tabblad
 * @return {{rijen: Object[], controleren: Object[]}}
 */
function upsertDeelnemers(bestaandeRijen, orders, mapping) {
  const rijen = bestaandeRijen.map(function (r) {
    return Object.assign({}, r, { order_ids: r.order_ids.slice() });
  });
  const controleren = [];

  const index = {};
  rijen.forEach(function (rij, i) {
    index[rij.seizoen + '|' + rij.naam_slug] = i;
  });

  orders.forEach(function (order) {
    const categorieen = order.categorieen || [];

    if (categorieen.some(function (c) { return mapping.uitgesloten.indexOf(c) !== -1; })) {
      return;
    }

    let vereniging = '';
    categorieen.forEach(function (c) {
      if (!vereniging && mapping.scholen[c]) {
        vereniging = mapping.scholen[c];
      }
    });

    // MiniMove doet niet mee aan de testen en komt dus niet in de administratie.
    if (vereniging === 'MM') {
      return;
    }

    const slug = naarSlug(order.naam_kind);

    if (!vereniging || !slug) {
      controleren.push({
        order_id: order.order_id,
        datum: order.datum,
        naam_kind: order.naam_kind || '',
        ouder_email: order.ouder_email || '',
        reden: !slug ? 'geen naam kind' : 'geen bekende vereniging'
      });
      return;
    }

    const seizoen = bepaalSeizoen(order.datum);
    const sleutel = seizoen + '|' + slug;

    if (index[sleutel] === undefined) {
      rijen.push({
        seizoen: seizoen,
        naam_slug: slug,
        naam_kind: order.naam_kind,
        vereniging: vereniging,
        ouder_naam: order.ouder_naam || '',
        ouder_email: order.ouder_email || '',
        order_ids: [String(order.order_id)],
        code: String(order.order_id),
        uitgenodigd_op: order.datum,
        action_type_af: false,
        action_type_op: '',
        action_type: '',
        ixly_af: false,
        ixly_op: '',
        reminders_verzonden: 0,
        laatste_reminder_op: '',
        laatste_poging_op: ''
      });
      index[sleutel] = rijen.length - 1;
      return;
    }

    const rij = rijen[index[sleutel]];
    const id  = String(order.order_id);

    if (rij.order_ids.indexOf(id) === -1) {
      rij.order_ids.push(id);
      rij.order_ids.sort(function (a, b) { return Number(a) - Number(b); });
    }

    // De uitnodiging ging op de eerste order uit; code en datum volgen die order.
    rij.code = rij.order_ids[0];
    if (order.datum < rij.uitgenodigd_op) {
      rij.uitgenodigd_op = order.datum;
    }
  });

  return { rijen: rijen, controleren: controleren };
}

// Alleen voor `node --test`; Apps Script kent `module` niet en slaat dit over.
if (typeof module !== 'undefined') {
  module.exports = { upsertDeelnemers: upsertDeelnemers, naarSlug: naarSlug, bepaalSeizoen: bepaalSeizoen };
}
```

- [ ] **Step 6: Draai de tests**

Run: `node --test tests/gs/`
Expected: alle 11 tests passeren

- [ ] **Step 7: Schrijf `Config.gs`**

Create `google-apps-script/deelnemers/Config.gs`:

```javascript
/**
 * Leest instellingen uit de Script Properties en het Config-tabblad.
 *
 * Secrets staan in de Script Properties, nooit in een cel: het werkboek is deelbaar.
 */

/**
 * @return {Object} de instellingen en de mappingtabellen
 */
function leesConfig() {
  const tab = SpreadsheetApp.getActive().getSheetByName('Config');
  if (!tab) {
    throw new Error('Tabblad "Config" niet gevonden.');
  }

  const instellingen = {};
  tab.getRange('A2:B20').getValues().forEach(function (rij) {
    if (rij[0]) {
      instellingen[String(rij[0]).trim()] = rij[1];
    }
  });

  return {
    startdatum:         _alsDatum(instellingen.startdatum),
    ixly_batch_per_run: Number(instellingen.ixly_batch_per_run) || 50,
    max_mails_per_run:  Number(instellingen.max_mails_per_run) || 25,
    testmodus:          String(instellingen.testmodus).toUpperCase() === 'JA',
    testmodus_adres:    String(instellingen.testmodus_adres || ''),
    reminder_dagen:     String(instellingen.reminder_dagen || '7,14,21,35,49')
                          .split(',')
                          .map(function (d) { return Number(String(d).trim()); })
                          .filter(function (d) { return d > 0; }),
    mapping: {
      scholen:     _leesPaar(tab, 'D2:E30'),
      fases:       _leesPaar(tab, 'G2:H30'),
      uitgesloten: _leesKolom(tab, 'J2:J30')
    }
  };
}

/**
 * @return {Object} Script Properties met de sleutels en endpoint-URLs
 */
function leesGeheimen() {
  const props = PropertiesService.getScriptProperties();
  return {
    woo_basis_url:      props.getProperty('WOO_BASIS_URL') || '',
    woo_key:            props.getProperty('WOO_CONSUMER_KEY') || '',
    woo_secret:         props.getProperty('WOO_CONSUMER_SECRET') || '',
    ixly_status_url:    props.getProperty('IXLY_STATUS_URL') || '',
    herinnering_url:    props.getProperty('GROVIA_HERINNERING_URL') || ''
  };
}

function _alsDatum(waarde) {
  if (waarde instanceof Date) {
    return Utilities.formatDate(waarde, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(waarde || '');
}

function _leesPaar(tab, bereik) {
  const resultaat = {};
  tab.getRange(bereik).getValues().forEach(function (rij) {
    if (rij[0] && rij[1]) {
      resultaat[String(rij[0]).trim()] = String(rij[1]).trim();
    }
  });
  return resultaat;
}

function _leesKolom(tab, bereik) {
  return tab.getRange(bereik).getValues()
    .map(function (rij) { return String(rij[0]).trim(); })
    .filter(function (waarde) { return waarde !== ''; });
}
```

- [ ] **Step 8: Schrijf `Sheet.gs`**

Create `google-apps-script/deelnemers/Sheet.gs`:

```javascript
/**
 * De enige plek die SpreadsheetApp aanraakt voor het lezen en schrijven van rijen.
 * De kolomvolgorde staat hier, en alleen hier.
 */

const KOLOMMEN = [
  'seizoen', 'naam_slug', 'naam_kind', 'vereniging', 'ouder_naam', 'ouder_email',
  'order_ids', 'code', 'uitgenodigd_op', 'action_type_af', 'action_type_op',
  'action_type', 'ixly_af', 'ixly_op', 'reminders_verzonden',
  'laatste_reminder_op', 'laatste_poging_op'
];

/**
 * @return {Object[]} alle deelnemersrijen als platte objecten
 */
function leesDeelnemers() {
  const tab = _tab('Deelnemers');
  const laatste = tab.getLastRow();
  if (laatste < 2) {
    return [];
  }

  return tab.getRange(2, 1, laatste - 1, KOLOMMEN.length).getValues().map(function (rij) {
    const object = {};
    KOLOMMEN.forEach(function (kolom, i) {
      object[kolom] = rij[i];
    });

    object.order_ids           = String(object.order_ids || '').split(',').filter(String);
    object.action_type_af      = object.action_type_af === true || String(object.action_type_af).toUpperCase() === 'JA';
    object.ixly_af             = object.ixly_af === true || String(object.ixly_af).toUpperCase() === 'JA';
    object.reminders_verzonden = Number(object.reminders_verzonden) || 0;

    ['uitgenodigd_op', 'action_type_op', 'ixly_op', 'laatste_reminder_op', 'laatste_poging_op']
      .forEach(function (kolom) {
        object[kolom] = _alsDatumTekst(object[kolom]);
      });

    return object;
  });
}

/**
 * Schrijft alle rijen in één keer weg. Overschrijft het hele databereik.
 *
 * @param {Object[]} rijen
 */
function schrijfDeelnemers(rijen) {
  const tab = _tab('Deelnemers');

  if (tab.getLastRow() > 1) {
    tab.getRange(2, 1, tab.getLastRow() - 1, KOLOMMEN.length).clearContent();
  }
  if (!rijen.length) {
    return;
  }

  const waarden = rijen.map(function (rij) {
    return KOLOMMEN.map(function (kolom) {
      const waarde = rij[kolom];
      if (kolom === 'order_ids') {
        return waarde.join(',');
      }
      if (kolom === 'action_type_af' || kolom === 'ixly_af') {
        return waarde ? 'JA' : 'NEE';
      }
      return waarde;
    });
  });

  tab.getRange(2, 1, waarden.length, KOLOMMEN.length).setValues(waarden);
}

/**
 * Voegt regels toe aan een lijst-tabblad zonder bestaande inhoud te wissen.
 *
 * @param {string} naam tabbladnaam
 * @param {Array[]} regels rijen als arrays
 */
function voegToe(naam, regels) {
  if (!regels.length) {
    return;
  }
  const tab = _tab(naam);
  tab.getRange(tab.getLastRow() + 1, 1, regels.length, regels[0].length).setValues(regels);
}

/**
 * Schrijft een regel in het Log-tabblad.
 *
 * @param {string} soort 'reminder-automatisch', 'reminder-handmatig', 'uitnodiging', 'fout'
 * @param {Object} rij de deelnemersrij, of {} bij een algemene fout
 * @param {string} resultaat 'ok' of 'mislukt'
 * @param {string} melding vrije tekst
 */
function logRegel(soort, rij, resultaat, melding) {
  voegToe('Log', [[
    new Date(),
    soort,
    rij.naam_kind || '',
    rij.ouder_email || '',
    (rij.open_testen || []).join(','),
    resultaat,
    melding || ''
  ]]);
}

function _tab(naam) {
  const tab = SpreadsheetApp.getActive().getSheetByName(naam);
  if (!tab) {
    throw new Error('Tabblad "' + naam + '" niet gevonden.');
  }
  return tab;
}

function _alsDatumTekst(waarde) {
  if (waarde instanceof Date) {
    return Utilities.formatDate(waarde, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(waarde || '');
}
```

- [ ] **Step 9: Schrijf `Woo.gs`**

Create `google-apps-script/deelnemers/Woo.gs`:

```javascript
/**
 * Haalt orders en producten op via de WooCommerce REST API v3.
 *
 * Pull in plaats van push: zo kan de administratie op elk moment opnieuw opgebouwd
 * worden en is er nooit een gemiste webhook.
 */

/**
 * Haalt alle orders op die sinds een datum zijn aangemaakt.
 *
 * @param {string} sinds 'YYYY-MM-DD'
 * @return {Object[]} genormaliseerde orders voor upsertDeelnemers
 */
function haalOrders(sinds) {
  const geheimen  = leesGeheimen();
  const producten = _haalProductCategorieen(geheimen);
  const orders    = [];

  let pagina = 1;
  while (true) {
    const parameters = [
      'per_page=100',
      'page=' + pagina,
      'after=' + encodeURIComponent(sinds + 'T00:00:00'),
      'status=processing,completed',
      'consumer_key=' + encodeURIComponent(geheimen.woo_key),
      'consumer_secret=' + encodeURIComponent(geheimen.woo_secret)
    ].join('&');

    const batch = _haalJson(geheimen.woo_basis_url + '/wp-json/wc/v3/orders?' + parameters);
    if (!batch.length) {
      break;
    }

    batch.forEach(function (order) {
      orders.push(_normaliseer(order, producten));
    });

    pagina += 1;
  }

  return orders;
}

function _haalProductCategorieen(geheimen) {
  const kaart = {};
  let pagina = 1;

  while (true) {
    const parameters = [
      'per_page=100',
      'page=' + pagina,
      'consumer_key=' + encodeURIComponent(geheimen.woo_key),
      'consumer_secret=' + encodeURIComponent(geheimen.woo_secret)
    ].join('&');

    const batch = _haalJson(geheimen.woo_basis_url + '/wp-json/wc/v3/products?' + parameters);
    if (!batch.length) {
      break;
    }

    batch.forEach(function (product) {
      kaart[String(product.id)] = (product.categories || []).map(function (c) { return c.slug; });
    });

    pagina += 1;
  }

  return kaart;
}

function _normaliseer(order, producten) {
  let categorieen = [];
  (order.line_items || []).forEach(function (item) {
    const eigen = producten[String(item.product_id)] || [];
    categorieen = categorieen.concat(eigen);
  });

  const naamKindVeld = (order.meta_data || []).filter(function (m) {
    return m.key === 'Naam kind';
  })[0];

  return {
    order_id:    String(order.id),
    datum:       String(order.date_created || '').slice(0, 10),
    naam_kind:   naamKindVeld ? String(naamKindVeld.value).trim() : '',
    ouder_naam:  [order.billing.first_name, order.billing.last_name].filter(String).join(' '),
    ouder_email: order.billing.email || '',
    categorieen: categorieen
  };
}

function _haalJson(url) {
  const respons = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  const code    = respons.getResponseCode();

  if (code !== 200) {
    throw new Error('WooCommerce gaf HTTP ' + code + ': ' + respons.getContentText().slice(0, 200));
  }

  return JSON.parse(respons.getContentText());
}
```

- [ ] **Step 10: Verifieer de ingest in de Apps Script-editor**

Plak `Config.gs`, `Sheet.gs`, `Woo.gs` en `Deelnemers.gs` in het Apps Script-project van het
werkboek. Voeg tijdelijk toe en draai:

```javascript
function testIngest() {
  const config = leesConfig();
  const orders = haalOrders('2026-06-01');
  Logger.log('Orders: ' + orders.length);
  Logger.log(JSON.stringify(orders[0], null, 2));

  const resultaat = upsertDeelnemers(leesDeelnemers(), orders, config.mapping);
  Logger.log('Rijen: ' + resultaat.rijen.length + ', controleren: ' + resultaat.controleren.length);
}
```

Expected: orders komen binnen, de eerste heeft een gevulde `naam_kind` en `categorieen`, en het
aantal rijen is plausibel. Verwijder `testIngest` daarna weer.

- [ ] **Step 11: Commit**

```bash
git add google-apps-script/deelnemers/ tests/gs/deelnemers.test.js
git commit -m "feat: werkboek-config, WooCommerce-ingest en deelnemers-upsert"
```

---

### Task 8: Action Type-afronding koppelen

**Files:**
- Create: `google-apps-script/deelnemers/ActionType.gs`
- Create: `tests/gs/actiontype.test.js`

**Interfaces:**
- Consumes: het rij-contract uit Task 7
- Produces: `koppelReacties(rijen, reacties) -> {rijen, ongekoppeld}` en
  `haalReacties(sheetIds) -> Object[]`

- [ ] **Step 1: Schrijf de falende test**

Create `tests/gs/actiontype.test.js`:

```javascript
/**
 * Tests voor het koppelen van formulierreacties aan deelnemers.
 * Gebruik: node --test tests/gs/
 */
const test = require('node:test');
const assert = require('node:assert');
const { koppelReacties } = require('../../google-apps-script/deelnemers/ActionType.gs');

function rij(overschrijf) {
  return Object.assign({
    seizoen: '2526', naam_slug: 'freddie-rood', naam_kind: 'Freddie Rood',
    vereniging: 'KA', code: '935', action_type_af: false, action_type_op: '', action_type: ''
  }, overschrijf);
}

function reactie(overschrijf) {
  return Object.assign({
    code: '935', naam: 'Freddie Rood', tijdstip: '2026-08-10', action_type: 'ISTJ'
  }, overschrijf);
}

test('reactie met code klapt de rij om', () => {
  const { rijen } = koppelReacties([rij()], [reactie()]);
  assert.strictEqual(rijen[0].action_type_af, true);
  assert.strictEqual(rijen[0].action_type, 'ISTJ');
  assert.strictEqual(rijen[0].action_type_op, '2026-08-10');
});

test('reactie zonder code komt bij ongekoppeld', () => {
  const { rijen, ongekoppeld } = koppelReacties([rij()], [reactie({ code: '' })]);
  assert.strictEqual(rijen[0].action_type_af, false);
  assert.strictEqual(ongekoppeld.length, 1);
  assert.strictEqual(ongekoppeld[0].naam, 'Freddie Rood');
});

test('code zonder bijbehorende rij komt bij ongekoppeld', () => {
  const { ongekoppeld } = koppelReacties([rij()], [reactie({ code: '999' })]);
  assert.strictEqual(ongekoppeld.length, 1);
  assert.strictEqual(ongekoppeld[0].reden, 'code niet gevonden');
});

test('al afgeronde rij wordt niet opnieuw geschreven', () => {
  const bestaand = rij({ action_type_af: true, action_type: 'ENFP', action_type_op: '2026-08-01' });
  const { rijen } = koppelReacties([bestaand], [reactie({ action_type: 'ISTJ' })]);
  assert.strictEqual(rijen[0].action_type, 'ENFP');
  assert.strictEqual(rijen[0].action_type_op, '2026-08-01');
});

test('lege action_type klapt de rij niet om', () => {
  const { rijen, ongekoppeld } = koppelReacties([rij()], [reactie({ action_type: '' })]);
  assert.strictEqual(rijen[0].action_type_af, false);
  assert.strictEqual(ongekoppeld[0].reden, 'geen action type berekend');
});

test('code met witruimte matcht alsnog', () => {
  const { rijen } = koppelReacties([rij()], [reactie({ code: ' 935 ' })]);
  assert.strictEqual(rijen[0].action_type_af, true);
});
```

- [ ] **Step 2: Draai de test en verifieer dat hij faalt**

Run: `node --test tests/gs/`
Expected: FAIL — `Cannot find module '.../ActionType.gs'`

- [ ] **Step 3: Schrijf `ActionType.gs`**

Create `google-apps-script/deelnemers/ActionType.gs`:

```javascript
/**
 * Koppelt de reacties uit de twee Action Type-resultatensheets aan deelnemers.
 *
 * De bestaande resultatensheets worden ALLEEN GELEZEN. Google Forms overschrijft
 * kolommen in en naast het reactie-tabblad bij elke inzending; schrijven daar zou
 * de scoring-formule slopen.
 */

/**
 * @param {Object[]} rijen deelnemersrijen
 * @param {Object[]} reacties {code, naam, tijdstip, action_type}
 * @return {{rijen: Object[], ongekoppeld: Object[]}}
 */
function koppelReacties(rijen, reacties) {
  const kopie = rijen.map(function (r) { return Object.assign({}, r); });
  const ongekoppeld = [];

  const opCode = {};
  kopie.forEach(function (rij, i) {
    opCode[String(rij.code).trim()] = i;
  });

  reacties.forEach(function (reactie) {
    const code = String(reactie.code || '').trim();

    if (!code) {
      ongekoppeld.push({
        naam: reactie.naam, tijdstip: reactie.tijdstip,
        action_type: reactie.action_type, reden: 'geen controlecode ingevuld'
      });
      return;
    }

    const index = opCode[code];
    if (index === undefined) {
      ongekoppeld.push({
        naam: reactie.naam, tijdstip: reactie.tijdstip,
        action_type: reactie.action_type, reden: 'code niet gevonden'
      });
      return;
    }

    if (!String(reactie.action_type || '').trim()) {
      ongekoppeld.push({
        naam: reactie.naam, tijdstip: reactie.tijdstip,
        action_type: '', reden: 'geen action type berekend'
      });
      return;
    }

    // Eerste inzending is de geldige; een tweede overschrijft niets.
    if (kopie[index].action_type_af) {
      return;
    }

    kopie[index].action_type_af = true;
    kopie[index].action_type    = String(reactie.action_type).trim();
    kopie[index].action_type_op = String(reactie.tijdstip).slice(0, 10);
  });

  return { rijen: kopie, ongekoppeld: ongekoppeld };
}

/**
 * Leest de reacties uit de resultatensheets van beide verenigingen.
 *
 * Het reactie-tabblad heeft de kolomvolgorde A=Timestamp B=Naam C..V=Vraag 1..20
 * W=Begrijpelijkheid X=Controlecode. Het Resultaten-tabblad heeft A=Naam B=Action Type.
 * De koppeling tussen die twee is de rijpositie: rij N in Resultaten hoort bij rij N
 * in het reactie-tabblad.
 *
 * @param {Object} sheetIds {KA: '<id>', SU: '<id>'}
 * @return {Object[]} {code, naam, tijdstip, action_type}
 */
function haalReacties(sheetIds) {
  const alles = [];

  Object.keys(sheetIds).forEach(function (vereniging) {
    const werkboek = SpreadsheetApp.openById(sheetIds[vereniging]);

    const reactieTab = werkboek.getSheets().filter(function (tab) {
      return tab.getName() !== 'Resultaten' && tab.getName() !== 'Action Types';
    })[0];
    const resultatenTab = werkboek.getSheetByName('Resultaten');

    if (!reactieTab || !resultatenTab || reactieTab.getLastRow() < 2) {
      return;
    }

    const aantal    = reactieTab.getLastRow() - 1;
    const reacties  = reactieTab.getRange(2, 1, aantal, 24).getValues();
    const resultaten = resultatenTab.getRange(2, 1, aantal, 2).getValues();

    reacties.forEach(function (rij, i) {
      alles.push({
        tijdstip:    _datumTekst(rij[0]),
        naam:        String(rij[1] || '').trim(),
        code:        String(rij[23] || '').trim(),
        action_type: String((resultaten[i] || [])[1] || '').trim(),
        vereniging:  vereniging
      });
    });
  });

  return alles;
}

function _datumTekst(waarde) {
  if (waarde instanceof Date) {
    return Utilities.formatDate(waarde, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(waarde || '').slice(0, 10);
}

if (typeof module !== 'undefined') {
  module.exports = { koppelReacties: koppelReacties };
}
```

- [ ] **Step 4: Draai de tests**

Run: `node --test tests/gs/`
Expected: alle tests uit beide bestanden passeren

- [ ] **Step 5: Verifieer de kolompositie van de controlecode in de echte sheets**

Plak `ActionType.gs` in het project. Voeg tijdelijk toe en draai:

```javascript
function testReacties() {
  const reacties = haalReacties({
    KA: '1HQmSEdj07CVlY1_mTcJoBjseRo4nqQs1TdIrx9ZFXkU',
    SU: '1e4-BfBpyCaDufVHYbZoRLXN9auRV52rQnqVeaKSgOuw'
  });
  Logger.log('Reacties: ' + reacties.length);
  Logger.log(JSON.stringify(reacties.slice(0, 3), null, 2));
}
```

Expected: de bestaande reacties komen terug met een gevulde `naam` en `action_type`, en een lege
`code` (die bestaan van vóór het nieuwe veld). **Controleer of kolom X (index 23) inderdaad de
controlecode is** — is het veld ergens anders geland, pas dan de index in `haalReacties` aan én de
kolomvolgorde in [`docs/ACTION-TYPE-TEST.md`](../../ACTION-TYPE-TEST.md). Verwijder `testReacties`
daarna.

- [ ] **Step 6: Commit**

```bash
git add google-apps-script/deelnemers/ActionType.gs tests/gs/actiontype.test.js
git commit -m "feat: Action Type-reacties koppelen aan deelnemers via controlecode"
```

---

### Task 9: Ixly-afronding bijwerken

**Files:**
- Create: `google-apps-script/deelnemers/IxlyStatus.gs`

**Interfaces:**
- Consumes: `leesGeheimen` uit Task 7, het HTTP-contract van `ixly-status` uit Task 4
- Produces: `werkIxlyBij(rijen, batchGrootte) -> {rijen, bijgewerkt: number, fouten: string[]}`

- [ ] **Step 1: Schrijf `IxlyStatus.gs`**

Create `google-apps-script/deelnemers/IxlyStatus.gs`:

```javascript
/**
 * Werkt de Ixly-afrondingsstatus bij via de ixly-status Azure Function.
 *
 * De Sheet praat niet zelf met Ixly: die credentials horen in Azure, niet in een
 * deelbaar werkboek.
 */

/**
 * @param {Object[]} rijen deelnemersrijen
 * @param {number} batchGrootte maximaal aantal codes per run
 * @return {{rijen: Object[], bijgewerkt: number, fouten: string[]}}
 */
function werkIxlyBij(rijen, batchGrootte) {
  const kopie  = rijen.map(function (r) { return Object.assign({}, r); });
  const fouten = [];

  const openIndexen = [];
  kopie.forEach(function (rij, i) {
    if (!rij.ixly_af && rij.code) {
      openIndexen.push(i);
    }
  });

  if (!openIndexen.length) {
    return { rijen: kopie, bijgewerkt: 0, fouten: fouten };
  }

  const teDoen = openIndexen.slice(0, batchGrootte);
  if (openIndexen.length > teDoen.length) {
    Logger.log('Ixly: ' + (openIndexen.length - teDoen.length) + ' rijen overgeslagen, gaan mee in de volgende run.');
  }

  const codes = teDoen.map(function (i) { return String(kopie[i].code); });
  const resultaten = _vraagStatusOp(codes);

  let bijgewerkt = 0;
  teDoen.forEach(function (i) {
    const resultaat = resultaten[String(kopie[i].code)];
    if (!resultaat) {
      return;
    }
    if (resultaat.fout) {
      fouten.push('Code ' + kopie[i].code + ': ' + resultaat.fout);
      return;
    }
    if (resultaat.af) {
      kopie[i].ixly_af = true;
      kopie[i].ixly_op = String(resultaat.completed_at || '').slice(0, 10);
      bijgewerkt += 1;
    }
  });

  return { rijen: kopie, bijgewerkt: bijgewerkt, fouten: fouten };
}

function _vraagStatusOp(codes) {
  const url = leesGeheimen().ixly_status_url;
  if (!url) {
    throw new Error('IXLY_STATUS_URL niet gezet in de Script Properties.');
  }

  const respons = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ order_ids: codes }),
    muteHttpExceptions: true
  });

  const code = respons.getResponseCode();
  if (code !== 200) {
    throw new Error('ixly-status gaf HTTP ' + code + ': ' + respons.getContentText().slice(0, 200));
  }

  return JSON.parse(respons.getContentText()).resultaten || {};
}
```

- [ ] **Step 2: Verifieer tegen de echte function**

Plak het bestand in het project. Draai `func start` lokaal niet — gebruik de gedeployde function.
Voeg tijdelijk toe en draai:

```javascript
function testIxlyStatus() {
  const rijen = leesDeelnemers();
  const resultaat = werkIxlyBij(rijen, 5);
  Logger.log('Bijgewerkt: ' + resultaat.bijgewerkt);
  Logger.log('Fouten: ' + JSON.stringify(resultaat.fouten));
}
```

Expected: geen exception, en `fouten` is leeg. Staat er `HTTP 401`, dan mist de functiesleutel in
`IXLY_STATUS_URL`. Verwijder `testIxlyStatus` daarna.

- [ ] **Step 3: Commit**

```bash
git add google-apps-script/deelnemers/IxlyStatus.gs
git commit -m "feat: Ixly-afronding bijwerken via ixly-status"
```

---

### Task 10: Reminders

**Files:**
- Create: `google-apps-script/deelnemers/Reminders.gs`
- Create: `tests/gs/reminders.test.js`

**Interfaces:**
- Consumes: het rij-contract uit Task 7, `leesGeheimen` uit Task 7, het HTTP-contract van
  `grovia-herinnering` uit Task 5
- Produces:
  - `bepaalReminders(rijen, vandaag, config) -> {teVersturen: Object[], afgekapt: number}`
    waarbij elk element `{index, open_testen, drempel}` is
  - `verstuurReminders(rijen, teVersturen, vandaag, config, soort) -> {rijen, verstuurd, mislukt}`
    waarbij `soort` een van `'reminder-automatisch'`, `'reminder-handmatig'` of
    `'uitnodiging-handmatig'` is; alleen `'reminder-automatisch'` verhoogt de teller

- [ ] **Step 1: Schrijf de falende test**

Create `tests/gs/reminders.test.js`:

```javascript
/**
 * Tests voor de reminder-beslislogica.
 * Gebruik: node --test tests/gs/
 */
const test = require('node:test');
const assert = require('node:assert');
const { bepaalReminders } = require('../../google-apps-script/deelnemers/Reminders.gs');

const CONFIG = {
  reminder_dagen: [7, 14, 21, 35, 49],
  startdatum: '2026-08-01',
  max_mails_per_run: 25
};

function rij(overschrijf) {
  return Object.assign({
    seizoen: '2526', naam_slug: 'freddie-rood', naam_kind: 'Freddie Rood',
    vereniging: 'KA', ouder_email: 'max@test.nl', code: '935',
    uitgenodigd_op: '2026-08-01',
    action_type_af: false, ixly_af: false,
    reminders_verzonden: 0, laatste_reminder_op: '', laatste_poging_op: ''
  }, overschrijf);
}

test('zes dagen open geeft nog geen reminder', () => {
  const { teVersturen } = bepaalReminders([rij()], '2026-08-07', CONFIG);
  assert.strictEqual(teVersturen.length, 0);
});

test('zeven dagen open geeft de eerste reminder', () => {
  const { teVersturen } = bepaalReminders([rij()], '2026-08-08', CONFIG);
  assert.strictEqual(teVersturen.length, 1);
  assert.strictEqual(teVersturen[0].drempel, 7);
});

test('beide testen open noemt beide', () => {
  const { teVersturen } = bepaalReminders([rij()], '2026-08-08', CONFIG);
  assert.deepStrictEqual(teVersturen[0].open_testen, ['action_type', 'ixly']);
});

test('alleen ixly open noemt alleen ixly', () => {
  const { teVersturen } = bepaalReminders([rij({ action_type_af: true })], '2026-08-08', CONFIG);
  assert.deepStrictEqual(teVersturen[0].open_testen, ['ixly']);
});

test('alles afgerond geeft geen reminder', () => {
  const klaar = rij({ action_type_af: true, ixly_af: true });
  const { teVersturen } = bepaalReminders([klaar], '2026-10-01', CONFIG);
  assert.strictEqual(teVersturen.length, 0);
});

test('vijf reminders verzonden is het maximum', () => {
  const vol = rij({ reminders_verzonden: 5, laatste_reminder_op: '2026-09-19' });
  const { teVersturen } = bepaalReminders([vol], '2026-12-01', CONFIG);
  assert.strictEqual(teVersturen.length, 0);
});

test('tweede reminder pas bij veertien dagen', () => {
  const na_een = rij({ reminders_verzonden: 1, laatste_reminder_op: '2026-08-08' });
  assert.strictEqual(bepaalReminders([na_een], '2026-08-14', CONFIG).teVersturen.length, 0);
  assert.strictEqual(bepaalReminders([na_een], '2026-08-15', CONFIG).teVersturen.length, 1);
});

test('geen tweede mail op dezelfde dag', () => {
  const vandaag = rij({ reminders_verzonden: 1, laatste_reminder_op: '2026-08-08' });
  const { teVersturen } = bepaalReminders([vandaag], '2026-08-08', CONFIG);
  assert.strictEqual(teVersturen.length, 0);
});

test('mislukte poging vandaag wordt niet opnieuw geprobeerd', () => {
  const gefaald = rij({ laatste_poging_op: '2026-08-08' });
  const { teVersturen } = bepaalReminders([gefaald], '2026-08-08', CONFIG);
  assert.strictEqual(teVersturen.length, 0);
});

test('mislukte poging gisteren wordt opnieuw geprobeerd', () => {
  const gefaald = rij({ laatste_poging_op: '2026-08-08' });
  const { teVersturen } = bepaalReminders([gefaald], '2026-08-09', CONFIG);
  assert.strictEqual(teVersturen.length, 1);
});

test('uitnodiging van voor de startdatum krijgt nooit automatisch', () => {
  const oud = rij({ uitgenodigd_op: '2026-07-01' });
  const { teVersturen } = bepaalReminders([oud], '2026-10-01', CONFIG);
  assert.strictEqual(teVersturen.length, 0);
});

test('bovengrens kapt af en meldt hoeveel', () => {
  const veel = [];
  for (let i = 0; i < 30; i += 1) {
    veel.push(rij({ naam_slug: 'kind-' + i, code: String(1000 + i) }));
  }
  const { teVersturen, afgekapt } = bepaalReminders(veel, '2026-08-08', CONFIG);
  assert.strictEqual(teVersturen.length, 25);
  assert.strictEqual(afgekapt, 5);
});

test('rij zonder e-mailadres wordt overgeslagen', () => {
  const { teVersturen } = bepaalReminders([rij({ ouder_email: '' })], '2026-08-08', CONFIG);
  assert.strictEqual(teVersturen.length, 0);
});

test('rij zonder uitnodigingsdatum wordt overgeslagen', () => {
  const { teVersturen } = bepaalReminders([rij({ uitgenodigd_op: '' })], '2026-08-08', CONFIG);
  assert.strictEqual(teVersturen.length, 0);
});
```

- [ ] **Step 2: Draai de test en verifieer dat hij faalt**

Run: `node --test tests/gs/`
Expected: FAIL — `Cannot find module '.../Reminders.gs'`

- [ ] **Step 3: Schrijf `Reminders.gs`**

Create `google-apps-script/deelnemers/Reminders.gs`:

```javascript
/**
 * Bepaalt wie een reminder krijgt en laat grovia-herinnering hem versturen.
 *
 * De drempels zijn dagen ná uitgenodigd_op: 7, 14, 21, 35, 49 — maximaal vijf per kind.
 * Mailen gebeurt niet hier maar in Azure, waar de SMTP en de huisstijl al staan.
 */

/**
 * @param {Object[]} rijen deelnemersrijen
 * @param {string} vandaag 'YYYY-MM-DD'
 * @param {Object} config uit leesConfig()
 * @return {{teVersturen: Object[], afgekapt: number}}
 */
function bepaalReminders(rijen, vandaag, config) {
  const drempels = config.reminder_dagen;
  const kandidaten = [];

  rijen.forEach(function (rij, index) {
    if (!rij.ouder_email || !rij.uitgenodigd_op) {
      return;
    }
    if (rij.action_type_af && rij.ixly_af) {
      return;
    }
    // Geen automatische reminders over de achterstand van vóór de startdatum.
    if (config.startdatum && rij.uitgenodigd_op < config.startdatum) {
      return;
    }
    if (rij.reminders_verzonden >= drempels.length) {
      return;
    }
    // Eén poging per dag, geslaagd of niet.
    if (rij.laatste_reminder_op === vandaag || rij.laatste_poging_op === vandaag) {
      return;
    }

    const drempel = drempels[rij.reminders_verzonden];
    if (_dagenTussen(rij.uitgenodigd_op, vandaag) < drempel) {
      return;
    }

    const open = [];
    if (!rij.action_type_af) {
      open.push('action_type');
    }
    if (!rij.ixly_af) {
      open.push('ixly');
    }

    kandidaten.push({ index: index, open_testen: open, drempel: drempel });
  });

  const grens = config.max_mails_per_run;
  return {
    teVersturen: kandidaten.slice(0, grens),
    afgekapt: Math.max(0, kandidaten.length - grens)
  };
}

/**
 * Verstuurt de reminders en werkt de tellers bij.
 *
 * De teller gaat alleen omhoog na een HTTP 200; bij een mislukking wordt alleen
 * laatste_poging_op gezet, zodat de volgende dagelijkse run het opnieuw probeert.
 *
 * @param {Object[]} rijen
 * @param {Object[]} teVersturen uit bepaalReminders
 * @param {string} vandaag 'YYYY-MM-DD'
 * @param {Object} config
 * @param {string} soort 'reminder-automatisch' of 'reminder-handmatig'
 * @return {{rijen: Object[], verstuurd: number, mislukt: number}}
 */
function verstuurReminders(rijen, teVersturen, vandaag, config, soort) {
  const kopie = rijen.map(function (r) { return Object.assign({}, r); });
  let verstuurd = 0;
  let mislukt   = 0;

  teVersturen.forEach(function (opdracht) {
    const rij = kopie[opdracht.index];
    const ontvanger = config.testmodus ? config.testmodus_adres : rij.ouder_email;

    try {
      _roepHerinneringAan({
        email:       ontvanger,
        voornaam:    (rij.ouder_naam || '').split(' ')[0] || 'daar',
        naam_kind:   rij.naam_kind,
        school_code: rij.vereniging,
        code:        String(rij.code),
        open_testen: opdracht.open_testen
      });

      // Handmatig verbruikt geen automatische poging, maar blokkeert wel vandaag.
      if (soort === 'reminder-automatisch') {
        rij.reminders_verzonden += 1;
      }
      rij.laatste_reminder_op = vandaag;
      rij.laatste_poging_op   = vandaag;
      verstuurd += 1;

      logRegel(soort, Object.assign({}, rij, { open_testen: opdracht.open_testen }), 'ok',
        'drempel ' + opdracht.drempel + (config.testmodus ? ' (TESTMODUS naar ' + ontvanger + ')' : ''));

    } catch (fout) {
      rij.laatste_poging_op = vandaag;
      mislukt += 1;
      logRegel(soort, Object.assign({}, rij, { open_testen: opdracht.open_testen }), 'mislukt',
        String(fout.message || fout));
    }
  });

  return { rijen: kopie, verstuurd: verstuurd, mislukt: mislukt };
}

function _roepHerinneringAan(payload) {
  const url = leesGeheimen().herinnering_url;
  if (!url) {
    throw new Error('GROVIA_HERINNERING_URL niet gezet in de Script Properties.');
  }

  const respons = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const code = respons.getResponseCode();
  if (code !== 200) {
    throw new Error('grovia-herinnering gaf HTTP ' + code + ': ' + respons.getContentText().slice(0, 200));
  }

  const body = JSON.parse(respons.getContentText());
  if (!body.verstuurd) {
    throw new Error('niet verstuurd: ' + (body.reden || body.fout || 'onbekend'));
  }
}

function _dagenTussen(van, tot) {
  const eenDag = 24 * 60 * 60 * 1000;
  return Math.floor((new Date(tot + 'T00:00:00') - new Date(van + 'T00:00:00')) / eenDag);
}

if (typeof module !== 'undefined') {
  module.exports = { bepaalReminders: bepaalReminders };
}
```

- [ ] **Step 4: Draai de tests**

Run: `node --test tests/gs/`
Expected: alle tests uit de drie bestanden passeren

- [ ] **Step 5: Commit**

```bash
git add google-apps-script/deelnemers/Reminders.gs tests/gs/reminders.test.js
git commit -m "feat: reminderlogica met drempels 7/14/21/35/49 en verzending via Azure"
```

---

### Task 11: Handmatig menu

**Files:**
- Create: `google-apps-script/deelnemers/Menu.gs`

**Interfaces:**
- Consumes: `leesConfig`, `leesDeelnemers`, `schrijfDeelnemers`, `verstuurReminders`
- Produces: `onOpen()` en de drie menuacties

- [ ] **Step 1: Schrijf `Menu.gs`**

Create `google-apps-script/deelnemers/Menu.gs`:

```javascript
/**
 * Het menu "Grovia" met de handmatige acties.
 *
 * Elke verzendactie vraagt eerst om bevestiging, met hoeveel mails naar wie gaan.
 */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Grovia')
    .addItem('Reminder sturen naar selectie', 'menuReminderSelectie')
    .addItem('Uitnodiging opnieuw sturen naar selectie', 'menuUitnodigingSelectie')
    .addSeparator()
    .addItem('Alles nu verversen', 'menuVerversAlles')
    .addToUi();
}

/**
 * Stuurt een reminder naar de geselecteerde rijen. Verbruikt geen automatische poging.
 */
function menuReminderSelectie() {
  _verstuurNaarSelectie('reminder-handmatig');
}

/**
 * Stuurt de openstaande testen opnieuw. Technisch identiek aan een reminder: dezelfde
 * mail met dezelfde links. Aparte menu-ingang omdat de klant het als iets anders ziet.
 */
function menuUitnodigingSelectie() {
  _verstuurNaarSelectie('uitnodiging-handmatig');
}

function menuVerversAlles() {
  const ui = SpreadsheetApp.getUi();
  try {
    const samenvatting = dagelijkseRun(false);
    ui.alert('Klaar', samenvatting, ui.ButtonSet.OK);
  } catch (fout) {
    ui.alert('Mislukt', String(fout.message || fout), ui.ButtonSet.OK);
  }
}

function _verstuurNaarSelectie(soort) {
  const ui = SpreadsheetApp.getUi();
  const config = leesConfig();
  const rijen = leesDeelnemers();

  const indexen = _geselecteerdeIndexen();
  if (!indexen.length) {
    ui.alert('Geen selectie', 'Selecteer eerst één of meer rijen in het tabblad Deelnemers.', ui.ButtonSet.OK);
    return;
  }

  const teVersturen = [];
  const overgeslagen = [];

  indexen.forEach(function (index) {
    const rij = rijen[index];
    if (!rij) {
      return;
    }
    if (!rij.ouder_email) {
      overgeslagen.push(rij.naam_kind + ' (geen e-mailadres)');
      return;
    }
    if (rij.action_type_af && rij.ixly_af) {
      overgeslagen.push(rij.naam_kind + ' (alles al afgerond)');
      return;
    }

    const open = [];
    if (!rij.action_type_af) {
      open.push('action_type');
    }
    if (!rij.ixly_af) {
      open.push('ixly');
    }
    teVersturen.push({ index: index, open_testen: open, drempel: 0 });
  });

  if (!teVersturen.length) {
    ui.alert('Niets te versturen', 'Overgeslagen:\n' + overgeslagen.join('\n'), ui.ButtonSet.OK);
    return;
  }

  const ontvangers = teVersturen.map(function (o) {
    return '· ' + rijen[o.index].naam_kind + ' → ' +
      (config.testmodus ? config.testmodus_adres : rijen[o.index].ouder_email);
  }).join('\n');

  const waarschuwing = config.testmodus
    ? '\n\nTESTMODUS staat AAN — alles gaat naar ' + config.testmodus_adres + '.'
    : '';

  const antwoord = ui.alert(
    'Versturen?',
    teVersturen.length + ' mail(s):\n\n' + ontvangers + waarschuwing +
      (overgeslagen.length ? '\n\nOvergeslagen:\n' + overgeslagen.join('\n') : ''),
    ui.ButtonSet.YES_NO
  );

  if (antwoord !== ui.Button.YES) {
    return;
  }

  const vandaag = _vandaag();
  const resultaat = verstuurReminders(rijen, teVersturen, vandaag, config, soort);
  schrijfDeelnemers(resultaat.rijen);

  ui.alert('Klaar',
    resultaat.verstuurd + ' verstuurd, ' + resultaat.mislukt + ' mislukt.\nZie het tabblad Log.',
    ui.ButtonSet.OK);
}

/**
 * @return {number[]} nul-gebaseerde indexen in de deelnemerslijst
 */
function _geselecteerdeIndexen() {
  const blad = SpreadsheetApp.getActiveSheet();
  if (blad.getName() !== 'Deelnemers') {
    return [];
  }

  const indexen = [];
  blad.getActiveRangeList().getRanges().forEach(function (bereik) {
    for (let rij = bereik.getRow(); rij < bereik.getRow() + bereik.getNumRows(); rij += 1) {
      if (rij >= 2 && indexen.indexOf(rij - 2) === -1) {
        indexen.push(rij - 2);
      }
    }
  });
  return indexen;
}

function _vandaag() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}
```

- [ ] **Step 2: Verifieer het menu**

Plak het bestand in het project, herlaad het werkboek, en controleer dat het menu "Grovia"
verschijnt. Selecteer een rij in `Deelnemers` en kies "Reminder sturen naar selectie".

Expected: het bevestigingsvenster toont het aantal mails, de ontvanger, en de melding dat
TESTMODUS aan staat. Bevestig, en controleer dat de mail op je testadres aankomt en dat er een
regel in `Log` staat met soort `reminder-handmatig`.

**"Alles nu verversen" werkt nog niet in deze taak.** Die actie roept `dagelijkseRun` aan, en die
functie komt in Task 12. Tot dan geeft de menu-ingang een foutmelding dat de functie niet bestaat;
dat is verwacht en wordt in Task 12 stap 3 alsnog getest. De twee verzendacties werken wél al, want
die leunen alleen op `verstuurReminders` uit Task 10.

- [ ] **Step 3: Commit**

```bash
git add google-apps-script/deelnemers/Menu.gs
git commit -m "feat: menu Grovia met handmatige reminder- en uitnodigingsacties"
```

---

### Task 12: Dagelijkse orkestratie en dashboard

**Files:**
- Create: `google-apps-script/deelnemers/Dagelijks.gs`
- Create: `google-apps-script/deelnemers/Dashboard.gs`

**Interfaces:**
- Consumes: alles uit Task 7 t/m 10
- Produces: `dagelijkseRun(magMailen: boolean) -> string` (samenvatting) en `bouwDashboard(rijen)`

- [ ] **Step 1: Schrijf `Dagelijks.gs`**

Create `google-apps-script/deelnemers/Dagelijks.gs`:

```javascript
/**
 * De dagelijkse run: vijf stappen in vaste volgorde.
 *
 * Kernregel: als de afrondingsdata van deze run niet betrouwbaar is, gaan er GEEN
 * reminders uit. Een gemiste dag kost niets — morgen loopt de run weer. Een reminder
 * naar een kind dat de test gisteren gemaakt heeft, kost het vertrouwen in het systeem.
 */

const RESULTATEN_SHEETS = {
  KA: '1HQmSEdj07CVlY1_mTcJoBjseRo4nqQs1TdIrx9ZFXkU',
  SU: '1e4-BfBpyCaDufVHYbZoRLXN9auRV52rQnqVeaKSgOuw'
};

/**
 * Installeer de dagelijkse trigger. Eenmalig draaien.
 */
function installeerTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === 'dagelijkseTrigger') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger('dagelijkseTrigger')
    .timeBased()
    .atHour(7)
    .everyDays(1)
    .create();

  Logger.log('Dagelijkse trigger gezet op 07:00.');
}

function dagelijkseTrigger() {
  Logger.log(dagelijkseRun(true));
}

/**
 * @param {boolean} magMailen false = alleen verversen, geen reminders
 * @return {string} samenvatting voor het log of een dialoogvenster
 */
function dagelijkseRun(magMailen) {
  const config  = leesConfig();
  const vandaag = _vandaagTekst();
  const melding = [];
  let dataBetrouwbaar = true;

  // Stap 1 -- deelnemers ophalen
  let rijen = leesDeelnemers();
  try {
    const sinds  = _sindsDatum(rijen);
    const orders = haalOrders(sinds);
    const ingest = upsertDeelnemers(rijen, orders, config.mapping);

    rijen = ingest.rijen;
    melding.push('Stap 1: ' + orders.length + ' orders, ' + rijen.length + ' deelnemers.');

    if (ingest.controleren.length) {
      voegToe('Controleren', ingest.controleren.map(function (c) {
        return [new Date(), c.order_id, c.datum, c.naam_kind, c.ouder_email, c.reden];
      }));
      melding.push('  ' + ingest.controleren.length + ' order(s) naar Controleren.');
    }
  } catch (fout) {
    dataBetrouwbaar = false;
    melding.push('Stap 1 MISLUKT: ' + fout.message);
    logRegel('fout', {}, 'mislukt', 'ingest: ' + fout.message);
  }

  // Stap 2 -- Action Type-afronding
  try {
    const koppeling = koppelReacties(rijen, haalReacties(RESULTATEN_SHEETS));
    rijen = koppeling.rijen;
    melding.push('Stap 2: Action Type bijgewerkt.');

    if (koppeling.ongekoppeld.length) {
      voegToe('Handmatig koppelen', koppeling.ongekoppeld.map(function (o) {
        return [new Date(), o.naam, o.tijdstip, o.action_type, o.reden];
      }));
      melding.push('  ' + koppeling.ongekoppeld.length + ' reactie(s) niet gekoppeld.');
    }
  } catch (fout) {
    dataBetrouwbaar = false;
    melding.push('Stap 2 MISLUKT: ' + fout.message);
    logRegel('fout', {}, 'mislukt', 'action type: ' + fout.message);
  }

  // Stap 3 -- Ixly-afronding
  try {
    const ixly = werkIxlyBij(rijen, config.ixly_batch_per_run);
    rijen = ixly.rijen;
    melding.push('Stap 3: ' + ixly.bijgewerkt + ' Ixly-afronding(en) bijgewerkt.');

    if (ixly.fouten.length) {
      dataBetrouwbaar = false;
      melding.push('  ' + ixly.fouten.length + ' fout(en): ' + ixly.fouten.slice(0, 3).join('; '));
      logRegel('fout', {}, 'mislukt', 'ixly: ' + ixly.fouten.join('; '));
    }
  } catch (fout) {
    dataBetrouwbaar = false;
    melding.push('Stap 3 MISLUKT: ' + fout.message);
    logRegel('fout', {}, 'mislukt', 'ixly: ' + fout.message);
  }

  // Stap 4 -- reminders, alleen bij betrouwbare data
  if (!magMailen) {
    melding.push('Stap 4: overgeslagen (alleen verversen).');
  } else if (!dataBetrouwbaar) {
    melding.push('Stap 4: OVERGESLAGEN — data niet betrouwbaar, geen reminders vandaag.');
    logRegel('fout', {}, 'mislukt', 'reminders overgeslagen wegens onbetrouwbare data');
  } else {
    const beslissing = bepaalReminders(rijen, vandaag, config);
    const resultaat  = verstuurReminders(rijen, beslissing.teVersturen, vandaag, config, 'reminder-automatisch');

    rijen = resultaat.rijen;
    melding.push('Stap 4: ' + resultaat.verstuurd + ' verstuurd, ' + resultaat.mislukt + ' mislukt.');

    if (beslissing.afgekapt > 0) {
      melding.push('  LET OP: ' + beslissing.afgekapt + ' reminder(s) afgekapt door max_mails_per_run.');
      logRegel('fout', {}, 'mislukt', beslissing.afgekapt + ' reminders afgekapt door de bovengrens');
    }
  }

  // Stap 5 -- wegschrijven en dashboard
  schrijfDeelnemers(rijen);
  bouwDashboard(rijen);
  melding.push('Stap 5: dashboard verversd.');

  return melding.join('\n');
}

/**
 * Vanaf welke datum orders ophalen. Een dag overlap tegen randgevallen rond middernacht.
 *
 * @param {Object[]} rijen
 * @return {string} 'YYYY-MM-DD'
 */
function _sindsDatum(rijen) {
  if (!rijen.length) {
    return '2026-06-01';
  }

  const datums = rijen
    .map(function (r) { return r.uitgenodigd_op; })
    .filter(String)
    .sort();

  const laatste = datums[datums.length - 1];
  const dag = new Date(laatste + 'T00:00:00');
  dag.setDate(dag.getDate() - 1);

  return Utilities.formatDate(dag, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function _vandaagTekst() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}
```

- [ ] **Step 2: Schrijf `Dashboard.gs`**

Create `google-apps-script/deelnemers/Dashboard.gs`:

```javascript
/**
 * Bouwt het Dashboard-tabblad op uit de deelnemersrijen.
 *
 * Bewust berekend in het script en niet met formules: de Deelnemers-tab moet een
 * platte tabel blijven die later één-op-één naar Azure SQL migreert.
 */

/**
 * @param {Object[]} rijen deelnemersrijen
 */
function bouwDashboard(rijen) {
  const tab = SpreadsheetApp.getActive().getSheetByName('Dashboard');
  if (!tab) {
    throw new Error('Tabblad "Dashboard" niet gevonden.');
  }

  tab.clear();

  const verenigingen = ['KA', 'SU'];
  const koppen = ['vereniging', 'uitgenodigd', 'action type af', 'ixly af', 'beide af',
                  'niets gedaan', 'gem. dagen action type', 'gem. dagen ixly', 'reminders verzonden'];
  const regels = [koppen];

  verenigingen.forEach(function (vereniging) {
    const eigen = rijen.filter(function (r) { return r.vereniging === vereniging; });

    regels.push([
      vereniging,
      eigen.length,
      eigen.filter(function (r) { return r.action_type_af; }).length,
      eigen.filter(function (r) { return r.ixly_af; }).length,
      eigen.filter(function (r) { return r.action_type_af && r.ixly_af; }).length,
      eigen.filter(function (r) { return !r.action_type_af && !r.ixly_af; }).length,
      _gemiddeldeDagen(eigen, 'action_type_op'),
      _gemiddeldeDagen(eigen, 'ixly_op'),
      eigen.reduce(function (som, r) { return som + r.reminders_verzonden; }, 0)
    ]);
  });

  tab.getRange(1, 1, regels.length, koppen.length).setValues(regels);
  tab.getRange(1, 1, 1, koppen.length).setFontWeight('bold');

  // Openstaande gevallen, langst wachtend bovenaan.
  const vandaag = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const open = rijen
    .filter(function (r) { return !(r.action_type_af && r.ixly_af) && r.uitgenodigd_op; })
    .map(function (r) {
      const ontbreekt = [];
      if (!r.action_type_af) {
        ontbreekt.push('Action Type');
      }
      if (!r.ixly_af) {
        ontbreekt.push('Ixly');
      }
      return [
        r.naam_kind, r.vereniging, r.ouder_email, r.uitgenodigd_op,
        _dagen(r.uitgenodigd_op, vandaag), ontbreekt.join(' + '),
        r.reminders_verzonden, r.laatste_reminder_op
      ];
    })
    .sort(function (a, b) { return b[4] - a[4]; });

  const startRij = regels.length + 2;
  const openKoppen = ['naam kind', 'vereniging', 'ouder e-mail', 'uitgenodigd op',
                      'dagen open', 'ontbreekt', 'reminders', 'laatste reminder'];

  tab.getRange(startRij, 1, 1, openKoppen.length).setValues([openKoppen]).setFontWeight('bold');
  if (open.length) {
    tab.getRange(startRij + 1, 1, open.length, openKoppen.length).setValues(open);
  }

  tab.getRange(startRij - 1, 1).setValue('Openstaand (' + open.length + ')').setFontWeight('bold');
}

/**
 * Gemiddeld aantal dagen tussen uitnodiging en afronding, alleen over wie afgerond heeft.
 *
 * Per test apart: een uur gamen en tien minuten formulier invullen bij elkaar optellen
 * zegt niets.
 */
function _gemiddeldeDagen(rijen, kolom) {
  const dagen = rijen
    .filter(function (r) { return r[kolom] && r.uitgenodigd_op; })
    .map(function (r) { return _dagen(r.uitgenodigd_op, r[kolom]); })
    .filter(function (d) { return d >= 0; });

  if (!dagen.length) {
    return '';
  }

  const som = dagen.reduce(function (a, b) { return a + b; }, 0);
  return Math.round((som / dagen.length) * 10) / 10;
}

function _dagen(van, tot) {
  const eenDag = 24 * 60 * 60 * 1000;
  return Math.floor((new Date(tot + 'T00:00:00') - new Date(van + 'T00:00:00')) / eenDag);
}
```

- [ ] **Step 3: Draai een volledige run zonder mailen**

Plak beide bestanden in het project en draai in de editor:

```javascript
dagelijkseRun(false)
```

Expected: het log toont vijf stappen zonder MISLUKT, het `Deelnemers`-tabblad is gevuld, en
`Dashboard` toont de aantallen per vereniging plus de openstaande lijst. Controleer een paar rijen
met de hand tegen WooCommerce.

- [ ] **Step 4: Draai een volledige run mét mailen, in testmodus**

Controleer dat `Config!B5` op `JA` staat en dat `B6` je eigen adres bevat. Draai:

```javascript
dagelijkseRun(true)
```

Expected: eventuele reminders komen op je eigen adres aan, `Log` bevat regels met soort
`reminder-automatisch` en de melding `(TESTMODUS naar ...)`, en de tellers in `Deelnemers` zijn
opgehoogd.

- [ ] **Step 5: Installeer de trigger**

Draai `installeerTrigger()` en controleer onder Triggers dat `dagelijkseTrigger` dagelijks om
07:00 staat.

- [ ] **Step 6: Commit**

```bash
git add google-apps-script/deelnemers/Dagelijks.gs google-apps-script/deelnemers/Dashboard.gs
git commit -m "feat: dagelijkse orkestratie en dashboard"
```

---

### Task 13: End-to-end doorloop, livegang en documentatie

**Files:**
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/DECISIONS.md`
- Modify: `docs/TODO.md`
- Modify: `docs/ACTION-TYPE-TEST.md`

**Interfaces:**
- Consumes: alles
- Produces: niets in code

- [ ] **Step 1: Doorloop de hele keten met één testkind**

1. Plaats een order op grovia.nl voor een Kolping-product met een 100%-kortingscode, met een naam
   kind die nergens anders voorkomt (bijv. "Testkind Zeven").
2. Controleer dat de uitnodigingsmail aankomt en dat de Action Type-knop naar een formulier leidt
   met een **gevulde** Controlecode en Naam.
3. Vul het formulier in.
4. Draai `dagelijkseRun(false)` en controleer dat de rij `action_type_af = JA` krijgt met de juiste
   lettercombinatie.
5. Zet `uitgenodigd_op` van die rij met de hand op 8 dagen terug, en `laatste_poging_op` leeg.
6. Draai `dagelijkseRun(true)` en controleer dat er een reminder komt die **alleen** over de
   Ixly-games gaat, met werkende links.
7. Verwijder de testorder en de kortingscode, en de rij uit `Deelnemers`.

Expected: elke stap gedraagt zich zoals hierboven. Loopt iets anders, los dat op voor stap 2.

- [ ] **Step 2: Zet TESTMODUS uit en de startdatum goed**

Zet `Config!B5` op `NEE`. Zet `Config!B2` op de datum van vandaag, zodat de achterstand van vóór
livegang geen automatische reminders krijgt — die kinderen zijn alleen handmatig te bereiken.

Draai `dagelijkseRun(false)` en controleer in het `Dashboard` hoeveel kinderen daarmee buiten de
automatische flow vallen. Is dat een groep die je wél wilt bereiken, doe dat dan met de handmatige
knop, in porties van maximaal `max_mails_per_run`.

- [ ] **Step 3: Werk ARCHITECTURE.md bij**

Voeg een nieuw onderdeel toe na `### 4. Fysio-toestemming (WordPress plugin)`:

```markdown
### 5. Deelnemersadministratie en reminders (Google Sheet + Apps Script)

Het werkboek **"Grovia Deelnemers"** in de Grovia Drive-map is de administratie en het
dashboard voor de testdeelname. Eén rij per kind per seizoen, gesleuteld op
`seizoen` + `naam_slug`.

Een dagelijkse Apps Script-trigger (07:00) doet vijf stappen: deelnemers ophalen uit
WooCommerce via de WCAPI, Action Type-afronding koppelen uit de twee resultatensheets,
Ixly-afronding ophalen via `ixly-status`, reminders versturen via `grovia-herinnering`,
en het dashboard verversen. Faalt een van de eerste drie stappen, dan gaan er die dag
geen reminders uit.

De klant bedient het via het menu **"Grovia"** in de Sheet: reminder of uitnodiging naar
de geselecteerde rijen, of alles nu verversen.

**Reminderdrempels:** 7, 14, 21, 35 en 49 dagen na de uitnodiging, maximaal vijf per kind.
Een handmatige reminder verbruikt geen automatische poging.

**De controlecode is het `order_id`.** Die staat vooringevuld in de Action Type-formulierlink
en is bij Ixly de `api_identifier` — dezelfde sleutel voor beide testen.

**Secrets:** WCAPI-sleutels en de Azure-functiesleutels staan in de Script Properties van
het Apps Script-project, nooit in een cel (het werkboek is deelbaar).
```

Voeg aan de tabel met Azure Functions onder `### 2. Assessment aanmeldingen` de twee nieuwe
endpoints toe: `ixly-status` (order-id's in, afrondingsstatus uit) en `grovia-herinnering`
(remindermail via de bestaande SMTP). Vermeld dat de mailopmaak in `grovia_shared/grovia_mail.py`
staat en door zowel de uitnodiging als de reminder gebruikt wordt.

- [ ] **Step 4: Schrijf ADR-008**

Voeg toe aan `docs/DECISIONS.md`, direct onder `## Formaat` en boven ADR-007:

```markdown
## ADR-008: Google Sheet als deelnemersadministratie, mailen blijft in Azure
**Datum:** 2026-07-30
**Status:** Geaccepteerd

**Context:**
Grovia wil inzicht in wie de testen wel en niet heeft gemaakt, met automatische en
handmatige reminders. Geen portal en geen terminal. Een dashboard op Azure SQL met PowerBI
staat op de roadmap, maar de licenties zijn niet geregeld en dat traject is veel groter.

Twee dingen bleken bij de verkenning anders dan gedacht. De uitnodigingsmail wordt niet door
FunnelKit verstuurd maar door de Azure Function `ixly-aanmelding` via SMTP, met de gamelinks
én de Action Type-link in één bericht. En FunnelKit kán geen link per kind maken: merge-tags
bestaan alleen voor contactvelden, en één ouder kan meerdere kinderen hebben.

**Beslissing:**
- Een Google Sheet is de database, het dashboard en het bedieningspaneel. De `Deelnemers`-tab
  is een platte tabel die later één-op-één naar Azure SQL migreert.
- Apps Script bepaalt wie wat nodig heeft en haalt de deelnemers zelf op uit WooCommerce
  (pull, geen push — zo is de administratie altijd opnieuw op te bouwen).
- Mailen blijft in Azure. De Sheet beslist, `grovia-herinnering` verstuurt. Redenen: de
  huisstijl staat op één plek, de afzender blijft gelijk, er is geen Gmail-verzendlimiet, en
  de Ixly-`login_url`'s worden nergens bewaard — de Function kan ze opnieuw ophalen, een
  Sheet zou daarvoor Ixly-credentials nodig hebben.
- De controlecode is het `order_id`, vooringevuld in de formulierlink. Geen hash en geen slug,
  dus geen risico dat PHP, Python en Apps Script een naam net anders normaliseren.

**Gevolgen:**
- De mappingtabellen (schoolcodes, fases, uitgesloten categorieën) staan zowel in PHP als in
  het `Config`-tabblad. Bij een nieuwe school moet het op twee plekken. Overweeg bij een derde
  vereniging een read-only endpoint in WordPress als enige bron.
- De twee bestanden in `email-templates/` zijn definitief dood; de Python-mail heeft ze vervangen.
- Reminders gaan niet uit als de afrondingsdata van die run onbetrouwbaar is. Een gemiste dag
  kost niets, een onterechte reminder kost het vertrouwen van de klant.
- Een `startdatum` in `Config` voorkomt dat de achterstand bij livegang alle drempels tegelijk
  passeert.

---
```

- [ ] **Step 5: Werk TODO.md bij**

Verplaats naar `## Done`:

```markdown
- [x] Deelnemersadministratie + remindersysteem opgezet — Google Sheet "Grovia Deelnemers" met dagelijkse Apps Script-run, controlecode in beide formulieren, `ixly-status` en `grovia-herinnering` Azure Functions, reminders op 7/14/21/35/49 dagen, handmatig menu (2026-07-30, Max)
```

Pas Next Up #1 aan: "Action Type test-mail conditioneel versturen" is met de MM-uitsluiting en de
`startdatum`-logica afgedekt. Vervang het item door wat er nog wél open staat, of haal het weg als
er niets rest.

Voeg toe aan `## Next Up`:

```markdown
- **`email-templates/` opruimen** `(lokaal)` — de twee FunnelKit-templates zijn vervangen door de gecombineerde mail in `grovia_shared/grovia_mail.py` en zijn nooit in gebruik geweest
- **Mappingtabellen op één plek** `(lokaal)` — schoolcodes/fases/uitgesloten categorieën staan nu in PHP én in het `Config`-tabblad; overweeg een read-only WP-endpoint zodra er een derde vereniging bijkomt
```

- [ ] **Step 6: Draai alle tests en commit**

Run: `python -m pytest tests/ -q && node --test tests/gs/`
Expected: beide suites groen

```bash
git add docs/
git commit -m "docs: deelnemersadministratie gedocumenteerd + ADR-008"
```

---

## Self-review

**Spec-dekking.** Elke sectie uit de spec heeft een taak: componenten → Task 2 t/m 12; controlecode
→ Task 3 en 6; datamodel → Task 7; dataflow stap 1 t/m 5 → Task 7, 8, 9, 10, 12; handmatige acties
→ Task 11; foutafhandeling → Task 10 (teller na 200, poging-per-dag, startdatum, bovengrens) en
Task 12 (geen reminders bij onbetrouwbare data, per-rij isolatie); testen → Task 1 (basis), plus
tests in elke taak; te verifiëren vóór implementatie → punt 1 is beantwoord (`GROVIA_DEBUG_EMAIL`
staat leeg), punt 2 in Task 7 stap 2, punt 3 in Task 7 (MM wordt overgeslagen, met test).

**Twee dingen die de spec niet voorzag en die als taak zijn toegevoegd.** Task 1 bestond niet in de
spec: de testsuite is nu rood door een verouderd testbestand en door module-botsing tussen
`__init__.py`'s, en zonder groene basis is TDD op de nieuwe functions niet betrouwbaar te doen. En
Task 6 stap 2 bleek nodig omdat `entry.NNNN`-id's niet gelijk zijn aan item-id's; die moeten via
`toPrefilledUrl()` uitgelezen worden.

**Onzekerheid die bij uitvoering geverifieerd moet worden.** In welke kolom het nieuwe
`Controlecode`-veld in het reactie-tabblad landt, is niet met zekerheid vast te stellen zonder het
formulier aan te passen. Task 6 stap 3 en Task 8 stap 5 controleren het expliciet, en beide taken
zeggen wat te doen als het niet kolom X is. De koppeling tussen het reactie-tabblad en het
`Resultaten`-tabblad gebeurt op rijpositie; klopt die aanname niet in de praktijk, dan is
`haalReacties` de plek om het te repareren.

**Namen en types.** `upsertDeelnemers`, `koppelReacties`, `bepaalReminders`, `verstuurReminders`,
`werkIxlyBij`, `haalOrders`, `haalReacties`, `leesConfig`, `leesGeheimen`, `leesDeelnemers`,
`schrijfDeelnemers`, `voegToe`, `logRegel`, `bouwDashboard`, `dagelijkseRun` — elk één keer
gedefinieerd en overal met dezelfde signatuur gebruikt. Het rij-object gebruikt in alle taken de
zeventien sleutels uit het interface-contract. De Python-kant: `bouw_prefill_url`,
`bouw_uitnodiging`, `bouw_herinnering`, `verstuur`, `zoek_candidate`, `haal_assignments`,
`haal_taak_status`, `haal_token`, `_bepaal_afronding` — consistent tussen taken en tests.
