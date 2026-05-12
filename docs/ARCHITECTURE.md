# Architectuur — Grovia Automations

## Overzicht

_Nog in te vullen — beschrijf hier de globale architectuur en hoe de onderdelen samenhangen._

## Onderdelen

### 1. E-mailautomatisering (WordPress / FunnelKit)

De automatisering bestaat uit twee PHP-plugins die als keten samenwerken:

**Plugin:** [`plugins/grovia-automations/`](../plugins/grovia-automations/)

#### Keten

```
Aankoop (WooCommerce)
  → grovia_generate_ixly_tag        (grovia-automations.php)
      Maakt tag aan: [School][Fase][Seizoen] bijv. SUC12627
      Wijst tag toe aan FunnelKit-contact

  → grovia_assessment_router        (grovia-assessment-router.php)
      Triggered op: Tag Added
      Checkt of contact al assessment heeft dit seizoen
      Kiest uitkomst:
        C1 / SMT / SZT → tag StuurAssessment
        C2 / C3        → tag StuurBetaallinkAssessment

  → Workflow 3: tag StuurAssessment
      Azure Function aanroepen → kandidaat + assignment aanmaken bij Ixly
      E-mail met login_url (directe assessmentlink)

  → Workflow 3: tag StuurBetaallinkAssessment
      E-mail met betaallink voor instapkosten (C2/C3 missen cyclus 1)
      Na betaling → tag StuurAssessment → zelfde pad als hierboven
```

#### Tagformaat

`[Schoolcode][Fasecode][Seizoencode]` — bijv. `SUC12627`

| Onderdeel | Omschrijving | Voorbeeld |
|---|---|---|
| Schoolcode | 2 letters, op basis van productcategorie-slug | `SU` (Schagen United) |
| Fasecode | 2–3 letters, op basis van `pa_inschrijving` attribuut | `C1`, `C2`, `SMT` |
| Seizoencode | 4 cijfers: laatste 2 van start- + eindjaar | `2627` (2026–2027) |

#### Secrets

`GROVIA_FUNNELKIT_API_KEY` staat **niet** in de plugin-code maar in `wp-config.php`. Zie ADR-001.

### 2. Assessment aanmeldingen (Azure Functions)

**App naam:** `grovia-automations`
**Base URL:** `https://grovia-automations-a9dxfzhpg3bbg8cr.westeurope-01.azurewebsites.net`

| Endpoint | Trigger | Functie |
|---|---|---|
| `/api/ixly-aanmelding` | FunnelKit tag `StuurAssessment` | Candidate upsert + assignments aanmaken bij Ixly + e-mail met sign_up_url |
| `/api/mollie-betaallink` | FunnelKit tag `StuurBetaallinkAssessment` | Mollie betaallink aanmaken + e-mail naar klant |

**Verwachte payload beide endpoints (JSON POST):**

`/api/ixly-aanmelding`:
```json
{
  "voornaam":    "{{contact_first_name}}",
  "achternaam":  "{{contact_last_name}}",
  "email":       "{{contact_email}}",
  "wc_klant_id": "{{wc_customer_id}}"
}
```

`/api/mollie-betaallink`:
```json
{
  "voornaam":    "{{contact_first_name}}",
  "achternaam":  "{{contact_last_name}}",
  "email":       "{{contact_email}}",
  "wc_klant_id": "{{wc_customer_id}}",
  "bedrag":      "75.00"
}
```

### 3. Data warehouse (Azure SQL + PowerBI)

_Beschrijf hier de datastroom: WooCommerce API → Azure SQL → PowerBI._

## Infrastructuur

_Hosting, omgevingen (dev/prod), secrets-beheer._

## Externe koppelingen

| Service | Doel | Documentatie |
|---|---|---|
| FunnelKit Automations | E-mailflows | — |
| Ixly Assessments API | Assessment aanmeldingen | — |
| WooCommerce API (WCAPI) | Productdata uitlezen | — |
| Azure Functions | Serverless backend logica | — |
| Azure SQL Database | Data warehouse | — |
| PowerBI | Visualisaties | — |
