"""
Unit tests voor de ixly-status Azure Function.
Gebruik: pytest tests/test_ixly_status.py -v
"""
import json
import unittest
from unittest.mock import MagicMock, patch
from conftest import laad_function_module

status = laad_function_module('ixly-status')


class TestBepaalAfronding(unittest.TestCase):
    """Afgerond betekent: alle taken afgerond."""

    def test_alle_taken_afgerond_is_af(self):
        taken = [
            {"naam": "Blocks Game", "state": "completed", "completed_at": "2026-07-18T10:00:00Z"},
            {"naam": "Rally Game",  "state": "completed", "completed_at": "2026-07-20T10:00:00Z"},
        ]
        resultaat = status._bepaal_afronding(taken)
        self.assertTrue(resultaat["af"])

    def test_laatste_afrondingsdatum_wordt_gebruikt(self):
        taken = [
            {"naam": "Blocks Game", "state": "completed", "completed_at": "2026-07-18T10:00:00Z"},
            {"naam": "Rally Game",  "state": "completed", "completed_at": "2026-07-20T10:00:00Z"},
        ]
        resultaat = status._bepaal_afronding(taken)
        self.assertEqual(resultaat["completed_at"], "2026-07-20")

    def test_een_taak_open_is_niet_af(self):
        taken = [
            {"naam": "Blocks Game", "state": "completed", "completed_at": "2026-07-18T10:00:00Z"},
            {"naam": "Rally Game",  "state": "started",   "completed_at": ""},
        ]
        self.assertFalse(status._bepaal_afronding(taken)["af"])

    def test_geen_taken_is_niet_af(self):
        self.assertFalse(status._bepaal_afronding([])["af"])


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

    def test_ontbrekende_order_ids_geeft_400(self):
        self.assertEqual(status.main(self._maak_request({})).status_code, 400)

    def test_order_ids_geen_lijst_geeft_400(self):
        self.assertEqual(status.main(self._maak_request({"order_ids": "935"})).status_code, 400)

    def test_te_veel_orders_geeft_400(self):
        veel = [str(n) for n in range(status.MAX_ORDERS_PER_AANROEP + 1)]
        self.assertEqual(status.main(self._maak_request({"order_ids": veel})).status_code, 400)

    def test_ongeldige_json_geeft_400(self):
        import azure.functions as func
        req = func.HttpRequest(
            method="POST", url="/api/ixly-status", body=b"geen json",
            headers={"Content-Type": "application/json"}, params={},
        )
        self.assertEqual(status.main(req).status_code, 400)

    @patch("grovia_test_ixly_status.ixly_api.haal_assignments")
    @patch("grovia_test_ixly_status.ixly_api.zoek_candidate")
    @patch("grovia_test_ixly_status.ixly_api.haal_token")
    def test_onbekende_candidate_geeft_niet_gevonden(self, mock_token, mock_zoek, mock_assign):
        mock_token.return_value = "token"
        mock_zoek.return_value = None

        response = status.main(self._maak_request({"order_ids": ["999"]}))
        data = json.loads(response.get_body())

        self.assertEqual(response.status_code, 200)
        self.assertFalse(data["resultaten"]["999"]["gevonden"])
        mock_assign.assert_not_called()

    @patch("grovia_test_ixly_status.ixly_api.haal_taak_status")
    @patch("grovia_test_ixly_status.ixly_api.haal_assignments")
    @patch("grovia_test_ixly_status.ixly_api.zoek_candidate")
    @patch("grovia_test_ixly_status.ixly_api.haal_token")
    def test_afgeronde_taken_geven_af(self, mock_token, mock_zoek, mock_assign, mock_status):
        mock_token.return_value = "token"
        mock_zoek.return_value = {"id": "cand-uuid"}
        mock_assign.return_value = [
            {"relationships": {"candidate_task": {"data": {"id": "taak-1"}}}},
        ]
        mock_status.return_value = {"state": "completed", "completed_at": "2026-07-20T10:00:00Z"}

        response = status.main(self._maak_request({"order_ids": ["935"]}))
        data = json.loads(response.get_body())

        self.assertTrue(data["resultaten"]["935"]["af"])
        self.assertEqual(data["resultaten"]["935"]["completed_at"], "2026-07-20")

    @patch("grovia_test_ixly_status.ixly_api.haal_token")
    def test_token_fout_geeft_502(self, mock_token):
        import requests as req_lib
        respons = MagicMock(status_code=401, text="unauthorized")
        mock_token.side_effect = req_lib.HTTPError(response=respons)

        self.assertEqual(status.main(self._maak_request({"order_ids": ["935"]})).status_code, 502)
