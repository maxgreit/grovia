# TODO — Grovia Automations

## Next Up

- [ ] **Open vraag Jan-Willem (Ixly):** Is e-mailveld op candidate nodig voor het inlogscherm? Antwoord verwerken in `_maak_candidate_aan` — zie TODO-comment in code en ADR-004.
- [ ] Live review met klant: volledige keten doorlopen na FunnelKit-aanpassingen hieronder — **deadline 20 mei**

---

### FunnelKit: router-workflow omzetten (vanavond)

**Doel:** order-context beschikbaar maken in de HTTP Requests, zodat `naam_kind` en `order_id` meegestuurd kunnen worden naar de Azure Functions.

**Stap 1 — Router-workflow openen**
- WordPress admin → FunnelKit → Automations
- Open de router-workflow (de workflow die product controleert en tag zet)

**Stap 2 — Branch "StuurAssessment": HTTP Request toevoegen**

Voeg direct ná de "Zet tag: StuurAssessment"-stap een nieuwe actie toe:
- Actie: **Send Data To Any Source (HTTP Request)**
- Method: `POST`
- URL: `https://grovia-automations-a9dxfzhpg3bbg8cr.westeurope-01.azurewebsites.net/api/ixly-aanmelding?code=<FUNCTION_KEY>`
- Header: `Content-Type: application/json`
- Payload (velden toevoegen via "Add New"):

  | Naam (links) | Waarde / merge tag (rechts) |
  |---|---|
  | `email` | `{{contact_email}}` |
  | `voornaam` | `{{contact_first_name}}` |
  | `achternaam` | `{{contact_last_name}}` |
  | `wc_klant_id` | `{{wc_customer_id}}` |
  | `naam_kind` | merge tag voor order meta "Naam kind" — klik op `{|}` → zoek "Naam kind" onder Order/Custom Fields |
  | `order_id` | merge tag voor order ID — klik op `{|}` → zoek "Order ID" of "WooCommerce Order ID" |

  > **Tip voor merge tags:** klik op het `{|}` icoon rechtsboven in het HTTP Request venster. Zoek onder "WooCommerce" of "Order" naar "Order ID" en "Naam kind". Als je "Naam kind" niet ziet staan: zoek op de meta-sleutel exact zoals hij in WooCommerce staat (`Naam kind` met hoofdletter en spatie).

**Stap 3 — Branch "StuurBetaallink": HTTP Request toevoegen**

Voeg direct ná de "Zet tag: StuurBetaallink"-stap een nieuwe actie toe:
- Actie: **Send Data To Any Source (HTTP Request)**
- Method: `POST`
- URL: `https://grovia-automations-a9dxfzhpg3bbg8cr.westeurope-01.azurewebsites.net/api/mollie-betaallink?code=<FUNCTION_KEY>`
- Header: `Content-Type: application/json`
- Payload:

  | Naam | Waarde |
  |---|---|
  | `email` | `{{contact_email}}` |
  | `voornaam` | `{{contact_first_name}}` |
  | `achternaam` | `{{contact_last_name}}` |
  | `wc_klant_id` | `{{wc_customer_id}}` |
  | `bedrag` | `75.00` |

  > `naam_kind` en `order_id` zijn voor de betaallink-flow nog niet nodig (Mollie-webhook handelt dat apart af).

**Stap 4 — Workflows 3A en 3B deactiveren**
- FunnelKit → Automations → Workflow 3A ("Stuur Assessment") → zet op **Inactief**
- FunnelKit → Automations → Workflow 3B ("Stuur Betaallink") → zet op **Inactief**
- Niet verwijderen — bewaren als backup

**Stap 5 — Testen**
- Doe een testkoop in WooCommerce (of simuleer via FunnelKit test-trigger als beschikbaar)
- Controleer Azure Function logs: ontvangt de function `naam_kind` en `order_id` correct?
- Controleer of Ixly-aanmelding slaagt en e-mail aankomt op `GROVIA_DEBUG_EMAIL`

---

## Later
- [ ] `GROVIA_FUNNELKIT_API_KEY` en `GROVIA_DEBUG_EMAIL` toevoegen aan `wp-config.php` op de WordPress-server
- [ ] Token caching + refresh implementeren in Azure Function (Ixly kondigt kortere token-lifetime aan)
- [ ] Onderzoek data warehouse opzet: WooCommerce → Azure SQL → PowerBI
- [ ] Overleggen met klant: Assessment[seizoen] tag pas zetten ná daadwerkelijk versturen assessment (nu te vroeg bij StuurBetaallinkAssessment — blokkeert contact als betaling uitblijft)

## Done
- [x] Ixly kandidaat-per-kind geïmplementeerd: `api_identifier = order_id`, candidate op naam kind, duplicate assignment guard, unit tests (17/17 groen)
- [x] Overleg Berry + Jan-Willem (Ixly): architectuurkeuze helder — `api_identifier` is de unieke sleutel, e-mail niet verplicht
- [x] `MOLLIE_REDIRECT_URL` GitHub Secret aangepast naar `https://grovia.nl/bedankt` + nieuwe deploy getriggerd
- [x] Volledige keten getest en werkend: FunnelKit Workflow 3A + 3B → Azure Functions → Mollie webhook → Ixly aanmelding
- [x] `grovia.nl/bedankt` pagina opgezet in WordPress (bedankt-preview.html als basis)
- [x] `mollie-webhook` end-to-end getest en werkend — bugfix: Mollie stuurt `pl_` ID voor payment links, code aangepast om via `/v2/payment-links/{id}/payments` de betaling op te halen
- [x] FunnelKit Workflow 3A en 3B geconfigureerd: trigger, URL + `?code=FUNCTION_KEY`, payload — inclusief `FUNNELKIT_TAG_STUUR_ASSESSMENT_ID` als secret
