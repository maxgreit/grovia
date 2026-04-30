"""
Testscript: Mollie Betaallink Azure Function
Simuleert een aanroep zoals FunnelKit die zou doen na het toewijzen van StuurBetaallinkAssessment.

Gebruik:
  python test_mollie_betaallink.py

Zorg dat de function lokaal draait:
  func start

Zorg dat in local.settings.json is ingesteld:
  MOLLIE_API_KEY       -- test_... sleutel van je Mollie testaccount
  MOLLIE_REDIRECT_URL  -- bijv. https://grovia.nl/bedankt (of een tijdelijk adres)
  GROVIA_DEBUG_EMAIL   -- optioneel: stuurt e-mail hierheen i.p.v. naar klant
"""

import json
import requests

# ── Aanpassen voor je test ──────────────────────────────────────────────────

FUNCTION_URL = "http://localhost:7071/api/mollie-betaallink"

PAYLOAD = {
    "voornaam":     "Jan",
    "achternaam":   "Jansen",
    "email":        "max@greit.nl",
    "wc_klant_id":  "12345",
    "bedrag":       "20.00",
    "seizoen":      "2627",
    "beschrijving": "Grovia C2 inschrijving halverwege seizoen",
}

# ────────────────────────────────────────────────────────────────────────────


def main():
    print("── Mollie Betaallink testverzoek ───────────────────────")
    print(f"URL    : {FUNCTION_URL}")
    print(f"Payload:\n{json.dumps(PAYLOAD, indent=2, ensure_ascii=False)}")
    print("────────────────────────────────────────────────────────")

    try:
        response = requests.post(FUNCTION_URL, json=PAYLOAD, timeout=30)
    except requests.ConnectionError:
        print("\nFOUT: Kan geen verbinding maken. Draait de function lokaal?")
        print("Start met: func start")
        return

    print(f"\nStatus: {response.status_code}")

    try:
        body = response.json()
        print(f"Respons:\n{json.dumps(body, indent=2, ensure_ascii=False)}")

        if response.ok and body.get("betaallink"):
            print(f"\n✓ Betaallink ontvangen — stuur deze mee in de e-mail:")
            print(f"  {body['betaallink']}")
            print(f"\n  Open de link om de testbetaling te voltooien in het Mollie dashboard.")
    except ValueError:
        print(f"Respons (tekst): {response.text}")


if __name__ == "__main__":
    main()
