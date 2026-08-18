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

// Het huidige seizoen zoals bepaalSeizoen(vandaag) het oplevert (Deelnemers.gs).
const SEIZOEN = '2627';

const CONFIG = {
  geboortejaargrens: { Speler: 2014, Keeper: 2013 },
  score_wegingen: (function () { const w = {}; SCORE_KOLOMMEN.forEach(function (k) { w[k] = 1; }); return w; })()
};

function deelnemer(overschrijf) {
  return Object.assign({
    seizoen: SEIZOEN,
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

  const resultaat = bouwSegmenten(deelnemers, scores, CONFIG, SEIZOEN);

  assert.strictEqual(resultaat.segmenten['KA|jong|Speler'].length, 1);
  assert.strictEqual(resultaat.segmenten['SU|jong|Speler'].length, 1);
  assert.strictEqual(resultaat.segmenten['KA|jong|Keeper'].length, 1);
});

test('bouwSegmenten sluit MiniMove uit', function () {
  const deelnemers = [deelnemer({ naam_slug: 'a', vereniging: 'MM' })];
  const scores = [scoreRij({ naam_slug: 'a' })];

  const resultaat = bouwSegmenten(deelnemers, scores, CONFIG, SEIZOEN);

  assert.deepStrictEqual(resultaat.segmenten, {});
  assert.strictEqual(resultaat.zonderIndeling.length, 0);
});

test('bouwSegmenten zet een kind zonder geboortedatum in zonderIndeling', function () {
  const deelnemers = [deelnemer({ naam_slug: 'a', geboortedatum_kind: '' })];
  const scores = [scoreRij({ naam_slug: 'a' })];

  const resultaat = bouwSegmenten(deelnemers, scores, CONFIG, SEIZOEN);

  assert.strictEqual(resultaat.zonderIndeling.length, 1);
  assert.match(resultaat.zonderIndeling[0].reden, /geboortedatum/i);
});

test('bouwSegmenten zet een kind met onvolledige scores in zonderIndeling', function () {
  const deelnemers = [deelnemer({ naam_slug: 'a' })];
  const scores = [scoreRij({ naam_slug: 'a', rally_kwaliteit: '' })];

  const resultaat = bouwSegmenten(deelnemers, scores, CONFIG, SEIZOEN);

  assert.strictEqual(resultaat.zonderIndeling.length, 1);
  assert.match(resultaat.zonderIndeling[0].reden, /score/i);
});

test('bouwSegmenten zet een kind zonder scorerij in zonderIndeling', function () {
  const resultaat = bouwSegmenten([deelnemer({ naam_slug: 'a' })], [], CONFIG, SEIZOEN);

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

const { moetTabbladOverslaan, verenigingenZonderWerkboek } =
  require('../../google-apps-script/deelnemers/Teams.gs');

test('moetTabbladOverslaan slaat over als de nieuwe lijst leeg is maar het tabblad niet', function () {
  assert.strictEqual(moetTabbladOverslaan(5, 0), true);
});

test('moetTabbladOverslaan schrijft gewoon als het tabblad al leeg was', function () {
  assert.strictEqual(moetTabbladOverslaan(0, 0), false);
});

test('moetTabbladOverslaan schrijft gewoon als de nieuwe lijst niet leeg is', function () {
  assert.strictEqual(moetTabbladOverslaan(5, 3), false);
});

test('verenigingenZonderWerkboek meldt een vereniging met segmentkinderen maar zonder werkboek-ID', function () {
  const segmenten = { 'KA|jong|Speler': [{ naam_slug: 'a' }] };
  const resultaat = verenigingenZonderWerkboek(segmenten, [], { SU: 'sheet-id' });

  assert.deepStrictEqual(resultaat, ['KA']);
});

test('verenigingenZonderWerkboek meldt een vereniging met alleen zonderIndeling-kinderen', function () {
  const zonderIndeling = [{ naam_slug: 'a', vereniging: 'KA' }];
  const resultaat = verenigingenZonderWerkboek({}, zonderIndeling, {});

  assert.deepStrictEqual(resultaat, ['KA']);
});

test('verenigingenZonderWerkboek meldt niets als de vereniging wel een werkboek-ID heeft', function () {
  const segmenten = { 'KA|jong|Speler': [{ naam_slug: 'a' }] };
  const resultaat = verenigingenZonderWerkboek(segmenten, [], { KA: 'sheet-id' });

  assert.deepStrictEqual(resultaat, []);
});

test('verenigingenZonderWerkboek negeert een segment dat toevallig leeg is', function () {
  const segmenten = { 'KA|jong|Speler': [] };
  const resultaat = verenigingenZonderWerkboek(segmenten, [], {});

  assert.deepStrictEqual(resultaat, []);
});

// --- C1: vervuilde handmatige invoer mag nooit als score doorgaan ---

test('berekenTotaalscore geeft null bij een Nederlandse decimaalkomma', function () {
  // '4,03' is precies wat handmatige invoer in een Nederlandstalig werkboek oplevert.
  assert.strictEqual(berekenTotaalscore(scoreRij({ blocks_planning: '4,03' }), WEGINGEN), null);
});

test('berekenTotaalscore geeft null bij niet-numerieke tekst', function () {
  assert.strictEqual(berekenTotaalscore(scoreRij({ rally_kwaliteit: 'onbekend' }), WEGINGEN), null);
});

test('berekenTotaalscore accepteert een tekstgetal met punt', function () {
  assert.strictEqual(berekenTotaalscore(scoreRij({ blocks_planning: '4' }), WEGINGEN), 4);
});

test('bouwSegmenten zet een kind met een vervuilde scorecel in zonderIndeling', function () {
  const deelnemers = [deelnemer({ naam_slug: 'a' })];
  const scores = [scoreRij({ naam_slug: 'a', blocks_planning: '4,03' })];

  const resultaat = bouwSegmenten(deelnemers, scores, CONFIG, SEIZOEN);

  assert.deepStrictEqual(resultaat.segmenten, {});
  assert.strictEqual(resultaat.zonderIndeling.length, 1);
});

test('rangschik houdt een vaste volgorde als een totaalscore NaN is', function () {
  const eerste = rangschik([
    { naam_slug: 'zoe', totaalscore: NaN },
    { naam_slug: 'aap', totaalscore: 9 },
    { naam_slug: 'mid', totaalscore: NaN }
  ]);
  const tweede = rangschik([
    { naam_slug: 'mid', totaalscore: NaN },
    { naam_slug: 'zoe', totaalscore: NaN },
    { naam_slug: 'aap', totaalscore: 9 }
  ]);

  assert.deepStrictEqual(eerste.map(function (d) { return d.naam_slug; }),
    tweede.map(function (d) { return d.naam_slug; }));
  assert.strictEqual(eerste[0].naam_slug, 'aap', 'de hoogste echte score blijft bovenaan');
});

// --- C3: alleen het huidige seizoen wordt ingedeeld ---

test('bouwSegmenten laat een kind van vorig seizoen buiten de indeling', function () {
  const deelnemers = [
    deelnemer({ naam_slug: 'nu' }),
    deelnemer({ naam_slug: 'toen', seizoen: '2526' })
  ];
  const scores = [scoreRij({ naam_slug: 'nu' }), scoreRij({ naam_slug: 'toen' })];

  const resultaat = bouwSegmenten(deelnemers, scores, CONFIG, SEIZOEN);

  assert.strictEqual(resultaat.segmenten['KA|jong|Speler'].length, 1);
  assert.strictEqual(resultaat.segmenten['KA|jong|Speler'][0].naam_slug, 'nu');
  assert.strictEqual(resultaat.zonderIndeling.length, 0,
    'vorig seizoen hoort ook niet in "Zonder indeling" -- dat zou een historische ledenlijst worden');
});

test('bouwSegmenten zet hetzelfde kind uit twee seizoenen maar één keer in een segment', function () {
  // "Ixly Scores" sleutelt op naam_slug, Deelnemers op seizoen|naam_slug -- zonder
  // seizoensfilter stond hetzelfde kind twee keer in hetzelfde tabblad.
  const deelnemers = [
    deelnemer({ naam_slug: 'a' }),
    deelnemer({ naam_slug: 'a', seizoen: '2526' })
  ];
  const scores = [scoreRij({ naam_slug: 'a' })];

  const resultaat = bouwSegmenten(deelnemers, scores, CONFIG, SEIZOEN);

  assert.strictEqual(resultaat.segmenten['KA|jong|Speler'].length, 1);
});

test('bouwSegmenten vergelijkt het seizoen als tekst, niet als getal', function () {
  // Google Sheets maakt van een puur numerieke cel ('2627') soms zelf een getalcel.
  const deelnemers = [deelnemer({ naam_slug: 'a', seizoen: 2627 })];
  const scores = [scoreRij({ naam_slug: 'a' })];

  const resultaat = bouwSegmenten(deelnemers, scores, CONFIG, SEIZOEN);

  assert.strictEqual(resultaat.segmenten['KA|jong|Speler'].length, 1);
});

test('bouwSegmenten eist een seizoen en gaat niet stil over alles heen', function () {
  assert.throws(function () {
    bouwSegmenten([deelnemer({ naam_slug: 'a' })], [], CONFIG);
  }, /seizoen/i);
});

// --- I6: een typfout in Config mag niet stil iedereen buiten de indeling zetten ---

const { configWaarschuwingen } = require('../../google-apps-script/deelnemers/Teams.gs');

test('berekenTotaalscore negeert een onbekende gewichtssleutel in plaats van iedereen te blokkeren', function () {
  // 'Blocks planning' i.p.v. 'blocks_planning': de acht overige schalen tellen gewoon
  // door, zodat de kinderen niet stil met "onvolledige score" verdwijnen.
  const wegingen = Object.assign({}, WEGINGEN, { 'Blocks planning': 1 });
  delete wegingen.blocks_planning;

  assert.strictEqual(berekenTotaalscore(scoreRij(), wegingen), 4);
});

test('configWaarschuwingen meldt een onbekende gewichtssleutel', function () {
  const wegingen = Object.assign({}, WEGINGEN, { 'Blocks planning': 1 });

  const meldingen = configWaarschuwingen({ score_wegingen: wegingen, geboortejaargrens: { Speler: 2014 } });

  assert.strictEqual(meldingen.filter(function (m) { return /Blocks planning/.test(m); }).length, 1);
});

test('configWaarschuwingen meldt lege score_wegingen', function () {
  const meldingen = configWaarschuwingen({ score_wegingen: {}, geboortejaargrens: { Speler: 2014 } });

  assert.match(meldingen.join('\n'), /score_wegingen/);
});

test('configWaarschuwingen meldt wegingen die allemaal 0 zijn', function () {
  const meldingen = configWaarschuwingen({
    score_wegingen: { blocks_planning: 0 }, geboortejaargrens: { Speler: 2014 }
  });

  assert.match(meldingen.join('\n'), /gewicht/i);
});

test('configWaarschuwingen zwijgt bij een correcte Config', function () {
  const meldingen = configWaarschuwingen({
    score_wegingen: WEGINGEN,
    geboortejaargrens: { Speler: 2014, Keeper: 2013 },
    groepsnamen: ['C3', 'C2', 'C1'],
    groepen_per_segment: { 'KA|jong|Speler': 3 }
  });

  assert.deepStrictEqual(meldingen, []);
});

test('configWaarschuwingen meldt een verkeerd geschreven rol in de geboortejaargrens', function () {
  const meldingen = configWaarschuwingen({
    score_wegingen: WEGINGEN, geboortejaargrens: { speler: 2014 }
  });

  assert.match(meldingen.join('\n'), /geboortejaargrens/);
});

test('configWaarschuwingen meldt een onbekend segment in groepen_per_segment', function () {
  const meldingen = configWaarschuwingen({
    score_wegingen: WEGINGEN,
    geboortejaargrens: { Speler: 2014 },
    groepen_per_segment: { 'KA|jong|speler': 3 }
  });

  assert.match(meldingen.join('\n'), /groepen_per_segment/);
});

test('configWaarschuwingen geeft de problemen door die Config.gs bij het lezen vond', function () {
  const meldingen = configWaarschuwingen({
    score_wegingen: WEGINGEN,
    geboortejaargrens: { Speler: 2014 },
    config_problemen: ['score_wegingen: "blocks_planning" heeft geen getal als gewicht ("een")']
  });

  assert.match(meldingen.join('\n'), /blocks_planning/);
});

test('bouwSegmenten noemt de Config als oorzaak wanneer er geen bruikbaar gewicht is', function () {
  const config = Object.assign({}, CONFIG, { score_wegingen: { 'Blocks planning': 1 } });
  const resultaat = bouwSegmenten([deelnemer({ naam_slug: 'a' })],
    [scoreRij({ naam_slug: 'a' })], config, SEIZOEN);

  assert.strictEqual(resultaat.zonderIndeling.length, 1);
  assert.match(resultaat.zonderIndeling[0].reden, /config/i);
  assert.doesNotMatch(resultaat.zonderIndeling[0].reden, /onvolledige score/i);
});

test('bouwSegmenten noemt de ontbrekende geboortejaargrens in plaats van de geboortedatum', function () {
  const config = Object.assign({}, CONFIG, { geboortejaargrens: { speler: 2014 } });
  const resultaat = bouwSegmenten([deelnemer({ naam_slug: 'a' })],
    [scoreRij({ naam_slug: 'a' })], config, SEIZOEN);

  assert.strictEqual(resultaat.zonderIndeling.length, 1);
  assert.match(resultaat.zonderIndeling[0].reden, /geboortejaargrens/);
});

// --- I7: meer groepen gevraagd dan er groepsnamen zijn ---

const { segmentenMetTeVeelGroepen } = require('../../google-apps-script/deelnemers/Teams.gs');

test('segmentenMetTeVeelGroepen meldt een segment dat meer groepen vraagt dan er namen zijn', function () {
  const resultaat = segmentenMetTeVeelGroepen({ 'KA|jong|Speler': 4 }, ['C3', 'C2', 'C1']);

  assert.deepStrictEqual(resultaat, ['KA|jong|Speler']);
});

test('segmentenMetTeVeelGroepen zwijgt als het aantal precies past of minder is', function () {
  const resultaat = segmentenMetTeVeelGroepen(
    { 'KA|jong|Speler': 3, 'SU|oud|Keeper': 1 }, ['C3', 'C2', 'C1']);

  assert.deepStrictEqual(resultaat, []);
});

test('segmentenMetTeVeelGroepen meldt elk segment als er helemaal geen groepsnamen zijn', function () {
  const resultaat = segmentenMetTeVeelGroepen({ 'KA|jong|Speler': 2 }, []);

  assert.deepStrictEqual(resultaat, ['KA|jong|Speler']);
});

test('configWaarschuwingen meldt te veel gevraagde groepen', function () {
  const meldingen = configWaarschuwingen({
    score_wegingen: WEGINGEN,
    geboortejaargrens: { Speler: 2014 },
    groepsnamen: ['C3', 'C2'],
    groepen_per_segment: { 'KA|jong|Speler': 4 }
  });

  assert.match(meldingen.join('\n'), /KA\|jong\|Speler/);
  assert.match(meldingen.join('\n'), /groepsnamen/);
});
