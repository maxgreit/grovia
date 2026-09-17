# Geboortedatum-behoud Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Geboortedatums (en datum-achtige teamnamen) in het werkboek "Grovia Deelnemers" kunnen niet meer stil van type veranderen of verdwijnen: tekstopslag `yyyy-MM-dd`, plus een script-eigen tabblad "Geboortedatums" waaruit elke run lege cellen terugvult.

**Architecture:** Alle logica blijft in pure functies (testbaar met `node --test`), alle Sheet-toegang in `Sheet.gs`. Woo.gs normaliseert de checkoutdatum naar `yyyy-MM-dd`; Sheet.gs forceert platte tekst (`@`) op de kwetsbare kolommen vóór het schrijven; Deelnemers.gs krijgt twee pure functies voor het terugvullen uit en bijwerken van de bron "Geboortedatums"; Dagelijks.gs roept ze aan in stap 1. Spec: `docs/superpowers/specs/2026-09-17-geboortedatum-behoud-design.md`.

**Tech Stack:** Google Apps Script (V8, ES5-stijl functies, `const`/`let` toegestaan), node:test voor pure functies. Geen SpreadsheetApp-mocks: I/O-functies in Sheet.gs zijn bewust dun en ongetest.

## Global Constraints

- Code, commits en docs in het Nederlands (CLAUDE.md).
- Nooit secrets in code.
- Tests: `node --test "tests/gs/*.test.js"` moet groen blijven (baseline 269 passed). Pytest is niet geraakt.
- Sheet.gs is de enige plek die SpreadsheetApp aanraakt; nieuwe I/O komt daar.
- Bestandsvolgorde in node-tests: Sheet.gs vóór Deelnemers.gs, en `global.parseIxlyTaken` wordt in `tests/gs/deelnemers.test.js` al gezet.
- Datum-tekst is altijd `yyyy-MM-dd`. Onherkenbare invoer wordt nooit stil leeg gemaakt.
- Commit per taak, formaat `feat:`/`docs:`, met de Co-Authored-By-regel uit de systeeminstructies.

---

### Task 1: Geboortedatum uit WooCommerce normaliseren naar `yyyy-MM-dd`

**Files:**
- Modify: `google-apps-script/deelnemers/Woo.gs:169-223` (`_normaliseer` en `module.exports`)
- Test: `tests/gs/woo.test.js`

**Interfaces:**
- Produces: `normaliseerGeboortedatum(tekst: string) => string` — pure, geëxporteerd. Levert `yyyy-MM-dd` voor `yyyy-MM-dd`, `d-M-yyyy`, `dd-MM-yyyy`, `d/M/yyyy`, `dd/MM/yyyy` (ook met spaties eromheen); anders de getrimde invoer ongewijzigd; lege invoer → `''`.

- [ ] **Step 1: Schrijf de falende tests**

Voeg onderaan `tests/gs/woo.test.js` toe:

```js
const { normaliseerGeboortedatum } = require('../../google-apps-script/deelnemers/Woo.gs');

test('normaliseerGeboortedatum laat yyyy-MM-dd ongemoeid', () => {
  assert.strictEqual(normaliseerGeboortedatum('2017-03-22'), '2017-03-22');
});

test('normaliseerGeboortedatum zet d-M-yyyy en dd-MM-yyyy om', () => {
  assert.strictEqual(normaliseerGeboortedatum('22-3-2017'), '2017-03-22');
  assert.strictEqual(normaliseerGeboortedatum('22-03-2017'), '2017-03-22');
  assert.strictEqual(normaliseerGeboortedatum('1-1-2016'), '2016-01-01');
});

test('normaliseerGeboortedatum zet d/M/yyyy om en trimt witruimte', () => {
  assert.strictEqual(normaliseerGeboortedatum(' 22/03/2017 '), '2017-03-22');
});

test('normaliseerGeboortedatum geeft onherkenbare tekst getrimd terug, nooit leeg', () => {
  assert.strictEqual(normaliseerGeboortedatum(' 22 maart 2017 '), '22 maart 2017');
  assert.strictEqual(normaliseerGeboortedatum('onbekend'), 'onbekend');
});

test('normaliseerGeboortedatum geeft lege string voor leeg/null', () => {
  assert.strictEqual(normaliseerGeboortedatum(''), '');
  assert.strictEqual(normaliseerGeboortedatum(null), '');
  assert.strictEqual(normaliseerGeboortedatum(undefined), '');
});

test('_normaliseer levert geboortedatum_kind als yyyy-MM-dd, ook bij Nederlandse checkoutinvoer', () => {
  const o = _normaliseer(order({ meta_data: [
    { key: 'Naam kind', value: 'Kick Govers' },
    { key: 'Geboortedatum kind', value: '23-10-2015' }
  ] }), {});
  assert.strictEqual(o.geboortedatum_kind, '2015-10-23');
});
```

