# Conventies — Grovia Automations

## Naamgeving

_Beschrijf hier naamgevingsconventies voor bestanden, functies, variabelen, etc._

## Bestandsstructuur

_Beschrijf hier hoe de projectmap georganiseerd is._

## PHP-plugins (WordPress)

- **Eén uitsluitlijst per doel, nooit een gedeelde lijst voor twee onafhankelijke beslissingen.** In `grovia-automations.php` stuurden WhatsApp-uitnodiging en assessment-tag eerst op één `$uitsluit_categorieen`; sinds SVW (ADR-017) zijn het `$uitsluit_wa_categorieen` en `$uitsluit_assessment_categorieen`. Check bij een nieuwe academie of categorie voor élke afhankelijke tag apart of hij moet gelden.
- **Site-gedrag per product zet je aan met een productcategorie** (`has_term(..., 'product_cat', ...)`), niet met product-ID's: `formulier`, `toestemming-vereist`, `minimove`, `keuze-speler-keeper`. Berry kan het dan zelf aan- en uitzetten. WooCommerce maakt de slug zelf uit de naam — verifieer hem in wp-admin.
- **Labels in het donkere thema krijgen expliciet `color:#fff;opacity:1`.** Losse `<label>`-elementen erven anders een grijze, doorschijnende stijl die bijna onleesbaar is.

## Azure Functions

- **Gedeelde business-regels horen in `grovia_shared/`, niet per Function.** Niet alleen API-wrappers: ook definities als "wanneer is een Ixly-taak af" (`bepaal_afronding`, `haal_taken_details` in `ixly_api.py`, gedeeld door `ixly-status` en `grovia-herinnering`, ADR-018). Twee kopieën gaan uit elkaar lopen.
- **Een statuswaarde van een externe API die niet in de spec staat, is een aanname.** `ixly-status` vergeleek maandenlang op `completed`; Ixly gebruikt `finished`. Alle tests codeerden dezelfde verzonnen waarde mee: groen én verkeerd. Stel zulke waarden één keer vast tegen de live API (`explore.py`) en leg de herkomst vast in een comment, zoals bij `AFGERONDE_STATES`.

## Commits

_Beschrijf hier de commitconventie (bijv. conventional commits, vrije tekst in het Nederlands)._

## Google Apps Script

Zeven regels, alle zeven geleerd uit een productiebug. Ze zien er willekeurig uit tot je ze een keer bent tegengekomen.

1. **Neem een `LockService.getScriptLock()` rond elke functie die de Deelnemers-sheet leest, muteert en terugschrijft.** Zonder lock overschrijft een overlappende run stil de net weggeschreven staat: de dagelijkse trigger en een handmatige menu-actie schreven beide de hele sheet terug en de laatste won. Dat is één keer echt gebeurd — 27 verstuurde reminders stonden wél in het `Log`-tabblad maar hun velden nooit in `Deelnemers`. Aan de logregels is dat niet te zien, want `Log` wordt per regel los aangevuld.

2. **Nooit per-rij WooCommerce-aanroepen doen: bulk ophalen, lokaal opzoeken.** De WAF op grovia.nl blokkeert bursts. Een versie met één aanroep per rij (~35 stuks) werd na de eerste al geblokkeerd, en zelfs twee volledige productcatalogus-ophalingen binnen één run gaven een 403. Cache herhaald verkeer binnen een run met `CacheService.getScriptCache()`. `Woo.gs` zet een eigen `WOO_USER_AGENT` en probeert een 403 tot twee keer opnieuw met oplopende pauze (`_haalJson`).

3. **Google Sheets coerceert waarden in twee richtingen — dek beide af.**
   - *Lezen:* een puur numerieke tekstcel (`'2526'`) wordt zelf een getalcel, waardoor elke strikte vergelijking (`===`) stil faalt. Forceer met `String()` bij het teruglezen.
   - *Schrijven:* zet een expliciet tekstformaat (`@`) op de kolom. Een `String()` bij het lezen is niet genoeg — `join(',')` levert `"935,1147"`, en met een Nederlandse locale leest Sheets die komma als decimaalteken en maakt er een getal van. De waarde is dan al kapot vóórdat je hem terugleest.

   Gebruik daarvoor `_forceerTekstKolommen` (lijst `TEKST_KOLOMMEN` in `Sheet.gs`): na `clearContent`, vóór `setValues`. Datums worden als tekst `yyyy-MM-dd` opgeslagen (ADR-016).

   Er zijn drie bugs van deze klasse geweest: datum-coercion, seizoen-coercion en `order_ids`. Ga ervan uit dat het opnieuw gebeurt bij elke nieuwe kolom die tekst moet blijven.

4. **Zet een eigen `User-Agent` op elke `requests`-aanroep naar grovia.nl.** De standaard `python-requests/x.x.x` wordt door een server-side WAF-regel geblokkeerd met een 403 "Request forbidden by administrative rules". Bevestigd door dezelfde aanroep vanaf hetzelfde IP te herhalen met alleen een andere User-Agent. Geen IP-blokkade, dus niet zoeken in Azure-netwerkinstellingen.

5. **`Range.setFormula()` gebruikt het scheidingsteken van de werkboek-locale.** Een Nederlandstalig werkboek wil `;` in plaats van `,`; met de verkeerde krijg je een stille `#ERROR!`. Gebruik `FORMULE_SCHEIDING` (afgeleid van `getSpreadsheetLocale()`) voor elke formule die je schrijft.

6. **Een tabblad dat op kolompositie gelezen wordt, krijgt een harde kopregelcontrole** (`controleerKopregel` in `Sheet.gs`). Een verschoven kolom gooit dan een fout in plaats van stil data in de verkeerde kolom te schrijven. Sloeg meteen aan bij de uitrol van de teamindeling.

7. **Instellingen die de klant zelf wijzigt, staan in het Config-tabblad, niet in code:** scorewegingen, leeftijdsgrenzen, groepsnamen, aantal groepen, werkboek-ID's. Een formulewijziging is dan cellen aanpassen in plaats van een deploy.

## WordPress / Breakdance

- **Contentbestanden die via een Code/HTML-blok gaan, nemen hun eigen gescopete `<style>` mee.** Zo'n blok rendert rauwe HTML zonder de typografie-instellingen die de builder op zijn eigen tekstelementen zet: geen kleur, geen marges, geen leesbreedte. Scope de CSS op één wrapper-klasse zodat hij niets buiten die pagina raakt, en zet de tekstkleur op één plek zodat de rest hem via `inherit` oppikt. Zie `plugins/grovia-fysio-toestemming/infopagina.html`.

## Deploy

- **Een GitHub Secret zonder bijbehorende regel in `.github/workflows/deploy.yml` doet niets.** Niet-bestaande secrets worden gewoon leeg meegegeven aan de `az functionapp config appsettings set`-regel — geen fout, geen waarschuwing. Dit was de root cause van élke Action Type-inzending die in "Handmatig koppelen" belandde: de vier `ACTION_TYPE_ENTRY_*`-vars stonden nooit in de workflow. Check bij elke nieuwe env var of hij ook echt in `deploy.yml` staat, niet alleen of het secret bestaat.
- De WordPress-plugins hebben géén pipeline. Die gaan handmatig naar de server.

## Secrets & Omgevingsvariabelen

- Secrets worden **nooit** hardcoded in code.
- Lokaal: gebruik `local.settings.json` (nooit committen — alleen `local.settings.json.example` staat in git).
- Azure: via GitHub Secrets, doorgegeven door de deploy-workflow. Zie ADR-003.
