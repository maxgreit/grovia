/**
 * Rangschikt deelnemers op hun Ixly-scores en deelt ze in groepen in, per segment
 * (vereniging x leeftijd x rol). Schrijft het resultaat naar een werkboek per
 * vereniging.
 *
 * Puur rekenwerk staat hier los van het wegschrijven, zodat het met `node --test`
 * getest kan worden zonder SpreadsheetApp.
 */

/**
 * De negen genormeerde schalen die Ixly teruggeeft. levels_voltooid en levels_perfect
 * horen hier BEWUST niet bij: dat zijn ruwe aantallen op een heel andere schaal, die
 * worden wel getoond maar standaard niet meegewogen (gewicht 0 in Config).
 */
const SCORE_KOLOMMEN = [
  'blocks_planning', 'blocks_flexibiliteit',
  'rally_prestatie', 'rally_kwaliteit', 'rally_reactiesnelheid', 'rally_consistentie',
  'rally_volgehouden_aandacht', 'rally_respons_inhibitie', 'rally_reactie_op_fouten'
];

/**
 * Elke kolom waaraan in Config een gewicht toegekend MAG worden: de negen genormeerde
 * schalen plus de twee leveltellingen. Alles daarbuiten is een typfout in het
 * Config-tabblad -- zie configWaarschuwingen().
 */
const GEWOGEN_KOLOMMEN = SCORE_KOLOMMEN.concat(['levels_voltooid', 'levels_perfect']);

/**
 * Bepaalt of een kind bij 'jong' of 'oud' hoort.
 *
 * De grens is een geboortejaar en verschilt per rol: keepers hebben een andere
 * indeling dan spelers. Geboortejaar >= grens betekent jong.
 *
 * @param {string|Date} geboortedatum
 * @param {string} rol 'Speler' of 'Keeper'
 * @param {Object} grenzen rol -> geboortejaar
 * @return {string} 'jong', 'oud', of '' als het niet te bepalen is
 */
function bepaalLeeftijdsgroep(geboortedatum, rol, grenzen) {
  const grens = grenzen[String(rol)];
  if (!grens) {
    return '';
  }

  const jaar = _geboortejaar(geboortedatum);
  if (!jaar) {
    return '';
  }

  return jaar >= Number(grens) ? 'jong' : 'oud';
}

/**
 * Berekent de gewogen totaalscore van één deelnemer.
 *
 * Alleen schalen met gewicht > 0 tellen mee. Ontbreekt zo'n schaal, dan is de score
 * niet vergelijkbaar met die van een kind dat alles wel heeft -- dan geeft deze functie
 * null en belandt het kind in "Zonder indeling" in plaats van laag in de ranglijst.
 * Met de standaardconfiguratie (alle negen op gewicht 1) betekent dat: alleen kinderen
 * met alle negen schalen krijgen een score.
 *
 * @param {Object} scoreRij rij uit "Ixly Scores"
 * @param {Object} wegingen kolomnaam -> gewicht
 * @return {number|null} afgerond op twee decimalen, of null
 */
function berekenTotaalscore(scoreRij, wegingen) {
  let som = 0;
  let totaalGewicht = 0;

  // BEWUST over GEWOGEN_KOLOMMEN en niet over de Config-sleutels: een typfout in Config
  // ('Blocks planning' i.p.v. 'blocks_planning') liet anders elk kind op null uitkomen,
  // waarna het werkboek "onvolledige score" meldde terwijl de scores compleet waren en
  // de Config fout was. Nu valt zo'n schaal enkel uit de formule; configWaarschuwingen()
  // meldt de sleutel zelf.
  const alleWegingen = wegingen || {};
  for (let i = 0; i < GEWOGEN_KOLOMMEN.length; i++) {
    const kolom = GEWOGEN_KOLOMMEN[i];
    const gewicht = Number(alleWegingen[kolom]) || 0;
    if (gewicht <= 0) {
      continue;
    }

    const waarde = scoreRij[kolom];
    if (waarde === '' || waarde === undefined || waarde === null) {
      return null;
    }

    // Niet-numeriek is GEEN score. Een cel met '4,03' (Nederlandse decimaalkomma --
    // precies wat handmatige invoer in een Nederlandstalig werkboek oplevert) geeft
    // Number() NaN. Zonder deze controle wordt de totaalscore NaN, gaat het kind tóch
    // de ranking in en destabiliseert de comparator de hele sortering. Null betekent:
    // netjes naar "Zonder indeling", met de reden erbij.
    const getal = Number(waarde);
    if (isNaN(getal)) {
      return null;
    }

    som += getal * gewicht;
    totaalGewicht += gewicht;
  }

  if (totaalGewicht === 0) {
    return null;
  }

  return Math.round((som / totaalGewicht) * 100) / 100;
}