Let op: `order(...)` en `_normaliseer` bestaan al bovenaan het testbestand. Controleer de signatuur van `_normaliseer` in Woo.gs (tweede argument `producten`) en geef `{}` mee zoals de bestaande tests dat doen; kopieer het patroon van een bestaande `_normaliseer`-test als het tweede argument anders heet.

- [ ] **Step 2: Draai de tests, verwacht falen**

Run: `node --test tests/gs/woo.test.js`
Expected: FAIL met `normaliseerGeboortedatum is not a function` (of `undefined`).

- [ ] **Step 3: Implementeer in Woo.gs**

Voeg vóór `function _normaliseer(order, producten)` toe:

```js
/**
 * Zet de checkoutwaarde 'Geboortedatum kind' om naar 'yyyy-MM-dd'.
 *
 * Het checkoutveld is vrije tekst; in de praktijk komen 'yyyy-MM-dd', 'd-M-yyyy' en
 * 'd/M/yyyy' voor. Alles wat niet herkend wordt gaat getrimd en ongewijzigd door --
 * bewust nooit stil leeg, want een lege cel is precies het probleem dat we oplossen
 * (zie docs/superpowers/specs/2026-09-17-geboortedatum-behoud-design.md).
 *
 * @param {*} tekst
 * @return {string} 'yyyy-MM-dd', de getrimde invoer, of ''
 */
function normaliseerGeboortedatum(tekst) {
  const s = String(tekst === undefined || tekst === null ? '' : tekst).trim();
  if (!s) {
    return '';
  }
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    return m[1] + '-' + _tweeCijfers(m[2]) + '-' + _tweeCijfers(m[3]);
  }
  m = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
  if (m) {
    return m[3] + '-' + _tweeCijfers(m[2]) + '-' + _tweeCijfers(m[1]);
  }
  return s;
}

function _tweeCijfers(n) {
  return ('0' + Number(n)).slice(-2);
}
```

Wijzig in `_normaliseer` de regel

```js
    geboortedatum_kind: geboortedatumVeld ? String(geboortedatumVeld.value).trim() : '',
```

naar

```js
    geboortedatum_kind: geboortedatumVeld ? normaliseerGeboortedatum(geboortedatumVeld.value) : '',
```

en breid de export uit:

```js
  module.exports = { _normaliseer: _normaliseer, normaliseerGeboortedatum: normaliseerGeboortedatum };
```

- [ ] **Step 4: Draai alle tests**

Run: `node --test "tests/gs/*.test.js"`
Expected: alle tests PASS (269 + 6 nieuwe = 275).

- [ ] **Step 5: Commit**

```bash
git add google-apps-script/deelnemers/Woo.gs tests/gs/woo.test.js
git commit -m "feat: geboortedatum uit WooCommerce genormaliseerd naar yyyy-MM-dd"
```

---

### Task 2: Deelnemers lezen en schrijven als platte tekst

**Files:**
- Modify: `google-apps-script/deelnemers/Sheet.gs:54-91` (`leesDeelnemers`), `:112-139` (`schrijfDeelnemers`), `module.exports` onderaan
- Test: `tests/gs/sheet.test.js`

**Interfaces:**
- Produces: `TEKST_KOLOMMEN = ['geboortedatum_kind', 'team', 'order_ids']` (geëxporteerd) en `tekstKolomIndexen(kolommen: string[], tekstKolommen: string[]) => number[]` — 1-gebaseerde kolomnummers van `tekstKolommen` binnen `kolommen`, in de volgorde van `kolommen`; namen die niet voorkomen worden overgeslagen. Task 3 hergebruikt deze functie voor de teamwerkboeken.

- [ ] **Step 1: Schrijf de falende tests**

Voeg onderaan `tests/gs/sheet.test.js` toe:

```js
const { TEKST_KOLOMMEN, tekstKolomIndexen } = require('../../google-apps-script/deelnemers/Sheet.gs');

test('TEKST_KOLOMMEN bevat precies de kolommen die Sheets anders zelf naar datum/getal omzet', () => {
  assert.deepStrictEqual(TEKST_KOLOMMEN, ['geboortedatum_kind', 'team', 'order_ids']);
});

test('tekstKolomIndexen geeft 1-gebaseerde kolomnummers in kolomvolgorde', () => {
  const kolommen = ['seizoen', 'naam_slug', 'geboortedatum_kind', 'club', 'team', 'order_ids'];
  assert.deepStrictEqual(tekstKolomIndexen(kolommen, ['team', 'geboortedatum_kind', 'order_ids']), [3, 5, 6]);
});

test('tekstKolomIndexen slaat namen over die niet in de kolommenlijst staan', () => {
  assert.deepStrictEqual(tekstKolomIndexen(['naam_slug', 'team'], ['geboortedatum_kind', 'team']), [2]);
});

test('tekstKolomIndexen geeft een lege lijst zonder overlap', () => {
  assert.deepStrictEqual(tekstKolomIndexen(['a', 'b'], ['c']), []);
});
```

- [ ] **Step 2: Draai de tests, verwacht falen**

