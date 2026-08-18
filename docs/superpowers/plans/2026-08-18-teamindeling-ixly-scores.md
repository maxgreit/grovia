# Teamindeling op basis van Ixly-scores — Implementatieplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** De Blocks- en Rally-scores van Ixly automatisch ophalen, per deelnemer bewaren, omrekenen naar een totaalscore, en per vereniging een werkboek vullen met vier gerangschikte segmenten en een voorgestelde groepsindeling.

**Architecture:** Een nieuwe Azure Function `ixly-scores` haalt scores op bij Ixly (de enige plek met de credentials) en geeft ze plat terug met Ixly's eigen sleutels. Het Apps Script van het werkboek "Grovia Deelnemers" vertaalt die naar Nederlandse kolommen, bewaart ze in een nieuw tabblad "Ixly Scores", en rekent daar de totaalscore, ranking en groepsindeling uit. Alle rekenlogica staat in Apps Script naast `Financieel.gs`/`MiniMove.gs`, waar de node-tests al draaien.

**Tech Stack:** Python 3.11 + Azure Functions (pytest), Google Apps Script (`node --test`), Google Sheets.

**Spec:** [docs/superpowers/specs/2026-08-18-teamindeling-ixly-scores-design.md](../specs/2026-08-18-teamindeling-ixly-scores-design.md)

## Global Constraints

- **Voertaal is Nederlands** — functienamen, variabelen, commentaar, commits.
- **Nooit secrets in code of in een cel.** Ixly-credentials staan in Azure app settings; de Apps Script-kant leest endpoint-URL's uit Script Properties via `leesGeheimen()`.
- **Geen nieuwe omgevingsvariabelen.** `ixly-scores` hergebruikt de bestaande `IXLY_*`-instellingen. Komt er ooit toch een bij, dan moet die óók in de `az functionapp config appsettings set`-regel van `.github/workflows/deploy.yml` — een GitHub Secret zonder workflow-regel komt stil niet in Azure aan.
- **Fixtures op waargenomen data.** Testfixtures voor de score-respons worden gebouwd op de echt waargenomen respons van 2026-08-18 (zie spec), niet op een bedachte vorm.
- **`latent` is de score**, `raw` en `default_z` worden weggegooid.
- **Nooit per-rij WooCommerce- of Ixly-aanroepen** buiten de batch om.
- **Elke functie die de Deelnemers-sheet leest-muteert-terugschrijft draait onder de bestaande `LockService`-lock** van `dagelijkseRun`.
- **`RESULTATEN_SHEETS` in `Dagelijks.gs` zijn de Action Type-antwoordsheets**, niet de teamwerkboeken. Gebruik die constante niet en kies een andere naam.
- Testcommando's: `venv/bin/pytest tests/ -q` en `node --test tests/gs/*.test.js`.

---

### Task 1: `haal_taak_score()` en gedeelde taakverwijzing in `ixly_api.py`

**Files:**
- Modify: `grovia_shared/ixly_api.py`
- Modify: `ixly-status/__init__.py:107-117`
- Test: `tests/test_ixly_api.py` (nieuw)

**Interfaces:**
- Consumes: bestaande `TAAK_RELATIES`, `_headers()`, `IXLY_BASE_URL` uit `ixly_api`.
- Produces:
  - `ixly_api.taakverwijzing(assignment: dict) -> tuple[str | None, str | None]` — geeft `(soort, uuid)` of `(None, None)`.
  - `ixly_api.haal_taak_score(tokens, soort: str, uuid: str) -> dict` — de ruwe score-JSON, of `{}` als geen enkel token de taak ziet.

- [ ] **Step 1: Schrijf de falende tests**

Maak `tests/test_ixly_api.py`:

```python
"""
Unit tests voor de gedeelde Ixly-API-helpers.
Gebruik: pytest tests/test_ixly_api.py -v
"""
import unittest
from unittest.mock import MagicMock, patch
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from grovia_shared import ixly_api


class TestTaakverwijzing(unittest.TestCase):
    def test_candidate_task_wordt_herkend(self):
        assignment = {"relationships": {"candidate_task": {"data": {"id": "abc"}}}}
        self.assertEqual(ixly_api.taakverwijzing(assignment), ("candidate_task", "abc"))

    def test_zonder_taakrelatie_geeft_none(self):
        self.assertEqual(ixly_api.taakverwijzing({"relationships": {}}), (None, None))

    def test_lege_data_telt_niet_als_verwijzing(self):
        assignment = {"relationships": {"candidate_task": {"data": None}}}
        self.assertEqual(ixly_api.taakverwijzing(assignment), (None, None))


class TestHaalTaakScore(unittest.TestCase):
    """Een candidate_task is alleen zichtbaar voor de adviseur die de kandidaat bezit."""

    def _respons(self, status, body=None):
        respons = MagicMock()
        respons.status_code = status
        respons.json.return_value = body or {}
        return respons

    @patch("grovia_shared.ixly_api.requests.get")
    def test_eerste_token_dat_de_taak_ziet_wint(self, mock_get):
        mock_get.side_effect = [
            self._respons(404),
            self._respons(200, {"normed": {"blocks": {"planning": {"latent": 4.0}}}}),
        ]
        resultaat = ixly_api.haal_taak_score(["t1", "t2"], "candidate_task", "uuid-1")
        self.assertEqual(resultaat["normed"]["blocks"]["planning"]["latent"], 4.0)
        self.assertEqual(mock_get.call_count, 2)

    @patch("grovia_shared.ixly_api.requests.get")
    def test_geen_enkel_token_ziet_de_taak(self, mock_get):
        mock_get.side_effect = [self._respons(404), self._respons(404)]
        self.assertEqual(ixly_api.haal_taak_score(["t1", "t2"], "candidate_task", "uuid-1"), {})

    @patch("grovia_shared.ixly_api.requests.get")
    def test_enkel_token_als_string_werkt_ook(self, mock_get):
        mock_get.return_value = self._respons(200, {"games": ["blocks"]})
        self.assertEqual(ixly_api.haal_taak_score("t1", "candidate_task", "uuid-1"),
                         {"games": ["blocks"]})

    def test_onbekende_soort_geeft_leeg(self):
        self.assertEqual(ixly_api.haal_taak_score(["t1"], "onzin", "uuid-1"), {})


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Draai de tests en bevestig dat ze falen**

Run: `venv/bin/pytest tests/test_ixly_api.py -v`
Expected: FAIL met `AttributeError: module 'grovia_shared.ixly_api' has no attribute 'taakverwijzing'`

- [ ] **Step 3: Implementeer beide functies**

Voeg toe aan `grovia_shared/ixly_api.py`, direct ná `haal_assignments()`:

```python
def taakverwijzing(assignment: dict) -> tuple:
    """
    Haalt uit een assignment de verwijzing naar de onderliggende taak.

    Een assignment verwijst naar precies één van de drie soorten uit TAAK_RELATIES.

    Returns:
        (soort, uuid) of (None, None) als er geen taakrelatie in staat.
    """
    relaties = assignment.get("relationships", {})
    for soort in TAAK_RELATIES:
        verwijzing = relaties.get(soort, {}).get("data")
        if verwijzing:
            return soort, verwijzing["id"]
    return None, None


def haal_taak_score(tokens, soort: str, uuid: str) -> dict:
    """
    Haalt de scores van een afgeronde taak op.

    Args:
        tokens: één token (str) of de lijst van haal_alle_tokens(). Net als bij
            haal_taak_status() is een candidate_task alleen zichtbaar voor de adviseur
            die de kandidaat bezit -- met een ander token geeft hetzelfde uuid 404.
        soort: sleutel uit TAAK_RELATIES
        uuid: het id uit de assignment-relatie

    Returns:
        De ruwe score-JSON van Ixly, of {} als geen enkel token de taak ziet.

    LET OP: de respons is cumulatief per KANDIDAAT, niet per taak -- geverifieerd
    2026-08-18 tegen Magnus Boekel (order 1345): de Blocks-taak gaf games ["blocks"],
    de Rally-taak gaf games ["rally", "blocks"] mét beide score-nodes. De aanroeper
    moet de resultaten van alle taken samenvoegen, niet aannemen dat één aanroep alles
    heeft.
    """
    pad = TAAK_RELATIES.get(soort)
    if not pad:
        return {}

    if isinstance(tokens, str):
        tokens = [tokens]

    for token in tokens:
        response = requests.get(
            f"{IXLY_BASE_URL}/api/public/{pad}/{uuid}/score",
            headers=_headers(token),
            timeout=15,
        )
        if response.status_code == 404:
            continue
        response.raise_for_status()
        return response.json() or {}

    return {}
```

- [ ] **Step 4: Draai de tests en bevestig dat ze slagen**

Run: `venv/bin/pytest tests/test_ixly_api.py -v`
Expected: PASS (7 tests)

- [ ] **Step 5: Laat `ixly-status` de gedeelde helper gebruiken**

Vervang in `ixly-status/__init__.py` binnen `_haal_taken_voor_order()` dit blok:

```python
        relaties = assignment.get("relationships", {})
        soort, taak_uuid = None, None
        for kandidaat_soort in ixly_api.TAAK_RELATIES:
            verwijzing = relaties.get(kandidaat_soort, {}).get("data")
            if verwijzing:
                soort, taak_uuid = kandidaat_soort, verwijzing["id"]
                break
```

door:

```python
        soort, taak_uuid = ixly_api.taakverwijzing(assignment)
```

- [ ] **Step 6: Draai de volledige testsuite — de bestaande tests bewaken de refactor**

Run: `venv/bin/pytest tests/ -q`
Expected: PASS, geen enkele test faalt (was 118 passed, wordt 126)

- [ ] **Step 7: Commit**

```bash
git add grovia_shared/ixly_api.py ixly-status/__init__.py tests/test_ixly_api.py
git commit -m "feat: haal_taak_score() en gedeelde taakverwijzing in ixly_api"
```

---

### Task 2: Azure Function `ixly-scores`

**Files:**
- Create: `ixly-scores/__init__.py`
- Create: `ixly-scores/function.json`
- Test: `tests/test_ixly_scores.py`

**Interfaces:**
- Consumes: `ixly_api.haal_alle_tokens()`, `ixly_api.haal_assignment()`, `ixly_api.taakverwijzing()`, `ixly_api.haal_taak_score()` uit Task 1.
- Produces: HTTP POST-endpoint. Request `{"deelnemers": [{"order_id": str, "taken": [{"naam": str, "assignment_uuid": str}]}]}`, respons `{"resultaten": {order_id: {"blocks": {sleutel: float}, "rally": {sleutel: float}, "levels_voltooid": int|None, "levels_perfect": int|None}}}`. De schaalsleutels blijven die van Ixly (`planning`, `flexibility`, `performance`, `quality`, `reaction_time`, `consistence`, `sustained_attention`, `response_inhibition`, `response_to_mistakes`).
- Produces: `MAX_DEELNEMERS_PER_AANROEP = 100`.

- [ ] **Step 1: Schrijf de falende tests**

Maak `tests/test_ixly_scores.py`:

```python
"""
Unit tests voor de ixly-scores Azure Function.
Gebruik: pytest tests/test_ixly_scores.py -v
"""
import json
import unittest
from unittest.mock import MagicMock, patch
from conftest import laad_function_module
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

scores = laad_function_module('ixly-scores')

# Letterlijk de respons zoals waargenomen op 2026-08-18 (Magnus Boekel, order 1345),
# ingekort tot wat we gebruiken. NIET aanpassen zonder een nieuwe live verificatie.
BLOCKS_RESPONS = {
    "games": ["blocks"],
    "normed": {
        "blocks": {
            "planning":    {"raw": 95, "default_z": -0.73, "latent": 4.038200181645173},
            "flexibility": {"raw": 41.13, "default_z": 0.196, "latent": 5.89188895337087},
        }
    },
    "blocks_levels_completed": 18,
    "blocks_levels_perfect": 9,
}

