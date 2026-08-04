# Conventies — Grovia Automations

## Naamgeving

_Beschrijf hier naamgevingsconventies voor bestanden, functies, variabelen, etc._

## Bestandsstructuur

_Beschrijf hier hoe de projectmap georganiseerd is._

## PHP-plugins (WordPress)

_Beschrijf hier stijlafspraken voor de WordPress PHP-plugins._

## Azure Functions

_Beschrijf hier de structuur en naamgeving van Azure Functions._

## Commits

_Beschrijf hier de commitconventie (bijv. conventional commits, vrije tekst in het Nederlands)._

## Google Apps Script

Vier regels, alle vier geleerd uit een productiebug. Ze zien er willekeurig uit tot je ze een keer bent tegengekomen.

1. **Neem een `LockService.getScriptLock()` rond elke functie die de Deelnemers-sheet leest, muteert en terugschrijft.** Zonder lock overschrijft een overlappende run stil de net weggeschreven staat: de dagelijkse trigger en een handmatige menu-actie schreven beide de hele sheet terug en de laatste won. Dat is één keer echt gebeurd — 27 verstuurde reminders stonden wél in het `Log`-tabblad maar hun velden nooit in `Deelnemers`. Aan de logregels is dat niet te zien, want `Log` wordt per regel los aangevuld.

2. **Nooit per-rij WooCommerce-aanroepen doen: bulk ophalen, lokaal opzoeken.** De WAF op grovia.nl blokkeert bursts. Een versie met één aanroep per rij (~35 stuks) werd na de eerste al geblokkeerd, en zelfs twee volledige productcatalogus-ophalingen binnen één run gaven een 403. Cache herhaald verkeer binnen een run met `CacheService.getScriptCache()`.

3. **Google Sheets coerceert waarden in twee richtingen — dek beide af.**
   - *Lezen:* een puur numerieke tekstcel (`'2526'`) wordt zelf een getalcel, waardoor elke strikte vergelijking (`===`) stil faalt. Forceer met `String()` bij het teruglezen.
   - *Schrijven:* zet een expliciet tekstformaat (`@`) op de kolom. Een `String()` bij het lezen is niet genoeg — `join(',')` levert `"935,1147"`, en met een Nederlandse locale leest Sheets die komma als decimaalteken en maakt er een getal van. De waarde is dan al kapot vóórdat je hem terugleest.

   Er zijn drie bugs van deze klasse geweest: datum-coercion, seizoen-coercion en `order_ids`. Ga ervan uit dat het opnieuw gebeurt bij elke nieuwe kolom die tekst moet blijven.

4. **Zet een eigen `User-Agent` op elke `requests`-aanroep naar grovia.nl.** De standaard `python-requests/x.x.x` wordt door een server-side WAF-regel geblokkeerd met een 403 "Request forbidden by administrative rules". Bevestigd door dezelfde aanroep vanaf hetzelfde IP te herhalen met alleen een andere User-Agent. Geen IP-blokkade, dus niet zoeken in Azure-netwerkinstellingen.

## WordPress / Breakdance

- **Contentbestanden die via een Code/HTML-blok gaan, nemen hun eigen gescopete `<style>` mee.** Zo'n blok rendert rauwe HTML zonder de typografie-instellingen die de builder op zijn eigen tekstelementen zet: geen kleur, geen marges, geen leesbreedte. Scope de CSS op één wrapper-klasse zodat hij niets buiten die pagina raakt, en zet de tekstkleur op één plek zodat de rest hem via `inherit` oppikt. Zie `plugins/grovia-fysio-toestemming/infopagina.html`.

## Deploy

- **Een GitHub Secret zonder bijbehorende regel in `.github/workflows/deploy.yml` doet niets.** Niet-bestaande secrets worden gewoon leeg meegegeven aan de `az functionapp config appsettings set`-regel — geen fout, geen waarschuwing. Dit was de root cause van élke Action Type-inzending die in "Handmatig koppelen" belandde: de vier `ACTION_TYPE_ENTRY_*`-vars stonden nooit in de workflow. Check bij elke nieuwe env var of hij ook echt in `deploy.yml` staat, niet alleen of het secret bestaat.
- De WordPress-plugins hebben géén pipeline. Die gaan handmatig naar de server.

## Secrets & Omgevingsvariabelen

- Secrets worden **nooit** hardcoded in code.
- Lokaal: gebruik `local.settings.json` (nooit committen — alleen `local.settings.json.example` staat in git).
- Azure: via GitHub Secrets, doorgegeven door de deploy-workflow. Zie ADR-003.