function _geboortejaar(geboortedatum) {
  if (!geboortedatum) {
    return 0;
  }
  if (geboortedatum instanceof Date) {
    return geboortedatum.getFullYear();
  }
  const overeenkomst = String(geboortedatum).match(/(\d{4})/);
  return overeenkomst ? Number(overeenkomst[1]) : 0;
}

/**
 * Verenigingscode van MiniMove. MiniMove doet niet mee aan de testen en valt dus
 * volledig buiten de teamindeling -- consistent met upsertDeelnemers, dat deze orders
 * ook al stil overslaat.
 */
const VERENIGING_MINIMOVE = 'MM';

/**
 * Verdeelt de deelnemers over segmenten (vereniging x leeftijd x rol) en verzamelt
 * apart wie niet in te delen is.
 *
 * Niet-indeelbaar verdwijnt NOOIT stil: elk kind komt of in een segment, of in
 * zonderIndeling met een reden erbij. Stil wegfilteren is precies waar de eerdere
 * WooCommerce-backfill ("120 orders -> 0 nieuwe rijen") nooit verklaard raakte.
 *
 * De indeling gaat ALLEEN over het huidige seizoen. "Deelnemers" is gesleuteld op
 * seizoen|naam_slug (één rij per kind per seizoen), terwijl "Ixly Scores" alleen op
 * naam_slug sleutelt -- zonder dit filter komt hetzelfde kind twee keer in één tabblad
 * en worden kinderen van vorig seizoen mee ingedeeld, waardoor "Zonder indeling" een
 * historische ledenlijst van minderjarigen wordt die met trainers gedeeld wordt.
 *
 * Het seizoen van een rij wordt hier afgeleid uit uitgenodigd_op met de 1-MEIgrens
 * (bepaalTeamSeizoen), NIET uit het opgeslagen seizoen-veld: dat is met de
 * 1-augustusregel gestempeld, waardoor een voorjaarsinschrijving het vórige
 * seizoenslabel draagt en precies de lichting die dit seizoen traint buiten de indeling
 * zou vallen. Zie de docblock bij bepaalTeamSeizoen en GLOSSARY.md.
 *
 * Kinderen uit een ánder seizoen worden geteld en via seizoenWaarschuwingen() in het
 * runlog gemeld -- niet als rij in "Zonder indeling", want dat tabblad gaat naar de
 * trainers en zou volstromen met de historische ledenlijst. Zo blijft het zichtbaar als
 * de seizoensgrens verkeerd uitpakt, zonder gegevens van oud-deelnemers te verspreiden.
 *
 * @param {Object[]} deelnemers rijen uit leesDeelnemers()
 * @param {Object[]} scoreRijen rijen uit leesIxlyScores()
 * @param {Object} config met geboortejaargrens en score_wegingen
 * @param {string} seizoen bijv. '2627', uit bepaalTeamSeizoen(vandaag) -- verplicht
 * @return {{segmenten: Object, zonderIndeling: Object[], andereSeizoenen: Object}}
 */