RALLY_RESPONS = {
    "games": ["rally", "blocks"],
    "normed": {
        "blocks": {
            "planning":    {"raw": 95, "default_z": -0.73, "latent": 4.038200181645173},
            "flexibility": {"raw": 41.13, "default_z": 0.196, "latent": 5.89188895337087},
        },
        "rally": {
            "performance":          {"raw": 653.26, "latent": 3.5942969944965615},
            "quality":              {"raw": 75, "latent": 2.619527477686538},
            "reaction_time":        {"raw": 616.61, "latent": 3.6685994359268914},
            "consistence":          {"raw": 118.85, "latent": 2.480782690685333},
            "sustained_attention":  {"raw": 2.10, "latent": 4.776384221398225},
            "response_inhibition":  {"raw": 93.04, "latent": 4.1449029588254005},
            "response_to_mistakes": {"raw": 4.14, "latent": 6.500798165547855},
        },
    },
    "blocks_levels_completed": 18,
    "blocks_levels_perfect": 9,
}

TAKEN = [
    {"naam": "Blocks Game", "assignment_uuid": "a-blocks"},
    {"naam": "Rally Game",  "assignment_uuid": "a-rally"},
]


def _assignment(uuid):
    return {"id": uuid, "relationships": {"candidate_task": {"data": {"id": "t-" + uuid}}}}


class TestVerzamelScores(unittest.TestCase):

    @patch("grovia_shared.ixly_api.haal_taak_score")
    @patch("grovia_shared.ixly_api.haal_assignment")
    def test_beide_games_worden_samengevoegd(self, mock_assignment, mock_score):
        mock_assignment.side_effect = lambda token, uuid: _assignment(uuid)
        mock_score.side_effect = [BLOCKS_RESPONS, RALLY_RESPONS]

        resultaat = scores._verzamel_scores(["t1"], TAKEN)

        self.assertAlmostEqual(resultaat["blocks"]["planning"], 4.038200181645173)
        self.assertAlmostEqual(resultaat["rally"]["response_to_mistakes"], 6.500798165547855)
        self.assertEqual(len(resultaat["rally"]), 7)
        self.assertEqual(len(resultaat["blocks"]), 2)

    @patch("grovia_shared.ixly_api.haal_taak_score")
    @patch("grovia_shared.ixly_api.haal_assignment")
    def test_alleen_latent_wordt_doorgegeven(self, mock_assignment, mock_score):
        mock_assignment.side_effect = lambda token, uuid: _assignment(uuid)
        mock_score.side_effect = [BLOCKS_RESPONS, RALLY_RESPONS]

        resultaat = scores._verzamel_scores(["t1"], TAKEN)

        self.assertIsInstance(resultaat["blocks"]["planning"], float)
        self.assertNotIn("raw", str(resultaat["blocks"]["planning"]))

    @patch("grovia_shared.ixly_api.haal_taak_score")
    @patch("grovia_shared.ixly_api.haal_assignment")
    def test_leveltellingen_komen_mee(self, mock_assignment, mock_score):
        mock_assignment.side_effect = lambda token, uuid: _assignment(uuid)
        mock_score.side_effect = [BLOCKS_RESPONS, RALLY_RESPONS]

        resultaat = scores._verzamel_scores(["t1"], TAKEN)

        self.assertEqual(resultaat["levels_voltooid"], 18)
        self.assertEqual(resultaat["levels_perfect"], 9)

    @patch("grovia_shared.ixly_api.haal_taak_score")
    @patch("grovia_shared.ixly_api.haal_assignment")
    def test_alleen_blocks_afgerond_geeft_lege_rally(self, mock_assignment, mock_score):
        mock_assignment.side_effect = lambda token, uuid: _assignment(uuid)
        mock_score.side_effect = [BLOCKS_RESPONS]

        resultaat = scores._verzamel_scores(["t1"], TAKEN[:1])

        self.assertEqual(resultaat["rally"], {})
        self.assertEqual(len(resultaat["blocks"]), 2)

    @patch("grovia_shared.ixly_api.haal_assignment")
    def test_onvindbare_assignment_wordt_overgeslagen(self, mock_assignment):
        mock_assignment.return_value = None
        resultaat = scores._verzamel_scores(["t1"], TAKEN)
        self.assertEqual(resultaat["blocks"], {})
        self.assertEqual(resultaat["rally"], {})


class TestMain(unittest.TestCase):

    def _verzoek(self, body):
        req = MagicMock()
        req.get_json.return_value = body
        return req

    def test_ontbrekende_deelnemers_geeft_400(self):
        respons = scores.main(self._verzoek({}))
        self.assertEqual(respons.status_code, 400)

    def test_boven_de_bovengrens_geeft_400(self):
        body = {"deelnemers": [{"order_id": str(i), "taken": TAKEN} for i in range(101)]}
        respons = scores.main(self._verzoek(body))
        self.assertEqual(respons.status_code, 400)

    @patch("grovia_shared.ixly_api.haal_alle_tokens")
    @patch("grovia_shared.ixly_api.haal_taak_score")
    @patch("grovia_shared.ixly_api.haal_assignment")
    def test_resultaat_per_order_id(self, mock_assignment, mock_score, mock_tokens):
        mock_tokens.return_value = ["t1"]
        mock_assignment.side_effect = lambda token, uuid: _assignment(uuid)
        mock_score.side_effect = [BLOCKS_RESPONS, RALLY_RESPONS]

        respons = scores.main(self._verzoek({"deelnemers": [{"order_id": "1345", "taken": TAKEN}]}))

        self.assertEqual(respons.status_code, 200)
        body = json.loads(respons.get_body())
        self.assertIn("1345", body["resultaten"])
        self.assertAlmostEqual(body["resultaten"]["1345"]["blocks"]["planning"], 4.038200181645173)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Draai de tests en bevestig dat ze falen**

Run: `venv/bin/pytest tests/test_ixly_scores.py -v`
Expected: FAIL — de module `ixly-scores` bestaat nog niet

- [ ] **Step 3: Maak `ixly-scores/function.json`**

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

- [ ] **Step 4: Maak `ixly-scores/__init__.py`**

```python
"""
Azure Function: Ixly-scores opvragen.

Krijgt per deelnemer de bewaarde assignment-uuid's (uit WooCommerce order-meta
_grovia_ixly_taken, doorgegeven door het Apps Script) en geeft de genormeerde scores
van de Blocks- en Rally-games terug. Aangeroepen door het Apps Script van het werkboek
"Grovia Deelnemers", stap 8 van de dagelijkse run.

Geeft alleen 'latent' door (1-10-schaal); 'raw' en 'default_z' zijn voor deze
toepassing ruis. De sleutels blijven die van Ixly zelf -- het vertalen naar Nederlandse
kolomnamen gebeurt op één plek in Scores.gs, zodat deze function niets van de
sheetstructuur hoeft te weten.

Payload:
  {"deelnemers": [
    {"order_id": "1345", "taken": [
      {"naam": "Blocks Game", "assignment_uuid": "293dbc32-..."},
      {"naam": "Rally Game",  "assignment_uuid": "f1c7d406-..."}
    ]}
  ]}

Respons:
  {"resultaten": {
     "1345": {"blocks": {"planning": 4.04, "flexibility": 5.89},
              "rally":  {"performance": 3.59, ...},
              "levels_voltooid": 18, "levels_perfect": 9}
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

# Bovengrens per aanroep, zodat één verzoek de function niet laat aflopen. Zelfde
# waarde als MAX_ORDERS_PER_AANROEP in ixly-status.
MAX_DEELNEMERS_PER_AANROEP = 100

# De games waarvan we scores bewaren. Ixly's respons is cumulatief per kandidaat en kan
# in de toekomst meer games bevatten; wat hier niet in staat wordt genegeerd.
GAMES = ("blocks", "rally")


def _plat(genormeerd: dict) -> dict:
    """
    Reduceert {'planning': {'raw':.., 'default_z':.., 'latent':..}} tot
    {'planning': <latent>}. Schalen zonder latent-waarde vallen af.
    """
    resultaat = {}
    for sleutel, waarden in (genormeerd or {}).items():
        if isinstance(waarden, dict) and waarden.get("latent") is not None:
            resultaat[sleutel] = waarden["latent"]
    return resultaat


def _verzamel_scores(tokens, taken_refs: list) -> dict:
    """
    Vraagt per bewaarde assignment-uuid de scores op en voegt ze samen.

    Samenvoegen is nodig omdat de score-respons cumulatief per KANDIDAAT is en niet per
    taak: geverifieerd 2026-08-18 gaf de Blocks-taak alleen de blocks-node, terwijl de
    Rally-taak zowel rally als blocks teruggaf. Wie alleen de laatste taak uitleest,
    mist scores van een kandidaat die maar één game heeft afgerond.

    Returns:
        {'blocks': {sleutel: float}, 'rally': {...},
         'levels_voltooid': int|None, 'levels_perfect': int|None}
    """
    if isinstance(tokens, str):
        tokens = [tokens]

    resultaat = {game: {} for game in GAMES}
    resultaat["levels_voltooid"] = None
    resultaat["levels_perfect"] = None

    for ref in taken_refs:
        assignment = ixly_api.haal_assignment(tokens[0], ref.get("assignment_uuid", ""))
        if not assignment:
            continue

        soort, taak_uuid = ixly_api.taakverwijzing(assignment)
        if not soort:
            continue

        score = ixly_api.haal_taak_score(tokens, soort, taak_uuid)
        genormeerd = score.get("normed", {})
        for game in GAMES:
            if genormeerd.get(game):
                resultaat[game].update(_plat(genormeerd[game]))

        if score.get("blocks_levels_completed") is not None:
            resultaat["levels_voltooid"] = score["blocks_levels_completed"]
        if score.get("blocks_levels_perfect") is not None:
            resultaat["levels_perfect"] = score["blocks_levels_perfect"]

    return resultaat


def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("Ixly Scores gestart.")

    try:
        body = req.get_json()
    except ValueError:
        return func.HttpResponse("Ongeldige JSON in request body.", status_code=400)

    deelnemers = body.get("deelnemers")
    if not deelnemers or not isinstance(deelnemers, list):
        return func.HttpResponse(
            json.dumps({"fout": "deelnemers ontbreekt of is geen lijst."}),
            mimetype="application/json",
            status_code=400,
        )

    if len(deelnemers) > MAX_DEELNEMERS_PER_AANROEP:
        return func.HttpResponse(
            json.dumps({"fout": f"Maximaal {MAX_DEELNEMERS_PER_AANROEP} deelnemers per aanroep."}),
            mimetype="application/json",
            status_code=400,
        )

    try:
        tokens = ixly_api.haal_alle_tokens()
    except requests.HTTPError as e:
        logging.error(f"Ixly token fout: {e.response.status_code} — {e.response.text}")
        return func.HttpResponse(
            json.dumps({"fout": "Kon geen Ixly-token ophalen."}),
            mimetype="application/json",
            status_code=502,
        )

    resultaten = {}
    for deelnemer in deelnemers:
        order_id = str(deelnemer.get("order_id", ""))
        taken_refs = deelnemer.get("taken", [])
        if not order_id or not taken_refs:
            continue
        try:
            resultaten[order_id] = _verzamel_scores(tokens, taken_refs)
        except requests.HTTPError as e:
            # Eén stukke deelnemer blokkeert de rest niet.
            logging.error(f"Order {order_id}: Ixly-fout {e.response.status_code}")
            resultaten[order_id] = {"fout": f"Ixly-fout {e.response.status_code}"}

    logging.info(f"Scores opgehaald voor {len(resultaten)} deelnemers.")
    return func.HttpResponse(
        json.dumps({"resultaten": resultaten}),
        mimetype="application/json",
        status_code=200,
    )
```

- [ ] **Step 5: Draai de tests en bevestig dat ze slagen**

Run: `venv/bin/pytest tests/test_ixly_scores.py -v`
Expected: PASS (8 tests)

- [ ] **Step 6: Bevestig dat de host de nieuwe function registreert**

Run: `func start`
Expected: in de lijst staat nu ook `ixly-scores: [POST] http://localhost:7071/api/ixly-scores`. Daarna afbreken met Ctrl-C.

- [ ] **Step 7: Commit**

