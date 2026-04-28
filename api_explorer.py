"""
Ixly AssessmentPlatform API Explorer
Haalt de output van alle endpoints op, toont ze als DataFrames
en slaat ze op als CSV in de map csv_output/.
"""

import os
import requests
import pandas as pd

pd.set_option("display.max_columns", None)
pd.set_option("display.max_colwidth", 80)

# ─── CONFIGURATIE ─────────────────────────────────────────────────────────────
BASE_URL      = "https://JOUW_DOMEIN.ixly.nl"   # pas aan
CLIENT_ID     = "JOUW_CLIENT_ID"                 # pas aan
CLIENT_SECRET = "JOUW_CLIENT_SECRET"             # pas aan

# Optioneel: vul in voor kandidaat-specifieke endpoints
CANDIDATE_UUID         = ""
CANDIDATE_PROCESS_UUID = ""
CANDIDATE_PROGRAM_UUID = ""
CANDIDATE_TASK_UUID    = ""
ASSIGNMENT_UUID        = ""
USER_ID                = ""   # voor media items
# ──────────────────────────────────────────────────────────────────────────────

CSV_DIR = "csv_output"
os.makedirs(CSV_DIR, exist_ok=True)


# ── Auth ──────────────────────────────────────────────────────────────────────

def get_token():
    resp = requests.post(
        f"{BASE_URL}/oauth/token",
        data={
            "grant_type":    "client_credentials",
            "client_id":     CLIENT_ID,
            "client_secret": CLIENT_SECRET,
            "scope":         "public",
        },
    )
    resp.raise_for_status()
    return resp.json()["access_token"]


# ── Helpers ───────────────────────────────────────────────────────────────────

def get(path, headers, params=None):
    resp = requests.get(f"{BASE_URL}{path}", headers=headers, params=params)
    if not resp.ok:
        print(f"  ⚠ {resp.status_code} op {path}: {resp.text[:200]}")
        return None
    return resp.json()


def jsonapi_to_df(data):
    if data is None:
        return pd.DataFrame()

    items = data.get("data", data)
    if isinstance(items, dict):
        items = [items]
    if not isinstance(items, list) or not items:
        return pd.DataFrame()

    rows = []
    for item in items:
        row = {"id": item.get("id"), "type": item.get("type")}
        row.update(item.get("attributes", {}) or {})
        for k, v in (item.get("links") or {}).items():
            row[f"link_{k}"] = v
        for rel, rel_data in (item.get("relationships") or {}).items():
            inner = (rel_data or {}).get("data")
            if isinstance(inner, dict):
                row[f"rel_{rel}_id"] = inner.get("id")
            elif isinstance(inner, list):
                row[f"rel_{rel}_ids"] = ", ".join(i.get("id", "") for i in inner)
        rows.append(row)

    return pd.DataFrame(rows)


def fetch_paginated(path, headers, params=None):
    params = dict(params or {})
    params.setdefault("page", 1)
    all_items = []
    while True:
        data = get(path, headers, params)
        if data is None:
            break
        items = data.get("data", [])
        if not items:
            break
        all_items.extend(items)
        if not (data.get("links") or {}).get("next"):
            break
        params["page"] += 1
    return {"data": all_items}


def show_and_save(name, df):
    if df.empty:
        print(f"[{name}] — geen data")
        return df
    path = os.path.join(CSV_DIR, f"{name}.csv")
    df.to_csv(path, index=False)
    print(f"[{name}] {len(df)} rijen, {len(df.columns)} kolommen → {path}")
    return df


