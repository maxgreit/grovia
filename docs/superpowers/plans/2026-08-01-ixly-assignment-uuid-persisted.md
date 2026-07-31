# Ixly-afronding repareren: assignment-uuid's bewaren — implementatieplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** De Ixly-afrondingscontrole (`ixly-status`) en de reminder-linkjes
(`grovia-herinnering`) laten werken door de assignment-uuid's die `ixly-aanmelding` al
kent, te bewaren als WooCommerce order-meta, in plaats van te vertrouwen op een
niet-gedocumenteerd, altijd-leeg lijst-endpoint.

**Architecture:** `ixly-aanmelding` schrijft na het aanmaken van de assignments
`naam:assignment_uuid`-paren weg als order-meta `_grovia_ixly_taken`. Apps Script leest
dat veld mee via de bestaande WCAPI-ingest en geeft het door in de aanroepen naar
`ixly-status` en `grovia-herinnering`. Beide Azure Functions gebruiken vervolgens
uitsluitend het bewezen werkende `GET /api/public/assignments/{uuid}` — nooit meer het
kapotte lijst-endpoint.

**Tech Stack:** Python 3.12 (Azure Functions), Google Apps Script (V8), WooCommerce REST
API v3, Ixly Assessments API. Tests: pytest (Python), `node --test` (Apps Script).

**Spec:** [`docs/superpowers/specs/2026-08-01-ixly-assignment-uuid-persisted-design.md`](../specs/2026-08-01-ixly-assignment-uuid-persisted-design.md)

## Global Constraints

- **Code, comments en commits in het Nederlands.**
- **Nooit secrets in code.** De nieuwe schrijfbare WooCommerce-sleutel komt in Azure App
  Settings (`GROVIA_WOO_CONSUMER_KEY`/`GROVIA_WOO_CONSUMER_SECRET`), nooit hardcoded.
- **Geen terugvulling van bestaande candidates.** Rijen zonder `ixly_taken` (alles van
  vóór deze fix) blijven permanent buiten de automatische Ixly-controle.
- **De order-meta-schrijfactie in `ixly-aanmelding` mag de rest van de flow nooit
  blokkeren** — met name niet de uitnodigingsmail. Best-effort, geen retry.
- **In `ixly-status` blijft gelden: één stukke taak of order blokkeert de rest niet.**
  Elke taak levert altijd een item in de `taken`-lijst op, ook bij een 404 of onbekende
  taaksoort — nooit stil overslaan (dat zou `_bepaal_afronding` een kortere lijst geven
  dan er taken zijn, met risico op een foutief "afgerond").
- **Canoniek testcommando voor Apps Script:** `node --test "tests/gs/*.test.js"` (met de
  glob-quotes — de kale directory-vorm faalt op deze Node-versie).
- **Python-tests:** `source venv/bin/activate && python -m pytest tests/ -q`.
- **Huidige teststatus vóór dit plan:** Python 89 passed, 0 failed. Apps Script 47
  passed, 0 failed.

---

### Task 1: `ixly_api.haal_assignment` — nieuwe functie

**Files:**
- Modify: `grovia_shared/ixly_api.py`
- Test: `tests/test_ixly_status.py`

**Interfaces:**
- Consumes: niets nieuws (gebruikt `_headers`, `IXLY_BASE_URL` — bestaan al in dit bestand)
- Produces: `haal_assignment(token: str, assignment_uuid: str) -> dict | None` — de ruwe
  `data`-waarde van `GET /api/public/assignments/{uuid}` (met `relationships` en
  `links`), of `None` bij een 404.

- [ ] **Step 1: Schrijf de falende tests**

Voeg toe aan `tests/test_ixly_status.py`, bovenaan het bestand na de bestaande imports
(vóór `class TestBepaalAfronding`), de benodigde import:

```python
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from grovia_shared import ixly_api
```

Voeg een nieuwe testklasse toe, ná `TestBepaalAfronding` en vóór `TestHandler`:

```python
class TestHaalAssignment(unittest.TestCase):
    """haal_assignment haalt een enkele assignment op via zijn eigen uuid."""

    @patch("grovia_test_ixly_status.ixly_api.requests.get")
    def test_geeft_data_terug_bij_succes(self, mock_get):
        mock_get.return_value = MagicMock(status_code=200, **{
            "json.return_value": {"data": {
                "id": "assign-1",
                "relationships": {"candidate_task": {"data": {"id": "taak-1"}}},
                "links": {"login_url": "https://ixly.test/login"},
            }}
        })

        resultaat = ixly_api.haal_assignment("token", "assign-1")

        self.assertEqual(resultaat["id"], "assign-1")
        self.assertEqual(resultaat["links"]["login_url"], "https://ixly.test/login")

    @patch("grovia_test_ixly_status.ixly_api.requests.get")
    def test_geeft_none_terug_bij_404(self, mock_get):
        mock_get.return_value = MagicMock(status_code=404)
        self.assertIsNone(ixly_api.haal_assignment("token", "onbekend"))

    @patch("grovia_test_ixly_status.ixly_api.requests.get")
    def test_roept_juiste_url_aan(self, mock_get):
        mock_get.return_value = MagicMock(status_code=200, **{"json.return_value": {"data": {}}})

        ixly_api.haal_assignment("token", "assign-1")

        url = mock_get.call_args.args[0]
        self.assertIn("/api/public/assignments/assign-1", url)
```

- [ ] **Step 2: Draai de tests en verifieer dat ze falen**

Run: `source venv/bin/activate && python -m pytest tests/test_ixly_status.py -v -k TestHaalAssignment`
Expected: FAIL — `AttributeError: module ... has no attribute 'haal_assignment'`

- [ ] **Step 3: Implementeer `haal_assignment`**

Voeg toe aan `grovia_shared/ixly_api.py`, direct ná `zoek_candidate` en vóór
`haal_assignments`:

```python
def haal_assignment(token: str, assignment_uuid: str) -> dict | None:
    """
    Haal een assignment op via zijn eigen uuid (GET /api/public/assignments/{uuid}).

    None als niet gevonden (bijv. een verouderde of foutieve uuid) -- de aanroeper
    behandelt dat dan als 'niet afgerond', net als haal_taak_status al doet bij een
    onbekende taak. Geeft zowel relationships (welke candidate_task/_program/_process)
    als links.login_url in één keer terug -- dit is het enige publieke Ixly-endpoint dat
    een candidate se assignments betrouwbaar teruggeeft; GET /assignments (zonder uuid)
    heeft geen lijst/filter-variant.
    """
    response = requests.get(
        f"{IXLY_BASE_URL}/api/public/assignments/{assignment_uuid}",
        headers=_headers(token),
        timeout=15,
    )
    if response.status_code == 404:
        return None
    response.raise_for_status()
    return response.json().get("data")
```

- [ ] **Step 4: Draai de tests en verifieer dat ze slagen**

Run: `source venv/bin/activate && python -m pytest tests/test_ixly_status.py -v -k TestHaalAssignment`
Expected: 3 passed

- [ ] **Step 5: Draai de volledige suite**

Run: `source venv/bin/activate && python -m pytest tests/ -q`
Expected: 92 passed, 0 failed (89 + 3 nieuw)

- [ ] **Step 6: Commit**

```bash
git add grovia_shared/ixly_api.py tests/test_ixly_status.py
git commit -m "feat: haal_assignment -- enkele assignment ophalen via zijn eigen uuid"
```

