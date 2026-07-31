/**
 * Tests voor het koppelen van formulierreacties aan deelnemers.
 * Gebruik: node --test "tests/gs/*.test.js"
 */
const test = require('node:test');
const assert = require('node:assert');
const { koppelReacties } = require('../../google-apps-script/deelnemers/ActionType.gs');

function rij(overschrijf) {
  return Object.assign({
    seizoen: '2526', naam_slug: 'freddie-rood', naam_kind: 'Freddie Rood',
    vereniging: 'KA', code: '935', action_type_af: false, action_type_op: '', action_type: ''
  }, overschrijf);
}

function reactie(overschrijf) {
  return Object.assign({
    code: '935', naam: 'Freddie Rood', tijdstip: '2026-08-10', action_type: 'ISTJ'
  }, overschrijf);
}

test('reactie met code klapt de rij om', () => {
  const { rijen } = koppelReacties([rij()], [reactie()]);
  assert.strictEqual(rijen[0].action_type_af, true);
  assert.strictEqual(rijen[0].action_type, 'ISTJ');
  assert.strictEqual(rijen[0].action_type_op, '2026-08-10');
});

test('reactie zonder code komt bij ongekoppeld', () => {
  const { rijen, ongekoppeld } = koppelReacties([rij()], [reactie({ code: '' })]);
  assert.strictEqual(rijen[0].action_type_af, false);
  assert.strictEqual(ongekoppeld.length, 1);
  assert.strictEqual(ongekoppeld[0].naam, 'Freddie Rood');
});

test('code zonder bijbehorende rij komt bij ongekoppeld', () => {
  const { ongekoppeld } = koppelReacties([rij()], [reactie({ code: '999' })]);
  assert.strictEqual(ongekoppeld.length, 1);
  assert.strictEqual(ongekoppeld[0].reden, 'code niet gevonden');
});

test('al afgeronde rij wordt niet opnieuw geschreven', () => {
  const bestaand = rij({ action_type_af: true, action_type: 'ENFP', action_type_op: '2026-08-01' });
  const { rijen } = koppelReacties([bestaand], [reactie({ action_type: 'ISTJ' })]);
  assert.strictEqual(rijen[0].action_type, 'ENFP');
  assert.strictEqual(rijen[0].action_type_op, '2026-08-01');
});

test('lege action_type klapt de rij niet om', () => {
  const { rijen, ongekoppeld } = koppelReacties([rij()], [reactie({ action_type: '' })]);
  assert.strictEqual(rijen[0].action_type_af, false);
  assert.strictEqual(ongekoppeld[0].reden, 'geen action type berekend');
});

test('code met witruimte matcht alsnog', () => {
  const { rijen } = koppelReacties([rij()], [reactie({ code: ' 935 ' })]);
  assert.strictEqual(rijen[0].action_type_af, true);
});
