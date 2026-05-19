"""
Unit tests voor ixly-aanmelding Azure Function.
Gebruik: pytest tests/test_ixly_aanmelding_unit.py -v
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'ixly-aanmelding'))

import unittest
from unittest.mock import MagicMock, patch
import __init__ as ixly


def _payload(**overrides):
    base = {
        "voornaam":   "Jan",
        "achternaam": "Jansen",
        "email":      "jan@voorbeeld.nl",
        "wc_klant_id": "999",
        "naam_kind":  "Lisa Jansen",
        "order_id":   "42",
    }
    base.update(overrides)
    return base


class TestSplitsNaam(unittest.TestCase):
    """Naam wordt gesplitst op eerste spatie."""

    def test_voornaam_en_achternaam(self):
        self.assertEqual(ixly._splits_naam("Lisa Jansen"), ("Lisa", "Jansen"))

    def test_achternaam_met_spatie(self):
        self.assertEqual(ixly._splits_naam("Lisa van der Berg"), ("Lisa", "van der Berg"))

    def test_alleen_voornaam(self):
        self.assertEqual(ixly._splits_naam("Lisa"), ("Lisa", ""))

    def test_witruimte_wordt_gestript(self):
        self.assertEqual(ixly._splits_naam("  Lisa Jansen  "), ("Lisa", "Jansen"))


class TestMaakCandidateAan(unittest.TestCase):
    """Candidate wordt aangemaakt op naam kind, met order_id als api_identifier."""

    @patch("__init__.requests.post")
    def test_candidate_gebruikt_voornaam_kind(self, mock_post):
        mock_post.return_value = MagicMock(**{"json.return_value": {"data": {"id": "uuid-1"}}})

        ixly._maak_candidate_aan("token", _payload(naam_kind="Lisa Jansen"))

        kandidaat = mock_post.call_args.kwargs["json"]["candidate"]
        self.assertEqual(kandidaat["first_name"], "Lisa")

    @patch("__init__.requests.post")
    def test_candidate_gebruikt_achternaam_kind(self, mock_post):
        mock_post.return_value = MagicMock(**{"json.return_value": {"data": {"id": "uuid-1"}}})

        ixly._maak_candidate_aan("token", _payload(naam_kind="Lisa Jansen"))

        kandidaat = mock_post.call_args.kwargs["json"]["candidate"]
        self.assertEqual(kandidaat["last_name"], "Jansen")

    @patch("__init__.requests.post")
    def test_candidate_gebruikt_order_id_als_api_identifier(self, mock_post):
        mock_post.return_value = MagicMock(**{"json.return_value": {"data": {"id": "uuid-1"}}})

        ixly._maak_candidate_aan("token", _payload(order_id="42"))

        kandidaat = mock_post.call_args.kwargs["json"]["candidate"]
        self.assertEqual(kandidaat["api_identifier"], "42")

    @patch("__init__.requests.post")
    def test_candidate_gebruikt_niet_wc_klant_id_als_api_identifier(self, mock_post):
        mock_post.return_value = MagicMock(**{"json.return_value": {"data": {"id": "uuid-1"}}})

        ixly._maak_candidate_aan("token", _payload(wc_klant_id="999", order_id="42"))

        kandidaat = mock_post.call_args.kwargs["json"]["candidate"]
        self.assertNotEqual(kandidaat["api_identifier"], "999")

    @patch("__init__.requests.post")
    def test_candidate_geeft_data_terug(self, mock_post):
        mock_post.return_value = MagicMock(**{"json.return_value": {"data": {"id": "uuid-2"}}})

        result = ixly._maak_candidate_aan("token", _payload())
        self.assertEqual(result["id"], "uuid-2")


class TestCandidateUpsert(unittest.TestCase):
    """Upsert zoekt op order_id als api_identifier."""

    @patch("__init__._maak_candidate_aan")
    @patch("__init__._zoek_candidate_op")
    def test_upsert_zoekt_op_order_id(self, mock_zoek, mock_maak):
        mock_zoek.return_value = None
        mock_maak.return_value = {"id": "nieuw-uuid"}

        ixly._candidate_upsert("token", _payload(order_id="42"))

        mock_zoek.assert_called_once_with("token", "42")

    @patch("__init__._maak_candidate_aan")
    @patch("__init__._zoek_candidate_op")
    def test_upsert_zoekt_niet_op_wc_klant_id(self, mock_zoek, mock_maak):
        mock_zoek.return_value = None
        mock_maak.return_value = {"id": "nieuw-uuid"}

        ixly._candidate_upsert("token", _payload(wc_klant_id="999", order_id="42"))

        self.assertNotIn("999", mock_zoek.call_args.args)

    @patch("__init__._maak_candidate_aan")
    @patch("__init__._zoek_candidate_op")
    def test_upsert_maakt_niet_aan_als_al_bestaat(self, mock_zoek, mock_maak):
        mock_zoek.return_value = {"id": "bestaand-uuid"}

        candidate, nieuw = ixly._candidate_upsert("token", _payload())

        mock_maak.assert_not_called()
        self.assertFalse(nieuw)
        self.assertEqual(candidate["id"], "bestaand-uuid")

    @patch("__init__._maak_candidate_aan")
    @patch("__init__._zoek_candidate_op")
    def test_upsert_maakt_aan_als_niet_bestaat(self, mock_zoek, mock_maak):
        mock_zoek.return_value = None
        mock_maak.return_value = {"id": "nieuw-uuid"}

        candidate, nieuw = ixly._candidate_upsert("token", _payload())

        mock_maak.assert_called_once()
        self.assertTrue(nieuw)
        self.assertEqual(candidate["id"], "nieuw-uuid")


class TestDuplicateAssignmentGuard(unittest.TestCase):
    """Bestaande assignments worden niet opnieuw aangemaakt."""

    @patch("__init__.requests.get")
    def test_haal_bestaande_assignments_op_geeft_lijst_terug(self, mock_get):
        mock_get.return_value = MagicMock(**{"json.return_value": {
            "data": [{"id": "assign-1", "relationships": {"task": {"data": {"id": "taak-uuid-1"}}}}]
        }})

        result = ixly._haal_bestaande_assignments_op("token", "candidate-uuid")
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["id"], "assign-1")

    @patch("__init__.requests.get")
    def test_haal_bestaande_assignments_op_geeft_lege_lijst_bij_geen_data(self, mock_get):
        mock_get.return_value = MagicMock(**{"json.return_value": {"data": []}})

        result = ixly._haal_bestaande_assignments_op("token", "candidate-uuid")
        self.assertEqual(result, [])

    @patch("__init__._maak_assignment_aan")
    @patch("__init__._haal_bestaande_assignments_op")
    def test_blocks_game_overgeslagen_als_al_bestaat(self, mock_haal, mock_maak):
        blocks_uuid = "2a04b8bc-486f-4b9a-924a-26199b75be9c"
        rally_uuid  = "4464b991-268f-45f7-860a-e5b109160612"
        mock_haal.return_value = [
            {"id": "assign-1", "relationships": {"task": {"data": {"id": blocks_uuid}}}},
        ]
        mock_maak.return_value = {"id": "assign-2", "links": {"login_url": "https://ixly.example/rally"}}

        ixly._maak_assignments_aan_met_guard("token", "candidate-uuid")

        self.assertEqual(mock_maak.call_count, 1)
        self.assertEqual(mock_maak.call_args.args[2]["uuid"], rally_uuid)

    @patch("__init__._maak_assignment_aan")
    @patch("__init__._haal_bestaande_assignments_op")
    def test_beide_assignments_aangemaakt_als_geen_bestaande(self, mock_haal, mock_maak):
        mock_haal.return_value = []
        mock_maak.side_effect = [
            {"id": "assign-1", "links": {"login_url": "https://ixly.example/blocks"}},
            {"id": "assign-2", "links": {"login_url": "https://ixly.example/rally"}},
        ]

        assignments = ixly._maak_assignments_aan_met_guard("token", "candidate-uuid")

        self.assertEqual(mock_maak.call_count, 2)
        self.assertEqual(len(assignments), 2)
        self.assertEqual(assignments[0]["login_url"], "https://ixly.example/blocks")
        self.assertEqual(assignments[1]["login_url"], "https://ixly.example/rally")

    @patch("__init__._maak_assignment_aan")
    @patch("__init__._haal_bestaande_assignments_op")
    def test_login_url_per_assignment_opgeslagen(self, mock_haal, mock_maak):
        mock_haal.return_value = []
        mock_maak.side_effect = [
            {"id": "assign-1", "links": {"login_url": "https://ixly.example/blocks"}},
            {"id": "assign-2", "links": {"login_url": "https://ixly.example/rally"}},
        ]

        assignments = ixly._maak_assignments_aan_met_guard("token", "candidate-uuid")

        self.assertIn("login_url", assignments[0])
        self.assertIn("login_url", assignments[1])
        self.assertNotEqual(assignments[0]["login_url"], assignments[1]["login_url"])

    @patch("__init__._maak_assignment_aan")
    @patch("__init__._haal_bestaande_assignments_op")
    def test_geen_assignments_aangemaakt_als_alle_bestaan(self, mock_haal, mock_maak):
        blocks_uuid = "2a04b8bc-486f-4b9a-924a-26199b75be9c"
        rally_uuid  = "4464b991-268f-45f7-860a-e5b109160612"
        mock_haal.return_value = [
            {"id": "assign-1", "relationships": {"task": {"data": {"id": blocks_uuid}}}},
            {"id": "assign-2", "relationships": {"task": {"data": {"id": rally_uuid}}}},
        ]

        assignments = ixly._maak_assignments_aan_met_guard("token", "candidate-uuid")

        mock_maak.assert_not_called()
        self.assertEqual(assignments, [])


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

    def test_ontbrekend_naam_kind_geeft_400(self):
        body = _payload()
        del body["naam_kind"]
        self.assertEqual(ixly.main(self._maak_request(body)).status_code, 400)

    def test_ontbrekend_order_id_geeft_400(self):
        body = _payload()
        del body["order_id"]
        self.assertEqual(ixly.main(self._maak_request(body)).status_code, 400)

    def test_ontbrekend_email_geeft_400(self):
        body = _payload()
        del body["email"]
        self.assertEqual(ixly.main(self._maak_request(body)).status_code, 400)


if __name__ == "__main__":
    unittest.main()