---

### Task 2: `ixly-status` — nieuw request/response-contract

**Files:**
- Modify: `ixly-status/__init__.py`
- Test: `tests/test_ixly_status.py`

**Interfaces:**
- Consumes: `ixly_api.haal_assignment`, `ixly_api.haal_taak_status` (ongewijzigd),
  `ixly_api.TAAK_RELATIES`, `ixly_api.haal_token`
- Produces: nieuw HTTP-contract:
  - Request: `{"orders": [{"order_id": "1195", "taken": [{"naam": "Blocks Game", "assignment_uuid": "..."}]}]}`
  - Response: `{"resultaten": {"1195": {"af": bool, "completed_at": str, "taken": [...], "fout"?: str}}}`
  - `_haal_taken_voor_order(token: str, taken_refs: list) -> dict` (was:
    `_haal_taken_voor_order(token: str, order_id: str) -> dict`)

- [ ] **Step 1: Schrijf de falende tests**

Vervang in `tests/test_ixly_status.py` de hele bestaande `class TestHandler` (van
`class TestHandler(unittest.TestCase):` tot het einde van het bestand) door onderstaande
twee klassen (`TestHaalTakenVoorOrder` + het nieuwe `TestHandler`):

```python
class TestHaalTakenVoorOrder(unittest.TestCase):
    """_haal_taken_voor_order vraagt per bewaarde assignment-uuid de status op."""

    @patch("grovia_test_ixly_status.ixly_api.haal_taak_status")
    @patch("grovia_test_ixly_status.ixly_api.haal_assignment")
    def test_alle_taken_afgerond_geeft_af(self, mock_assignment, mock_status):
        mock_assignment.return_value = {"relationships": {"candidate_task": {"data": {"id": "taak-1"}}}}
        mock_status.return_value = {"state": "completed", "completed_at": "2026-07-20T10:00:00Z"}

        resultaat = status._haal_taken_voor_order("token", [
            {"naam": "Blocks Game", "assignment_uuid": "assign-1"},
        ])

        self.assertTrue(resultaat["af"])
        self.assertEqual(resultaat["taken"][0]["naam"], "Blocks Game")

    @patch("grovia_test_ixly_status.ixly_api.haal_assignment")
    def test_onbekende_assignment_telt_als_niet_afgerond_maar_blijft_in_de_lijst(self, mock_assignment):
        mock_assignment.return_value = None

        resultaat = status._haal_taken_voor_order("token", [
            {"naam": "Blocks Game", "assignment_uuid": "onbekend"},
        ])

        self.assertFalse(resultaat["af"])
        self.assertEqual(len(resultaat["taken"]), 1)
        self.assertEqual(resultaat["taken"][0]["state"], "")

    @patch("grovia_test_ixly_status.ixly_api.haal_assignment")
    def test_geen_taaksoort_gevonden_telt_als_niet_afgerond(self, mock_assignment):
        mock_assignment.return_value = {"relationships": {}}

        resultaat = status._haal_taken_voor_order("token", [
            {"naam": "Blocks Game", "assignment_uuid": "assign-1"},
        ])

        self.assertFalse(resultaat["af"])
        self.assertEqual(len(resultaat["taken"]), 1)

    @patch("grovia_test_ixly_status.ixly_api.haal_taak_status")
    @patch("grovia_test_ixly_status.ixly_api.haal_assignment")
    def test_een_taak_niet_afgerond_geeft_niet_af(self, mock_assignment, mock_status):
        mock_assignment.side_effect = [
            {"relationships": {"candidate_task": {"data": {"id": "taak-1"}}}},
            {"relationships": {"candidate_task": {"data": {"id": "taak-2"}}}},
        ]
        mock_status.side_effect = [
            {"state": "completed", "completed_at": "2026-07-20T10:00:00Z"},
            {"state": "started", "completed_at": ""},
        ]

        resultaat = status._haal_taken_voor_order("token", [
            {"naam": "Blocks Game", "assignment_uuid": "assign-1"},
            {"naam": "Rally Game",  "assignment_uuid": "assign-2"},
        ])

        self.assertFalse(resultaat["af"])
        self.assertEqual(len(resultaat["taken"]), 2)


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

    def test_ontbrekende_orders_geeft_400(self):
        self.assertEqual(status.main(self._maak_request({})).status_code, 400)

    def test_orders_geen_lijst_geeft_400(self):
        self.assertEqual(status.main(self._maak_request({"orders": "1195"})).status_code, 400)

    def test_te_veel_orders_geeft_400(self):
        veel = [{"order_id": str(n), "taken": [{"naam": "x", "assignment_uuid": "y"}]}
                for n in range(status.MAX_ORDERS_PER_AANROEP + 1)]
        self.assertEqual(status.main(self._maak_request({"orders": veel})).status_code, 400)

    def test_ongeldige_json_geeft_400(self):
        import azure.functions as func
        req = func.HttpRequest(
            method="POST", url="/api/ixly-status", body=b"geen json",
            headers={"Content-Type": "application/json"}, params={},
        )
        self.assertEqual(status.main(req).status_code, 400)

    @patch("grovia_test_ixly_status.ixly_api.haal_taak_status")
    @patch("grovia_test_ixly_status.ixly_api.haal_assignment")
    @patch("grovia_test_ixly_status.ixly_api.haal_token")
    def test_afgeronde_taken_geven_af(self, mock_token, mock_assignment, mock_status):
        mock_token.return_value = "token"
        mock_assignment.return_value = {"relationships": {"candidate_task": {"data": {"id": "taak-1"}}}}
        mock_status.return_value = {"state": "completed", "completed_at": "2026-07-20T10:00:00Z"}

        response = status.main(self._maak_request({"orders": [
            {"order_id": "1195", "taken": [{"naam": "Blocks Game", "assignment_uuid": "assign-1"}]},
        ]}))
        data = json.loads(response.get_body())

        self.assertTrue(data["resultaten"]["1195"]["af"])
        self.assertEqual(data["resultaten"]["1195"]["completed_at"], "2026-07-20")

    @patch("grovia_test_ixly_status.ixly_api.haal_token")
    def test_token_fout_geeft_502(self, mock_token):
        import requests as req_lib
        respons = MagicMock(status_code=401, text="unauthorized")
        mock_token.side_effect = req_lib.HTTPError(response=respons)

        response = status.main(self._maak_request({"orders": [
            {"order_id": "1195", "taken": [{"naam": "Blocks Game", "assignment_uuid": "assign-1"}]},
        ]}))
        self.assertEqual(response.status_code, 502)

    @patch("grovia_test_ixly_status.ixly_api.haal_assignment")
    @patch("grovia_test_ixly_status.ixly_api.haal_token")
    def test_ixly_fout_bij_een_order_blokkeert_de_rest_niet(self, mock_token, mock_assignment):
        import requests as req_lib
        mock_token.return_value = "token"
        respons = MagicMock(status_code=503, text="service unavailable")
        mock_assignment.side_effect = req_lib.HTTPError(response=respons)

        response = status.main(self._maak_request({"orders": [
            {"order_id": "1195", "taken": [{"naam": "Blocks Game", "assignment_uuid": "assign-1"}]},
        ]}))
        data = json.loads(response.get_body())

        self.assertEqual(response.status_code, 200)
        self.assertIn("fout", data["resultaten"]["1195"])
        self.assertFalse(data["resultaten"]["1195"]["af"])

    @patch("grovia_test_ixly_status.ixly_api.haal_token")
    def test_order_zonder_taken_wordt_overgeslagen(self, mock_token):
        mock_token.return_value = "token"
        response = status.main(self._maak_request({"orders": [
            {"order_id": "1195", "taken": []},
        ]}))
        data = json.loads(response.get_body())
        self.assertNotIn("1195", data["resultaten"])


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Draai de tests en verifieer dat ze falen**

Run: `source venv/bin/activate && python -m pytest tests/test_ixly_status.py -v`
Expected: FAIL — `_haal_taken_voor_order` bestaat nog met de oude signatuur, `main` valideert nog `order_ids`

- [ ] **Step 3: Herschrijf `ixly-status/__init__.py`**

Vervang het VOLLEDIGE bestand door:

```python
"""
Azure Function: Ixly status opvragen.

Krijgt per order de bewaarde assignment-uuid's (uit WooCommerce order-meta
_grovia_ixly_taken, ingelezen door Apps Script) en geeft terug of de taken zijn
afgerond. Aangeroepen door het Apps Script van het werkboek "Grovia Deelnemers".

Vraagt NIET meer de candidate op en NIET meer de assignments-lijst van een candidate --
de publieke Ixly-API heeft daar geen werkend endpoint voor (alleen POST /assignments,
geen GET/lijst-variant, bevestigd tegen swagger.yaml). In plaats daarvan wordt per taak
de al bekende assignment-uuid gebruikt met het wel bewezen werkende
GET /assignments/{uuid}.

Payload:
  {"orders": [
    {"order_id": "1195", "taken": [
      {"naam": "Blocks Game", "assignment_uuid": "39e7d2a1-..."},
      {"naam": "Rally Game",  "assignment_uuid": "8a4f9c22-..."}
    ]}
  ]}

Respons:
  {"resultaten": {
     "1195": {"af": true, "completed_at": "2026-07-20",
              "taken": [{"naam": "Blocks Game", "state": "completed", "completed_at": "..."}]},
     "941":  {"af": false, "completed_at": "", "taken": [], "fout": "..."}
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
# LET OP: config.ixly_batch_per_run (Config-tabblad in het werkboek, default 50) moet
# altijd <= deze waarde blijven -- anders geeft deze function een HTTP 400 en faalt
# werkIxlyBij met een exception, wat via de dataBetrouwbaar-regel ALLE reminders die dag
# blokkeert. Zie de bijbehorende comment bij ixly_batch_per_run in Config.gs.
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


def _haal_taken_voor_order(token: str, taken_refs: list) -> dict:
    """
    Vraagt per bewaarde assignment-uuid de status op.

    Elke taak levert altijd een item in de teruggegeven 'taken'-lijst op (nooit stil
    overgeslagen bij een 404 of onbekende taaksoort) -- anders zou _bepaal_afronding een
    kortere lijst zien dan er taken zijn, en zo een taak die niet te achterhalen was
    verkeerd als 'afgerond genoeg' kunnen meetellen.
    """
    taken = []
    for ref in taken_refs:
        assignment = ixly_api.haal_assignment(token, ref["assignment_uuid"])
        if not assignment:
            taken.append({"naam": ref["naam"], "state": "", "completed_at": ""})
            continue

        relaties = assignment.get("relationships", {})
        soort, taak_uuid = None, None
        for kandidaat_soort in ixly_api.TAAK_RELATIES:
            verwijzing = relaties.get(kandidaat_soort, {}).get("data")
            if verwijzing:
                soort, taak_uuid = kandidaat_soort, verwijzing["id"]
                break

        if not soort:
            taken.append({"naam": ref["naam"], "state": "", "completed_at": ""})
            continue

        status_dict = ixly_api.haal_taak_status(token, soort, taak_uuid)
        taken.append({
            "naam":         ref["naam"],
            "state":        status_dict["state"],
            "completed_at": status_dict["completed_at"],
        })

    return {"taken": taken, **_bepaal_afronding(taken)}


def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("Ixly Status gestart.")

    try:
        body = req.get_json()
    except ValueError:
        return func.HttpResponse("Ongeldige JSON in request body.", status_code=400)

    orders = body.get("orders")
    if not orders or not isinstance(orders, list):
        return func.HttpResponse(
            json.dumps({"fout": "orders ontbreekt of is geen lijst."}),
            mimetype="application/json",
            status_code=400,
        )

    if len(orders) > MAX_ORDERS_PER_AANROEP:
        return func.HttpResponse(
            json.dumps({"fout": f"Maximaal {MAX_ORDERS_PER_AANROEP} orders per aanroep."}),
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
    for order in orders:
        order_id = str(order.get("order_id", ""))
        taken_refs = order.get("taken", [])
        if not order_id or not taken_refs:
            continue
        try:
            resultaten[order_id] = _haal_taken_voor_order(token, taken_refs)
        except requests.HTTPError as e:
            # Eén stukke order blokkeert de rest niet.
            logging.error(f"Order {order_id}: Ixly-fout {e.response.status_code}")
            resultaten[order_id] = {
                "af": False, "completed_at": "", "taken": [],
                "fout": f"Ixly-fout {e.response.status_code}",
            }

    logging.info(f"Status bepaald voor {len(resultaten)} orders.")
    return func.HttpResponse(
        json.dumps({"resultaten": resultaten}),
        mimetype="application/json",
        status_code=200,
    )
```

- [ ] **Step 4: Draai de tests en verifieer dat ze slagen**

Run: `source venv/bin/activate && python -m pytest tests/test_ixly_status.py -v`
Expected: alle tests slagen (voorheen 11 in dit bestand, nu meer door de nieuwe klasse —
tel de output, geen enkele FAIL)

- [ ] **Step 5: Draai de volledige suite**

Run: `source venv/bin/activate && python -m pytest tests/ -q`
Expected: 0 failed

- [ ] **Step 6: Commit**

```bash
git add ixly-status/__init__.py tests/test_ixly_status.py
git commit -m "fix: ixly-status gebruikt bewaarde assignment-uuid's i.p.v. het kapotte lijst-endpoint"
```

---

### Task 3: `grovia-herinnering` — `_haal_login_urls` herschreven

**Files:**
- Modify: `grovia-herinnering/__init__.py`
- Test: `tests/test_grovia_herinnering.py`

**Interfaces:**
- Consumes: `ixly_api.haal_assignment`, `ixly_api.haal_token`
- Produces: `_haal_login_urls(taken_refs: list) -> list` (was:
  `_haal_login_urls(code: str) -> list`). Payload van deze function krijgt een nieuw
  veld `taken` (optioneel, `[]` als niet meegegeven).

- [ ] **Step 1: Schrijf de falende tests**

Vervang in `tests/test_grovia_herinnering.py` de VOLLEDIGE bestaande
`class TestHaalLoginUrls` (aan het eind van het bestand) door:

```python
class TestHaalLoginUrls(unittest.TestCase):
    """_haal_login_urls haalt per bewaarde assignment-uuid de login_url op."""

    @patch("grovia_test_grovia_herinnering.ixly_api.haal_assignment")
    @patch("grovia_test_grovia_herinnering.ixly_api.haal_token")
    def test_geeft_naam_en_login_url_terug(self, mock_token, mock_assignment):
        mock_token.return_value = "token"
        mock_assignment.return_value = {"links": {"login_url": "https://ixly.test/blocks"}}

        resultaat = herinnering._haal_login_urls([
            {"naam": "Blocks Game", "assignment_uuid": "assign-1"},
        ])

        self.assertEqual(resultaat, [{"naam": "Blocks Game", "login_url": "https://ixly.test/blocks"}])

    @patch("grovia_test_grovia_herinnering.ixly_api.haal_assignment")
    @patch("grovia_test_grovia_herinnering.ixly_api.haal_token")
    def test_onbekende_assignment_wordt_overgeslagen(self, mock_token, mock_assignment):
        mock_token.return_value = "token"
        mock_assignment.return_value = None

        resultaat = herinnering._haal_login_urls([
            {"naam": "Blocks Game", "assignment_uuid": "onbekend"},
        ])

        self.assertEqual(resultaat, [])

    @patch("grovia_test_grovia_herinnering.ixly_api.haal_assignment")
    @patch("grovia_test_grovia_herinnering.ixly_api.haal_token")
    def test_beide_games_krijgen_hun_eigen_link(self, mock_token, mock_assignment):
        mock_token.return_value = "token"
        mock_assignment.side_effect = [
            {"links": {"login_url": "https://ixly.test/blocks"}},
            {"links": {"login_url": "https://ixly.test/rally"}},
        ]

        resultaat = herinnering._haal_login_urls([
            {"naam": "Blocks Game", "assignment_uuid": "assign-1"},
            {"naam": "Rally Game",  "assignment_uuid": "assign-2"},
        ])

        self.assertEqual(resultaat, [
            {"naam": "Blocks Game", "login_url": "https://ixly.test/blocks"},
            {"naam": "Rally Game",  "login_url": "https://ixly.test/rally"},
        ])

    @patch("grovia_test_grovia_herinnering.ixly_api.haal_token")
    def test_token_fout_geeft_lege_lijst(self, mock_token):
        import requests as req_lib
        respons = MagicMock(status_code=401, text="unauthorized")
        mock_token.side_effect = req_lib.HTTPError(response=respons)

        resultaat = herinnering._haal_login_urls([
            {"naam": "Blocks Game", "assignment_uuid": "assign-1"},
        ])

        self.assertEqual(resultaat, [])
```

Vervang ook, in `class TestHandler`, de bestaande test `test_ixly_reminder_haalt_links_op`
door:

```python
    @patch("grovia_test_grovia_herinnering.grovia_mail.verstuur")
    @patch("grovia_test_grovia_herinnering._haal_login_urls")
    def test_ixly_reminder_haalt_links_op(self, mock_links, mock_verstuur):
        mock_links.return_value = ASSIGNMENTS
        taken_refs = [{"naam": "Blocks Game", "assignment_uuid": "assign-1"}]

        response = herinnering.main(self._maak_request(
            self._goed_payload(open_testen=["ixly"], taken=taken_refs)
        ))

        mock_links.assert_called_once_with(taken_refs)
        self.assertTrue(json.loads(response.get_body())["verstuurd"])
```

De import bovenaan het testbestand moet ook `ixly_api` bevatten. Vervang de bestaande
imports-sectie (regel 1 t/m 15) door:

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
from grovia_shared import grovia_mail, ixly_api
from conftest import laad_function_module

herinnering = laad_function_module('grovia-herinnering')
```

- [ ] **Step 2: Draai de tests en verifieer dat ze falen**

Run: `source venv/bin/activate && python -m pytest tests/test_grovia_herinnering.py -v`
Expected: FAIL — `_haal_login_urls` heeft nog de oude signatuur

- [ ] **Step 3: Herschrijf `_haal_login_urls` en `main` in `grovia-herinnering/__init__.py`**

Vervang de functie `_haal_login_urls` (regel 31-56) door:

```python
def _haal_login_urls(taken_refs: list) -> list:
    """
    Haal de login-urls op voor de meegegeven taken via hun bewaarde assignment-uuid.

    Args:
        taken_refs: [{'naam': 'Blocks Game', 'assignment_uuid': '...'}]

    Returns:
        [{'naam': ..., 'login_url': ...}] -- alleen taken waarvoor een link gevonden is.
        Lege lijst als het token niet op te halen is.
    """
    try:
        token = ixly_api.haal_token()
    except requests.HTTPError as e:
        logging.error(f"Kon geen Ixly-token ophalen voor login-urls: {e.response.status_code}")
        return []

    resultaat = []
    for ref in taken_refs:
        assignment = ixly_api.haal_assignment(token, ref["assignment_uuid"])
        if not assignment:
            logging.warning(f"Assignment {ref['assignment_uuid']} niet gevonden voor {ref['naam']}.")
            continue
        login_url = assignment.get("links", {}).get("login_url")
        if login_url:
            resultaat.append({"naam": ref["naam"], "login_url": login_url})

    return resultaat
```

Vervang in `main`, de regel:

```python
    open_testen = body["open_testen"]
    assignments = _haal_login_urls(body["code"]) if "ixly" in open_testen else []
```

door:

```python
    open_testen = body["open_testen"]
    taken_refs  = body.get("taken", [])
    assignments = _haal_login_urls(taken_refs) if "ixly" in open_testen else []
```

- [ ] **Step 4: Draai de tests en verifieer dat ze slagen**

Run: `source venv/bin/activate && python -m pytest tests/test_grovia_herinnering.py -v`
Expected: alle tests slagen

- [ ] **Step 5: Draai de volledige suite**

Run: `source venv/bin/activate && python -m pytest tests/ -q`
Expected: 0 failed

- [ ] **Step 6: Commit**

```bash
git add grovia-herinnering/__init__.py tests/test_grovia_herinnering.py
git commit -m "fix: grovia-herinnering haalt login-urls op via bewaarde assignment-uuid's"
```

---

### Task 4: `ixly-aanmelding` — assignment-uuid's bewaren als order-meta

**Files:**
- Modify: `ixly-aanmelding/__init__.py`
- Modify: `local.settings.json.example`
- Test: `tests/test_ixly_aanmelding_unit.py`

**Interfaces:**
- Consumes: niets nieuws van eerdere taken in dit plan
- Produces: `_bewaar_ixly_taken(order_id: str, assignments: list) -> None` — schrijft
  order-meta `_grovia_ixly_taken` op de WooCommerce-order. Vangt zelf ALLE fouten af,
  gooit nooit een exception.

- [ ] **Step 1: Schrijf de falende tests**

Voeg toe aan `tests/test_ixly_aanmelding_unit.py`, ná `class TestDuplicateAssignmentGuard`
en vóór `class TestValidatieVelden`:

```python
class TestBewaarIxlyTaken(unittest.TestCase):
    """De taak-uuid's worden als order-meta bewaard, zonder de rest te blokkeren."""

    ASSIGNMENTS = [
        {"naam": "Blocks Game", "assignment_uuid": "assign-1", "login_url": "https://ixly.example/blocks"},
        {"naam": "Rally Game",  "assignment_uuid": "assign-2", "login_url": "https://ixly.example/rally"},
    ]

    @patch("grovia_test_ixly_aanmelding.requests.put")
    def test_stuurt_naam_en_uuid_gecombineerd(self, mock_put):
        mock_put.return_value = MagicMock(status_code=200)
        with patch.object(ixly, "GROVIA_WOO_CONSUMER_KEY", "ck_test"), \
             patch.object(ixly, "GROVIA_WOO_CONSUMER_SECRET", "cs_test"):
            ixly._bewaar_ixly_taken("42", self.ASSIGNMENTS)

        waarde = mock_put.call_args.kwargs["json"]["meta_data"][0]["value"]
        self.assertEqual(waarde, "Blocks Game:assign-1,Rally Game:assign-2")

    @patch("grovia_test_ixly_aanmelding.requests.put")
    def test_gebruikt_juiste_meta_sleutel(self, mock_put):
        mock_put.return_value = MagicMock(status_code=200)
        with patch.object(ixly, "GROVIA_WOO_CONSUMER_KEY", "ck_test"), \
             patch.object(ixly, "GROVIA_WOO_CONSUMER_SECRET", "cs_test"):
            ixly._bewaar_ixly_taken("42", self.ASSIGNMENTS)

        sleutel = mock_put.call_args.kwargs["json"]["meta_data"][0]["key"]
        self.assertEqual(sleutel, "_grovia_ixly_taken")

    def test_zonder_sleutels_doet_niets(self):
        with patch.object(ixly, "GROVIA_WOO_CONSUMER_KEY", ""), \
             patch.object(ixly, "GROVIA_WOO_CONSUMER_SECRET", ""), \
             patch("grovia_test_ixly_aanmelding.requests.put") as mock_put:
            ixly._bewaar_ixly_taken("42", self.ASSIGNMENTS)
            mock_put.assert_not_called()

    @patch("grovia_test_ixly_aanmelding.requests.put")
    def test_mislukking_gooit_geen_exception(self, mock_put):
        mock_put.side_effect = OSError("netwerk weg")
        with patch.object(ixly, "GROVIA_WOO_CONSUMER_KEY", "ck_test"), \
             patch.object(ixly, "GROVIA_WOO_CONSUMER_SECRET", "cs_test"):
            # Mag geen exception laten ontsnappen -- gewoon stil falen en loggen.
            ixly._bewaar_ixly_taken("42", self.ASSIGNMENTS)