Run: `node --test tests/gs/sheet.test.js`
Expected: FAIL met `tekstKolomIndexen is not a function`.

- [ ] **Step 3: Implementeer in Sheet.gs**

Voeg direct na de `KOLOMMEN`-definitie (na regel 51, vóór `leesDeelnemers`) toe:

```js
/**
 * Kolommen die ALTIJD platte tekst moeten zijn. Sheets zet een cel met '14-1' (team)
 * of '935,1147' (order_ids) bij het schrijven zelf om naar een datum of getal, en een
 * datumcel sneuvelt bij sorteren/plakken door mensen -- zo liepen de geboortedatums
 * in september 2026 leeg terwijl tekstcellen bleven staan. Zie
 * docs/superpowers/specs/2026-09-17-geboortedatum-behoud-design.md.
 */
const TEKST_KOLOMMEN = ['geboortedatum_kind', 'team', 'order_ids'];

/**
 * @param {string[]} kolommen kolomnamen in tabbladvolgorde
 * @param {string[]} tekstKolommen namen die tekst moeten zijn
 * @return {number[]} 1-gebaseerde kolomnummers, in tabbladvolgorde
 */
function tekstKolomIndexen(kolommen, tekstKolommen) {
  const indexen = [];
  kolommen.forEach(function (kolom, i) {
    if (tekstKolommen.indexOf(kolom) !== -1) {
      indexen.push(i + 1);
    }
  });
  return indexen;
}

/**
 * Zet het formaat van de tekstkolommen op platte tekst ('@') voor `aantalRijen`
 * datarijen, zodat setValues() daarna niets meer naar datum/getal omzet.
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} tab
 * @param {string[]} kolommen
 * @param {number} aantalRijen
 */
function _forceerTekstKolommen(tab, kolommen, aantalRijen) {
  if (aantalRijen < 1) {
    return;
  }
  tekstKolomIndexen(kolommen, TEKST_KOLOMMEN).forEach(function (kolomNummer) {
    tab.getRange(2, kolomNummer, aantalRijen, 1).setNumberFormat('@');
  });
}
```

In `leesDeelnemers` de datumlijst uitbreiden: vervang

```js
    ['uitgenodigd_op', 'action_type_op', 'ixly_op', 'laatste_reminder_op', 'laatste_poging_op',
      'ixly_laatste_gecontroleerd_op', 'reminder_anker']
```

door

```js
    // geboortedatum_kind staat er sinds 2026-09-17 bij: bestaande datumcellen worden
    // zo als 'yyyy-MM-dd' gelezen en bij het wegschrijven als tekst teruggezet.
    ['uitgenodigd_op', 'action_type_op', 'ixly_op', 'laatste_reminder_op', 'laatste_poging_op',
      'ixly_laatste_gecontroleerd_op', 'reminder_anker', 'geboortedatum_kind']
```

In `schrijfDeelnemers` vlak vóór de laatste regel `tab.getRange(2, 1, waarden.length, KOLOMMEN.length).setValues(waarden);` toevoegen:

```js
  // Eerst het formaat, dan de waarden: andersom is de omzetting al gebeurd.
  _forceerTekstKolommen(tab, KOLOMMEN, waarden.length);
```

Exporteer onderaan in `module.exports` twee extra regels:

```js
    TEKST_KOLOMMEN: TEKST_KOLOMMEN,
    tekstKolomIndexen: tekstKolomIndexen,
```

- [ ] **Step 4: Draai alle tests**

Run: `node --test "tests/gs/*.test.js"`
Expected: alle PASS (275 + 4 = 279).

- [ ] **Step 5: Commit**

```bash
git add google-apps-script/deelnemers/Sheet.gs tests/gs/sheet.test.js
git commit -m "feat: geboortedatum, team en order_ids als platte tekst in Deelnemers"
```

---

### Task 3: Teamwerkboeken schrijven geboortedatum en team als tekst

**Files:**
- Modify: `google-apps-script/deelnemers/Teams.gs:841-873` (`_schrijfTabblad`)
- Test: `tests/gs/teams.test.js`

**Interfaces:**
- Consumes: `tekstKolomIndexen`, `TEKST_KOLOMMEN` uit Sheet.gs (globaal beschikbaar in Apps Script; in node niet nodig omdat `_schrijfTabblad` niet getest wordt).
- `_geboortejaar` blijft zoals hij is (regex op vier cijfers werkt op `yyyy-MM-dd`).

- [ ] **Step 1: Schrijf de falende test (regressiebescherming voor de tekstvorm)**

Voeg onderaan `tests/gs/teams.test.js` toe (`GRENZEN` bestaat al in dat bestand; als de constante anders heet, gebruik dezelfde als bij de bestaande `bepaalLeeftijdsgroep`-tests):

```js
test('bepaalLeeftijdsgroep behandelt een tekstdatum yyyy-MM-dd en een Date-object gelijk', () => {
  assert.strictEqual(
    bepaalLeeftijdsgroep('2016-01-01', 'Speler', GRENZEN),
    bepaalLeeftijdsgroep(new Date(2016, 0, 1), 'Speler', GRENZEN)
  );
});
```

