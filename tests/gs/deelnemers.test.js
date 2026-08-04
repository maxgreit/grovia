/**
 * Tests voor de pure upsert-logica.
 * Gebruik: node --test tests/gs/
 */
const test = require('node:test');
const assert = require('node:assert');
const { parseIxlyTaken } = require('../../google-apps-script/deelnemers/Sheet.gs');
global.parseIxlyTaken = parseIxlyTaken;
const { upsertDeelnemers } = require('../../google-apps-script/deelnemers/Deelnemers.gs');

const MAPPING = {
  scholen: { 'kolping-academie': 'KA', 'schagen-united': 'SU', 'minimove': 'MM' },
  fases: { 'cyclus-1': 'C1', 'cyclus-2': 'C2' },
  uitgesloten: ['evenement', 'proef-training'],
  rollen: { 'voetbaltraining': 'Speler', 'keeperstraining': 'Keeper' }
};

function order(overschrijf) {
  return Object.assign({
    order_id: '935',
    datum: '2026-08-01',
    naam_kind: 'Freddie Rood',
    ouder_naam: 'Max Rood',
    ouder_email: 'max@test.nl',
    categorieen: ['kolping-academie', 'voetbaltraining'],
    fase: 'cyclus-1',
    product: 'Voetbaltraining - Kolping Academie',
    bedrag: 160
  }, overschrijf);
}

test('nieuwe order geeft een nieuwe rij', () => {
  const { rijen } = upsertDeelnemers([], [order()], MAPPING);
  assert.strictEqual(rijen.length, 1);
  assert.strictEqual(rijen[0].naam_slug, 'freddie-rood');
  assert.strictEqual(rijen[0].vereniging, 'KA');
  assert.strictEqual(rijen[0].code, '935');
  // De default-datum van order() is '2026-08-01' — dat valt volgens bepaalSeizoen()
  // (bevestigd door de test "seizoen kantelt in augustus" hieronder) in seizoen
  // 2026/2027 ('2627'), niet '2526'. De brief gaf hier '2526' op, wat in strijd is
  // met diezelfde bepaalSeizoen()-logica bij hetzelfde datum-input. Gecorrigeerd
  // naar '2627' zodat de tests onderling consistent zijn; zie rapport voor detail.
  assert.strictEqual(rijen[0].seizoen, '2627');
});

test('rol/product/bedrag komen van de order', () => {
  const { rijen } = upsertDeelnemers([], [order()], MAPPING);
  assert.strictEqual(rijen[0].rol, 'Speler');
  assert.strictEqual(rijen[0].product, 'Voetbaltraining - Kolping Academie');
  assert.strictEqual(rijen[0].bedrag, 160);
});

test('keeperstraining-categorie geeft rol Keeper', () => {
  const { rijen } = upsertDeelnemers(
    [],
    [order({ categorieen: ['kolping-academie', 'keeperstraining'] })],
    MAPPING
  );
  assert.strictEqual(rijen[0].rol, 'Keeper');
});

test('onbekende rol-categorie laat rol leeg', () => {
  const { rijen } = upsertDeelnemers(
    [],
    [order({ categorieen: ['kolping-academie'] })],
    MAPPING
  );
  assert.strictEqual(rijen[0].rol, '');
});

test('product/bedrag/rol volgen de eerste order, niet een latere', () => {
  const eerste = upsertDeelnemers([], [order({ datum: '2026-08-01' })], MAPPING).rijen;
  const { rijen } = upsertDeelnemers(
    eerste,
    [order({
      order_id: '941', datum: '2026-09-01',
      categorieen: ['kolping-academie', 'keeperstraining'],
      product: 'Keeperstraining - Kolping Academie', bedrag: 555
    })],
    MAPPING
  );

  assert.strictEqual(rijen[0].product, 'Voetbaltraining - Kolping Academie');
  assert.strictEqual(rijen[0].bedrag, 160);
  assert.strictEqual(rijen[0].rol, 'Speler');
});

test('een eerdere order (terugwerkend) werkt product/bedrag/rol wél bij', () => {
  const eerste = upsertDeelnemers([], [order({ datum: '2026-08-15' })], MAPPING).rijen;
  const { rijen } = upsertDeelnemers(
    eerste,
    [order({
      order_id: '941', datum: '2026-08-01',
      categorieen: ['kolping-academie', 'keeperstraining'],
      product: 'Keeperstraining - Kolping Academie', bedrag: 555
    })],
    MAPPING
  );

  assert.strictEqual(rijen[0].product, 'Keeperstraining - Kolping Academie');
  assert.strictEqual(rijen[0].bedrag, 555);
  assert.strictEqual(rijen[0].rol, 'Keeper');
  assert.strictEqual(rijen[0].uitgenodigd_op, '2026-08-01');
});

test('tweede order van hetzelfde kind komt bij order_ids, geen nieuwe rij', () => {
  const eerste = upsertDeelnemers([], [order()], MAPPING).rijen;
  const { rijen } = upsertDeelnemers(eerste, [order({ order_id: '941', datum: '2026-09-01' })], MAPPING);

  assert.strictEqual(rijen.length, 1);
  assert.deepStrictEqual(rijen[0].order_ids, ['935', '941']);
});

test('code blijft het laagste order_id', () => {
  const eerste = upsertDeelnemers([], [order({ order_id: '941' })], MAPPING).rijen;
  const { rijen } = upsertDeelnemers(eerste, [order({ order_id: '935' })], MAPPING);

  assert.strictEqual(rijen[0].code, '935');
});

