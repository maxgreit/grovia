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

    @patch("grovia_shared.ixly_api.requests.get")
    def test_echte_fout_laat_opkomen(self, mock_get):
        """Een 500 is geen 'verkeerde adviseur' -- die moet niet stil doorlopen."""
        antwoord = MagicMock(status_code=500)
        antwoord.raise_for_status.side_effect = ixly_api.requests.HTTPError(response=antwoord)
        mock_get.return_value = antwoord

        with self.assertRaises(ixly_api.requests.HTTPError):
            ixly_api.haal_taak_score(["t1", "t2"], "candidate_task", "uuid-1")


class TestBepaalAfronding(unittest.TestCase):
    """Canonieke definitie van 'afgerond' -- gedeeld door ixly-status en grovia-herinnering."""

    def test_alle_taken_afgerond_is_af(self):
        taken = [
            {"naam": "Blocks Game", "state": "finished", "completed_at": "2026-09-24T10:00:00Z"},
            {"naam": "Rally Game",  "state": "finished", "completed_at": "2026-09-24T10:05:00Z"},
        ]
        self.assertTrue(ixly_api.bepaal_afronding(taken)["af"])

    def test_een_taak_open_is_niet_af(self):
        taken = [
            {"naam": "Blocks Game", "state": "finished", "completed_at": "2026-09-24T10:00:00Z"},
            {"naam": "Rally Game",  "state": "started",  "completed_at": ""},
        ]
        self.assertFalse(ixly_api.bepaal_afronding(taken)["af"])

    def test_geen_taken_is_niet_af(self):
        self.assertFalse(ixly_api.bepaal_afronding([])["af"])


class TestHaalTakenDetails(unittest.TestCase):
    """
    haal_taken_details haalt per taak zowel de login_url als de actuele state/
    completed_at op -- de basis voor grovia-herinnering's verse controle vlak vóór een
    reminder (Lev Klaver-geval, 2026-09-26: de Sheet's ixly_af liep een dag achter op
    Ixly's eigen completed_at).
    """

    @patch("grovia_shared.ixly_api.haal_taak_status")
    @patch("grovia_shared.ixly_api.haal_assignment")
    def test_geeft_login_url_en_status_terug(self, mock_assignment, mock_status):
        mock_assignment.return_value = {
            "relationships": {"candidate_task": {"data": {"id": "taak-1"}}},
            "links": {"login_url": "https://ixly.test/blocks"},
        }
        mock_status.return_value = {"state": "finished", "completed_at": "2026-09-24T10:00:00Z"}

        resultaat = ixly_api.haal_taken_details(["token"], [
            {"naam": "Blocks Game", "assignment_uuid": "assign-1"},
        ])

        self.assertEqual(resultaat, [{
            "naam": "Blocks Game",
            "login_url": "https://ixly.test/blocks",
            "state": "finished",
            "completed_at": "2026-09-24T10:00:00Z",
        }])

    @patch("grovia_shared.ixly_api.haal_assignment")
    def test_onbekende_assignment_blijft_in_de_lijst_met_lege_status(self, mock_assignment):
        mock_assignment.return_value = None

        resultaat = ixly_api.haal_taken_details(["token"], [
            {"naam": "Blocks Game", "assignment_uuid": "onbekend"},
        ])

        self.assertEqual(resultaat, [
            {"naam": "Blocks Game", "login_url": "", "state": "", "completed_at": ""}
        ])

    @patch("grovia_shared.ixly_api.haal_assignment")
    def test_geen_taaksoort_geeft_wel_login_url_maar_lege_status(self, mock_assignment):
        mock_assignment.return_value = {
            "relationships": {},
            "links": {"login_url": "https://ixly.test/blocks"},
        }

        resultaat = ixly_api.haal_taken_details(["token"], [
            {"naam": "Blocks Game", "assignment_uuid": "assign-1"},
        ])

        self.assertEqual(resultaat, [{
            "naam": "Blocks Game", "login_url": "https://ixly.test/blocks",
            "state": "", "completed_at": "",
        }])

    @patch("grovia_shared.ixly_api.haal_taak_status")
    @patch("grovia_shared.ixly_api.haal_assignment")
    def test_meerdere_taken_krijgen_elk_hun_eigen_details(self, mock_assignment, mock_status):
        mock_assignment.side_effect = [
            {"relationships": {"candidate_task": {"data": {"id": "taak-1"}}},
             "links": {"login_url": "https://ixly.test/blocks"}},
            {"relationships": {"candidate_task": {"data": {"id": "taak-2"}}},
             "links": {"login_url": "https://ixly.test/rally"}},
        ]
        mock_status.side_effect = [
            {"state": "finished", "completed_at": "2026-09-24T10:00:00Z"},
            {"state": "started",  "completed_at": ""},
        ]

        resultaat = ixly_api.haal_taken_details(["token"], [
            {"naam": "Blocks Game", "assignment_uuid": "assign-1"},
            {"naam": "Rally Game",  "assignment_uuid": "assign-2"},
        ])

        self.assertEqual(len(resultaat), 2)
        self.assertEqual(resultaat[0]["state"], "finished")
        self.assertEqual(resultaat[1]["state"], "started")


if __name__ == "__main__":
    unittest.main()