```bash
git add ixly-scores/ tests/test_ixly_scores.py
git commit -m "feat: ixly-scores function haalt Blocks- en Rally-scores op"
```

---

### Task 3: `Scores.gs` — vertaling en selectie (pure logica)

**Files:**
- Create: `google-apps-script/deelnemers/Scores.gs`
- Test: `tests/gs/scores.test.js`

**Interfaces:**
- Consumes: de respons van `ixly-scores` uit Task 2 (Ixly-sleutels).
- Produces:
  - `VELD_VERTALING` — object `{blocks: {ixlySleutel: kolomnaam}, rally: {...}}`.
  - `naarScoreRij(naamSlug: string, naamKind: string, apiResultaat: object, vandaag: string) -> object` — één rij voor het tabblad "Ixly Scores", met `bron: 'api'`.
  - `kiesTeOphalenIndexen(deelnemersRijen: object[], scoreRijen: object[], batchGrootte: number) -> number[]`.

- [ ] **Step 1: Schrijf de falende tests**

Maak `tests/gs/scores.test.js`:

```javascript
/**
 * Tests voor de pure Scores-logica (vertaling en selectie).
 * Gebruik: node --test tests/gs/
 */
const test = require('node:test');
const assert = require('node:assert');
const { VELD_VERTALING, naarScoreRij, kiesTeOphalenIndexen } =
  require('../../google-apps-script/deelnemers/Scores.gs');

// Zoals ixly-scores het teruggeeft (Ixly-sleutels, alleen latent).
const API_RESULTAAT = {
  blocks: { planning: 4.038200181645173, flexibility: 5.89188895337087 },
  rally: {
    performance: 3.5942969944965615,
    quality: 2.619527477686538,
    reaction_time: 3.6685994359268914,
    consistence: 2.480782690685333,
    sustained_attention: 4.776384221398225,
    response_inhibition: 4.1449029588254005,
    response_to_mistakes: 6.500798165547855
  },
  levels_voltooid: 18,
  levels_perfect: 9
};

test('naarScoreRij vertaalt alle negen schalen naar kolomnamen', function () {
  const rij = naarScoreRij('magnus-boekel', 'Magnus Boekel', API_RESULTAAT, '2026-08-18');

  assert.strictEqual(rij.blocks_planning, 4.038200181645173);
  assert.strictEqual(rij.blocks_flexibiliteit, 5.89188895337087);
  assert.strictEqual(rij.rally_prestatie, 3.5942969944965615);
  assert.strictEqual(rij.rally_kwaliteit, 2.619527477686538);
  assert.strictEqual(rij.rally_reactiesnelheid, 3.6685994359268914);
  assert.strictEqual(rij.rally_consistentie, 2.480782690685333);
  assert.strictEqual(rij.rally_volgehouden_aandacht, 4.776384221398225);
  assert.strictEqual(rij.rally_respons_inhibitie, 4.1449029588254005);
  assert.strictEqual(rij.rally_reactie_op_fouten, 6.500798165547855);
});

test('naarScoreRij neemt sleutel, naam, levels, bron en datum mee', function () {
  const rij = naarScoreRij('magnus-boekel', 'Magnus Boekel', API_RESULTAAT, '2026-08-18');

  assert.strictEqual(rij.naam_slug, 'magnus-boekel');
  assert.strictEqual(rij.naam_kind, 'Magnus Boekel');
  assert.strictEqual(rij.levels_voltooid, 18);
  assert.strictEqual(rij.levels_perfect, 9);
  assert.strictEqual(rij.bron, 'api');
  assert.strictEqual(rij.opgehaald_op, '2026-08-18');
});

test('naarScoreRij laat ontbrekende schalen leeg in plaats van nul', function () {
  const alleenBlocks = { blocks: { planning: 4 }, rally: {}, levels_voltooid: 18, levels_perfect: 9 };
  const rij = naarScoreRij('x', 'X', alleenBlocks, '2026-08-18');

  assert.strictEqual(rij.blocks_planning, 4);
  assert.strictEqual(rij.blocks_flexibiliteit, '');
  assert.strictEqual(rij.rally_prestatie, '');
});

test('naarScoreRij negeert onbekende Ixly-sleutels', function () {
  const metOnbekende = { blocks: { planning: 4, nieuwe_schaal: 9 }, rally: {} };
  const rij = naarScoreRij('x', 'X', metOnbekende, '2026-08-18');

  assert.strictEqual(rij.nieuwe_schaal, undefined);
  assert.strictEqual(rij.blocks_planning, 4);
});

test('kiesTeOphalenIndexen kiest alleen afgeronde rijen met taken en zonder score', function () {
  const rijen = [
    { naam_slug: 'a', ixly_af: true,  ixly_taken: [{ naam: 'Blocks Game', assignment_uuid: 'u1' }] },
    { naam_slug: 'b', ixly_af: false, ixly_taken: [{ naam: 'Blocks Game', assignment_uuid: 'u2' }] },
    { naam_slug: 'c', ixly_af: true,  ixly_taken: [] },
    { naam_slug: 'd', ixly_af: true,  ixly_taken: [{ naam: 'Blocks Game', assignment_uuid: 'u4' }] }
  ];
  const scores = [{ naam_slug: 'd' }];

  assert.deepStrictEqual(kiesTeOphalenIndexen(rijen, scores, 50), [0]);
});

test('kiesTeOphalenIndexen kapt af op de batchgrootte', function () {
  const rijen = [0, 1, 2, 3, 4].map(function (i) {
    return { naam_slug: 's' + i, ixly_af: true, ixly_taken: [{ naam: 'Blocks Game', assignment_uuid: 'u' }] };
  });

  assert.deepStrictEqual(kiesTeOphalenIndexen(rijen, [], 3), [0, 1, 2]);
});

test('kiesTeOphalenIndexen slaat rijen met een handmatige score over', function () {
  const rijen = [
    { naam_slug: 'a', ixly_af: true, ixly_taken: [{ naam: 'Blocks Game', assignment_uuid: 'u1' }] }
  ];
  const scores = [{ naam_slug: 'a', bron: 'handmatig' }];

  assert.deepStrictEqual(kiesTeOphalenIndexen(rijen, scores, 50), []);
});
```

- [ ] **Step 2: Draai de tests en bevestig dat ze falen**

Run: `node --test tests/gs/scores.test.js`
Expected: FAIL — `Cannot find module '.../Scores.gs'`

- [ ] **Step 3: Maak `google-apps-script/deelnemers/Scores.gs`**

```javascript
/**
 * Haalt de Ixly-scores op via de ixly-scores Azure Function en vertaalt ze naar de
 * kolommen van het tabblad "Ixly Scores".
 *
 * De Sheet praat niet zelf met Ixly: die credentials horen in Azure, niet in een
 * deelbaar werkboek.
 */

/**
 * Ixly's eigen sleutels -> onze kolomnamen.
 *
 * HERKOMST: live geverifieerd op 2026-08-18 tegen candidate_tasks/{uuid}/score van
 * Magnus Boekel (order 1345, beide games 'finished'). Blocks levert precies twee
 * genormeerde schalen, Rally zeven. Voeg hier NOOIT een sleutel toe op basis van een
 * aanname -- het swagger-voorbeeld bij dit endpoint gaat over heel andere assessments
 * (ITS/WPV) en zegt niets over de games. Zie ADR-013 en de 'completed'-bug: een
 * onbevestigde API-waarde is geen feit.
 */
const VELD_VERTALING = {
  blocks: {
    planning:    'blocks_planning',
    flexibility: 'blocks_flexibiliteit'
  },
  rally: {
    performance:          'rally_prestatie',
    quality:              'rally_kwaliteit',
    reaction_time:        'rally_reactiesnelheid',
    consistence:          'rally_consistentie',
    sustained_attention:  'rally_volgehouden_aandacht',
    response_inhibition:  'rally_respons_inhibitie',
    response_to_mistakes: 'rally_reactie_op_fouten'
  }
};

/**
 * Zet één API-resultaat om in een rij voor "Ixly Scores".
 *
 * Ontbrekende schalen blijven leeg ('') en worden GEEN 0 -- een kind dat een game niet
 * gedaan heeft moet te onderscheiden zijn van een kind dat er nul scoorde.
 *
 * @param {string} naamSlug
 * @param {string} naamKind
 * @param {Object} apiResultaat zoals ixly-scores het teruggeeft
 * @param {string} vandaag 'YYYY-MM-DD'
 * @return {Object} rij met de kolommen uit IXLY_SCORES_KOLOMMEN
 */
function naarScoreRij(naamSlug, naamKind, apiResultaat, vandaag) {
  const rij = { naam_slug: naamSlug, naam_kind: naamKind };

  Object.keys(VELD_VERTALING).forEach(function (game) {
    const scores = (apiResultaat && apiResultaat[game]) || {};
    Object.keys(VELD_VERTALING[game]).forEach(function (ixlySleutel) {
      const kolom = VELD_VERTALING[game][ixlySleutel];
      const waarde = scores[ixlySleutel];
      rij[kolom] = (waarde === undefined || waarde === null) ? '' : waarde;
    });
  });

  rij.levels_voltooid = _ofLeeg(apiResultaat && apiResultaat.levels_voltooid);
  rij.levels_perfect  = _ofLeeg(apiResultaat && apiResultaat.levels_perfect);
  rij.bron            = 'api';
  rij.opgehaald_op    = vandaag;

  return rij;
}

/**
 * Kiest welke deelnemersrijen deze run bij Ixly opgehaald worden: Ixly afgerond, met
 * bewaarde assignment-uuid's, en nog zonder rij in "Ixly Scores".
 *
 * Een kind met een score wordt NIET opnieuw bevraagd -- scores veranderen niet en dat
 * scheelt honderden aanroepen per week. Handmatig ingevoerde rijen tellen ook als
 * 'heeft al een score' en blijven dus met rust.
 *
 * @param {Object[]} deelnemersRijen
 * @param {Object[]} scoreRijen bestaande rijen uit "Ixly Scores"
 * @param {number} batchGrootte
 * @return {number[]} indexen in deelnemersRijen, afgekapt op batchGrootte
 */
function kiesTeOphalenIndexen(deelnemersRijen, scoreRijen, batchGrootte) {
  const alBekend = {};
  (scoreRijen || []).forEach(function (rij) {
    alBekend[String(rij.naam_slug)] = true;
  });

  const indexen = [];
  deelnemersRijen.forEach(function (rij, i) {
    if (!rij.ixly_af) {
      return;
    }
    if (!rij.ixly_taken || !rij.ixly_taken.length) {
      return;
    }
    if (alBekend[String(rij.naam_slug)]) {
      return;
    }
    indexen.push(i);
  });

  return indexen.slice(0, batchGrootte);
}

function _ofLeeg(waarde) {
  return (waarde === undefined || waarde === null) ? '' : waarde;
}

// Alleen voor `node --test`; Apps Script kent `module` niet en slaat dit over.
if (typeof module !== 'undefined') {
  module.exports = {
    VELD_VERTALING: VELD_VERTALING,
    naarScoreRij: naarScoreRij,
    kiesTeOphalenIndexen: kiesTeOphalenIndexen
  };
}
```

- [ ] **Step 4: Draai de tests en bevestig dat ze slagen**

Run: `node --test tests/gs/scores.test.js`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add google-apps-script/deelnemers/Scores.gs tests/gs/scores.test.js
git commit -m "feat: Scores.gs vertaalt Ixly-sleutels en kiest op te halen rijen"
```

---

### Task 4: Tabblad "Ixly Scores" in `Sheet.gs`

**Files:**
- Modify: `google-apps-script/deelnemers/Sheet.gs` (na `schrijfMiniMoveDeelnemers`, vóór `voegToe`)
- Test: `tests/gs/sheet.test.js` (uitbreiden)

**Interfaces:**
- Consumes: `_tab()`, `_alsDatumTekst()` uit `Sheet.gs`; rijvorm uit `naarScoreRij()` (Task 3).
- Produces:
  - `IXLY_SCORES_KOLOMMEN` — array van 15 kolomnamen.
  - `leesIxlyScores() -> object[]`
  - `schrijfIxlyScores(rijen: object[])`
  - `voegScoresSamen(bestaand: object[], nieuw: object[]) -> object[]` — pure functie, testbaar.

- [ ] **Step 1: Schrijf de falende tests**

Voeg toe aan `tests/gs/sheet.test.js` (bovenaan de bestaande require uitbreiden met `voegScoresSamen` en `IXLY_SCORES_KOLOMMEN`):

```javascript
const { voegScoresSamen, IXLY_SCORES_KOLOMMEN } =
  require('../../google-apps-script/deelnemers/Sheet.gs');