function bouwSegmenten(deelnemers, scoreRijen, config, seizoen) {
  // Bewust een harde fout en geen stille "dan maar alles": een ontbrekend seizoen zou
  // precies het probleem terugbrengen dat dit filter oplost.
  const huidigSeizoen = String(seizoen || '');
  if (!huidigSeizoen) {
    throw new Error('bouwSegmenten: seizoen is verplicht (bepaalTeamSeizoen(vandaag)).');
  }

  const scoresPerSlug = {};
  (scoreRijen || []).forEach(function (rij) {
    scoresPerSlug[String(rij.naam_slug)] = rij;
  });

  const segmenten = {};
  const zonderIndeling = [];
  const grenzen = config.geboortejaargrens || {};
  const geenBruikbaarGewicht = !bruikbareWegingen(config.score_wegingen).length;

  // Per afwijkend seizoen een telling. Deze kinderen komen BEWUST niet als rij in
  // "Zonder indeling": dat tabblad wordt met trainers gedeeld en zou dan volstromen met
  // de volledige historische ledenlijst van minderjarigen. Een telling in het runlog
  // maakt het wél zichtbaar -- en dat is nodig, want de seizoensgrens is een bekende
  // valkuil: bepaalSeizoen() stempelt op 1 augustus, terwijl de inschrijving voor een
  // nieuw seizoen al vanaf 1 mei loopt (zie GLOSSARY.md, "drie seizoensgrenzen").
  // Vallen er onverwacht veel kinderen buiten, dan staat dat de eerstvolgende run in het
  // Log-tabblad in plaats van dat ze stil ontbreken.
  const andereSeizoenen = {};
  const seizoenVan = function (deelnemer) {
    // Het opgeslagen seizoen-veld is met de 1-AUGUSTUSregel gestempeld (bepaalSeizoen op
    // de orderdatum), dus een voorjaarsinschrijving draagt het vórige seizoenslabel.
    // Daarom leiden we het seizoen hier af uit uitgenodigd_op met de 1-MEIgrens. Is dat
    // veld leeg (nog niet uitgenodigd), dan valt het terug op het opgeslagen veld -- zo'n
    // rij heeft toch geen scores en belandt hoe dan ook buiten de indeling.
    return deelnemer.uitgenodigd_op
      ? bepaalTeamSeizoen(deelnemer.uitgenodigd_op)
      : String(deelnemer.seizoen || '');
  };

  (deelnemers || []).forEach(function (deelnemer) {
    // MiniMove eerst: die doet sowieso niet mee aan de testen, dus die hoort niet als
    // "ander seizoen" geteld te worden.
    if (String(deelnemer.vereniging) === VERENIGING_MINIMOVE) {
      return;
    }

    // Vergelijking als tekst: Google Sheets maakt van een puur numerieke cel ('2627')
    // soms zelf een getalcel -- zie de coercion in leesDeelnemers().
    const seizoenVanRij = String(seizoenVan(deelnemer) || '');
    if (seizoenVanRij !== huidigSeizoen) {
      const sleutel = seizoenVanRij || '(leeg)';
      andereSeizoenen[sleutel] = (andereSeizoenen[sleutel] || 0) + 1;
      return;
    }

    const scoreRij = scoresPerSlug[String(deelnemer.naam_slug)];
    if (!scoreRij) {
      zonderIndeling.push(_zonderIndeling(deelnemer, null, null, 'nog geen score bekend'));
      return;
    }

    const totaalscore = berekenTotaalscore(scoreRij, config.score_wegingen);
    if (totaalscore === null) {
      // De reden moet de ECHTE oorzaak noemen: "onvolledige score" is misleidend als de
      // scores compleet zijn en er alleen geen bruikbaar gewicht in Config staat.
      zonderIndeling.push(_zonderIndeling(deelnemer, scoreRij, null, geenBruikbaarGewicht
        ? 'geen bruikbare score_wegingen in Config (Y:Z) -- niet aan de score van dit kind'
        : 'onvolledige score'));
      return;
    }

    const leeftijd = bepaalLeeftijdsgroep(
      deelnemer.geboortedatum_kind, deelnemer.rol, grenzen);
    if (!leeftijd) {
      const reden = grenzen[String(deelnemer.rol)]
        ? 'geen geboortedatum'
        : 'geen geboortejaargrens in Config (AB:AC) voor rol "' + deelnemer.rol + '"';
      zonderIndeling.push(_zonderIndeling(deelnemer, scoreRij, totaalscore, reden));
      return;
    }

    const sleutel = deelnemer.vereniging + '|' + leeftijd + '|' + deelnemer.rol;
    if (!segmenten[sleutel]) {
      segmenten[sleutel] = [];
    }
    segmenten[sleutel].push(_teamRij(deelnemer, scoreRij, totaalscore));
  });

  return {
    segmenten: segmenten,
    zonderIndeling: zonderIndeling,
    andereSeizoenen: andereSeizoenen
  };
}

/**
 * Bepaalt het seizoen van een datum met de 1-MEIgrens.
 *
 * LET OP -- dit project kent nu drie plekken waar "seizoen" bepaald wordt, en dat is
 * bewust (zie GLOSSARY.md):
 *   1 mei     deze functie                           -- seizoensomslag van de teamindeling
 *   1 juni    seizoenStartdatum() in Financieel.gs   -- cyclusverkoop start in juni/juli
 *   1 augustus bepaalSeizoen() in Deelnemers.gs       -- deelnemersadministratie en reminders
 *
 * De teamindeling deelt de lichting in die dit seizoen traint, en die schrijft zich al
 * vanaf het voorjaar in. Met de 1-augustusgrens zou precies die groep buiten de indeling
 * vallen: hun Deelnemers-rij draagt dan nog het vorige seizoenslabel, omdat
 * upsertDeelnemers het seizoen-veld met bepaalSeizoen() op de ORDERDATUM stempelt.
 * 1 mei is de seizoensomslag zoals Grovia die zelf hanteert -- keuze van Max, 2026-08-18.
 *
 * @param {string|Date} datum 'YYYY-MM-DD'
 * @return {string} bijv. '2627'
 */
