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


class TestHaalLoginUrls(unittest.TestCase):
    """
    _haal_login_urls moet de gamenaam via ixly_api.TAAK_NAMEN opzoeken aan de hand van
    relationships.task.data.id -- niet via het niet-bestaande attributes.title (zie
    concern in task-5-report.md, bevestigd tegen swagger.yaml).
    """

    def _assignment(self, task_uuid, login_url="https://ixly.test/login"):
        return {
            "attributes": {},
            "links": {"login_url": login_url},
            "relationships": {"task": {"data": {"id": task_uuid, "type": "task"}}},
        }

    @patch("grovia_test_grovia_herinnering.ixly_api.haal_assignments")
    @patch("grovia_test_grovia_herinnering.ixly_api.zoek_candidate")
    @patch("grovia_test_grovia_herinnering.ixly_api.haal_token")
    def test_bekende_task_uuid_geeft_echte_gamenaam(self, mock_token, mock_candidate, mock_assignments):
        mock_token.return_value = "token"
        mock_candidate.return_value = {"id": "candidate-uuid"}
        mock_assignments.return_value = [
            self._assignment("2a04b8bc-486f-4b9a-924a-26199b75be9c", "https://ixly.test/blocks"),
        ]

        resultaat = herinnering._haal_login_urls("935")

        self.assertEqual(resultaat, [
            {"naam": "Blocks Game", "login_url": "https://ixly.test/blocks"},
        ])

    @patch("grovia_test_grovia_herinnering.ixly_api.haal_assignments")
    @patch("grovia_test_grovia_herinnering.ixly_api.zoek_candidate")
    @patch("grovia_test_grovia_herinnering.ixly_api.haal_token")
    def test_onbekende_task_uuid_valt_terug_op_generieke_naam(self, mock_token, mock_candidate, mock_assignments):
        mock_token.return_value = "token"
        mock_candidate.return_value = {"id": "candidate-uuid"}
        mock_assignments.return_value = [
            self._assignment("00000000-0000-0000-0000-000000000000", "https://ixly.test/onbekend"),
        ]

        resultaat = herinnering._haal_login_urls("935")

        self.assertEqual(resultaat, [
            {"naam": "de game", "login_url": "https://ixly.test/onbekend"},
        ])

    @patch("grovia_test_grovia_herinnering.ixly_api.haal_assignments")
    @patch("grovia_test_grovia_herinnering.ixly_api.zoek_candidate")
    @patch("grovia_test_grovia_herinnering.ixly_api.haal_token")
    def test_beide_games_krijgen_verschillende_namen(self, mock_token, mock_candidate, mock_assignments):
        mock_token.return_value = "token"
        mock_candidate.return_value = {"id": "candidate-uuid"}
        mock_assignments.return_value = [
            self._assignment("2a04b8bc-486f-4b9a-924a-26199b75be9c", "https://ixly.test/blocks"),
            self._assignment("4464b991-268f-45f7-860a-e5b109160612", "https://ixly.test/rally"),
        ]

        resultaat = herinnering._haal_login_urls("935")

        namen = {r["naam"] for r in resultaat}
        self.assertEqual(namen, {"Blocks Game", "Rally Game"})