test('IXLY_SCORES_KOLOMMEN heeft precies de vijftien afgesproken kolommen', function () {
  assert.deepStrictEqual(IXLY_SCORES_KOLOMMEN, [
    'naam_slug', 'naam_kind',
    'blocks_planning', 'blocks_flexibiliteit',
    'rally_prestatie', 'rally_kwaliteit', 'rally_reactiesnelheid', 'rally_consistentie',
    'rally_volgehouden_aandacht', 'rally_respons_inhibitie', 'rally_reactie_op_fouten',
    'levels_voltooid', 'levels_perfect',
    'bron', 'opgehaald_op'
  ]);
});

test('voegScoresSamen voegt een nieuwe deelnemer toe', function () {
  const samengevoegd = voegScoresSamen([], [{ naam_slug: 'a', blocks_planning: 4, bron: 'api' }]);

  assert.strictEqual(samengevoegd.length, 1);
  assert.strictEqual(samengevoegd[0].naam_slug, 'a');
});

test('voegScoresSamen laat een handmatige rij volledig met rust', function () {
  const bestaand = [{ naam_slug: 'a', blocks_planning: 7, bron: 'handmatig', opgehaald_op: '' }];
  const nieuw    = [{ naam_slug: 'a', blocks_planning: 4, bron: 'api', opgehaald_op: '2026-08-18' }];

  const samengevoegd = voegScoresSamen(bestaand, nieuw);

  assert.strictEqual(samengevoegd[0].blocks_planning, 7);
  assert.strictEqual(samengevoegd[0].bron, 'handmatig');
});

test('voegScoresSamen vult alleen lege cellen van een bestaande api-rij aan', function () {
  const bestaand = [{ naam_slug: 'a', blocks_planning: 4, blocks_flexibiliteit: '', bron: 'api' }];
  const nieuw    = [{ naam_slug: 'a', blocks_planning: 9, blocks_flexibiliteit: 6, bron: 'api' }];

  const samengevoegd = voegScoresSamen(bestaand, nieuw);

  assert.strictEqual(samengevoegd[0].blocks_planning, 4, 'bestaande waarde blijft staan');
  assert.strictEqual(samengevoegd[0].blocks_flexibiliteit, 6, 'lege waarde wordt aangevuld');
});

test('voegScoresSamen bewaart de volgorde en raakt andere rijen niet aan', function () {
  const bestaand = [{ naam_slug: 'a', blocks_planning: 1 }, { naam_slug: 'b', blocks_planning: 2 }];
  const nieuw    = [{ naam_slug: 'b', blocks_flexibiliteit: 5 }];

  const samengevoegd = voegScoresSamen(bestaand, nieuw);

  assert.strictEqual(samengevoegd[0].naam_slug, 'a');
  assert.strictEqual(samengevoegd[1].blocks_flexibiliteit, 5);
});
```

- [ ] **Step 2: Draai de tests en bevestig dat ze falen**

Run: `node --test tests/gs/sheet.test.js`
Expected: FAIL — `voegScoresSamen is not a function`

- [ ] **Step 3: Implementeer in `Sheet.gs`**

Voeg toe ná `schrijfMiniMoveDeelnemers()`:

```javascript
/**
 * Kolommen van het tabblad "Ixly Scores". Deze volgorde moet exact overeenkomen met de
 * fysieke kolomvolgorde in het werkboek -- kolommen invoegen doe je in de Sheet-UI,
 * niet los aan het eind toevoegen. Een mismatch schuift stil verkeerde data door
 * elkaar.
 */
const IXLY_SCORES_KOLOMMEN = [
  'naam_slug', 'naam_kind',
  'blocks_planning', 'blocks_flexibiliteit',
  'rally_prestatie', 'rally_kwaliteit', 'rally_reactiesnelheid', 'rally_consistentie',
  'rally_volgehouden_aandacht', 'rally_respons_inhibitie', 'rally_reactie_op_fouten',
  'levels_voltooid', 'levels_perfect',
  'bron', 'opgehaald_op'
];

/**
 * @return {Object[]} alle rijen uit "Ixly Scores" als platte objecten
 */
function leesIxlyScores() {
  const tab = _tab('Ixly Scores');
  const laatste = tab.getLastRow();
  if (laatste < 2) {
    return [];
  }

  return tab.getRange(2, 1, laatste - 1, IXLY_SCORES_KOLOMMEN.length).getValues().map(function (rij) {
    const object = {};
    IXLY_SCORES_KOLOMMEN.forEach(function (kolom, i) {
      object[kolom] = rij[i];
    });
    object.naam_slug    = String(object.naam_slug || '');
    object.bron         = String(object.bron || '');
    object.opgehaald_op = _alsDatumTekst(object.opgehaald_op);
    return object;
  });
}

/**
 * Schrijft "Ixly Scores" volledig opnieuw weg.
 *
 * @param {Object[]} rijen
 */
function schrijfIxlyScores(rijen) {
  const tab = _tab('Ixly Scores');

  if (tab.getLastRow() > 1) {
    tab.getRange(2, 1, tab.getLastRow() - 1, IXLY_SCORES_KOLOMMEN.length).clearContent();
  }
  if (!rijen.length) {
    return;
  }

  const waarden = rijen.map(function (rij) {
    return IXLY_SCORES_KOLOMMEN.map(function (kolom) {
      const waarde = rij[kolom];
      return (waarde === undefined || waarde === null) ? '' : waarde;
    });
  });

  tab.getRange(2, 1, waarden.length, IXLY_SCORES_KOLOMMEN.length).setValues(waarden);
}

/**
 * Voegt nieuw opgehaalde scores samen met wat er al staat.
 *
 * Twee regels, allebei bewust:
 *   1. bron === 'handmatig' -> rij blijft volledig ongemoeid. De bestaande deelnemers
 *      hebben geen bewaarde assignment-uuid's (die worden pas sinds 2026-08-01
 *      opgeslagen) en zijn met de hand ingevoerd; die invoer mag nooit overschreven
 *      worden, ook niet als er later alsnog een uuid opduikt.
 *   2. Anders: vul-als-leeg. Een bestaande waarde blijft staan, een lege cel wordt
 *      aangevuld. Zelfde patroon als bij geboortedatum/club/team.
 *
 * @param {Object[]} bestaand rijen uit leesIxlyScores()
 * @param {Object[]} nieuw rijen uit naarScoreRij()
 * @return {Object[]} samengevoegde rijen, bestaande volgorde eerst
 */
function voegScoresSamen(bestaand, nieuw) {
  const resultaat = (bestaand || []).map(function (rij) { return Object.assign({}, rij); });
  const index = {};
  resultaat.forEach(function (rij, i) {
    index[String(rij.naam_slug)] = i;
  });

  (nieuw || []).forEach(function (nieuweRij) {
    const sleutel = String(nieuweRij.naam_slug);
    if (!(sleutel in index)) {
      resultaat.push(Object.assign({}, nieuweRij));
      index[sleutel] = resultaat.length - 1;
      return;
    }

    const doel = resultaat[index[sleutel]];
    if (String(doel.bron) === 'handmatig') {
      return;
    }

    Object.keys(nieuweRij).forEach(function (kolom) {
      const huidig = doel[kolom];
      if (huidig === '' || huidig === undefined || huidig === null) {
        doel[kolom] = nieuweRij[kolom];
      }
    });
  });

  return resultaat;
}
```

Voeg `IXLY_SCORES_KOLOMMEN` en `voegScoresSamen` toe aan het bestaande `module.exports`-blok onderaan `Sheet.gs`.

- [ ] **Step 4: Draai de tests en bevestig dat ze slagen**

Run: `node --test tests/gs/*.test.js`
Expected: PASS, alle bestaande tests blijven groen

- [ ] **Step 5: Commit**

```bash
git add google-apps-script/deelnemers/Sheet.gs tests/gs/sheet.test.js
git commit -m "feat: tabblad Ixly Scores met vul-als-leeg en bescherming van handmatige invoer"
```

---

### Task 5: Config-uitbreidingen

**Files:**
- Modify: `google-apps-script/deelnemers/Config.gs`
- Test: `tests/gs/config.test.js` (nieuw)

**Interfaces:**
- Produces, als nieuwe velden op het object uit `leesConfig()`:
  - `score_wegingen` — `{kolomnaam: number}`, gelezen uit `Y2:Z30`
  - `geboortejaargrens` — `{Speler: number, Keeper: number}`, gelezen uit `AB2:AC5`
  - `groepsnamen` — `string[]`, van sterk naar zwak, gelezen uit `AE2:AE10`
  - `groepen_per_segment` — `{'KA|jong|Speler': number, ...}`, gelezen uit `AG2:AJ30`
  - `teamindeling_werkboeken` — `{KA: id, SU: id}`, gelezen uit `AL2:AM5`
- Produces, op `leesGeheimen()`: `ixly_scores_url`
- Produces: `_leesSegmentGroepen(tab, bereik) -> object` en `_leesGetalPaar(tab, bereik) -> object`

- [ ] **Step 1: Schrijf de falende tests**

Maak `tests/gs/config.test.js`:

```javascript
/**
 * Tests voor de pure Config-parsers.
 * Gebruik: node --test tests/gs/
 */
const test = require('node:test');
const assert = require('node:assert');
const { _leesSegmentGroepen, _leesGetalPaar } =
  require('../../google-apps-script/deelnemers/Config.gs');

function tabMet(waarden) {
  return { getRange: function () { return { getValues: function () { return waarden; } }; } };
}

test('_leesGetalPaar leest sleutel-getalparen en slaat lege rijen over', function () {
  const tab = tabMet([['Speler', 2014], ['Keeper', 2013], ['', ''], ['Onzin', '']]);

  assert.deepStrictEqual(_leesGetalPaar(tab, 'AB2:AC5'), { Speler: 2014, Keeper: 2013 });
});

test('_leesGetalPaar maakt van tekstgetallen echte getallen', function () {
  const tab = tabMet([['Speler', '2014']]);

  assert.strictEqual(_leesGetalPaar(tab, 'AB2:AC5').Speler, 2014);
});

test('_leesSegmentGroepen bouwt een sleutel van vereniging, leeftijd en rol', function () {
  const tab = tabMet([
    ['KA', 'jong', 'Speler', 3],
    ['KA', 'oud', 'Keeper', 2],
    ['', '', '', '']
  ]);

  assert.deepStrictEqual(_leesSegmentGroepen(tab, 'AG2:AJ30'), {
    'KA|jong|Speler': 3,
    'KA|oud|Keeper': 2
  });
});

