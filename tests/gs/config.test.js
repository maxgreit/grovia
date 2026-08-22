/**
 * Tests voor de pure Config-parsers.
 * Gebruik: node --test tests/gs/
 */
const test = require('node:test');
const assert = require('node:assert');
const {
  leesConfig,
  leesGeheimen,
  _leesSegmentGroepen,
  _leesGetalPaar
} = require('../../google-apps-script/deelnemers/Config.gs');

function tabMet(waarden) {
  return { getRange: function () { return { getValues: function () { return waarden; } }; } };
}

test('_leesGetalPaar leest sleutel-getalparen en slaat lege rijen over', function () {
  const tab = tabMet([['Speler', 2014], ['Keeper', 2013], ['', ''], ['Onzin', '']]);

  assert.deepStrictEqual(_leesGetalPaar(tab, 'AB2:AC5'), { Speler: 2014, Keeper: 2013 });
});

test('_leesGetalPaar maakt van tekstgetallen echte getallen', function () {
  const tab = tabMet([['Speler', '2014']]);

  assert.strictEqual(_leesGetalPaar(tab, 'AB2:AC5').Speler, 2014);
});

test('_leesSegmentGroepen bouwt een sleutel van vereniging, leeftijd en rol', function () {
  const tab = tabMet([
    ['KA', 'jong', 'Speler', 3],
    ['KA', 'oud', 'Keeper', 2],
    ['', '', '', '']
  ]);

  assert.deepStrictEqual(_leesSegmentGroepen(tab, 'AG2:AJ30'), {
    'KA|jong|Speler': 3,
    'KA|oud|Keeper': 2
  });
});

test('_leesSegmentGroepen slaat een rij zonder aantal over', function () {
  const tab = tabMet([['KA', 'jong', 'Speler', ''], ['SU', 'jong', 'Speler', 2]]);

  assert.deepStrictEqual(_leesSegmentGroepen(tab, 'AG2:AJ30'), { 'SU|jong|Speler': 2 });
});

test('leesConfig() vraagt alle verwachte bereiken op (Config-tabblad indeling)', function () {
  // Dit is een integratie-test die vastlegt welke bereiken leesConfig() opvraagt.
  // Onverwachte bereik-verschuivingen resulteren nu in een mislukte test, niet in
  // stille lege config die teamindelingen saboteert.
  const opgevraaagdeBereiken = [];

  // Nep-tab die bereiken bijhoudt en lege 2D-arrays retourneert.
  const nepTab = {
    getRange: function (bereik) {
      opgevraaagdeBereiken.push(bereik);
      // Retourneer een lege 2D-array groot genoeg voor alle parsers.
      const waarden = [];
      for (let i = 0; i < 30; i++) {
        waarden.push(['', '', '', '']);
      }
      return { getValues: function () { return waarden; } };
    }
  };

  // Stub SpreadsheetApp (productiecode: SpreadsheetApp.getActive().getSheetByName('Config')).
  const origSpreadsheet = global.SpreadsheetApp;
  global.SpreadsheetApp = {
    getActive: function () {
      return {
        getSheetByName: function (naam) {
          if (naam === 'Config') {
            return nepTab;
          }
          throw new Error('Tabblad "' + naam + '" niet gevonden.');
        }
      };
    }
  };

  // Stub Utilities voor _alsDatum (formatDate) en _vandaagAlsDatum.
  const origUtilities = global.Utilities;
  global.Utilities = {
    formatDate: function (datum, zone, fmt) {
      // Eenvoudig placeholder-formaat voor testen.
      if (datum instanceof Date) {
        const j = datum.getFullYear();
        const m = String(datum.getMonth() + 1).padStart(2, '0');
        const d = String(datum.getDate()).padStart(2, '0');
        return j + '-' + m + '-' + d;
      }
      return String(datum);
    }
  };

  // Stub Session voor _alsDatum (getScriptTimeZone).
  const origSession = global.Session;
  global.Session = {
    getScriptTimeZone: function () {
      return 'UTC';
    }
  };

  // Stub PropertiesService voor leesGeheimen (productiecode: PropertiesService.getScriptProperties()).
  const origPropertiesService = global.PropertiesService;
  global.PropertiesService = {
    getScriptProperties: function () {
      return {
        getProperty: function () { return null; }
      };
    }
  };

  try {
    // Laad Config.gs opnieuw zodat de globale stubs in werking treden.
    delete require.cache[require.resolve('../../google-apps-script/deelnemers/Config.gs')];
    const ConfigModule = require('../../google-apps-script/deelnemers/Config.gs');

    // Roep leesConfig() aan.
    const resultaat = ConfigModule.leesConfig();

    // Verifieer dat resultaat niet leeg is (sanity-check).
    assert.strictEqual(typeof resultaat, 'object');

    // Verifieer dat alle verwachte bereiken zijn opvraagd (in de juiste volgorde).
    const verwachteBereiken = [
      'A2:B20',    // instellingen
      'D2:E30',    // scholen
      'G2:H30',    // fases
      'J2:J30',    // uitgesloten
      'L2:M30',    // rollen
      'O1:W4',     // minimove_kalender
      'Y2:Z30',    // score_wegingen (NEW)
      'AB2:AC5',   // geboortejaargrens (NEW)
      'AE2:AE10',  // groepsnamen (NEW)
      'AG2:AJ30',  // groepen_per_segment (NEW)
      'AL2:AM5'    // teamindeling_werkboeken (NEW)
    ];

    assert.deepStrictEqual(opgevraaagdeBereiken, verwachteBereiken,
      'leesConfig() moet alle ' + verwachteBereiken.length + ' bereiken opvragen in de juiste volgorde');
  } finally {
    // Herstel de originele globals.
    global.SpreadsheetApp = origSpreadsheet;
    global.Utilities = origUtilities;
    global.Session = origSession;
    global.PropertiesService = origPropertiesService;
  }
});

