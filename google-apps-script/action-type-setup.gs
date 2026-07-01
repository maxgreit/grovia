/**
 * Grovia — Action Type Test: setup + herstel
 * ------------------------------------------------------------------
 * Maakt per vereniging één Google Form + gekoppelde Sheet aan, met:
 *   - Naamveld
 *   - 20 a/b-vragen (1-op-1 uit Test.docx, kindversie)
 *   - Slotvraag: begrijpelijkheid 0–10 (telt NIET mee in de score)
 *   - Apart tabblad "Resultaten": Naam + berekende Action Type (lettercombinatie)
 *
 * BELANGRIJK — waarom een apart tabblad:
 *   Google Forms "bezit" het reactie-tabblad en overschrijft kolommen die direct
 *   naast de formuliervragen staan zodra er een inzending binnenkomt. Een formule
 *   in het reactie-tabblad zelf wordt dus gewist. Daarom staat de berekening in een
 *   los tabblad "Resultaten" dat naar de reacties verwijst — dat raakt Forms nooit aan.
 *
 * GEBRUIK (nieuw opzetten):
 *   1. https://script.google.com → Nieuw project → plak dit bestand
 *   2. Run  setupActionTypeForms
 *   3. Keur rechten goed (Forms + Sheets + Drive)
 *   4. Beeld → Logboek (of Uitvoeringen) voor de links
 *
 * GEBRUIK (bestaande sheets repareren — geen nieuwe formulieren/links):
 *   1. Vul de sheet-IDs in bij BESTAANDE_SHEETS hieronder
 *   2. Run  herstelActionType
 *
 * Scoring (5 vragen per dichotomie, oneven → nooit gelijkspel):
 *   E/I : vraag 1,5,9,13,17   (a = E, b = I)
 *   S/N : vraag 2,6,10,14,18  (a = S, b = N)
 *   T/F : vraag 3,7,11,15,19  (a = T, b = F)
 *   J/P : vraag 4,8,12,16,20  (a = J, b = P)
 *   Per paar: ≥3 a's → eerste letter, anders tweede letter.
 */

// Verenigingen waarvoor een formulier + sheet wordt gemaakt.
var VERENIGINGEN = ['Kolping Academie', 'Schagen United'];

// Drive-map waar de forms + sheets terechtkomen (het stuk na /folders/ in de map-URL).
// Let op: je hebt BEWERKRECHTEN op deze map nodig, anders mislukt het verplaatsen.
var DOELMAP_ID = '1rquUBAEV3z7emUm53mKIMfst3tvbIT8G';

// Bestaande resultaten-sheets om te repareren met herstelActionType (sheet-ID uit de URL).
var BESTAANDE_SHEETS = [
  '1HQmSEdj07CVlY1_mTcJoBjseRo4nqQs1TdIrx9ZFXkU', // Kolping Academie
  '1e4-BfBpyCaDufVHYbZoRLXN9auRV52rQnqVeaKSgOuw'  // Schagen United
];

