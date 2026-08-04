/**
 * De enige plek die SpreadsheetApp aanraakt voor het lezen en schrijven van rijen.
 * De kolomvolgorde staat hier, en alleen hier.
 */

const KOLOMMEN = [
  'seizoen', 'naam_slug', 'naam_kind', 'vereniging',
  // Na vereniging ingevoegd (niet achteraan) op verzoek: 'Speler'/'Keeper' (afgeleid
  // uit de WooCommerce-categorie, zie mapping.rollen in Config.gs), de productnaam/
  // namen en het orderbedrag -- allebei van de eerste order. Deze volgorde moet
  // exact overeenkomen met de kolomvolgorde in het werkboek zelf (kolommen invoegen
  // in de Sheet-UI, niet los aan het eind toevoegen).
  'rol', 'product', 'bedrag',
  'ouder_naam', 'ouder_email',
  'order_ids', 'code', 'uitgenodigd_op', 'action_type_af', 'action_type_op',
  'action_type', 'ixly_af', 'ixly_op', 'reminders_verzonden',
  'laatste_reminder_op', 'laatste_poging_op', 'ixly_laatste_gecontroleerd_op',
  // Weer achteraan, zelfde reden als ixly_laatste_gecontroleerd_op hierboven: het
  // werkboek heeft de eerdere kolommen al met ingevulde kopregel. Array
  // {naam, assignment_uuid} per Ixly-taak, bewaard als 'Naam:uuid,Naam:uuid' in de
  // cel. Leeg voor rijen van vóór deze fix -- die blijven permanent handmatig te
  // controleren (kiesTeControlerenIndexen in IxlyStatus.gs sluit ze uit).
  'ixly_taken'
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
    object.bedrag              = Number(object.bedrag) || 0;
    object.ixly_taken = parseIxlyTaken(object.ixly_taken);

    ['uitgenodigd_op', 'action_type_op', 'ixly_op', 'laatste_reminder_op', 'laatste_poging_op',
      'ixly_laatste_gecontroleerd_op']
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
      if (kolom === 'ixly_taken') {
        return serialiseerIxlyTaken(waarde);
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
 * Bouwt de dedup-sleutel voor een regel op basis van de opgegeven kolomindexen.
 *
 * @param {Array} regel
 * @param {number[]} sleutelIndexen
 * @return {string}
 */
function _bouwSleutel(regel, sleutelIndexen) {
  return sleutelIndexen.map(function (i) { return String(regel[i] || '').trim(); }).join('|');
}

/**
 * Zoals _bouwSleutel, maar zet een Date-cel eerst om naar 'yyyy-MM-dd' voordat de sleutel
 * gebouwd wordt. Nodig omdat Google Sheets een datumachtige string (bijv. '2026-07-07')
 * bij het schrijven soms automatisch omzet naar een echte Date-cel -- zonder deze
 * normalisatie zou een TERUGGELEZEN rij (Date-object) nooit meer matchen met de sleutel
 * van een NIEUWE kandidaat-regel (nog een gewone string), met als gevolg dat
 * voegNieuweToe() dezelfde regel bij elke run opnieuw zou toevoegen.
 *
 * Gebruikt de LOKALE (niet-UTC) datumonderdelen: Apps Script's V8-runtime heeft als
 * standaard tijdzone al Session.getScriptTimeZone(), dus getFullYear()/getMonth()/
 * getDate() geven daar meteen de juiste lokale datum terug -- net als _alsDatumTekst
 * elders in dit bestand, maar zonder de Apps Script-specifieke Utilities-aanroep, zodat
 * deze functie ook puur en met `node --test` te toetsen blijft.
 *
 * @param {Array} regel
 * @param {number[]} sleutelIndexen
 * @return {string}
 */
function _genormaliseerdeSleutel(regel, sleutelIndexen) {
  const genormaliseerd = regel.map(function (waarde) {
    if (!(waarde instanceof Date)) {
      return waarde;
    }
    const jaar  = waarde.getFullYear();
    const maand = String(waarde.getMonth() + 1).padStart(2, '0');
    const dag   = String(waarde.getDate()).padStart(2, '0');
    return jaar + '-' + maand + '-' + dag;
  });
  return _bouwSleutel(genormaliseerd, sleutelIndexen);
}

/**
 * Parseert de ixly_taken-celwaarde ('Naam:uuid,Naam:uuid') naar een array objecten.
 *
 * @param {string} tekst
 * @return {{naam: string, assignment_uuid: string}[]}
 */
function parseIxlyTaken(tekst) {
  return String(tekst || '').split(',').filter(String).map(function (paar) {
    var deel = paar.split(':');
    return { naam: deel[0], assignment_uuid: deel.slice(1).join(':') };
  });
}

/**
 * Serialiseert een array {naam, assignment_uuid} terug naar de celwaarde-vorm.
 *
 * @param {{naam: string, assignment_uuid: string}[]} taken
 * @return {string}
 */
function serialiseerIxlyTaken(taken) {
  return (taken || []).map(function (t) { return t.naam + ':' + t.assignment_uuid; }).join(',');
}

/**
 * Voegt alleen regels toe aan een lijst-tabblad die er nog niet in staan, op basis van
 * een samengestelde sleutel. Voorkomt dat "Handmatig koppelen" en "Controleren" elke
 * dagelijkse run dezelfde oude, nog niet opgeloste meldingen blijven herhalen.
 *
 * @param {string} naam tabbladnaam
 * @param {Array[]} regels rijen als arrays, ZONDER het tijdstip -- dat voegt deze functie zelf toe als eerste kolom
 * @param {number[]} sleutelIndexen indexen (0-based, binnen elke regel in `regels`) die samen de dedup-sleutel vormen
 */
function voegNieuweToe(naam, regels, sleutelIndexen) {
  if (!regels.length) {
    return;
  }

  const tab = _tab(naam);
  const bestaandeSleutels = {};

  if (tab.getLastRow() > 1) {
    // Kolom A is het tijdstip dat deze functie zelf toevoegt; de sleutelIndexen tellen
    // vanaf kolom B (index 0 in `regels` = kolom B in de sheet, dus +1 hier).
    const aantalKolommen = 1 + regels[0].length;
    tab.getRange(2, 1, tab.getLastRow() - 1, aantalKolommen).getValues().forEach(function (bestaandeRij) {
      const sleutel = _genormaliseerdeSleutel(bestaandeRij, sleutelIndexen.map(function (i) { return i + 1; }));
      bestaandeSleutels[sleutel] = true;
    });
  }

  const nieuw = regels.filter(function (regel) {
    return !bestaandeSleutels[_genormaliseerdeSleutel(regel, sleutelIndexen)];
  });

  if (!nieuw.length) {
    return;
  }

  const metTijdstip = nieuw.map(function (regel) { return [new Date()].concat(regel); });
  tab.getRange(tab.getLastRow() + 1, 1, metTijdstip.length, metTijdstip[0].length).setValues(metTijdstip);
}

/**
 * Schrijft een regel in het Log-tabblad.
 *
 * @param {string} soort 'reminder-automatisch', 'reminder-handmatig', 'uitnodiging-handmatig' of 'fout'
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

// Alleen voor `node --test`; Apps Script kent `module` niet en slaat dit over.
if (typeof module !== 'undefined') {
  module.exports = {
    _bouwSleutel: _bouwSleutel,
    _genormaliseerdeSleutel: _genormaliseerdeSleutel,
    parseIxlyTaken: parseIxlyTaken,
    serialiseerIxlyTaken: serialiseerIxlyTaken
  };
}
