/**
 * Tests voor de pure Financieel-berekeningslogica.
 * Gebruik: node --test tests/gs/
 */
const test = require('node:test');
const assert = require('node:assert');
const { naarSlug } = require('../../google-apps-script/deelnemers/Deelnemers.gs');
global.naarSlug = naarSlug;
const { bepaalInschrijvingType, seizoenStartdatum, berekenFinancieel } =
  require('../../google-apps-script/deelnemers/Financieel.gs');

const FASES = {
  'cyclus-1': 'C1',
  'cyclus-2': 'C2',
  'cyclus-3': 'C3',
  'seizoenkaart-inclusief-tenue': 'SMT',
  'seizoenkaart-zonder-tenue': 'SZT'
};

const MAPPING = {
  scholen: { 'kolping-academie': 'KA', 'schagen-united': 'SU', 'minimove': 'MM' },
  rollen: { 'voetbaltraining': 'Speler', 'keeperstraining': 'Keeper' },
  fases: FASES,
  uitgesloten: ['evenement', 'proef-training']
};

function regel(overschrijf) {
  return Object.assign({
    order_id: '1250',
    datum: '2026-08-04',
    naam_kind: 'Robin Poole',
    categorieen: ['kolping-academie', 'voetbaltraining'],
    inschrijving: 'cyclus-1',
    bedrag: 160
  }, overschrijf);
}

function vind(rijen, vereniging, cyclus) {
  return rijen.find(function (r) { return r.vereniging === vereniging && r.cyclus === cyclus; });
}

test('bepaalInschrijvingType vertaalt de slug via mapping.fases', () => {
  assert.strictEqual(bepaalInschrijvingType('cyclus-1', FASES), 'C1');
  assert.strictEqual(bepaalInschrijvingType('cyclus-2', FASES), 'C2');
  assert.strictEqual(bepaalInschrijvingType('cyclus-3', FASES), 'C3');
  assert.strictEqual(bepaalInschrijvingType('seizoenkaart-inclusief-tenue', FASES), 'SEIZOENKAART');
  assert.strictEqual(bepaalInschrijvingType('seizoenkaart-zonder-tenue', FASES), 'SEIZOENKAART');
  assert.strictEqual(bepaalInschrijvingType('iets-anders', FASES), '');
  assert.strictEqual(bepaalInschrijvingType('', FASES), '');
});

test('seizoenStartdatum geeft 1 juni van het startjaar', () => {
  assert.strictEqual(seizoenStartdatum('2627'), '2026-06-01');
  assert.strictEqual(seizoenStartdatum('2526'), '2025-06-01');
});

test('berekenFinancieel geeft 6 rijen (2 verenigingen x 3 cycli)', () => {
  const rijen = berekenFinancieel([], MAPPING, '2627');
  assert.strictEqual(rijen.length, 6);
});

test('cyclus-1-aankoop telt alleen in cyclus 1', () => {
  const rijen = berekenFinancieel([regel()], MAPPING, '2627');
  assert.strictEqual(vind(rijen, 'KA', 'C1').spelers_cyclusproduct, 1);
  assert.strictEqual(vind(rijen, 'KA', 'C2').spelers_cyclusproduct, 0);
  assert.strictEqual(vind(rijen, 'KA', 'C3').spelers_cyclusproduct, 0);
});

test('seizoenkaart telt mee in alle drie de cycli', () => {
  const rijen = berekenFinancieel(
    [regel({
      categorieen: ['kolping-academie', 'keeperstraining'],
      inschrijving: 'seizoenkaart-inclusief-tenue',
      bedrag: 555
    })],
    MAPPING, '2627'
  );
  ['C1', 'C2', 'C3'].forEach(function (cyclus) {
    assert.strictEqual(vind(rijen, 'KA', cyclus).keepers_seizoenkaart, 1);
  });
});

test('inkomsten = cyclusomzet + seizoenkaartomzet/3', () => {
  const rijen = berekenFinancieel(
    [
      regel({ naam_kind: 'A', inschrijving: 'cyclus-1', bedrag: 160 }),
      regel({
        naam_kind: 'B', categorieen: ['kolping-academie', 'keeperstraining'],
        inschrijving: 'seizoenkaart-inclusief-tenue', bedrag: 300
      })
    ],
    MAPPING, '2627'
  );
  assert.strictEqual(vind(rijen, 'KA', 'C1').inkomsten_incl_btw, 160 + 100);
  // seizoenkaartomzet/3 telt ook mee in C2 en C3, zonder de cyclus-1-omzet.
  assert.strictEqual(vind(rijen, 'KA', 'C2').inkomsten_incl_btw, 100);
});

