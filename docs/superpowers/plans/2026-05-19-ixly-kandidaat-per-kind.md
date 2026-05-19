# Ixly Kandidaat Per Kind — Implementatieplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eén Ixly candidate aanmaken per kind (op basis van `order_id`), in plaats van per ouder (`wc_klant_id`), zodat twee kinderen van dezelfde ouder elk hun eigen assessment-link ontvangen.

**Architecture:** FunnelKit stuurt voortaan ook `kind_voornaam`, `kind_achternaam` en `order_id` mee in de payload. De Azure Function gebruikt `order_id` als `api_identifier` (uniek per bestelling), maakt de candidate aan op naam van het kind (zonder e-mail, per Ixly-advies), en stuurt de uitnodigings-e-mail naar het e-mailadres van de ouder met de naam van het kind. Een duplicate guard voorkomt dubbele assignments bij herhaalde aanroepen.

**Tech Stack:** Python 3.12, Azure Functions v4, Ixly Public API, unittest.mock (unit tests)

---

## Achtergrond

Ixly bevestigde (via Jan-Willem, mei 2026): kandidaten hebben geen e-mail nodig (e-mail-veld wordt in toekomstige API-versie geweigerd). Het `api_identifier`-veld is de sleutel om kandidaten te onderscheiden — ook bij hetzelfde ouder-e-mailadres. Door `order_id` als `api_identifier` te gebruiken, is elke bestelling een aparte candidate, ongeacht of de ouder eerder al een bestelling deed.

---

## Bestandsoverzicht

| Bestand | Wijziging |
|---|---|
| `ixly-aanmelding/__init__.py` | Candidate-aanmaak, upsert-logica, duplicate guard, e-mailparameters aanpassen |
| `tests/test_ixly_aanmelding_unit.py` | Nieuw — unit tests met mocks voor alle gewijzigde functies |
| `test_ixly_aanmelding.py` | Payload bijwerken naar nieuwe velden (handmatig integratietest) |
| `docs/DECISIONS.md` | ADR toevoegen voor kandidaat-strategie |

---

## Task 1: ADR vastleggen

**Files:**
- Modify: `docs/DECISIONS.md`

- [ ] **Stap 1: ADR toevoegen aan docs/DECISIONS.md**

Voeg bovenaan het bestand in (of in de juiste sectie):

```markdown
## ADR-003 — Ixly kandidaat-strategie: kind als candidate, order_id als api_identifier

**Datum:** 2026-05-19
**Status:** Geaccepteerd

**Context:**
Ouders kopen assessments voor kinderen, soms meerdere kinderen met hetzelfde e-mailadres.
Ixly bevestigde (Jan-Willem, mei 2026) dat e-mail niet verplicht is voor kandidaten en in
de toekomst zelfs geweigerd wordt. Het `api_identifier`-veld onderscheidt kandidaten uniek.

**Beslissing:**
- `api_identifier` = `order_id` (uniek per WooCommerce-bestelling)
- Candidate wordt aangemaakt op naam van het kind (`kind_voornaam`, `kind_achternaam`)
- Geen e-mail-veld op de candidate
- E-mail met login_url gaat naar het ouder-e-mailadres, geadresseerd aan het kind

**Alternatieven overwogen:**
- Optie B: `api_identifier = order_id`, candidate = ouder → gekozen tegen omdat aanhef dan onjuist is
- Optie C: meerdere kinderen per order → buiten scope MVP

**Consequenties:**
- FunnelKit payload uitbreiden met `kind_voornaam`, `kind_achternaam`, `order_id`
- Checkout-veld "Naam kind" toevoegen in WooCommerce (buiten scope van deze Function)
```

- [ ] **Stap 2: Commit**

```bash
git add docs/DECISIONS.md
git commit -m "docs: ADR-003 Ixly kandidaat-strategie — kind als candidate, order_id als identifier"
```

---

## Task 2: Unit tests schrijven (failing)

**Files:**
- Create: `tests/test_ixly_aanmelding_unit.py`

- [ ] **Stap 1: Tests-map aanmaken en test-bestand schrijven**

```bash
mkdir -p tests
```

Schrijf `tests/test_ixly_aanmelding_unit.py`:

