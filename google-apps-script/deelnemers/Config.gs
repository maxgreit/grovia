/**
 * Leest instellingen uit de Script Properties en het Config-tabblad.
 *
 * Secrets staan in de Script Properties, nooit in een cel: het werkboek is deelbaar.
 */

/**
 * @return {Object} de instellingen en de mappingtabellen
 */
function leesConfig() {
  const tab = SpreadsheetApp.getActive().getSheetByName('Config');
  if (!tab) {
    throw new Error('Tabblad "Config" niet gevonden.');
  }

  const instellingen = {};
  tab.getRange('A2:B20').getValues().forEach(function (rij) {
    if (rij[0]) {
      instellingen[String(rij[0]).trim()] = rij[1];
    }
  });

  return {
    startdatum:         _alsDatum(instellingen.startdatum),
    ixly_batch_per_run: Number(instellingen.ixly_batch_per_run) || 50,
    max_mails_per_run:  Number(instellingen.max_mails_per_run) || 25,
    testmodus:          String(instellingen.testmodus).toUpperCase() === 'JA',
    testmodus_adres:    String(instellingen.testmodus_adres || ''),
    reminder_dagen:     String(instellingen.reminder_dagen || '7,14,21,35,49')
                          .split(',')
                          .map(function (d) { return Number(String(d).trim()); })
                          .filter(function (d) { return d > 0; }),
    mapping: {
      scholen:     _leesPaar(tab, 'D2:E30'),
      fases:       _leesPaar(tab, 'G2:H30'),
      uitgesloten: _leesKolom(tab, 'J2:J30')
    }
  };
}

/**
 * @return {Object} Script Properties met de sleutels en endpoint-URLs
 */
function leesGeheimen() {
  const props = PropertiesService.getScriptProperties();
  return {
    woo_basis_url:      props.getProperty('WOO_BASIS_URL') || '',
    woo_key:            props.getProperty('WOO_CONSUMER_KEY') || '',
    woo_secret:         props.getProperty('WOO_CONSUMER_SECRET') || '',
    ixly_status_url:    props.getProperty('IXLY_STATUS_URL') || '',
    herinnering_url:    props.getProperty('GROVIA_HERINNERING_URL') || ''
  };
}

function _alsDatum(waarde) {
  if (waarde instanceof Date) {
    return Utilities.formatDate(waarde, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(waarde || '');
}

function _leesPaar(tab, bereik) {
  const resultaat = {};
  tab.getRange(bereik).getValues().forEach(function (rij) {
    if (rij[0] && rij[1]) {
      resultaat[String(rij[0]).trim()] = String(rij[1]).trim();
    }
  });
  return resultaat;
}

function _leesKolom(tab, bereik) {
  return tab.getRange(bereik).getValues()
    .map(function (rij) { return String(rij[0]).trim(); })
    .filter(function (waarde) { return waarde !== ''; });
}
