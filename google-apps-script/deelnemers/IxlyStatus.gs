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
    if (!rij.ixly_af && rij.code) {
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
 * @param {Object[]} rijen deelnemersrijen
 * @param {number} batchGrootte maximaal aantal codes per run
 * @param {string} vandaag 'YYYY-MM-DD'
 * @return {{rijen: Object[], bijgewerkt: number, fouten: string[]}}
 */
function werkIxlyBij(rijen, batchGrootte, vandaag) {
  const kopie  = rijen.map(function (r) { return Object.assign({}, r); });
  const fouten = [];

  const teDoen = kiesTeControlerenIndexen(kopie, batchGrootte);
  if (!teDoen.length) {
    return { rijen: kopie, bijgewerkt: 0, fouten: fouten };
  }

  const codes = teDoen.map(function (i) { return String(kopie[i].code); });
  const resultaten = _vraagStatusOp(codes);

  let bijgewerkt = 0;
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
    if (resultaat.af) {
      kopie[i].ixly_af = true;
      kopie[i].ixly_op = String(resultaat.completed_at || '').slice(0, 10);
      bijgewerkt += 1;
    }
  });

  return { rijen: kopie, bijgewerkt: bijgewerkt, fouten: fouten };
}

function _vraagStatusOp(codes) {
  const url = leesGeheimen().ixly_status_url;
  if (!url) {
    throw new Error('IXLY_STATUS_URL niet gezet in de Script Properties.');
  }

  const respons = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ order_ids: codes }),
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
  module.exports = { kiesTeControlerenIndexen: kiesTeControlerenIndexen };
}
