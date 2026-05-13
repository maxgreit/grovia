# Handoff — Grovia Automations

## Sessie: 2026-05-13

**Status:** MVP in progress — Mollie webhook flow volledig gebouwd. Drie Azure Functions actief. Klaar voor configuratie en end-to-end test op productie.

---

### Wat er deze sessie is gebeurd

- `mollie-webhook` Azure Function gebouwd: ontvangt Mollie-betaling, verifieert status via Mollie API, zoekt FunnelKit-contact op via e-mail, zet tag `StuurAssessment` → triggert Workflow 3A voor C2/C3-klanten.
- `mollie-betaallink` gefixed: `metadata` (email, wc_klant_id, voornaam, achternaam) wordt nu meegegeven aan de Mollie Payment Link, zodat de webhook weet om welke klant het gaat.
- Drie nieuwe env vars toegevoegd aan `local.settings.json.example`: `GROVIA_FUNNELKIT_API_KEY`, `GROVIA_WORDPRESS_URL`, `FUNNELKIT_TAG_STUUR_ASSESSMENT_ID`.
- `bedankt-preview.html` gemaakt: preview van de bedankt-pagina voor `grovia.nl/bedankt` (Figtree + Roboto, olijfgroen + oranje kleurpalet van de site).
- Ixly candidate-parameters opgezocht in swagger voor de klant: `first_name`, `last_name`, `email`, `language`, `api_identifier`, `cost_center_uuid`, `user_uuid` (één gebruiker per kandidaat, geen array).

---

### Laatste werkende staat

- **Branch:** `main`
- **Laatste commit:** `4ba2bfd Mollie webhook flow toegevoegd + bedankt-pagina`
- **Build:** `func start` groen — alle drie functions geladen:
  - `ixly-aanmelding: [POST] http://localhost:7071/api/ixly-aanmelding`
  - `mollie-betaallink: [POST] http://localhost:7071/api/mollie-betaallink`
  - `mollie-webhook: [POST] http://localhost:7071/api/mollie-webhook`
- **Uncommitted changes:** geen

---

### Open items / Next steps (prioriteit)

1. **`FUNNELKIT_TAG_STUUR_ASSESSMENT_ID` opzoeken** — numerieke ID van de tag `StuurAssessment` in FunnelKit. Via:
   ```bash
   curl "https://www.grovia.nl/wp-json/funnelkit-automations/tags?api_key=JOUW_API_KEY"
   ```
   Of in de FunnelKit-interface. Daarna instellen als env var én GitHub Secret.

2. **Secrets toevoegen aan GitHub Secrets** — zodat de deploy workflow ze in Azure zet:
   - `GROVIA_FUNNELKIT_API_KEY`
   - `GROVIA_WORDPRESS_URL` (`https://www.grovia.nl`)
   - `FUNNELKIT_TAG_STUUR_ASSESSMENT_ID`
   - `MOLLIE_WEBHOOK_URL` (`https://grovia-automations-a9dxfzhpg3bbg8cr.westeurope-01.azurewebsites.net/api/mollie-webhook`)
   - Eerder openstaand: `IXLY_*`, `SMTP_*`, `MOLLIE_*`, `GROVIA_DEBUG_EMAIL`

3. **FunnelKit workflows configureren** — juiste tags, URL en parameters instellen (zie `docs/ARCHITECTURE.md`):
   - Workflow 3A: tag `StuurAssessment` → POST `.../api/ixly-aanmelding`
   - Workflow 3B: tag `StuurBetaallinkAssessment` → POST `.../api/mollie-betaallink`

4. **`grovia.nl/bedankt` aanmaken in WordPress** — `bedankt-preview.html` is de referentie. Content als HTML-blok plakken in de Elementor-editor. Fonts (Figtree + Roboto) en kleuren zijn al actief op de site.

5. **End-to-end test na deploy** — cURLs uitvoeren tegen productie-URL (zie `docs/ARCHITECTURE.md`).

---

### Belangrijke context die niet mag verdwijnen

**FunnelKit REST API authenticatie:**
API-sleutel als query parameter: `?api_key={sleutel}`. Geen Bearer token. Contact lookup alleen op e-mail (`?email=...`), niet op WooCommerce ID. Tags worden meegegeven als array van numerieke IDs, niet als namen. Contact ID zit op `data.contact.contact.id` in de response.

**Mollie webhook URL is geen dashboard-instelling:**
De `webhookUrl` wordt per payment link meegegeven als top-level parameter in de Mollie API-aanroep — niet via het Mollie-dashboard en niet in de `metadata`. In testmodus stuurt Mollie geen webhooks naar externe URLs; voor testen is de productie-URL of ngrok nodig.

**`mollie-webhook` gebruikt `authLevel: anonymous`:**
Mollie kan geen Azure function key meesturen. Beveiliging loopt via verificatie van de betaling bij de Mollie API zelf (`GET /v2/payments/{id}`). De webhook geeft altijd `200 OK` terug — ook bij fouten — zodat Mollie niet eindeloos herprobeert.

**Ixly `user_uuid` is enkelvoudig:**
Het veld accepteert één UUID (string, geen array). Gebruiker-UUIDs zijn niet via een apart endpoint op te vragen — ze zitten in de `relationships.users` van `GET /api/public/managed_organizations/{uuid}` (optie in `explore.py`).

**`bedankt-preview.html` is voor de klant:**
Bevat de volledige standalone preview inclusief nep-header/footer voor context. De echte WordPress-pagina hoeft alleen de content van de `.card` div — de header/footer komen van het Elementor-thema. Site gebruikt Figtree (koppen, 800) + Roboto (body), olijfgroen `#1c2010` achtergrond, oranje `#e8622a` accent.

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
             → na betaling: mollie-webhook → tag StuurAssessment → Workflow 3A
```

---

_Voeg per sessie een nieuwe sectie toe bovenaan dit bestand._