test('_leesSegmentGroepen slaat een rij zonder aantal over', function () {
  const tab = tabMet([['KA', 'jong', 'Speler', ''], ['SU', 'jong', 'Speler', 2]]);

  assert.deepStrictEqual(_leesSegmentGroepen(tab, 'AG2:AJ30'), { 'SU|jong|Speler': 2 });
});
```

- [ ] **Step 2: Draai de tests en bevestig dat ze falen**

Run: `node --test tests/gs/config.test.js`
Expected: FAIL — `_leesSegmentGroepen is not a function`

- [ ] **Step 3: Breid `Config.gs` uit**

Voeg toe binnen het `return`-object van `leesConfig()`, ná `minimove_kalender`:

```javascript
    // Gewicht per scorekolom uit "Ixly Scores" (Y:Z). Standaard is 1 voor de negen
    // genormeerde schalen en 0 voor de twee leveltellingen -- die staan op een heel
    // andere schaal (aantallen, geen 1-10) en zouden een gemiddelde vertekenen.
    // VOORLOPIG: gelijk gewicht is een plaatshouder tot Ruben's formule vastligt.
    score_wegingen: _leesGetalPaar(tab, 'Y2:Z30'),
    // Het geboortejaar vanaf waar een kind bij 'jong' hoort, apart per rol -- de grens
    // ligt bij keepers anders dan bij spelers (AB:AC).
    geboortejaargrens: _leesGetalPaar(tab, 'AB2:AC5'),
    // Groepsnamen van STERK naar ZWAK (AE). In de handmatige sheet van Berry lijkt C3
    // de sterkste groep en C1 de zwakste -- omgekeerd aan wat de nummering suggereert.
    // Daarom staat de volgorde hier en niet in code: het is hun keuze, geen aanname.
    groepsnamen: _leesKolom(tab, 'AE2:AE10'),
    // Aantal groepen per segment: vereniging, leeftijd, rol, aantal (AG:AJ).
    groepen_per_segment: _leesSegmentGroepen(tab, 'AG2:AJ30'),
    // Werkboek-ID per vereniging voor de teamindeling (AL:AM). NIET te verwarren met
    // RESULTATEN_SHEETS in Dagelijks.gs -- dat zijn de Action Type-antwoordsheets.
    teamindeling_werkboeken: _leesPaar(tab, 'AL2:AM5')
```

Voeg toe aan `leesGeheimen()`:

```javascript
    ixly_scores_url:    props.getProperty('IXLY_SCORES_URL') || '',
```

Voeg de twee nieuwe helpers toe naast `_leesPaar`:

```javascript
/**
 * Leest sleutel-getalparen: kolom 1 is de sleutel, kolom 2 het getal.
 *
 * @param {Sheet} tab
 * @param {string} bereik
 * @return {Object} sleutel -> number
 */
function _leesGetalPaar(tab, bereik) {
  const resultaat = {};
  tab.getRange(bereik).getValues().forEach(function (rij) {
    const sleutel = String(rij[0] || '').trim();
    if (sleutel === '' || rij[1] === '' || rij[1] === null) {
      return;
    }
    resultaat[sleutel] = Number(rij[1]);
  });
  return resultaat;
}

/**
 * Leest het aantal groepen per segment: vereniging, leeftijd, rol, aantal.
 *
 * @param {Sheet} tab
 * @param {string} bereik
 * @return {Object} 'KA|jong|Speler' -> number
 */
function _leesSegmentGroepen(tab, bereik) {
  const resultaat = {};
  tab.getRange(bereik).getValues().forEach(function (rij) {
    const vereniging = String(rij[0] || '').trim();
    const leeftijd   = String(rij[1] || '').trim();
    const rol        = String(rij[2] || '').trim();
    if (!vereniging || !leeftijd || !rol || rij[3] === '' || rij[3] === null) {
      return;
    }
    resultaat[vereniging + '|' + leeftijd + '|' + rol] = Number(rij[3]);
  });
  return resultaat;
}
```

Voeg onderaan `Config.gs` het exportblok toe (bestaat daar nog niet):

```javascript
// Alleen voor `node --test`; Apps Script kent `module` niet en slaat dit over.
if (typeof module !== 'undefined') {
  module.exports = {
    _leesGetalPaar: _leesGetalPaar,
    _leesSegmentGroepen: _leesSegmentGroepen
  };
}
```

- [ ] **Step 4: Draai de tests en bevestig dat ze slagen**

Run: `node --test tests/gs/*.test.js`
Expected: PASS, alle bestaande tests blijven groen

- [ ] **Step 5: Commit**

```bash
git add google-apps-script/deelnemers/Config.gs tests/gs/config.test.js
git commit -m "feat: Config-blokken voor wegingen, leeftijdsgrens, groepen en werkboeken"
```

---

### Task 6: `Teams.gs` — leeftijdsgroep en totaalscore

**Files:**
- Create: `google-apps-script/deelnemers/Teams.gs`
- Test: `tests/gs/teams.test.js`

**Interfaces:**
- Consumes: `config.geboortejaargrens` en `config.score_wegingen` (Task 5); rijvorm uit "Ixly Scores" (Task 4).
- Produces:
  - `SCORE_KOLOMMEN` — array van de negen genormeerde kolomnamen.
  - `bepaalLeeftijdsgroep(geboortedatum, rol, grenzen) -> 'jong' | 'oud' | ''`
  - `berekenTotaalscore(scoreRij, wegingen) -> number | null`

- [ ] **Step 1: Schrijf de falende tests**

Maak `tests/gs/teams.test.js`:

```javascript
/**
 * Tests voor de pure teamindelingslogica.
 * Gebruik: node --test tests/gs/
 */
const test = require('node:test');
const assert = require('node:assert');
const { SCORE_KOLOMMEN, bepaalLeeftijdsgroep, berekenTotaalscore } =
  require('../../google-apps-script/deelnemers/Teams.gs');

const GRENZEN = { Speler: 2014, Keeper: 2013 };

// Alle negen schalen met gewicht 1 -- de standaardconfiguratie.
const WEGINGEN = {};
SCORE_KOLOMMEN.forEach(function (kolom) { WEGINGEN[kolom] = 1; });

function scoreRij(overschrijf) {
  const rij = {};
  SCORE_KOLOMMEN.forEach(function (kolom) { rij[kolom] = 4; });
  return Object.assign(rij, overschrijf || {});
}

test('bepaalLeeftijdsgroep zet een kind op of na de grens bij jong', function () {
  assert.strictEqual(bepaalLeeftijdsgroep('2014-06-01', 'Speler', GRENZEN), 'jong');
  assert.strictEqual(bepaalLeeftijdsgroep('2015-01-01', 'Speler', GRENZEN), 'jong');
});

test('bepaalLeeftijdsgroep zet een kind voor de grens bij oud', function () {
  assert.strictEqual(bepaalLeeftijdsgroep('2013-12-31', 'Speler', GRENZEN), 'oud');
});

test('bepaalLeeftijdsgroep gebruikt de grens van de rol', function () {
  assert.strictEqual(bepaalLeeftijdsgroep('2013-06-01', 'Speler', GRENZEN), 'oud');
  assert.strictEqual(bepaalLeeftijdsgroep('2013-06-01', 'Keeper', GRENZEN), 'jong');
});

test('bepaalLeeftijdsgroep geeft leeg zonder geboortedatum', function () {
  assert.strictEqual(bepaalLeeftijdsgroep('', 'Speler', GRENZEN), '');
  assert.strictEqual(bepaalLeeftijdsgroep(null, 'Speler', GRENZEN), '');
});

test('bepaalLeeftijdsgroep geeft leeg bij een onbekende rol', function () {
  assert.strictEqual(bepaalLeeftijdsgroep('2014-06-01', 'Onzin', GRENZEN), '');
});

test('berekenTotaalscore middelt de gewogen schalen', function () {
  assert.strictEqual(berekenTotaalscore(scoreRij(), WEGINGEN), 4);
});

test('berekenTotaalscore weegt zwaarder gewicht zwaarder mee', function () {
  const wegingen = { blocks_planning: 3, blocks_flexibiliteit: 1 };
  const rij = scoreRij({ blocks_planning: 8, blocks_flexibiliteit: 4 });

  assert.strictEqual(berekenTotaalscore(rij, wegingen), 7);
});

test('berekenTotaalscore negeert schalen met gewicht 0', function () {
  const wegingen = Object.assign({}, WEGINGEN, { levels_voltooid: 0 });
  const rij = scoreRij({ levels_voltooid: 18 });

  assert.strictEqual(berekenTotaalscore(rij, wegingen), 4);
});

test('berekenTotaalscore geeft null als een gewogen schaal ontbreekt', function () {
  assert.strictEqual(berekenTotaalscore(scoreRij({ rally_kwaliteit: '' }), WEGINGEN), null);
});

test('berekenTotaalscore geeft null als er geen enkel gewicht is', function () {
  assert.strictEqual(berekenTotaalscore(scoreRij(), {}), null);
});

test('berekenTotaalscore rondt af op twee decimalen', function () {
  const wegingen = { blocks_planning: 1, blocks_flexibiliteit: 1, rally_prestatie: 1 };
  const rij = scoreRij({ blocks_planning: 4, blocks_flexibiliteit: 5, rally_prestatie: 5 });

  assert.strictEqual(berekenTotaalscore(rij, wegingen), 4.67);
});
```

- [ ] **Step 2: Draai de tests en bevestig dat ze falen**

Run: `node --test tests/gs/teams.test.js`
Expected: FAIL — `Cannot find module '.../Teams.gs'`

- [ ] **Step 3: Maak `google-apps-script/deelnemers/Teams.gs`**

```javascript
/**
 * Rangschikt deelnemers op hun Ixly-scores en deelt ze in groepen in, per segment
 * (vereniging x leeftijd x rol). Schrijft het resultaat naar een werkboek per
 * vereniging.
 *
 * Puur rekenwerk staat hier los van het wegschrijven, zodat het met `node --test`
 * getest kan worden zonder SpreadsheetApp.
 */

/**
 * De negen genormeerde schalen die Ixly teruggeeft. levels_voltooid en levels_perfect
 * horen hier BEWUST niet bij: dat zijn ruwe aantallen op een heel andere schaal, die
 * worden wel getoond maar standaard niet meegewogen (gewicht 0 in Config).
 */
const SCORE_KOLOMMEN = [
  'blocks_planning', 'blocks_flexibiliteit',
  'rally_prestatie', 'rally_kwaliteit', 'rally_reactiesnelheid', 'rally_consistentie',
  'rally_volgehouden_aandacht', 'rally_respons_inhibitie', 'rally_reactie_op_fouten'
];

/**
 * Bepaalt of een kind bij 'jong' of 'oud' hoort.
 *
 * De grens is een geboortejaar en verschilt per rol: keepers hebben een andere
 * indeling dan spelers. Geboortejaar >= grens betekent jong.
 *
 * @param {string|Date} geboortedatum
 * @param {string} rol 'Speler' of 'Keeper'
 * @param {Object} grenzen rol -> geboortejaar
 * @return {string} 'jong', 'oud', of '' als het niet te bepalen is
 */
function bepaalLeeftijdsgroep(geboortedatum, rol, grenzen) {
  const grens = grenzen[String(rol)];
  if (!grens) {
    return '';
  }

  const jaar = _geboortejaar(geboortedatum);
  if (!jaar) {
    return '';
  }

  return jaar >= Number(grens) ? 'jong' : 'oud';
}

/**
 * Berekent de gewogen totaalscore van één deelnemer.
 *
 * Alleen schalen met gewicht > 0 tellen mee. Ontbreekt zo'n schaal, dan is de score
 * niet vergelijkbaar met die van een kind dat alles wel heeft -- dan geeft deze functie
 * null en belandt het kind in "Zonder indeling" in plaats van laag in de ranglijst.
 * Met de standaardconfiguratie (alle negen op gewicht 1) betekent dat: alleen kinderen
 * met alle negen schalen krijgen een score.
 *
 * @param {Object} scoreRij rij uit "Ixly Scores"
 * @param {Object} wegingen kolomnaam -> gewicht
 * @return {number|null} afgerond op twee decimalen, of null
 */
function berekenTotaalscore(scoreRij, wegingen) {
  let som = 0;
  let totaalGewicht = 0;

  const kolommen = Object.keys(wegingen || {});
  for (let i = 0; i < kolommen.length; i++) {
    const kolom = kolommen[i];
    const gewicht = Number(wegingen[kolom]) || 0;
    if (gewicht <= 0) {
      continue;
    }

    const waarde = scoreRij[kolom];
    if (waarde === '' || waarde === undefined || waarde === null) {
      return null;
    }

    som += Number(waarde) * gewicht;
    totaalGewicht += gewicht;
  }

  if (totaalGewicht === 0) {
    return null;
  }

  return Math.round((som / totaalGewicht) * 100) / 100;
}

