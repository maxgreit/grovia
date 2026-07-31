/**
 * Tests voor de pure hulpfuncties in Sheet.gs.
 * Gebruik: node --test "tests/gs/*.test.js"
 */
const test = require('node:test');
const assert = require('node:assert');
const { _bouwSleutel } = require('../../google-apps-script/deelnemers/Sheet.gs');

test('_bouwSleutel met één sleutelindex geeft die ene waarde terug', () => {
  const regel = ['935', '2026-08-10', 'Actietype', 'reden'];
  assert.strictEqual(_bouwSleutel(regel, [0]), '935');
});

test('_bouwSleutel met meerdere sleutelindexen combineert ze met |', () => {
  const regel = ['Freddie Rood', '2026-08-10 12:00:00', 'action_type', 'reden'];
  assert.strictEqual(_bouwSleutel(regel, [0, 1]), 'Freddie Rood|2026-08-10 12:00:00');
});

test('_bouwSleutel trimt witruimte per veld', () => {
  const regel = [' 935 ', ' 2026-08-10 '];
  assert.strictEqual(_bouwSleutel(regel, [0, 1]), '935|2026-08-10');
});

test('_bouwSleutel behandelt ontbrekende/lege velden als lege string', () => {
  const regel = ['935', undefined, null, ''];
  assert.strictEqual(_bouwSleutel(regel, [0, 1, 2, 3]), '935|||');
});

test('_bouwSleutel met een andere volgorde van indexen geeft een andere sleutel', () => {
  const regel = ['a', 'b'];
  assert.strictEqual(_bouwSleutel(regel, [1, 0]), 'b|a');
});
