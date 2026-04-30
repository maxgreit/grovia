"""
Ixly API Explorer
Interactief terminal menu voor alle GET-endpoints uit de Ixly swagger.

Gebruik:
  python explore.py

Credentials worden gelezen uit local.settings.json (IXLY_BASE_URL,
IXLY_CLIENT_ID, IXLY_CLIENT_SECRET, IXLY_ORGANIZATION_UUID) of uit omgevingsvariabelen.

Authenticatie (managed organizations flow):
  Stap 1 — app token via client_credentials
  Stap 2 — grant token via managed_organizations/{uuid}
  Stap 3 — user access token via grant token

Als IXLY_ORGANIZATION_UUID niet is ingesteld, start het script in app-token-modus
zodat je de managed organizations lijst kunt opvragen en de UUID kunt noteren.
"""

import json
import os
import sys
from pathlib import Path

import requests

# ── Configuratie ─────────────────────────────────────────────────────────────

def _laad_instellingen() -> dict:
    settings_pad = Path(__file__).parent / "local.settings.json"
    if settings_pad.exists():
        data = json.loads(settings_pad.read_text())
        return data.get("Values", {})
    return {}

_instellingen = _laad_instellingen()

BASE_URL      = _instellingen.get("IXLY_BASE_URL")           or os.environ.get("IXLY_BASE_URL", "")
CLIENT_ID     = _instellingen.get("IXLY_CLIENT_ID")          or os.environ.get("IXLY_CLIENT_ID", "")
CLIENT_SECRET = _instellingen.get("IXLY_CLIENT_SECRET")      or os.environ.get("IXLY_CLIENT_SECRET", "")
ORG_UUID      = _instellingen.get("IXLY_ORGANIZATION_UUID")  or os.environ.get("IXLY_ORGANIZATION_UUID", "")

# ── Menu definitie ────────────────────────────────────────────────────────────

MENU = [
    ("── Algemeen ──────────────────────────────", None, [], []),
    ("Health check",                              "/api/public/health_check",                          [], []),
    ("Managed organizations (lijst)",             "/api/public/managed_organizations",                 [], [("page", "Paginanummer", False)]),
    ("Managed organization (detail)",             "/api/public/managed_organizations/{uuid}",          ["uuid"], []),
    ("Mail templates",                            "/api/public/mail_templates",                        [], []),

    ("── Taken & Programma's ──────────────────", None, [], []),
    ("Tasks (lijst)",                             "/api/public/tasks",                                 [], [("page", "Paginanummer", False), ("language", "Taal (nl/en/de/fr)", False)]),
    ("Task (detail)",                             "/api/public/tasks/{uuid}",                          ["uuid"], []),
    ("Programs (lijst)",                          "/api/public/programs",                              [], [("page", "Paginanummer", False), ("language", "Taal (nl/en/de/fr)", False)]),
    ("Program (detail)",                          "/api/public/programs/{uuid}",                       ["uuid"], []),
    ("Processes (lijst)",                         "/api/public/processes",                             [], []),
    ("Process via api_identifier",                "/api/public/processes/api_identifier/{api_identifier}", ["api_identifier"], []),

    ("── Kandidaten ───────────────────────────", None, [], []),
    ("Candidate (via uuid)",                      "/api/public/candidates/{uuid}",                     ["uuid"], []),
    ("Candidate (via api_identifier)",            "/api/public/candidates/api_identifier/{api_identifier}", ["api_identifier"], []),

    ("── Assignments ──────────────────────────", None, [], []),
    ("Assignment (detail)",                       "/api/public/assignments/{uuid}",                    ["uuid"], []),

    ("── Candidate resultaten ─────────────────", None, [], []),
    ("Candidate process (detail)",                "/api/public/candidate_processes/{uuid}",            ["uuid"], []),
    ("Candidate program (detail)",                "/api/public/candidate_programs/{uuid}",             ["uuid"], []),
    ("Candidate program score",                   "/api/public/candidate_programs/{uuid}/score",       ["uuid"], []),
    ("Candidate task (detail)",                   "/api/public/candidate_tasks/{uuid}",                ["uuid"], []),
    ("Candidate task score",                      "/api/public/candidate_tasks/{uuid}/score",          ["uuid"], []),

    ("── Feedback ─────────────────────────────", None, [], []),
    ("Feedback templates (lijst)",                "/api/public/feedback/templates",                    [], []),
    ("Feedback template (detail)",                "/api/public/feedback/templates/{uuid}",             ["uuid"], []),
    ("Candidate feedbacks (lijst)",               "/api/public/feedback/candidate_feedbacks",          [], []),
    ("Candidate feedback (detail)",               "/api/public/feedback/candidate_feedbacks/{uuid}",   ["uuid"], []),
    ("Respondent groups (lijst)",                 "/api/public/feedback/groups",                       [], []),
    ("Respondent group (detail)",                 "/api/public/feedback/groups/{uuid}",                ["uuid"], []),

    ("── Media ────────────────────────────────", None, [], []),
    ("Candidate media items",                     "/api/public/candidates/{candidate_id}/media_items", ["candidate_id"], [("page", "Paginanummer", False)]),
    ("Candidate media item (detail)",             "/api/public/candidates/{candidate_id}/media_items/{uuid}", ["candidate_id", "uuid"], []),
]