- [ ] **Step 2: Draai de test**

Run: `node --test tests/gs/teams.test.js`
Expected: PASS (dit gedrag bestaat al; de test borgt het). Ga door.

- [ ] **Step 3: Formaat forceren in `_schrijfTabblad`**

In `_schrijfTabblad`, vlak vóór `tab.getRange(2, 1, waarden.length, TEAM_KOLOMMEN.length).setValues(waarden);` toevoegen:

```js
  // Platte tekst voor geboortedatum_kind en team, anders maakt Sheets van '14-1' een
  // datum (geobserveerd in beide teamwerkboeken: '12-2-2026'). Zelfde regel als
  // schrijfDeelnemers in Sheet.gs; TEKST_KOLOMMEN bevat ook order_ids, maar die kolom
  // staat niet in TEAM_KOLOMMEN en wordt dus overgeslagen.
  tekstKolomIndexen(TEAM_KOLOMMEN, TEKST_KOLOMMEN).forEach(function (kolomNummer) {
    tab.getRange(2, kolomNummer, waarden.length, 1).setNumberFormat('@');
  });
```

- [ ] **Step 4: Draai alle tests**

Run: `node --test "tests/gs/*.test.js"`
Expected: alle PASS (280).

- [ ] **Step 5: Commit**

```bash
git add google-apps-script/deelnemers/Teams.gs tests/gs/teams.test.js
git commit -m "feat: teamwerkboeken schrijven geboortedatum en team als platte tekst"
```

---

### Task 4: Pure logica voor de bron "Geboortedatums"

**Files:**
- Modify: `google-apps-script/deelnemers/Deelnemers.gs` (na `beschermGeboortedatums`, en `module.exports`)
- Test: `tests/gs/deelnemers.test.js`

**Interfaces:**
- Produces:
  - `vulUitGeboortedatums(rijen: Object[], bron: Object[]) => number` — muteert `rijen`: elke rij met lege `geboortedatum_kind` krijgt de waarde van de bronrij met dezelfde `naam_slug`; geeft het aantal teruggezette rijen terug. Bronrijen: `{naam_slug, geboortedatum_kind, bijgewerkt_op}`.
  - `werkGeboortedatumsBij(rijen: Object[], bron: Object[], vandaag: string) => Object[]` — geeft een NIEUWE bronlijst: alle bestaande bronrijen, waarbij elke Deelnemers-rij mét datum de bronrij voor die slug toevoegt of overschrijft (`geboortedatum_kind`, `bijgewerkt_op = vandaag`). Bronrijen zonder tegenhanger blijven staan. Volgorde: bestaande rijen eerst (in bronvolgorde), nieuwe slugs erachter in rijvolgorde. Nooit minder rijen dan `bron`.

- [ ] **Step 1: Schrijf de falende tests**

Voeg onderaan `tests/gs/deelnemers.test.js` toe:

```js
const { vulUitGeboortedatums, werkGeboortedatumsBij } = require('../../google-apps-script/deelnemers/Deelnemers.gs');

function bronRij(slug, datum) {
  return { naam_slug: slug, geboortedatum_kind: datum, bijgewerkt_op: '2026-09-01' };
}

test('vulUitGeboortedatums vult een lege geboortedatum uit de bron op naam_slug', () => {
  const rijen = [{ seizoen: '2627', naam_slug: 'kick-govers', geboortedatum_kind: '' }];
  const aantal = vulUitGeboortedatums(rijen, [bronRij('kick-govers', '2015-10-23')]);
  assert.strictEqual(aantal, 1);
  assert.strictEqual(rijen[0].geboortedatum_kind, '2015-10-23');
});

test('vulUitGeboortedatums overschrijft nooit een gevulde geboortedatum', () => {
  const rijen = [{ seizoen: '2627', naam_slug: 'kick-govers', geboortedatum_kind: '2015-10-23' }];
  const aantal = vulUitGeboortedatums(rijen, [bronRij('kick-govers', '2000-01-01')]);
  assert.strictEqual(aantal, 0);
  assert.strictEqual(rijen[0].geboortedatum_kind, '2015-10-23');
});

test('vulUitGeboortedatums laat een slug zonder bronrij leeg', () => {
  const rijen = [{ seizoen: '2627', naam_slug: 'onbekend', geboortedatum_kind: '' }];
  assert.strictEqual(vulUitGeboortedatums(rijen, [bronRij('kick-govers', '2015-10-23')]), 0);
  assert.strictEqual(rijen[0].geboortedatum_kind, '');
});

test('vulUitGeboortedatums vult over seizoenen heen (sleutel is alleen naam_slug)', () => {
  const rijen = [
    { seizoen: '2526', naam_slug: 'kick-govers', geboortedatum_kind: '' },
    { seizoen: '2627', naam_slug: 'kick-govers', geboortedatum_kind: '' }
  ];
  assert.strictEqual(vulUitGeboortedatums(rijen, [bronRij('kick-govers', '2015-10-23')]), 2);
});

test('werkGeboortedatumsBij voegt nieuwe slugs toe met bijgewerkt_op = vandaag', () => {
  const rijen = [{ naam_slug: 'kick-govers', geboortedatum_kind: '2015-10-23' }];
  const nieuw = werkGeboortedatumsBij(rijen, [], '2026-09-17');
  assert.deepStrictEqual(nieuw, [{ naam_slug: 'kick-govers', geboortedatum_kind: '2015-10-23', bijgewerkt_op: '2026-09-17' }]);
});

test('werkGeboortedatumsBij overschrijft een bestaande bronrij en behoudt de rest', () => {
  const bron = [bronRij('kick-govers', '2015-10-23'), bronRij('jip-van-essen', '2012-01-28')];
  const rijen = [{ naam_slug: 'kick-govers', geboortedatum_kind: '2015-10-24' }];
  const nieuw = werkGeboortedatumsBij(rijen, bron, '2026-09-17');
  assert.strictEqual(nieuw.length, 2);
  assert.deepStrictEqual(nieuw[0], { naam_slug: 'kick-govers', geboortedatum_kind: '2015-10-24', bijgewerkt_op: '2026-09-17' });
  assert.deepStrictEqual(nieuw[1], bron[1]);
});

test('werkGeboortedatumsBij negeert rijen zonder geboortedatum en muteert de bron niet', () => {
  const bron = [bronRij('kick-govers', '2015-10-23')];
  const rijen = [{ naam_slug: 'kick-govers', geboortedatum_kind: '' }, { naam_slug: 'leeg', geboortedatum_kind: '' }];
  const nieuw = werkGeboortedatumsBij(rijen, bron, '2026-09-17');
  assert.deepStrictEqual(nieuw, bron);
  assert.notStrictEqual(nieuw, bron);
  assert.strictEqual(bron[0].bijgewerkt_op, '2026-09-01');
});

test('werkGeboortedatumsBij houdt één rij per slug bij dubbele seizoensrijen', () => {
  const rijen = [
    { seizoen: '2526', naam_slug: 'kick-govers', geboortedatum_kind: '2015-10-23' },
    { seizoen: '2627', naam_slug: 'kick-govers', geboortedatum_kind: '2015-10-23' }
  ];
  assert.strictEqual(werkGeboortedatumsBij(rijen, [], '2026-09-17').length, 1);
});
```

- [ ] **Step 2: Draai de tests, verwacht falen**

Run: `node --test tests/gs/deelnemers.test.js`
Expected: FAIL met `vulUitGeboortedatums is not a function`.

- [ ] **Step 3: Implementeer in Deelnemers.gs**

Voeg na `beschermGeboortedatums` (vóór het `module`-blok) toe:

```js
/**
 * Vult lege geboortedatums uit het script-eigen tabblad "Geboortedatums" (Sheet.gs:
 * leesGeboortedatums). Dit is het vangnet voor leeglopen TUSSEN twee runs door
 * (menselijke sorteer-/plakacties, september 2026); de wachter hierboven dekt alleen
 * leeglopen bínnen een run. Sleutel is naam_slug zonder seizoen: een geboortedatum
 * verandert nooit, dezelfde aanname als erfGeboortedatums.
 *
 * @param {Object[]} rijen deelnemersrijen (gemuteerd)
 * @param {Object[]} bron rijen {naam_slug, geboortedatum_kind, bijgewerkt_op}
 * @return {number} aantal teruggezette geboortedatums
 */
function vulUitGeboortedatums(rijen, bron) {
  const perSlug = {};
  (bron || []).forEach(function (b) {
    if (b.naam_slug && b.geboortedatum_kind) {
      perSlug[b.naam_slug] = b.geboortedatum_kind;
    }
  });

  let teruggezet = 0;
  (rijen || []).forEach(function (rij) {
    if (!rij.geboortedatum_kind && perSlug[rij.naam_slug]) {
      rij.geboortedatum_kind = perSlug[rij.naam_slug];
      teruggezet += 1;
    }
  });
  return teruggezet;
}

/**
 * Nieuwe bronlijst: bestaande bronrijen plus/overschreven door elke deelnemersrij mét
 * geboortedatum. Verwijdert nooit iets -- de bron mag alleen groeien of preciezer
 * worden, anders lekt een fout in Deelnemers door naar het vangnet.
 *
 * @param {Object[]} rijen deelnemersrijen
 * @param {Object[]} bron huidige bronrijen (niet gemuteerd)
 * @param {string} vandaag 'yyyy-MM-dd'
 * @return {Object[]} nieuwe bronrijen {naam_slug, geboortedatum_kind, bijgewerkt_op}
 */
function werkGeboortedatumsBij(rijen, bron, vandaag) {
  const resultaat = (bron || []).map(function (b) { return Object.assign({}, b); });
  const indexPerSlug = {};
  resultaat.forEach(function (b, i) { indexPerSlug[b.naam_slug] = i; });

  (rijen || []).forEach(function (rij) {
    if (!rij.naam_slug || !rij.geboortedatum_kind) {
      return;
    }
    const nieuw = { naam_slug: rij.naam_slug, geboortedatum_kind: rij.geboortedatum_kind, bijgewerkt_op: vandaag };
    if (indexPerSlug[rij.naam_slug] !== undefined) {
      resultaat[indexPerSlug[rij.naam_slug]] = nieuw;
    } else {
      indexPerSlug[rij.naam_slug] = resultaat.length;
      resultaat.push(nieuw);
    }
  });
  return resultaat;
}
```

