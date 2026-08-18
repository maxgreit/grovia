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
    { naam_slug: 'a', ixly_af: true,  ixly_taken: [{ naam: 'Blocks Game', assignment_uuid: 'u1' }] },
    { naam_slug: 'b', ixly_af: false, ixly_taken: [{ naam: 'Blocks Game', assignment_uuid: 'u2' }] },
    { naam_slug: 'c', ixly_af: true,  ixly_taken: [] },
    { naam_slug: 'd', ixly_af: true,  ixly_taken: [{ naam: 'Blocks Game', assignment_uuid: 'u4' }] }
  ];
  const scores = [{ naam_slug: 'd' }];

  assert.deepStrictEqual(kiesTeOphalenIndexen(rijen, scores, 50), [0]);
});

test('kiesTeOphalenIndexen kapt af op de batchgrootte', function () {
  const rijen = [0, 1, 2, 3, 4].map(function (i) {
    return { naam_slug: 's' + i, ixly_af: true, ixly_taken: [{ naam: 'Blocks Game', assignment_uuid: 'u' }] };
  });

  assert.deepStrictEqual(kiesTeOphalenIndexen(rijen, [], 3), [0, 1, 2]);
});

test('kiesTeOphalenIndexen slaat rijen met een handmatige score over', function () {
  const rijen = [
    { naam_slug: 'a', ixly_af: true, ixly_taken: [{ naam: 'Blocks Game', assignment_uuid: 'u1' }] }
  ];
  const scores = [{ naam_slug: 'a', bron: 'handmatig' }];

  assert.deepStrictEqual(kiesTeOphalenIndexen(rijen, scores, 50), []);
});
