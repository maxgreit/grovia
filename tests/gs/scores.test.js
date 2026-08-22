/**
 * Tests voor de pure Scores-logica (vertaling en selectie).
 * Gebruik: node --test tests/gs/
 */
const test = require('node:test');
const assert = require('node:assert');
const { VELD_VERTALING, naarScoreRij, kiesTeOphalenIndexen } =
  require('../../google-apps-script/deelnemers/Scores.gs');

// Zoals ixly-scores het teruggeeft (Ixly-sleutels, alleen latent).
const API_RESULTAAT = {
  blocks: { planning: 4.038200181645173, flexibility: 5.89188895337087 },
  rally: {
    performance: 3.5942969944965615,
    quality: 2.619527477686538,
    reaction_time: 3.6685994359268914,
    consistence: 2.480782690685333,
    sustained_attention: 4.776384221398225,
    response_inhibition: 4.1449029588254005,
    response_to_mistakes: 6.500798165547855
  },
  levels_voltooid: 18,
  levels_perfect: 9
};

test('naarScoreRij vertaalt alle negen schalen naar kolomnamen', function () {
  const rij = naarScoreRij('magnus-boekel', 'Magnus Boekel', API_RESULTAAT, '2026-08-18');

  assert.strictEqual(rij.blocks_planning, 4.038200181645173);
  assert.strictEqual(rij.blocks_flexibiliteit, 5.89188895337087);
  assert.strictEqual(rij.rally_prestatie, 3.5942969944965615);
  assert.strictEqual(rij.rally_kwaliteit, 2.619527477686538);
  assert.strictEqual(rij.rally_reactiesnelheid, 3.6685994359268914);
  assert.strictEqual(rij.rally_consistentie, 2.480782690685333);
  assert.strictEqual(rij.rally_volgehouden_aandacht, 4.776384221398225);
  assert.strictEqual(rij.rally_respons_inhibitie, 4.1449029588254005);
  assert.strictEqual(rij.rally_reactie_op_fouten, 6.500798165547855);
});

test('naarScoreRij neemt sleutel, naam, levels, bron en datum mee', function () {
  const rij = naarScoreRij('magnus-boekel', 'Magnus Boekel', API_RESULTAAT, '2026-08-18');

  assert.strictEqual(rij.naam_slug, 'magnus-boekel');
  assert.strictEqual(rij.naam_kind, 'Magnus Boekel');
  assert.strictEqual(rij.levels_voltooid, 18);
  assert.strictEqual(rij.levels_perfect, 9);
  assert.strictEqual(rij.bron, 'api');
  assert.strictEqual(rij.opgehaald_op, '2026-08-18');
});

test('naarScoreRij laat ontbrekende schalen leeg in plaats van nul', function () {
  const alleenBlocks = { blocks: { planning: 4 }, rally: {}, levels_voltooid: 18, levels_perfect: 9 };
  const rij = naarScoreRij('x', 'X', alleenBlocks, '2026-08-18');

  assert.strictEqual(rij.blocks_planning, 4);
  assert.strictEqual(rij.blocks_flexibiliteit, '');
  assert.strictEqual(rij.rally_prestatie, '');
});

test('naarScoreRij negeert onbekende Ixly-sleutels', function () {
  const metOnbekende = { blocks: { planning: 4, nieuwe_schaal: 9 }, rally: {} };
  const rij = naarScoreRij('x', 'X', metOnbekende, '2026-08-18');

  assert.strictEqual(rij.nieuwe_schaal, undefined);
  assert.strictEqual(rij.blocks_planning, 4);
});

test('kiesTeOphalenIndexen kiest alleen afgeronde rijen met taken en zonder score', function () {
  const rijen = [
    { naam_slug: 'a', code: '1', ixly_af: true,  ixly_taken: [{ naam: 'Blocks Game', assignment_uuid: 'u1' }] },
    { naam_slug: 'b', code: '2', ixly_af: false, ixly_taken: [{ naam: 'Blocks Game', assignment_uuid: 'u2' }] },
    { naam_slug: 'c', code: '3', ixly_af: true,  ixly_taken: [] },
    { naam_slug: 'd', code: '4', ixly_af: true,  ixly_taken: [{ naam: 'Blocks Game', assignment_uuid: 'u4' }] }
  ];
  const scores = [{ naam_slug: 'd' }];

  assert.deepStrictEqual(kiesTeOphalenIndexen(rijen, scores, 50), [0]);
});

