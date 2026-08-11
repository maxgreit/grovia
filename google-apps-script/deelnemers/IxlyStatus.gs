/**
 * Werkt de Ixly-afrondingsstatus bij via de ixly-status Azure Function.
 *
 * De Sheet praat niet zelf met Ixly: die credentials horen in Azure, niet in een
 * deelbaar werkboek.
 */

/**
 * Kiest welke rij-indexen deze run bij Ixly gecontroleerd worden: nog niet afgerond,
 * heeft een code, en het langst geleden (of nooit) gecontroleerd eerst. Zo krijgt elke
 * openstaande rij op termijn een beurt in plaats van dat de eerste N rijen permanent
 * voorrang houden.
 *
 * @param {Object[]} rijen
 * @param {number} batchGrootte
 * @return {number[]} indexen, gesorteerd op prioriteit, afgekapt op batchGrootte
 */
function kiesTeControlerenIndexen(rijen, batchGrootte) {
  const openIndexen = [];
  rijen.forEach(function (rij, i) {
    if (!rij.ixly_af && rij.code && rij.ixly_taken && rij.ixly_taken.length) {
      openIndexen.push(i);
    }
  });

  openIndexen.sort(function (a, b) {
    const datumA = rijen[a].ixly_laatste_gecontroleerd_op || '';
    const datumB = rijen[b].ixly_laatste_gecontroleerd_op || '';
    // Leeg (nooit gecontroleerd) komt vóór elke datum -- '' < elke 'YYYY-MM-DD' string.
    if (datumA !== datumB) {
      return datumA < datumB ? -1 : 1;
    }
    return a - b; // stabiele volgorde bij gelijke datum
  });

  return openIndexen.slice(0, batchGrootte);
}

/**
 * Verwerkt de statusresultaten in de rijen. Puur (geen UrlFetchApp/SpreadsheetApp),
 * zodat dit met `node --test` te testen is -- vandaar de scheiding met werkIxlyBij.
 *
 * Onderscheidt bewust twee soorten problemen:
 *
 *  - `fouten`    -- een echte Ixly-fout (HTTP 500/502, tokenprobleem). Dagelijks.gs zet
 *                   hierop dataBetrouwbaar = false en slaat ALLE reminders van die dag
 *                   over. Correct: bij een storing weten we niet wie er af is.
 *  - `verouderd` -- de assignment bestaat nog, maar de candidate_task erachter is bij
 *                   Ixly verdwenen (404). Zo'n rij is niet te repareren via de API (er is
 *                   geen endpoint om de assignments van een kandidaat op te vragen) en
 *                   blijft dus PERMANENT in deze staat. Dit mag daarom nooit in `fouten`
 *                   belanden: dan zou één zo'n rij vanaf nu elke dag alle reminders
 *                   blokkeren. Landt in plaats daarvan in het Controleren-tabblad.
 *
 * @param {Object[]} rijen
 * @param {number[]} teDoen indexen die gecontroleerd zijn
 * @param {Object} resultaten map code -> resultaat uit de ixly-status function
 * @param {string} vandaag 'YYYY-MM-DD'
 * @return {{rijen: Object[], bijgewerkt: number, fouten: string[], verouderd: Object[]}}
 */
function verwerkIxlyResultaten(rijen, teDoen, resultaten, vandaag) {
  const kopie     = rijen.map(function (r) { return Object.assign({}, r); });
  const fouten    = [];
  const verouderd = [];
  let bijgewerkt  = 0;

  teDoen.forEach(function (i) {
    // Elke gecontroleerde rij krijgt vandaag als datum, ongeacht fout of afronding --
    // anders blijft een rij met een fout of een niet-afgeronde status permanent vooraan
    // staan en roteert de batch alsnog niet.
    kopie[i].ixly_laatste_gecontroleerd_op = vandaag;

    const resultaat = resultaten[String(kopie[i].code)];
    if (!resultaat) {
      return;
    }
    if (resultaat.fout) {
      fouten.push('Code ' + kopie[i].code + ': ' + resultaat.fout);
      return;
    }
    if (resultaat.verouderd) {
      verouderd.push({
        code:        String(kopie[i].code),
        datum:       kopie[i].uitgenodigd_op || '',
        naam_kind:   kopie[i].naam_kind || '',
        ouder_email: kopie[i].ouder_email || '',
        reden:       resultaat.reden || 'Verouderde Ixly-referentie'
      });
      return;
    }
    if (resultaat.af) {
      kopie[i].ixly_af = true;
      kopie[i].ixly_op = String(resultaat.completed_at || '').slice(0, 10);
      bijgewerkt += 1;
    }
  });

  return { rijen: kopie, bijgewerkt: bijgewerkt, fouten: fouten, verouderd: verouderd };
}

/**
 * @param {Object[]} rijen deelnemersrijen
 * @param {number} batchGrootte maximaal aantal codes per run
 * @param {string} vandaag 'YYYY-MM-DD'
 * @return {{rijen: Object[], bijgewerkt: number, fouten: string[], verouderd: Object[]}}
 */
function werkIxlyBij(rijen, batchGrootte, vandaag) {
  const kopie = rijen.map(function (r) { return Object.assign({}, r); });

  const teDoen = kiesTeControlerenIndexen(kopie, batchGrootte);
  if (!teDoen.length) {
    return { rijen: kopie, bijgewerkt: 0, fouten: [], verouderd: [] };
  }

  const orders = teDoen.map(function (i) {
    return { order_id: String(kopie[i].code), taken: kopie[i].ixly_taken };
  });
  const resultaten = _vraagStatusOp(orders);

  return verwerkIxlyResultaten(kopie, teDoen, resultaten, vandaag);
}

function _vraagStatusOp(orders) {
  const url = leesGeheimen().ixly_status_url;
  if (!url) {
    throw new Error('IXLY_STATUS_URL niet gezet in de Script Properties.');
  }

  const respons = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ orders: orders }),
    muteHttpExceptions: true
  });

  const code = respons.getResponseCode();
  if (code !== 200) {
    throw new Error('ixly-status gaf HTTP ' + code + ': ' + respons.getContentText().slice(0, 200));
  }

  return JSON.parse(respons.getContentText()).resultaten || {};
}

// Alleen voor `node --test`; Apps Script kent `module` niet en slaat dit over.
if (typeof module !== 'undefined') {
  module.exports = {
    kiesTeControlerenIndexen: kiesTeControlerenIndexen,
    verwerkIxlyResultaten:    verwerkIxlyResultaten
  };
}