class TestBewaarIxlyTakenBlokkeertFlowNiet(unittest.TestCase):
    """Een mislukte order-meta-write blokkeert de rest van main() (met name de mail) niet."""

    def _maak_request(self, body):
        import azure.functions as func
        import json
        return func.HttpRequest(
            method="POST", url="/api/ixly-aanmelding",
            body=json.dumps(body).encode(),
            headers={"Content-Type": "application/json"}, params={},
        )

    @patch("grovia_test_ixly_aanmelding.requests.put")
    @patch("grovia_test_ixly_aanmelding.grovia_mail.verstuur")
    @patch("grovia_test_ixly_aanmelding.grovia_mail.bouw_uitnodiging")
    @patch("grovia_test_ixly_aanmelding._maak_assignments_aan_met_guard")
    @patch("grovia_test_ixly_aanmelding._candidate_upsert")
    @patch("grovia_test_ixly_aanmelding._haal_user_token_op")
    def test_wc_write_fout_blokkeert_mail_niet(
        self, mock_token, mock_upsert, mock_assignments, mock_bouw, mock_verstuur, mock_put
    ):
        mock_token.return_value = "token"
        mock_upsert.return_value = ({"id": "cand-1"}, True)
        mock_assignments.return_value = [
            {"naam": "Blocks Game", "assignment_uuid": "assign-1", "login_url": "https://x"},
        ]
        mock_bouw.return_value = ("Onderwerp", "tekst", "<p>html</p>")
        mock_put.side_effect = OSError("WooCommerce onbereikbaar")

        with patch.object(ixly, "GROVIA_WOO_CONSUMER_KEY", "ck_test"), \
             patch.object(ixly, "GROVIA_WOO_CONSUMER_SECRET", "cs_test"):
            response = ixly.main(self._maak_request(_payload(order_id="42", school_code="KA")))

        self.assertEqual(response.status_code, 200)
        mock_verstuur.assert_called_once()
