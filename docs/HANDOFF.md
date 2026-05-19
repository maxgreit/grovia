# Handoff — Grovia Automations

## Sessie: 2026-05-17 (avond)

**Status:** MVP functioneel — klaar voor review met klant. Ixly/kinderen-architectuur open vraag geïdentificeerd.

---

### Wat er deze sessie is gebeurd

- **Sessie-start / context laden:** Notion-sync uitgevoerd — `MOLLIE_REDIRECT_URL` taak stond als Done in Notion maar nog open in `docs/TODO.md`, bijgewerkt.
- **Ixly flow geanalyseerd voor edge cases:** ontdekt dat bij een tweede order van dezelfde klant de function crasht of duplicate assignments aanmaakt (geen guard). Daarnaast: ouders kopen voor kinderen, maar de huidige flow registreert de ouder als Ixly candidate, niet het kind.
- **Drie oplossingsrichtingen uitgewerkt** (zie Open items): optie A (kind als candidate, checkout-veld), optie B (api_identifier = order_id), optie C (meerdere kinderen per order). Beslissing wacht op afstemming met Berry.

---

### Laatste werkende staat

- **Branch:** `main`
- **Laatste commit:** `19daa46 Bugfix mollie-webhook: pl_ ID afhandelen via payment-links API`
- **Nog te pushen:** 1 commit (branch is ahead of origin/main)
- **Uncommitted changes:** `docs/DECISIONS.md`, `docs/HANDOFF.md`, `docs/TODO.md`
- **Build:** Core Tools geladen (Python 3.12.2, Azure Functions 4.5.0). Port 7071 bezet door vorige run — geen build-fout.

---

### Open items / Next steps (prioriteit)

1. **Commit + push openstaande wijzigingen** — `docs/` is uncommitted, branch 1 commit ahead van origin/main.

2. **Overleg Berry: kinderen in checkout** — Wat vullen ouders in bij WooCommerce checkout? Is er al een veld voor naam kind? Wil Grovia in Ixly resultaten per kind kunnen zien? Dit bepaalt de architectuurkeuze (zie hieronder).

3. **Beslissing + implementatie: Ixly kandidaat-strategie**
   - Optie A (aanbevolen als kind-resultaten nodig): checkout-veld "Naam kind", candidate = kind, `api_identifier = {wc_klant_id}_{order_id}`
   - Optie B (snel, geen checkout-aanpassing): `api_identifier = order_id`, candidate blijft ouder
   - Wacht op input Berry → daarna ADR schrijven + implementeren

4. **Dubbele order guard implementeren** — `_maak_assignment_aan` faalt of maakt duplicates als dezelfde candidate al assignments heeft. Minimale fix: check of assignment al bestaat vóór aanmaken, ongeacht de kandidaat-strategie.

5. **Live review met klant (deadline: 20 mei)** — volledige keten doorlopen met Berry: WooCommerce testkoop → tag → router → assessment of betaallink → na betaling webhook → Ixly aanmelding + e-mail.

---

### Belangrijke context die niet mag verdwijnen

**Ixly: huidige candidate-identificatie loopt via `wc_klant_id`:**
`api_identifier` = `wc_klant_id` (WooCommerce klant-ID). Bij 2 orders van dezelfde klant → dezelfde candidate in Ixly → nieuwe assignments op hetzelfde account. Ixly gedrag bij duplicate assignments is ongetest — kan 422 geven of duplicates aanmaken.

**Ixly e-mail is op naam van ouder, niet kind:**
`_stuur_email` gebruikt `body["voornaam"]` + `body["achternaam"]` — dat zijn de WooCommerce bestelgegevens van de koper (ouder), niet het kind. Als kinderen worden aangemeld, klopt de aanhef niet.

**Mollie stuurt `pl_` ID voor payment links (niet `tr_`):**
Bij een payment link stuurt Mollie de webhook met het payment link ID (`pl_`). Fix al in productie: `/v2/payment-links/{id}/payments` wordt aangeroepen bij `pl_` prefix.

**FunnelKit HTTP Request vereist `Content-Type: application/json` header:**
Zonder deze header stuurt FunnelKit form-encoded data. De Azure Functions doen `req.get_json()` en geven dan een 400.

**Function keys:**
- `ixly-aanmelding` en `mollie-betaallink`: `authLevel: function` — `?code=KEY` vereist
- `mollie-webhook`: `authLevel: anonymous` — Mollie kan geen key meesturen

**Klantidentificatie in Mollie webhook loopt via query params:**
`email` en `wc_klant_id` zitten als query params in de `webhookUrl` (Mollie Payment Links API ondersteunt geen `metadata`).

**Azure Function App URL:**
`https://grovia-automations-a9dxfzhpg3bbg8cr.westeurope-01.azurewebsites.net`

---

### FunnelKit Workflow structuur

```
Workflow 3A: Stuur Assessment
  Trigger: Tag is Added → StuurAssessment (Multiple Times)
  Actie:   HTTP Request → POST /api/ixly-aanmelding?code=FUNCTION_KEY
  Header:  Content-Type: application/json
  Payload: voornaam, achternaam, email, wc_klant_id

Workflow 3B: Stuur Betaallink
  Trigger: Tag is Added → StuurBetaallinkAssessment (Multiple Times)
  Actie:   HTTP Request → POST /api/mollie-betaallink?code=FUNCTION_KEY
  Header:  Content-Type: application/json
  Payload: voornaam, achternaam, email, wc_klant_id, bedrag (75.00)
```

---

_Voeg per sessie een nieuwe sectie toe bovenaan dit bestand._
