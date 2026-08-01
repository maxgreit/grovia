"""
Unit tests voor ixly-aanmelding Azure Function.
Gebruik: pytest tests/test_ixly_aanmelding_unit.py -v
"""
import unittest
from unittest.mock import MagicMock, patch
from conftest import laad_function_module

ixly = laad_function_module('ixly-aanmelding')


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

    @patch("grovia_test_ixly_aanmelding.requests.post")
    def test_candidate_gebruikt_voornaam_kind(self, mock_post):
        mock_post.return_value = MagicMock(**{"json.return_value": {"data": {"id": "uuid-1"}}})

        ixly._maak_candidate_aan("token", _payload(naam_kind="Lisa Jansen"))

        kandidaat = mock_post.call_args.kwargs["json"]["candidate"]
        self.assertEqual(kandidaat["first_name"], "Lisa")

    @patch("grovia_test_ixly_aanmelding.requests.post")
    def test_candidate_gebruikt_achternaam_kind(self, mock_post):
        mock_post.return_value = MagicMock(**{"json.return_value": {"data": {"id": "uuid-1"}}})

        ixly._maak_candidate_aan("token", _payload(naam_kind="Lisa Jansen"))

        kandidaat = mock_post.call_args.kwargs["json"]["candidate"]
        self.assertEqual(kandidaat["last_name"], "Jansen")

    @patch("grovia_test_ixly_aanmelding.requests.post")
    def test_candidate_gebruikt_order_id_als_api_identifier(self, mock_post):
        mock_post.return_value = MagicMock(**{"json.return_value": {"data": {"id": "uuid-1"}}})

        ixly._maak_candidate_aan("token", _payload(order_id="42"))

        kandidaat = mock_post.call_args.kwargs["json"]["candidate"]
        self.assertEqual(kandidaat["api_identifier"], "42")

    @patch("grovia_test_ixly_aanmelding.requests.post")
    def test_candidate_gebruikt_niet_wc_klant_id_als_api_identifier(self, mock_post):
        mock_post.return_value = MagicMock(**{"json.return_value": {"data": {"id": "uuid-1"}}})

        ixly._maak_candidate_aan("token", _payload(wc_klant_id="999", order_id="42"))

        kandidaat = mock_post.call_args.kwargs["json"]["candidate"]
        self.assertNotEqual(kandidaat["api_identifier"], "999")

    @patch("grovia_test_ixly_aanmelding.requests.post")
    def test_candidate_geeft_data_terug(self, mock_post):
        mock_post.return_value = MagicMock(**{"json.return_value": {"data": {"id": "uuid-2"}}})

        result = ixly._maak_candidate_aan("token", _payload())
        self.assertEqual(result["id"], "uuid-2")


class TestCandidateUpsert(unittest.TestCase):
    """Upsert zoekt op order_id als api_identifier."""

    @patch("grovia_test_ixly_aanmelding._maak_candidate_aan")
    @patch("grovia_test_ixly_aanmelding._zoek_candidate_op")
    def test_upsert_zoekt_op_order_id(self, mock_zoek, mock_maak):
        mock_zoek.return_value = None
        mock_maak.return_value = {"id": "nieuw-uuid"}

        ixly._candidate_upsert("token", _payload(order_id="42"))

        mock_zoek.assert_called_once_with("token", "42")

    @patch("grovia_test_ixly_aanmelding._maak_candidate_aan")
    @patch("grovia_test_ixly_aanmelding._zoek_candidate_op")
    def test_upsert_zoekt_niet_op_wc_klant_id(self, mock_zoek, mock_maak):
        mock_zoek.return_value = None
        mock_maak.return_value = {"id": "nieuw-uuid"}

        ixly._candidate_upsert("token", _payload(wc_klant_id="999", order_id="42"))

        self.assertNotIn("999", mock_zoek.call_args.args)

    @patch("grovia_test_ixly_aanmelding._maak_candidate_aan")
    @patch("grovia_test_ixly_aanmelding._zoek_candidate_op")
    def test_upsert_maakt_niet_aan_als_al_bestaat(self, mock_zoek, mock_maak):
        mock_zoek.return_value = {"id": "bestaand-uuid"}

        candidate, nieuw = ixly._candidate_upsert("token", _payload())

        mock_maak.assert_not_called()
        self.assertFalse(nieuw)
        self.assertEqual(candidate["id"], "bestaand-uuid")

    @patch("grovia_test_ixly_aanmelding._maak_candidate_aan")
    @patch("grovia_test_ixly_aanmelding._zoek_candidate_op")
    def test_upsert_maakt_aan_als_niet_bestaat(self, mock_zoek, mock_maak):
        mock_zoek.return_value = None
        mock_maak.return_value = {"id": "nieuw-uuid"}

        candidate, nieuw = ixly._candidate_upsert("token", _payload())

        mock_maak.assert_called_once()
        self.assertTrue(nieuw)
        self.assertEqual(candidate["id"], "nieuw-uuid")


