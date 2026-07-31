"""
Unit tests voor de gedeelde mailmodule.
Gebruik: pytest tests/test_grovia_mail.py -v
"""
import os
import sys
import unittest
import unittest.mock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from grovia_shared import grovia_mail


class TestBouwPrefillUrl(unittest.TestCase):
    """De formulierlink krijgt code en naam als vooringevulde velden."""

    BASIS = "https://docs.google.com/forms/d/e/FORMID/viewform"
    ENTRIES = {"code": "123456", "naam": "654321"}

    def test_bevat_pp_url_marker(self):
        url = grovia_mail.bouw_prefill_url(self.BASIS, self.ENTRIES, "935", "Freddie Rood")
        self.assertIn("usp=pp_url", url)

    def test_bevat_code_als_entry(self):
        url = grovia_mail.bouw_prefill_url(self.BASIS, self.ENTRIES, "935", "Freddie Rood")
        self.assertIn("entry.123456=935", url)

    def test_naam_wordt_url_gecodeerd(self):
        url = grovia_mail.bouw_prefill_url(self.BASIS, self.ENTRIES, "935", "Freddie Rood")
        self.assertIn("entry.654321=Freddie+Rood", url)

    def test_zonder_entry_ids_blijft_basis_url(self):
        url = grovia_mail.bouw_prefill_url(self.BASIS, {}, "935", "Freddie Rood")
        self.assertEqual(url, self.BASIS)


class TestBouwUitnodiging(unittest.TestCase):
    """De uitnodigingsmail houdt zijn bestaande inhoud."""

    ASSIGNMENTS = [
        {"naam": "Blocks Game", "login_url": "https://ixly.test/blocks"},
        {"naam": "Rally Game",  "login_url": "https://ixly.test/rally"},
    ]

    def _bouw(self, school_code="KA"):
        return grovia_mail.bouw_uitnodiging(
            "Max", self.ASSIGNMENTS, school_code, "935", "Freddie Rood"
        )

    def test_onderwerp_ongewijzigd(self):
        onderwerp, _, _ = self._bouw()
        self.assertEqual(onderwerp, "Tijd voor de Grovia games en de Action Type test")

    def test_beide_gamelinks_in_tekst(self):
        _, tekst, _ = self._bouw()
        self.assertIn("https://ixly.test/blocks", tekst)
        self.assertIn("https://ixly.test/rally", tekst)

    def test_beide_gamelinks_in_html(self):
        _, _, html = self._bouw()
        self.assertIn("https://ixly.test/blocks", html)
        self.assertIn("https://ixly.test/rally", html)

    def test_afsluiting_per_vereniging(self):
        _, tekst, _ = self._bouw("KA")
        self.assertIn("Kolping Academie", tekst)

    def test_onbekende_school_geeft_none(self):
        self.assertIsNone(grovia_mail.bouw_uitnodiging("Max", self.ASSIGNMENTS, "MM", "935", "Kind"))

    def test_action_type_link_bevat_controlecode(self):
        with unittest.mock.patch.dict(
            grovia_mail.SCHOOL_DATA["KA"],
            {"form_url": "https://forms.test/ka", "entry_ids": {"code": "111", "naam": "222"}},
        ):
            _, tekst, html = self._bouw()
        self.assertIn("entry.111=935", tekst)
        self.assertIn("entry.111=935", html)

    def test_action_type_link_bevat_naam_kind(self):
        with unittest.mock.patch.dict(
            grovia_mail.SCHOOL_DATA["KA"],
            {"form_url": "https://forms.test/ka", "entry_ids": {"code": "111", "naam": "222"}},
        ):
            _, tekst, _ = self._bouw()
        self.assertIn("entry.222=Freddie+Rood", tekst)

    def test_geen_instructie_om_naam_te_typen(self):
        _, tekst, html = self._bouw()
        self.assertNotIn("volledige naam", tekst)
        self.assertNotIn("volledige naam", html)

    def test_ontbrekende_code_entry_geeft_waarschuwing(self):
        # Bevinding 5: SCHOOL_DATA zet entry_ids altijd als {'code': '', 'naam': ''}
        # (nooit een leeg dict), dus de guard in bouw_prefill_url wordt nooit geraakt.
        # Met lege omgevingsvariabelen moet dit stil gebeuren via logging.error i.p.v.
        # helemaal niet gemeld worden.
        with unittest.mock.patch.dict(
            grovia_mail.SCHOOL_DATA["KA"],
            {"entry_ids": {"code": "", "naam": ""}},
        ), self.assertLogs(level="ERROR") as log:
            resultaat = self._bouw()

        self.assertTrue(any("ACTION_TYPE_ENTRY_CODE_KA" in regel for regel in log.output))
        # Waarschuwing, geen harde stop: de mail wordt gewoon nog gebouwd.
        self.assertIsNotNone(resultaat)

    def test_ontbrekende_code_entry_bouwt_de_mail_nog_gewoon(self):
        with unittest.mock.patch.dict(
            grovia_mail.SCHOOL_DATA["KA"],
            {"entry_ids": {"code": "", "naam": ""}},
        ), unittest.mock.patch.object(grovia_mail, "logging"):
            onderwerp, tekst, html = self._bouw()

        self.assertTrue(onderwerp)
        self.assertTrue(tekst)
        self.assertTrue(html)