```python
"""
Unit tests voor ixly-aanmelding Azure Function.
Gebruik: pytest tests/test_ixly_aanmelding_unit.py -v
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'ixly-aanmelding'))

import unittest
from unittest.mock import MagicMock, patch, call
import __init__ as ixly


class TestMaakCandidateAan(unittest.TestCase):
    """Candidate wordt aangemaakt op naam kind, zonder e-mail, met order_id als api_identifier."""

    @patch("__init__.requests.post")
    def test_candidate_payload_gebruikt_kindnaam_en_order_id(self, mock_post):
        mock_response = MagicMock()
        mock_response.json.return_value = {"data": {"id": "uuid-kind-1"}}
        mock_post.return_value = mock_response

        payload = {
            "voornaam": "Jan",        # ouder
            "achternaam": "Jansen",   # ouder
            "email": "jan@voorbeeld.nl",
            "wc_klant_id": "999",
            "kind_voornaam": "Lisa",
            "kind_achternaam": "Jansen",
            "order_id": "42",
        }

        ixly._maak_candidate_aan("token-abc", payload)

        verzonden_body = mock_post.call_args.kwargs["json"]
        kandidaat = verzonden_body["candidate"]
        self.assertEqual(kandidaat["first_name"], "Lisa")
        self.assertEqual(kandidaat["last_name"], "Jansen")
        self.assertEqual(kandidaat["api_identifier"], "42")
        self.assertNotIn("email", kandidaat)

    @patch("__init__.requests.post")
    def test_candidate_geeft_data_terug(self, mock_post):
        mock_response = MagicMock()
        mock_response.json.return_value = {"data": {"id": "uuid-kind-2"}}
        mock_post.return_value = mock_response

        payload = {
            "voornaam": "Jan", "achternaam": "Jansen",
            "email": "jan@voorbeeld.nl", "wc_klant_id": "999",
            "kind_voornaam": "Tim", "kind_achternaam": "Jansen", "order_id": "43",
        }
        result = ixly._maak_candidate_aan("token-abc", payload)
        self.assertEqual(result["id"], "uuid-kind-2")


class TestCandidateUpsert(unittest.TestCase):
    """Upsert zoekt op order_id als api_identifier."""

    @patch("__init__._maak_candidate_aan")
    @patch("__init__._zoek_candidate_op")
    def test_upsert_zoekt_op_order_id(self, mock_zoek, mock_maak):
        mock_zoek.return_value = None
        mock_maak.return_value = {"id": "nieuw-uuid"}

        payload = {
            "voornaam": "Jan", "achternaam": "Jansen",
            "email": "jan@voorbeeld.nl", "wc_klant_id": "999",
            "kind_voornaam": "Lisa", "kind_achternaam": "Jansen", "order_id": "42",
        }

        ixly._candidate_upsert("token", payload)

        mock_zoek.assert_called_once_with("token", "42")

    @patch("__init__._maak_candidate_aan")
    @patch("__init__._zoek_candidate_op")
    def test_upsert_maakt_niet_aan_als_al_bestaat(self, mock_zoek, mock_maak):
        mock_zoek.return_value = {"id": "bestaand-uuid"}

        payload = {
            "voornaam": "Jan", "achternaam": "Jansen",
            "email": "jan@voorbeeld.nl", "wc_klant_id": "999",
            "kind_voornaam": "Lisa", "kind_achternaam": "Jansen", "order_id": "42",
        }

        candidate, nieuw = ixly._candidate_upsert("token", payload)

        mock_maak.assert_not_called()
        self.assertFalse(nieuw)
        self.assertEqual(candidate["id"], "bestaand-uuid")


class TestDuplicateAssignmentGuard(unittest.TestCase):
    """Bestaande assignments worden niet opnieuw aangemaakt."""

    @patch("__init__.requests.get")
    def test_haal_bestaande_assignments_op_geeft_lijst_terug(self, mock_get):
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "data": [
                {"id": "assign-1", "relationships": {"task": {"data": {"id": "taak-uuid-1"}}}},
            ]
        }
        mock_get.return_value = mock_response

        result = ixly._haal_bestaande_assignments_op("token", "candidate-uuid")
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["id"], "assign-1")

    @patch("__init__._maak_assignment_aan")
    @patch("__init__._haal_bestaande_assignments_op")
    def test_maak_assignment_over_als_al_bestaat(self, mock_haal, mock_maak):
        taak_uuid = "2a04b8bc-486f-4b9a-924a-26199b75be9c"
        mock_haal.return_value = [
            {"id": "assign-1", "relationships": {"task": {"data": {"id": taak_uuid}}}},
        ]

        ixly._maak_assignments_aan_met_guard("token", "candidate-uuid")

        # Alleen de tweede taak (Rally Game) moet worden aangemaakt
        self.assertEqual(mock_maak.call_count, 1)
        aangemaakt_taak = mock_maak.call_args.args[2]
        self.assertEqual(aangemaakt_taak["uuid"], "4464b991-268f-45f7-860a-e5b109160612")


class TestValidatieVelden(unittest.TestCase):
    """Main valideert dat alle verplichte velden aanwezig zijn."""

    def _maak_request(self, body: dict):
        import azure.functions as func
        import json
        return func.HttpRequest(
            method="POST",
            url="/api/ixly-aanmelding",
            body=json.dumps(body).encode(),
            headers={"Content-Type": "application/json"},
            params={},
        )

    def test_ontbrekend_kind_voornaam_geeft_400(self):
        body = {
            "voornaam": "Jan", "achternaam": "Jansen",
            "email": "jan@voorbeeld.nl", "wc_klant_id": "999",
            "kind_achternaam": "Jansen", "order_id": "42",
            # kind_voornaam ontbreekt
        }
        req = self._maak_request(body)
        response = ixly.main(req)
        self.assertEqual(response.status_code, 400)

    def test_ontbrekend_order_id_geeft_400(self):
        body = {
            "voornaam": "Jan", "achternaam": "Jansen",
            "email": "jan@voorbeeld.nl", "wc_klant_id": "999",
            "kind_voornaam": "Lisa", "kind_achternaam": "Jansen",
            # order_id ontbreekt
        }
        req = self._maak_request(body)
        response = ixly.main(req)
        self.assertEqual(response.status_code, 400)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Stap 2: Installeer pytest als nog niet aanwezig**

```bash
cd /Users/maxrood/werk/greit/klanten/grovia && source venv/bin/activate && pip show pytest || pip install pytest
```

- [ ] **Stap 3: Verifieer dat tests falen (expected)**

```bash
cd /Users/maxrood/werk/greit/klanten/grovia && source venv/bin/activate && pytest tests/test_ixly_aanmelding_unit.py -v 2>&1 | head -40
```

Verwacht: meerdere FAILED of ERROR — `_maak_candidate_aan` gebruikt nog `wc_klant_id`, `_maak_assignments_aan_met_guard` bestaat nog niet.

- [ ] **Stap 4: Commit (failing tests)**

```bash
git add tests/test_ixly_aanmelding_unit.py
git commit -m "test: unit tests Ixly kandidaat-per-kind (nog failing)"
```

---

## Task 3: Candidate-aanmaak aanpassen

**Files:**
- Modify: `ixly-aanmelding/__init__.py`

Wijzig de functies `_maak_candidate_aan` en `_candidate_upsert`.

- [ ] **Stap 1: `_maak_candidate_aan` aanpassen — kind-naam en order_id**

Vervang de huidige `_maak_candidate_aan` (regels 142–158):

```python
def _maak_candidate_aan(token: str, payload: dict) -> dict:
    response = requests.post(
        f"{IXLY_BASE_URL}/api/public/candidates",
        headers=_ixly_headers(token),
        json={
            "candidate": {
                "first_name":     payload["kind_voornaam"],
                "last_name":      payload["kind_achternaam"],
                "language":       "nl",
                "api_identifier": str(payload["order_id"]),
            }
        },
        timeout=15,
    )
    response.raise_for_status()
    return response.json()["data"]
