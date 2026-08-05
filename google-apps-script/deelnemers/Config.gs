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
    // ixly_batch_per_run moet ALTIJD <= MAX_ORDERS_PER_AANROEP (100, in
    // ixly-status/__init__.py) blijven -- anders geeft de Azure Function een HTTP 400
    // en faalt werkIxlyBij met een exception, wat via de dataBetrouwbaar-regel ALLE
    // reminders die dag blokkeert (bevinding 9).
    ixly_batch_per_run: Number(instellingen.ixly_batch_per_run) || 50,
    max_mails_per_run:  Number(instellingen.max_mails_per_run) || 25,
    testmodus:          String(instellingen.testmodus).toUpperCase() === 'JA',
    testmodus_adres:    String(instellingen.testmodus_adres || ''),
    reminder_dagen:     String(instellingen.reminder_dagen || '7,14,21,35,49')
                          .split(',')
                          .map(function (d) { return Number(String(d).trim()); })
                          .filter(function (d) { return d > 0; }),
    // Fallback-startdatum voor de allereerste WooCommerce-ingest (als het Deelnemers-
    // tabblad nog helemaal leeg is). Hoort in Config, niet hardcoded in Dagelijks.gs --
    // zie bevinding 6. Default in code (vandaag) als de cel leeg is.
    sinds_fallback:     _alsDatum(instellingen.sinds_fallback) || _vandaagAlsDatum(),
    mapping: {
      scholen:     _leesPaar(tab, 'D2:E30'),
      fases:       _leesPaar(tab, 'G2:H30'),
      uitgesloten: _leesKolom(tab, 'J2:J30'),
      // Categorie-slug -> 'Speler'/'Keeper', zelfde vorm als scholen hierboven.
      // Losse kolommen L:M, want fases (G:H) betekent hier iets anders
      // (trainingscyclus/seizoenkaarttype, niet speelpositie).
      rollen:      _leesPaar(tab, 'L2:M30')
    },
    // Per MiniMove-cyclus de 8 echte trainingsdata, één keer per seizoen door Berry
    // in te vullen (kolommen O:W, rij 1 t/m 4 = cyclus 1 t/m 4, cyclusnummer in
    // kolom O). Alleen gebruikt voor de kolomkoppen in "MiniMove Aanwezigheid" --
    // geen invloed op welke aankopen herkend worden, dat gebeurt puur op de
    // 'pa_inschrijving'-slug (zie MiniMove.gs).
    minimove_kalender: _leesMiniMoveKalender(tab, 'O1:W4')
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

function _vandaagAlsDatum() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
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

/**
 * Leest een blok van 'cyclus + 8 datums' per rij.
 *
 * @param {Sheet} tab
 * @param {string} bereik bijv. 'O2:W5' -- kolom 1 is de cyclus ('1'..'4'), kolom
 *   2 t/m 9 zijn de 8 trainingsdata van die cyclus
 * @return {Object} cyclus ('1'..'4') -> array van 8 'yyyy-MM-dd'-datumstrings
 */
function _leesMiniMoveKalender(tab, bereik) {
  const resultaat = {};
  tab.getRange(bereik).getValues().forEach(function (rij) {
    const cyclus = String(rij[0] || '').trim();
    if (!cyclus) {
      return;
    }
    resultaat[cyclus] = rij.slice(1).map(_alsDatum);
  });
  return resultaat;
}