# ── Auth ──────────────────────────────────────────────────────────────────────

def _log_response(label: str, response: requests.Response) -> None:
    print(f"\n  ── {label} ──────────────────────────────")
    print(f"  {response.request.method} {response.request.url}")
    print(f"  Status: {response.status_code}")
    try:
        print(json.dumps(response.json(), indent=2, ensure_ascii=False))
    except ValueError:
        print(response.text)
    print()


def _haal_app_token_op() -> str:
    """Stap 1: app token via client_credentials."""
    response = requests.post(
        f"{BASE_URL}/oauth/token",
        data={
            "grant_type": "client_credentials",
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
        },
        timeout=15,
    )
    _log_response("Stap 1 — app token", response)
    response.raise_for_status()
    return response.json()["access_token"]


def _haal_grant_token_op(app_token: str, org_uuid: str) -> str:
    """Stap 2: grant token via managed organization detail."""
    response = requests.get(
        f"{BASE_URL}/api/public/managed_organizations/{org_uuid}",
        headers={"Authorization": f"Bearer {app_token}", "Accept": "application/json"},
        timeout=15,
    )
    _log_response("Stap 2 — managed organization detail", response)
    response.raise_for_status()
    data = response.json()

    grant_token = (
        data.get("grant_token")
        or data.get("data", {}).get("grant_token")
        or data.get("data", {}).get("attributes", {}).get("grant_token")
    )
    if not grant_token:
        raise ValueError("grant_token niet gevonden in response — zie output hierboven.")
    return grant_token


def _wissel_grant_token_in(grant_token: str) -> str:
    """Stap 3: user access token via grant token."""
    response = requests.post(
        f"{BASE_URL}/oauth/token",
        data={
            "grant_type": "authorization_code",
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
            "code": grant_token,
        },
        timeout=15,
    )
    _log_response("Stap 3 — user access token", response)
    if not response.ok:
        print("  Mogelijk gebruikt Ixly een ander grant_type — check de API-docs.")
        raise requests.HTTPError(response=response)
    return response.json()["access_token"]


def haal_token_op() -> tuple[str, bool]:
    """
    Geeft (token, volledig_auth) terug.
    volledig_auth=True  → user access token (alle endpoints beschikbaar)
    volledig_auth=False → app token (alleen managed_organizations lijst)
    """
    app_token = _haal_app_token_op()

    if not ORG_UUID:
        return app_token, False

    grant_token = _haal_grant_token_op(app_token, ORG_UUID)
    user_token = _wissel_grant_token_in(grant_token)
    return user_token, True

# ── API aanroep ───────────────────────────────────────────────────────────────

def roep_api_aan(token: str, pad: str, query_params: dict) -> None:
    url = BASE_URL.rstrip("/") + ("/" if not pad.startswith("/") else "") + pad
    headers = {"Authorization": f"Bearer {token}", "Accept": "application/json"}

    print(f"\n  GET {url}")
    if query_params:
        print(f"  Query: {query_params}")

    try:
        response = requests.get(url, headers=headers, params=query_params, timeout=15)
    except requests.ConnectionError:
        print("  FOUT: geen verbinding mogelijk.")
        return

    print(f"  Status: {response.status_code}")
    print()

    try:
        body = response.json()
        print(json.dumps(body, indent=2, ensure_ascii=False))
    except ValueError:
        print(response.text)