```

- [ ] **Step 2: Draai de tests en verifieer dat ze falen**

Run: `source venv/bin/activate && python -m pytest tests/test_ixly_aanmelding_unit.py -v -k Bewaar`
Expected: FAIL — `_bewaar_ixly_taken` bestaat niet, `GROVIA_WOO_CONSUMER_KEY` bestaat niet

- [ ] **Step 3: Implementeer `_bewaar_ixly_taken` en roep hem aan in `main`**

Voeg toe aan `ixly-aanmelding/__init__.py`, direct ná de bestaande omgevingsvariabelen
(ná `IXLY_REDIRECT_URI`, vóór `TAKEN`):

```python
GROVIA_WORDPRESS_URL       = os.environ.get("GROVIA_WORDPRESS_URL", "")
GROVIA_WOO_CONSUMER_KEY    = os.environ.get("GROVIA_WOO_CONSUMER_KEY", "")
GROVIA_WOO_CONSUMER_SECRET = os.environ.get("GROVIA_WOO_CONSUMER_SECRET", "")
```

Voeg een nieuwe functie toe, direct ná `_maak_assignments_aan_met_guard` (vóór de
`# ── Handler ──`-sectie):

```python
def _bewaar_ixly_taken(order_id: str, assignments: list) -> None:
    """
    Bewaart naam+assignment-uuid per taak als WooCommerce order-meta
    (_grovia_ixly_taken), zodat ixly-status en grovia-herinnering later de status/
    login_url kunnen opvragen via het bewezen werkende GET /assignments/{uuid} --
    in plaats van het niet-gedocumenteerde, altijd lege assignments-lijst-endpoint.

    Mag de rest van de aanroepende flow nooit blokkeren: de assignments zijn op dit
    moment al succesvol aangemaakt in Ixly en de uitnodigingsmail moet nog uit. Een
    mislukking hier wordt alleen gelogd; de rij valt dan terug op handmatige
    Ixly-controle, net als een order van vóór deze fix. Vangt daarom bewust ALLE
    fouten af (best-effort side-write), niet alleen HTTP-fouten.
    """
    if not GROVIA_WOO_CONSUMER_KEY or not GROVIA_WOO_CONSUMER_SECRET:
        logging.warning("GROVIA_WOO_CONSUMER_KEY/SECRET niet gezet -- ixly_taken niet bewaard.")
        return

    try:
        waarde = ",".join(f"{a['naam']}:{a['assignment_uuid']}" for a in assignments)
        response = requests.put(
            f"{GROVIA_WORDPRESS_URL}/wp-json/wc/v3/orders/{order_id}",
            auth=(GROVIA_WOO_CONSUMER_KEY, GROVIA_WOO_CONSUMER_SECRET),
            json={"meta_data": [{"key": "_grovia_ixly_taken", "value": waarde}]},
            timeout=15,
        )
        response.raise_for_status()
        logging.info(f"_grovia_ixly_taken bewaard voor order {order_id}.")
    except Exception as e:
        logging.error(f"Kon _grovia_ixly_taken niet bewaren voor order {order_id}: {e}")
```

