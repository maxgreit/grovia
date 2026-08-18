"""
Unit tests voor de ixly-scores Azure Function.
Gebruik: pytest tests/test_ixly_scores.py -v
"""
import json
import unittest

import requests
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

    @patch("grovia_shared.ixly_api.haal_alle_tokens")
    @patch("grovia_shared.ixly_api.haal_taak_score")
    @patch("grovia_shared.ixly_api.haal_assignment")
    def test_foutvorm_behoudt_sleutels(self, mock_assignment, mock_score, mock_tokens):
        mock_tokens.return_value = ["t1"]
        mock_assignment.side_effect = lambda token, uuid: _assignment(uuid)

        # Al de EERSTE score-aanroep (Blocks) geeft een HTTPError, dus er staat niets
        # halfs in het resultaat: de foutvorm moet dan nog steeds dezelfde sleutels
        # hebben als de succesvorm.
        fout = requests.HTTPError()
        fout.response = MagicMock(status_code=502)
        mock_score.side_effect = fout

        respons = scores.main(self._verzoek({"deelnemers": [{"order_id": "1345", "taken": TAKEN}]}))

        self.assertEqual(respons.status_code, 200)
        body = json.loads(respons.get_body())
        resultaat = body["resultaten"]["1345"]

        # Foutvorm moet dezelfde sleutels hebben als succesvorm
        self.assertIn("blocks", resultaat)
        self.assertIn("rally", resultaat)
        self.assertIn("levels_voltooid", resultaat)
        self.assertIn("levels_perfect", resultaat)
        self.assertIn("fout", resultaat)
        self.assertEqual(resultaat["blocks"], {})
        self.assertEqual(resultaat["rally"], {})
        self.assertIsNone(resultaat["levels_voltooid"])
        self.assertIsNone(resultaat["levels_perfect"])
        self.assertIn("Ixly-fout", resultaat["fout"])


if __name__ == "__main__":
    unittest.main()