function bepaalTeamSeizoen(datum) {
  // Bewust zonder Utilities/Session: die bestaan alleen in Apps Script, en deze functie
  // moet met `node --test` te testen zijn.
  const isDatum = datum instanceof Date;
  const tekst = isDatum ? '' : String(datum || '');
  const jaar  = isDatum ? datum.getFullYear()  : Number(tekst.slice(0, 4));
  const maand = isDatum ? datum.getMonth() + 1 : Number(tekst.slice(5, 7));
  if (!jaar || !maand) {
    return '';
  }
  const start = maand >= 5 ? jaar : jaar - 1;
  return String(start).slice(2) + String(start + 1).slice(2);
}

/**
 * Zet de telling van afwijkende seizoenen om in regels voor het runlog.
 *
 * @param {Object} andereSeizoenen seizoen -> aantal, uit bouwSegmenten()
 * @param {string} huidigSeizoen
 * @return {string[]} lege array als alles in het huidige seizoen zit
 */
function seizoenWaarschuwingen(andereSeizoenen, huidigSeizoen) {
  return Object.keys(andereSeizoenen || {}).sort().map(function (seizoen) {
    return 'LET OP: ' + andereSeizoenen[seizoen] + ' deelnemer(s) met seizoen ' + seizoen +
      ' vallen buiten de indeling voor seizoen ' + huidigSeizoen + '.';
  });
}

/**
 * Sorteert van hoge naar lage totaalscore en zet de ranking erbij.
 *
 * Gelijke scores krijgen dezelfde ranking (1, 1, 3 -- niet 1, 2, 3). De volgorde
 * binnen een gelijke score ligt vast op naam_slug, zodat een herberekening de lijst
 * niet laat schudden en een diff van de sheet leesbaar blijft.
 *
 * @param {Object[]} deelnemers met totaalscore
 * @return {Object[]} nieuwe array, gesorteerd, met ranking
 */
function rangschik(deelnemers) {
  const gesorteerd = (deelnemers || []).map(function (d) { return Object.assign({}, d); });

  gesorteerd.sort(function (a, b) {
    // Expliciete takken voor >0, <0 en al het overige. Dat laatste is niet alleen
    // "gelijk": een NaN-score (zie berekenTotaalscore) maakt elk verschil NaN, en een
    // comparator die NaN teruggeeft laat de sortering willekeurig uitpakken. Alles wat
    // niet echt groter of kleiner is, valt daarom terug op de vaste naam_slug-volgorde.
    const verschil = Number(b.totaalscore) - Number(a.totaalscore);
    if (verschil > 0) {
      return 1;
    }
    if (verschil < 0) {
      return -1;
    }
    return String(a.naam_slug) < String(b.naam_slug) ? -1 : 1;
  });

  let vorigeScore = null;
  let vorigeRanking = 0;
  gesorteerd.forEach(function (deelnemer, i) {
    if (deelnemer.totaalscore === vorigeScore) {
      deelnemer.ranking = vorigeRanking;
      return;
    }
    deelnemer.ranking = i + 1;
    vorigeScore = deelnemer.totaalscore;
    vorigeRanking = deelnemer.ranking;
  });

  return gesorteerd;
}

/**
 * Berekent de groepsgroottes: zo gelijk mogelijk, rest naar de bovenste groepen.
 *
 * @param {number} aantal
 * @param {number} aantalGroepen
 * @return {number[]}
 */
function verdeelGroottes(aantal, aantalGroepen) {
  const basis = Math.floor(aantal / aantalGroepen);
  const rest = aantal % aantalGroepen;

  const groottes = [];
  for (let i = 0; i < aantalGroepen; i++) {
    groottes.push(basis + (i < rest ? 1 : 0));
  }
  return groottes;
}

/**
 * Zet voorgestelde_groep op elke deelnemer.
 *
 * @param {Object[]} gerangschikt uitvoer van rangschik()
 * @param {string[]} groepsnamen van STERK naar ZWAK
 * @param {number} aantalGroepen hoeveel groepen dit segment heeft (uit
 *   config.groepen_per_segment). Leeg/0 = gebruik alle groepsnamen. Bij minder groepen
 *   dan namen worden de STERKSTE namen gebruikt: een segment met twee groepen krijgt
 *   dus de eerste twee namen uit de sterk-naar-zwaklijst.
 * @return {Object[]}
 */
function deelInGroepen(gerangschikt, groepsnamen, aantalGroepen) {
  const alleNamen = groepsnamen || [];
  const namen = aantalGroepen ? alleNamen.slice(0, aantalGroepen) : alleNamen;
  const resultaat = gerangschikt.map(function (d) { return Object.assign({}, d); });

  if (!namen.length) {
    resultaat.forEach(function (d) { d.voorgestelde_groep = ''; });
    return resultaat;
  }

  const groottes = verdeelGroottes(resultaat.length, namen.length);
  let positie = 0;
  namen.forEach(function (naam, i) {
    for (let n = 0; n < groottes[i]; n++) {
      resultaat[positie].voorgestelde_groep = naam;
      positie += 1;
    }
  });

  return resultaat;
}

