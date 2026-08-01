/**
 * Tests voor de reminder-beslislogica.
 * Gebruik: node --test "tests/gs/*.test.js"
 */
const test = require('node:test');
const assert = require('node:assert');
const { bepaalReminders } = require('../../google-apps-script/deelnemers/Reminders.gs');

const CONFIG = {
  reminder_dagen: [7, 14, 21, 35, 49],
  startdatum: '2026-08-01',
  max_mails_per_run: 25
};

function rij(overschrijf) {
  return Object.assign({
    seizoen: '2526', naam_slug: 'freddie-rood', naam_kind: 'Freddie Rood',
    vereniging: 'KA', ouder_email: 'max@test.nl', code: '935',
    uitgenodigd_op: '2026-08-01',
    action_type_af: false, ixly_af: false,
    // Default gevuld zodat bestaande "ixly staat open"-tests blijven werken; zet
    // expliciet op [] in een test die het ontbreken van ixly_taken bewijst.
    ixly_taken: [{ naam: 'Blocks Game', assignment_uuid: 'assign-1' }],
    reminders_verzonden: 0, laatste_reminder_op: '', laatste_poging_op: ''
  }, overschrijf);
}

test('zes dagen open geeft nog geen reminder', () => {
  const { teVersturen } = bepaalReminders([rij()], '2026-08-07', CONFIG);
  assert.strictEqual(teVersturen.length, 0);
});

test('zeven dagen open geeft de eerste reminder', () => {
  const { teVersturen } = bepaalReminders([rij()], '2026-08-08', CONFIG);
  assert.strictEqual(teVersturen.length, 1);
  assert.strictEqual(teVersturen[0].drempel, 7);
});

test('beide testen open noemt beide', () => {
  const { teVersturen } = bepaalReminders([rij()], '2026-08-08', CONFIG);
  assert.deepStrictEqual(teVersturen[0].open_testen, ['action_type', 'ixly']);
});

test('alleen ixly open noemt alleen ixly', () => {
  const { teVersturen } = bepaalReminders([rij({ action_type_af: true })], '2026-08-08', CONFIG);
  assert.deepStrictEqual(teVersturen[0].open_testen, ['ixly']);
});

test('alles afgerond geeft geen reminder', () => {
  const klaar = rij({ action_type_af: true, ixly_af: true });
  const { teVersturen } = bepaalReminders([klaar], '2026-10-01', CONFIG);
  assert.strictEqual(teVersturen.length, 0);
});

test('vijf reminders verzonden is het maximum', () => {
  const vol = rij({ reminders_verzonden: 5, laatste_reminder_op: '2026-09-19' });
  const { teVersturen } = bepaalReminders([vol], '2026-12-01', CONFIG);
  assert.strictEqual(teVersturen.length, 0);
});

test('tweede reminder pas bij veertien dagen', () => {
  const na_een = rij({ reminders_verzonden: 1, laatste_reminder_op: '2026-08-08' });
  assert.strictEqual(bepaalReminders([na_een], '2026-08-14', CONFIG).teVersturen.length, 0);
  assert.strictEqual(bepaalReminders([na_een], '2026-08-15', CONFIG).teVersturen.length, 1);
});

test('geen tweede mail op dezelfde dag', () => {
  const vandaag = rij({
    reminders_verzonden: 0,
    uitgenodigd_op: '2026-08-01',
    laatste_reminder_op: '2026-08-10',
  });
  const { teVersturen } = bepaalReminders([vandaag], '2026-08-10', CONFIG);
  assert.strictEqual(teVersturen.length, 0);
});

test('mislukte poging vandaag wordt niet opnieuw geprobeerd', () => {
  const gefaald = rij({ laatste_poging_op: '2026-08-08' });
  const { teVersturen } = bepaalReminders([gefaald], '2026-08-08', CONFIG);
  assert.strictEqual(teVersturen.length, 0);
});

test('mislukte poging gisteren wordt opnieuw geprobeerd', () => {
  // Correctie op bevinding 2: het 2-dagen-venster geldt ALLEEN voor laatste_reminder_op
  // (een geslaagde verzending). laatste_poging_op (een mislukking) blijft same-day-only,
  // zodat de "probeer het morgen opnieuw"-logica uit Task 10 intact blijft.
  const gefaald = rij({ laatste_poging_op: '2026-08-08' });
  const { teVersturen } = bepaalReminders([gefaald], '2026-08-09', CONFIG);
  assert.strictEqual(teVersturen.length, 1);
});