test('kiesTeOphalenIndexen kapt af op de batchgrootte', function () {
  const rijen = [0, 1, 2, 3, 4].map(function (i) {
    return { naam_slug: 's' + i, code: String(1000 + i), ixly_af: true, ixly_taken: [{ naam: 'Blocks Game', assignment_uuid: 'u' }] };
  });

  assert.deepStrictEqual(kiesTeOphalenIndexen(rijen, [], 3), [0, 1, 2]);
});

test('kiesTeOphalenIndexen slaat rijen met een handmatige score over', function () {
  const rijen = [
    { naam_slug: 'a', code: '1345', ixly_af: true, ixly_taken: [{ naam: 'Blocks Game', assignment_uuid: 'u1' }] }
  ];
  const scores = [{ naam_slug: 'a', bron: 'handmatig' }];

  assert.deepStrictEqual(kiesTeOphalenIndexen(rijen, scores, 50), []);
});

// --- Seizoensbewust ophalen: een score van vorig seizoen blokkeert niet ---

// Scores.gs gebruikt teamSeizoenVanDeelnemer (Teams.gs); in Apps Script is dat een
// globale functie, hier zetten we hem expliciet klaar (zelfde patroon als naarSlug
// in financieel.test.js).
global.teamSeizoenVanDeelnemer =
  require('../../google-apps-script/deelnemers/Teams.gs').teamSeizoenVanDeelnemer;

test('kiesTeOphalenIndexen bevraagt een terugkeerder met alleen een score van vorig seizoen opnieuw', function () {
  const rijen = [
    { naam_slug: 'terugkeerder', code: '2001', ixly_af: true, uitgenodigd_op: '2027-06-01',
      ixly_taken: [{ naam: 'Blocks Game', assignment_uuid: 'u1' }] }
  ];
  const scores = [{ naam_slug: 'terugkeerder', seizoen: '2627' }];

  assert.deepStrictEqual(kiesTeOphalenIndexen(rijen, scores, 50), [0]);
});

test('kiesTeOphalenIndexen slaat een rij met een score van hetzelfde seizoen over', function () {
  const rijen = [
    { naam_slug: 'a', code: '2002', ixly_af: true, uitgenodigd_op: '2026-08-01',
      ixly_taken: [{ naam: 'Blocks Game', assignment_uuid: 'u1' }] }
  ];
  const scores = [{ naam_slug: 'a', seizoen: '2627' }];

  assert.deepStrictEqual(kiesTeOphalenIndexen(rijen, scores, 50), []);
});

test('kiesTeOphalenIndexen vergelijkt het scoreseizoen als tekst, niet als getal', function () {
  const rijen = [
    { naam_slug: 'a', code: '2003', ixly_af: true, uitgenodigd_op: '2026-08-01',
      ixly_taken: [{ naam: 'Blocks Game', assignment_uuid: 'u1' }] }
  ];
  const scores = [{ naam_slug: 'a', seizoen: 2627 }];

  assert.deepStrictEqual(kiesTeOphalenIndexen(rijen, scores, 50), []);
});

test('naarScoreRij neemt het seizoen mee', function () {
  const rij = naarScoreRij('magnus-boekel', 'Magnus Boekel', API_RESULTAAT, '2026-08-18', '2627');
  assert.strictEqual(rij.seizoen, '2627');
});

// --- C2: een leeg of onvolledig API-antwoord is geen score ---

const { heeftVolledigeScores } = require('../../google-apps-script/deelnemers/Scores.gs');

test('heeftVolledigeScores herkent een volledig antwoord', function () {
  assert.strictEqual(heeftVolledigeScores(API_RESULTAAT), true);
});

