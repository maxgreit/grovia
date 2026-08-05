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
  'ixly_taken',
  // Weer achteraan, zelfde reden. Ankerdatum waarvanaf de reminder-drempels geteld
  // worden (Reminders.gs). LEEG = val terug op uitgenodigd_op, dus nieuwe deelnemers
  // werken ongewijzigd. Gevuld = het reminder-schema is bewust herstart vanaf die
  // datum -- nodig voor rijen waarvan de uitnodiging weken oud is, want dan liggen
  // alle drempels in het verleden en zou de rij in een paar dagen alle reminders
  // achter elkaar afvuren. uitgenodigd_op zelf blijft ongemoeid: die wordt ook door
  // het Dashboard (doorlooptijden) en _sindsDatum (sync-venster) gebruikt.
  'reminder_anker'
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

    // Google Sheets zet een puur numerieke tekst-cel ('2526') soms zelf om naar een
    // echte getalcel -- zonder deze coercion faalt elke strikte string-vergelijking
    // tegen seizoen stilletjes (geconstateerd 2026-08-04 in een eenmalig scriptje dat
    // op '2526' vergeleek). De bestaande code raakt dit nooit omdat overal elders
    // `rij.seizoen + '|' + ...` gebruikt wordt, wat impliciet naar tekst omzet.
    object.seizoen              = String(object.seizoen || '');
    object.order_ids           = String(object.order_ids || '').split(',').filter(String);
    object.action_type_af      = object.action_type_af === true || String(object.action_type_af).toUpperCase() === 'JA';
    object.ixly_af             = object.ixly_af === true || String(object.ixly_af).toUpperCase() === 'JA';
    object.reminders_verzonden = Number(object.reminders_verzonden) || 0;
    object.bedrag              = Number(object.bedrag) || 0;
    object.ixly_taken = parseIxlyTaken(object.ixly_taken);

    ['uitgenodigd_op', 'action_type_op', 'ixly_op', 'laatste_reminder_op', 'laatste_poging_op',
      'ixly_laatste_gecontroleerd_op', 'reminder_anker']
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

const FINANCIEEL_KOLOMMEN = [
  'vereniging', 'cyclus', 'inkomsten_incl_btw', 'inkomsten_excl_btw',
  'keepers_cyclusproduct', 'keepers_seizoenkaart', 'keepers_totaal',
  'spelers_cyclusproduct', 'spelers_seizoenkaart', 'spelers_totaal',
  'afdracht_excl_btw'
];

/**
 * Schrijft het Financieel-rapport weg. Overschrijft het hele databereik, zelfde
 * patroon als schrijfDeelnemers -- dit tabblad is een afgeleid rapport, geen
 * bewaarde/handmatig aan te vullen data.
 *
 * @param {Object[]} rijen uit berekenFinancieel() (Financieel.gs)
 */
function schrijfFinancieel(rijen) {
  const tab = _tab('Financieel');

  if (tab.getLastRow() > 1) {
    tab.getRange(2, 1, tab.getLastRow() - 1, FINANCIEEL_KOLOMMEN.length).clearContent();
  }
  if (!rijen.length) {
    return;
  }

  const waarden = rijen.map(function (rij) {
    return FINANCIEEL_KOLOMMEN.map(function (kolom) { return rij[kolom]; });
  });

  tab.getRange(2, 1, waarden.length, FINANCIEEL_KOLOMMEN.length).setValues(waarden);
}

const MINIMOVE_DEELNEMERS_KOLOMMEN = [
  'seizoen', 'cyclus', 'naam_slug', 'naam_kind', 'type_aankoop', 'gekocht',
  'bedrag', 'order_ids', 'laatste_order_op'
];

/**
 * @return {Object[]} alle rijen uit "MiniMove Deelnemers" als platte objecten
 */