Voeg in `main`, direct ná de regel `assignments = _maak_assignments_aan_met_guard(token, candidate_uuid)`,
toe:

```python
        _bewaar_ixly_taken(str(body["order_id"]), assignments)
```

- [ ] **Step 4: Draai de tests en verifieer dat ze slagen**

Run: `source venv/bin/activate && python -m pytest tests/test_ixly_aanmelding_unit.py -v`
Expected: alle tests slagen (bestaande + nieuwe)

- [ ] **Step 5: Werk `local.settings.json.example` bij**

Voeg toe direct ná `"GROVIA_WORDPRESS_URL": "https://grovia.nl",`:

```json
    "GROVIA_WOO_CONSUMER_KEY": "",
    "GROVIA_WOO_CONSUMER_SECRET": "",
```

- [ ] **Step 6: Draai de volledige suite**

Run: `source venv/bin/activate && python -m pytest tests/ -q`
Expected: 0 failed

- [ ] **Step 7: Commit**

```bash
git add ixly-aanmelding/__init__.py local.settings.json.example tests/test_ixly_aanmelding_unit.py
git commit -m "feat: ixly-aanmelding bewaart assignment-uuid's als WooCommerce order-meta"
```

---

### Task 5: `Sheet.gs` — kolom + parse/serialiseer