test('excl. btw is incl. btw gedeeld door 1,09', () => {
  const rijen = berekenFinancieel([regel({ bedrag: 109 })], MAPPING, '2627');
  assert.strictEqual(vind(rijen, 'KA', 'C1').inkomsten_excl_btw, 100);
});

test('afdracht = totaal deelnemers keer 20', () => {
  const rijen = berekenFinancieel(
    [
      regel({ naam_kind: 'A' }),
      regel({ naam_kind: 'B', categorieen: ['kolping-academie', 'keeperstraining'] })
    ],
    MAPPING, '2627'
  );
  const c1 = vind(rijen, 'KA', 'C1');
  assert.strictEqual(c1.spelers_cyclusproduct, 1);
  assert.strictEqual(c1.keepers_cyclusproduct, 1);
  assert.strictEqual(c1.afdracht_excl_btw, 2 * 20);
});

test('order van vóór 1 juni van het startjaar telt niet mee', () => {
  const rijen = berekenFinancieel([regel({ datum: '2026-05-31' })], MAPPING, '2627');
  assert.strictEqual(vind(rijen, 'KA', 'C1').spelers_cyclusproduct, 0);
});

test('order op of na 1 juni van het volgende seizoen telt niet meer mee', () => {
  const rijen = berekenFinancieel([regel({ datum: '2027-06-01' })], MAPPING, '2627');
  assert.strictEqual(vind(rijen, 'KA', 'C1').spelers_cyclusproduct, 0);
});

test('order in juni/juli (vóór de oude augustus-seizoensgrens) telt al mee voor het nieuwe seizoen', () => {
  // Dit is exact het scenario waarvoor de 1-juni-grens is gekozen i.p.v.
  // bepaalSeizoen()'s 1-augustus-grens: vroege cyclus-verkoop voor het nieuwe
  // seizoen moet meteen bij dat nieuwe seizoen meetellen, niet bij het oude.
  const rijen = berekenFinancieel([regel({ datum: '2026-06-15' })], MAPPING, '2627');
  assert.strictEqual(vind(rijen, 'KA', 'C1').spelers_cyclusproduct, 1);
});

test('uitgesloten categorie telt niet mee', () => {
  const rijen = berekenFinancieel(
    [regel({ categorieen: ['kolping-academie', 'voetbaltraining', 'evenement'] })],
    MAPPING, '2627'
  );
  assert.strictEqual(vind(rijen, 'KA', 'C1').spelers_cyclusproduct, 0);
});

test('minimove/onbekende vereniging telt niet mee', () => {
  const rijen = berekenFinancieel(
    [regel({ categorieen: ['minimove', 'voetbaltraining'] })],
    MAPPING, '2627'
  );
  const totaal = rijen.reduce(function (som, r) { return som + r.spelers_cyclusproduct; }, 0);
  assert.strictEqual(totaal, 0);
});

test('onherkende inschrijving telt niet mee', () => {
  const rijen = berekenFinancieel([regel({ inschrijving: '' })], MAPPING, '2627');
  const totaal = rijen.reduce(function (som, r) {
    return som + r.spelers_cyclusproduct + r.spelers_seizoenkaart;
  }, 0);
  assert.strictEqual(totaal, 0);
});

test('hetzelfde kind twee keer dezelfde cyclus kopen telt maar één keer', () => {
  const rijen = berekenFinancieel(
    [regel({ order_id: '1' }), regel({ order_id: '2' })],
    MAPPING, '2627'
  );
  assert.strictEqual(vind(rijen, 'KA', 'C1').spelers_cyclusproduct, 1);
});

test('losse cyclus 1 én cyclus 2 aankoop door hetzelfde kind telt in beide', () => {
  const rijen = berekenFinancieel(
    [
      regel({ order_id: '1', inschrijving: 'cyclus-1' }),
      regel({ order_id: '2', inschrijving: 'cyclus-2' })
    ],
    MAPPING, '2627'
  );
  assert.strictEqual(vind(rijen, 'KA', 'C1').spelers_cyclusproduct, 1);
  assert.strictEqual(vind(rijen, 'KA', 'C2').spelers_cyclusproduct, 1);
});

// --- bedrag_correctie: Deelnemers overrult WooCommerce voor het geld ---

function deelnemerMetCorrectie(overschrijf) {
  return Object.assign({
    naam_slug: 'robin-poole',
    uitgenodigd_op: '2026-08-04',
    bedrag_correctie: ''
  }, overschrijf || {});
}

test('zonder deelnemers-argument rekent berekenFinancieel zoals voorheen', () => {
  const rijen = berekenFinancieel([regel({ bedrag: 160 })], MAPPING, '2627');
  assert.strictEqual(vind(rijen, 'KA', 'C1').inkomsten_incl_btw, 160);
});

