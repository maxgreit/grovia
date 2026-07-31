/**
 * Bouwt het Dashboard-tabblad op uit de deelnemersrijen.
 *
 * Bewust berekend in het script en niet met formules: de Deelnemers-tab moet een
 * platte tabel blijven die later één-op-één naar Azure SQL migreert.
 */

/**
 * @param {Object[]} rijen deelnemersrijen
 */
function bouwDashboard(rijen) {
  const tab = SpreadsheetApp.getActive().getSheetByName('Dashboard');
  if (!tab) {
    throw new Error('Tabblad "Dashboard" niet gevonden.');
  }

  tab.clear();

  const verenigingen = ['KA', 'SU'];
  const koppen = ['vereniging', 'uitgenodigd', 'action type af', 'ixly af', 'beide af',
                  'niets gedaan', 'gem. dagen action type', 'gem. dagen ixly', 'reminders verzonden'];
  const regels = [koppen];

  verenigingen.forEach(function (vereniging) {
    const eigen = rijen.filter(function (r) { return r.vereniging === vereniging; });

    regels.push([
      vereniging,
      eigen.length,
      eigen.filter(function (r) { return r.action_type_af; }).length,
      eigen.filter(function (r) { return r.ixly_af; }).length,
      eigen.filter(function (r) { return r.action_type_af && r.ixly_af; }).length,
      eigen.filter(function (r) { return !r.action_type_af && !r.ixly_af; }).length,
      _gemiddeldeDagen(eigen, 'action_type_op'),
      _gemiddeldeDagen(eigen, 'ixly_op'),
      eigen.reduce(function (som, r) { return som + r.reminders_verzonden; }, 0)
    ]);
  });

  tab.getRange(1, 1, regels.length, koppen.length).setValues(regels);
  tab.getRange(1, 1, 1, koppen.length).setFontWeight('bold');

  // Openstaande gevallen, langst wachtend bovenaan.
  const vandaag = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const open = rijen
    .filter(function (r) { return !(r.action_type_af && r.ixly_af) && r.uitgenodigd_op; })
    .map(function (r) {
      const ontbreekt = [];
      if (!r.action_type_af) {
        ontbreekt.push('Action Type');
      }
      if (!r.ixly_af) {
        ontbreekt.push('Ixly');
      }
      return [
        r.naam_kind, r.vereniging, r.ouder_email, r.uitgenodigd_op,
        _dagen(r.uitgenodigd_op, vandaag), ontbreekt.join(' + '),
        r.reminders_verzonden, r.laatste_reminder_op
      ];
    })
    .sort(function (a, b) { return b[4] - a[4]; });

  const startRij = regels.length + 2;
  const openKoppen = ['naam kind', 'vereniging', 'ouder e-mail', 'uitgenodigd op',
                      'dagen open', 'ontbreekt', 'reminders', 'laatste reminder'];

  tab.getRange(startRij, 1, 1, openKoppen.length).setValues([openKoppen]).setFontWeight('bold');
  if (open.length) {
    tab.getRange(startRij + 1, 1, open.length, openKoppen.length).setValues(open);
  }

  tab.getRange(startRij - 1, 1).setValue('Openstaand (' + open.length + ')').setFontWeight('bold');
}

/**
 * Gemiddeld aantal dagen tussen uitnodiging en afronding, alleen over wie afgerond heeft.
 *
 * Per test apart: een uur gamen en tien minuten formulier invullen bij elkaar optellen
 * zegt niets.
 */
function _gemiddeldeDagen(rijen, kolom) {
  const dagen = rijen
    .filter(function (r) { return r[kolom] && r.uitgenodigd_op; })
    .map(function (r) { return _dagen(r.uitgenodigd_op, r[kolom]); })
    .filter(function (d) { return d >= 0; });

  if (!dagen.length) {
    return '';
  }

  const som = dagen.reduce(function (a, b) { return a + b; }, 0);
  return Math.round((som / dagen.length) * 10) / 10;
}

function _dagen(van, tot) {
  const eenDag = 24 * 60 * 60 * 1000;
  return Math.floor((new Date(tot + 'T00:00:00') - new Date(van + 'T00:00:00')) / eenDag);
}
