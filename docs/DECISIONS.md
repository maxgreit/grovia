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

## ADR-003: GitHub Secrets als secrets-beheer voor Azure
**Datum:** 2026-04-30
**Status:** Geaccepteerd

**Context:** Azure Function App heeft omgevingsvariabelen nodig (Mollie, SMTP, Ixly). Deze mogen niet in code of in de Azure Portal handmatig worden beheerd.

**Beslissing:** Alle secrets worden opgeslagen als GitHub Secrets en via de deploy workflow (`az functionapp config appsettings set`) in Azure gezet bij elke deployment.

**Gevolgen:** Eén plek voor secrets (GitHub). `GROVIA_DEBUG_EMAIL` staat bewust niet in de workflow — alleen lokaal in `.env` voor testdoeleinden.

---

## ADR-002: Mollie Payment Links API voor betaallinks
**Datum:** 2026-04-30
**Status:** Geaccepteerd

**Context:** Workflow 3B vereist een betaallink die per e-mail verstuurd wordt. De Mollie Payments API geeft een checkout-URL die binnen ~15 minuten verloopt — ongeschikt voor e-mail.

**Beslissing:** Gebruik de Mollie Payment Links API (`POST /v2/payment-links`). Betaallink verloopt niet automatisch, hosted door Mollie, geen SDK nodig (puur `requests`).

**Gevolgen:** Geen extra dependency. `MOLLIE_WEBHOOK_URL` is optioneel — wordt later gebruikt voor de feedback loop naar FunnelKit na geslaagde betaling.

---

## ADR-001: API-sleutels via wp-config.php
**Datum:** 2026-04-28
**Status:** Geaccepteerd

**Context:** De FunnelKit REST API-sleutel wordt gebruikt in beide WordPress-plugins. Hardcoding in plugincode is een veiligheidsrisico en verstoort versiebeheer.

**Beslissing:** Secrets worden gedefinieerd in `wp-config.php` via `define()`, buiten de pluginbestanden. De plugins lezen de constante op via `GROVIA_FUNNELKIT_API_KEY`.

**Gevolgen:** Sleutels staan nooit in git. `wp-config.php` valt buiten de repo. Bij deployments moet de sleutel handmatig in `wp-config.php` worden gezet op de server.