function _teamRij(deelnemer, scoreRij, totaalscore) {
  const rij = {
    naam_slug:          deelnemer.naam_slug,
    naam_kind:          deelnemer.naam_kind,
    geboortedatum_kind: deelnemer.geboortedatum_kind,
    club:               deelnemer.club,
    team:               deelnemer.team,
    totaalscore:        totaalscore
  };
  SCORE_KOLOMMEN.forEach(function (kolom) {
    rij[kolom] = scoreRij ? scoreRij[kolom] : '';
  });
  rij.levels_voltooid = scoreRij ? scoreRij.levels_voltooid : '';
  rij.levels_perfect  = scoreRij ? scoreRij.levels_perfect : '';
  return rij;
}

function _zonderIndeling(deelnemer, scoreRij, totaalscore, reden) {
  const rij = _teamRij(deelnemer, scoreRij, totaalscore === null ? '' : totaalscore);
  rij.vereniging = deelnemer.vereniging;
  rij.rol = deelnemer.rol;
  rij.reden = reden;
  return rij;
}

/**
 * Kolommen van elk tabblad in een teamwerkboek. Bewust GEEN ouder_naam, ouder_email of
 * bedrag: die werkboeken zijn voor trainers, de administratie blijft in het
 * hoofdwerkboek.
 */
const TEAM_KOLOMMEN = [
  'naam_slug', 'naam_kind', 'geboortedatum_kind', 'club', 'team',
  'blocks_planning', 'blocks_flexibiliteit',
  'rally_prestatie', 'rally_kwaliteit', 'rally_reactiesnelheid', 'rally_consistentie',
  'rally_volgehouden_aandacht', 'rally_respons_inhibitie', 'rally_reactie_op_fouten',
  'levels_voltooid', 'levels_perfect',
  'totaalscore', 'ranking', 'voorgestelde_groep', 'definitieve_groep', 'bijgewerkt_op',
  // Alleen gevuld in "Zonder indeling": waarom dit kind niet in te delen was. Staat in
  // dezelfde kolommenlijst zodat alle tabbladen dezelfde vorm houden.
  'reden'
];

const SEGMENT_TABBLADEN = {
  'jong|Speler': 'Jong voetbal',
  'oud|Speler':  'Oud voetbal',
  'jong|Keeper': 'Jong keeper',
  'oud|Keeper':  'Oud keeper'
};

const TABBLAD_ZONDER_INDELING = 'Zonder indeling';

/**
 * Neemt de handmatig ingevulde definitieve_groep over uit wat er al in het tabblad
 * stond.
 *
 * Matchen gebeurt op naam_slug en NOOIT op rijnummer: de volgorde verandert zodra
 * scores wijzigen of er een kind bijkomt, dus een rijnummer verwijst na een
 * herberekening naar iemand anders.
 *
 * @param {Object[]} bestaandeRijen wat er nu in het tabblad staat
 * @param {Object[]} nieuweRijen de nieuw berekende indeling
 * @return {Object[]} nieuweRijen, aangevuld met definitieve_groep
 */
function behoudDefinitieveGroep(bestaandeRijen, nieuweRijen) {
  const definitief = {};
  (bestaandeRijen || []).forEach(function (rij) {
    definitief[String(rij.naam_slug)] = String(rij.definitieve_groep || '');
  });

  return (nieuweRijen || []).map(function (rij) {
    const kopie = Object.assign({}, rij);
    kopie.definitieve_groep = definitief[String(rij.naam_slug)] || '';
    return kopie;
  });
}

/**
 * Bepaalt of het schrijven naar een tabblad overgeslagen moet worden.
 *
 * Een lege nieuwe berekening terwijl het tabblad al inhoud had, is niet hetzelfde als
 * "dit segment is leeg" -- het kan ook een tijdelijke fout stroomopwaarts zijn of een
 * nog niet ingevulde Config. Skip dan het wissen: een tabblad dat ten onrechte blijft
 * staan kan een mens opruimen, een gewiste handmatige indeling kan niemand terughalen.
 *
 * @param {number} aantalBestaand aantal rijen dat nu in het tabblad staat
 * @param {number} aantalNieuw aantal rijen dat de nieuwe berekening opleverde
 * @return {boolean} true als het tabblad ongemoeid moet blijven
 */
function moetTabbladOverslaan(aantalBestaand, aantalNieuw) {
  return aantalNieuw === 0 && aantalBestaand > 0;
}

/**
 * Geeft de gewichtssleutels die de code kent én die daadwerkelijk meewegen.
 *
 * @param {Object} wegingen config.score_wegingen
 * @return {string[]}
 */