// De 20 vragen, 1-op-1 uit Test.docx (kindversie). a = eerste letter, b = tweede.
var VRAGEN = [
  { a: 'Ik ben druk en vol energie.',                          b: 'Ik ben rustig en stil.' },
  { a: 'Ik begrijp dingen als iemand het gewoon zegt.',        b: 'Ik denk na over wat iets nog meer kan betekenen.' },
  { a: 'Ik denk logisch na en vraag anderen wat zij vinden.',  b: 'Ik voel wat goed is en vertrouw op mijn gevoel.' },
  { a: 'Ik hou van netjes zijn.',                              b: 'Ik ben soms rommelig, maar weet wat ik doe.' },
  { a: 'Ik praat vaak hard.',                                  b: 'Ik praat meestal zacht.' },
  { a: 'Ik denk aan echte dingen.',                            b: 'Ik droom veel en verzin dingen.' },
  { a: 'Ik zeg gewoon wat ik denk.',                           b: 'Ik probeer vriendelijk te praten.' },
  { a: 'Ik doe één ding tegelijk.',                            b: 'Ik doe veel dingen door elkaar.' },
  { a: 'Ik wil meteen iets doen.',                             b: 'Ik denk eerst goed na.' },
  { a: 'Ik ben gewoon, zoals de meeste mensen.',               b: 'Ik ben speciaal en anders.' },
  { a: 'Ik wil graag gelijk hebben.',                          b: 'Ik wil dat iedereen vrienden blijft.' },
  { a: 'Ik hou van regels en duidelijkheid.',                  b: 'Ik hou van vrijheid en nieuwe ideeën.' },
  { a: 'Ik begin gewoon.',                                     b: 'Ik denk eerst goed na.' },
  { a: 'Ik denk aan wat echt is.',                             b: 'Ik gebruik mijn fantasie.' },
  { a: 'Ik ben streng maar eerlijk.',                          b: 'Ik voel goed hoe anderen zich voelen.' },
  { a: 'Ik begin op tijd.',                                    b: 'Ik wacht tot het laatste moment.' },
  { a: 'Ik neem actie en begin dingen.',                       b: 'Ik wacht af wat er gebeurt.' },
  { a: 'Ik kijk naar echte dingen en mensen.',                 b: 'Ik denk aan ideeën en verhalen.' },
  { a: 'Ik blijf bij het onderwerp.',                          b: 'Ik praat ook over gevoelens of andere dingen.' },
  { a: 'Ik neem graag de leiding.',                            b: 'Ik wil liever gewoon mijn ding doen.' }
];

// De 16 Action Types met bijpassende voetballer, uit Action Types.docx.
// Zelfde data voor beide verenigingen — spelers/types zijn niet vereniging-specifiek.
var ACTION_TYPES = [
  { code: 'ISTJ', naam: 'De Zekerheidszoeker', speler: 'Gerard Piqué',
    omschrijving: 'altijd solide en gedisciplineerd in zijn spel',
    quote: 'Jij bent betrouwbaar en standvastig – jouw team kan altijd op je rekenen.' },
  { code: 'ISFJ', naam: 'De Teamhelper', speler: 'N’Golo Kanté',
    omschrijving: 'de stille kracht die alles voor het team geeft',
    quote: 'Jij bent zorgzaam en loyaal – het team voelt zich sterker door jouw inzet.' },
  { code: 'INFJ', naam: 'De Verbeeldingsdenker', speler: 'Kevin De Bruyne',
    omschrijving: 'meester in het zien van het grotere plaatje op het veld',
    quote: 'Jij bent visionair – jij ziet verbanden die anderen missen.' },
  { code: 'INTJ', naam: 'De Slimme plannenmaker', speler: 'Toni Kroos',
    omschrijving: 'kalm, berekenend en altijd met een plan in zijn spel',
    quote: 'Jij bent strategisch en doelgericht – jij speelt altijd met een plan.' },
  { code: 'ISTP', naam: 'De Uitprobeerder', speler: 'Trent Alexander-Arnold',
    omschrijving: 'creatief en oplossingsgericht in actie',
    quote: 'Jij bent een probleemoplosser – jij ontdekt het spel door te doen.' },
  { code: 'ISFP', naam: 'De Rustige doener', speler: 'Andreas Christensen',
    omschrijving: 'rustig, stabiel en effectief zonder veel woorden',
    quote: 'Jij bent bescheiden maar waardevol – jouw kracht ligt in stilte en daden.' },
  { code: 'INFP', naam: 'De Fantasievolle speler', speler: 'Paulo Dybala',
    omschrijving: 'fantasierijk en uniek in zijn spelstijl',
    quote: 'Jij bent creatief en origineel – jij verrast met je eigen manier van spelen.' },
  { code: 'INTP', naam: 'De Puzzelaar', speler: 'Matthijs de Ligt',
    omschrijving: 'denkt vooruit en analyseert slim in de verdediging',
    quote: 'Jij bent nieuwsgierig en analytisch – jij ontrafelt elke situatie.' },
  { code: 'ESTP', naam: 'De Actiespeler', speler: 'Kylian Mbappé',
    omschrijving: 'razendsnel en leert het meest in het spel zelf',
    quote: 'Jij bent snel en gedurfd – jij leert door direct in actie te komen.' },
  { code: 'ESFP', naam: 'De Pleziermaker', speler: 'Vinícius Júnior',
    omschrijving: 'sprankelend en altijd spelend met plezier',
    quote: 'Jij bent energiek en vrolijk – jij brengt plezier en enthousiasme in het team.' },
  { code: 'ENFP', naam: 'De Ideeënbedenker', speler: 'João Félix',
    omschrijving: 'speels en altijd op zoek naar creatieve oplossingen',
    quote: 'Jij bent creatief en inspirerend – jij bruist van de nieuwe ideeën.' },
  { code: 'ENTP', naam: 'De Uitdager', speler: 'Zlatan Ibrahimović',
    omschrijving: 'eigenzinnig, uitdagend en altijd vol bravoure',
    quote: 'Jij bent vindingrijk en gedurfd – jij zoekt altijd de uitdaging op.' },
  { code: 'ESTJ', naam: 'De Regelsbewaker', speler: 'Virgil van Dijk',
    omschrijving: 'sterk in discipline en organisatie achterin',
    quote: 'Jij bent gedisciplineerd en duidelijk – jij zorgt dat afspraken nageleefd worden.' },
  { code: 'ESFJ', naam: 'De Vriend', speler: 'Thomas Müller',
    omschrijving: 'altijd positief en een echte teamspeler',
    quote: 'Jij bent sociaal en verbindend – jij maakt het team hechter.' },
  { code: 'ENFJ', naam: 'De Aanmoediger', speler: 'Jordan Henderson',
    omschrijving: 'moedigt aan en inspireert zijn teamgenoten constant',
    quote: 'Jij bent inspirerend en motiverend – jij tilt anderen naar een hoger niveau.' },
  { code: 'ENTJ', naam: 'De Leider', speler: 'Cristiano Ronaldo',
    omschrijving: 'gedreven leider die altijd vooropgaat',
    quote: 'Jij bent doelgericht en vastberaden – jij neemt de leiding met overtuiging.' }
];

