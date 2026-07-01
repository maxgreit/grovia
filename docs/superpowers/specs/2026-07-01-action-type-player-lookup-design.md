# Action Type: speler-lookup in Google Sheet — ontwerp

**Datum:** 2026-07-01
**Status:** Goedgekeurd, klaar voor implementatieplan

## Doel

`google-apps-script/action-type-setup.gs` uitbreiden zodat elke resultaten-sheet (Kolping
Academie + Schagen United) niet alleen de Naam + berekende Action Type toont, maar ook welke
voetballer bij dat type hoort, met een korte omschrijving en quote — direct naast elke
deelnemer, plus een overzichtelijk naslag-tabblad met alle 16 types.

Bron van de speler-data: `test_docs/Action Types.docx`. Dat bestand bevat — anders dan
`docs/ACTION-TYPE-TEST.md` nu (onterecht) stelt — alle 16 Action Types, inclusief de 4
`ExxJ`-varianten. Per type staat er een quote, een voorbeeldspeler met korte omschrijving, een
langere "Hoe ze leren"-alinea en coach-tips. Alleen quote + speler + korte omschrijving worden
in de sheet gebruikt; de langere alinea en coach-tips blijven buiten scope.

## Data

Eén hardcoded array `ACTION_TYPES` in het script (zelfde patroon als de bestaande `VRAGEN`-array),
identiek voor beide verenigingen (spelers/types zijn niet vereniging-specifiek):

```javascript
var ACTION_TYPES = [
  { code: 'ISTJ', naam: 'De Zekerheidszoeker', speler: 'Gerard Piqué',
    omschrijving: 'altijd solide en gedisciplineerd in zijn spel',
    quote: 'Jij bent betrouwbaar en standvastig – jouw team kan altijd op je rekenen.' },
  { code: 'ISFJ', naam: 'De Teamhelper', speler: 'N’Golo Kanté',
    omschrijving: 'de stille kracht die alles voor het team geeft',
    quote: 'Jij bent zorgzaam en loyaal – het team voelt zich sterker door jouw inzet.' },
  { code: 'INFJ', naam: 'De Verbeeldingsdenker', speler: 'Kevin De Bruyne',
    omschrijving: 'meester in het zien van het grotere plaatje op het veld',
    quote: 'Jij bent visionair – jij ziet verbanden die anderen missen.' },
  { code: 'INTJ', naam: 'De Slimme plannenmaker', speler: 'Toni Kroos',
    omschrijving: 'kalm, berekenend en altijd met een plan in zijn spel',
    quote: 'Jij bent strategisch en doelgericht – jij speelt altijd met een plan.' },
  { code: 'ISTP', naam: 'De Uitprobeerder', speler: 'Trent Alexander-Arnold',
    omschrijving: 'creatief en oplossingsgericht in actie',
    quote: 'Jij bent een probleemoplosser – jij ontdekt het spel door te doen.' },
  { code: 'ISFP', naam: 'De Rustige doener', speler: 'Andreas Christensen',
    omschrijving: 'rustig, stabiel en effectief zonder veel woorden',
    quote: 'Jij bent bescheiden maar waardevol – jouw kracht ligt in stilte en daden.' },
  { code: 'INFP', naam: 'De Fantasievolle speler', speler: 'Paulo Dybala',
    omschrijving: 'fantasierijk en uniek in zijn spelstijl',
    quote: 'Jij bent creatief en origineel – jij verrast met je eigen manier van spelen.' },
  { code: 'INTP', naam: 'De Puzzelaar', speler: 'Matthijs de Ligt',
    omschrijving: 'denkt vooruit en analyseert slim in de verdediging',
    quote: 'Jij bent nieuwsgierig en analytisch – jij ontrafelt elke situatie.' },
  { code: 'ESTP', naam: 'De Actiespeler', speler: 'Kylian Mbappé',
    omschrijving: 'razendsnel en leert het meest in het spel zelf',
    quote: 'Jij bent snel en gedurfd – jij leert door direct in actie te komen.' },
  { code: 'ESFP', naam: 'De Pleziermaker', speler: 'Vinícius Júnior',
    omschrijving: 'sprankelend en altijd spelend met plezier',
    quote: 'Jij bent energiek en vrolijk – jij brengt plezier en enthousiasme in het team.' },
  { code: 'ENFP', naam: 'De Ideeënbedenker', speler: 'João Félix',
    omschrijving: 'speels en altijd op zoek naar creatieve oplossingen',
    quote: 'Jij bent creatief en inspirerend – jij bruist van de nieuwe ideeën.' },
  { code: 'ENTP', naam: 'De Uitdager', speler: 'Zlatan Ibrahimović',
    omschrijving: 'eigenzinnig, uitdagend en altijd vol bravoure',
    quote: 'Jij bent vindingrijk en gedurfd – jij zoekt altijd de uitdaging op.' },
  { code: 'ESTJ', naam: 'De Regelsbewaker', speler: 'Virgil van Dijk',
    omschrijving: 'sterk in discipline en organisatie achterin',
    quote: 'Jij bent gedisciplineerd en duidelijk – jij zorgt dat afspraken nageleefd worden.' },
  { code: 'ESFJ', naam: 'De Vriend', speler: 'Thomas Müller',
    omschrijving: 'altijd positief en een echte teamspeler',
    quote: 'Jij bent sociaal en verbindend – jij maakt het team hechter.' },
  { code: 'ENFJ', naam: 'De Aanmoediger', speler: 'Jordan Henderson',
    omschrijving: 'moedigt aan en inspireert zijn teamgenoten constant',
    quote: 'Jij bent inspirerend en motiverend – jij tilt anderen naar een hoger niveau.' },
  { code: 'ENTJ', naam: 'De Leider', speler: 'Cristiano Ronaldo',
    omschrijving: 'gedreven leider die altijd vooropgaat',
    quote: 'Jij bent doelgericht en vastberaden – jij neemt de leiding met overtuiging.' }
];
```

