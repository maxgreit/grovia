# Handoff — Grovia Automations

## Sessie: 2026-05-19

**Status:** MVP bijna compleet — Azure Function code klaar, FunnelKit config nog te doen (vanavond).

---

### Wat er deze sessie is gebeurd

- **Antwoord Jan-Willem (Ixly) verwerkt:** `api_identifier` is de unieke sleutel per candidate — e-mail is geen verplicht veld en wordt in toekomst geweigerd. Architectuurbeslissing genomen: één candidate per kind, `order_id` als `api_identifier`, kindnaam via WooCommerce order meta veld "Naam kind".
- **`ixly-aanmelding` volledig omgebouwd:** candidate aangemaakt op naam kind (`naam_kind` als één string, Function splitst op eerste spatie), `order_id` als `api_identifier`, duplicate assignment guard toegevoegd (`_maak_assignments_aan_met_guard`). 21 unit tests, allemaal groen.
- **Gotcha FunnelKit:** de tag-trigger in Workflows 3A/3B heeft géén order-context — merge tags zijn alleen contact-velden. Oplossing: HTTP Requests direct in de router-workflow plaatsen (die triggert op order-event en heeft wel order-context). Gedetailleerde stap-voor-stap TODO geschreven voor Berry om vanavond uit te voeren.
- **ADR-004** gedocumenteerd: kind als candidate, `order_id` als identifier, open vraag e-mailveld.

---

### Laatste werkende staat

- **Branch:** `main`
- **Laatste commit:** `89e3895 docs: uitgebreide TODO FunnelKit router-workflow omzetten naar order-trigger`
- **Nog te pushen:** nee — alles gepushed
- **Uncommitted changes:** alleen `.claude/` bestanden (template-versie, geen projectcode)
- **Tests:** `pytest tests/test_ixly_aanmelding_unit.py` → **21 passed** (0.75s)

---

### Open items / Next steps (prioriteit)

1. **FunnelKit router-workflow omzetten (vanavond, Berry)** — zie uitgebreide stap-voor-stap in `docs/TODO.md`. Kern: HTTP Request acties toevoegen in de Assessment- en Betaallink-branch, met `naam_kind` (order meta "Naam kind") en `order_id`. Daarna Workflows 3A en 3B deactiveren.

2. **Open vraag Jan-Willem (Ixly): e-mailveld op candidate** — Is e-mail nog nodig voor het inlogscherm, ook al wordt het straks geweigerd door de API? Antwoord verwerken in `_maak_candidate_aan` (zie TODO-comment in code). Zo nee: e-mail verwijderen. Zo ja: blijft staan.

3. **Live review met klant (deadline 20 mei)** — Volledige keten doorlopen na FunnelKit-aanpassing: WooCommerce testkoop → router-workflow → Azure Function → Ixly aanmelding + e-mail.

---

### Belangrijke context die niet mag verdwijnen

**WooCommerce order meta sleutel is letterlijk `Naam kind`** (hoofdletter N, spatie):
In FunnelKit te vinden via de `{|}` merge tag picker → "Order" → zoek op "Naam kind". Als het niet zichtbaar is, handmatig invoeren. De Function verwacht het veld als `naam_kind` in de JSON payload.

**FunnelKit tag-trigger heeft géén order-context:**
Workflows getriggerd op "Tag is Added" zien alleen contact-velden (`{{contact_email}}` etc.). `{{wc_order_id}}` en order meta zijn daar niet beschikbaar. De router-workflow (order-trigger) heeft die context wél — vandaar de omschakeling.

**`naam_kind` als één string:**
FunnelKit stuurt bijv. `"Lisa Jansen"`. De Function splitst op de eerste spatie: `first_name = "Lisa"`, `last_name = "Jansen"`. Tussenvoegsel werkt correct: `"Lisa van der Berg"` → `first_name = "Lisa"`, `last_name = "van der Berg"`.

**E-mailveld op Ixly candidate (open):**
Jan-Willem zei dat e-mail niet verplicht is en straks geweigerd wordt. Maar Ixly toont bij inloggen een e-mailscherm. Wacht op zijn antwoord voor we het veld verwijderen. Tijdelijk staat de ouder-e-mail nog ingevuld op de candidate.

**`api_identifier = order_id`:**
Twee kinderen van dezelfde ouder → twee losse candidates met hun eigen `order_id`. Geen conflict, ook niet bij zelfde e-mailadres ouder.

**Azure Function App URL:**
`https://grovia-automations-a9dxfzhpg3bbg8cr.westeurope-01.azurewebsites.net`

**Mollie: `pl_` ID voor payment links:**
Webhook ontvangt `pl_xxxxx` (niet `tr_`). Fix al in productie: `/v2/payment-links/{id}/payments` wordt gebruikt bij `pl_` prefix.

**FunnelKit HTTP Request vereist `Content-Type: application/json` header:**
Zonder deze header stuurt FunnelKit form-encoded data — de Functions geven dan een 400.

---

### FunnelKit Workflow structuur (na aanpassing vanavond)

```
Router-workflow (order-trigger)
  ├── Branch Assessment direct:
  │     Zet tag: StuurAssessment
  │     HTTP Request → POST /api/ixly-aanmelding?code=KEY
  │     Payload: email, voornaam, achternaam, wc_klant_id, naam_kind, order_id
  │
  └── Branch Assessment via betaling:
        Zet tag: StuurBetaallink
        HTTP Request → POST /api/mollie-betaallink?code=KEY
        Payload: email, voornaam, achternaam, wc_klant_id, bedrag (75.00)

Workflow 3A (StuurAssessment) → DEACTIVEREN na aanpassing router
Workflow 3B (StuurBetaallink) → DEACTIVEREN na aanpassing router
```

---

_Voeg per sessie een nieuwe sectie toe bovenaan dit bestand._