class TestDuplicateAssignmentGuard(unittest.TestCase):
    """Bestaande assignments worden niet opnieuw aangemaakt."""

    @patch("grovia_test_ixly_aanmelding.requests.get")
    def test_haal_bestaande_assignments_op_geeft_lijst_terug(self, mock_get):
        mock_get.return_value = MagicMock(**{"json.return_value": {
            "data": [{"id": "assign-1", "relationships": {"task": {"data": {"id": "taak-uuid-1"}}}}]
        }})

        result = ixly._haal_bestaande_assignments_op("token", "candidate-uuid")
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["id"], "assign-1")

    @patch("grovia_test_ixly_aanmelding.requests.get")
    def test_haal_bestaande_assignments_op_geeft_lege_lijst_bij_geen_data(self, mock_get):
        mock_get.return_value = MagicMock(**{"json.return_value": {"data": []}})

        result = ixly._haal_bestaande_assignments_op("token", "candidate-uuid")
        self.assertEqual(result, [])

    @patch("grovia_test_ixly_aanmelding._maak_assignment_aan")
    @patch("grovia_test_ixly_aanmelding._haal_bestaande_assignments_op")
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

    @patch("grovia_test_ixly_aanmelding._maak_assignment_aan")
    @patch("grovia_test_ixly_aanmelding._haal_bestaande_assignments_op")
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

    @patch("grovia_test_ixly_aanmelding._maak_assignment_aan")
    @patch("grovia_test_ixly_aanmelding._haal_bestaande_assignments_op")
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

    @patch("grovia_test_ixly_aanmelding._maak_assignment_aan")
    @patch("grovia_test_ixly_aanmelding._haal_bestaande_assignments_op")
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


