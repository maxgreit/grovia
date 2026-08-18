/**
 * Tests voor de pure teamindelingslogica.
 * Gebruik: node --test tests/gs/
 */
const test = require('node:test');
const assert = require('node:assert');
const { SCORE_KOLOMMEN, bepaalLeeftijdsgroep, berekenTotaalscore } =
  require('../../google-apps-script/deelnemers/Teams.gs');

const GRENZEN = { Speler: 2014, Keeper: 2013 };

// Alle negen schalen met gewicht 1 -- de standaardconfiguratie.
const WEGINGEN = {};
SCORE_KOLOMMEN.forEach(function (kolom) { WEGINGEN[kolom] = 1; });

function scoreRij(overschrijf) {
  const rij = {};
  SCORE_KOLOMMEN.forEach(function (kolom) { rij[kolom] = 4; });
  return Object.assign(rij, overschrijf || {});
}

test('bepaalLeeftijdsgroep zet een kind op of na de grens bij jong', function () {
  assert.strictEqual(bepaalLeeftijdsgroep('2014-06-01', 'Speler', GRENZEN), 'jong');
  assert.strictEqual(bepaalLeeftijdsgroep('2015-01-01', 'Speler', GRENZEN), 'jong');
});

test('bepaalLeeftijdsgroep zet een kind voor de grens bij oud', function () {
  assert.strictEqual(bepaalLeeftijdsgroep('2013-12-31', 'Speler', GRENZEN), 'oud');
});

test('bepaalLeeftijdsgroep gebruikt de grens van de rol', function () {
  assert.strictEqual(bepaalLeeftijdsgroep('2013-06-01', 'Speler', GRENZEN), 'oud');
  assert.strictEqual(bepaalLeeftijdsgroep('2013-06-01', 'Keeper', GRENZEN), 'jong');
});

test('bepaalLeeftijdsgroep geeft leeg zonder geboortedatum', function () {
  assert.strictEqual(bepaalLeeftijdsgroep('', 'Speler', GRENZEN), '');
  assert.strictEqual(bepaalLeeftijdsgroep(null, 'Speler', GRENZEN), '');
});

test('bepaalLeeftijdsgroep geeft leeg bij een onbekende rol', function () {
  assert.strictEqual(bepaalLeeftijdsgroep('2014-06-01', 'Onzin', GRENZEN), '');
});

test('berekenTotaalscore middelt de gewogen schalen', function () {
  assert.strictEqual(berekenTotaalscore(scoreRij(), WEGINGEN), 4);
});

test('berekenTotaalscore weegt zwaarder gewicht zwaarder mee', function () {
  const wegingen = { blocks_planning: 3, blocks_flexibiliteit: 1 };
  const rij = scoreRij({ blocks_planning: 8, blocks_flexibiliteit: 4 });

  assert.strictEqual(berekenTotaalscore(rij, wegingen), 7);
});

test('berekenTotaalscore negeert schalen met gewicht 0', function () {
  const wegingen = Object.assign({}, WEGINGEN, { levels_voltooid: 0 });
  const rij = scoreRij({ levels_voltooid: 18 });

  assert.strictEqual(berekenTotaalscore(rij, wegingen), 4);
});

test('berekenTotaalscore geeft null als een gewogen schaal ontbreekt', function () {
  assert.strictEqual(berekenTotaalscore(scoreRij({ rally_kwaliteit: '' }), WEGINGEN), null);
});

test('berekenTotaalscore geeft null als er geen enkel gewicht is', function () {
  assert.strictEqual(berekenTotaalscore(scoreRij(), {}), null);
});

test('berekenTotaalscore rondt af op twee decimalen', function () {
  const wegingen = { blocks_planning: 1, blocks_flexibiliteit: 1, rally_prestatie: 1 };
  const rij = scoreRij({ blocks_planning: 4, blocks_flexibiliteit: 5, rally_prestatie: 5 });

  assert.strictEqual(berekenTotaalscore(rij, wegingen), 4.67);
});