test('heeftVolledigeScores wijst een leeg antwoord af', function () {
  assert.strictEqual(heeftVolledigeScores(null), false);
  assert.strictEqual(heeftVolledigeScores(undefined), false);
  assert.strictEqual(heeftVolledigeScores({}), false);
});

test('heeftVolledigeScores wijst de foutloze lege vorm van ixly-scores af', function () {
  // Precies wat _verzamel_scores teruggeeft als de assignment (nog) niet zichtbaar is
  // of Ixly de score nog niet berekend heeft: volledige vorm, geen fout, alles leeg.
  const leeg = { blocks: {}, rally: {}, levels_voltooid: null, levels_perfect: null };

  assert.strictEqual(heeftVolledigeScores(leeg), false);
});

test('heeftVolledigeScores wijst een half antwoord af (alleen Blocks afgerond)', function () {
  const alleenBlocks = {
    blocks: API_RESULTAAT.blocks, rally: {}, levels_voltooid: 18, levels_perfect: 9
  };

  assert.strictEqual(heeftVolledigeScores(alleenBlocks), false);
});

test('heeftVolledigeScores wijst een antwoord met één ontbrekende schaal af', function () {
  const bijnaCompleet = JSON.parse(JSON.stringify(API_RESULTAAT));
  delete bijnaCompleet.rally.response_to_mistakes;

  assert.strictEqual(heeftVolledigeScores(bijnaCompleet), false);
});

test('heeftVolledigeScores telt een null-waarde niet als schaal', function () {
  const metNull = JSON.parse(JSON.stringify(API_RESULTAAT));
  metNull.blocks.planning = null;

  assert.strictEqual(heeftVolledigeScores(metNull), false);
});

test('heeftVolledigeScores negeert de leveltellingen', function () {
  const zonderLevels = JSON.parse(JSON.stringify(API_RESULTAAT));
  zonderLevels.levels_voltooid = null;
  zonderLevels.levels_perfect = null;

  assert.strictEqual(heeftVolledigeScores(zonderLevels), true);
});

test('naarScoreRij van een leeg resultaat levert louter lege schalen op', function () {
  const rij = naarScoreRij('x', 'X', { blocks: {}, rally: {}, levels_voltooid: null, levels_perfect: null }, '2026-08-18');

  Object.keys(VELD_VERTALING).forEach(function (game) {
    Object.keys(VELD_VERTALING[game]).forEach(function (sleutel) {
      assert.strictEqual(rij[VELD_VERTALING[game][sleutel]], '');
    });
  });
  assert.strictEqual(rij.levels_voltooid, '');
  assert.strictEqual(rij.levels_perfect, '');
  assert.strictEqual(heeftVolledigeScores({ blocks: {}, rally: {} }), false,
    'zo n rij hoort dus nooit weggeschreven te worden');
});

test('naarScoreRij van null levert louter lege schalen op', function () {
  const rij = naarScoreRij('x', 'X', null, '2026-08-18');

  assert.strictEqual(rij.blocks_planning, '');
  assert.strictEqual(rij.rally_prestatie, '');
  assert.strictEqual(rij.levels_voltooid, '');
  assert.strictEqual(rij.naam_slug, 'x');
});

test('kiesTeOphalenIndexen slaat een rij zonder code over', function () {
  // Zonder code is er geen order_id om mee te bevragen: zo n rij vult elke run een
  // plek in de batch zonder ooit iets op te leveren. kiesTeControlerenIndexen
  // (IxlyStatus.gs) controleert hier al wel op.
  const rijen = [
    { naam_slug: 'a', code: '', ixly_af: true, ixly_taken: [{ naam: 'Blocks Game', assignment_uuid: 'u1' }] },
    { naam_slug: 'b', code: '1345', ixly_af: true, ixly_taken: [{ naam: 'Blocks Game', assignment_uuid: 'u2' }] }
  ];

  assert.deepStrictEqual(kiesTeOphalenIndexen(rijen, [], 50), [1]);
});