function leesMiniMoveDeelnemers() {
  const tab = _tab('MiniMove Deelnemers');
  const laatste = tab.getLastRow();
  if (laatste < 2) {
    return [];
  }

  return tab.getRange(2, 1, laatste - 1, MINIMOVE_DEELNEMERS_KOLOMMEN.length).getValues().map(function (rij) {
    const object = {};
    MINIMOVE_DEELNEMERS_KOLOMMEN.forEach(function (kolom, i) {
      object[kolom] = rij[i];
    });

    object.seizoen          = String(object.seizoen || '');
    object.cyclus           = String(object.cyclus || '');
    object.order_ids        = String(object.order_ids || '').split(',').filter(String);
    object.gekocht          = object.gekocht === '' ? null : Number(object.gekocht);
    object.bedrag           = Number(object.bedrag) || 0;
    object.laatste_order_op = _alsDatumTekst(object.laatste_order_op);

    return object;
  });
}

/**
 * Schrijft "MiniMove Deelnemers" volledig opnieuw weg -- dit tabblad is afgeleide
 * data (net als Deelnemers/Financieel), geen handmatig aangevulde inhoud.
 *
 * @param {Object[]} rijen
 */
function schrijfMiniMoveDeelnemers(rijen) {
  const tab = _tab('MiniMove Deelnemers');

  if (tab.getLastRow() > 1) {
    tab.getRange(2, 1, tab.getLastRow() - 1, MINIMOVE_DEELNEMERS_KOLOMMEN.length).clearContent();
  }
  if (!rijen.length) {
    return;
  }

  const waarden = rijen.map(function (rij) {
    return MINIMOVE_DEELNEMERS_KOLOMMEN.map(function (kolom) {
      const waarde = rij[kolom];
      if (kolom === 'order_ids') {
        return waarde.join(',');
      }
      if (kolom === 'gekocht') {
        return waarde === null ? '' : waarde;
      }
      return waarde;
    });
  });

  tab.getRange(2, 1, waarden.length, MINIMOVE_DEELNEMERS_KOLOMMEN.length).setValues(waarden);
}

/**
 * Houdt "MiniMove Aanwezigheid" bij: 4 blokken onder elkaar (één per cyclus),
 * elk gemarkeerd met een rij die in kolom A exact "CYCLUS 1".."CYCLUS 4" bevat.
 * Kolomindeling per blok (vanaf de kopregel, één rij onder de marker):
 * A seizoen, B naam kind, C naam (intern/slug), D aankoop, E gekocht,
 * F t/m M de 8 aanvinkvakjes (kopregel = de echte datums), N gebruikt (formule),
 * O over (formule).
 *
 * Voegt NOOIT een bestaand aanvinkvakje of een bestaande gebruikt/over-formule
 * opnieuw toe -- alleen nieuwe kinderen worden toegevoegd, en alleen de
 * aankoopkolommen (A:E) van bestaande rijen worden ververst.
 *
 * De 4 blokken worden van cyclus 4 naar cyclus 1 verwerkt: een rij invoegen in
 * een later blok verschuift nooit een blok dat daarboven staat, dus de rijnummers
 * die aan het begin één keer zijn ingelezen blijven voor de nog te verwerken
 * (eerdere) blokken geldig -- geen herhaald inlezen nodig.
 *
 * @param {Object[]} deelnemersRijen uit leesMiniMoveDeelnemers()
 * @param {Object} kalender mapping.minimove_kalender uit Config.gs: cyclus -> 8 datums
 */