function _geboortejaar(geboortedatum) {
  if (!geboortedatum) {
    return 0;
  }
  if (geboortedatum instanceof Date) {
    return geboortedatum.getFullYear();
  }
  const overeenkomst = String(geboortedatum).match(/(\d{4})/);
  return overeenkomst ? Number(overeenkomst[1]) : 0;
}

// Alleen voor `node --test`; Apps Script kent `module` niet en slaat dit over.
if (typeof module !== 'undefined') {
  module.exports = {
    SCORE_KOLOMMEN: SCORE_KOLOMMEN,
    bepaalLeeftijdsgroep: bepaalLeeftijdsgroep,
    berekenTotaalscore: berekenTotaalscore
  };
}
```

- [ ] **Step 4: Draai de tests en bevestig dat ze slagen**

Run: `node --test tests/gs/teams.test.js`
Expected: PASS (11 tests)

- [ ] **Step 5: Commit**

```bash
git add google-apps-script/deelnemers/Teams.gs tests/gs/teams.test.js
git commit -m "feat: leeftijdsgroep en gewogen totaalscore in Teams.gs"
```

---

### Task 7: `Teams.gs` — segmenteren, rangschikken, indelen

**Files:**
- Modify: `google-apps-script/deelnemers/Teams.gs`
- Test: `tests/gs/teams.test.js` (uitbreiden)

**Interfaces:**
- Consumes: `bepaalLeeftijdsgroep()`, `berekenTotaalscore()` uit Task 6.
- Produces:
  - `bouwSegmenten(deelnemers, scoreRijen, config) -> {segmenten: object, zonderIndeling: object[]}` — sleutel `'KA|jong|Speler'`, waarde array deelnemersobjecten met `totaalscore`.
  - `rangschik(deelnemers) -> object[]` — gesorteerd, met `ranking` (gelijke scores krijgen gelijke ranking).
  - `deelInGroepen(gerangschikt, groepsnamen, aantalGroepen) -> object[]` — met `voorgestelde_groep`. `aantalGroepen` valt terug op `groepsnamen.length` als het segment niet in Config staat.
  - `verdeelGroottes(aantal, aantalGroepen) -> number[]`

- [ ] **Step 1: Schrijf de falende tests**

Voeg toe aan `tests/gs/teams.test.js` (require bovenaan uitbreiden):

```javascript
const { bouwSegmenten, rangschik, deelInGroepen, verdeelGroottes } =
  require('../../google-apps-script/deelnemers/Teams.gs');

const CONFIG = {
  geboortejaargrens: { Speler: 2014, Keeper: 2013 },
  score_wegingen: (function () { const w = {}; SCORE_KOLOMMEN.forEach(function (k) { w[k] = 1; }); return w; })()
};

function deelnemer(overschrijf) {
  return Object.assign({
    naam_slug: 'kind-een', naam_kind: 'Kind Een', vereniging: 'KA', rol: 'Speler',
    geboortedatum_kind: '2015-03-01', club: 'VV Test', team: 'JO11-1'
  }, overschrijf || {});
}

test('bouwSegmenten groepeert op vereniging, leeftijd en rol', function () {
  const deelnemers = [
    deelnemer({ naam_slug: 'a' }),
    deelnemer({ naam_slug: 'b', vereniging: 'SU' }),
    deelnemer({ naam_slug: 'c', rol: 'Keeper' })
  ];
  const scores = ['a', 'b', 'c'].map(function (slug) { return scoreRij({ naam_slug: slug }); });

  const resultaat = bouwSegmenten(deelnemers, scores, CONFIG);

  assert.strictEqual(resultaat.segmenten['KA|jong|Speler'].length, 1);
  assert.strictEqual(resultaat.segmenten['SU|jong|Speler'].length, 1);
  assert.strictEqual(resultaat.segmenten['KA|jong|Keeper'].length, 1);
});

test('bouwSegmenten sluit MiniMove uit', function () {
  const deelnemers = [deelnemer({ naam_slug: 'a', vereniging: 'MM' })];
  const scores = [scoreRij({ naam_slug: 'a' })];

  const resultaat = bouwSegmenten(deelnemers, scores, CONFIG);

  assert.deepStrictEqual(resultaat.segmenten, {});
  assert.strictEqual(resultaat.zonderIndeling.length, 0);
});

test('bouwSegmenten zet een kind zonder geboortedatum in zonderIndeling', function () {
  const deelnemers = [deelnemer({ naam_slug: 'a', geboortedatum_kind: '' })];
  const scores = [scoreRij({ naam_slug: 'a' })];

  const resultaat = bouwSegmenten(deelnemers, scores, CONFIG);

  assert.strictEqual(resultaat.zonderIndeling.length, 1);
  assert.match(resultaat.zonderIndeling[0].reden, /geboortedatum/i);
});

test('bouwSegmenten zet een kind met onvolledige scores in zonderIndeling', function () {
  const deelnemers = [deelnemer({ naam_slug: 'a' })];
  const scores = [scoreRij({ naam_slug: 'a', rally_kwaliteit: '' })];

  const resultaat = bouwSegmenten(deelnemers, scores, CONFIG);

  assert.strictEqual(resultaat.zonderIndeling.length, 1);
  assert.match(resultaat.zonderIndeling[0].reden, /score/i);
});

test('bouwSegmenten zet een kind zonder scorerij in zonderIndeling', function () {
  const resultaat = bouwSegmenten([deelnemer({ naam_slug: 'a' })], [], CONFIG);

  assert.strictEqual(resultaat.zonderIndeling.length, 1);
});

test('rangschik sorteert van hoog naar laag', function () {
  const gerangschikt = rangschik([
    { naam_slug: 'a', totaalscore: 3 },
    { naam_slug: 'b', totaalscore: 7 },
    { naam_slug: 'c', totaalscore: 5 }
  ]);

  assert.deepStrictEqual(gerangschikt.map(function (d) { return d.naam_slug; }), ['b', 'c', 'a']);
  assert.deepStrictEqual(gerangschikt.map(function (d) { return d.ranking; }), [1, 2, 3]);
});

test('rangschik geeft gelijke scores dezelfde ranking en slaat daarna over', function () {
  const gerangschikt = rangschik([
    { naam_slug: 'a', totaalscore: 5 },
    { naam_slug: 'b', totaalscore: 5 },
    { naam_slug: 'c', totaalscore: 3 }
  ]);

  assert.deepStrictEqual(gerangschikt.map(function (d) { return d.ranking; }), [1, 1, 3]);
});

test('rangschik houdt bij gelijke scores een vaste volgorde op naam_slug', function () {
  const eerste = rangschik([
    { naam_slug: 'zoe', totaalscore: 5 },
    { naam_slug: 'aap', totaalscore: 5 }
  ]);
  const tweede = rangschik([
    { naam_slug: 'aap', totaalscore: 5 },
    { naam_slug: 'zoe', totaalscore: 5 }
  ]);

  assert.deepStrictEqual(eerste.map(function (d) { return d.naam_slug; }), ['aap', 'zoe']);
  assert.deepStrictEqual(tweede.map(function (d) { return d.naam_slug; }), ['aap', 'zoe']);
});

test('verdeelGroottes verdeelt zo gelijk mogelijk met de rest bovenaan', function () {
  assert.deepStrictEqual(verdeelGroottes(20, 3), [7, 7, 6]);
  assert.deepStrictEqual(verdeelGroottes(9, 3), [3, 3, 3]);
  assert.deepStrictEqual(verdeelGroottes(2, 3), [1, 1, 0]);
});

test('deelInGroepen geeft de sterkste kinderen de eerste groepsnaam', function () {
  const gerangschikt = rangschik([
    { naam_slug: 'a', totaalscore: 9 },
    { naam_slug: 'b', totaalscore: 7 },
    { naam_slug: 'c', totaalscore: 5 },
    { naam_slug: 'd', totaalscore: 3 }
  ]);

  const ingedeeld = deelInGroepen(gerangschikt, ['C3', 'C2', 'C1'], 3);

  assert.deepStrictEqual(ingedeeld.map(function (d) { return d.voorgestelde_groep; }),
    ['C3', 'C3', 'C2', 'C1']);
});

test('deelInGroepen gebruikt het ingestelde aantal groepen, niet alle namen', function () {
  const gerangschikt = rangschik([
    { naam_slug: 'a', totaalscore: 9 },
    { naam_slug: 'b', totaalscore: 7 },
    { naam_slug: 'c', totaalscore: 5 },
    { naam_slug: 'd', totaalscore: 3 }
  ]);

  const ingedeeld = deelInGroepen(gerangschikt, ['C3', 'C2', 'C1'], 2);

  assert.deepStrictEqual(ingedeeld.map(function (d) { return d.voorgestelde_groep; }),
    ['C3', 'C3', 'C2', 'C2']);
});

test('deelInGroepen valt terug op alle groepsnamen zonder ingesteld aantal', function () {
  const ingedeeld = deelInGroepen(rangschik([{ naam_slug: 'a', totaalscore: 5 }]), ['C3', 'C2'], null);

  assert.strictEqual(ingedeeld[0].voorgestelde_groep, 'C3');
});

test('deelInGroepen laat de groep leeg als er geen groepsnamen zijn', function () {
  const ingedeeld = deelInGroepen([{ naam_slug: 'a', totaalscore: 5, ranking: 1 }], [], 3);

  assert.strictEqual(ingedeeld[0].voorgestelde_groep, '');
});
```

- [ ] **Step 2: Draai de tests en bevestig dat ze falen**

Run: `node --test tests/gs/teams.test.js`
Expected: FAIL — `bouwSegmenten is not a function`

- [ ] **Step 3: Breid `Teams.gs` uit**

Voeg toe vóór het exportblok:

```javascript
/**
 * Verenigingscode van MiniMove. MiniMove doet niet mee aan de testen en valt dus
 * volledig buiten de teamindeling -- consistent met upsertDeelnemers, dat deze orders
 * ook al stil overslaat.
 */
const VERENIGING_MINIMOVE = 'MM';

/**
 * Verdeelt de deelnemers over segmenten (vereniging x leeftijd x rol) en verzamelt
 * apart wie niet in te delen is.
 *
 * Niet-indeelbaar verdwijnt NOOIT stil: elk kind komt of in een segment, of in
 * zonderIndeling met een reden erbij. Stil wegfilteren is precies waar de eerdere
 * WooCommerce-backfill ("120 orders -> 0 nieuwe rijen") nooit verklaard raakte.
 *
 * @param {Object[]} deelnemers rijen uit leesDeelnemers()
 * @param {Object[]} scoreRijen rijen uit leesIxlyScores()
 * @param {Object} config met geboortejaargrens en score_wegingen
 * @return {{segmenten: Object, zonderIndeling: Object[]}}
 */
function bouwSegmenten(deelnemers, scoreRijen, config) {
  const scoresPerSlug = {};
  (scoreRijen || []).forEach(function (rij) {
    scoresPerSlug[String(rij.naam_slug)] = rij;
  });

  const segmenten = {};
  const zonderIndeling = [];

  (deelnemers || []).forEach(function (deelnemer) {
    if (String(deelnemer.vereniging) === VERENIGING_MINIMOVE) {
      return;
    }

    const scoreRij = scoresPerSlug[String(deelnemer.naam_slug)];
    if (!scoreRij) {
      zonderIndeling.push(_zonderIndeling(deelnemer, null, null, 'nog geen score bekend'));
      return;
    }

    const totaalscore = berekenTotaalscore(scoreRij, config.score_wegingen);
    if (totaalscore === null) {
      zonderIndeling.push(_zonderIndeling(deelnemer, scoreRij, null, 'onvolledige score'));
      return;
    }

    const leeftijd = bepaalLeeftijdsgroep(
      deelnemer.geboortedatum_kind, deelnemer.rol, config.geboortejaargrens);
    if (!leeftijd) {
      zonderIndeling.push(
        _zonderIndeling(deelnemer, scoreRij, totaalscore, 'geen geboortedatum of onbekende rol'));
      return;
    }

    const sleutel = deelnemer.vereniging + '|' + leeftijd + '|' + deelnemer.rol;
    if (!segmenten[sleutel]) {
      segmenten[sleutel] = [];
    }
    segmenten[sleutel].push(_teamRij(deelnemer, scoreRij, totaalscore));
  });

  return { segmenten: segmenten, zonderIndeling: zonderIndeling };
}

