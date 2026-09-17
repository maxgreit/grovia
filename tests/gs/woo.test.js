/**
 * Tests voor de pure normalisatielogica in Woo.gs.
 * Gebruik: node --test "tests/gs/*.test.js"
 */
const test = require('node:test');
const assert = require('node:assert');
const { _normaliseer } = require('../../google-apps-script/deelnemers/Woo.gs');

function order(overschrijf) {
  return Object.assign({
    id: 1240,
    date_created: '2026-08-02T17:22:19+02:00',
    billing: { first_name: 'Ed', last_name: 'Govers', email: 'erjgovers@gmail.com' },
    total: '160.00',
    meta_data: [
      { key: 'Naam kind', value: 'Kick Govers' },
      { key: 'Geboortedatum kind', value: '2015-10-23' }
    ],
    line_items: [
      {
        name: 'Voetbaltraining – Schagen United Academie - Cyclus 1',
        product_id: 1,
        meta_data: [
          { key: 'pa_inschrijving', value: 'cyclus-1' },
          { key: 'Vereniging', value: 'Schagen united' },
          { key: 'Team', value: '12-4' }
        ]
      }
    ]
  }, overschrijf);
}

test('geboortedatum_kind komt uit de order-niveau meta "Geboortedatum kind"', () => {
  const resultaat = _normaliseer(order(), {});
  assert.strictEqual(resultaat.geboortedatum_kind, '2015-10-23');
});

test('geboortedatum_kind is leeg als de meta ontbreekt', () => {
  const resultaat = _normaliseer(order({ meta_data: [{ key: 'Naam kind', value: 'Kick Govers' }] }), {});
  assert.strictEqual(resultaat.geboortedatum_kind, '');
});

test('club en team komen uit de eerste orderregel', () => {
  const resultaat = _normaliseer(order(), {});
  assert.strictEqual(resultaat.club, 'Schagen united');
  assert.strictEqual(resultaat.team, '12-4');
});

test('club en team zijn leeg zonder orderregels', () => {
  const resultaat = _normaliseer(order({ line_items: [] }), {});
  assert.strictEqual(resultaat.club, '');
  assert.strictEqual(resultaat.team, '');
});

test('club en team zijn leeg als de eerste orderregel deze meta niet heeft', () => {
  const resultaat = _normaliseer(order({
    line_items: [{ name: 'Iets anders', product_id: 2, meta_data: [{ key: 'pa_inschrijving', value: 'cyclus-1' }] }]
  }), {});
  assert.strictEqual(resultaat.club, '');
  assert.strictEqual(resultaat.team, '');
});

test('bij meerdere orderregels telt alleen de eerste voor club/team', () => {
  const resultaat = _normaliseer(order({
    line_items: [
      { name: 'Cyclus 1', product_id: 1, meta_data: [{ key: 'Vereniging', value: 'Kolping' }, { key: 'Team', value: 'JO11-07' }] },
      { name: 'Cyclus 2', product_id: 1, meta_data: [{ key: 'Vereniging', value: 'Kolping' }, { key: 'Team', value: 'JO11-7' }] }
    ]
  }), {});
  assert.strictEqual(resultaat.team, 'JO11-07');
});

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