```

- [ ] **Stap 2: `_candidate_upsert` aanpassen — zoek op order_id**

Vervang de huidige `_candidate_upsert` (regels 161–168):

```python
def _candidate_upsert(token: str, payload: dict) -> tuple[dict, bool]:
    candidate = _zoek_candidate_op(token, str(payload["order_id"]))
    if candidate:
        logging.info(f"Bestaande candidate gevonden: {candidate['id']}")
        return candidate, False
    candidate = _maak_candidate_aan(token, payload)
    logging.info(f"Nieuwe candidate aangemaakt: {candidate['id']}")
    return candidate, True
```

- [ ] **Stap 3: Tests uitvoeren — candidate-tests moeten nu slagen**

```bash
cd /Users/maxrood/werk/greit/klanten/grovia && source venv/bin/activate && pytest tests/test_ixly_aanmelding_unit.py -v -k "TestMaakCandidateAan or TestCandidateUpsert"
```

Verwacht: `TestMaakCandidateAan` en `TestCandidateUpsert` → PASSED.

---

## Task 4: Duplicate assignment guard implementeren

**Files:**
- Modify: `ixly-aanmelding/__init__.py`

- [ ] **Stap 1: Nieuwe functie `_haal_bestaande_assignments_op` toevoegen**

Voeg toe direct vóór `_maak_assignment_aan`:

```python
def _haal_bestaande_assignments_op(token: str, candidate_uuid: str) -> list:
    response = requests.get(
        f"{IXLY_BASE_URL}/api/public/assignments",
        headers=_ixly_headers(token),
        params={"candidate_uuid": candidate_uuid},
        timeout=15,
    )
    response.raise_for_status()
    return response.json().get("data", [])