/**
 * Sorteert van hoge naar lage totaalscore en zet de ranking erbij.
 *
 * Gelijke scores krijgen dezelfde ranking (1, 1, 3 -- niet 1, 2, 3). De volgorde
 * binnen een gelijke score ligt vast op naam_slug, zodat een herberekening de lijst
 * niet laat schudden en een diff van de sheet leesbaar blijft.
 *
 * @param {Object[]} deelnemers met totaalscore
 * @return {Object[]} nieuwe array, gesorteerd, met ranking
 */
function rangschik(deelnemers) {
  const gesorteerd = (deelnemers || []).map(function (d) { return Object.assign({}, d); });

  gesorteerd.sort(function (a, b) {
    if (b.totaalscore !== a.totaalscore) {
      return b.totaalscore - a.totaalscore;
    }
    return String(a.naam_slug) < String(b.naam_slug) ? -1 : 1;
  });

  let vorigeScore = null;
  let vorigeRanking = 0;
  gesorteerd.forEach(function (deelnemer, i) {
    if (deelnemer.totaalscore === vorigeScore) {
      deelnemer.ranking = vorigeRanking;
      return;
    }
    deelnemer.ranking = i + 1;
    vorigeScore = deelnemer.totaalscore;
    vorigeRanking = deelnemer.ranking;
  });

  return gesorteerd;
}

/**
 * Berekent de groepsgroottes: zo gelijk mogelijk, rest naar de bovenste groepen.
 *
 * @param {number} aantal
 * @param {number} aantalGroepen
 * @return {number[]}
 */
function verdeelGroottes(aantal, aantalGroepen) {
  const basis = Math.floor(aantal / aantalGroepen);
  const rest = aantal % aantalGroepen;

  const groottes = [];
  for (let i = 0; i < aantalGroepen; i++) {
    groottes.push(basis + (i < rest ? 1 : 0));
  }
  return groottes;
}

/**
 * Zet voorgestelde_groep op elke deelnemer.
 *
 * @param {Object[]} gerangschikt uitvoer van rangschik()
 * @param {string[]} groepsnamen van STERK naar ZWAK
 * @param {number} aantalGroepen hoeveel groepen dit segment heeft (uit
 *   config.groepen_per_segment). Leeg/0 = gebruik alle groepsnamen. Bij minder groepen
 *   dan namen worden de STERKSTE namen gebruikt: een segment met twee groepen krijgt
 *   dus de eerste twee namen uit de sterk-naar-zwaklijst.
 * @return {Object[]}
 */
function deelInGroepen(gerangschikt, groepsnamen, aantalGroepen) {
  const alleNamen = groepsnamen || [];
  const namen = aantalGroepen ? alleNamen.slice(0, aantalGroepen) : alleNamen;
  const resultaat = gerangschikt.map(function (d) { return Object.assign({}, d); });

  if (!namen.length) {
    resultaat.forEach(function (d) { d.voorgestelde_groep = ''; });
    return resultaat;
  }

  const groottes = verdeelGroottes(resultaat.length, namen.length);
  let positie = 0;
  namen.forEach(function (naam, i) {
    for (let n = 0; n < groottes[i]; n++) {
      resultaat[positie].voorgestelde_groep = naam;
      positie += 1;
    }
  });

  return resultaat;
}

function _teamRij(deelnemer, scoreRij, totaalscore) {
  const rij = {
    naam_slug:          deelnemer.naam_slug,
    naam_kind:          deelnemer.naam_kind,
    geboortedatum_kind: deelnemer.geboortedatum_kind,
    club:               deelnemer.club,
    team:               deelnemer.team,
    totaalscore:        totaalscore
  };
  SCORE_KOLOMMEN.forEach(function (kolom) {
    rij[kolom] = scoreRij ? scoreRij[kolom] : '';
  });
  rij.levels_voltooid = scoreRij ? scoreRij.levels_voltooid : '';
  rij.levels_perfect  = scoreRij ? scoreRij.levels_perfect : '';
  return rij;
}

function _zonderIndeling(deelnemer, scoreRij, totaalscore, reden) {
  const rij = _teamRij(deelnemer, scoreRij, totaalscore === null ? '' : totaalscore);
  rij.vereniging = deelnemer.vereniging;
  rij.rol = deelnemer.rol;
  rij.reden = reden;
  return rij;
}
```

Breid het exportblok uit met `bouwSegmenten`, `rangschik`, `deelInGroepen` en `verdeelGroottes`.

- [ ] **Step 4: Draai de tests en bevestig dat ze slagen**

Run: `node --test tests/gs/*.test.js`
Expected: PASS, alle bestaande tests blijven groen

- [ ] **Step 5: Commit**

```bash
git add google-apps-script/deelnemers/Teams.gs tests/gs/teams.test.js
git commit -m "feat: segmenteren, rangschikken en indelen in groepen"
```

---

### Task 8: Wegschrijven naar de werkboeken per vereniging

**Files:**
- Modify: `google-apps-script/deelnemers/Teams.gs`
- Test: `tests/gs/teams.test.js` (uitbreiden)

**Interfaces:**
- Consumes: uitvoer van `deelInGroepen()` en `bouwSegmenten()` (Task 7); `config.teamindeling_werkboeken` (Task 5).
- Produces:
  - `TEAM_KOLOMMEN` — 22 kolomnamen, inclusief `reden` voor "Zonder indeling".
  - `SEGMENT_TABBLADEN` — `{'jong|Speler': 'Jong voetbal', ...}` plus `TABBLAD_ZONDER_INDELING`.
  - `behoudDefinitieveGroep(bestaandeRijen, nieuweRijen) -> object[]`
  - `schrijfTeamindeling(config, segmenten, zonderIndeling, vandaag) -> string[]` — geeft meldingen terug.

- [ ] **Step 1: Schrijf de falende tests**

Voeg toe aan `tests/gs/teams.test.js`:

```javascript
const { TEAM_KOLOMMEN, SEGMENT_TABBLADEN, behoudDefinitieveGroep } =
  require('../../google-apps-script/deelnemers/Teams.gs');

test('TEAM_KOLOMMEN bevat geen ouder- of bedragvelden', function () {
  assert.ok(TEAM_KOLOMMEN.indexOf('ouder_email') === -1);
  assert.ok(TEAM_KOLOMMEN.indexOf('ouder_naam') === -1);
  assert.ok(TEAM_KOLOMMEN.indexOf('bedrag') === -1);
});

test('TEAM_KOLOMMEN bevat voorstel en definitief naast elkaar', function () {
  assert.ok(TEAM_KOLOMMEN.indexOf('voorgestelde_groep') !== -1);
  assert.ok(TEAM_KOLOMMEN.indexOf('definitieve_groep') !== -1);
});

test('SEGMENT_TABBLADEN dekt alle vier de combinaties', function () {
  assert.strictEqual(SEGMENT_TABBLADEN['jong|Speler'], 'Jong voetbal');
  assert.strictEqual(SEGMENT_TABBLADEN['oud|Speler'], 'Oud voetbal');
  assert.strictEqual(SEGMENT_TABBLADEN['jong|Keeper'], 'Jong keeper');
  assert.strictEqual(SEGMENT_TABBLADEN['oud|Keeper'], 'Oud keeper');
});

test('behoudDefinitieveGroep neemt de handmatige groep over op naam_slug', function () {
  const bestaand = [
    { naam_slug: 'a', definitieve_groep: 'C1' },
    { naam_slug: 'b', definitieve_groep: '' }
  ];
  const nieuw = [
    { naam_slug: 'b', voorgestelde_groep: 'C2' },
    { naam_slug: 'a', voorgestelde_groep: 'C3' }
  ];

  const resultaat = behoudDefinitieveGroep(bestaand, nieuw);

  assert.strictEqual(resultaat[1].definitieve_groep, 'C1', 'match op naam, niet op rijnummer');
  assert.strictEqual(resultaat[0].definitieve_groep, '');
});

test('behoudDefinitieveGroep laat een nieuw kind zonder definitieve groep', function () {
  const resultaat = behoudDefinitieveGroep([], [{ naam_slug: 'nieuw', voorgestelde_groep: 'C2' }]);

  assert.strictEqual(resultaat[0].definitieve_groep, '');
});

test('behoudDefinitieveGroep raakt het voorstel niet aan', function () {
  const bestaand = [{ naam_slug: 'a', definitieve_groep: 'C1', voorgestelde_groep: 'C1' }];
  const nieuw = [{ naam_slug: 'a', voorgestelde_groep: 'C3' }];

  const resultaat = behoudDefinitieveGroep(bestaand, nieuw);

  assert.strictEqual(resultaat[0].voorgestelde_groep, 'C3');
  assert.strictEqual(resultaat[0].definitieve_groep, 'C1');
});
```

- [ ] **Step 2: Draai de tests en bevestig dat ze falen**

Run: `node --test tests/gs/teams.test.js`
Expected: FAIL — `behoudDefinitieveGroep is not a function`

- [ ] **Step 3: Breid `Teams.gs` uit**

```javascript
/**
 * Kolommen van elk tabblad in een teamwerkboek. Bewust GEEN ouder_naam, ouder_email of
 * bedrag: die werkboeken zijn voor trainers, de administratie blijft in het
 * hoofdwerkboek.
 */
const TEAM_KOLOMMEN = [
  'naam_slug', 'naam_kind', 'geboortedatum_kind', 'club', 'team',
  'blocks_planning', 'blocks_flexibiliteit',
  'rally_prestatie', 'rally_kwaliteit', 'rally_reactiesnelheid', 'rally_consistentie',
  'rally_volgehouden_aandacht', 'rally_respons_inhibitie', 'rally_reactie_op_fouten',
  'levels_voltooid', 'levels_perfect',
  'totaalscore', 'ranking', 'voorgestelde_groep', 'definitieve_groep', 'bijgewerkt_op',
  // Alleen gevuld in "Zonder indeling": waarom dit kind niet in te delen was. Staat in
  // dezelfde kolommenlijst zodat alle tabbladen dezelfde vorm houden.
  'reden'
];

const SEGMENT_TABBLADEN = {
  'jong|Speler': 'Jong voetbal',
  'oud|Speler':  'Oud voetbal',
  'jong|Keeper': 'Jong keeper',
  'oud|Keeper':  'Oud keeper'
};

const TABBLAD_ZONDER_INDELING = 'Zonder indeling';

/**
 * Neemt de handmatig ingevulde definitieve_groep over uit wat er al in het tabblad
 * stond.
 *
 * Matchen gebeurt op naam_slug en NOOIT op rijnummer: de volgorde verandert zodra
 * scores wijzigen of er een kind bijkomt, dus een rijnummer verwijst na een
 * herberekening naar iemand anders.
 *
 * @param {Object[]} bestaandeRijen wat er nu in het tabblad staat
 * @param {Object[]} nieuweRijen de nieuw berekende indeling
 * @return {Object[]} nieuweRijen, aangevuld met definitieve_groep
 */
function behoudDefinitieveGroep(bestaandeRijen, nieuweRijen) {
  const definitief = {};
  (bestaandeRijen || []).forEach(function (rij) {
    definitief[String(rij.naam_slug)] = String(rij.definitieve_groep || '');
  });

  return (nieuweRijen || []).map(function (rij) {
    const kopie = Object.assign({}, rij);
    kopie.definitieve_groep = definitief[String(rij.naam_slug)] || '';
    return kopie;
  });
}

/**
 * Schrijft de indeling naar de werkboeken per vereniging.
 *
 * @param {Object} config uit leesConfig()
 * @param {Object} segmenten uit bouwSegmenten()
 * @param {Object[]} zonderIndeling uit bouwSegmenten()
 * @param {string} vandaag 'YYYY-MM-DD'
 * @return {string[]} meldingen voor het runlog
 */