function synchroniseerMiniMoveAanwezigheid(deelnemersRijen, kalender) {
  const tab = _tab('MiniMove Aanwezigheid');
  const laatsteRij = tab.getLastRow();
  if (laatsteRij < 1) {
    throw new Error('Tabblad "MiniMove Aanwezigheid" is leeg -- de 4 cyclusblokken ' +
      '(rijen met "CYCLUS 1".."CYCLUS 4" in kolom A) moeten eenmalig handmatig aangemaakt worden.');
  }

  const kolomA = tab.getRange(1, 1, laatsteRij, 1).getValues().map(function (rij) {
    return String(rij[0] || '').trim();
  });

  const markers = {};
  kolomA.forEach(function (waarde, i) {
    for (let c = 1; c <= MINIMOVE_AANTAL_CYCLI; c += 1) {
      if (waarde === 'CYCLUS ' + c) {
        markers[String(c)] = i + 1;
      }
    }
  });

  const ontbrekend = [];
  for (let c = 1; c <= MINIMOVE_AANTAL_CYCLI; c += 1) {
    if (!markers[String(c)]) {
      ontbrekend.push(c);
    }
  }
  if (ontbrekend.length) {
    throw new Error('Cyclusblok(ken) niet gevonden in "MiniMove Aanwezigheid": ' + ontbrekend.join(', ') +
      '. Verwacht een rij met exact "CYCLUS ' + ontbrekend[0] + '" in kolom A.');
  }

  const alleMarkerRijen = Object.keys(markers)
    .map(function (c) { return markers[c]; })
    .sort(function (a, b) { return a - b; });

  // Argumentscheiding in formules is locale-afhankelijk (bijv. ';' bij een
  // Nederlandstalig werkboek i.p.v. ','). Zonder deze aanpassing geeft
  // setFormula() op zo'n werkboek een #ERROR! (formule niet te parsen) --
  // geconstateerd 2026-08-05.
  const FORMULE_SCHEIDING = SpreadsheetApp.getActive().getSpreadsheetLocale().indexOf('nl') === 0 ? ';' : ',';

  ['4', '3', '2', '1'].forEach(function (cyclus) {
    const markerRij         = markers[cyclus];
    const kopRij             = markerRij + 1;
    const volgendeMarkerRij  = alleMarkerRijen.filter(function (r) { return r > markerRij; })[0];
    const laatsteDataRij     = volgendeMarkerRij ? volgendeMarkerRij - 1 : tab.getLastRow();

    // Kolomkoppen (de 8 echte datums) elke run verversen -- puur informatief,
    // niets dat de trainer hier zelf invult.
    const datums = (kalender && kalender[cyclus]) || [];
    const achtDatums = [];
    for (let i = 0; i < 8; i += 1) {
      achtDatums.push(datums[i] || '');
    }
    tab.getRange(kopRij, 6, 1, 8).setValues([achtDatums]);

    const rijenVoorDezeCyclus = deelnemersRijen.filter(function (r) { return r.cyclus === cyclus; });
    if (!rijenVoorDezeCyclus.length) {
      return;
    }

    const bestaandeSlugs = {};
    // Begint op de kopregel zelf: als er nog geen kind in dit blok staat, komt de
    // eerste nieuwe rij direct ná de kopregel.
    let laatsteGevuldeRij = kopRij;
    if (laatsteDataRij >= kopRij + 1) {
      tab.getRange(kopRij + 1, 3, laatsteDataRij - kopRij, 1).getValues().forEach(function (rij, i) {
        const slug = String(rij[0] || '').trim();
        if (slug) {
          const rijNummer = kopRij + 1 + i;
          bestaandeSlugs[slug] = rijNummer;
          laatsteGevuldeRij = rijNummer;
        }
      });
    }

    rijenVoorDezeCyclus.forEach(function (deelnemer) {
      const gekochtWaarde = deelnemer.gekocht === null ? '' : deelnemer.gekocht;
      const bestaandeRij = bestaandeSlugs[deelnemer.naam_slug];

      if (bestaandeRij) {
        tab.getRange(bestaandeRij, 1, 1, 5).setValues([[
          deelnemer.seizoen, deelnemer.naam_kind, deelnemer.naam_slug,
          deelnemer.type_aankoop, gekochtWaarde
        ]]);
        return;
      }

      // Nieuw kind: direct ná de laatst gevulde rij invoegen -- niet vlak vóór de
      // volgende cyclusmarkering, want dat zou de lege bufferregels ertussen
      // opeten totdat nieuwe rijen tegen "CYCLUS N" aan plakken.
      const nieuweRij = laatsteGevuldeRij + 1;
      tab.insertRowBefore(nieuweRij);

      tab.getRange(nieuweRij, 1, 1, 5).setValues([[
        deelnemer.seizoen, deelnemer.naam_kind, deelnemer.naam_slug,
        deelnemer.type_aankoop, gekochtWaarde
      ]]);

      tab.getRange(nieuweRij, 14).setFormula(
        '=COUNTIF(F' + nieuweRij + ':M' + nieuweRij + FORMULE_SCHEIDING + 'TRUE)'
      );

      const overCel = tab.getRange(nieuweRij, 15);
      if (deelnemer.gekocht === null) {
        overCel.setValue('');
      } else {
        overCel.setFormula('=E' + nieuweRij + '-N' + nieuweRij);
      }

      laatsteGevuldeRij = nieuweRij;
    });
  });
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