// --- Kleiner punt: een vervuilde getalcel valt niet meer stil weg ---

test('_leesGetalPaar slaat een cel over die geen getal is', function () {
  const tab = tabMet([['blocks_planning', '1,5'], ['blocks_flexibiliteit', 1]]);

  assert.deepStrictEqual(_leesGetalPaar(tab, 'Y2:Z30'), { blocks_flexibiliteit: 1 });
});

test('_leesGetalPaar meldt een cel die geen getal is in de probleemlijst', function () {
  const problemen = [];
  const tab = tabMet([['blocks_planning', '1,5']]);

  _leesGetalPaar(tab, 'Y2:Z30', 'score_wegingen (Y:Z)', problemen);

  assert.strictEqual(problemen.length, 1);
  assert.match(problemen[0], /blocks_planning/);
  assert.match(problemen[0], /1,5/);
});

test('_leesGetalPaar meldt niets bij een correcte tabel', function () {
  const problemen = [];
  const tab = tabMet([['Speler', 2014], ['Keeper', '2013'], ['', '']]);

  const resultaat = _leesGetalPaar(tab, 'AB2:AC5', 'geboortejaargrens (AB:AC)', problemen);

  assert.deepStrictEqual(resultaat, { Speler: 2014, Keeper: 2013 });
  assert.deepStrictEqual(problemen, []);
});

// --- Per-segment groepsnamen in kolom 4 van AG:AJ ---

test('_leesSegmentGroepen leest een komma-lijst als eigen namenlijst', function () {
  const tab = tabMet([['KA', 'jong', 'Speler', 'C3, C2a ,C2b,C1']]);

  assert.deepStrictEqual(_leesSegmentGroepen(tab, 'AG2:AJ30'), {
    'KA|jong|Speler': ['C3', 'C2a', 'C2b', 'C1']
  });
});

test('_leesSegmentGroepen leest een enkel niet-numeriek label als lijst van één', function () {
  const tab = tabMet([['KA', 'jong', 'Speler', 'C2']]);

  assert.deepStrictEqual(_leesSegmentGroepen(tab, 'AG2:AJ30'), { 'KA|jong|Speler': ['C2'] });
});

test('_leesSegmentGroepen houdt een getal (ook als tekst) als aantal', function () {
  const tab = tabMet([['KA', 'jong', 'Speler', '3'], ['SU', 'jong', 'Speler', 2]]);

  assert.deepStrictEqual(_leesSegmentGroepen(tab, 'AG2:AJ30'), {
    'KA|jong|Speler': 3,
    'SU|jong|Speler': 2
  });
});
