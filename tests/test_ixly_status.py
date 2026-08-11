"""
Unit tests voor de ixly-status Azure Function.
Gebruik: pytest tests/test_ixly_status.py -v
"""
import json
import unittest
from unittest.mock import MagicMock, patch
from conftest import laad_function_module
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from grovia_shared import ixly_api

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

    def test_state_finished_is_afgerond(self):
        """
        Ixly geeft 'finished' terug, niet 'completed' -- geverifieerd 2026-08-11 tegen de
        live API op de candidate_tasks van Jack Korver (order 1246), die beide games af
        had terwijl de Sheet op ixly_af=NEE bleef staan. 'completed' bestaat niet als
        state-waarde in de Ixly-API (komt ook nergens in swagger.yaml voor als state).
        """
        taken = [
            {"naam": "Blocks Game", "state": "finished", "completed_at": "2026-08-06T20:54:19.306+02:00"},
            {"naam": "Rally Game",  "state": "finished", "completed_at": "2026-08-06T21:10:30.963+02:00"},
        ]
        resultaat = status._bepaal_afronding(taken)
        self.assertTrue(resultaat["af"])
        self.assertEqual(resultaat["completed_at"], "2026-08-06")

    def test_een_taak_finished_een_taak_open_is_niet_af(self):
        taken = [
            {"naam": "Blocks Game", "state": "finished", "completed_at": "2026-08-06T20:54:19.306+02:00"},
            {"naam": "Rally Game",  "state": "started",  "completed_at": ""},
        ]
        self.assertFalse(status._bepaal_afronding(taken)["af"])

    def test_lege_state_is_niet_af(self):
        """Een 404 op de candidate_task levert state '' op -- dat is nooit 'afgerond'."""
        taken = [
            {"naam": "Blocks Game", "state": "", "completed_at": ""},
            {"naam": "Rally Game",  "state": "", "completed_at": ""},
        ]
        self.assertFalse(status._bepaal_afronding(taken)["af"])


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
