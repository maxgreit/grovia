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

// Alleen voor `node --test`; Apps Script kent `module` niet en slaat dit over.
if (typeof module !== 'undefined') {
  module.exports = {
    SCORE_KOLOMMEN: SCORE_KOLOMMEN,
    bepaalLeeftijdsgroep: bepaalLeeftijdsgroep,
    berekenTotaalscore: berekenTotaalscore,
    bouwSegmenten: bouwSegmenten,
    rangschik: rangschik,
    deelInGroepen: deelInGroepen,
    verdeelGroottes: verdeelGroottes
  };
}
