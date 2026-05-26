# WhatsApp Groepsuitnodiging — Implementatieplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stuur automatisch een WhatsApp-bericht met groepsuitnodigingslink naar klanten na een WooCommerce-order, getriggerd via FunnelKit Automations.

**Architecture:** FunnelKit stuurt na een order een webhook naar een nieuwe Azure Function `whatsapp-uitnodiging`. De function normaliseert het telefoonnummer naar E.164, valideert de payload en stuurt een goedgekeurd WhatsApp-template via de Meta Cloud API. De groepsuitnodigingslink staat als statische omgevingsvariabele geconfigureerd (handmatig gegenereerd in de WhatsApp Business App).

**Tech Stack:** Python 3.12, Azure Functions v4, Meta Cloud API (Graph API v21.0), FunnelKit Automations (WordPress)

---

## Pre-requisites (handmatig, eenmalig — VOOR code uitvoeren)

### Stap A: Meta Business account en nummer koppelen via Embedded Signup

Het bestaande zakelijke WhatsApp-nummer kan **naast** de WhatsApp Business App ook op de Cloud API worden aangesloten — geen tweede nummer nodig, de app blijft gewoon werken.

- [ ] Ga naar [business.facebook.com](https://business.facebook.com) en log in / maak een account aan op naam van Grovia
- [ ] Ga naar [developers.facebook.com](https://developers.facebook.com) → Maak een app aan (type: Business) → voeg "WhatsApp" product toe
- [ ] Koppel het bestaande Grovia-nummer via **Embedded Signup**:
  - WhatsApp → Getting Started → "Connect your WhatsApp Business app number"
  - Volg de stappen — het nummer blijft actief in de WhatsApp Business App
  - Verificatie via SMS of belletje
- [ ] Noteer de **Phone Number ID** (staat bij het gekoppelde nummer in de Developer Console)
- [ ] Genereer een permanent **Access Token**: Meta Business Manager → Instellingen → Systeemgebruikers → Admin gebruiker → Token genereren → selecteer scope `whatsapp_business_messaging`

### Stap B: WhatsApp-template aanmaken en laten goedkeuren

- [ ] Ga in Meta Business Manager naar WhatsApp Manager → Message Templates → Create Template
- [ ] Configuratie:
  - **Naam:** `grovia_trainingsgroep`
  - **Categorie:** Utility
  - **Taal:** Nederlands (nl)
  - **Body tekst:**
    ```
    Hoi {{1}}! Welkom bij Grovia. Klik op de link hieronder om deel te nemen aan de trainingsgroep:

    {{2}}

    Tot snel op het veld! Team Grovia
    ```
  - `{{1}}` = voornaam klant, `{{2}}` = WhatsApp-groepslink
- [ ] Dien in ter goedkeuring — utility templates worden doorgaans binnen enkele uren goedgekeurd
- [ ] Wacht op status "Approved" via WhatsApp Manager → Message Templates

### Stap C: WhatsApp-groepslink genereren

- [ ] Open de WhatsApp Business App op de Grovia telefoon
- [ ] Ga naar de trainingsgroep → Groepsinstellingen → Uitnodigingslink → Kopieer link
- [ ] Formaat: `https://chat.whatsapp.com/xxxxxxxxxxxxxxxx`
- [ ] Sla deze link op — je hebt hem nodig als GitHub Secret

### Stap D: GitHub Secrets toevoegen

- [ ] Ga naar de GitHub repo → Settings → Secrets and variables → Actions → New repository secret
- [ ] Voeg toe:
  - `WHATSAPP_PHONE_NUMBER_ID` — Phone Number ID uit Stap A
  - `WHATSAPP_ACCESS_TOKEN` — access token uit Stap A
  - `WHATSAPP_TEMPLATE_NAAM` — `grovia_trainingsgroep`
  - `WHATSAPP_GROEP_UITNODIGING_URL` — de groepslink uit Stap C

---

## Bestandsoverzicht

| Bestand | Actie | Verantwoordelijkheid |
|---|---|---|
| `whatsapp-uitnodiging/function.json` | Aanmaken | HTTP trigger binding |
| `whatsapp-uitnodiging/__init__.py` | Aanmaken | Volledige Azure Function handler |
| `tests/test_whatsapp_uitnodiging.py` | Aanmaken | Unit tests (telefoon, API, validatie) |
| `local.settings.json.example` | Aanpassen | WhatsApp env vars toevoegen |
| `.github/workflows/deploy.yml` | Aanpassen | WhatsApp secrets toevoegen aan Azure |

---

## Task 1: Function scaffolding

**Files:**
- Aanmaken: `whatsapp-uitnodiging/function.json`
- Aanmaken: `whatsapp-uitnodiging/__init__.py` (skeleton)

- [ ] **Stap 1: Maak `whatsapp-uitnodiging/function.json` aan**

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

- [ ] **Stap 2: Maak `whatsapp-uitnodiging/__init__.py` aan (skeleton)**

```python
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
```

- [ ] **Stap 3: Commit**

```bash
git add whatsapp-uitnodiging/function.json whatsapp-uitnodiging/__init__.py
git commit -m "feat: whatsapp-uitnodiging functie scaffolding"
```

---

## Task 2: Telefoonnummer normalisatie (TDD)

**Files:**
- Aanpassen: `whatsapp-uitnodiging/__init__.py`
- Aanmaken: `tests/test_whatsapp_uitnodiging.py`

- [ ] **Stap 1: Maak `tests/test_whatsapp_uitnodiging.py` aan met failing tests**

```python
"""
Unit tests voor whatsapp-uitnodiging Azure Function.
Gebruik: pytest tests/test_whatsapp_uitnodiging.py -v
"""
import sys
import os
import json
import unittest
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'whatsapp-uitnodiging'))
import __init__ as wa


class TestNormaliseerTelefoon(unittest.TestCase):
    """Telefoonnummers worden omgezet naar E.164 (zonder +)."""

    def test_mobiel_met_nul(self):
        self.assertEqual(wa._normaliseer_telefoon("0612345678"), "31612345678")

    def test_mobiel_met_landcode_plus(self):
        self.assertEqual(wa._normaliseer_telefoon("+31612345678"), "31612345678")

    def test_mobiel_met_landcode_00(self):
        self.assertEqual(wa._normaliseer_telefoon("0031612345678"), "31612345678")

    def test_al_in_e164(self):
        self.assertEqual(wa._normaliseer_telefoon("31612345678"), "31612345678")

    def test_spaties_worden_gestript(self):
        self.assertEqual(wa._normaliseer_telefoon("06 12 34 56 78"), "31612345678")

    def test_koppeltekens_worden_gestript(self):
        self.assertEqual(wa._normaliseer_telefoon("06-12-34-56-78"), "31612345678")
```

- [ ] **Stap 2: Voer tests uit — controleer dat ze falen**

```bash
cd /Users/maxrood/werk/greit/klanten/grovia && source venv/bin/activate && pytest tests/test_whatsapp_uitnodiging.py::TestNormaliseerTelefoon -v
```

Verwacht: `AttributeError: module '__init__' has no attribute '_normaliseer_telefoon'`

- [ ] **Stap 3: Implementeer `_normaliseer_telefoon` in `__init__.py`** (toevoegen na de constanten)

```python
def _normaliseer_telefoon(telefoon: str) -> str:
    telefoon = re.sub(r'[\s\-\(\)]', '', telefoon)
    if telefoon.startswith('+'):
        return telefoon[1:]
    if telefoon.startswith('00'):
        return telefoon[2:]
    if telefoon.startswith('0') and len(telefoon) == 10:
        return '31' + telefoon[1:]
    return telefoon
```

- [ ] **Stap 4: Voer tests uit — controleer dat ze slagen**

```bash
pytest tests/test_whatsapp_uitnodiging.py::TestNormaliseerTelefoon -v
```

Verwacht: `6 passed`

- [ ] **Stap 5: Commit**

```bash
git add whatsapp-uitnodiging/__init__.py tests/test_whatsapp_uitnodiging.py
git commit -m "feat: telefoonnummer normalisatie naar E.164"
```

---

## Task 3: Meta Cloud API aanroep (TDD)

**Files:**
- Aanpassen: `whatsapp-uitnodiging/__init__.py`
- Aanpassen: `tests/test_whatsapp_uitnodiging.py`

- [ ] **Stap 1: Voeg failing tests toe aan `tests/test_whatsapp_uitnodiging.py`** (toevoegen ná `TestNormaliseerTelefoon`)

```python
class TestStuurWhatsappTemplate(unittest.TestCase):
    """Meta Cloud API wordt correct aangeroepen."""

    @patch("__init__.requests.post")
    def test_stuurt_naar_juiste_url(self, mock_post):
        mock_post.return_value = MagicMock(**{
            "json.return_value": {"messages": [{"id": "wamid.test123"}]}
        })
        with patch("__init__.WHATSAPP_PHONE_NUMBER_ID", "12345"):
            wa._stuur_whatsapp_template("31612345678", "Jan")

        url = mock_post.call_args.args[0]
        self.assertIn("12345", url)
        self.assertIn("graph.facebook.com", url)

    @patch("__init__.requests.post")
    def test_stuurt_voornaam_als_eerste_parameter(self, mock_post):
        mock_post.return_value = MagicMock(**{
            "json.return_value": {"messages": [{"id": "wamid.test123"}]}
        })

        wa._stuur_whatsapp_template("31612345678", "Jan")

        body = mock_post.call_args.kwargs["json"]
        params = body["template"]["components"][0]["parameters"]
        self.assertEqual(params[0]["text"], "Jan")

    @patch("__init__.requests.post")
    def test_stuurt_groepslink_als_tweede_parameter(self, mock_post):
        mock_post.return_value = MagicMock(**{
            "json.return_value": {"messages": [{"id": "wamid.test123"}]}
        })
        with patch("__init__.WHATSAPP_GROEP_UITNODIGING_URL", "https://chat.whatsapp.com/test"):
            wa._stuur_whatsapp_template("31612345678", "Jan")

        body = mock_post.call_args.kwargs["json"]
        params = body["template"]["components"][0]["parameters"]
        self.assertEqual(params[1]["text"], "https://chat.whatsapp.com/test")

    @patch("__init__.requests.post")
    def test_messaging_product_is_whatsapp(self, mock_post):
        mock_post.return_value = MagicMock(**{
            "json.return_value": {"messages": [{"id": "wamid.test123"}]}
        })

        wa._stuur_whatsapp_template("31612345678", "Jan")

        body = mock_post.call_args.kwargs["json"]
        self.assertEqual(body["messaging_product"], "whatsapp")

    @patch("__init__.requests.post")
    def test_geeft_json_response_terug(self, mock_post):
        mock_post.return_value = MagicMock(**{
            "json.return_value": {"messages": [{"id": "wamid.test123"}]}
        })

        result = wa._stuur_whatsapp_template("31612345678", "Jan")

        self.assertIn("messages", result)
        self.assertEqual(result["messages"][0]["id"], "wamid.test123")
```

- [ ] **Stap 2: Voer tests uit — controleer dat ze falen**

```bash
pytest tests/test_whatsapp_uitnodiging.py::TestStuurWhatsappTemplate -v
```

Verwacht: `AttributeError: module '__init__' has no attribute '_stuur_whatsapp_template'`

- [ ] **Stap 3: Implementeer `_stuur_whatsapp_template` in `__init__.py`** (toevoegen na `_normaliseer_telefoon`)

```python
def _stuur_whatsapp_template(telefoon_e164: str, voornaam: str) -> dict:
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
            "language": {"code": "nl"},
            "components": [
                {
                    "type": "body",
                    "parameters": [
                        {"type": "text", "text": voornaam},
                        {"type": "text", "text": WHATSAPP_GROEP_UITNODIGING_URL},
                    ],
                }
            ],
        },
    }
    response = requests.post(url, headers=headers, json=body, timeout=15)
    response.raise_for_status()
    return response.json()
```

- [ ] **Stap 4: Voer tests uit — controleer dat ze slagen**

```bash
pytest tests/test_whatsapp_uitnodiging.py::TestStuurWhatsappTemplate -v
```

Verwacht: `5 passed`

- [ ] **Stap 5: Commit**

```bash
git add whatsapp-uitnodiging/__init__.py tests/test_whatsapp_uitnodiging.py
git commit -m "feat: Meta Cloud API template aanroep"
```

---

## Task 4: Validatie en main handler (TDD)

**Files:**
- Aanpassen: `whatsapp-uitnodiging/__init__.py`
- Aanpassen: `tests/test_whatsapp_uitnodiging.py`

- [ ] **Stap 1: Voeg failing tests toe aan `tests/test_whatsapp_uitnodiging.py`** (toevoegen ná `TestStuurWhatsappTemplate`)

```python
class TestValidatieEnHandler(unittest.TestCase):
    """Main valideert verplichte velden en handelt fouten af."""

    def _maak_request(self, body: dict):
        import azure.functions as func
        return func.HttpRequest(
            method="POST",
            url="/api/whatsapp-uitnodiging",
            body=json.dumps(body).encode(),
            headers={"Content-Type": "application/json"},
            params={},
        )

    def _goed_payload(self, **overrides):
        base = {
            "voornaam":   "Jan",
            "achternaam": "Jansen",
            "telefoon":   "0612345678",
            "order_id":   "42",
        }
        base.update(overrides)
        return base

    def test_ontbrekend_voornaam_geeft_400(self):
        body = self._goed_payload()
        del body["voornaam"]
        self.assertEqual(wa.main(self._maak_request(body)).status_code, 400)

    def test_ontbrekend_telefoon_geeft_400(self):
        body = self._goed_payload()
        del body["telefoon"]
        self.assertEqual(wa.main(self._maak_request(body)).status_code, 400)

    def test_ontbrekend_order_id_geeft_400(self):
        body = self._goed_payload()
        del body["order_id"]
        self.assertEqual(wa.main(self._maak_request(body)).status_code, 400)

    def test_ongeldige_json_geeft_400(self):
        import azure.functions as func
        req = func.HttpRequest(
            method="POST",
            url="/api/whatsapp-uitnodiging",
            body=b"geen json",
            headers={"Content-Type": "application/json"},
            params={},
        )
        self.assertEqual(wa.main(req).status_code, 400)

    @patch("__init__._stuur_whatsapp_template")
    def test_succesvol_verzoek_geeft_200(self, mock_stuur):
        mock_stuur.return_value = {"messages": [{"id": "wamid.test123"}]}
        response = wa.main(self._maak_request(self._goed_payload()))
        self.assertEqual(response.status_code, 200)

    @patch("__init__._stuur_whatsapp_template")
    def test_response_bevat_bericht_id(self, mock_stuur):
        mock_stuur.return_value = {"messages": [{"id": "wamid.test123"}]}
        response = wa.main(self._maak_request(self._goed_payload()))
        data = json.loads(response.get_body())
        self.assertEqual(data["bericht_id"], "wamid.test123")

    @patch("__init__._stuur_whatsapp_template")
    def test_telefoon_wordt_genormaliseerd_voor_api_aanroep(self, mock_stuur):
        mock_stuur.return_value = {"messages": [{"id": "wamid.test123"}]}
        wa.main(self._maak_request(self._goed_payload(telefoon="0612345678")))
        self.assertEqual(mock_stuur.call_args.args[0], "31612345678")

    @patch("__init__._stuur_whatsapp_template")
    def test_meta_api_fout_geeft_502(self, mock_stuur):
        import requests as req_lib
        mock_response = MagicMock()
        mock_response.status_code = 400
        mock_response.text = "Bad Request"
        mock_stuur.side_effect = req_lib.HTTPError(response=mock_response)
        response = wa.main(self._maak_request(self._goed_payload()))
        self.assertEqual(response.status_code, 502)
```

- [ ] **Stap 2: Voer tests uit — controleer dat ze falen**

```bash
pytest tests/test_whatsapp_uitnodiging.py::TestValidatieEnHandler -v
```

Verwacht: `AttributeError: module '__init__' has no attribute 'main'`

- [ ] **Stap 3: Implementeer `main` in `__init__.py`** (toevoegen aan het einde)

```python
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
```

- [ ] **Stap 4: Voer alle tests uit**

```bash
pytest tests/test_whatsapp_uitnodiging.py -v
```

Verwacht: alle tests slagen

- [ ] **Stap 5: Commit**

```bash
git add whatsapp-uitnodiging/__init__.py tests/test_whatsapp_uitnodiging.py
git commit -m "feat: validatie en main handler whatsapp-uitnodiging"
```

---

## Task 5: Configuratiebestanden bijwerken

**Files:**
- Aanpassen: `local.settings.json.example`
- Aanpassen: `.github/workflows/deploy.yml`

- [ ] **Stap 1: Voeg WhatsApp vars toe aan `local.settings.json.example`**

Voeg toe in het `Values` object, na `"GROVIA_DEBUG_EMAIL": ""`:

```json
    "WHATSAPP_PHONE_NUMBER_ID": "",
    "WHATSAPP_ACCESS_TOKEN": "",
    "WHATSAPP_TEMPLATE_NAAM": "grovia_trainingsgroep",
    "WHATSAPP_GROEP_UITNODIGING_URL": ""
```

- [ ] **Stap 2: Voeg WhatsApp secrets toe aan `deploy.yml`**

In het `az functionapp config appsettings set` blok: vervang de laatste regel:
```yaml
                GROVIA_DEBUG_EMAIL="${{ secrets.GROVIA_DEBUG_EMAIL }}"
```
Door:
```yaml
                GROVIA_DEBUG_EMAIL="${{ secrets.GROVIA_DEBUG_EMAIL }}" \
                WHATSAPP_PHONE_NUMBER_ID="${{ secrets.WHATSAPP_PHONE_NUMBER_ID }}" \
                WHATSAPP_ACCESS_TOKEN="${{ secrets.WHATSAPP_ACCESS_TOKEN }}" \
                WHATSAPP_TEMPLATE_NAAM="${{ secrets.WHATSAPP_TEMPLATE_NAAM }}" \
                WHATSAPP_GROEP_UITNODIGING_URL="${{ secrets.WHATSAPP_GROEP_UITNODIGING_URL }}"
```

- [ ] **Stap 3: Commit en push naar main (triggert deploy)**

```bash
git add local.settings.json.example .github/workflows/deploy.yml
git commit -m "config: WhatsApp omgevingsvariabelen en GitHub Secrets"
git push origin main
```

- [ ] **Stap 4: Controleer de deploy in GitHub Actions**
  - Ga naar de GitHub repo → Actions → latest workflow run
  - Controleer dat alle stappen groen zijn

---

## Task 6: Handmatige FunnelKit-configuratie (na succesvolle deploy)

Dit zijn stappen in de WordPress/FunnelKit beheeromgeving — geen code.

- [ ] **Stap 1: FunnelKit Automation aanmaken**
  - Ga naar WordPress → FunnelKit Automations → Create Automation
  - **Naam:** `WhatsApp Trainingsgroep Uitnodiging`
  - **Trigger:** WooCommerce → Order Status Changed → Status: "Processing"

- [ ] **Stap 2: Send Data actie toevoegen**
  - Voeg actie toe: "Send Data" (webhook)
  - **URL:** `https://grovia-automations-a9dxfzhpg3bbg8cr.westeurope-01.azurewebsites.net/api/whatsapp-uitnodiging?code=<FUNCTION_KEY>`
    - `<FUNCTION_KEY>` ophalen via Azure Portal → grovia-automations → Functions → whatsapp-uitnodiging → Get function URL
  - **Method:** POST
  - **Body (JSON):**
    ```json
    {
      "voornaam":   "{{contact_first_name}}",
      "achternaam": "{{contact_last_name}}",
      "telefoon":   "{{wc_billing_phone}}",
      "order_id":   "{{wc_order_id}}"
    }
    ```

- [ ] **Stap 3: Activeer de automation**

- [ ] **Stap 4: Testorder aanmaken**
  - Maak een testorder aan (gratis product via WooCommerce admin)
  - Controleer Azure Function logs: Azure Portal → grovia-automations → Functions → whatsapp-uitnodiging → Monitor
  - Controleer of het WhatsApp-bericht aankomt op de testtelefoonnummer
  - Verwacht bericht: `Hoi <voornaam>! Welkom bij Grovia. Klik op de link...`
