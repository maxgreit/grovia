# Handoff — Grovia Automations

## Sessie: 2026-04-30

**Status:** MVP in progress — FunnelKit workflow structuur vastgesteld, Ixly connectie geblokkeerd op organisatiekoppeling.

---

### Wat er deze sessie is gebeurd

- `requirements.txt` aangemaakt met gepinde versies (`azure-functions==1.21.3`, `requests==2.32.3`)
- GitHub Actions dependency audit workflow toegevoegd (`.github/workflows/dependency-audit.yml`)
- Base URL gecorrigeerd van `https://app.ixly.nl` naar `https://assessmentplatform.com`
- Ixly authenticatie uitgebreid naar de volledige managed organizations flow (3 stappen) in zowel `explore.py` als de Azure Function
- Ontdekt dat de managed organizations lijst leeg terugkomt — Ixly moet de organisatie aan de API-applicatie koppelen
- Vastgesteld dat FunnelKit geen webhook response-data kan opvangen, waardoor de e-mail vanuit de Azure Function zelf verstuurd moet worden
- Volledige FunnelKit workflow structuur vastgesteld (zie hieronder)
- `docs/ARCHITECTURE.md` bijgewerkt met de volledige workflow keten inclusief Azure Function rol

---

### Laatste werkende staat

- **Branch:** `main`
- **Laatste commit:** `1b4b794 first commit`
- **Build:** `func start` pikt Python runtime op — poort 7071 bezet (andere instantie actief), verder geen fouten
- **Uncommitted changes:** `api_explorer.ipynb` en `api_explorer.py` verwijderd (nog niet gecommit), diverse nieuwe bestanden untracked

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
  Geen Send Email stap in FunnelKit — FunnelKit kan webhook response niet opvangen

Workflow 3B: Stuur Betaallink Assessment Workflow
  Trigger: Tag is Added → StuurBetaallinkAssessment (Multiple Times)
  Actie:   Send Email → betaallink voor instapkosten C2/C3
  Context: C2/C3-klanten stappen mid-seizoen in en betalen een toeslag voor
           gemiste cyclus 1. Na betaling → tag StuurAssessment → Workflow 3A
  Status:  Betaallink genereren nog handmatig — automatisering later
```

---

### Open items / Next steps (prioriteit)

1. **Wacht op Ixly** — mail verstuurd om organisatie te koppelen aan API-applicatie + API-gebruiker aan te maken. Zodra geregeld: `python explore.py` → managed organizations lijst controleren
2. **Ixly auth flow valideren** — na koppeling: stap 2 (grant token) en stap 3 (user access token) testen en response-veldnamen verifiëren (`grant_token` locatie in JSON)
3. **E-mailservice kiezen en koppelen** — Azure Function moet e-mail sturen met `login_url`. Kandidaten: SendGrid, Postmark, Azure Communication Services. Nog niet gekozen
4. **Uncommitted changes committen** — nieuwe bestanden (`functions/`, `plugins/`, `docs/`, `explore.py`, etc.) zijn nog untracked
5. **`GROVIA_FUNNELKIT_API_KEY` en `GROVIA_DEBUG_EMAIL`** instellen in `wp-config.php` op de WordPress-server (zie ADR-001)

---

### Belangrijke context

**Ixly authenticatie — managed organizations flow:**
De standaard Client Credentials token (stap 1) geeft alleen app-niveau toegang. Voor kandidaten en assignments is een user access token nodig via:
1. `POST /oauth/token` (client_credentials) → app token
2. `GET /api/public/managed_organizations/{uuid}` → grant token (zit op user-object in `included`, niet op de organisatie zelf)
3. `POST /oauth/token` (authorization_code + grant token als `code`) → user access token

Stap 3 grant_type is een aanname (`authorization_code`) — moet geverifieerd worden zodra de organisatiekoppeling staat.

**FunnelKit kan geen webhook responses opvangen:**
`Send Data` is eenrichtingsverkeer. De `login_url` uit de Ixly API-response kan niet als merge tag in een FunnelKit e-mail gebruikt worden. Daarom stuurt de Azure Function de e-mail zelf.

**Ixly base URL:** `https://assessmentplatform.com` (niet `app.ixly.nl`)

**Refresh tokens:** Ixly geeft nu lange token-lifetime, maar kondigt aan dit te verkorten. Token caching + refresh implementeren zodra de basis werkt.

---

_Voeg per sessie een nieuwe sectie toe bovenaan dit bestand._
