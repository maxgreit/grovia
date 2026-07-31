/**
 * Werkt de Ixly-afrondingsstatus bij via de ixly-status Azure Function.
 *
 * De Sheet praat niet zelf met Ixly: die credentials horen in Azure, niet in een
 * deelbaar werkboek.
 */

/**
 * @param {Object[]} rijen deelnemersrijen
 * @param {number} batchGrootte maximaal aantal codes per run
 * @return {{rijen: Object[], bijgewerkt: number, fouten: string[]}}
 */
function werkIxlyBij(rijen, batchGrootte) {
  const kopie  = rijen.map(function (r) { return Object.assign({}, r); });
  const fouten = [];

  const openIndexen = [];
  kopie.forEach(function (rij, i) {
    if (!rij.ixly_af && rij.code) {
      openIndexen.push(i);
    }
  });

  if (!openIndexen.length) {
    return { rijen: kopie, bijgewerkt: 0, fouten: fouten };
  }

  const teDoen = openIndexen.slice(0, batchGrootte);
  if (openIndexen.length > teDoen.length) {
    Logger.log('Ixly: ' + (openIndexen.length - teDoen.length) + ' rijen overgeslagen, gaan mee in de volgende run.');
  }

  const codes = teDoen.map(function (i) { return String(kopie[i].code); });
  const resultaten = _vraagStatusOp(codes);

  let bijgewerkt = 0;
  teDoen.forEach(function (i) {
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
