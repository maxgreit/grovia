"""
Testscript: Ixly Aanmelding Azure Function
Simuleert een aanroep zoals FunnelKit die zou doen.

Gebruik:
  python test_ixly_aanmelding.py

Zorg dat de function lokaal draait:
  func start
"""

import json
import requests

# ── Aanpassen voor je test ──────────────────────────────────────────────────

FUNCTION_URL = "http://localhost:7071/api/ixly-aanmelding"

PAYLOAD = {
    "voornaam": "Jan",
    "achternaam": "Jansen",
    "email": "jan.jansen@voorbeeld.nl",
    "wc_klant_id": "12345",
    "assessment_uuid": "VUL-IN-UUID-UIT-IXLY",
    "task_type": "Task",
    # Informatief: de tag die FunnelKit heeft toegewezen (niet verplicht voor de function)
    "tag_naam": "SUC12627",
}

# ────────────────────────────────────────────────────────────────────────────


def main():
    print("── Ixly Aanmelding testverzoek ─────────────────────────")
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

        if response.ok and body.get("login_url"):
            print(f"\n✓ login_url ontvangen — stuur deze mee in de e-mail:")
            print(f"  {body['login_url']}")
    except ValueError:
        print(f"Respons (tekst): {response.text}")


if __name__ == "__main__":
    main()
