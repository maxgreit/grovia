/**
 * Tests voor de pure MiniMove-administratielogica.
 * Gebruik: node --test tests/gs/*.test.js
 */
const test = require('node:test');
const assert = require('node:assert');

const { naarSlug, bepaalSeizoen } = require('../../google-apps-script/deelnemers/Deelnemers.gs');
global.naarSlug = naarSlug;
global.bepaalSeizoen = bepaalSeizoen;

const { MINIMOVE_AANTAL_CYCLI, bepaalMiniMoveAankopen, upsertMiniMoveDeelnemers } =
  require('../../google-apps-script/deelnemers/MiniMove.gs');

const MAPPING = {
  scholen: { 'kolping-academie': 'KA', 'schagen-united': 'SU', 'minimove': 'MM' },
  uitgesloten: ['evenement', 'proef-training']
};

function regel(overschrijf) {
  return Object.assign({
    order_id: '3000',
    datum: '2026-09-01',
    naam_kind: 'Fenna de Wit',
    categorieen: ['minimove', 'voetbaltraining'],
    inschrijving: 'cyclus-1-strippenkaart-4-keer',
    bedrag: 50
  }, overschrijf);
}

test('bepaalMiniMoveAankopen herkent een strippenkaart met cyclus en aantal uit de slug', () => {
  assert.deepStrictEqual(bepaalMiniMoveAankopen('cyclus-1-strippenkaart-4-keer'), [
    { cyclus: '1', type: 'strippenkaart', gekocht: 4 }
  ]);
  assert.deepStrictEqual(bepaalMiniMoveAankopen('cyclus-3-strippenkaart-8-keer'), [
    { cyclus: '3', type: 'strippenkaart', gekocht: 8 }
  ]);
});

test('bepaalMiniMoveAankopen herkent een seizoenkaart als alle cycli tegelijk', () => {
  const aankopen = bepaalMiniMoveAankopen('seizoenkaart-inclusief-tenue');
  assert.strictEqual(aankopen.length, MINIMOVE_AANTAL_CYCLI);
  assert.deepStrictEqual(aankopen.map(a => a.cyclus), ['1', '2', '3', '4']);
  aankopen.forEach(a => {
    assert.strictEqual(a.type, 'seizoenkaart');
    assert.strictEqual(a.gekocht, null);
  });

  assert.strictEqual(bepaalMiniMoveAankopen('seizoenkaart-zonder-tenue').length, MINIMOVE_AANTAL_CYCLI);
});

test('bepaalMiniMoveAankopen herkent de verwijderde hele-cyclus-optie', () => {
  assert.deepStrictEqual(bepaalMiniMoveAankopen('cyclus-2'), [
    { cyclus: '2', type: 'hele-cyclus', gekocht: null }
  ]);
});

test('bepaalMiniMoveAankopen geeft leeg voor onherkende of niet-MiniMove-slugs', () => {
  assert.deepStrictEqual(bepaalMiniMoveAankopen('cyclus-1-strippenkaart-5-keer'), []);
  assert.deepStrictEqual(bepaalMiniMoveAankopen('proeftrainingen'), []);
  assert.deepStrictEqual(bepaalMiniMoveAankopen(''), []);
});

test('upsertMiniMoveDeelnemers maakt een nieuwe rij voor een strippenkaart', () => {
  const { rijen, controleren } = upsertMiniMoveDeelnemers([], [regel()], MAPPING);
  assert.strictEqual(controleren.length, 0);
  assert.strictEqual(rijen.length, 1);
  assert.strictEqual(rijen[0].seizoen, '2627');
  assert.strictEqual(rijen[0].cyclus, '1');
  assert.strictEqual(rijen[0].naam_slug, 'fenna-de-wit');
  assert.strictEqual(rijen[0].type_aankoop, 'strippenkaart');
  assert.strictEqual(rijen[0].gekocht, 4);
  assert.strictEqual(rijen[0].bedrag, 50);
  assert.deepStrictEqual(rijen[0].order_ids, ['3000']);
});

