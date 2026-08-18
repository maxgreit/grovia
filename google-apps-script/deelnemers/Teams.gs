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

// Alleen voor `node --test`; Apps Script kent `module` niet en slaat dit over.
if (typeof module !== 'undefined') {
  module.exports = {
    SCORE_KOLOMMEN: SCORE_KOLOMMEN,
    bepaalLeeftijdsgroep: bepaalLeeftijdsgroep,
    berekenTotaalscore: berekenTotaalscore
  };
}