function bruikbareWegingen(wegingen) {
  const alle = wegingen || {};
  return GEWOGEN_KOLOMMEN.filter(function (kolom) {
    return (Number(alle[kolom]) || 0) > 0;
  });
}

/**
 * Controleert de met de hand ingevulde Config-blokken van de teamindeling.
 *
 * Alle vier de blokken (wegingen, geboortejaargrens, groepen per segment, werkboek-ID)
 * worden handmatig ingevuld. Eén typfout -- 'Blocks planning' i.p.v. 'blocks_planning',
 * 'speler' i.p.v. 'Speler' -- zette voorheen stil iedereen buiten de indeling, mét een
 * misleidende reden. Zelfde aanpak als verenigingenZonderWerkboek: melden in het runlog,
 * niet stil laten gebeuren.
 *
 * @param {Object} config uit leesConfig()
 * @return {string[]} waarschuwingsregels, leeg als alles klopt
 */
function configWaarschuwingen(config) {
  const meldingen = [];
  const instellingen = config || {};

  const wegingen = instellingen.score_wegingen || {};
  const sleutels = Object.keys(wegingen);
  if (!sleutels.length) {
    meldingen.push('  WAARSCHUWING: Config score_wegingen (Y:Z) is leeg -- geen enkel kind ' +
      'krijgt een totaalscore.');
  } else {
    const onbekend = sleutels.filter(function (sleutel) {
      return GEWOGEN_KOLOMMEN.indexOf(sleutel) === -1;
    }).sort();
    onbekend.forEach(function (sleutel) {
      meldingen.push('  WAARSCHUWING: Config score_wegingen (Y:Z) kent de sleutel "' + sleutel +
        '" niet; die weegt dus niet mee. Verwacht een van: ' + GEWOGEN_KOLOMMEN.join(', ') + '.');
    });
    if (!bruikbareWegingen(wegingen).length) {
      meldingen.push('  WAARSCHUWING: Config score_wegingen (Y:Z) heeft geen enkele bekende ' +
        'schaal met gewicht > 0 -- geen enkel kind krijgt een totaalscore.');
    }
  }

  const grenzen = instellingen.geboortejaargrens || {};
  const rollen = _bekendeRollen();
  if (!Object.keys(grenzen).length) {
    meldingen.push('  WAARSCHUWING: Config geboortejaargrens (AB:AC) is leeg -- niemand is ' +
      'in een leeftijdsgroep in te delen.');
  }
  Object.keys(grenzen).sort().forEach(function (rol) {
    if (rollen.indexOf(rol) === -1) {
      meldingen.push('  WAARSCHUWING: Config geboortejaargrens (AB:AC) kent de rol "' + rol +
        '" niet; verwacht ' + rollen.join(' of ') + ' (hoofdlettergevoelig).');
    }
  });

  Object.keys(instellingen.groepen_per_segment || {}).sort().forEach(function (sleutel) {
    const deel = String(sleutel).split('|');
    if (!SEGMENT_TABBLADEN[deel[1] + '|' + deel[2]]) {
      meldingen.push('  WAARSCHUWING: Config groepen_per_segment (AG:AJ) kent het segment "' +
        sleutel + '" niet; verwacht vereniging + ' +
        Object.keys(SEGMENT_TABBLADEN).join(' / ') + ' (hoofdlettergevoelig).');
    }
  });

  segmentenMetTeVeelGroepen(instellingen.groepen_per_segment, instellingen.groepsnamen)
    .forEach(function (sleutel) {
      meldingen.push('  WAARSCHUWING: Config vraagt voor segment "' + sleutel + '" meer groepen ' +
        'dan er groepsnamen (AE) zijn (' + (instellingen.groepsnamen || []).length +
        '); er worden er stil minder gemaakt.');
    });

  // Cellen die leesConfig() al niet kon lezen (bijv. een gewicht dat geen getal is).
  (instellingen.config_problemen || []).forEach(function (probleem) {
    meldingen.push('  WAARSCHUWING: Config ' + probleem);
  });

  return meldingen;
}

/**
 * Geeft de segmenten waarvoor Config meer groepen vraagt dan er groepsnamen zijn.
 *
 * deelInGroepen kapt in dat geval stil terug naar het aantal beschikbare namen: er
 * komen dan gewoon minder groepen uit, zonder enig signaal. De trainer ziet een
 * indeling die er compleet uitziet maar het niet is.
 *
 * @param {Object} groepenPerSegment config.groepen_per_segment
 * @param {string[]} groepsnamen config.groepsnamen
 * @return {string[]} segmentsleutels, alfabetisch
 */
function segmentenMetTeVeelGroepen(groepenPerSegment, groepsnamen) {
  const aantalNamen = (groepsnamen || []).length;

  return Object.keys(groepenPerSegment || {}).filter(function (sleutel) {
    return (Number(groepenPerSegment[sleutel]) || 0) > aantalNamen;
  }).sort();
}