var INTRO =
  'Welkom! Deze test helpt je beter te begrijpen hoe jij denkt, doet en keuzes maakt. ' +
  'Je krijgt 20 vragen met steeds 2 zinnen (a en b). Kies bij elke vraag de zin die het ' +
  'beste bij jou past. Er zijn geen goede of foute antwoorden — denk niet te lang na en ' +
  'kies wat voor jou het meest klopt. Je ouders of begeleider mogen helpen met voorlezen.';

/**
 * Nieuw opzetten — draai deze één keer.
 */
function setupActionTypeForms() {
  var resultaten = [];
  for (var i = 0; i < VERENIGINGEN.length; i++) {
    resultaten.push(maakFormEnSheet(VERENIGINGEN[i]));
  }

  var regels = ['', '==================== KLAAR ===================='];
  resultaten.forEach(function (r) {
    regels.push('');
    regels.push('Vereniging : ' + r.vereniging);
    regels.push('Form (link voor FunnelKit) : ' + r.formPubliek);
    regels.push('Form (bewerken)            : ' + r.formEdit);
    regels.push('Resultaten-sheet           : ' + r.sheetUrl);
  });
  regels.push('==============================================');
  Logger.log(regels.join('\n'));
}

/**
 * Bestaande resultaten-sheets repareren — zet/ververst het tabblad "Resultaten".
 * Maakt GEEN nieuwe formulieren aan, dus bestaande links blijven werken.
 */
function herstelActionType() {
  for (var i = 0; i < BESTAANDE_SHEETS.length; i++) {
    var ss   = SpreadsheetApp.openById(BESTAANDE_SHEETS[i]);
    var resp = vindReactieSheet(ss);
    zetResultatenTab(ss, resp);
    Logger.log('Hersteld: ' + ss.getName() + '  (reactie-tabblad: "' + resp.getName() + '")');
  }
  Logger.log('Klaar — open de sheets en bekijk het tabblad "Resultaten".');
}

/**
 * Bouwt één formulier + gekoppelde sheet voor een vereniging.
 */
