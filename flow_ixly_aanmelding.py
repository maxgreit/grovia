"""
Ixly Aanmelding Flow — testscript

Voert de volledige aanmeldingsflow stap voor stap uit:
  1. User access token ophalen (managed organizations flow)
  2. Candidate upsert — zoek op via api_identifier, maak aan als niet gevonden
  3. Assignments aanmaken voor alle taken in TAKEN
  4. login_urls tonen

Credentials worden gelezen uit local.settings.json of omgevingsvariabelen.

Gebruik:
  python flow_ixly_aanmelding.py
"""

import json
import os
import sys
from pathlib import Path

import requests

# ── Configuratie ──────────────────────────────────────────────────────────────

def _laad_instellingen() -> dict:
    settings_pad = Path(__file__).parent / "local.settings.json"
    if settings_pad.exists():
        data = json.loads(settings_pad.read_text())
        return data.get("Values", {})
    return {}

_instellingen = _laad_instellingen()

BASE_URL      = _instellingen.get("IXLY_BASE_URL")          or os.environ.get("IXLY_BASE_URL", "")
CLIENT_ID     = _instellingen.get("IXLY_CLIENT_ID")         or os.environ.get("IXLY_CLIENT_ID", "")
CLIENT_SECRET = _instellingen.get("IXLY_CLIENT_SECRET")     or os.environ.get("IXLY_CLIENT_SECRET", "")
ORG_UUID      = _instellingen.get("IXLY_ORGANIZATION_UUID") or os.environ.get("IXLY_ORGANIZATION_UUID", "")
REDIRECT_URI  = _instellingen.get("IXLY_REDIRECT_URI")      or os.environ.get("IXLY_REDIRECT_URI", "")

# ── Taken die aan elke kandidaat worden toegekend ─────────────────────────────

TAKEN = [
    {"naam": "Blocks Game", "uuid": "2a04b8bc-486f-4b9a-924a-26199b75be9c", "type": "Task"},
    {"naam": "Rally Game",  "uuid": "4464b991-268f-45f7-860a-e5b109160612", "type": "Task"},
]

# ── Helpers ───────────────────────────────────────────────────────────────────

def _stap(nummer: int, label: str) -> None:
    print(f"\n{'─'*50}")
    print(f"  Stap {nummer}: {label}")
    print(f"{'─'*50}")


def _log_request(methode: str, url: str, body: dict | None = None) -> None:
    print(f"  {methode} {url}")
    if body:
        print(f"  Body: {json.dumps(body, ensure_ascii=False)}")


def _log_response(response: requests.Response) -> None:
    print(f"  Status: {response.status_code}")
    try:
        print(json.dumps(response.json(), indent=2, ensure_ascii=False))
    except ValueError:
        print(f"  {response.text}")


def _headers(token: str) -> dict:
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

# ── Auth ──────────────────────────────────────────────────────────────────────

def _haal_app_token_op() -> str:
    url = f"{BASE_URL}/oauth/token"
    _log_request("POST", url)
    response = requests.post(url, data={
        "grant_type":    "client_credentials",
        "client_id":     CLIENT_ID,
        "client_secret": CLIENT_SECRET,
    }, timeout=15)
    _log_response(response)
    response.raise_for_status()
    return response.json()["access_token"]


def _haal_grant_token_op(app_token: str) -> str:
    url = f"{BASE_URL}/api/public/managed_organizations/{ORG_UUID}"
    _log_request("GET", url)
    response = requests.get(url, headers={"Authorization": f"Bearer {app_token}", "Accept": "application/json"}, timeout=15)
    _log_response(response)
    response.raise_for_status()

    included = response.json().get("included", [])
    grant_token = next(
        (item["attributes"]["access_grant"]
         for item in included
         if item.get("type") == "api_user" and item.get("attributes", {}).get("access_grant")),
        None,
    )
    if not grant_token:
        raise ValueError("access_grant niet gevonden in included[] — zie response hierboven.")
    return grant_token


def _wissel_grant_token_in(grant_token: str) -> str:
    url = f"{BASE_URL}/oauth/token"
    body = {
        "grant_type":    "authorization_code",
        "client_id":     CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "code":          grant_token,
    }
    if REDIRECT_URI:
        body["redirect_uri"] = REDIRECT_URI
    _log_request("POST", url)
    response = requests.post(url, data=body, timeout=15)
    _log_response(response)
    response.raise_for_status()
    return response.json()["access_token"]


def haal_user_token_op() -> str:
    app_token   = _haal_app_token_op()
    grant_token = _haal_grant_token_op(app_token)
    return _wissel_grant_token_in(grant_token)

# ── Candidate upsert ──────────────────────────────────────────────────────────

def _zoek_candidate_op(token: str, api_identifier: str) -> dict | None:
    url = f"{BASE_URL}/api/public/candidates/api_identifier/{api_identifier}"
    _log_request("GET", url)
    response = requests.get(url, headers=_headers(token), timeout=15)
    _log_response(response)
    if response.status_code == 404:
        return None
    response.raise_for_status()
    return response.json()["data"]


