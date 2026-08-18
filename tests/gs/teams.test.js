/**
 * Tests voor de pure teamindelingslogica.
 * Gebruik: node --test tests/gs/
 */
const test = require('node:test');
const assert = require('node:assert');
const { SCORE_KOLOMMEN, bepaalLeeftijdsgroep, berekenTotaalscore } =
  require('../../google-apps-script/deelnemers/Teams.gs');
const { bouwSegmenten, rangschik, deelInGroepen, verdeelGroottes } =
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

const CONFIG = {
  geboortejaargrens: { Speler: 2014, Keeper: 2013 },
  score_wegingen: (function () { const w = {}; SCORE_KOLOMMEN.forEach(function (k) { w[k] = 1; }); return w; })()
};

function deelnemer(overschrijf) {
  return Object.assign({
    naam_slug: 'kind-een', naam_kind: 'Kind Een', vereniging: 'KA', rol: 'Speler',
    geboortedatum_kind: '2015-03-01', club: 'VV Test', team: 'JO11-1'
  }, overschrijf || {});
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

test('bouwSegmenten groepeert op vereniging, leeftijd en rol', function () {
  const deelnemers = [
    deelnemer({ naam_slug: 'a' }),
    deelnemer({ naam_slug: 'b', vereniging: 'SU' }),
    deelnemer({ naam_slug: 'c', rol: 'Keeper' })
  ];
  const scores = ['a', 'b', 'c'].map(function (slug) { return scoreRij({ naam_slug: slug }); });

  const resultaat = bouwSegmenten(deelnemers, scores, CONFIG);

  assert.strictEqual(resultaat.segmenten['KA|jong|Speler'].length, 1);
  assert.strictEqual(resultaat.segmenten['SU|jong|Speler'].length, 1);
  assert.strictEqual(resultaat.segmenten['KA|jong|Keeper'].length, 1);
});

test('bouwSegmenten sluit MiniMove uit', function () {
  const deelnemers = [deelnemer({ naam_slug: 'a', vereniging: 'MM' })];
  const scores = [scoreRij({ naam_slug: 'a' })];

  const resultaat = bouwSegmenten(deelnemers, scores, CONFIG);

  assert.deepStrictEqual(resultaat.segmenten, {});
  assert.strictEqual(resultaat.zonderIndeling.length, 0);
});

test('bouwSegmenten zet een kind zonder geboortedatum in zonderIndeling', function () {
  const deelnemers = [deelnemer({ naam_slug: 'a', geboortedatum_kind: '' })];
  const scores = [scoreRij({ naam_slug: 'a' })];

  const resultaat = bouwSegmenten(deelnemers, scores, CONFIG);

  assert.strictEqual(resultaat.zonderIndeling.length, 1);
  assert.match(resultaat.zonderIndeling[0].reden, /geboortedatum/i);
});

test('bouwSegmenten zet een kind met onvolledige scores in zonderIndeling', function () {
  const deelnemers = [deelnemer({ naam_slug: 'a' })];
  const scores = [scoreRij({ naam_slug: 'a', rally_kwaliteit: '' })];

  const resultaat = bouwSegmenten(deelnemers, scores, CONFIG);

  assert.strictEqual(resultaat.zonderIndeling.length, 1);
  assert.match(resultaat.zonderIndeling[0].reden, /score/i);
});

test('bouwSegmenten zet een kind zonder scorerij in zonderIndeling', function () {
  const resultaat = bouwSegmenten([deelnemer({ naam_slug: 'a' })], [], CONFIG);

  assert.strictEqual(resultaat.zonderIndeling.length, 1);
});

test('rangschik sorteert van hoog naar laag', function () {
  const gerangschikt = rangschik([
    { naam_slug: 'a', totaalscore: 3 },
    { naam_slug: 'b', totaalscore: 7 },
    { naam_slug: 'c', totaalscore: 5 }
  ]);

  assert.deepStrictEqual(gerangschikt.map(function (d) { return d.naam_slug; }), ['b', 'c', 'a']);
  assert.deepStrictEqual(gerangschikt.map(function (d) { return d.ranking; }), [1, 2, 3]);
});

test('rangschik geeft gelijke scores dezelfde ranking en slaat daarna over', function () {
  const gerangschikt = rangschik([
    { naam_slug: 'a', totaalscore: 5 },
    { naam_slug: 'b', totaalscore: 5 },
    { naam_slug: 'c', totaalscore: 3 }
  ]);

  assert.deepStrictEqual(gerangschikt.map(function (d) { return d.ranking; }), [1, 1, 3]);
});

test('rangschik houdt bij gelijke scores een vaste volgorde op naam_slug', function () {
  const eerste = rangschik([
    { naam_slug: 'zoe', totaalscore: 5 },
    { naam_slug: 'aap', totaalscore: 5 }
  ]);
  const tweede = rangschik([
    { naam_slug: 'aap', totaalscore: 5 },
    { naam_slug: 'zoe', totaalscore: 5 }
  ]);

  assert.deepStrictEqual(eerste.map(function (d) { return d.naam_slug; }), ['aap', 'zoe']);
  assert.deepStrictEqual(tweede.map(function (d) { return d.naam_slug; }), ['aap', 'zoe']);
});

test('verdeelGroottes verdeelt zo gelijk mogelijk met de rest bovenaan', function () {
  assert.deepStrictEqual(verdeelGroottes(20, 3), [7, 7, 6]);
  assert.deepStrictEqual(verdeelGroottes(9, 3), [3, 3, 3]);
  assert.deepStrictEqual(verdeelGroottes(2, 3), [1, 1, 0]);
});

test('deelInGroepen geeft de sterkste kinderen de eerste groepsnaam', function () {
  const gerangschikt = rangschik([
    { naam_slug: 'a', totaalscore: 9 },
    { naam_slug: 'b', totaalscore: 7 },
    { naam_slug: 'c', totaalscore: 5 },
    { naam_slug: 'd', totaalscore: 3 }
  ]);

  const ingedeeld = deelInGroepen(gerangschikt, ['C3', 'C2', 'C1'], 3);

  assert.deepStrictEqual(ingedeeld.map(function (d) { return d.voorgestelde_groep; }),
    ['C3', 'C3', 'C2', 'C1']);
});

test('deelInGroepen gebruikt het ingestelde aantal groepen, niet alle namen', function () {
  const gerangschikt = rangschik([
    { naam_slug: 'a', totaalscore: 9 },
    { naam_slug: 'b', totaalscore: 7 },
    { naam_slug: 'c', totaalscore: 5 },
    { naam_slug: 'd', totaalscore: 3 }
  ]);

  const ingedeeld = deelInGroepen(gerangschikt, ['C3', 'C2', 'C1'], 2);

  assert.deepStrictEqual(ingedeeld.map(function (d) { return d.voorgestelde_groep; }),
    ['C3', 'C3', 'C2', 'C2']);
});

test('deelInGroepen valt terug op alle groepsnamen zonder ingesteld aantal', function () {
  const ingedeeld = deelInGroepen(rangschik([{ naam_slug: 'a', totaalscore: 5 }]), ['C3', 'C2'], null);

  assert.strictEqual(ingedeeld[0].voorgestelde_groep, 'C3');
});

test('deelInGroepen laat de groep leeg als er geen groepsnamen zijn', function () {
  const ingedeeld = deelInGroepen([{ naam_slug: 'a', totaalscore: 5, ranking: 1 }], [], 3);

  assert.strictEqual(ingedeeld[0].voorgestelde_groep, '');
});

const { TEAM_KOLOMMEN, SEGMENT_TABBLADEN, behoudDefinitieveGroep } =
  require('../../google-apps-script/deelnemers/Teams.gs');

test('TEAM_KOLOMMEN bevat geen ouder- of bedragvelden', function () {
  assert.ok(TEAM_KOLOMMEN.indexOf('ouder_email') === -1);
  assert.ok(TEAM_KOLOMMEN.indexOf('ouder_naam') === -1);
  assert.ok(TEAM_KOLOMMEN.indexOf('bedrag') === -1);
});

test('TEAM_KOLOMMEN bevat voorstel en definitief naast elkaar', function () {
  assert.ok(TEAM_KOLOMMEN.indexOf('voorgestelde_groep') !== -1);
  assert.ok(TEAM_KOLOMMEN.indexOf('definitieve_groep') !== -1);
});

test('SEGMENT_TABBLADEN dekt alle vier de combinaties', function () {
  assert.strictEqual(SEGMENT_TABBLADEN['jong|Speler'], 'Jong voetbal');
  assert.strictEqual(SEGMENT_TABBLADEN['oud|Speler'], 'Oud voetbal');
  assert.strictEqual(SEGMENT_TABBLADEN['jong|Keeper'], 'Jong keeper');
  assert.strictEqual(SEGMENT_TABBLADEN['oud|Keeper'], 'Oud keeper');
});

test('behoudDefinitieveGroep neemt de handmatige groep over op naam_slug', function () {
  const bestaand = [
    { naam_slug: 'a', definitieve_groep: 'C1' },
    { naam_slug: 'b', definitieve_groep: '' }
  ];
  const nieuw = [
    { naam_slug: 'b', voorgestelde_groep: 'C2' },
    { naam_slug: 'a', voorgestelde_groep: 'C3' }
  ];

  const resultaat = behoudDefinitieveGroep(bestaand, nieuw);

  assert.strictEqual(resultaat[1].definitieve_groep, 'C1', 'match op naam, niet op rijnummer');
  assert.strictEqual(resultaat[0].definitieve_groep, '');
});

test('behoudDefinitieveGroep laat een nieuw kind zonder definitieve groep', function () {
  const resultaat = behoudDefinitieveGroep([], [{ naam_slug: 'nieuw', voorgestelde_groep: 'C2' }]);

  assert.strictEqual(resultaat[0].definitieve_groep, '');
});

test('behoudDefinitieveGroep raakt het voorstel niet aan', function () {
  const bestaand = [{ naam_slug: 'a', definitieve_groep: 'C1', voorgestelde_groep: 'C1' }];
  const nieuw = [{ naam_slug: 'a', voorgestelde_groep: 'C3' }];

  const resultaat = behoudDefinitieveGroep(bestaand, nieuw);

  assert.strictEqual(resultaat[0].voorgestelde_groep, 'C3');
  assert.strictEqual(resultaat[0].definitieve_groep, 'C1');
});
