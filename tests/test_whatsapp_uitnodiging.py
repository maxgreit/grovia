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