```

- [ ] **Stap 2: Nieuwe functie `_maak_assignments_aan_met_guard` toevoegen**

Voeg toe direct ná `_maak_assignment_aan`:

```python
def _maak_assignments_aan_met_guard(token: str, candidate_uuid: str) -> tuple[list, str | None]:
    bestaande = _haal_bestaande_assignments_op(token, candidate_uuid)
    bestaande_task_uuids = {
        a["relationships"]["task"]["data"]["id"]
        for a in bestaande
        if a.get("relationships", {}).get("task", {}).get("data")
    }

    assignments = []
    login_url = None

    for taak in TAKEN:
        if taak["uuid"] in bestaande_task_uuids:
            logging.info(f"Assignment al aanwezig voor {taak['naam']} — overgeslagen.")
            continue
        assignment = _maak_assignment_aan(token, candidate_uuid, taak)
        links = assignment.get("links", {})
        if not login_url:
            login_url = links.get("login_url")
        logging.info(f"Assignment aangemaakt voor {taak['naam']}: {assignment['id']}")
        assignments.append({
            "naam":            taak["naam"],
            "assignment_uuid": assignment["id"],
        })

    return assignments, login_url
```

- [ ] **Stap 3: Tests uitvoeren — duplicate guard tests moeten slagen**

```bash
cd /Users/maxrood/werk/greit/klanten/grovia && source venv/bin/activate && pytest tests/test_ixly_aanmelding_unit.py -v -k "TestDuplicateAssignmentGuard"
```

Verwacht: PASSED.

---

## Task 5: Validatie en main() bijwerken

**Files:**
- Modify: `ixly-aanmelding/__init__.py`

- [ ] **Stap 1: Verplichte velden uitbreiden in `main()`**

Vervang de validatieregel (regel 266):

```python
ontbrekend = [v for v in ["voornaam", "achternaam", "email", "wc_klant_id", "kind_voornaam", "kind_achternaam", "order_id"] if not body.get(v)]
```

- [ ] **Stap 2: `main()` aanpassen — gebruik nieuwe functies en child-naam in e-mail**

Vervang het try-blok in `main()` (de huidige assignments-loop + `_stuur_email`-aanroep, regels 275–293):

```python
        token = _haal_user_token_op()

        candidate, _ = _candidate_upsert(token, body)
        candidate_uuid = candidate["id"]

        assignments, login_url = _maak_assignments_aan_met_guard(token, candidate_uuid)

        _stuur_email(body["email"], body["kind_voornaam"], body["kind_achternaam"], login_url)
