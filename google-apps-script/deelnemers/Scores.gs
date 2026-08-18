/**
 * Haalt de Ixly-scores op via de ixly-scores Azure Function en vertaalt ze naar de
 * kolommen van het tabblad "Ixly Scores".
 *
 * De Sheet praat niet zelf met Ixly: die credentials horen in Azure, niet in een
 * deelbaar werkboek.
 */

/**
 * Ixly's eigen sleutels -> onze kolomnamen.
 *
 * HERKOMST: live geverifieerd op 2026-08-18 tegen candidate_tasks/{uuid}/score van
 * Magnus Boekel (order 1345, beide games 'finished'). Blocks levert precies twee
 * genormeerde schalen, Rally zeven. Voeg hier NOOIT een sleutel toe op basis van een
 * aanname -- het swagger-voorbeeld bij dit endpoint gaat over heel andere assessments
 * (ITS/WPV) en zegt niets over de games. Zie ADR-013 en de 'completed'-bug: een
 * onbevestigde API-waarde is geen feit.
 */
const VELD_VERTALING = {
  blocks: {
    planning:    'blocks_planning',
    flexibility: 'blocks_flexibiliteit'
  },
  rally: {
    performance:          'rally_prestatie',
    quality:              'rally_kwaliteit',
    reaction_time:        'rally_reactiesnelheid',
    consistence:          'rally_consistentie',
    sustained_attention:  'rally_volgehouden_aandacht',
    response_inhibition:  'rally_respons_inhibitie',
    response_to_mistakes: 'rally_reactie_op_fouten'
  }
};

/**
 * Zet één API-resultaat om in een rij voor "Ixly Scores".
 *
 * Ontbrekende schalen blijven leeg ('') en worden GEEN 0 -- een kind dat een game niet
 * gedaan heeft moet te onderscheiden zijn van een kind dat er nul scoorde.
 *
 * @param {string} naamSlug
 * @param {string} naamKind
 * @param {Object} apiResultaat zoals ixly-scores het teruggeeft
 * @param {string} vandaag 'YYYY-MM-DD'
 * @return {Object} rij met de kolommen uit IXLY_SCORES_KOLOMMEN
 */
function naarScoreRij(naamSlug, naamKind, apiResultaat, vandaag) {
  const rij = { naam_slug: naamSlug, naam_kind: naamKind };

  Object.keys(VELD_VERTALING).forEach(function (game) {
    const scores = (apiResultaat && apiResultaat[game]) || {};
    Object.keys(VELD_VERTALING[game]).forEach(function (ixlySleutel) {
      const kolom = VELD_VERTALING[game][ixlySleutel];
      const waarde = scores[ixlySleutel];
      rij[kolom] = (waarde === undefined || waarde === null) ? '' : waarde;
    });
  });

  rij.levels_voltooid = _ofLeeg(apiResultaat && apiResultaat.levels_voltooid);
  rij.levels_perfect  = _ofLeeg(apiResultaat && apiResultaat.levels_perfect);
  rij.bron            = 'api';
  rij.opgehaald_op    = vandaag;

  return rij;
}

/**
 * Bepaalt of een API-resultaat echt een score is en dus bewaard mag worden.
 *
 * DREMPEL: alle negen genormeerde schalen. Reden: `_verzamel_scores` (ixly-scores)
 * geeft een volledig LEGE, foutloze vorm terug zodra een assignment (nog) niet
 * zichtbaar is voor het eerste token of Ixly de score nog niet berekend heeft -- en
 * stap 8 draait bewust in dezelfde run als stap 3, dus een kind dat vandaag afrondt
 * wordt vandaag al bevraagd. Zou zo'n lege of halve respons weggeschreven worden, dan
 * ziet `kiesTeOphalenIndexen` dat kind voortaan als "heeft al een score" en wordt het
 * NOOIT meer opgehaald: permanent "Zonder indeling".
 *
 * Een halve respons (alleen Blocks afgerond) gaat om die reden ook niet mee: de
 * score-respons van Ixly is cumulatief per kandidaat, dus een volgende run levert
 * alsnog álles op. Er gaat dus niets verloren door nu nog niet te schrijven, terwijl
 * een halve rij wél permanent zou blokkeren. `voegScoresSamen` blijft nodig voor de
 * handmatig ingevoerde rijen; die aanvulling is niet de weg voor API-rijen.
 *
 * De leveltellingen tellen bewust niet mee: die horen bij Blocks en zeggen niets over
 * de volledigheid van de negen schalen waarop de totaalscore gebaseerd is.
 *
 * @param {Object} apiResultaat zoals ixly-scores het teruggeeft
 * @return {boolean}
 */
