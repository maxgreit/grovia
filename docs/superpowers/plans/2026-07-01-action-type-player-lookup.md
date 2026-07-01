# Action Type: speler-lookup in Google Sheet — Implementatieplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `google-apps-script/action-type-setup.gs` uitbreiden zodat elke resultaten-sheet een
"Action Types"-naslagtabblad krijgt (alle 16 types + speler/omschrijving/quote) en het
"Resultaten"-tabblad per deelnemer automatisch de bijpassende speler/omschrijving/quote toont.

**Architecture:** Eén hardcoded `ACTION_TYPES`-array (zelfde patroon als de bestaande
`VRAGEN`-array) is de bron van waarheid. Een nieuwe functie `zetActionTypesTab(ss)` schrijft die
data naar een tabblad "Action Types" (index 1, direct na "Resultaten"), wordt bij elke run
volledig gewist en herschreven. `zetResultatenTab` krijgt 3 extra zelf-uitbreidende
`ARRAYFORMULA`+`VLOOKUP`-kolommen die naar dat tabblad verwijzen. Beide functies worden
aangeroepen vanuit zowel `maakFormEnSheet` (nieuwe forms) als `herstelActionType` (bestaande
sheets).

**Tech Stack:** Google Apps Script (JavaScript ES5-stijl, zoals de rest van het bestand),
Google Sheets `ARRAYFORMULA`/`VLOOKUP`/`IFERROR`.

**Testkanttekening:** Er is geen lokale testrunner voor Apps Script in dit project (geen
`clasp`, geen `appsscript.json`). Elke stap die normaal "schrijf test → run test" zou zijn, is
hier vervangen door zorgvuldige handmatige formule-verificatie tijdens het schrijven, plus één
verplichte end-to-end verificatietaak (Taak 6) die **jij** uitvoert in de Apps Script-editor,
omdat dat Google-account-OAuth vereist die niet vanuit deze sessie beschikbaar is.

---

### Task 1: `ACTION_TYPES`-data toevoegen

**Files:**
- Modify: `google-apps-script/action-type-setup.gs:69` (direct na de bestaande `VRAGEN`-array, vóór `INTRO`)

- [ ] **Step 1: Voeg de array toe**

Plaats dit blok direct na de sluitende `];` van `VRAGEN` (na regel 69) en vóór de `var INTRO =`-regel:

```javascript
// De 16 Action Types met bijpassende voetballer, uit Action Types.docx.
// Zelfde data voor beide verenigingen — spelers/types zijn niet vereniging-specifiek.
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

- [ ] **Step 2: Controleer array-lengte**

Tel de entries: moeten er exact 16 zijn (1 per Action Type-code, geen duplicaten). Zoek in het
bestand naar `code:` en tel de treffers — moet 16 zijn.

Run: `grep -c "code:" google-apps-script/action-type-setup.gs`
Expected: `16`

- [ ] **Step 3: Commit**

```bash
git add google-apps-script/action-type-setup.gs
git commit -m "feat: ACTION_TYPES-data toevoegen aan action-type-setup.gs"
```

---

### Task 2: `zetActionTypesTab` + `spelerLookupFormule` toevoegen

**Files:**
- Modify: `google-apps-script/action-type-setup.gs` (functies toevoegen ná `actionTypeFormule`, aan het eind van het bestand)

- [ ] **Step 1: Voeg de functies toe**

Plaats dit blok aan het eind van het bestand, ná de sluitende `}` van `actionTypeFormule`:

```javascript

/**
 * Zet/ververst het tabblad "Action Types" met de referentietabel van alle 16 types.
 * Wordt bij elke run volledig gewist en herschreven vanuit ACTION_TYPES — zelfde
 * bron-van-waarheid-principe als het "Resultaten"-tabblad.
 */
function zetActionTypesTab(ss) {
  var tab = ss.getSheetByName('Action Types');
  if (tab) {
    tab.clear();
  } else {
    tab = ss.insertSheet('Action Types', 1); // direct na "Resultaten"
  }

  var rijen = [['Code', 'Type', 'Speler', 'Omschrijving', 'Quote']];
  for (var i = 0; i < ACTION_TYPES.length; i++) {
    var t = ACTION_TYPES[i];
    rijen.push([t.code, t.naam, t.speler, t.omschrijving, t.quote]);
  }

  tab.getRange(1, 1, rijen.length, 5).setValues(rijen);
  tab.setFrozenRows(1);
}

/**
 * Bouwt een ARRAYFORMULA die een kolom uit "Action Types" opzoekt op basis van de
 * berekende Action Type in kolom B van hetzelfde (Resultaten-)tabblad.
 * colIndex: kolomnummer in 'Action Types'!A2:E (2=Type, 3=Speler, 4=Omschrijving, 5=Quote).
 */