```

- [ ] **Stap 3: Alle validatietests uitvoeren**

```bash
cd /Users/maxrood/werk/greit/klanten/grovia && source venv/bin/activate && pytest tests/test_ixly_aanmelding_unit.py -v -k "TestValidatie"
```

Verwacht: PASSED.

- [ ] **Stap 4: Alle unit tests draaien**

```bash
cd /Users/maxrood/werk/greit/klanten/grovia && source venv/bin/activate && pytest tests/test_ixly_aanmelding_unit.py -v
```

Verwacht: alle tests PASSED, geen FAILED.

- [ ] **Stap 5: Commit**

```bash
git add ixly-aanmelding/__init__.py
git commit -m "feat: Ixly kandidaat per kind — order_id als identifier, duplicate guard, kind-naam in e-mail"
```

---

## Task 6: Handmatig integratietestscript bijwerken

**Files:**
- Modify: `test_ixly_aanmelding.py`

- [ ] **Stap 1: Payload bijwerken**

Vervang het `PAYLOAD`-blok:

```python
PAYLOAD = {
    "voornaam":      "Jan",
    "achternaam":    "Jansen",
    "email":         "jan.jansen@voorbeeld.nl",
    "wc_klant_id":   "12345",
    "kind_voornaam": "Lisa",
    "kind_achternaam": "Jansen",
    "order_id":      "999",
}
```

- [ ] **Stap 2: Commit**

```bash
git add test_ixly_aanmelding.py
git commit -m "test: integratietestscript payload bijwerken voor kind-velden"
```

---

## Task 7: FunnelKit Workflow 3A bijwerken (handmatige stap)

Dit is een configuratiewijziging in de WordPress/FunnelKit omgeving — geen code.

- [ ] **Stap 1: Login op WordPress admin → FunnelKit → Automations → Workflow 3A**

- [ ] **Stap 2: HTTP Request payload bijwerken**

Voeg toe aan de bestaande payload (`voornaam`, `achternaam`, `email`, `wc_klant_id`):

```json
{
  "voornaam":        "{{contact_first_name}}",
  "achternaam":      "{{contact_last_name}}",
  "email":           "{{contact_email}}",
  "wc_klant_id":     "{{wc_customer_id}}",
  "kind_voornaam":   "{{billing_kind_voornaam}}",
  "kind_achternaam": "{{billing_kind_achternaam}}",
  "order_id":        "{{wc_order_id}}"
}
```

> **Let op:** `billing_kind_voornaam` en `billing_kind_achternaam` zijn de merge tags van de custom WooCommerce checkout-velden. Deze velden moeten eerst in WooCommerce worden aangemaakt (zie opmerking hieronder).

- [ ] **Stap 3: Workflow opslaan en activeren**

---

## Opmerking: WooCommerce checkout-veld

Het toevoegen van "Naam kind" (voornaam + achternaam) als custom checkout-veld in WooCommerce is een **aparte taak** die buiten dit plan valt. Totdat dit veld bestaat, kan FunnelKit `kind_voornaam` en `kind_achternaam` niet automatisch vullen. Tijdelijke workaround voor de live review: handmatig de function aanroepen met het testscript.

---

## Task 8: Integratietest uitvoeren

- [ ] **Stap 1: Lokale function starten**

```bash
cd /Users/maxrood/werk/greit/klanten/grovia && source venv/bin/activate && func start
```

- [ ] **Stap 2: Testscript uitvoeren in een tweede terminal**

```bash
cd /Users/maxrood/werk/greit/klanten/grovia && source venv/bin/activate && python test_ixly_aanmelding.py
```

Verwacht: status 200, `login_url` aanwezig in response, e-mail ontvangen op `GROVIA_DEBUG_EMAIL` gericht aan "Lisa Jansen".

- [ ] **Stap 3: Tweede aanroep uitvoeren (duplicate guard test)**

Voer het testscript nogmaals uit met hetzelfde `order_id`.

Verwacht: status 200, geen nieuwe assignments aangemaakt (log: "Assignment al aanwezig voor … — overgeslagen"), wel dezelfde `candidate_uuid` terug.

- [ ] **Stap 4: Commit docs en push**

```bash
git add docs/ tests/
git commit -m "docs: plan en sessie-updates na implementatie kandidaat-per-kind"
git push
```
