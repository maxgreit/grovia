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