function spelerLookupFormule(label, colIndex) {
  return '={"' + label + '";ARRAYFORMULA(IF($B$2:$B="","",IFERROR(VLOOKUP($B$2:$B,\'Action Types\'!$A$2:$E,' +
    colIndex + ',FALSE),"")))}';
}
```

- [ ] **Step 2: Verifieer de formule-string handmatig**

Concateneer `spelerLookupFormule('Speler', 3)` mentaal en controleer dat het resultaat exact is:

```
={"Speler";ARRAYFORMULA(IF($B$2:$B="","",IFERROR(VLOOKUP($B$2:$B,'Action Types'!$A$2:$E,3,FALSE),"")))}
```

Tel de haakjes: 4 open `(` (ARRAYFORMULA, IF, IFERROR, VLOOKUP) moeten precies 4 keer sluiten
vóór de afsluitende `}`. Dit is de enige "test" die zonder Apps Script-omgeving mogelijk is —
de formule wordt in Taak 6 live geverifieerd.

- [ ] **Step 3: Commit**

```bash
git add google-apps-script/action-type-setup.gs
git commit -m "feat: zetActionTypesTab en spelerLookupFormule toevoegen"
```

---

### Task 3: `zetResultatenTab` uitbreiden met 3 lookup-kolommen

**Files:**
- Modify: `google-apps-script/action-type-setup.gs:198-202` (binnen `zetResultatenTab`)

- [ ] **Step 1: Vervang de bestaande formule-toewijzing**

Huidige code (regel 198-202):

```javascript
  res.getRange('A1').setFormula(
    '={"Naam";ARRAYFORMULA(IF(' + P + 'A2:A="","",' + P + 'B2:B))}'
  );
  res.getRange('B1').setFormula(actionTypeFormule(P));
  res.setFrozenRows(1);
```

Vervang door:

```javascript
  res.getRange('A1').setFormula(
    '={"Naam";ARRAYFORMULA(IF(' + P + 'A2:A="","",' + P + 'B2:B))}'
  );
  res.getRange('B1').setFormula(actionTypeFormule(P));
  res.getRange('C1').setFormula(spelerLookupFormule('Speler', 3));
  res.getRange('D1').setFormula(spelerLookupFormule('Omschrijving', 4));
  res.getRange('E1').setFormula(spelerLookupFormule('Quote', 5));
  res.setFrozenRows(1);
```

- [ ] **Step 2: Controleer de aanroepvolgorde in de functie**

`zetResultatenTab` moet blijven werken zonder dat `zetActionTypesTab` al is aangeroepen (de
formules verwijzen alleen naar de tabnaam "Action Types", niet naar of die al bestaat — Google
Sheets rekent de formule pas uit zodra beide tabbladen bestaan). Geen wijziging nodig, alleen
bevestigen dat er geen harde afhankelijkheid in de code zelf zit.

- [ ] **Step 3: Commit**

```bash
git add google-apps-script/action-type-setup.gs
git commit -m "feat: Resultaten-tabblad uitbreiden met Speler/Omschrijving/Quote-kolommen"
```

---

### Task 4: `zetActionTypesTab` aanroepen vanuit `maakFormEnSheet` en `herstelActionType`

**Files:**
- Modify: `google-apps-script/action-type-setup.gs:102-110` (`herstelActionType`)
- Modify: `google-apps-script/action-type-setup.gs:154-156` (`maakFormEnSheet`, na de `zetResultatenTab`-aanroep)

- [ ] **Step 1: Wijzig `herstelActionType`**

Huidige code:

```javascript
function herstelActionType() {
  for (var i = 0; i < BESTAANDE_SHEETS.length; i++) {
    var ss   = SpreadsheetApp.openById(BESTAANDE_SHEETS[i]);
    var resp = vindReactieSheet(ss);
    zetResultatenTab(ss, resp);
    Logger.log('Hersteld: ' + ss.getName() + '  (reactie-tabblad: "' + resp.getName() + '")');
  }
  Logger.log('Klaar — open de sheets en bekijk het tabblad "Resultaten".');
}
```

Vervang door:

```javascript
function herstelActionType() {
  for (var i = 0; i < BESTAANDE_SHEETS.length; i++) {
    var ss   = SpreadsheetApp.openById(BESTAANDE_SHEETS[i]);
    var resp = vindReactieSheet(ss);
    zetResultatenTab(ss, resp);
    zetActionTypesTab(ss);
    Logger.log('Hersteld: ' + ss.getName() + '  (reactie-tabblad: "' + resp.getName() + '")');
  }
  Logger.log('Klaar — open de sheets en bekijk de tabbladen "Resultaten" en "Action Types".');
}
```

- [ ] **Step 2: Wijzig `maakFormEnSheet`**

Huidige code rond de `zetResultatenTab`-aanroep:

```javascript
  // --- 3. Resultaten-tabblad met de Action Type-formule ---
  zetResultatenTab(ss, reactieSheet);

  // --- 4. Form + Sheet naar de doelmap verplaatsen ---
