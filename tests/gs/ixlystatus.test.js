/**
 * Tests voor de rij-selectielogica van de Ixly-batch.
 * Gebruik: node --test "tests/gs/*.test.js"
 */
const test = require('node:test');
const assert = require('node:assert');
const { kiesTeControlerenIndexen } = require('../../google-apps-script/deelnemers/IxlyStatus.gs');

function rij(overschrijf) {
  return Object.assign({
    naam_slug: 'freddie-rood', code: '935', ixly_af: false,
    ixly_laatste_gecontroleerd_op: '',
    ixly_taken: [{ naam: 'Blocks Game', assignment_uuid: 'assign-1' }]
  }, overschrijf);
}

test('rijen zonder ixly_laatste_gecontroleerd_op komen vóór rijen met een datum', () => {
  const rijen = [
    rij({ code: '1', ixly_laatste_gecontroleerd_op: '2026-07-20' }),
    rij({ code: '2', ixly_laatste_gecontroleerd_op: '' })
  ];
  const indexen = kiesTeControlerenIndexen(rijen, 10);
  assert.deepStrictEqual(indexen, [1, 0]);
});

test('bij twee rijen met een datum komt de oudste eerst', () => {
  const rijen = [
    rij({ code: '1', ixly_laatste_gecontroleerd_op: '2026-07-25' }),
    rij({ code: '2', ixly_laatste_gecontroleerd_op: '2026-07-10' })
  ];
  const indexen = kiesTeControlerenIndexen(rijen, 10);
  assert.deepStrictEqual(indexen, [1, 0]);
});

test('rijen met ixly_af === true worden nooit gekozen, ook niet als ze nooit gecontroleerd zijn', () => {
  const rijen = [
    rij({ code: '1', ixly_af: true, ixly_laatste_gecontroleerd_op: '' }),
    rij({ code: '2', ixly_af: false, ixly_laatste_gecontroleerd_op: '2026-07-20' })
  ];
  const indexen = kiesTeControlerenIndexen(rijen, 10);
  assert.deepStrictEqual(indexen, [1]);
});

test('rijen zonder code worden nooit gekozen', () => {
  const rijen = [
    rij({ code: '', ixly_laatste_gecontroleerd_op: '' }),
    rij({ code: '2', ixly_laatste_gecontroleerd_op: '2026-07-20' })
  ];
  const indexen = kiesTeControlerenIndexen(rijen, 10);
  assert.deepStrictEqual(indexen, [1]);
});

test('bij meer open rijen dan batchGrootte roteert de volgende run naar de overgeslagen rijen', () => {
  const rijen = [
    rij({ code: '1', naam_slug: 'kind-1', ixly_laatste_gecontroleerd_op: '' }),
    rij({ code: '2', naam_slug: 'kind-2', ixly_laatste_gecontroleerd_op: '' }),
    rij({ code: '3', naam_slug: 'kind-3', ixly_laatste_gecontroleerd_op: '' }),
    rij({ code: '4', naam_slug: 'kind-4', ixly_laatste_gecontroleerd_op: '' })
  ];

  const eersteBatch = kiesTeControlerenIndexen(rijen, 2);
  assert.strictEqual(eersteBatch.length, 2);
  assert.deepStrictEqual(eersteBatch, [0, 1]);

  // Simuleer werkIxlyBij: de gecontroleerde rijen krijgen vandaag als datum.
  const naDeEersteRun = rijen.map(function (r, i) {
    return eersteBatch.indexOf(i) !== -1
      ? Object.assign({}, r, { ixly_laatste_gecontroleerd_op: '2026-07-31' })
      : r;
  });

  const tweedeBatch = kiesTeControlerenIndexen(naDeEersteRun, 2);
  assert.strictEqual(tweedeBatch.length, 2);
  // De rijen die de eerste keer NIET gekozen waren (2 en 3) komen nu naar voren.
  assert.deepStrictEqual(tweedeBatch, [2, 3]);
});

test('rijen zonder ixly_taken worden nooit gekozen', () => {
  const rijen = [
    rij({ code: '1', ixly_taken: [], ixly_laatste_gecontroleerd_op: '' }),
    rij({ code: '2', ixly_laatste_gecontroleerd_op: '2026-07-20' })
  ];
  const indexen = kiesTeControlerenIndexen(rijen, 10);
  assert.deepStrictEqual(indexen, [1]);
});