function _bekendeRollen() {
  const rollen = [];
  Object.keys(SEGMENT_TABBLADEN).forEach(function (sleutel) {
    const rol = sleutel.split('|')[1];
    if (rollen.indexOf(rol) === -1) {
      rollen.push(rol);
    }
  });
  return rollen;
}

/**
 * Bepaalt welke verenigingen kinderen hebben in de data, maar geen werkboek-ID in de
 * config. Zonder deze check verdwijnt zo'n vereniging stil: er wordt niets geschreven
 * en er komt geen melding. bouwSegmenten belooft dat niemand stil verdwijnt; dit
 * bewaakt die belofte ook aan de schrijfkant.
 *
 * @param {Object} segmenten uit bouwSegmenten(), sleutels van de vorm 'vereniging|leeftijd|rol'
 * @param {Object[]} zonderIndeling uit bouwSegmenten(), elke rij heeft een vereniging-veld
 * @param {Object} werkboeken config.teamindeling_werkboeken, {vereniging: '<sheet-id>'}
 * @return {string[]} verenigingen met kinderen maar zonder werkboek-ID, alfabetisch
 */
function verenigingenZonderWerkboek(segmenten, zonderIndeling, werkboeken) {
  const metKinderen = {};

  Object.keys(segmenten || {}).forEach(function (sleutel) {
    if ((segmenten[sleutel] || []).length) {
      metKinderen[sleutel.split('|')[0]] = true;
    }
  });
  (zonderIndeling || []).forEach(function (rij) {
    metKinderen[String(rij.vereniging)] = true;
  });

  return Object.keys(metKinderen).filter(function (vereniging) {
    return !Object.prototype.hasOwnProperty.call(werkboeken || {}, vereniging);
  }).sort();
}

/**
 * Schrijft de indeling naar de werkboeken per vereniging.
 *
 * @param {Object} config uit leesConfig()
 * @param {Object} segmenten uit bouwSegmenten()
 * @param {Object[]} zonderIndeling uit bouwSegmenten()
 * @param {string} vandaag 'YYYY-MM-DD'
 * @return {string[]} meldingen voor het runlog
 */
function schrijfTeamindeling(config, segmenten, zonderIndeling, vandaag) {
  // Config-controles eerst: alle vier de blokken worden met de hand ingevuld, en een
  // typfout daarin verklaart een lege of scheve indeling beter dan de indeling zelf.
  const meldingen = configWaarschuwingen(config);
  const werkboeken = config.teamindeling_werkboeken || {};

  verenigingenZonderWerkboek(segmenten, zonderIndeling, werkboeken).forEach(function (vereniging) {
    meldingen.push('  WAARSCHUWING: vereniging ' + vereniging +
      ' heeft kinderen maar geen werkboek-ID in config.teamindeling_werkboeken');
  });

  Object.keys(werkboeken).forEach(function (vereniging) {
    // Eigen try/catch per vereniging: een ingetrokken recht of een typefout in één
    // werkboek-ID liet anders de tweede academie die dag zonder werkboek zitten.
    try {
      meldingen.push.apply(meldingen,
        _schrijfWerkboek(vereniging, werkboeken[vereniging], config, segmenten, zonderIndeling, vandaag));
    } catch (fout) {
      meldingen.push('  WAARSCHUWING: vereniging ' + vereniging +
        ' overgeslagen, werkboek niet bij te werken: ' + fout.message);
    }
  });

  return meldingen;
}

/**
 * Werkt het werkboek van één vereniging bij. Apart van schrijfTeamindeling zodat één
 * onbereikbaar werkboek de andere academies niet meesleept.
 *
 * @return {string[]} meldingen voor het runlog
 */