**Files:**
- Modify: `google-apps-script/deelnemers/Sheet.gs`
- Test: `tests/gs/sheet.test.js`

**Interfaces:**
- Consumes: niets nieuws
- Produces: `parseIxlyTaken(tekst: string) -> {naam, assignment_uuid}[]`,
  `serialiseerIxlyTaken(taken: object[]) -> string`. `KOLOMMEN` krijgt een 19e entry
  `ixly_taken`.

- [ ] **Step 1: Schrijf de falende tests**

Voeg toe aan `tests/gs/sheet.test.js`, bovenaan de import-regel bijwerken naar:

```javascript
const { _bouwSleutel, _genormaliseerdeSleutel, parseIxlyTaken, serialiseerIxlyTaken } = require('../../google-apps-script/deelnemers/Sheet.gs');
```

En onderaan het bestand toevoegen:

```javascript
test('parseIxlyTaken zet een enkele taak om naar een array met één object', () => {
  const resultaat = parseIxlyTaken('Blocks Game:39e7d2a1-abcd');
  assert.deepStrictEqual(resultaat, [{ naam: 'Blocks Game', assignment_uuid: '39e7d2a1-abcd' }]);
});

test('parseIxlyTaken zet twee taken om naar twee objecten', () => {
  const resultaat = parseIxlyTaken('Blocks Game:39e7,Rally Game:8a4f');
  assert.deepStrictEqual(resultaat, [
    { naam: 'Blocks Game', assignment_uuid: '39e7' },
    { naam: 'Rally Game', assignment_uuid: '8a4f' }
  ]);
});

test('parseIxlyTaken geeft een lege array terug bij een lege cel', () => {
  assert.deepStrictEqual(parseIxlyTaken(''), []);
  assert.deepStrictEqual(parseIxlyTaken(undefined), []);
});

test('serialiseerIxlyTaken zet een array terug om naar de celvorm', () => {
  const tekst = serialiseerIxlyTaken([
    { naam: 'Blocks Game', assignment_uuid: '39e7' },
    { naam: 'Rally Game', assignment_uuid: '8a4f' }
  ]);
  assert.strictEqual(tekst, 'Blocks Game:39e7,Rally Game:8a4f');
});

test('serialiseerIxlyTaken geeft een lege string terug bij een lege array', () => {
  assert.strictEqual(serialiseerIxlyTaken([]), '');
  assert.strictEqual(serialiseerIxlyTaken(undefined), '');
});

test('parseIxlyTaken en serialiseerIxlyTaken zijn elkaars inverse', () => {
  const origineel = 'Blocks Game:39e7,Rally Game:8a4f';
  assert.strictEqual(serialiseerIxlyTaken(parseIxlyTaken(origineel)), origineel);
});
```

- [ ] **Step 2: Draai de tests en verifieer dat ze falen**

Run: `node --test "tests/gs/*.test.js"`
Expected: FAIL — `parseIxlyTaken`/`serialiseerIxlyTaken` zijn niet gedefinieerd

- [ ] **Step 3: Werk `Sheet.gs` bij**

Vervang de `KOLOMMEN`-array door:

```javascript
const KOLOMMEN = [
  'seizoen', 'naam_slug', 'naam_kind', 'vereniging', 'ouder_naam', 'ouder_email',
  'order_ids', 'code', 'uitgenodigd_op', 'action_type_af', 'action_type_op',
  'action_type', 'ixly_af', 'ixly_op', 'reminders_verzonden',
  'laatste_reminder_op', 'laatste_poging_op', 'ixly_laatste_gecontroleerd_op',
  // Weer achteraan, zelfde reden als ixly_laatste_gecontroleerd_op hierboven: het
  // werkboek heeft de eerdere 18 kolommen al met ingevulde kopregel. Array
  // {naam, assignment_uuid} per Ixly-taak, bewaard als 'Naam:uuid,Naam:uuid' in de
  // cel. Leeg voor rijen van vóór deze fix -- die blijven permanent handmatig te
  // controleren (kiesTeControlerenIndexen in IxlyStatus.gs sluit ze uit).
  'ixly_taken'
];
```

Voeg in `leesDeelnemers`, direct ná de regel
`object.reminders_verzonden = Number(object.reminders_verzonden) || 0;`, toe:

```javascript
    object.ixly_taken = parseIxlyTaken(object.ixly_taken);
```

Voeg in `schrijfDeelnemers`, in de `KOLOMMEN.map`-callback, vóór de laatste `return waarde;`,
toe:

```javascript
      if (kolom === 'ixly_taken') {
        return serialiseerIxlyTaken(waarde);
      }
```

Voeg de twee nieuwe functies toe, direct ná `_genormaliseerdeSleutel` en vóór
`voegNieuweToe`:

```javascript
/**
 * Parseert de ixly_taken-celwaarde ('Naam:uuid,Naam:uuid') naar een array objecten.
 *
 * @param {string} tekst
 * @return {{naam: string, assignment_uuid: string}[]}
 */
function parseIxlyTaken(tekst) {
  return String(tekst || '').split(',').filter(String).map(function (paar) {
    var deel = paar.split(':');
    return { naam: deel[0], assignment_uuid: deel.slice(1).join(':') };
  });
}

/**
 * Serialiseert een array {naam, assignment_uuid} terug naar de celwaarde-vorm.
 *
 * @param {{naam: string, assignment_uuid: string}[]} taken
 * @return {string}
 */
function serialiseerIxlyTaken(taken) {
  return (taken || []).map(function (t) { return t.naam + ':' + t.assignment_uuid; }).join(',');
}
```

Werk de `module.exports`-regel onderaan bij naar:

```javascript
if (typeof module !== 'undefined') {
  module.exports = {
    _bouwSleutel: _bouwSleutel,
    _genormaliseerdeSleutel: _genormaliseerdeSleutel,
    parseIxlyTaken: parseIxlyTaken,
    serialiseerIxlyTaken: serialiseerIxlyTaken
  };
}
```

- [ ] **Step 4: Draai de tests en verifieer dat ze slagen**

Run: `node --test "tests/gs/*.test.js"`
Expected: alle tests slagen

- [ ] **Step 5: Commit**

```bash
git add google-apps-script/deelnemers/Sheet.gs tests/gs/sheet.test.js
git commit -m "feat: ixly_taken-kolom + parse/serialiseer-hulpfuncties in Sheet.gs"
```

---

### Task 6: `Woo.gs` + `Deelnemers.gs` — veld doorgeven