test('handmatige reminder van GISTEREN blokkeert de automatische run nog steeds', () => {
  // Scenario bevinding 2: drempel (dag 20) is al voorbij, Max stuurt handmatig op dag 20
  // (laatste_reminder_op = 2026-08-20). Dag 21 mag de automatische run nog niet sturen --
  // er moet minimaal één volle dag tussen twee berichten zitten.
  const netGehad = rij({
    reminders_verzonden: 1,
    uitgenodigd_op: '2026-08-01',
    laatste_reminder_op: '2026-08-20',
  });
  const { teVersturen } = bepaalReminders([netGehad], '2026-08-21', CONFIG);
  assert.strictEqual(teVersturen.length, 0);
});

test('handmatige reminder van EERGISTEREN blokkeert de automatische run niet meer', () => {
  const tweeDagenGeleden = rij({
    reminders_verzonden: 1,
    uitgenodigd_op: '2026-08-01',
    laatste_reminder_op: '2026-08-20',
  });
  const { teVersturen } = bepaalReminders([tweeDagenGeleden], '2026-08-22', CONFIG);
  assert.strictEqual(teVersturen.length, 1);
});

test('het 2-dagen-venster geldt alleen voor laatste_reminder_op, niet voor laatste_poging_op', () => {
  // Isoleert de scope van de correctie: een GESLAAGDE reminder van gisteren blokkeert nog
  // (2-dagen-venster via _recentBericht), maar een MISLUKTE poging van gisteren blokkeert
  // niet meer (exacte-dag-vergelijking, ongewijzigd). Zelfde "gisteren"-afstand, ander
  // veld, ander resultaat -- dat bewijst dat het venster niet per ongeluk ook op
  // laatste_poging_op is blijven hangen.
  const viaReminder = rij({
    reminders_verzonden: 1, uitgenodigd_op: '2026-08-01', laatste_reminder_op: '2026-08-20',
  });
  const viaPoging = rij({
    reminders_verzonden: 1, uitgenodigd_op: '2026-08-01', laatste_poging_op: '2026-08-20',
  });

  assert.strictEqual(bepaalReminders([viaReminder], '2026-08-21', CONFIG).teVersturen.length, 0);
  assert.strictEqual(bepaalReminders([viaPoging], '2026-08-21', CONFIG).teVersturen.length, 1);
});

test('uitnodiging van voor de startdatum krijgt nooit automatisch', () => {
  const oud = rij({ uitgenodigd_op: '2026-07-01' });
  const { teVersturen } = bepaalReminders([oud], '2026-10-01', CONFIG);
  assert.strictEqual(teVersturen.length, 0);
});

test('bovengrens kapt af en meldt hoeveel', () => {
  const veel = [];
  for (let i = 0; i < 30; i += 1) {
    veel.push(rij({ naam_slug: 'kind-' + i, code: String(1000 + i) }));
  }
  const { teVersturen, afgekapt } = bepaalReminders(veel, '2026-08-08', CONFIG);
  assert.strictEqual(teVersturen.length, 25);
  assert.strictEqual(afgekapt, 5);
});

test('rij zonder e-mailadres wordt overgeslagen', () => {
  const { teVersturen } = bepaalReminders([rij({ ouder_email: '' })], '2026-08-08', CONFIG);
  assert.strictEqual(teVersturen.length, 0);
});

test('rij zonder uitnodigingsdatum wordt overgeslagen', () => {
  const { teVersturen } = bepaalReminders([rij({ uitgenodigd_op: '' })], '2026-08-08', CONFIG);
  assert.strictEqual(teVersturen.length, 0);
});

test('bevinding 3: rij zonder ixly_taken krijgt nooit ixly in open_testen', () => {
  // Legacy-rij van vóór de assignment-uuid-fix, of een order waarvan de order-meta
  // nog niet is aangekomen -- dan is er niets te automatiseren, dus 'ixly' hoort
  // niet in open_testen ook al staat ixly_af nog op false.
  const zonderTaken = rij({ ixly_taken: [] });
  const { teVersturen } = bepaalReminders([zonderTaken], '2026-08-08', CONFIG);
  assert.strictEqual(teVersturen.length, 1);
  assert.deepStrictEqual(teVersturen[0].open_testen, ['action_type']);
});
