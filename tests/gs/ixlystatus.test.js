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
    ixly_laatste_gecontroleerd_op: ''
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
