/**
 * Tests voor de pure hulpfuncties in Sheet.gs.
 * Gebruik: node --test "tests/gs/*.test.js"
 */
const test = require('node:test');
const assert = require('node:assert');
const { _bouwSleutel, _genormaliseerdeSleutel, parseIxlyTaken, serialiseerIxlyTaken, voegScoresSamen, IXLY_SCORES_KOLOMMEN } = require('../../google-apps-script/deelnemers/Sheet.gs');

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

test('parseIxlyTaken zet een enkele taak om naar een array met één object', () => {
  const resultaat = parseIxlyTaken('Blocks Game:39e7d2a1-abcd');
  assert.deepStrictEqual(resultaat, [{ naam: 'Blocks Game', assignment_uuid: '39e7d2a1-abcd' }]);
});

test('parseIxlyTaken zet twee taken om naar twee objecten', () => {
  const resultaat = parseIxlyTaken('Blocks Game:39e7,Rally Game:8a4f');
  assert.deepStrictEqual(resultaat, [
    { naam: 'Blocks Game', assignment_uuid: '39e7' },
    { naam: 'Rally Game', assignment_uuid: '8a4f' }
  ]);
});

test('parseIxlyTaken geeft een lege array terug bij een lege cel', () => {
  assert.deepStrictEqual(parseIxlyTaken(''), []);
  assert.deepStrictEqual(parseIxlyTaken(undefined), []);
});

test('serialiseerIxlyTaken zet een array terug om naar de celvorm', () => {
  const tekst = serialiseerIxlyTaken([
    { naam: 'Blocks Game', assignment_uuid: '39e7' },
    { naam: 'Rally Game', assignment_uuid: '8a4f' }
  ]);
  assert.strictEqual(tekst, 'Blocks Game:39e7,Rally Game:8a4f');
});

test('serialiseerIxlyTaken geeft een lege string terug bij een lege array', () => {
  assert.strictEqual(serialiseerIxlyTaken([]), '');
  assert.strictEqual(serialiseerIxlyTaken(undefined), '');
});

test('parseIxlyTaken en serialiseerIxlyTaken zijn elkaars inverse', () => {
  const origineel = 'Blocks Game:39e7,Rally Game:8a4f';
  assert.strictEqual(serialiseerIxlyTaken(parseIxlyTaken(origineel)), origineel);
});

test('IXLY_SCORES_KOLOMMEN heeft precies de vijftien afgesproken kolommen', function () {
  assert.deepStrictEqual(IXLY_SCORES_KOLOMMEN, [
    'naam_slug', 'naam_kind',
    'blocks_planning', 'blocks_flexibiliteit',
    'rally_prestatie', 'rally_kwaliteit', 'rally_reactiesnelheid', 'rally_consistentie',
    'rally_volgehouden_aandacht', 'rally_respons_inhibitie', 'rally_reactie_op_fouten',
    'levels_voltooid', 'levels_perfect',
    'bron', 'opgehaald_op'
  ]);
});

test('voegScoresSamen voegt een nieuwe deelnemer toe', function () {
  const samengevoegd = voegScoresSamen([], [{ naam_slug: 'a', blocks_planning: 4, bron: 'api' }]);

  assert.strictEqual(samengevoegd.length, 1);
  assert.strictEqual(samengevoegd[0].naam_slug, 'a');
});

test('voegScoresSamen laat een handmatige rij volledig met rust', function () {
  const bestaand = [{ naam_slug: 'a', blocks_planning: 7, bron: 'handmatig', opgehaald_op: '' }];
  const nieuw    = [{ naam_slug: 'a', blocks_planning: 4, bron: 'api', opgehaald_op: '2026-08-18' }];

  const samengevoegd = voegScoresSamen(bestaand, nieuw);

  assert.strictEqual(samengevoegd[0].blocks_planning, 7);
  assert.strictEqual(samengevoegd[0].bron, 'handmatig');
});

test('voegScoresSamen vult alleen lege cellen van een bestaande api-rij aan', function () {
  const bestaand = [{ naam_slug: 'a', blocks_planning: 4, blocks_flexibiliteit: '', bron: 'api' }];
  const nieuw    = [{ naam_slug: 'a', blocks_planning: 9, blocks_flexibiliteit: 6, bron: 'api' }];

  const samengevoegd = voegScoresSamen(bestaand, nieuw);

  assert.strictEqual(samengevoegd[0].blocks_planning, 4, 'bestaande waarde blijft staan');
  assert.strictEqual(samengevoegd[0].blocks_flexibiliteit, 6, 'lege waarde wordt aangevuld');
});

test('voegScoresSamen bewaart de volgorde en raakt andere rijen niet aan', function () {
  const bestaand = [{ naam_slug: 'a', blocks_planning: 1 }, { naam_slug: 'b', blocks_planning: 2 }];
  const nieuw    = [{ naam_slug: 'b', blocks_flexibiliteit: 5 }];

  const samengevoegd = voegScoresSamen(bestaand, nieuw);

  assert.strictEqual(samengevoegd[0].naam_slug, 'a');
  assert.strictEqual(samengevoegd[1].blocks_flexibiliteit, 5);
});