test('een lege bedrag_correctie verandert niets', () => {
  const rijen = berekenFinancieel([regel({ bedrag: 160 })], MAPPING, '2627',
    [deelnemerMetCorrectie({ bedrag_correctie: '' })]);
  assert.strictEqual(vind(rijen, 'KA', 'C1').inkomsten_incl_btw, 160);
});

test('een gevulde bedrag_correctie vervangt het WooCommerce-bedrag', () => {
  const rijen = berekenFinancieel([regel({ bedrag: 160 })], MAPPING, '2627',
    [deelnemerMetCorrectie({ bedrag_correctie: 100 })]);
  assert.strictEqual(vind(rijen, 'KA', 'C1').inkomsten_incl_btw, 100);
});

test('bedrag_correctie 0 telt als expliciete correctie naar nul', () => {
  const rijen = berekenFinancieel([regel({ bedrag: 160 })], MAPPING, '2627',
    [deelnemerMetCorrectie({ bedrag_correctie: 0 })]);
  assert.strictEqual(vind(rijen, 'KA', 'C1').inkomsten_incl_btw, 0);
});

test('bedrag_correctie wordt naar rato verdeeld over meerdere orderregels', () => {
  const rijen = berekenFinancieel(
    [
      regel({ order_id: '1', inschrijving: 'cyclus-1', bedrag: 150 }),
      regel({ order_id: '2', inschrijving: 'cyclus-2', bedrag: 150 })
    ],
    MAPPING, '2627',
    [deelnemerMetCorrectie({ bedrag_correctie: 200 })]);
  assert.strictEqual(vind(rijen, 'KA', 'C1').inkomsten_incl_btw, 100);
  assert.strictEqual(vind(rijen, 'KA', 'C2').inkomsten_incl_btw, 100);
});

test('bedrag_correctie wordt gelijk verdeeld als de WooCommerce-omzet nul is', () => {
  // 100%-kortingscode: beide regels 0, maar er is wel echt betaald buiten Woo om.
  const rijen = berekenFinancieel(
    [
      regel({ order_id: '1', inschrijving: 'cyclus-1', bedrag: 0 }),
      regel({ order_id: '2', inschrijving: 'cyclus-2', bedrag: 0 })
    ],
    MAPPING, '2627',
    [deelnemerMetCorrectie({ bedrag_correctie: 200 })]);
  assert.strictEqual(vind(rijen, 'KA', 'C1').inkomsten_incl_btw, 100);
  assert.strictEqual(vind(rijen, 'KA', 'C2').inkomsten_incl_btw, 100);
});

test('bedrag_correctie raakt alleen het eigen kind, niet de rest', () => {
  const rijen = berekenFinancieel(
    [
      regel({ naam_kind: 'Robin Poole', bedrag: 160 }),
      regel({ order_id: '2', naam_kind: 'Ander Kind', bedrag: 160 })
    ],
    MAPPING, '2627',
    [deelnemerMetCorrectie({ bedrag_correctie: 100 })]);
  assert.strictEqual(vind(rijen, 'KA', 'C1').inkomsten_incl_btw, 260);
});

test('een correctie van een deelnemersrij buiten het financiele seizoensvenster telt niet', () => {
  // De rij van vorig seizoen (uitgenodigd voor 1 juni 2026) mag de orders van dit
  // seizoen niet overrulen.
  const rijen = berekenFinancieel([regel({ bedrag: 160 })], MAPPING, '2627',
    [deelnemerMetCorrectie({ uitgenodigd_op: '2026-01-15', bedrag_correctie: 100 })]);
  assert.strictEqual(vind(rijen, 'KA', 'C1').inkomsten_incl_btw, 160);
});

test('een niet-numerieke bedrag_correctie wordt genegeerd', () => {
  const rijen = berekenFinancieel([regel({ bedrag: 160 })], MAPPING, '2627',
    [deelnemerMetCorrectie({ bedrag_correctie: 'nvt' })]);
  assert.strictEqual(vind(rijen, 'KA', 'C1').inkomsten_incl_btw, 160);
});

test('bedrag_correctie op een seizoenkaart schaalt de seizoenkaartomzet', () => {
  const rijen = berekenFinancieel(
    [regel({
      categorieen: ['kolping-academie', 'keeperstraining'],
      inschrijving: 'seizoenkaart-inclusief-tenue', bedrag: 300
    })],
    MAPPING, '2627',
    [deelnemerMetCorrectie({ bedrag_correctie: 150 })]);
  // Seizoenkaartomzet wordt door 3 gedeeld over de cycli: 150 / 3 = 50 per cyclus.
  assert.strictEqual(vind(rijen, 'KA', 'C1').inkomsten_incl_btw, 50);
});