function schrijfTeamindeling(config, segmenten, zonderIndeling, vandaag) {
  const meldingen = [];
  const werkboeken = config.teamindeling_werkboeken || {};

  Object.keys(werkboeken).forEach(function (vereniging) {
    const bestand = SpreadsheetApp.openById(werkboeken[vereniging]);

    Object.keys(SEGMENT_TABBLADEN).forEach(function (leeftijdRol) {
      const sleutel = vereniging + '|' + leeftijdRol;
      const gerangschikt = deelInGroepen(
        rangschik(segmenten[sleutel] || []),
        config.groepsnamen,
        (config.groepen_per_segment || {})[sleutel]
      );
      const aantal = _schrijfTabblad(
        bestand, SEGMENT_TABBLADEN[leeftijdRol], gerangschikt, vandaag);
      meldingen.push('  ' + vereniging + ' / ' + SEGMENT_TABBLADEN[leeftijdRol] + ': ' + aantal);
    });

    const eigenZonderIndeling = zonderIndeling.filter(function (rij) {
      return String(rij.vereniging) === vereniging;
    });
    _schrijfTabblad(bestand, TABBLAD_ZONDER_INDELING, eigenZonderIndeling, vandaag);
    if (eigenZonderIndeling.length) {
      meldingen.push('  ' + vereniging + ' / ' + TABBLAD_ZONDER_INDELING + ': ' +
        eigenZonderIndeling.length + ' kind(eren) nog niet in te delen');
    }
  });

  return meldingen;
}

function _schrijfTabblad(bestand, tabbladnaam, nieuweRijen, vandaag) {
  let tab = bestand.getSheetByName(tabbladnaam);
  if (!tab) {
    tab = bestand.insertSheet(tabbladnaam);
    tab.getRange(1, 1, 1, TEAM_KOLOMMEN.length).setValues([TEAM_KOLOMMEN]);
  }

  const bestaand = _leesTabblad(tab);
  const rijen = behoudDefinitieveGroep(bestaand, nieuweRijen);
  rijen.forEach(function (rij) { rij.bijgewerkt_op = vandaag; });

  if (tab.getLastRow() > 1) {
    tab.getRange(2, 1, tab.getLastRow() - 1, TEAM_KOLOMMEN.length).clearContent();
  }
  if (!rijen.length) {
    return 0;
  }

  const waarden = rijen.map(function (rij) {
    return TEAM_KOLOMMEN.map(function (kolom) {
      const waarde = rij[kolom];
      return (waarde === undefined || waarde === null) ? '' : waarde;
    });
  });
  tab.getRange(2, 1, waarden.length, TEAM_KOLOMMEN.length).setValues(waarden);

  return rijen.length;
}

function _leesTabblad(tab) {
  const laatste = tab.getLastRow();
  if (laatste < 2) {
    return [];
  }
  return tab.getRange(2, 1, laatste - 1, TEAM_KOLOMMEN.length).getValues().map(function (rij) {
    const object = {};
    TEAM_KOLOMMEN.forEach(function (kolom, i) { object[kolom] = rij[i]; });
    object.naam_slug = String(object.naam_slug || '');
    return object;
  });
}
```

Breid het exportblok uit met `TEAM_KOLOMMEN`, `SEGMENT_TABBLADEN` en `behoudDefinitieveGroep`.

- [ ] **Step 4: Draai de tests en bevestig dat ze slagen**

Run: `node --test tests/gs/*.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add google-apps-script/deelnemers/Teams.gs tests/gs/teams.test.js
git commit -m "feat: teamindeling wegschrijven met behoud van de definitieve groep"
```

---

### Task 9: Stap 8 in de dagelijkse run

**Files:**
- Modify: `google-apps-script/deelnemers/Dagelijks.gs` (docblock bovenaan + einde `_dagelijkseRunKern`)
- Modify: `google-apps-script/deelnemers/Scores.gs` (aanroep van de Function toevoegen)

**Interfaces:**
- Consumes: `kiesTeOphalenIndexen()`, `naarScoreRij()` (Task 3); `leesIxlyScores()`, `schrijfIxlyScores()`, `voegScoresSamen()` (Task 4); `bouwSegmenten()`, `schrijfTeamindeling()` (Tasks 7-8); `leesGeheimen().ixly_scores_url` (Task 5).
- Produces: `haalScoresOp(deelnemersRijen, batchGrootte, vandaag) -> {rijen: object[], opgehaald: number}` in `Scores.gs`.

- [ ] **Step 1: Voeg de Function-aanroep toe aan `Scores.gs`**

```javascript
/**
 * Haalt de nog ontbrekende scores op en voegt ze samen met "Ixly Scores".
 *
 * @param {Object[]} deelnemersRijen
 * @param {number} batchGrootte
 * @param {string} vandaag 'YYYY-MM-DD'
 * @return {{rijen: Object[], opgehaald: number}}
 */
function haalScoresOp(deelnemersRijen, batchGrootte, vandaag) {
  const bestaand = leesIxlyScores();
  const teDoen = kiesTeOphalenIndexen(deelnemersRijen, bestaand, batchGrootte);
  if (!teDoen.length) {
    return { rijen: bestaand, opgehaald: 0 };
  }

  const payload = teDoen.map(function (i) {
    return { order_id: String(deelnemersRijen[i].code), taken: deelnemersRijen[i].ixly_taken };
  });
  const resultaten = _vraagScoresOp(payload);

  const nieuweRijen = [];
  teDoen.forEach(function (i) {
    const resultaat = resultaten[String(deelnemersRijen[i].code)];
    if (!resultaat || resultaat.fout) {
      return;
    }
    nieuweRijen.push(naarScoreRij(
      deelnemersRijen[i].naam_slug, deelnemersRijen[i].naam_kind, resultaat, vandaag));
  });

  return { rijen: voegScoresSamen(bestaand, nieuweRijen), opgehaald: nieuweRijen.length };
}

function _vraagScoresOp(deelnemers) {
  const url = leesGeheimen().ixly_scores_url;
  if (!url) {
    throw new Error('IXLY_SCORES_URL niet gezet in de Script Properties.');
  }

  const respons = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ deelnemers: deelnemers }),
    muteHttpExceptions: true
  });

  const code = respons.getResponseCode();
  if (code !== 200) {
    throw new Error('ixly-scores gaf HTTP ' + code + ': ' + respons.getContentText().slice(0, 200));
  }

  return JSON.parse(respons.getContentText()).resultaten || {};
}
```

- [ ] **Step 2: Voeg Stap 8 toe in `Dagelijks.gs`**

Direct vóór `return melding.join('\n');` aan het einde van `_dagelijkseRunKern`:

```javascript
  // Stap 8 -- Ixly-scores ophalen en de teamindeling verversen. Eigen try/catch: een
  // Ixly-storing, een ontbrekend werkboek-ID of een ingetrokken toegang mag NIET via
  // dataBetrouwbaar alle reminders van die dag blokkeren. Staat ná stap 3, zodat een
  // kind dat vandaag afrondt in dezelfde run zijn scores krijgt.
  try {
    const scores = haalScoresOp(rijen, config.ixly_batch_per_run, vandaag);
    schrijfIxlyScores(scores.rijen);
    melding.push('Stap 8: ' + scores.opgehaald + ' nieuwe score(s) opgehaald.');

    const indeling = bouwSegmenten(rijen, scores.rijen, config);
    melding.push.apply(melding,
      schrijfTeamindeling(config, indeling.segmenten, indeling.zonderIndeling, vandaag));
  } catch (fout) {
    melding.push('Stap 8 MISLUKT: ' + fout.message);
    logRegel('fout', {}, 'mislukt', 'teamindeling: ' + fout.message);
  }
```

- [ ] **Step 3: Werk het docblock bovenaan `Dagelijks.gs` bij**

Vervang `De dagelijkse run: zes stappen in vaste volgorde.` door `De dagelijkse run: acht stappen in vaste volgorde.`

(Het stond al op "zes" terwijl er zeven stappen waren — dat staat als signaal in `docs/DOC-SIGNALS.md`. Dit lost het meteen op.)

- [ ] **Step 4: Draai de volledige testsuite**

Run: `node --test tests/gs/*.test.js && venv/bin/pytest tests/ -q`
Expected: PASS, alles groen

- [ ] **Step 5: Commit**

```bash
git add google-apps-script/deelnemers/Scores.gs google-apps-script/deelnemers/Dagelijks.gs
git commit -m "feat: stap 8 haalt scores op en ververst de teamindeling"
```

---

### Task 10: Uitrol (handmatige stappen, geen code)

**Files:** geen — dit zijn de acties buiten de repo die nodig zijn om het live te krijgen.

**Interfaces:**
- Consumes: alles uit Tasks 1-9.

- [ ] **Step 1: Deploy de Azure Functions**

```bash
git push
```

Wacht tot de GitHub Action klaar is en controleer daarna in Azure dat `ixly-scores` in de functielijst staat.

- [ ] **Step 2: Haal de function-URL op en zet hem als Script Property**

Haal in Azure de URL van `ixly-scores` op (inclusief functiesleutel) en zet die in de Apps Script-editor onder Projectinstellingen → Scripteigenschappen als `IXLY_SCORES_URL`.

- [ ] **Step 3: Maak het tabblad "Ixly Scores" in het hoofdwerkboek**

Vijftien kolomkoppen in rij 1, exact in deze volgorde:

```
naam_slug | naam_kind | blocks_planning | blocks_flexibiliteit | rally_prestatie |
rally_kwaliteit | rally_reactiesnelheid | rally_consistentie | rally_volgehouden_aandacht |
rally_respons_inhibitie | rally_reactie_op_fouten | levels_voltooid | levels_perfect |
bron | opgehaald_op
```

- [ ] **Step 4: Vul de vier nieuwe Config-blokken**

- `Y2:Z30` — wegingen: de negen schaalnamen uit `SCORE_KOLOMMEN` met waarde 1, en `levels_voltooid`/`levels_perfect` met waarde 0
- `AB2:AC5` — `Speler` en `Keeper` met hun geboortejaargrens
- `AE2:AE10` — groepsnamen van sterk naar zwak (**eerst bevestigen bij Berry**, zie open vraag 2 in de spec)
- `AG2:AJ30` — per segment vereniging, leeftijd (`jong`/`oud`), rol (`Speler`/`Keeper`) en het aantal groepen
- `AL2:AM5` — `KA` en `SU` met het werkboek-ID van hun teamwerkboek

- [ ] **Step 5: Maak de twee teamwerkboeken aan en deel ze**

Eén Google Spreadsheet per vereniging. De tabbladen worden bij de eerste run automatisch aangemaakt. Deel elk werkboek alleen met de trainers van die academie.

- [ ] **Step 6: Kopieer de nieuwe bestanden naar de Apps Script-editor**

`Scores.gs` en `Teams.gs` als **aparte bestanden** aanmaken, plus de wijzigingen in `Sheet.gs`, `Config.gs` en `Dagelijks.gs`. Vergeet geen bestand — een ontbrekend bestand geeft een `... is not defined`-fout die pas tijdens de run zichtbaar wordt (dit ging bij `MiniMove.gs` precies zo mis).

Ververs de editor vlak vóór het plakken.

- [ ] **Step 7: Draai `dagelijkseRun(false)` handmatig en controleer**

Verwacht: "Ixly Scores" krijgt rijen met `bron = api`, de teamwerkboeken krijgen hun vijf tabbladen, en het Log-tabblad meldt geen fout bij stap 8. Controleer één kind handmatig tegen zijn Ixly-rapport.

- [ ] **Step 8: Voer de bestaande deelnemers handmatig in**

Voor elk kind uit "Complexiteit berekening.xlsx" een rij in "Ixly Scores" met `bron = handmatig`. Die rijen worden daarna nooit meer door het systeem aangeraakt.

- [ ] **Step 9: Werk de documentatie bij**

- `docs/TODO.md` — vink "Ixly score-response verifiëren" en "Geautomatiseerde teamindeling opzetten" af
- `docs/ARCHITECTURE.md` — `ixly-scores` als zevende function, Stap 8, de twee nieuwe tabbladen en de teamwerkboeken
- `docs/DECISIONS.md` — ADR voor de weegkeuze en de scheiding tussen voorstel en definitieve groep