**Files:**
- Modify: `google-apps-script/deelnemers/Woo.gs`
- Modify: `google-apps-script/deelnemers/Deelnemers.gs`
- Test: `tests/gs/deelnemers.test.js`

**Interfaces:**
- Consumes: `parseIxlyTaken` (uit Task 5, `Sheet.gs`) — **let op:** dit is een
  cross-file-aanroep die in Apps Script werkt via de gedeelde globale scope, maar onder
  Node expliciet gezet moet worden (zie stap 1).
- Produces: genormaliseerde orders krijgen een `ixly_taken`-veld (rauwe string); nieuwe
  `Deelnemers`-rijen krijgen `ixly_taken` als array.

- [ ] **Step 1: Schrijf de falende tests**

`Deelnemers.gs` roept straks `parseIxlyTaken` aan (gedefinieerd in `Sheet.gs`) — dat werkt
in de echte Apps Script-omgeving via de gedeelde globale scope, maar `node --test` laadt
elk bestand als los CommonJS-module zonder die gedeelde scope. Zet daarom in
`tests/gs/deelnemers.test.js` de globale binding zelf, vóór het inladen van
`Deelnemers.gs`. Vervang de bestaande import-regels (regel 5-7) door:

```javascript
const test = require('node:test');
const assert = require('node:assert');
const { parseIxlyTaken } = require('../../google-apps-script/deelnemers/Sheet.gs');
global.parseIxlyTaken = parseIxlyTaken;
const { upsertDeelnemers } = require('../../google-apps-script/deelnemers/Deelnemers.gs');
```

Voeg toe aan de `order()`-fabrieksfunctie geen wijziging nodig (die geeft al willekeurige
extra velden door via `Object.assign`). Voeg onderaan het bestand toe:

```javascript
test('nieuwe order zet ixly_taken op basis van de order-meta', () => {
  const { rijen } = upsertDeelnemers([], [order({ ixly_taken: 'Blocks Game:39e7,Rally Game:8a4f' })], MAPPING);
  assert.deepStrictEqual(rijen[0].ixly_taken, [
    { naam: 'Blocks Game', assignment_uuid: '39e7' },
    { naam: 'Rally Game', assignment_uuid: '8a4f' }
  ]);
});

test('order zonder ixly_taken geeft een lege array', () => {
  const { rijen } = upsertDeelnemers([], [order()], MAPPING);
  assert.deepStrictEqual(rijen[0].ixly_taken, []);
});
```

- [ ] **Step 2: Draai de tests en verifieer dat ze falen**

Run: `node --test "tests/gs/*.test.js"`
Expected: FAIL — `parseIxlyTaken is not defined` binnen `Deelnemers.gs` (nog niet
aangeroepen) of de nieuwe testverwachtingen kloppen niet met de huidige rij-vorm

- [ ] **Step 3: Werk `Woo.gs` bij**

Vervang de functie `_normaliseer` door:

```javascript
function _normaliseer(order, producten) {
  let categorieen = [];
  (order.line_items || []).forEach(function (item) {
    const eigen = producten[String(item.product_id)] || [];
    categorieen = categorieen.concat(eigen);
  });

  const naamKindVeld = (order.meta_data || []).filter(function (m) {
    return m.key === 'Naam kind';
  })[0];

  const ixlyTakenVeld = (order.meta_data || []).filter(function (m) {
    return m.key === '_grovia_ixly_taken';
  })[0];

  return {
    order_id:    String(order.id),
    datum:       String(order.date_created || '').slice(0, 10),
    naam_kind:   naamKindVeld ? String(naamKindVeld.value).trim() : '',
    ouder_naam:  [order.billing.first_name, order.billing.last_name].filter(String).join(' '),
    ouder_email: order.billing.email || '',
    categorieen: categorieen,
    ixly_taken:  ixlyTakenVeld ? String(ixlyTakenVeld.value).trim() : ''
  };
}
```

- [ ] **Step 4: Werk `Deelnemers.gs` bij**

Voeg in `upsertDeelnemers`, in het object dat bij een nieuwe rij wordt gepusht, ná
`ixly_laatste_gecontroleerd_op: '',` toe:

```javascript
        // Array {naam, assignment_uuid} per Ixly-taak -- leeg als de order geen
        // _grovia_ixly_taken order-meta had (bijv. vóór deze fix aangemaakt).
        ixly_taken: parseIxlyTaken(order.ixly_taken)
```

- [ ] **Step 5: Draai de tests en verifieer dat ze slagen**

Run: `node --test "tests/gs/*.test.js"`
Expected: alle tests slagen

- [ ] **Step 6: Commit**

```bash
git add google-apps-script/deelnemers/Woo.gs google-apps-script/deelnemers/Deelnemers.gs tests/gs/deelnemers.test.js
git commit -m "feat: ixly_taken-order-meta doorgeven van Woo.gs naar Deelnemers.gs"
```

---

### Task 7: `IxlyStatus.gs` + `Reminders.gs` — nieuwe payload

**Files:**
- Modify: `google-apps-script/deelnemers/IxlyStatus.gs`
- Modify: `google-apps-script/deelnemers/Reminders.gs`
- Test: `tests/gs/ixlystatus.test.js`

**Interfaces:**
- Consumes: het rij-veld `ixly_taken` (array) uit Task 5/6
- Produces: `kiesTeControlerenIndexen` sluit rijen zonder `ixly_taken` uit. `_vraagStatusOp`
  stuurt het nieuwe `{"orders": [...]}`-contract. `_roepHerinneringAan`'s payload krijgt
  een `taken`-veld.

- [ ] **Step 1: Schrijf de falende test**

Werk in `tests/gs/ixlystatus.test.js` de `rij()`-fabrieksfunctie bij zodat bestaande
tests blijven werken met de nieuwe filtervoorwaarde. Vervang:

```javascript
function rij(overschrijf) {
  return Object.assign({
    naam_slug: 'freddie-rood', code: '935', ixly_af: false,
    ixly_laatste_gecontroleerd_op: ''
  }, overschrijf);
}
```

door:

```javascript
function rij(overschrijf) {
  return Object.assign({
    naam_slug: 'freddie-rood', code: '935', ixly_af: false,
    ixly_laatste_gecontroleerd_op: '',
    ixly_taken: [{ naam: 'Blocks Game', assignment_uuid: 'assign-1' }]
  }, overschrijf);
}
```

Voeg onderaan het bestand toe:

```javascript
test('rijen zonder ixly_taken worden nooit gekozen', () => {
  const rijen = [
    rij({ code: '1', ixly_taken: [], ixly_laatste_gecontroleerd_op: '' }),
    rij({ code: '2', ixly_laatste_gecontroleerd_op: '2026-07-20' })
  ];
  const indexen = kiesTeControlerenIndexen(rijen, 10);
  assert.deepStrictEqual(indexen, [1]);
});
```

- [ ] **Step 2: Draai de tests en verifieer dat ze falen**

Run: `node --test "tests/gs/*.test.js"`
Expected: FAIL op de nieuwe test — `kiesTeControlerenIndexen` filtert nog niet op
`ixly_taken`

- [ ] **Step 3: Werk `IxlyStatus.gs` bij**

Vervang de filterregel in `kiesTeControlerenIndexen`:

```javascript
    if (!rij.ixly_af && rij.code) {
```

door:

```javascript
    if (!rij.ixly_af && rij.code && rij.ixly_taken && rij.ixly_taken.length) {
```

