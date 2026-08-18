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

  const kolommen = Object.keys(wegingen || {});
  for (let i = 0; i < kolommen.length; i++) {
    const kolom = kolommen[i];
    const gewicht = Number(wegingen[kolom]) || 0;
    if (gewicht <= 0) {
      continue;
    }

    const waarde = scoreRij[kolom];
    if (waarde === '' || waarde === undefined || waarde === null) {
      return null;
    }

    som += Number(waarde) * gewicht;
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
 * @param {Object[]} deelnemers rijen uit leesDeelnemers()
 * @param {Object[]} scoreRijen rijen uit leesIxlyScores()
 * @param {Object} config met geboortejaargrens en score_wegingen
 * @return {{segmenten: Object, zonderIndeling: Object[]}}
 */
function bouwSegmenten(deelnemers, scoreRijen, config) {
  const scoresPerSlug = {};
  (scoreRijen || []).forEach(function (rij) {
    scoresPerSlug[String(rij.naam_slug)] = rij;
  });

  const segmenten = {};
  const zonderIndeling = [];

  (deelnemers || []).forEach(function (deelnemer) {
    if (String(deelnemer.vereniging) === VERENIGING_MINIMOVE) {
      return;
    }

    const scoreRij = scoresPerSlug[String(deelnemer.naam_slug)];
    if (!scoreRij) {
      zonderIndeling.push(_zonderIndeling(deelnemer, null, null, 'nog geen score bekend'));
      return;
    }

    const totaalscore = berekenTotaalscore(scoreRij, config.score_wegingen);
    if (totaalscore === null) {
      zonderIndeling.push(_zonderIndeling(deelnemer, scoreRij, null, 'onvolledige score'));
      return;
    }

    const leeftijd = bepaalLeeftijdsgroep(
      deelnemer.geboortedatum_kind, deelnemer.rol, config.geboortejaargrens);
    if (!leeftijd) {
      zonderIndeling.push(
        _zonderIndeling(deelnemer, scoreRij, totaalscore, 'geen geboortedatum of onbekende rol'));
      return;
    }

    const sleutel = deelnemer.vereniging + '|' + leeftijd + '|' + deelnemer.rol;
    if (!segmenten[sleutel]) {
      segmenten[sleutel] = [];
    }
    segmenten[sleutel].push(_teamRij(deelnemer, scoreRij, totaalscore));
  });

  return { segmenten: segmenten, zonderIndeling: zonderIndeling };
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
    if (b.totaalscore !== a.totaalscore) {
      return b.totaalscore - a.totaalscore;
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
  const meldingen = [];
  const werkboeken = config.teamindeling_werkboeken || {};

  verenigingenZonderWerkboek(segmenten, zonderIndeling, werkboeken).forEach(function (vereniging) {
    meldingen.push('  WAARSCHUWING: vereniging ' + vereniging +
      ' heeft kinderen maar geen werkboek-ID in config.teamindeling_werkboeken');
  });

  Object.keys(werkboeken).forEach(function (vereniging) {
    const bestand = SpreadsheetApp.openById(werkboeken[vereniging]);

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
  });

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
    verenigingenZonderWerkboek: verenigingenZonderWerkboek
  };
}
