/**
 * De enige plek die SpreadsheetApp aanraakt voor het lezen en schrijven van rijen.
 * De kolomvolgorde staat hier, en alleen hier.
 */

const KOLOMMEN = [
  'seizoen', 'naam_slug', 'naam_kind', 'vereniging', 'ouder_naam', 'ouder_email',
  'order_ids', 'code', 'uitgenodigd_op', 'action_type_af', 'action_type_op',
  'action_type', 'ixly_af', 'ixly_op', 'reminders_verzonden',
  'laatste_reminder_op', 'laatste_poging_op'
];

/**
 * @return {Object[]} alle deelnemersrijen als platte objecten
 */
function leesDeelnemers() {
  const tab = _tab('Deelnemers');
  const laatste = tab.getLastRow();
  if (laatste < 2) {
    return [];
  }

  return tab.getRange(2, 1, laatste - 1, KOLOMMEN.length).getValues().map(function (rij) {
    const object = {};
    KOLOMMEN.forEach(function (kolom, i) {
      object[kolom] = rij[i];
    });

    object.order_ids           = String(object.order_ids || '').split(',').filter(String);
    object.action_type_af      = object.action_type_af === true || String(object.action_type_af).toUpperCase() === 'JA';
    object.ixly_af             = object.ixly_af === true || String(object.ixly_af).toUpperCase() === 'JA';
    object.reminders_verzonden = Number(object.reminders_verzonden) || 0;

    ['uitgenodigd_op', 'action_type_op', 'ixly_op', 'laatste_reminder_op', 'laatste_poging_op']
      .forEach(function (kolom) {
        object[kolom] = _alsDatumTekst(object[kolom]);
      });

    return object;
  });
}

/**
 * Schrijft alle rijen in één keer weg. Overschrijft het hele databereik.
 *
 * @param {Object[]} rijen
 */
function schrijfDeelnemers(rijen) {
  const tab = _tab('Deelnemers');

  if (tab.getLastRow() > 1) {
    tab.getRange(2, 1, tab.getLastRow() - 1, KOLOMMEN.length).clearContent();
  }
  if (!rijen.length) {
    return;
  }

  const waarden = rijen.map(function (rij) {
    return KOLOMMEN.map(function (kolom) {
      const waarde = rij[kolom];
      if (kolom === 'order_ids') {
        return waarde.join(',');
      }
      if (kolom === 'action_type_af' || kolom === 'ixly_af') {
        return waarde ? 'JA' : 'NEE';
      }
      return waarde;
    });
  });

  tab.getRange(2, 1, waarden.length, KOLOMMEN.length).setValues(waarden);
}

/**
 * Voegt regels toe aan een lijst-tabblad zonder bestaande inhoud te wissen.
 *
 * @param {string} naam tabbladnaam
 * @param {Array[]} regels rijen als arrays
 */
function voegToe(naam, regels) {
  if (!regels.length) {
    return;
  }
  const tab = _tab(naam);
  tab.getRange(tab.getLastRow() + 1, 1, regels.length, regels[0].length).setValues(regels);
}

/**
 * Schrijft een regel in het Log-tabblad.
 *
 * @param {string} soort 'reminder-automatisch', 'reminder-handmatig', 'uitnodiging', 'fout'
 * @param {Object} rij de deelnemersrij, of {} bij een algemene fout
 * @param {string} resultaat 'ok' of 'mislukt'
 * @param {string} melding vrije tekst
 */
function logRegel(soort, rij, resultaat, melding) {
  voegToe('Log', [[
    new Date(),
    soort,
    rij.naam_kind || '',
    rij.ouder_email || '',
    (rij.open_testen || []).join(','),
    resultaat,
    melding || ''
  ]]);
}

function _tab(naam) {
  const tab = SpreadsheetApp.getActive().getSheetByName(naam);
  if (!tab) {
    throw new Error('Tabblad "' + naam + '" niet gevonden.');
  }
  return tab;
}

function _alsDatumTekst(waarde) {
  if (waarde instanceof Date) {
    return Utilities.formatDate(waarde, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(waarde || '');
}
