# Grovia Automations

Automatiseringen voor Grovia, een voetbalschool die voetbaltrainingen aanbiedt. Het project bestaat uit drie pijlers:

1. **E-mailautomatisering** — FunnelKit Automations in combinatie met zelfgeschreven WordPress-plugins
2. **Assessment aanmeldingen** — Azure Functions die kandidaten aanmelden bij Ixly Assessments, hun voortgang controleren en reminders versturen
3. **Deelnemersadministratie** — een Google Sheets-werkboek met Apps Script dat de boel orkestreert, plus een financieel afdrachtrapport

Een data warehouse (WooCommerce → Azure SQL → PowerBI) staat op de planning.

Zie [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) voor hoe de onderdelen samenhangen, en [docs/DECISIONS.md](docs/DECISIONS.md) voor waarom het zo werkt.

## Lokaal draaien

De Azure Functions draaien lokaal met Azure Functions Core Tools:

```bash
func start
```

Dat start de host op `http://localhost:7071` en registreert zes endpoints. Verwacht in de uitvoer `Host lock lease acquired` — blijft dat weg, dan is de host niet opgekomen (vaak omdat poort 7071 nog bezet is door een eerdere run).

Vereisten: Python 3.12, Azure Functions Core Tools v4, en een gevulde `local.settings.json`.

## Tests

```bash
python -m pytest -q
```

```bash
node --test 'tests/gs/*.test.js'
```

De Python-tests dekken de Azure Functions en `grovia_shared`; de Node-tests dekken de pure rekenlogica uit de Google Apps Script-bestanden. Let op de quotes rond de glob — `node --test tests/gs/` (als directory) vindt de tests niet.

## Omgevingsvariabelen

Kopieer [`local.settings.json.example`](local.settings.json.example) naar `local.settings.json` en vul de waarden. **`local.settings.json` staat in `.gitignore` en mag nooit gecommit worden.**

| Variabele | Waarvoor |
|---|---|
| `IXLY_BASE_URL` | Basis-URL van het Ixly-assessmentplatform |
| `IXLY_CLIENT_ID` / `IXLY_CLIENT_SECRET` | OAuth2 client credentials voor de Ixly-API |
| `IXLY_ORGANIZATION_UUID` | Organisatie waaronder kandidaten worden aangemaakt |
| `IXLY_REDIRECT_URI` | Redirect-URI van de OAuth-flow |
| `IXLY_AANMELDING_URL` | URL van de eigen `ixly-aanmelding`-function, gebruikt door de betaalflow |
| `MOLLIE_API_KEY` | Mollie-sleutel voor het aanmaken van betaallinks |
| `MOLLIE_REDIRECT_URL` | Waar de klant na betaling terechtkomt (`https://grovia.nl/bedankt`) |
| `MOLLIE_WEBHOOK_URL` | Publieke URL van `mollie-webhook` |
| `GROVIA_FUNNELKIT_API_KEY` | FunnelKit-API voor tags en contacten |
| `GROVIA_WORDPRESS_URL` | Basis-URL van de WordPress-site (`https://grovia.nl`) |
| `GROVIA_WOO_CONSUMER_KEY` / `GROVIA_WOO_CONSUMER_SECRET` | WooCommerce REST-sleutel **met schrijfrechten** — zie hieronder |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_GEBRUIKER` / `SMTP_WACHTWOORD` | Mailserver |
| `SMTP_AFZENDER` | Afzenderadres, en tegelijk de envelope-sender |
| `GROVIA_DEBUG_EMAIL` | Alle mail hiernaartoe omleiden. **Leeg in productie** — anders bereiken reminders geen ouders |
| `ACTION_TYPE_FORM_URL_KA` / `_SU` | Google Form-URL's per vereniging |
| `ACTION_TYPE_ENTRY_CODE_KA` / `_NAAM_KA` / `_CODE_SU` / `_NAAM_SU` | Form-entry-ID's voor de prefilled links in de uitnodigingsmail |

### Twee dingen die niet vanzelf goed gaan

**De WooCommerce-sleutel heeft schrijfrechten nodig.** `ixly-aanmelding` schrijft assignment-uuid's terug als order-meta. Dit is bewust een **aparte** sleutel, niet de alleen-lezen sleutel die het Apps Script gebruikt (least privilege). Een alleen-lezen sleutel geeft een 401 bij het wegschrijven.

**Een GitHub Secret zetten is niet genoeg.** Secrets worden aan Azure doorgegeven door [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). Staat een variabele niet in de `az functionapp config appsettings set`-regel daar, dan wordt hij stil leeg meegegeven — geen fout, geen waarschuwing. Dit was de root cause van élke Action Type-inzending die in "Handmatig koppelen" belandde. Voeg bij elke nieuwe env var dus twee dingen toe: het secret én de regel in de workflow.

Secrets-beheer loopt via GitHub Secrets, niet via de Azure Portal. Zie ADR-003.

## Deploy

De Azure Functions gaan automatisch via GitHub Actions bij een push naar `main`.

De WordPress-plugins in [`plugins/`](plugins/) hebben **geen pipeline** — die worden handmatig geüpload. Hetzelfde geldt voor de Apps Script-bestanden in [`google-apps-script/`](google-apps-script/) en voor de inhoud van de WP-pagina `/toestemming-fysieke-intakes/`. Een wijziging in git is daar dus nog niet live.

## Documentatie

| Bestand | Inhoud |
|---|---|
| [docs/HANDOFF.md](docs/HANDOFF.md) | Overdracht tussen sessies — wat werkt, wat open staat |
| [docs/TODO.md](docs/TODO.md) | Actielijst |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Architectuurbeslissingen (ADR's) |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Technische opzet en componentenoverzicht |
| [docs/CONVENTIONS.md](docs/CONVENTIONS.md) | Naamgeving, stijl, patronen — inclusief de valkuilen die geld hebben gekost |
| [docs/GLOSSARY.md](docs/GLOSSARY.md) | Projectspecifieke termen |
| [docs/ACTION-TYPE-TEST.md](docs/ACTION-TYPE-TEST.md) | Opzet en scoring van de Action Type-test |