Vervang `werkIxlyBij`'s payload-opbouw. Vervang de regels:

```javascript
  const codes = teDoen.map(function (i) { return String(kopie[i].code); });
  const resultaten = _vraagStatusOp(codes);
```

door:

```javascript
  const orders = teDoen.map(function (i) {
    return { order_id: String(kopie[i].code), taken: kopie[i].ixly_taken };
  });
  const resultaten = _vraagStatusOp(orders);
```

Vervang `_vraagStatusOp` volledig door:

```javascript
function _vraagStatusOp(orders) {
  const url = leesGeheimen().ixly_status_url;
  if (!url) {
    throw new Error('IXLY_STATUS_URL niet gezet in de Script Properties.');
  }

  const respons = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ orders: orders }),
    muteHttpExceptions: true
  });

  const code = respons.getResponseCode();
  if (code !== 200) {
    throw new Error('ixly-status gaf HTTP ' + code + ': ' + respons.getContentText().slice(0, 200));
  }

  return JSON.parse(respons.getContentText()).resultaten || {};
}
```

- [ ] **Step 4: Werk `Reminders.gs` bij**

Voeg in `verstuurReminders`, in de payload die aan `_roepHerinneringAan` wordt
meegegeven, een `taken`-veld toe. Vervang:

```javascript
      _roepHerinneringAan({
        email:       ontvanger,
        voornaam:    (rij.ouder_naam || '').split(' ')[0] || 'daar',
        naam_kind:   rij.naam_kind,
        school_code: rij.vereniging,
        code:        String(rij.code),
        open_testen: opdracht.open_testen
      });
```

door:

```javascript
      _roepHerinneringAan({
        email:       ontvanger,
        voornaam:    (rij.ouder_naam || '').split(' ')[0] || 'daar',
        naam_kind:   rij.naam_kind,
        school_code: rij.vereniging,
        code:        String(rij.code),
        open_testen: opdracht.open_testen,
        taken:       rij.ixly_taken
      });
```

`verstuurReminders`/`_roepHerinneringAan` raken `UrlFetchApp` aan en zijn (net als
`werkIxlyBij`/`_vraagStatusOp`) niet met `node --test` te toetsen — dit is een
directe, niet-geëxporteerde codewijziging. Verifieer met lezen dat `rij.ixly_taken`
(een array van `{naam, assignment_uuid}`, uit `leesDeelnemers`) hier correct wordt
doorgegeven.

- [ ] **Step 5: Draai de tests en verifieer dat ze slagen**

Run: `node --test "tests/gs/*.test.js"`
Expected: alle tests slagen

- [ ] **Step 6: Commit**

```bash
git add google-apps-script/deelnemers/IxlyStatus.gs google-apps-script/deelnemers/Reminders.gs tests/gs/ixlystatus.test.js
git commit -m "feat: IxlyStatus.gs en Reminders.gs geven ixly_taken door aan Azure"
```

---

### Task 8: Documentatie en checklist voor Max

**Files:**
- Modify: `docs/TODO.md`

**Interfaces:**
- Consumes: alles uit Task 1-7
- Produces: geen code

- [ ] **Step 1: Draai de volledige suites één laatste keer**

Run: `source venv/bin/activate && python -m pytest tests/ -q && node --test "tests/gs/*.test.js"`
Expected: 0 failed in beide

- [ ] **Step 2: Werk `docs/TODO.md` bij**

Voeg toe aan `## Next Up`, bovenaan:

```markdown
- **Ixly-afronding: nieuwe schrijfbare WooCommerce-sleutel aanmaken** `(lokaal)` — de fix voor de kapotte Ixly-statuscontrole (zie ADR + design-doc van 2026-08-01) heeft een NIEUWE, schrijfbare WooCommerce REST-sleutel nodig (los van de bestaande alleen-lezen sleutel van Apps Script). Aanmaken via WooCommerce → Instellingen → Geavanceerd → REST API (permissies: lezen/schrijven), en als Azure App Settings zetten: `GROVIA_WOO_CONSUMER_KEY`, `GROVIA_WOO_CONSUMER_SECRET`. Zonder deze sleutels wordt `_grovia_ixly_taken` niet bewaard (gelogd, geen fout) en blijft een nieuwe order net als de bestaande ~31 rijen op handmatige Ixly-controle staan.
- **Ixly-afronding einde-tot-einde verifiëren met een nieuwe order** `(lokaal)` — na het zetten van de sleutel hierboven: plaats een testorder, controleer dat `Deelnemers!ixly_taken` gevuld raakt, en (als je weet dat het kind de games al heeft afgerond) dat `dagelijkseRun` `ixly_af` op JA zet.
```

- [ ] **Step 3: Commit**

```bash
git add docs/TODO.md
git commit -m "docs: checklist voor de Ixly-afrondingsfix toegevoegd aan TODO"
```

---

## Self-review

**Spec-dekking.** Elke sectie van de spec heeft een taak: `haal_assignment` → Task 1;
`ixly-status` nieuw contract → Task 2; `grovia-herinnering` → Task 3; order-meta wegschrijven
in `ixly-aanmelding` → Task 4; de Sheet-kant (kolom, parse/serialiseer, ingest, filter,
payload) → Task 5-7; de nieuwe credential-vereiste en de handmatige verificatiestap →
Task 8. De "buiten scope"-items uit de spec (terugvulling, het dormant duplicaat-guard,
opruimen van `TAAK_NAMEN`) zijn bewust nergens een taak — geen van de taken raakt die aan.

**Cross-file afhankelijkheid.** Task 6 introduceert een nieuw patroon: `Deelnemers.gs`
roept `parseIxlyTaken` aan, een functie die in `Sheet.gs` gedefinieerd is. Dat werkt in
Apps Script's gedeelde globale scope vanzelf, maar `node --test` behandelt elk bestand
als een geïsoleerde CommonJS-module. Stap 1 van Task 6 lost dit expliciet op door de
functie in de test zelf op `global` te zetten vóór `Deelnemers.gs` geladen wordt — dit
is de eerste keer dat dit patroon in dit project nodig is (eerdere pure functies waren
allemaal zelfstandig); de reden staat als comment in de teststap zelf.

**Type-consistentie.** `haal_assignment` (Task 1) → gebruikt door `ixly-status` (Task 2)
en `grovia-herinnering` (Task 3), beide met dezelfde signatuur `(token, assignment_uuid) -> dict | None`.
`parseIxlyTaken`/`serialiseerIxlyTaken` (Task 5) → gebruikt door `Deelnemers.gs` (Task 6)
en impliciet door `Sheet.gs`'s eigen `leesDeelnemers`/`schrijfDeelnemers`. Het rijveld
`ixly_taken` is overal consistent een array van `{naam, assignment_uuid}` in-memory, en
alleen bij de Sheet-lees/schrijf-grens (`Sheet.gs`) een string. Het request-contract naar
`ixly-status` (`{"orders": [{"order_id", "taken": [{"naam", "assignment_uuid"}]}]}`) is
identiek tussen `IxlyStatus.gs` (Task 7, verzendende kant) en `ixly-status/__init__.py`
(Task 2, ontvangende kant).

**Geen placeholders.** Alle stappen bevatten volledige, kant-en-klare code — geen "voeg
foutafhandeling toe" zonder implementatie, geen verwijzingen naar niet-gedefinieerde
functies.