// ── Verwerking van de statusresultaten ──────────────────────────────────────────
// Een verouderde Ixly-referentie (candidate_task 404) moet in een EIGEN kanaal
// terechtkomen, niet in `fouten`: fouten zetten dataBetrouwbaar op false in
// Dagelijks.gs en slaan daarmee alle reminders van die dag over. Een verouderde
// referentie is permanent, dus dat zou de reminders vanaf dat moment elke dag
// blokkeren. Gevonden 2026-08-11 bij order 1240 (Kick Govers).

const { verwerkIxlyResultaten } = require('../../google-apps-script/deelnemers/IxlyStatus.gs');

test('een afgeronde order zet ixly_af en ixly_op', () => {
  const rijen = [rij({ code: '1246', naam_kind: 'Jack Korver' })];
  const resultaat = verwerkIxlyResultaten(rijen, [0], {
    '1246': { af: true, completed_at: '2026-08-06', verouderd: false, reden: '' }
  }, '2026-08-11');

  assert.strictEqual(resultaat.rijen[0].ixly_af, true);
  assert.strictEqual(resultaat.rijen[0].ixly_op, '2026-08-06');
  assert.strictEqual(resultaat.bijgewerkt, 1);
  assert.deepStrictEqual(resultaat.fouten, []);
  assert.deepStrictEqual(resultaat.verouderd, []);
});

test('een verouderde referentie komt in verouderd, NIET in fouten', () => {
  const rijen = [rij({ code: '1240', naam_kind: 'Kick Govers', ouder_email: 'e@test.nl', uitgenodigd_op: '2026-08-02' })];
  const resultaat = verwerkIxlyResultaten(rijen, [0], {
    '1240': { af: false, completed_at: '', verouderd: true, reden: 'Verouderde Ixly-referentie voor: Blocks Game' }
  }, '2026-08-11');

  assert.deepStrictEqual(resultaat.fouten, []);
  assert.strictEqual(resultaat.verouderd.length, 1);
  assert.strictEqual(resultaat.verouderd[0].code, '1240');
  assert.strictEqual(resultaat.verouderd[0].naam_kind, 'Kick Govers');
  assert.match(resultaat.verouderd[0].reden, /Blocks Game/);
  assert.strictEqual(resultaat.rijen[0].ixly_af, false);
});

test('een echte Ixly-fout komt wél in fouten', () => {
  const rijen = [rij({ code: '999' })];
  const resultaat = verwerkIxlyResultaten(rijen, [0], {
    '999': { af: false, completed_at: '', fout: 'Ixly-fout 500' }
  }, '2026-08-11');

  assert.strictEqual(resultaat.fouten.length, 1);
  assert.match(resultaat.fouten[0], /999/);
  assert.deepStrictEqual(resultaat.verouderd, []);
});

test('elke gecontroleerde rij krijgt de controledatum, ook bij verouderd of fout', () => {
  const rijen = [rij({ code: 'a' }), rij({ code: 'b' }), rij({ code: 'c' })];
  const resultaat = verwerkIxlyResultaten(rijen, [0, 1, 2], {
    'a': { af: true, completed_at: '2026-08-06' },
    'b': { af: false, verouderd: true, reden: 'weg' },
    'c': { af: false, fout: 'Ixly-fout 500' }
  }, '2026-08-11');

  resultaat.rijen.forEach(function (r) {
    assert.strictEqual(r.ixly_laatste_gecontroleerd_op, '2026-08-11');
  });
});

test('een rij zonder resultaat krijgt alleen de controledatum', () => {
  const rijen = [rij({ code: 'zonder' })];
  const resultaat = verwerkIxlyResultaten(rijen, [0], {}, '2026-08-11');

  assert.strictEqual(resultaat.rijen[0].ixly_laatste_gecontroleerd_op, '2026-08-11');
  assert.strictEqual(resultaat.rijen[0].ixly_af, false);
  assert.strictEqual(resultaat.bijgewerkt, 0);
  assert.deepStrictEqual(resultaat.verouderd, []);
});