```

Vervang door:

```javascript
  // --- 3. Resultaten-tabblad met de Action Type-formule + Action Types-naslagtabblad ---
  zetResultatenTab(ss, reactieSheet);
  zetActionTypesTab(ss);

  // --- 4. Form + Sheet naar de doelmap verplaatsen ---
```

- [ ] **Step 3: Commit**

```bash
git add google-apps-script/action-type-setup.gs
git commit -m "feat: zetActionTypesTab aanroepen vanuit maakFormEnSheet en herstelActionType"
```

---

### Task 5: Documentatie-correctie in `docs/ACTION-TYPE-TEST.md`

**Files:**
- Modify: `docs/ACTION-TYPE-TEST.md` (sectie "Open punten")

- [ ] **Step 1: Verwijder de onjuiste bewering**

Huidige tekst:

```markdown
## Open punten

- `Action Types.docx` beschrijft maar 12 van de 16 types — de vier `ExxJ`-types
  (ESTJ, ESFJ, ENFJ, ENTJ) missen een beschrijving. Voor de lettercombinatie maakt dat
  niets uit; alleen relevant als later de typebeschrijving getoond moet worden.
- Extra tabs per categorie (jong/oud × voetbal/keeper) volgen later, op basis van Ixly-data.
```

Vervang door:

```markdown
## Open punten

- Extra tabs per categorie (jong/oud × voetbal/keeper) volgen later, op basis van Ixly-data.
```

- [ ] **Step 2: Voeg een sectie toe over de speler-koppeling**

Voeg vóór "## Open punten" een nieuwe sectie toe:

```markdown
## Speler-koppeling

Elk van de 16 Action Types is gekoppeld aan een voetballer (quote + korte omschrijving),
overgenomen uit `Action Types.docx`. De data staat hardcoded in `ACTION_TYPES`
(`google-apps-script/action-type-setup.gs`) en wordt weggeschreven naar:

- Een naslagtabblad **"Action Types"** (alle 16 rijen: Code, Type, Speler, Omschrijving, Quote).
- 3 extra kolommen in **"Resultaten"** (Speler, Omschrijving, Quote), automatisch opgezocht per
  deelnemer op basis van hun berekende Action Type.

Zie [`docs/superpowers/specs/2026-07-01-action-type-player-lookup-design.md`](superpowers/specs/2026-07-01-action-type-player-lookup-design.md)
voor het volledige ontwerp.
```

- [ ] **Step 3: Commit**

```bash
git add docs/ACTION-TYPE-TEST.md
git commit -m "docs: Action Types.docx bevat alle 16 types + speler-koppeling documenteren"
```

---

### Task 6: Handmatige end-to-end verificatie (door jou, in de browser)

**Files:** geen — dit is een verificatiestap, geen codewijziging.

- [ ] **Step 1: Open het Apps Script-project**

Ga naar [script.google.com](https://script.google.com), open het project met
`action-type-setup.gs`, en zorg dat de nieuwe code (Taken 1–4) erin geplakt/gesynchroniseerd is.

- [ ] **Step 2: Run `herstelActionType`**

Selecteer de functie `herstelActionType` in de dropdown boven de editor en klik **Run**. Keur
eventuele nieuwe rechten-prompts goed (Sheets-toegang).

Expected: in het logboek (Beeld → Uitvoeringslog) staan 2 regels `Hersteld: ...` (Kolping
Academie + Schagen United) en een afsluitende `Klaar — ...`-regel. Geen foutmelding.

- [ ] **Step 3: Controleer het "Action Types"-tabblad op beide sheets**

Open beide resultaten-sheets (links in `docs/ACTION-TYPE-TEST.md`). Op elk:

- Tabblad "Action Types" staat op de 2e positie (na "Resultaten").
- 17 rijen (1 header + 16 types), 5 kolommen (Code, Type, Speler, Omschrijving, Quote).
- Steekproef: rij met Code `ESTJ` heeft Speler `Virgil van Dijk`.

- [ ] **Step 4: Controleer de nieuwe kolommen in "Resultaten"**

Op het "Resultaten"-tabblad: kolommen C/D/E (Speler/Omschrijving/Quote) zijn gevuld voor elke
rij die al een Naam + Action Type heeft. Als er nog geen testinzendingen zijn, zijn C/D/E leeg
(geen `#N/A`) — dat is correct gedrag.

- [ ] **Step 5: Terugkoppelen**

Meld in de sessie of dit klopt, of stuur eventuele afwijkingen (bijv. een `#N/A`- of
`#ERROR!`-melding) door zodat de formule bijgesteld kan worden.