test('uitgenodigd_op blijft de datum van de eerste order', () => {
  const eerste = upsertDeelnemers([], [order({ datum: '2026-08-01' })], MAPPING).rijen;
  const { rijen } = upsertDeelnemers(eerste, [order({ order_id: '941', datum: '2026-09-01' })], MAPPING);

  assert.strictEqual(rijen[0].uitgenodigd_op, '2026-08-01');
});

test('bestaande afrondingsstatus wordt niet overschreven', () => {
  const bestaand = upsertDeelnemers([], [order()], MAPPING).rijen;
  bestaand[0].action_type_af = true;
  bestaand[0].action_type = 'ISTJ';

  const { rijen } = upsertDeelnemers(bestaand, [order()], MAPPING);

  assert.strictEqual(rijen[0].action_type_af, true);
  assert.strictEqual(rijen[0].action_type, 'ISTJ');
});

test('minimove wordt overgeslagen', () => {
  const { rijen } = upsertDeelnemers([], [order({ categorieen: ['minimove', 'voetbaltraining'] })], MAPPING);
  assert.strictEqual(rijen.length, 0);
});

test('uitgesloten categorie wordt overgeslagen', () => {
  const { rijen } = upsertDeelnemers([], [order({ categorieen: ['kolping-academie', 'evenement'] })], MAPPING);
  assert.strictEqual(rijen.length, 0);
});

test('order zonder naam kind gaat naar controleren', () => {
  const { rijen, controleren } = upsertDeelnemers([], [order({ naam_kind: '' })], MAPPING);
  assert.strictEqual(rijen.length, 0);
  assert.strictEqual(controleren.length, 1);
  assert.strictEqual(controleren[0].order_id, '935');
});

test('order zonder bekende vereniging gaat naar controleren', () => {
  const { rijen, controleren } = upsertDeelnemers([], [order({ categorieen: ['iets-anders'] })], MAPPING);
  assert.strictEqual(rijen.length, 0);
  assert.strictEqual(controleren.length, 1);
});

test('seizoen kantelt in augustus', () => {
  const juli = upsertDeelnemers([], [order({ datum: '2026-07-31' })], MAPPING).rijen;
  const augustus = upsertDeelnemers([], [order({ datum: '2026-08-01' })], MAPPING).rijen;

  assert.strictEqual(juli[0].seizoen, '2526');
  assert.strictEqual(augustus[0].seizoen, '2627');
});

test('nieuwe rij heeft ixly_laatste_gecontroleerd_op leeg', () => {
  // Bevinding 3: leeg = nog nooit gecontroleerd, dus hoogste prioriteit bij de
  // eerstvolgende Ixly-batch (kiesTeControlerenIndexen in IxlyStatus.gs).
  const { rijen } = upsertDeelnemers([], [order()], MAPPING);
  assert.strictEqual(rijen[0].ixly_laatste_gecontroleerd_op, '');
});

test('hetzelfde kind in een ander seizoen geeft een nieuwe rij', () => {
  const eerste = upsertDeelnemers([], [order({ datum: '2026-07-01' })], MAPPING).rijen;
  const { rijen } = upsertDeelnemers(eerste, [order({ order_id: '941', datum: '2026-09-01' })], MAPPING);

  assert.strictEqual(rijen.length, 2);
});

test('nieuwe order zet ixly_taken op basis van de order-meta', () => {
  const { rijen } = upsertDeelnemers([], [order({ ixly_taken: 'Blocks Game:39e7,Rally Game:8a4f' })], MAPPING);
  assert.deepStrictEqual(rijen[0].ixly_taken, [
    { naam: 'Blocks Game', assignment_uuid: '39e7' },
    { naam: 'Rally Game', assignment_uuid: '8a4f' }
  ]);
});

test('order zonder ixly_taken geeft een lege array', () => {
  const { rijen } = upsertDeelnemers([], [order()], MAPPING);
  assert.deepStrictEqual(rijen[0].ixly_taken, []);
});

test('bevinding 2: vervolgorder met ixly_taken vult een bestaande lege rij bij', () => {
  const eerste = upsertDeelnemers([], [order()], MAPPING).rijen;
  assert.deepStrictEqual(eerste[0].ixly_taken, []);

  const { rijen } = upsertDeelnemers(
    eerste,
    [order({ order_id: '941', ixly_taken: 'Blocks Game:39e7,Rally Game:8a4f' })],
    MAPPING
  );

  assert.deepStrictEqual(rijen[0].ixly_taken, [
    { naam: 'Blocks Game', assignment_uuid: '39e7' },
    { naam: 'Rally Game', assignment_uuid: '8a4f' }
  ]);
});

test('bevinding 2: een al gevulde ixly_taken wordt niet overschreven door een andere order', () => {
  const eerste = upsertDeelnemers(
    [],
    [order({ ixly_taken: 'Blocks Game:oorspronkelijk-uuid' })],
    MAPPING
  ).rijen;
  assert.deepStrictEqual(eerste[0].ixly_taken, [
    { naam: 'Blocks Game', assignment_uuid: 'oorspronkelijk-uuid' }
  ]);

  const { rijen } = upsertDeelnemers(
    eerste,
    [order({ order_id: '941', ixly_taken: 'Blocks Game:ander-uuid' })],
    MAPPING
  );

  assert.deepStrictEqual(rijen[0].ixly_taken, [
    { naam: 'Blocks Game', assignment_uuid: 'oorspronkelijk-uuid' }
  ]);
});
