# Handoff — Grovia Automations

## Sessie: 2026-05-17 (avond)

**Status:** MVP in progress — alle drie Azure Functions gedeployed en functioneel. `mollie-betaallink` + `mollie-webhook` end-to-end getest en werkend. Volledige keten (FunnelKit → betaallink → webhook → tag) nog te testen.

---

### Wat er deze sessie is gebeurd

- **Bugfix `mollie-webhook`:** Mollie stuurt bij payment links een `pl_` ID (niet `tr_` zoals gedocumenteerd). De webhook riep `/v2/payments/pl_...` aan → 404. Fix: bij `pl_` ID wordt nu `/v2/payment-links/{id}/payments` aangeroepen om de bijbehorende `tr_` betaling op te halen.
- **`mollie-betaallink` getest op productie** (testmodus): betaallink correct aangemaakt inclusief webhook URL met `email` + `wc_klant_id` query params.
- **`mollie-webhook` getest op productie**: na testbetaling voldaan via Mollie, webhook correct ontvangen en verwerkt.
- **TODO gesynchroniseerd met Notion**: FunnelKit workflows als Done gemarkeerd.

---

## Sessie: 2026-05-17

**Status:** MVP in progress — alle drie Azure Functions gedeployed en functioneel. End-to-end test van `ixly-aanmelding` op productie geslaagd. `mollie-betaallink` werkend na bugfix; webhook flow nog niet getest met echte betaling.

---

### Wat er deze sessie is gebeurd

- `deploy.yml` bijgewerkt: alle ontbrekende secrets (`IXLY_*`, `GROVIA_*`, `FUNNELKIT_*`) toegevoegd aan de Azure appsettings-stap; `MOLLIE_WEBHOOK_URL` was hardcoded leeg — nu via secret.
- `.gitignore` uitgebreid met `.azurite/` (lokale storage emulator bestanden).
- `ixly-aanmelding` aangepast: gebruikt nu `login_url` per assignment (directe token-login, geen account aanmaken) i.p.v. `sign_up_url`; één link in de e-mail want beide games geven dezelfde URL terug.
- `mollie-betaallink` gebugfixt: `metadata` veld verwijderd (Mollie Payment Links API ondersteunt dit niet → 422); `email` en `wc_klant_id` worden nu als query params in de `webhookUrl` meegegeven.
- `mollie-webhook` bijgewerkt: leest `email` en `wc_klant_id` nu uit `req.params` (query params) i.p.v. `payment.metadata`.
- Mollie API documentatie grondig onderzocht en geverifieerd: webhook stuurt `tr_` payment ID als POST body, query params in webhookUrl worden behouden, `metadata` op payment links bestaat niet.

---

### Laatste werkende staat

- **Branch:** `main`
- **Laatste commit:** `a94af5e 17-05-2026: Aanpassing code t.b.v. payment link en redirect uri`
- **Build:** Groen — alle drie functions geladen (port 7071 was bezet door eerder gestarte sessie, build zelf functioneel):
  - `ixly-aanmelding: [POST] http://localhost:7071/api/ixly-aanmelding`
  - `mollie-betaallink: [POST] http://localhost:7071/api/mollie-betaallink`
  - `mollie-webhook: [POST] http://localhost:7071/api/mollie-webhook`
- **Uncommitted changes:** geen

---

### Open items / Next steps (prioriteit)

1. **End-to-end test mollie-webhook** — echte testbetaling via aangemaakt payment link afhandelen en controleren of de webhook:
   - Email + wc_klant_id correct uitleest uit query params
   - FunnelKit contact opzoekt op e-mail
   - Tag `StuurAssessment` correct zet
   - Tip: in testmodus stuurt Mollie geen webhook naar externe URLs — gebruik ngrok of test op productie

2. **FunnelKit workflows configureren** — Workflow 3A en 3B activeren met correcte URL en payload (zie ARCHITECTURE.md). Workflow 3A trigger: tag `StuurAssessment` → POST `/api/ixly-aanmelding?code=...`. Workflow 3B trigger: tag `StuurBetaallinkAssessment` → POST `/api/mollie-betaallink?code=...`.

3. **`grovia.nl/bedankt` aanmaken in WordPress** — op basis van `bedankt-preview.html`. Alleen de `.card` div content in Elementor plakken, header/footer komen van het thema.

4. **Volledige keten testen** — testkoop in WooCommerce doorlopen en alle stappen valideren: tag aanmaken → router → assessment of betaallink → na betaling webhook → assessment aanmelding.

---

### Belangrijke context die niet mag verdwijnen

**Mollie Payment Links API heeft geen `metadata`:**
De Payments API heeft wel metadata, de Payment Links API niet. Dit gaf een 422: `"Non-existent body parameter \"metadata.voornaam\" for this API call."`. Klantidentificatie loopt via query params in de `webhookUrl`: `.../mollie-webhook?email=...&wc_klant_id=...`.

**Mollie webhook stuurt payment ID (`tr_`), niet payment link ID (`pl_`):**
Geverifieerd via officiële docs. De webhook POST body bevat `id=tr_xxxxx`. De huidige webhook-code die `GET /v2/payments/{id}` aanroept is correct. Payment objects aangemaakt via payment links hebben `metadata: null`.

**`login_url` vs `sign_up_url` bij Ixly:**
`login_url` is een directe token-login zonder wachtwoord — ideaal voor kinderen. `sign_up_url` vereist accountaanmaken. Beide URLs zijn identiek voor alle assignments van één kandidaat (per kandidaat, niet per game). De mail stuurt nu één `login_url`.

**Function keys voor ixly-aanmelding en mollie-betaallink:**
`authLevel: function` — add `?code=JOUW_FUNCTION_KEY` aan de URL bij testen en in FunnelKit. De key is te vinden via Azure Portal → Functions → [naam] → Function Keys → default. `mollie-webhook` heeft `authLevel: anonymous` (Mollie kan geen key meesturen).

**Mollie webhook retry schema:**
10 pogingen over 26 uur. Webhook geeft altijd 200 terug (ook bij fouten) zodat Mollie niet blijft herprobeert. Foutafhandeling loopt via Azure logging.

**FunnelKit REST API authenticatie:**
API-sleutel als query parameter: `?api_key={sleutel}`. Contact lookup alleen op e-mail. Tags meegeven als array van numerieke IDs. Contact ID zit op `data.contact.contact.id`.

---

### FunnelKit Workflow structuur

```
Workflow 3A: Stuur Assessment
  Trigger: Tag is Added → StuurAssessment (Multiple Times)
  Actie:   Send Data → POST /api/ixly-aanmelding?code=FUNCTION_KEY
  Payload: voornaam, achternaam, email, wc_klant_id

Workflow 3B: Stuur Betaallink
  Trigger: Tag is Added → StuurBetaallinkAssessment (Multiple Times)
  Actie:   Send Data → POST /api/mollie-betaallink?code=FUNCTION_KEY
  Payload: voornaam, achternaam, email, wc_klant_id, bedrag
```

---

_Voeg per sessie een nieuwe sectie toe bovenaan dit bestand._
