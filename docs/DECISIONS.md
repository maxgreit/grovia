# Architectuurbeslissingen — Grovia Automations

Beslissingen worden vastgelegd als ADR's (Architecture Decision Records).

## Formaat

```
## ADR-001: [Titel]
**Datum:** YYYY-MM-DD
**Status:** Voorgesteld / Geaccepteerd / Vervallen

**Context:** Waarom moest er een beslissing genomen worden?
**Beslissing:** Wat is er besloten?
**Gevolgen:** Wat zijn de trade-offs en consequenties?
```

---

## ADR-004: Ixly kandidaat-strategie — kind als candidate, order_id als api_identifier
**Datum:** 2026-05-19
**Status:** Geaccepteerd

**Context:**
Ouders kopen assessments voor kinderen, soms meerdere kinderen met hetzelfde ouder-e-mailadres. Ixly bevestigde (Jan-Willem, mei 2026) dat het `api_identifier`-veld de unieke sleutel is per candidate. E-mail is geen verplicht veld op candidates en wordt in een toekomstige API-versie geweigerd. Jan-Willem bevestigde (19 mei 2026) dat er geen loginomgeving is — elke assignment levert een directe link op waarmee het assessment gestart kan worden.

**Beslissing:**
- `api_identifier` = `order_id` (uniek per WooCommerce-bestelling)
- Candidate aangemaakt op naam van het kind (`kind_voornaam`, `kind_achternaam`)
- E-mailveld op candidate tijdelijk ingevuld met ouder-e-mail (voor nu, per advies Jan-Willem)
- Elke assignment heeft een eigen `login_url` — uitnodigings-e-mail bevat één link per game
- Uitnodigings-e-mail gaat naar ouder-e-mailadres, geadresseerd aan het kind

**Gevolgen:**
- Twee kinderen van dezelfde ouder → twee losse candidates, elk met eigen assignments en links
- Duplicate guard toegevoegd: bestaande assignments worden niet opnieuw aangemaakt
- `_maak_assignments_aan_met_guard` retourneert lijst met `login_url` per item (niet één gedeelde URL)

---

## ADR-003: GitHub Secrets als secrets-beheer voor Azure
**Datum:** 2026-04-30
**Status:** Geaccepteerd

**Context:** Azure Function App heeft omgevingsvariabelen nodig (Mollie, SMTP, Ixly). Deze mogen niet in code of in de Azure Portal handmatig worden beheerd.

**Beslissing:** Alle secrets worden opgeslagen als GitHub Secrets en via de deploy workflow (`az functionapp config appsettings set`) in Azure gezet bij elke deployment.

**Gevolgen:** Eén plek voor secrets (GitHub). `GROVIA_DEBUG_EMAIL` staat bewust niet in de workflow — alleen lokaal in `.env` voor testdoeleinden.

---

## ADR-002: Mollie Payment Links API voor betaallinks
**Datum:** 2026-04-30  
**Status:** Geaccepteerd (bijgewerkt 2026-05-17)

**Context:** Workflow 3B vereist een betaallink die per e-mail verstuurd wordt. De Mollie Payments API geeft een checkout-URL die binnen ~15 minuten verloopt — ongeschikt voor e-mail.

**Beslissing:** Gebruik de Mollie Payment Links API (`POST /v2/payment-links`). Betaallink verloopt niet automatisch, hosted door Mollie, geen SDK nodig (puur `requests`).

**Gevolgen:** Geen extra dependency. `MOLLIE_WEBHOOK_URL` is optioneel — wordt gebruikt voor de feedback loop naar FunnelKit na geslaagde betaling.

**Addendum (2026-05-17) — metadata niet ondersteund op Payment Links:**  
De `/v2/payment-links` endpoint ondersteunt het `metadata`-veld **niet** (geeft 422: `"Non-existent body parameter"`). Dit staat in contrast met de reguliere Payments API die metadata wél ondersteunt. Klantidentificatie (email, wc_klant_id) wordt daarom ingebed als query params in de `webhookUrl`: `.../mollie-webhook?email=...&wc_klant_id=...`. Mollie behoudt deze query params bij het aanroepen van de webhook. Payment-objecten aangemaakt via payment links hebben `metadata: null`.

**Addendum (2026-05-17) — Mollie stuurt `pl_` ID voor payment links:**  
Geverifieerd in productie: de webhook voor een payment link ontvangt `id=pl_xxxxx` (payment link ID), niet `id=tr_xxxxx` (transactie ID). Om de betaalstatus te verifiëren moet `/v2/payment-links/{pl_id}/payments` worden aangeroepen. De `mollie-webhook` function handelt beide gevallen af: `pl_` via de payment-links endpoint, `tr_` direct via `/v2/payments/{id}`.

---

## ADR-001: API-sleutels via wp-config.php
**Datum:** 2026-04-28
**Status:** Geaccepteerd

**Context:** De FunnelKit REST API-sleutel wordt gebruikt in beide WordPress-plugins. Hardcoding in plugincode is een veiligheidsrisico en verstoort versiebeheer.

**Beslissing:** Secrets worden gedefinieerd in `wp-config.php` via `define()`, buiten de pluginbestanden. De plugins lezen de constante op via `GROVIA_FUNNELKIT_API_KEY`.

**Gevolgen:** Sleutels staan nooit in git. `wp-config.php` valt buiten de repo. Bij deployments moet de sleutel handmatig in `wp-config.php` worden gezet op de server.