function maakFormEnSheet(vereniging) {
  // --- 1. Formulier ---
  var form = FormApp.create('Action Type Test — ' + vereniging);
  form.setDescription(INTRO);
  form.setProgressBar(true);
  form.setShowLinkToRespondAgain(false);

  form.addTextItem().setTitle('Naam').setRequired(true);

  for (var n = 0; n < VRAGEN.length; n++) {
    var v = VRAGEN[n];
    form.addMultipleChoiceItem()
      .setTitle('Vraag ' + (n + 1))
      .setChoiceValues(['a. ' + v.a, 'b. ' + v.b])
      .setRequired(true);
  }

  form.addScaleItem()
    .setTitle('Hoe goed begreep je de vragen?')
    .setHelpText('0 = heel moeilijk te begrijpen, 10 = heel goed te begrijpen.')
    .setBounds(0, 10)
    .setLabels('heel moeilijk', 'heel goed');

  // --- 2. Gekoppelde sheet ---
  var ss = SpreadsheetApp.create('Action Type Resultaten — ' + vereniging);
  var origSheetNaam = ss.getSheets()[0].getName();

  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  SpreadsheetApp.flush();

  ss = SpreadsheetApp.openById(ss.getId());
  var reactieSheet = vindReactieSheet(ss);

  // Standaard leeg tabblad opruimen
  var orig = ss.getSheetByName(origSheetNaam);
  if (orig && orig.getSheetId() !== reactieSheet.getSheetId() && ss.getSheets().length > 1) {
    ss.deleteSheet(orig);
  }

  // --- 3. Resultaten-tabblad met de Action Type-formule ---
  zetResultatenTab(ss, reactieSheet);

  // --- 4. Form + Sheet naar de doelmap verplaatsen ---
  var doelmap = DriveApp.getFolderById(DOELMAP_ID);
  DriveApp.getFileById(form.getId()).moveTo(doelmap);
  DriveApp.getFileById(ss.getId()).moveTo(doelmap);

  return {
    vereniging:  vereniging,
    formEdit:    form.getEditUrl(),
    formPubliek: form.getPublishedUrl(),
    sheetUrl:    ss.getUrl()
  };
}

/**
 * Vindt het reactie-tabblad (het tabblad dat aan een formulier is gekoppeld).
 */
function vindReactieSheet(ss) {
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getFormUrl()) {
      return sheets[i];
    }
  }
  return ss.getSheets()[0];
}

/**
 * Zet/ververst het tabblad "Resultaten" met Naam + berekende Action Type.
 * De formules verwijzen naar het reactie-tabblad en vullen automatisch bij elke inzending.
 */
function zetResultatenTab(ss, respSheet) {
  var P = "'" + respSheet.getName() + "'!"; // bv.  'Formulierreacties 1'!

  var res = ss.getSheetByName('Resultaten');
  if (res) {
    res.clear();
  } else {
    res = ss.insertSheet('Resultaten', 0); // als eerste tabblad
  }

  // Kolomvolgorde reactie-tabblad: A=Timestamp B=Naam C..V=Vraag 1..20 W=Begrijpelijkheid
  res.getRange('A1').setFormula(
    '={"Naam";ARRAYFORMULA(IF(' + P + 'A2:A="","",' + P + 'B2:B))}'
  );
  res.getRange('B1').setFormula(actionTypeFormule(P));
  res.setFrozenRows(1);
}

/**
 * Bouwt de Action Type-ARRAYFORMULA die naar het reactie-tabblad (prefix P) verwijst.
 * en_US-notatie (komma's) — Apps Script vereist dit ongeacht de sheet-taal.
 */
function actionTypeFormule(P) {
  function dich(cols, letterA, letterB) {
    var termen = cols.map(function (c) {
      return '(LEFT(' + P + c + '2:' + c + ',1)="a")';
    });
    return 'IF(' + termen.join('+') + '>=3,"' + letterA + '","' + letterB + '")';
  }
  var ei = dich(['C', 'G', 'K', 'O', 'S'], 'E', 'I'); // vraag 1,5,9,13,17
  var sn = dich(['D', 'H', 'L', 'P', 'T'], 'S', 'N'); // vraag 2,6,10,14,18
  var tf = dich(['E', 'I', 'M', 'Q', 'U'], 'T', 'F'); // vraag 3,7,11,15,19
  var jp = dich(['F', 'J', 'N', 'R', 'V'], 'J', 'P'); // vraag 4,8,12,16,20

  return '={"Action Type";ARRAYFORMULA(IF(' + P + 'A2:A="","",' +
    ei + '&' + sn + '&' + tf + '&' + jp + '))}';
}