function heeftVolledigeScores(apiResultaat) {
  if (!apiResultaat || apiResultaat.fout) {
    return false;
  }

  return Object.keys(VELD_VERTALING).every(function (game) {
    const scores = apiResultaat[game] || {};
    return Object.keys(VELD_VERTALING[game]).every(function (ixlySleutel) {
      const waarde = scores[ixlySleutel];
      return waarde !== undefined && waarde !== null && waarde !== '';
    });
  });
}

/**
 * Kiest welke deelnemersrijen deze run bij Ixly opgehaald worden: Ixly afgerond, met
 * bewaarde assignment-uuid's, en nog zonder rij in "Ixly Scores".
 *
 * Een kind met een score wordt NIET opnieuw bevraagd -- scores veranderen niet en dat
 * scheelt honderden aanroepen per week. Handmatig ingevoerde rijen tellen ook als
 * 'heeft al een score' en blijven dus met rust.
 *
 * @param {Object[]} deelnemersRijen
 * @param {Object[]} scoreRijen bestaande rijen uit "Ixly Scores"
 * @param {number} batchGrootte
 * @return {number[]} indexen in deelnemersRijen, afgekapt op batchGrootte
 */
function kiesTeOphalenIndexen(deelnemersRijen, scoreRijen, batchGrootte) {
  const alBekend = {};
  (scoreRijen || []).forEach(function (rij) {
    alBekend[String(rij.naam_slug)] = true;
  });

  const indexen = [];
  deelnemersRijen.forEach(function (rij, i) {
    if (!rij.ixly_af) {
      return;
    }
    // Zonder code is er geen order_id om mee te bevragen; zo'n rij vult elke run een
    // plek in de batch zonder ooit iets op te leveren. Zelfde controle als
    // kiesTeControlerenIndexen in IxlyStatus.gs.
    if (!rij.code) {
      return;
    }
    if (!rij.ixly_taken || !rij.ixly_taken.length) {
      return;
    }
    if (alBekend[String(rij.naam_slug)]) {
      return;
    }
    indexen.push(i);
  });

  return indexen.slice(0, batchGrootte);
}

function _ofLeeg(waarde) {
  return (waarde === undefined || waarde === null) ? '' : waarde;
}

/**
 * Haalt de nog ontbrekende scores op en voegt ze samen met "Ixly Scores".
 *
 * @param {Object[]} deelnemersRijen
 * @param {number} batchGrootte
 * @param {string} vandaag 'YYYY-MM-DD'
 * @return {{rijen: Object[], opgehaald: number, zonderScores: number}}
 *   zonderScores = bevraagd, maar (nog) geen volledige scores terug
 */
function haalScoresOp(deelnemersRijen, batchGrootte, vandaag) {
  const bestaand = leesIxlyScores();
  const teDoen = kiesTeOphalenIndexen(deelnemersRijen, bestaand, batchGrootte);
  if (!teDoen.length) {
    return { rijen: bestaand, opgehaald: 0, zonderScores: 0 };
  }

  const payload = teDoen.map(function (i) {
    return { order_id: String(deelnemersRijen[i].code), taken: deelnemersRijen[i].ixly_taken };
  });
  const resultaten = _vraagScoresOp(payload);

  const nieuweRijen = [];
  let zonderScores = 0;
  teDoen.forEach(function (i) {
    const resultaat = resultaten[String(deelnemersRijen[i].code)];
    // Alleen een écht (volledig) resultaat wordt bewaard -- een lege of halve respons
    // is geen score en zou dit kind permanent blokkeren, zie heeftVolledigeScores.
    if (!heeftVolledigeScores(resultaat)) {
      zonderScores += 1;
      return;
    }
    nieuweRijen.push(naarScoreRij(
      deelnemersRijen[i].naam_slug, deelnemersRijen[i].naam_kind, resultaat, vandaag));
  });

  return {
    rijen: voegScoresSamen(bestaand, nieuweRijen),
    opgehaald: nieuweRijen.length,
    zonderScores: zonderScores
  };
}

function _vraagScoresOp(deelnemers) {
  const url = leesGeheimen().ixly_scores_url;
  if (!url) {
    throw new Error('IXLY_SCORES_URL niet gezet in de Script Properties.');
  }

  const respons = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ deelnemers: deelnemers }),
    muteHttpExceptions: true
  });

  const code = respons.getResponseCode();
  if (code !== 200) {
    throw new Error('ixly-scores gaf HTTP ' + code + ': ' + respons.getContentText().slice(0, 200));
  }

  return JSON.parse(respons.getContentText()).resultaten || {};
}

// Alleen voor `node --test`; Apps Script kent `module` niet en slaat dit over.
if (typeof module !== 'undefined') {
  module.exports = {
    VELD_VERTALING: VELD_VERTALING,
    naarScoreRij: naarScoreRij,
    heeftVolledigeScores: heeftVolledigeScores,
    kiesTeOphalenIndexen: kiesTeOphalenIndexen
  };
}
