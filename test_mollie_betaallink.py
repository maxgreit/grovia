"""
Testscript: Mollie Betaallink Azure Function
Simuleert een aanroep zoals FunnelKit die zou doen na het toewijzen van StuurBetaallinkAssessment.

Gebruik:
  python test_mollie_betaallink.py

Stel in local.settings.json in:
  TEST_FUNCTION_URL  -- http://localhost:7071/api/mollie-betaallink (lokaal)
                     -- of de volledige Azure URL incl. ?code=... (live)
  TEST_FUNCTION_KEY  -- leeg voor lokaal, function key voor live Azure
"""

import json
import os
import requests


def _laad_env() -> dict:
    pad = os.path.join(os.path.dirname(__file__), ".env")
    env = {}
    if not os.path.exists(pad):
        return env
    with open(pad) as f:
        for regel in f:
            regel = regel.strip()
            if regel and not regel.startswith("#") and "=" in regel:
                sleutel, _, waarde = regel.partition("=")
                env[sleutel.strip()] = waarde.strip()
    return env


_env          = _laad_env()
_basis_url    = _env.get("TEST_FUNCTION_URL", "http://localhost:7071/api/mollie-betaallink")
_function_key = _env.get("TEST_FUNCTION_KEY", "")

FUNCTION_URL = f"{_basis_url}?code={_function_key}" if _function_key else _basis_url

PAYLOAD = {
    "voornaam":     "Jan",
    "achternaam":   "Jansen",
    "email":        "max@greit.nl",
    "wc_klant_id":  "12345",
    "bedrag":       "20.00",
    "seizoen":      "2627",
    "beschrijving": "Grovia C2 inschrijving halverwege seizoen",
}


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
