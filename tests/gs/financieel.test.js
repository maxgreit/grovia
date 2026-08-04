/**
 * Tests voor de pure Financieel-berekeningslogica.
 * Gebruik: node --test tests/gs/
 */
const test = require('node:test');
const assert = require('node:assert');
const { naarSlug, bepaalSeizoen } = require('../../google-apps-script/deelnemers/Deelnemers.gs');
global.naarSlug = naarSlug;
global.bepaalSeizoen = bepaalSeizoen;
const { bepaalInschrijvingType, seizoenStartdatum, berekenFinancieel } =
  require('../../google-apps-script/deelnemers/Financieel.gs');

const MAPPING = {
  scholen: { 'kolping-academie': 'KA', 'schagen-united': 'SU', 'minimove': 'MM' },
  rollen: { 'voetbaltraining': 'Speler', 'keeperstraining': 'Keeper' },
  uitgesloten: ['evenement', 'proef-training']
};

function regel(overschrijf) {
  return Object.assign({
    order_id: '1250',
    datum: '2026-08-04',
    naam_kind: 'Robin Poole',
    categorieen: ['kolping-academie', 'voetbaltraining'],
    inschrijving: 'Cyclus 1',
    bedrag: 160
  }, overschrijf);
}

function vind(rijen, vereniging, cyclus) {
  return rijen.find(function (r) { return r.vereniging === vereniging && r.cyclus === cyclus; });
}

test('bepaalInschrijvingType herkent cyclus en seizoenkaart', () => {
  assert.strictEqual(bepaalInschrijvingType('Cyclus 1'), 'C1');
  assert.strictEqual(bepaalInschrijvingType('Cyclus 2'), 'C2');
  assert.strictEqual(bepaalInschrijvingType('Cyclus 3'), 'C3');
  assert.strictEqual(bepaalInschrijvingType('Seizoenkaart – inclusief tenue'), 'SEIZOENKAART');
  assert.strictEqual(bepaalInschrijvingType('Seizoenkaart – zonder tenue'), 'SEIZOENKAART');
  assert.strictEqual(bepaalInschrijvingType('iets anders'), '');
  assert.strictEqual(bepaalInschrijvingType(''), '');
});

test('seizoenStartdatum geeft 1 augustus van het startjaar', () => {
  assert.strictEqual(seizoenStartdatum('2627'), '2026-08-01');
  assert.strictEqual(seizoenStartdatum('2526'), '2025-08-01');
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
      inschrijving: 'Seizoenkaart – inclusief tenue',
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
      regel({ naam_kind: 'A', inschrijving: 'Cyclus 1', bedrag: 160 }),
      regel({
        naam_kind: 'B', categorieen: ['kolping-academie', 'keeperstraining'],
        inschrijving: 'Seizoenkaart – inclusief tenue', bedrag: 300
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

test('ander seizoen telt niet mee', () => {
  const rijen = berekenFinancieel([regel({ datum: '2025-08-04' })], MAPPING, '2627');
  assert.strictEqual(vind(rijen, 'KA', 'C1').spelers_cyclusproduct, 0);
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
      regel({ order_id: '1', inschrijving: 'Cyclus 1' }),
      regel({ order_id: '2', inschrijving: 'Cyclus 2' })
    ],
    MAPPING, '2627'
  );
  assert.strictEqual(vind(rijen, 'KA', 'C1').spelers_cyclusproduct, 1);
  assert.strictEqual(vind(rijen, 'KA', 'C2').spelers_cyclusproduct, 1);
});
