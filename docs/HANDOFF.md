# Handoff — Grovia Automations

## Sessie: 2026-05-11

**Status:** MVP in progress — Ixly organisatiekoppeling tot stand gekomen, auth flow nog niet gevalideerd.

---

### Wat er deze sessie is gebeurd

- Bevestigd dat de Ixly organisatiekoppeling tot stand is gekomen (eerder geblokkeerd).
- Onderzocht of `GET /api/public/candidates` (lijst) bestaat — dat doet het **niet**. De Ixly API biedt alleen `POST /api/public/candidates` (aanmaken) en opzoeken via UUID of api_identifier. Er is geen lijst-endpoint voor candidates.
- Geen code-wijzigingen gemaakt; geen nieuwe commits.

---

### Laatste werkende staat

- **Branch:** `main`
- **Laatste commit:** `b0284ba Fix: access_grant ophalen uit included[] in Ixly managed organizations response`
- **Build:** `func start` vraagt interactieve runtime-selectie in worktree-context (geen TTY) — niet meetbaar. Geen bekende fouten in codebase.
- **Uncommitted changes:** geen

---

### Open items / Next steps (prioriteit)

1. **Ixly auth flow valideren** — `python explore.py` runnen, managed organizations lijst ophalen, stap 2 (grant token) en stap 3 (user access token) verifiëren. Dit is nu ontgrendeld.
2. **Candidate aanmaken en opzoeken testen** — via `explore.py`: POST candidate aanmaken, terugzoeken via api_identifier (wc_klant_id). Valideer dat velden kloppen.
3. **E-mailservice kiezen en koppelen** — Azure Function moet `login_url` mailen naar klant. Kandidaten: SendGrid, Postmark, Azure Communication Services. Nog niet gekozen.
4. **`GROVIA_FUNNELKIT_API_KEY` en `GROVIA_DEBUG_EMAIL`** instellen in `wp-config.php` op de WordPress-server (zie ADR-001).
5. **Ixly secrets toevoegen aan GitHub Secrets** — `IXLY_BASE_URL`, `IXLY_CLIENT_ID`, `IXLY_CLIENT_SECRET`, `IXLY_ORGANIZATION_UUID` — zodra auth flow gevalideerd is.

---

### Belangrijke context die niet mag verdwijnen

**Ixly heeft geen candidates lijst-endpoint:**
`GET /api/public/candidates` bestaat niet. Alleen `POST` (aanmaken) en lookup via UUID of `api_identifier`. Candidates opzoeken kan uitsluitend als je de UUID of de `wc_klant_id` (api_identifier) al weet.

**Ixly authenticatie — managed organizations flow:**
1. `POST /oauth/token` (client_credentials) → app token
2. `GET /api/public/managed_organizations/{uuid}` → grant token zit in `included[].attributes.access_grant` (type: `api_user`), **niet** op het organisatie-object zelf
3. `POST /oauth/token` (grant_type: `authorization_code`, code: grant token) → user access token

**FunnelKit kan geen webhook responses opvangen:**
`Send Data` is eenrichtingsverkeer. `login_url` uit Ixly-response kan niet als merge tag in FunnelKit gebruikt worden → Azure Function stuurt de e-mail zelf.

**Ixly base URL:** `https://assessmentplatform.com` (niet `app.ixly.nl`)

---

### FunnelKit Workflow structuur

```
Workflow 1: Product Tagging
  Trigger: Order Status Changed (WooCommerce)
  Actie:   Custom Callback → grovia_generate_ixly_tag
  Output:  Tag [School][Fase][Seizoen] bijv. SUC12627 → toegewezen aan contact

Workflow 2: Assessment Tagging
  Trigger: Tag is Added → SUC12627 (of elke Ixly-tag)
  Actie:   Custom Callback → grovia_assessment_router
  Output:  Tag StuurAssessment (C1/SMT/SZT)
        OF Tag StuurBetaallinkAssessment (C2/C3)
        + altijd: Tag Assessment2627 (anti-duplicaat)

Workflow 3A: Stuur Assessment Workflow
  Trigger: Tag is Added → StuurAssessment (Multiple Times)
  Actie:   Send Data → Azure Function /api/ixly-aanmelding
  Rol Azure Function:
    1. User access token ophalen (managed organizations flow)
    2. Kandidaat aanmaken bij Ixly (of bestaande opzoeken via wc_klant_id)
    3. Assignment aanmaken voor het juiste assessment
    4. E-mail sturen naar klant met login_url

Workflow 3B: Stuur Betaallink Assessment Workflow
  Trigger: Tag is Added → StuurBetaallinkAssessment (Multiple Times)
  Actie:   Send Email → betaallink voor instapkosten C2/C3
  Context: C2/C3-klanten stappen mid-seizoen in en betalen een toeslag voor
           gemiste cyclus 1. Na betaling → tag StuurAssessment → Workflow 3A
  Status:  Betaallink genereren nog handmatig — automatisering later
```

---

_Voeg per sessie een nieuwe sectie toe bovenaan dit bestand._