## Nieuw tabblad "Action Types"

Statische referentietabel, 1 header-rij + 16 datarijen, kolommen:

| A: Code | B: Type | C: Speler | D: Omschrijving | E: Quote |
|---|---|---|---|---|

Geplaatst direct na "Resultaten" (index 1). Geschreven door nieuwe functie
`zetActionTypesTab(ss)`, die het tabblad **bij elke run volledig wist en herschrijft** vanuit
`ACTION_TYPES` (zelfde bron-van-waarheid-principe als het bestaande "Resultaten"-tabblad) —
zolang de teksten nog kunnen wijzigen in `Action Types.docx`, blijft het script leidend.

## Uitbreiding "Resultaten"-tabblad

3 nieuwe kolommen naast de bestaande Naam (A) en Action Type (B):

| A: Naam | B: Action Type | C: Speler | D: Omschrijving | E: Quote |
|---|---|---|---|---|

Elke nieuwe kolom is een zelf-uitbreidende `ARRAYFORMULA` + `VLOOKUP` tegen het "Action
Types"-tabblad, met `IFERROR` naar een lege string als er (onverwacht) geen match is — geen
`#N/A` in de sheet. Voorbeeld voor kolom C (Speler, col_index 3 in `A2:E` van "Action Types"):

```
={"Speler";ARRAYFORMULA(IF($B$2:$B="","",IFERROR(VLOOKUP($B$2:$B,'Action Types'!$A$2:$E,3,FALSE),"")))}
```

Kolom D (Omschrijving) en E (Quote) zijn analoog, met col_index 4 resp. 5.

## Scriptstructuur

- Nieuwe functie `zetActionTypesTab(ss)` — analoog aan bestaande `zetResultatenTab(ss, respSheet)`.
- `zetResultatenTab` uitgebreid met de 3 nieuwe lookup-formules (C1/D1/E1) naast de bestaande
  A1/B1.
- Beide functies aangeroepen vanuit **zowel** `maakFormEnSheet` (nieuwe forms) **als**
  `herstelActionType` (bestaande sheets) — dus direct met `herstelActionType` op de 2 live
  sheets (Kolping Academie + Schagen United) toe te passen zonder nieuwe formulieren/links.

## Documentatie-correctie (losstaand, geen code)

`docs/ACTION-TYPE-TEST.md` — sectie "Open punten" beweert dat `Action Types.docx` maar 12 van
de 16 types beschrijft. Bij het uitlezen van het bestand voor dit ontwerp bleek dat onjuist:
alle 16 types (inclusief de 4 `ExxJ`-varianten) staan erin. Wordt gecorrigeerd als onderdeel van
de implementatie (los commit-punt, geen `.gs`-wijziging).

## Buiten scope

- De langere "Hoe ze leren"-alinea en coach-tips per type — niet gevraagd, niet toegevoegd.
- Vereniging-specifieke varianten van de speler-data — data is identiek voor KA en SU.
- Wijzigingen aan de Google Form zelf (vragen, intro-tekst) — alleen het resultaten-sheet.
