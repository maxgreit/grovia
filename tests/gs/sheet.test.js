/**
 * Tests voor de pure hulpfuncties in Sheet.gs.
 * Gebruik: node --test "tests/gs/*.test.js"
 */
const test = require('node:test');
const assert = require('node:assert');
const { _bouwSleutel, _genormaliseerdeSleutel } = require('../../google-apps-script/deelnemers/Sheet.gs');

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

test('_genormaliseerdeSleutel behandelt een Date-cel hetzelfde als de originele datumstring', () => {
  // Google Sheets zet een datumachtige string bij het schrijven soms om naar een echte
  // Date-cel. Zonder normalisatie zou de sleutel van een TERUGGELEZEN rij (Date-object)
  // nooit matchen met de sleutel van een NIEUWE kandidaat-regel (nog een gewone string) --
  // met als gevolg dat voegNieuweToe() dezelfde regel elke run opnieuw toevoegt.
  const alsString = ['jip van essen', '2026-07-07', 'INTJ', 'geen controlecode ingevuld'];
  // new Date(jaar, maand-1, dag) i.p.v. een ISO-string met 'Z': dat laatste zou op een
  // machine in een andere tijdzone een dag kunnen verschuiven en de test onbetrouwbaar
  // maken. Deze vorm is altijd lokale tijd, op elke machine.
  const alsDateObject = ['jip van essen', new Date(2026, 6, 7), 'INTJ', 'geen controlecode ingevuld'];

  assert.strictEqual(
    _genormaliseerdeSleutel(alsString, [0, 1]),
    _genormaliseerdeSleutel(alsDateObject, [0, 1])
  );
});

test('_genormaliseerdeSleutel laat niet-datumvelden ongemoeid', () => {
  const regel = ['Freddie Rood', '2026-08-10', 'ISTJ'];
  assert.strictEqual(_genormaliseerdeSleutel(regel, [0, 2]), 'Freddie Rood|ISTJ');
});
