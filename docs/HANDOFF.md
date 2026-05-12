# Handoff — Grovia Automations

## Sessie: 2026-05-12

**Status:** MVP in progress — Ixly aanmelding flow volledig uitgebouwd en gedeployed. E-mail via Vimexx SMTP gekoppeld. Mollie betaallink flow compleet. Feedback loop (Mollie → FunnelKit) is de volgende prioriteit.

---

### Wat er deze sessie is gebeurd

- Ixly aanmelding flow volledig uitgebouwd: candidate upsert (opzoeken via `api_identifier`, aanmaken bij 404), twee assignments per kandidaat (Blocks Game + Rally Game), e-mail met `sign_up_url` naar kandidaat.
- Ontdekt dat `login_url` en `sign_up_url` kandidaat-niveau zijn (identiek voor beide assignments en tussen runs) — e-mail stuurt daarom één `sign_up_url`, niet losse game-links.
- Vimexx SMTP gekoppeld aan beide Azure Functions via gedeelde `SMTP_*` env vars; `GROVIA_DEBUG_EMAIL` werkt als override voor testmails.
- E-mailteksten bijgewerkt: Ixly-mail op basis van bestaande Grovia-template (inclusief tips, wachtwoordinstructie, voor- én achternaam); Mollie-mail bijgewerkt naar nieuwe tekst met juist onderwerp.
- `flow_ixly_aanmelding.py` testscript geschreven en gevalideerd in staging (nieuwe én bestaande kandidaat).
- Alles gecommit en gepusht naar main — GitHub Actions deploy workflow getriggerd.

---

### Laatste werkende staat

- **Branch:** `main`
- **Laatste commit:** `2533518 Ixly aanmelding flow uitgebouwd + Mollie e-mail verbeterd`
- **Build:** `func start` groen — beide functions geladen:
  - `ixly-aanmelding: [POST] http://localhost:7071/api/ixly-aanmelding`
  - `mollie-betaallink: [POST] http://localhost:7071/api/mollie-betaallink`
- **Uncommitted changes:** geen

---

### Open items / Next steps (prioriteit)

1. **Mollie feedback loop bouwen** — `mollie-webhook` Azure Function die Mollie-betaling verifieert en via FunnelKit API de tag `StuurAssessment` zet op het contact. `GROVIA_FUNNELKIT_API_KEY` is beschikbaar. `MOLLIE_WEBHOOK_URL` is al voorzien in `local.settings.json.example`.
2. **FunnelKit workflows configureren** — juiste tags, URL en parameters instellen (zie `docs/ARCHITECTURE.md`):
   - Workflow 3A: tag `StuurAssessment` → POST `.../api/ixly-aanmelding`
   - Workflow 3B: tag `StuurBetaallinkAssessment` → POST `.../api/mollie-betaallink`
3. **Secrets toevoegen aan GitHub Secrets** — `IXLY_*`, `SMTP_*`, `MOLLIE_*`, `IXLY_REDIRECT_URI` zodat de deploy workflow ze in Azure zet.
4. **`GROVIA_FUNNELKIT_API_KEY` en `GROVIA_DEBUG_EMAIL` in `wp-config.php`** op de WordPress-server.
5. **End-to-end test na deploy** — cURLs uitvoeren tegen productie-URL (zie `docs/ARCHITECTURE.md`).

---

### Belangrijke context die niet mag verdwijnen

**`login_url` en `sign_up_url` zijn kandidaat-niveau, niet assignment-niveau:**
Beide velden zijn identiek voor alle assignments van dezelfde kandidaat, ook tussen runs. De `sign_up_url` is de account-activatielink; bestaande kandidaten worden doorgestuurd naar het inlogscherm. We sturen altijd de `sign_up_url` van het eerste assignment.

**`IXLY_REDIRECT_URI` is verplicht voor de auth flow:**
`explore.py`, `flow_ixly_aanmelding.py` en `ixly-aanmelding/__init__.py` hebben dit allemaal. Zonder deze waarde geeft Ixly een 400 `invalid_request` bij stap 3 van de managed organizations flow.

**Ixly heeft geen candidates lijst-endpoint:**
Alleen `POST /api/public/candidates` (aanmaken) en opzoeken via UUID of `api_identifier`. Upsert-logica: GET op `api_identifier` → 404 = aanmaken, 200 = bestaande gebruiken.

**Ixly base URL:** `https://assessmentplatform.com` (niet `app.ixly.nl`)

**Azure Function productie-URL:**
`https://grovia-automations-a9dxfzhpg3bbg8cr.westeurope-01.azurewebsites.net`

**Staging tasks (hardcoded in `TAKEN` in `ixly-aanmelding/__init__.py`):**
- Blocks Game: `2a04b8bc-486f-4b9a-924a-26199b75be9c`
- Rally Game: `4464b991-268f-45f7-860a-e5b109160612`
Dit zijn de enige tasks in de staging-omgeving. In productie de juiste Grovia-specifieke UUIDs opzoeken en vervangen.

**FunnelKit `Send Data` is eenrichtingsverkeer:**
Kan geen response-data verwerken. De Azure Function stuurt de e-mail zelf.

---

### FunnelKit Workflow structuur

```
Workflow 1: Product Tagging
  Trigger: Order Status Changed (WooCommerce)
  Actie:   Custom Callback → grovia_generate_ixly_tag
  Output:  Tag [School][Fase][Seizoen] bijv. SUC12627

Workflow 2: Assessment Tagging
  Trigger: Tag is Added → SUC12627
  Actie:   Custom Callback → grovia_assessment_router
  Output:  Tag StuurAssessment (C1/SMT/SZT)
        OF Tag StuurBetaallinkAssessment (C2/C3)
        + altijd: Tag Assessment2627 (anti-duplicaat)

Workflow 3A: Stuur Assessment
  Trigger: Tag is Added → StuurAssessment (Multiple Times)
  Actie:   Send Data → POST /api/ixly-aanmelding
  Payload: voornaam, achternaam, email, wc_klant_id
  Resultaat: candidate upsert + 2 assignments + e-mail met sign_up_url

Workflow 3B: Stuur Betaallink
  Trigger: Tag is Added → StuurBetaallinkAssessment (Multiple Times)
  Actie:   Send Data → POST /api/mollie-betaallink
  Payload: voornaam, achternaam, email, wc_klant_id, bedrag
  Resultaat: Mollie betaallink aangemaakt + e-mail naar klant
  TODO: na betaling → mollie-webhook → tag StuurAssessment → Workflow 3A
```

---

_Voeg per sessie een nieuwe sectie toe bovenaan dit bestand._
