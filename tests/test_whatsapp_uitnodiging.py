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
