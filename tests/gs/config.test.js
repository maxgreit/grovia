/**
 * Tests voor de pure Config-parsers.
 * Gebruik: node --test tests/gs/
 */
const test = require('node:test');
const assert = require('node:assert');
const { _leesSegmentGroepen, _leesGetalPaar } =
  require('../../google-apps-script/deelnemers/Config.gs');

function tabMet(waarden) {
  return { getRange: function () { return { getValues: function () { return waarden; } }; } };
}

test('_leesGetalPaar leest sleutel-getalparen en slaat lege rijen over', function () {
  const tab = tabMet([['Speler', 2014], ['Keeper', 2013], ['', ''], ['Onzin', '']]);

  assert.deepStrictEqual(_leesGetalPaar(tab, 'AB2:AC5'), { Speler: 2014, Keeper: 2013 });
});

test('_leesGetalPaar maakt van tekstgetallen echte getallen', function () {
  const tab = tabMet([['Speler', '2014']]);

  assert.strictEqual(_leesGetalPaar(tab, 'AB2:AC5').Speler, 2014);
});

test('_leesSegmentGroepen bouwt een sleutel van vereniging, leeftijd en rol', function () {
  const tab = tabMet([
    ['KA', 'jong', 'Speler', 3],
    ['KA', 'oud', 'Keeper', 2],
    ['', '', '', '']
  ]);

  assert.deepStrictEqual(_leesSegmentGroepen(tab, 'AG2:AJ30'), {
    'KA|jong|Speler': 3,
    'KA|oud|Keeper': 2
  });
});

test('_leesSegmentGroepen slaat een rij zonder aantal over', function () {
  const tab = tabMet([['KA', 'jong', 'Speler', ''], ['SU', 'jong', 'Speler', 2]]);

  assert.deepStrictEqual(_leesSegmentGroepen(tab, 'AG2:AJ30'), { 'SU|jong|Speler': 2 });
});