def _maak_candidate_aan(token: str, gegevens: dict) -> dict:
    url = f"{BASE_URL}/api/public/candidates"
    body = {
        "candidate": {
            "first_name":     gegevens["voornaam"],
            "last_name":      gegevens["achternaam"],
            "email":          gegevens["email"],
            "language":       "nl",
            "api_identifier": str(gegevens["wc_klant_id"]),
        }
    }
    _log_request("POST", url, body)
    response = requests.post(url, headers=_headers(token), json=body, timeout=15)
    _log_response(response)
    response.raise_for_status()
    return response.json()["data"]


def candidate_upsert(token: str, gegevens: dict) -> tuple[dict, bool]:
    candidate = _zoek_candidate_op(token, str(gegevens["wc_klant_id"]))
    if candidate:
        print("\n  Candidate gevonden — geen nieuw profiel aangemaakt.")
        return candidate, False
    print("\n  Candidate niet gevonden — nieuw profiel aanmaken.")
    candidate = _maak_candidate_aan(token, gegevens)
    return candidate, True

# ── Assignment ────────────────────────────────────────────────────────────────

def maak_assignment_aan(token: str, candidate_uuid: str, taak: dict) -> dict:
    url = f"{BASE_URL}/api/public/assignments"
    body = {
        "assignment": {
            "candidate_uuid": candidate_uuid,
            "task_type":      taak["type"],
            "task_uuid":      taak["uuid"],
        }
    }
    _log_request("POST", url, body)
    response = requests.post(url, headers=_headers(token), json=body, timeout=15)
    _log_response(response)
    response.raise_for_status()
    return response.json()["data"]

# ── Invoer ────────────────────────────────────────────────────────────────────

def vraag_gegevens() -> dict:
    print("\n  Vul de kandidaatgegevens in:\n")

    def vraag(label: str) -> str:
        waarde = input(f"  {label}: ").strip()
        return waarde

    voornaam    = vraag("Voornaam")
    achternaam  = vraag("Achternaam")
    email       = vraag("E-mailadres")
    wc_klant_id = vraag("WooCommerce klant-ID (api_identifier)")

    ontbrekend = [k for k, v in {
        "voornaam": voornaam, "achternaam": achternaam,
        "email": email, "wc_klant_id": wc_klant_id,
    }.items() if not v]

    if ontbrekend:
        print(f"\n  FOUT: verplichte velden ontbreken: {', '.join(ontbrekend)}")
        sys.exit(1)

    return {
        "voornaam":    voornaam,
        "achternaam":  achternaam,
        "email":       email,
        "wc_klant_id": wc_klant_id,
    }

# ── Hoofdflow ─────────────────────────────────────────────────────────────────

def main() -> None:
    print("\n╔══════════════════════════════════════╗")
    print("║   Ixly Aanmelding Flow               ║")
    print("╚══════════════════════════════════════╝")

    if not BASE_URL or not CLIENT_ID or not CLIENT_SECRET or not ORG_UUID or not REDIRECT_URI:
        print("\nFOUT: een of meer Ixly-credentials ontbreken in local.settings.json.")
        print("Verwacht: IXLY_BASE_URL, IXLY_CLIENT_ID, IXLY_CLIENT_SECRET, IXLY_ORGANIZATION_UUID, IXLY_REDIRECT_URI")
        sys.exit(1)

    print(f"\n  Server  : {BASE_URL}")
    print(f"  Org UUID: {ORG_UUID}")
    print(f"\n  Taken die worden toegekend:")
    for taak in TAKEN:
        print(f"    - {taak['naam']} ({taak['uuid']})")

    gegevens = vraag_gegevens()

    try:
        _stap(1, "User access token ophalen")
        token = haal_user_token_op()
        print("\n  Token verkregen.")

        _stap(2, "Candidate upsert (opzoeken of aanmaken)")
        candidate, nieuw = candidate_upsert(token, gegevens)
        candidate_uuid = candidate["id"]
        status_label = "nieuw aangemaakt" if nieuw else "bestaand"
        print(f"\n  Candidate UUID ({status_label}): {candidate_uuid}")

        resultaten = []
        sign_up_url = None
        for i, taak in enumerate(TAKEN, start=1):
            _stap(2 + i, f"Assignment aanmaken — {taak['naam']}")
            assignment = maak_assignment_aan(token, candidate_uuid, taak)
            links = assignment.get("links", {})
            if not sign_up_url:
                sign_up_url = links.get("sign_up_url")
            resultaten.append({
                "naam":            taak["naam"],
                "assignment_uuid": assignment["id"],
                "login_url":       links.get("login_url"),
            })

        print(f"\n{'═'*50}")
        print("  RESULTAAT")
        print(f"{'═'*50}")
        print(f"  Candidate UUID : {candidate_uuid}")
        print(f"  Sign-up URL    : {sign_up_url or '(niet gevonden)'}")
        for r in resultaten:
            print(f"\n  {r['naam']}")
            print(f"    Assignment UUID : {r['assignment_uuid']}")
            print(f"    Login URL       : {r['login_url'] or '(niet gevonden)'}")
        print(f"\n{'═'*50}\n")

    except requests.HTTPError as e:
        print(f"\n  FOUT: Ixly API {e.response.status_code} — {e.response.text}")
        sys.exit(1)
    except Exception as e:
        print(f"\n  FOUT: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