def section(title):
    print(f"\n{'─' * 60}")
    print(f"  {title}")
    print(f"{'─' * 60}")


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("Token ophalen...")
    token = get_token()
    headers = {"Authorization": f"Bearer {token}", "Accept": "application/json"}
    print("Token opgehaald.")

    # ── Health check ──────────────────────────────────────────────────────────
    section("Health Check")
    raw = get("/api/public/health_check", headers)
    df_health = pd.DataFrame([raw]) if raw else pd.DataFrame()
    show_and_save("health_check", df_health)
    print(df_health.to_string(index=False))

    # ── Mail templates ────────────────────────────────────────────────────────
    section("Mail Templates")
    raw = get("/api/public/mail_templates", headers)
    df_mail_templates = jsonapi_to_df(raw)
    show_and_save("mail_templates", df_mail_templates)
    print(df_mail_templates.to_string(index=False))

    # ── Processes ─────────────────────────────────────────────────────────────
    section("Processes")
    raw = get("/api/public/processes", headers)
    df_processes = jsonapi_to_df(raw)
    show_and_save("processes", df_processes)
    print(df_processes.to_string(index=False))

    # ── Programs ──────────────────────────────────────────────────────────────
    section("Programs (alle pagina's)")
    raw = fetch_paginated("/api/public/programs", headers)
    df_programs = jsonapi_to_df(raw)
    show_and_save("programs", df_programs)
    print(df_programs.to_string(index=False))

    # ── Tasks ─────────────────────────────────────────────────────────────────
    section("Tasks (alle pagina's)")
    raw = fetch_paginated("/api/public/tasks", headers)
    df_tasks = jsonapi_to_df(raw)
    show_and_save("tasks", df_tasks)
    print(df_tasks.to_string(index=False))

    # ── Managed Organizations ─────────────────────────────────────────────────
    section("Managed Organizations (alle pagina's)")
    raw = fetch_paginated("/api/public/managed_organizations", headers)
    df_orgs = jsonapi_to_df(raw)
    show_and_save("managed_organizations", df_orgs)
    print(df_orgs.to_string(index=False))

    # ── Feedback – candidate feedbacks ────────────────────────────────────────
    section("Feedback – Candidate Feedbacks")
    raw = get("/api/public/feedback/candidate_feedbacks", headers)
    df_feedbacks = jsonapi_to_df(raw)
    show_and_save("feedback_candidate_feedbacks", df_feedbacks)
    print(df_feedbacks.to_string(index=False))

    # ── Feedback – templates ──────────────────────────────────────────────────
    section("Feedback – Templates")
    raw = get("/api/public/feedback/templates", headers)
    df_feedback_templates = jsonapi_to_df(raw)
    show_and_save("feedback_templates", df_feedback_templates)
    print(df_feedback_templates.to_string(index=False))

    # ── Feedback – respondent groups ──────────────────────────────────────────
    section("Feedback – Respondent Groups")
    raw = get("/api/public/feedback/groups", headers)
    df_groups = jsonapi_to_df(raw)
    show_and_save("feedback_groups", df_groups)
    print(df_groups.to_string(index=False))

    # ── Detail-endpoints (eerste UUID uit lijsten) ────────────────────────────
    section("Detail-endpoints (eerste UUID uit lijsten)")

    for label, df_list, path_tpl in [
        ("process_detail",  df_processes, "/api/public/processes/{}"),
        ("program_detail",  df_programs,  "/api/public/programs/{}"),
        ("task_detail",     df_tasks,     "/api/public/tasks/{}"),
    ]:
        if df_list.empty:
            print(f"[{label}] overgeslagen (lijst leeg)")
            continue
        uuid = df_list.iloc[0]["id"]
        raw = get(path_tpl.format(uuid), headers)
        df = jsonapi_to_df(raw)
        show_and_save(label, df)
        print(df.to_string(index=False))

    if not df_orgs.empty:
        uuid = df_orgs.iloc[0]["id"]
        raw = get(f"/api/public/managed_organizations/{uuid}", headers)
        df = jsonapi_to_df(raw)
        show_and_save("managed_organization_detail", df)
        print(df.to_string(index=False))
        if raw and raw.get("included"):
            df_inc = pd.json_normalize(raw["included"])
            show_and_save("managed_organization_api_users", df_inc)
            print(df_inc.to_string(index=False))

    if not df_feedbacks.empty:
        uuid = df_feedbacks.iloc[0]["id"]
        raw = get(f"/api/public/feedback/candidate_feedbacks/{uuid}", headers)
        df = jsonapi_to_df(raw)
        show_and_save("feedback_candidate_feedback_detail", df)
        print(df.to_string(index=False))

    if not df_feedback_templates.empty:
        uuid = df_feedback_templates.iloc[0]["id"]
        raw = get(f"/api/public/feedback/templates/{uuid}", headers)
        df = jsonapi_to_df(raw)
        show_and_save("feedback_template_detail", df)
        print(df.to_string(index=False))

    if not df_groups.empty:
        uuid = df_groups.iloc[0]["id"]
        raw = get(f"/api/public/feedback/groups/{uuid}", headers)
        df = jsonapi_to_df(raw)
        show_and_save("feedback_group_detail", df)
        print(df.to_string(index=False))

    # ── Kandidaat-specifieke endpoints ────────────────────────────────────────
    section("Kandidaat-specifieke endpoints")

    if CANDIDATE_UUID:
        raw = get(f"/api/public/candidates/{CANDIDATE_UUID}", headers)
        df = jsonapi_to_df(raw)
        show_and_save("candidate_detail", df)
        print(df.to_string(index=False))
    else:
        print("[candidate_detail] overgeslagen — vul CANDIDATE_UUID in bovenaan het script")

    for label, uuid, path_tpl in [
        ("assignment",              ASSIGNMENT_UUID,        "/api/public/assignments/{}"),
        ("candidate_process",       CANDIDATE_PROCESS_UUID, "/api/public/candidate_processes/{}"),
        ("candidate_program",       CANDIDATE_PROGRAM_UUID, "/api/public/candidate_programs/{}"),
        ("candidate_program_score", CANDIDATE_PROGRAM_UUID, "/api/public/candidate_programs/{}/score"),
        ("candidate_task",          CANDIDATE_TASK_UUID,    "/api/public/candidate_tasks/{}"),
        ("candidate_task_score",    CANDIDATE_TASK_UUID,    "/api/public/candidate_tasks/{}/score"),
    ]:
        if not uuid:
            print(f"[{label}] overgeslagen — vul de bijbehorende UUID in bovenaan het script")
            continue
        raw = get(path_tpl.format(uuid), headers)
        df = pd.json_normalize(raw) if raw and "data" not in raw else jsonapi_to_df(raw)
        show_and_save(label, df)
        print(df.to_string(index=False))

    # ── Media Items ───────────────────────────────────────────────────────────
    section("Media Items")

    if USER_ID:
        raw = fetch_paginated(f"/api/public/users/{USER_ID}/media_items", headers)
        df = jsonapi_to_df(raw)
        show_and_save("media_items_user", df)
        print(df.to_string(index=False))
    else:
        print("[media_items] overgeslagen — vul USER_ID in bovenaan het script")

    # ── Overzicht opgeslagen CSV's ────────────────────────────────────────────
    section("Overzicht opgeslagen CSV's")
    summary = []
    for f in sorted(os.listdir(CSV_DIR)):
        path = os.path.join(CSV_DIR, f)
        df = pd.read_csv(path)
        summary.append({"bestand": f, "rijen": len(df), "kolommen": len(df.columns)})
    print(pd.DataFrame(summary).to_string(index=False))


if __name__ == "__main__":
    main()