class TestBouwHerinnering(unittest.TestCase):
    """Bevinding 5: dezelfde waarschuwing moet ook in bouw_herinnering staan."""

    ASSIGNMENTS = [
        {"naam": "Blocks Game", "login_url": "https://ixly.test/blocks"},
    ]

    def _bouw(self, open_testen=None):
        return grovia_mail.bouw_herinnering(
            "Max", "Freddie Rood", "KA", "935",
            open_testen if open_testen is not None else ["action_type"],
            self.ASSIGNMENTS,
        )

    def test_ontbrekende_code_entry_geeft_waarschuwing(self):
        with unittest.mock.patch.dict(
            grovia_mail.SCHOOL_DATA["KA"],
            {"entry_ids": {"code": "", "naam": ""}},
        ), self.assertLogs(level="ERROR") as log:
            resultaat = self._bouw()

        self.assertTrue(any("ACTION_TYPE_ENTRY_CODE_KA" in regel for regel in log.output))
        self.assertIsNotNone(resultaat)

    def test_ontbrekende_code_entry_bouwt_de_mail_nog_gewoon(self):
        with unittest.mock.patch.dict(
            grovia_mail.SCHOOL_DATA["KA"],
            {"entry_ids": {"code": "", "naam": ""}},
        ), unittest.mock.patch.object(grovia_mail, "logging"):
            onderwerp, tekst, html = self._bouw()

        self.assertTrue(onderwerp)
        self.assertTrue(tekst)
        self.assertTrue(html)

    def test_zonder_open_action_type_geen_waarschuwing_nodig(self):
        # Als action_type niet in open_testen zit, wordt bouw_prefill_url niet
        # aangeroepen voor dat blok -- geen valse waarschuwing.
        with unittest.mock.patch.dict(
            grovia_mail.SCHOOL_DATA["KA"],
            {"entry_ids": {"code": "", "naam": ""}},
        ), unittest.mock.patch.object(grovia_mail, "logging") as mock_logging:
            self._bouw(open_testen=["ixly"])

        mock_logging.error.assert_not_called()


class TestVerstuur(unittest.TestCase):
    """Verzending respecteert de SMTP-configuratie."""

    def test_zonder_smtp_host_geen_verzending(self):
        with unittest.mock.patch.object(grovia_mail, "SMTP_HOST", ""), \
             unittest.mock.patch.object(grovia_mail, "smtplib") as mock_smtp:
            grovia_mail.verstuur("a@b.nl", "Onderwerp", "tekst", "<p>html</p>")
            mock_smtp.SMTP.assert_not_called()

    def test_debug_adres_overschrijft_ontvanger(self):
        with unittest.mock.patch.object(grovia_mail, "SMTP_HOST", "smtp.test"), \
             unittest.mock.patch.object(grovia_mail, "GROVIA_DEBUG_EMAIL", "debug@test.nl"), \
             unittest.mock.patch.object(grovia_mail, "smtplib") as mock_smtp:
            grovia_mail.verstuur("ouder@test.nl", "Onderwerp", "tekst", "<p>html</p>")
            server = mock_smtp.SMTP.return_value.__enter__.return_value
            self.assertEqual(server.sendmail.call_args.args[1], "debug@test.nl")


if __name__ == "__main__":
    unittest.main()
