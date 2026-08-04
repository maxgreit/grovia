# Toestemmingsverklaring op de infopagina — ontwerp

**Datum:** 2026-08-04 · **Auteur:** Max Rood (met Claude) · **Status:** geïmplementeerd, publicatie in WordPress staat nog open

## Aanleiding

De WooCommerce-checkout toont sinds 2026-07-28 een optioneel toestemmingsvinkje voor de fysieke
testen (plugin `grovia-fysio-toestemming`). Dat vinkje linkt naar `/toestemming-fysieke-intakes/`,
een pagina die nooit is aangemaakt en dus 404 gaf. De inhoud ontbrak: die moest van de klant komen.

Op 2026-08-04 leverde Grovia de definitieve toestemmingsverklaring aan, opgesteld met SMC Dijk en
Waard en goedgekeurd door beide partijen. Daarmee kan de pagina gevuld worden.

Bij het lezen van die verklaring kwam een tweede punt boven water: het document schrijft **letterlijk
voor met welke tekst het hokje aangevinkt wordt**, en die tekst week af van wat de plugin live
toonde. Dat is meegenomen in deze wijziging.

## Besluiten

### 1. De verklaring wordt verbatim overgenomen

De pagina bevat de tekst van de verklaring één-op-één, alleen omgezet naar HTML-koppen en -lijsten.

**Waarom niet herschrijven voor het web:** het is een toestemmingsverklaring waarop een derde partij
(SMC Dijk en Waard) declareert bij de zorgverzekeraar. Elke herformulering is juridisch een nieuwe
tekst en moet opnieuw langs Berry en SMC. Verbatim houdt de keten schoon: wat de ouder leest is
precies wat is goedgekeurd. De prijs is een formelere toon dan een gewone webpagina — geaccepteerd.

Drie bewuste afwijkingen van het document:

| Afwijking | Reden |
|---|---|
| De zin *"Dit hokje is te vinden op de aanmeldpagina van de voetbalacademie waaraan men wil deelnemen op de website van Grovia.nl"* is weggelaten | Op deze pagina, waar je vanaf de checkout naartoe klikt, verwijst die zin naar zichzelf. Verandert de toestemming inhoudelijk niet. |
| Een sectie "Toestemming intrekken" is toegevoegd, die niet in de verklaring staat | Het document beschrijft dat recht niet, maar onder de AVG bestaat het wel en hoort het dus op de pagina. De klant leverde de antwoorden nog in dezelfde sessie: intrekken gaat via `b.moolenaar@grovia.nl`, en het gevolg is dat de deelnemer voor zover het blessurepreventie betreft niet meedoet aan de volgende testronde. Voor de bewaring van al gedeelde gegevens verwijzen we naar de [privacyverklaring van SMC](https://smcdijkenwaard.nl/privacy-verklaring/) in plaats van dat zelf te beschrijven — dat is hun bewaarplicht als zorgverlener. |
| Het contactblok van Grovia is ingekort tot `b.moolenaar@grovia.nl` | Adres, website en de opmerking "dit is een postadres" staan al in de sitefooter. Dubbel op de pagina leest als een brief in plaats van een webpagina. Het blok van SMC blijft wél volledig staan: nieuwe informatie, en ouders moeten die praktijk kunnen bereiken. |

### 2. De vinkje-tekst volgt de verklaring letterlijk

Was: *"Ik geef toestemming voor de fysieke intakes en behandelingen door de fysiopraktijk en het
declareren hiervan bij de zorgverzekeraar."*

Wordt, conform de verklaring: *"Ik ga ermee akkoord dat het in kaart brengen van bestaande blessures
en het preventief voorkomen van blessures door middel van testen en meten wordt vergoed via de
basisverzekering fysiotherapie."*

De "Lees hier wat dit inhoudt"-link blijft erachter staan. `name`, `id`, de order-meta-sleutels
(`_grovia_fysio_toestemming`, `_grovia_fysio_toestemming_tijdstip`) en de pop-up blijven ongemoeid:
alleen de zichtbare tekst wijzigt, dus bestaande orders en de admin-weergave zijn niet geraakt.

**Waarom dit erbij hoort:** als de ouder op een andere tekst klikt dan het document zegt dat ze
aanvinken, is de toestemmingsketen inconsistent — precies het risico bij een consent waarop een
derde partij declareert.

De pop-uptekst is bewust níet aangepast. Die zegt inhoudelijk hetzelfde als de sectie "Gevolgen van
niet akkoord gaan" in de verklaring en is letterlijk door de klant aangeleverd.

### 3. De pagina blijft een handmatig beheerde WP-pagina

De inhoud staat als kale body-HTML in `plugins/grovia-fysio-toestemming/infopagina.html` en wordt
door Max in de WordPress-editor geplakt op `/toestemming-fysieke-intakes/`.

**Waarom niet de plugin de pagina laten serveren:** dan is elke tekstwijziging een deploy en kan
Grovia er zelf niet bij. Voor een juridische tekst die de klant beheert is dat de verkeerde kant op.
Het sluit ook aan bij wat er al was: de plugin verwijst met een constante (`GROVIA_FYSIO_INFO_URL`)
naar een handmatige pagina. Nadeel: de tekst kan in WP afwijken van het bestand in git — het bestand
is de bron, niet de spiegel.

Het HTML-bestand bevat alleen body-content: geen `<html>`/`<head>`, geen paginatitel-`<h1>` (die zet
WordPress uit de paginanaam), geen logo's en geen eigen `<style>`. Header, footer en opmaak komen van
het sitethema.

### 4. Terminologie blijft zoals hij is

De verklaring gebruikt "testen en meten t.b.v. blessurepreventie", waar plugin, pop-up en de URL-slug
"fysieke intakes en behandelingen" zeggen. Dat is nu een derde variant naast de twee die er al waren.
Bewust niet opgelost in deze wijziging: alles gelijktrekken raakt ook de pop-up, de
plugin-beschrijving en de slug (met een redirect voor de oude), en dat is een aparte klus. De nieuwe
vinkje-tekst en de pagina zijn intern wel consistent, want beide komen uit hetzelfde document.

## Wijzigingen

| Bestand | Wijziging |
|---|---|
| `plugins/grovia-fysio-toestemming/infopagina.html` | Nieuw — pagina-inhoud, verbatim uit de verklaring |
| `plugins/grovia-fysio-toestemming/infopagina-concept.md` | Verwijderd — placeholderversie met onbeantwoorde `[HAKEN]`, achterhaald |
| `plugins/grovia-fysio-toestemming/grovia-fysio-toestemming.php` | Vinkje-tekst, docblock-waarschuwing weg, versie naar 1.1.0 |
| `docs/TODO.md` | Publicatiestappen expliciet, klantvragen ingekort tot wat nog open is |

## Verificatie

- `php -l` via Docker `php:8.2-cli`: geen syntaxfouten.
- HTML-nesting gecontroleerd met een parser: geen ongesloten of verkeerd gesloten tags.
- Geen unit-tests. Er is geen PHP-testopstelling in dit project, en één stringwijziging plus een
  statisch contentbestand rechtvaardigt er geen.

## Nog te doen door Max

1. Pagina `/toestemming-fysieke-intakes/` aanmaken in WordPress en `infopagina.html` erin plakken.
2. Plugin v1.1.0 uploaden naar WordPress — deze plugins hebben geen deploy-pipeline (anders dan de
   Azure Functions). Zolang dat niet gebeurd is staat de oude vinkje-tekst nog live.
3. Het adres van SMC verifiëren: "Helena Nordheimland 3" ziet uit als een typo voor
   "Nordheimlaan". Staat nu letterlijk zo op de pagina.