test('een seizoenkaart levert 4 rijen op met het bedrag gelijk verdeeld', () => {
  const { rijen } = upsertMiniMoveDeelnemers([], [
    regel({ inschrijving: 'seizoenkaart-inclusief-tenue', bedrag: 420 })
  ], MAPPING);

  assert.strictEqual(rijen.length, 4);
  rijen.forEach(rij => {
    assert.strictEqual(rij.type_aankoop, 'seizoenkaart');
    assert.strictEqual(rij.gekocht, null);
    assert.strictEqual(rij.bedrag, 105);
  });
  assert.deepStrictEqual(rijen.map(r => r.cyclus).sort(), ['1', '2', '3', '4']);
});

test('twee strippenkaarten voor dezelfde cyclus tellen op', () => {
  const eerste = upsertMiniMoveDeelnemers([], [regel({ order_id: '3000' })], MAPPING);
  const tweede = upsertMiniMoveDeelnemers(eerste.rijen, [
    regel({ order_id: '3001', inschrijving: 'cyclus-1-strippenkaart-4-keer' })
  ], MAPPING);

  assert.strictEqual(tweede.rijen.length, 1);
  assert.strictEqual(tweede.rijen[0].gekocht, 8);
  assert.strictEqual(tweede.rijen[0].bedrag, 100);
  assert.deepStrictEqual(tweede.rijen[0].order_ids, ['3000', '3001']);
});

test('een seizoenkaart bovenop een strippenkaart vervangt het type in plaats van op te tellen', () => {
  const eerste = upsertMiniMoveDeelnemers([], [regel({ order_id: '3000' })], MAPPING);
  const tweede = upsertMiniMoveDeelnemers(eerste.rijen, [
    regel({ order_id: '3001', inschrijving: 'seizoenkaart-inclusief-tenue', bedrag: 420 })
  ], MAPPING);

  const rijCyclus1 = tweede.rijen.find(r => r.cyclus === '1');
  assert.strictEqual(rijCyclus1.type_aankoop, 'seizoenkaart');
  assert.strictEqual(rijCyclus1.gekocht, null);
});

test('dezelfde order twee keer verwerken telt niet dubbel (idempotent)', () => {
  const eerste = upsertMiniMoveDeelnemers([], [regel()], MAPPING);
  const tweede = upsertMiniMoveDeelnemers(eerste.rijen, [regel()], MAPPING);
  assert.strictEqual(tweede.rijen.length, 1);
  assert.strictEqual(tweede.rijen[0].gekocht, 4);
});

test('niet-MiniMove-orders worden genegeerd', () => {
  const { rijen } = upsertMiniMoveDeelnemers([], [
    regel({ categorieen: ['kolping-academie', 'voetbaltraining'], inschrijving: 'cyclus-1' })
  ], MAPPING);
  assert.strictEqual(rijen.length, 0);
});

test('uitgesloten categorieën (evenement/proeftraining) worden genegeerd', () => {
  const { rijen } = upsertMiniMoveDeelnemers([], [
    regel({ categorieen: ['minimove', 'proef-training'] })
  ], MAPPING);
  assert.strictEqual(rijen.length, 0);
});

test('een onherkende MiniMove-inschrijving gaat naar controleren, niet naar rijen', () => {
  const { rijen, controleren } = upsertMiniMoveDeelnemers([], [
    regel({ inschrijving: 'iets-onbekends' })
  ], MAPPING);
  assert.strictEqual(rijen.length, 0);
  assert.strictEqual(controleren.length, 1);
  assert.match(controleren[0].reden, /onbekend MiniMove-inschrijvingstype/);
});

test('een order zonder naam kind gaat naar controleren', () => {
  const { rijen, controleren } = upsertMiniMoveDeelnemers([], [
    regel({ naam_kind: '' })
  ], MAPPING);
  assert.strictEqual(rijen.length, 0);
  assert.strictEqual(controleren.length, 1);
  assert.strictEqual(controleren[0].reden, 'geen naam kind');
});
