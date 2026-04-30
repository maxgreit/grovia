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

## ADR-001: API-sleutels via wp-config.php
**Datum:** 2026-04-28
**Status:** Geaccepteerd

**Context:** De FunnelKit REST API-sleutel wordt gebruikt in beide WordPress-plugins. Hardcoding in plugincode is een veiligheidsrisico en verstoort versiebeheer.

**Beslissing:** Secrets worden gedefinieerd in `wp-config.php` via `define()`, buiten de pluginbestanden. De plugins lezen de constante op via `GROVIA_FUNNELKIT_API_KEY`.

**Gevolgen:** Sleutels staan nooit in git. `wp-config.php` valt buiten de repo. Bij deployments moet de sleutel handmatig in `wp-config.php` worden gezet op de server.