# ── Menu helpers ──────────────────────────────────────────────────────────────

def toon_menu(volledig_auth: bool) -> None:
    print()
    for i, (label, pad, *_) in enumerate(MENU):
        if pad is None:
            print(f"\n  {label}")
        else:
            print(f"  [{i:2d}] {label}")
    print()
    print("  [ q] Afsluiten")
    if not volledig_auth:
        print()
        print("  LET OP: app-token-modus — alleen managed organizations endpoints werken.")
        print("  Stel IXLY_ORGANIZATION_UUID in voor volledige toegang.")
    print()

def vraag_path_params(namen: list[str]) -> dict | None:
    waarden = {}
    for naam in namen:
        waarde = input(f"  {naam}: ").strip()
        if not waarde:
            print("  Leeggelaten — terug naar menu.")
            return None
        waarden[naam] = waarde
    return waarden

def vraag_query_params(params: list[tuple]) -> dict:
    resultaat = {}
    for naam, beschrijving, verplicht in params:
        suffix = "" if verplicht else " (optioneel, Enter = overslaan)"
        waarde = input(f"  {beschrijving}{suffix}: ").strip()
        if waarde:
            resultaat[naam] = waarde
    return resultaat

def vervang_path_params(pad: str, waarden: dict) -> str:
    for naam, waarde in waarden.items():
        pad = pad.replace(f"{{{naam}}}", waarde)
    return pad

# ── Hoofdlus ──────────────────────────────────────────────────────────────────

def main() -> None:
    print("\n╔══════════════════════════════════════╗")
    print("║      Ixly API Explorer               ║")
    print("╚══════════════════════════════════════╝")

    if not BASE_URL or not CLIENT_ID or not CLIENT_SECRET:
        print("\nFOUT: IXLY_BASE_URL, IXLY_CLIENT_ID of IXLY_CLIENT_SECRET ontbreekt.")
        print("Vul local.settings.json in (zie local.settings.json.example).")
        sys.exit(1)

    if not ORG_UUID:
        print("\nLET OP: IXLY_ORGANIZATION_UUID is niet ingesteld.")
        print("Het script start in app-token-modus — gebruik optie [2] (Managed organizations lijst)")
        print("om je organisatie-UUID op te zoeken en in local.settings.json in te vullen.")

    print(f"\nServer : {BASE_URL}")
    print(f"Org UUID: {ORG_UUID or '(niet ingesteld — app-token-modus)'}")
    print("Token ophalen...", end=" ", flush=True)

    try:
        token, volledig_auth = haal_token_op()
        modus = "user access token" if volledig_auth else "app token (beperkte toegang)"
        print(f"OK ({modus})")
    except Exception as e:
        print(f"MISLUKT\n{e}")
        sys.exit(1)

    while True:
        toon_menu(volledig_auth)
        keuze = input("  Keuze: ").strip().lower()

        if keuze == "q":
            print("\nTot ziens.\n")
            break

        if not keuze.isdigit():
            print("  Ongeldige invoer.")
            continue

        index = int(keuze)
        if index < 0 or index >= len(MENU):
            print("  Nummer buiten bereik.")
            continue

        label, pad, path_param_namen, query_param_defs = MENU[index]

        if pad is None:
            print("  Dat is een sectiekop, geen endpoint.")
            continue

        path_waarden = {}
        if path_param_namen:
            print(f"\n  Vul de path-parameters in voor: {pad}")
            path_waarden = vraag_path_params(path_param_namen)
            if path_waarden is None:
                continue

        query_waarden = {}
        if query_param_defs:
            print(f"\n  Query-parameters (optioneel):")
            query_waarden = vraag_query_params(query_param_defs)

        volledig_pad = vervang_path_params(pad, path_waarden)
        roep_api_aan(token, volledig_pad, query_waarden)

        input("\n  [Enter] terug naar menu")


if __name__ == "__main__":
    main()