Breid `module.exports` uit met:

```js
    vulUitGeboortedatums: vulUitGeboortedatums,
    werkGeboortedatumsBij: werkGeboortedatumsBij,
```

- [ ] **Step 4: Draai alle tests**

Run: `node --test "tests/gs/*.test.js"`
Expected: alle PASS (280 + 8 = 288).

- [ ] **Step 5: Commit**

```bash
git add google-apps-script/deelnemers/Deelnemers.gs tests/gs/deelnemers.test.js
git commit -m "feat: pure logica voor het vangnet-tabblad Geboortedatums"
```

---

### Task 5: Tabblad "Geboortedatums" lezen en schrijven

**Files:**
- Modify: `google-apps-script/deelnemers/Sheet.gs` (na `schrijfIxlyScores`, vóór `voegScoresSamen`; plus `module.exports`)
- Test: `tests/gs/sheet.test.js` (alleen de kolomlijst; I/O is ongetest zoals de rest van Sheet.gs)

**Interfaces:**
- Produces:
  - `GEBOORTEDATUM_KOLOMMEN = ['naam_slug', 'geboortedatum_kind', 'bijgewerkt_op']` (geëxporteerd).
  - `leesGeboortedatums() => Object[]` — maakt het tabblad aan (verborgen, met kopregel) als het ontbreekt; controleert de kopregel; geeft rijen `{naam_slug, geboortedatum_kind, bijgewerkt_op}` met alle waarden als tekst (`_alsDatumTekst` op de twee datumvelden).
  - `schrijfGeboortedatums(bron: Object[])` — schrijft alle bronrijen vanaf rij 2 in kolomvolgorde, formaat `@` op `geboortedatum_kind`; wist NIET eerst (het aantal rijen kan alleen gelijk blijven of groeien, zie Task 4).

- [ ] **Step 1: Schrijf de falende test**

Voeg onderaan `tests/gs/sheet.test.js` toe:

```js
const { GEBOORTEDATUM_KOLOMMEN } = require('../../google-apps-script/deelnemers/Sheet.gs');

test('GEBOORTEDATUM_KOLOMMEN heeft de vaste kolomvolgorde van het vangnet-tabblad', () => {
  assert.deepStrictEqual(GEBOORTEDATUM_KOLOMMEN, ['naam_slug', 'geboortedatum_kind', 'bijgewerkt_op']);
});
```

- [ ] **Step 2: Draai de test, verwacht falen**

Run: `node --test tests/gs/sheet.test.js`
Expected: FAIL (`GEBOORTEDATUM_KOLOMMEN` is `undefined`).

- [ ] **Step 3: Implementeer in Sheet.gs**

Voeg na `schrijfIxlyScores` toe:

```js
/**
 * Script-eigen bron van waarheid voor geboortedatums (verborgen tabblad). Alleen het
 * script schrijft erin; de run vult er elke dag lege Deelnemers-cellen uit terug.
 * Zie docs/superpowers/specs/2026-09-17-geboortedatum-behoud-design.md, stap 4.
 */
const GEBOORTEDATUM_KOLOMMEN = ['naam_slug', 'geboortedatum_kind', 'bijgewerkt_op'];
const GEBOORTEDATUM_TABBLAD = 'Geboortedatums';

/**
 * @return {Object[]} rijen {naam_slug, geboortedatum_kind, bijgewerkt_op}, alles tekst
 */
function leesGeboortedatums() {
  const tab = _tabGeboortedatums();
  const laatste = tab.getLastRow();

  controleerKopregel(GEBOORTEDATUM_TABBLAD,
    tab.getRange(1, 1, 1, GEBOORTEDATUM_KOLOMMEN.length).getValues()[0], GEBOORTEDATUM_KOLOMMEN);

  if (laatste < 2) {
    return [];
  }

  return tab.getRange(2, 1, laatste - 1, GEBOORTEDATUM_KOLOMMEN.length).getValues()
    .map(function (rij) {
      return {
        naam_slug:          String(rij[0] || '').trim(),
        geboortedatum_kind: _alsDatumTekst(rij[1]),
        bijgewerkt_op:      _alsDatumTekst(rij[2])
      };
    })
    .filter(function (rij) { return rij.naam_slug; });
}

/**
 * Schrijft de volledige bronlijst terug. Bewust GEEN clearContent vooraf: de lijst kan
 * alleen groeien of preciezer worden (werkGeboortedatumsBij, Deelnemers.gs), dus een
 * volledige overschrijving vanaf rij 2 dekt altijd alle oude rijen.
 *
 * @param {Object[]} bron
 */
function schrijfGeboortedatums(bron) {
  if (!bron || !bron.length) {
    return;
  }
  const tab = _tabGeboortedatums();
  const waarden = bron.map(function (rij) {
    return GEBOORTEDATUM_KOLOMMEN.map(function (kolom) { return rij[kolom] || ''; });
  });
  _forceerTekstKolommen(tab, GEBOORTEDATUM_KOLOMMEN, waarden.length);
  tab.getRange(2, 1, waarden.length, GEBOORTEDATUM_KOLOMMEN.length).setValues(waarden);
}

/**
 * Het tabblad, aangemaakt (verborgen, met kopregel) als het nog niet bestaat -- zo is
 * de uitrol alleen "bestanden plakken", geen handmatige tabbladstap.
 */
function _tabGeboortedatums() {
  const werkboek = SpreadsheetApp.getActiveSpreadsheet();
  let tab = werkboek.getSheetByName(GEBOORTEDATUM_TABBLAD);
  if (!tab) {
    tab = werkboek.insertSheet(GEBOORTEDATUM_TABBLAD);
    tab.getRange(1, 1, 1, GEBOORTEDATUM_KOLOMMEN.length).setValues([GEBOORTEDATUM_KOLOMMEN]);
    tab.hideSheet();
  }
  return tab;
}
```

Controleer dat `_forceerTekstKolommen` (Task 2) op `TEKST_KOLOMMEN` werkt: `geboortedatum_kind` staat erin, dus kolom 2 van dit tabblad wordt tekst. Voeg aan `module.exports` toe:

```js
    GEBOORTEDATUM_KOLOMMEN: GEBOORTEDATUM_KOLOMMEN,
```

- [ ] **Step 4: Draai alle tests**

Run: `node --test "tests/gs/*.test.js"`
Expected: alle PASS (289).

- [ ] **Step 5: Commit**

```bash
git add google-apps-script/deelnemers/Sheet.gs tests/gs/sheet.test.js
git commit -m "feat: tabblad Geboortedatums lezen en schrijven"
```

---

### Task 6: Vangnet inschakelen in de dagelijkse run

**Files:**
- Modify: `google-apps-script/deelnemers/Dagelijks.gs:112-120` (stap 1, direct na `erfGeboortedatums`)

**Interfaces:**
- Consumes: `leesGeboortedatums`, `schrijfGeboortedatums` (Task 5), `vulUitGeboortedatums`, `werkGeboortedatumsBij` (Task 4), bestaande `logRegel` en `vandaag`.

- [ ] **Step 1: Code toevoegen**

Vervang in `_dagelijkseRunKern` het blok

```js
    const geerfd = erfGeboortedatums(rijen);
    melding.push('Stap 1: ' + orders.length + ' orders, ' + rijen.length + ' deelnemers.' +
      (geerfd ? ' ' + geerfd + ' geboortedatum(s) geërfd uit een eerder seizoen.' : ''));
```

door

```js
    const geerfd = erfGeboortedatums(rijen);
    melding.push('Stap 1: ' + orders.length + ' orders, ' + rijen.length + ' deelnemers.' +
      (geerfd ? ' ' + geerfd + ' geboortedatum(s) geërfd uit een eerder seizoen.' : ''));

    // Vangnet tegen leeglopen tussen runs door (menselijke bewerkingen): eerst lege
    // cellen terugvullen uit het script-eigen tabblad, daarna de bron bijwerken met
    // alles wat nu gevuld is. Eigen try/catch: een probleem met dit tabblad mag de
    // ingest niet als MISLUKT markeren (dat zou de reminders van vandaag blokkeren).
    try {
      const bron = leesGeboortedatums();
      const teruggezet = vulUitGeboortedatums(rijen, bron);
      if (teruggezet) {
        const tekst = 'VANGNET: ' + teruggezet + ' lege geboortedatum(s) teruggezet uit Geboortedatums.';
        melding.push('  ' + tekst);
        logRegel('fout', {}, 'mislukt', tekst);
      }
      schrijfGeboortedatums(werkGeboortedatumsBij(rijen, bron, vandaag));
    } catch (fout) {
      melding.push('  Geboortedatums MISLUKT: ' + fout.message);
      logRegel('fout', {}, 'mislukt', 'geboortedatums: ' + fout.message);
    }
```

- [ ] **Step 2: Syntaxcontrole**

Run: `node -e "require('./google-apps-script/deelnemers/Dagelijks.gs')" 2>&1 | head -3`
Expected: een `ReferenceError` op een Apps Script-global (bijv. `SpreadsheetApp`/`Session` is not defined) is prima; een `SyntaxError` niet.