function _schrijfWerkboek(vereniging, werkboekId, config, segmenten, zonderIndeling, vandaag) {
  const meldingen = [];
  const bestand = SpreadsheetApp.openById(werkboekId);

  Object.keys(SEGMENT_TABBLADEN).forEach(function (leeftijdRol) {
    const sleutel = vereniging + '|' + leeftijdRol;
    const gerangschikt = deelInGroepen(
      rangschik(segmenten[sleutel] || []),
      config.groepsnamen,
      (config.groepen_per_segment || {})[sleutel]
    );
    const resultaat = _schrijfTabblad(
      bestand, SEGMENT_TABBLADEN[leeftijdRol], gerangschikt, vandaag);
    if (resultaat.overgeslagen) {
      meldingen.push('  WAARSCHUWING: ' + vereniging + ' / ' + SEGMENT_TABBLADEN[leeftijdRol] +
        ': overgeslagen, berekening gaf 0 rijen terwijl er ' + resultaat.aantal +
        ' in het tabblad stonden');
    } else {
      meldingen.push('  ' + vereniging + ' / ' + SEGMENT_TABBLADEN[leeftijdRol] + ': ' + resultaat.aantal);
    }
  });

  const eigenZonderIndeling = zonderIndeling.filter(function (rij) {
    return String(rij.vereniging) === vereniging;
  });
  const resultaatZonderIndeling = _schrijfTabblad(
    bestand, TABBLAD_ZONDER_INDELING, eigenZonderIndeling, vandaag);
  if (resultaatZonderIndeling.overgeslagen) {
    meldingen.push('  WAARSCHUWING: ' + vereniging + ' / ' + TABBLAD_ZONDER_INDELING +
      ': overgeslagen, berekening gaf 0 rijen terwijl er ' + resultaatZonderIndeling.aantal +
      ' in het tabblad stonden');
  } else if (eigenZonderIndeling.length) {
    meldingen.push('  ' + vereniging + ' / ' + TABBLAD_ZONDER_INDELING + ': ' +
      eigenZonderIndeling.length + ' kind(eren) nog niet in te delen');
  }

  return meldingen;
}

function _schrijfTabblad(bestand, tabbladnaam, nieuweRijen, vandaag) {
  let tab = bestand.getSheetByName(tabbladnaam);
  if (!tab) {
    tab = bestand.insertSheet(tabbladnaam);
    tab.getRange(1, 1, 1, TEAM_KOLOMMEN.length).setValues([TEAM_KOLOMMEN]);
  }

  const bestaand = _leesTabblad(tab);

  if (moetTabbladOverslaan(bestaand.length, nieuweRijen.length)) {
    return { aantal: bestaand.length, overgeslagen: true };
  }

  const rijen = behoudDefinitieveGroep(bestaand, nieuweRijen);
  rijen.forEach(function (rij) { rij.bijgewerkt_op = vandaag; });

  if (tab.getLastRow() > 1) {
    tab.getRange(2, 1, tab.getLastRow() - 1, TEAM_KOLOMMEN.length).clearContent();
  }
  if (!rijen.length) {
    return { aantal: 0, overgeslagen: false };
  }

  const waarden = rijen.map(function (rij) {
    return TEAM_KOLOMMEN.map(function (kolom) {
      const waarde = rij[kolom];
      return (waarde === undefined || waarde === null) ? '' : waarde;
    });
  });
  tab.getRange(2, 1, waarden.length, TEAM_KOLOMMEN.length).setValues(waarden);

  return { aantal: rijen.length, overgeslagen: false };
}

function _leesTabblad(tab) {
  const laatste = tab.getLastRow();
  if (laatste < 1) {
    return [];
  }

  // Kopregelcontrole (controleerKopregel staat in Sheet.gs): ook deze tabbladen worden
  // gelezen en geschreven op kolompositie, en een trainer kan er kolommen in verschuiven.
  controleerKopregel(tab.getName(),
    tab.getRange(1, 1, 1, TEAM_KOLOMMEN.length).getValues()[0], TEAM_KOLOMMEN);

  if (laatste < 2) {
    return [];
  }

  return tab.getRange(2, 1, laatste - 1, TEAM_KOLOMMEN.length).getValues().map(function (rij) {
    const object = {};
    TEAM_KOLOMMEN.forEach(function (kolom, i) { object[kolom] = rij[i]; });
    object.naam_slug = String(object.naam_slug || '');
    return object;
  });
}

// Alleen voor `node --test`; Apps Script kent `module` niet en slaat dit over.
if (typeof module !== 'undefined') {
  module.exports = {
    SCORE_KOLOMMEN: SCORE_KOLOMMEN,
    bepaalLeeftijdsgroep: bepaalLeeftijdsgroep,
    berekenTotaalscore: berekenTotaalscore,
    bouwSegmenten: bouwSegmenten,
    rangschik: rangschik,
    deelInGroepen: deelInGroepen,
    verdeelGroottes: verdeelGroottes,
    TEAM_KOLOMMEN: TEAM_KOLOMMEN,
    SEGMENT_TABBLADEN: SEGMENT_TABBLADEN,
    behoudDefinitieveGroep: behoudDefinitieveGroep,
    moetTabbladOverslaan: moetTabbladOverslaan,
    GEWOGEN_KOLOMMEN: GEWOGEN_KOLOMMEN,
    bruikbareWegingen: bruikbareWegingen,
    configWaarschuwingen: configWaarschuwingen,
    segmentenMetTeVeelGroepen: segmentenMetTeVeelGroepen,
    verenigingenZonderWerkboek: verenigingenZonderWerkboek,
    seizoenWaarschuwingen: seizoenWaarschuwingen,
    bepaalTeamSeizoen: bepaalTeamSeizoen
  };
}
