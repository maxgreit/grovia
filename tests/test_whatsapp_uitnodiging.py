"""
Unit tests voor whatsapp-uitnodiging Azure Function.
Gebruik: pytest tests/test_whatsapp_uitnodiging.py -v
"""
import sys
import os
import json
import unittest
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'whatsapp-uitnodiging'))
import __init__ as wa


class TestNormaliseerTelefoon(unittest.TestCase):
    """Telefoonnummers worden omgezet naar E.164 (zonder +)."""

    def test_mobiel_met_nul(self):
        self.assertEqual(wa._normaliseer_telefoon("0612345678"), "31612345678")

    def test_mobiel_met_landcode_plus(self):
        self.assertEqual(wa._normaliseer_telefoon("+31612345678"), "31612345678")

    def test_mobiel_met_landcode_00(self):
        self.assertEqual(wa._normaliseer_telefoon("0031612345678"), "31612345678")

    def test_al_in_e164(self):
        self.assertEqual(wa._normaliseer_telefoon("31612345678"), "31612345678")

    def test_spaties_worden_gestript(self):
        self.assertEqual(wa._normaliseer_telefoon("06 12 34 56 78"), "31612345678")

    def test_koppeltekens_worden_gestript(self):
        self.assertEqual(wa._normaliseer_telefoon("06-12-34-56-78"), "31612345678")


class TestStuurWhatsappTemplate(unittest.TestCase):
    """Meta Cloud API wordt correct aangeroepen."""

    @patch("__init__.requests.post")
    def test_stuurt_naar_juiste_url(self, mock_post):
        mock_post.return_value = MagicMock(**{
            "json.return_value": {"messages": [{"id": "wamid.test123"}]}
        })
        with patch("__init__.WHATSAPP_PHONE_NUMBER_ID", "12345"):
            wa._stuur_whatsapp_template("31612345678", "Jan")

        url = mock_post.call_args.args[0]
        self.assertIn("12345", url)
        self.assertIn("graph.facebook.com", url)

    @patch("__init__.requests.post")
    def test_stuurt_voornaam_als_eerste_parameter(self, mock_post):
        mock_post.return_value = MagicMock(**{
            "json.return_value": {"messages": [{"id": "wamid.test123"}]}
        })

        wa._stuur_whatsapp_template("31612345678", "Jan")

        body = mock_post.call_args.kwargs["json"]
        params = body["template"]["components"][0]["parameters"]
        self.assertEqual(params[0]["text"], "Jan")

    @patch("__init__.requests.post")
    def test_stuurt_groepslink_als_tweede_parameter(self, mock_post):
        mock_post.return_value = MagicMock(**{
            "json.return_value": {"messages": [{"id": "wamid.test123"}]}
        })
        with patch("__init__.WHATSAPP_GROEP_UITNODIGING_URL", "https://chat.whatsapp.com/test"):
            wa._stuur_whatsapp_template("31612345678", "Jan")

        body = mock_post.call_args.kwargs["json"]
        params = body["template"]["components"][0]["parameters"]
        self.assertEqual(params[1]["text"], "https://chat.whatsapp.com/test")

    @patch("__init__.requests.post")
    def test_messaging_product_is_whatsapp(self, mock_post):
        mock_post.return_value = MagicMock(**{
            "json.return_value": {"messages": [{"id": "wamid.test123"}]}
        })

        wa._stuur_whatsapp_template("31612345678", "Jan")

        body = mock_post.call_args.kwargs["json"]
        self.assertEqual(body["messaging_product"], "whatsapp")

    @patch("__init__.requests.post")
    def test_geeft_json_response_terug(self, mock_post):
        mock_post.return_value = MagicMock(**{
            "json.return_value": {"messages": [{"id": "wamid.test123"}]}
        })

        result = wa._stuur_whatsapp_template("31612345678", "Jan")

        self.assertIn("messages", result)
        self.assertEqual(result["messages"][0]["id"], "wamid.test123")


class TestValidatieEnHandler(unittest.TestCase):
    """Main valideert verplichte velden en handelt fouten af."""

    def _maak_request(self, body: dict):
        import azure.functions as func
        return func.HttpRequest(
            method="POST",
            url="/api/whatsapp-uitnodiging",
            body=json.dumps(body).encode(),
            headers={"Content-Type": "application/json"},
            params={},
        )

    def _goed_payload(self, **overrides):
        base = {
            "voornaam":   "Jan",
            "achternaam": "Jansen",
            "telefoon":   "0612345678",
            "order_id":   "42",
        }
        base.update(overrides)
        return base

    def test_ontbrekend_voornaam_geeft_400(self):
        body = self._goed_payload()
        del body["voornaam"]
        self.assertEqual(wa.main(self._maak_request(body)).status_code, 400)

    def test_ontbrekend_telefoon_geeft_400(self):
        body = self._goed_payload()
        del body["telefoon"]
        self.assertEqual(wa.main(self._maak_request(body)).status_code, 400)

    def test_ontbrekend_order_id_geeft_400(self):
        body = self._goed_payload()
        del body["order_id"]
        self.assertEqual(wa.main(self._maak_request(body)).status_code, 400)

    def test_ongeldige_json_geeft_400(self):
        import azure.functions as func
        req = func.HttpRequest(
            method="POST",
            url="/api/whatsapp-uitnodiging",
            body=b"geen json",
            headers={"Content-Type": "application/json"},
            params={},
        )
        self.assertEqual(wa.main(req).status_code, 400)

    @patch("__init__._stuur_whatsapp_template")
    def test_succesvol_verzoek_geeft_200(self, mock_stuur):
        mock_stuur.return_value = {"messages": [{"id": "wamid.test123"}]}
        response = wa.main(self._maak_request(self._goed_payload()))
        self.assertEqual(response.status_code, 200)

    @patch("__init__._stuur_whatsapp_template")
    def test_response_bevat_bericht_id(self, mock_stuur):
        mock_stuur.return_value = {"messages": [{"id": "wamid.test123"}]}
        response = wa.main(self._maak_request(self._goed_payload()))
        data = json.loads(response.get_body())
        self.assertEqual(data["bericht_id"], "wamid.test123")

    @patch("__init__._stuur_whatsapp_template")
    def test_telefoon_wordt_genormaliseerd_voor_api_aanroep(self, mock_stuur):
        mock_stuur.return_value = {"messages": [{"id": "wamid.test123"}]}
        wa.main(self._maak_request(self._goed_payload(telefoon="0612345678")))
        self.assertEqual(mock_stuur.call_args.args[0], "31612345678")

    @patch("__init__._stuur_whatsapp_template")
    def test_meta_api_fout_geeft_502(self, mock_stuur):
        import requests as req_lib
        mock_response = MagicMock()
        mock_response.status_code = 400
        mock_response.text = "Bad Request"
        mock_stuur.side_effect = req_lib.HTTPError(response=mock_response)
        response = wa.main(self._maak_request(self._goed_payload()))
        self.assertEqual(response.status_code, 502)