- [ ] **Step 3: Draai alle tests**

Run: `node --test "tests/gs/*.test.js"`
Expected: alle PASS (289).

- [ ] **Step 4: Commit**

```bash
git add google-apps-script/deelnemers/Dagelijks.gs
git commit -m "feat: dagelijkse run vult geboortedatums terug uit het vangnet-tabblad"
```

---

### Task 7: Documentatie

**Files:**
- Modify: `docs/ARCHITECTURE.md` (sectie over het werkboek/tabbladen: tabblad "Geboortedatums" en "Overzicht", tekstkolommen)
- Modify: `docs/DECISIONS.md` (nieuwe ADR: "ADR-016 — Datum- en datumachtige kolommen als platte tekst; vangnet-tabblad Geboortedatums")
- Modify: `docs/GLOSSARY.md` (termen "vangnet", "Overzicht", "tekstkolommen")
- Modify: `docs/TODO.md` (item "`order_ids`-Nederlandse-getalnotatie-bug fixen" naar Done met datum; item "Dader van de geboortedatum-leegloop aanwijzen" naar Done met de bevinding; nieuw Next Up-item "Uitrol geboortedatum-behoud" met de checklist hieronder)

- [ ] **Step 1: ADR-016 schrijven** in `docs/DECISIONS.md`, zelfde vorm als ADR-015 (Context / Beslissing / Gevolgen). Kern: Sheets zet datumachtige tekst zelf om naar datumcellen; datumcellen bleken bij menselijke rij-operaties te sneuvelen (7–11 sep 2026, versiegeschiedenis); daarom `@`-formaat op `geboortedatum_kind`, `team`, `order_ids` in Deelnemers en op `geboortedatum_kind`, `team` in de teamwerkboeken, en een verborgen tabblad Geboortedatums als script-eigen bron waaruit de run lege cellen terugvult. Afgewezen alternatief: alleen beveiligen (helpt niet als de beveiliging ooit uitgaat, en lost het `team`-probleem niet op).

- [ ] **Step 2: ARCHITECTURE.md en GLOSSARY.md bijwerken** met de twee nieuwe tabbladen en de regel "tekstkolommen: zie `TEKST_KOLOMMEN` in Sheet.gs".

- [ ] **Step 3: TODO.md bijwerken.** Nieuw Next Up-item:

```
- **Uitrol geboortedatum-behoud (ADR-016)** `(lokaal)` — in één zitting buiten de 07:00-run: (1) Woo.gs, Sheet.gs, Teams.gs, Deelnemers.gs, Dagelijks.gs plakken in de Apps Script-editor; (2) "Alles nu verversen" draaien en controleren: kolom D toont `yyyy-mm-dd`, verborgen tabblad "Geboortedatums" bestaat met ~98 rijen, runlog zonder "Geboortedatums MISLUKT"; (3) tabblad "Overzicht" aanmaken met in A1 `=QUERY(Deelnemers!A:AA; "select * where B is not null"; 1)` en filterweergaven "Kolping" en "Schagen" (filter op `vereniging` = KA / SU); (4) Deelnemers en Geboortedatums beveiligen: Gegevens → Bladen en bereiken beveiligen → alleen Max; (5) bericht aan Berry en Jeffry: Deelnemers is alleen-lezen, filteren/sorteren in Overzicht via de filterweergaven, en de vraag wat zij op 7, 8 en 11 september deden.
```

- [ ] **Step 4: Commit**

```bash
git add docs/ARCHITECTURE.md docs/DECISIONS.md docs/GLOSSARY.md docs/TODO.md
git commit -m "docs: ADR-016 geboortedatum-behoud, tabbladen Geboortedatums/Overzicht, uitrolchecklist"
```

---

## Self-review

- Spec stap 1 (herstel): handmatig gedaan door Max op 2026-09-17, geen taak.
- Spec stap 2 (tekstopslag): Task 1 (Woo), 2 (Deelnemers), 3 (teamwerkboeken). Overgang van bestaande datumcellen: `leesDeelnemers` leest via `_alsDatumTekst`, `schrijfDeelnemers` wist en zet `@` vóór `setValues`. Tijdzone-valkuil: `_alsDatumTekst` gebruikt `Session.getScriptTimeZone()`, ongewijzigd.
- Spec stap 3 (beveiliging + Overzicht): handmatige UI-stappen, opgenomen als uitrolchecklist in Task 7. Geen code.
- Spec stap 4 (bron van waarheid): Task 4 (pure), 5 (I/O), 6 (run). Melding in runlog én Log-tabblad: Task 6. Nooit legen: Task 4 + 5.
- Namen consistent: `normaliseerGeboortedatum`, `TEKST_KOLOMMEN`, `tekstKolomIndexen`, `_forceerTekstKolommen`, `GEBOORTEDATUM_KOLOMMEN`, `leesGeboortedatums`, `schrijfGeboortedatums`, `vulUitGeboortedatums`, `werkGeboortedatumsBij`.
