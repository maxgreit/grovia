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