class TestBewaarIxlyTaken(unittest.TestCase):
    """De taak-uuid's worden als order-meta bewaard, zonder de rest te blokkeren."""

    ASSIGNMENTS = [
        {"naam": "Blocks Game", "assignment_uuid": "assign-1", "login_url": "https://ixly.example/blocks"},
        {"naam": "Rally Game",  "assignment_uuid": "assign-2", "login_url": "https://ixly.example/rally"},
    ]

    @patch("grovia_test_ixly_aanmelding.requests.put")
    def test_stuurt_naam_en_uuid_gecombineerd(self, mock_put):
        mock_put.return_value = MagicMock(status_code=200)
        with patch.object(ixly, "GROVIA_WORDPRESS_URL", "https://grovia.test"), \
             patch.object(ixly, "GROVIA_WOO_CONSUMER_KEY", "ck_test"), \
             patch.object(ixly, "GROVIA_WOO_CONSUMER_SECRET", "cs_test"):
            ixly._bewaar_ixly_taken("42", self.ASSIGNMENTS)

        waarde = mock_put.call_args.kwargs["json"]["meta_data"][0]["value"]
        self.assertEqual(waarde, "Blocks Game:assign-1,Rally Game:assign-2")

    @patch("grovia_test_ixly_aanmelding.requests.put")
    def test_gebruikt_juiste_meta_sleutel(self, mock_put):
        mock_put.return_value = MagicMock(status_code=200)
        with patch.object(ixly, "GROVIA_WORDPRESS_URL", "https://grovia.test"), \
             patch.object(ixly, "GROVIA_WOO_CONSUMER_KEY", "ck_test"), \
             patch.object(ixly, "GROVIA_WOO_CONSUMER_SECRET", "cs_test"):
            ixly._bewaar_ixly_taken("42", self.ASSIGNMENTS)

        sleutel = mock_put.call_args.kwargs["json"]["meta_data"][0]["key"]
        self.assertEqual(sleutel, "_grovia_ixly_taken")

    @patch("grovia_test_ixly_aanmelding.requests.put")
    def test_stuurt_eigen_user_agent(self, mock_put):
        # De hosting blokkeert de standaard "python-requests"-User-Agent met een
        # 403 (WAF-regel, bevestigd door dezelfde aanroep vanaf hetzelfde IP wel
        # te laten slagen met een andere User-Agent) -- vandaar een expliciete,
        # eigen header.
        mock_put.return_value = MagicMock(status_code=200)
        with patch.object(ixly, "GROVIA_WORDPRESS_URL", "https://grovia.test"), \
             patch.object(ixly, "GROVIA_WOO_CONSUMER_KEY", "ck_test"), \
             patch.object(ixly, "GROVIA_WOO_CONSUMER_SECRET", "cs_test"):
            ixly._bewaar_ixly_taken("42", self.ASSIGNMENTS)

        user_agent = mock_put.call_args.kwargs["headers"]["User-Agent"]
        self.assertNotIn("python-requests", user_agent)

    def test_zonder_sleutels_doet_niets(self):
        with patch.object(ixly, "GROVIA_WORDPRESS_URL", ""), \
             patch.object(ixly, "GROVIA_WOO_CONSUMER_KEY", ""), \
             patch.object(ixly, "GROVIA_WOO_CONSUMER_SECRET", ""), \
             patch("grovia_test_ixly_aanmelding.requests.put") as mock_put:
            ixly._bewaar_ixly_taken("42", self.ASSIGNMENTS)
            mock_put.assert_not_called()

    def test_zonder_wordpress_url_doet_niets(self):
        # Bevinding 1: de guard moet ook GROVIA_WORDPRESS_URL controleren, niet
        # alleen KEY/SECRET -- ook als die twee wel gezet zijn.
        with patch.object(ixly, "GROVIA_WORDPRESS_URL", ""), \
             patch.object(ixly, "GROVIA_WOO_CONSUMER_KEY", "ck_test"), \
             patch.object(ixly, "GROVIA_WOO_CONSUMER_SECRET", "cs_test"), \
             patch("grovia_test_ixly_aanmelding.requests.put") as mock_put:
            ixly._bewaar_ixly_taken("42", self.ASSIGNMENTS)
            mock_put.assert_not_called()

    @patch("grovia_test_ixly_aanmelding.requests.put")
    def test_mislukking_gooit_geen_exception(self, mock_put):
        mock_put.side_effect = OSError("netwerk weg")
        with patch.object(ixly, "GROVIA_WORDPRESS_URL", "https://grovia.test"), \
             patch.object(ixly, "GROVIA_WOO_CONSUMER_KEY", "ck_test"), \
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

        with patch.object(ixly, "GROVIA_WORDPRESS_URL", "https://grovia.test"), \
             patch.object(ixly, "GROVIA_WOO_CONSUMER_KEY", "ck_test"), \
             patch.object(ixly, "GROVIA_WOO_CONSUMER_SECRET", "cs_test"):
            response = ixly.main(self._maak_request(_payload(order_id="42", school_code="KA")))

        self.assertEqual(response.status_code, 200)
        mock_verstuur.assert_called_once()


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
