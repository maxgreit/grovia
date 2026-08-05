/**
 * Haalt orders en producten op via de WooCommerce REST API v3.
 *
 * Pull in plaats van push: zo kan de administratie op elk moment opnieuw opgebouwd
 * worden en is er nooit een gemiste webhook.
 */

/**
 * Haalt alle orders op die sinds een datum zijn aangemaakt.
 *
 * @param {string} sinds 'YYYY-MM-DD'
 * @return {Object[]} genormaliseerde orders voor upsertDeelnemers
 */
function haalOrders(sinds) {
  const geheimen  = leesGeheimen();
  const producten = _haalProductCategorieen(geheimen);
  const orders    = [];

  let pagina = 1;
  while (true) {
    const parameters = [
      'per_page=100',
      'page=' + pagina,
      // modified_after (niet after): een order die pas dagen later op 'processing'
      // springt (bijv. na een bankoverschrijving) moet ook meegenomen worden -- after
      // filtert op aanmaakdatum en zou zo'n order permanent kunnen missen.
      'modified_after=' + encodeURIComponent(sinds + 'T00:00:00'),
      'status=processing,completed',
      'consumer_key=' + encodeURIComponent(geheimen.woo_key),
      'consumer_secret=' + encodeURIComponent(geheimen.woo_secret)
    ].join('&');

    const batch = _haalJson(geheimen.woo_basis_url + '/wp-json/wc/v3/orders?' + parameters);
    if (!batch.length) {
      break;
    }

    batch.forEach(function (order) {
      orders.push(_normaliseer(order, producten));
    });

    pagina += 1;
    // Korte adempauze tussen pagina's -- voorkomt dat een run met veel pagina's
    // zelf al als een burst overkomt voor de WAF (zie _haalJson hierboven).
    Utilities.sleep(300);
  }

  return orders;
}

/**
 * Haalt orderREGELS (niet orders) op sinds een datum, met de 'pa_inschrijving'-slug
 * (cyclus-1/2/3, seizoenkaart-...) per regel. Op regelniveau i.p.v. orderniveau, zodat
 * het Financieel-rapport (Financieel.gs) een kind dat aparte orders voor cyclus 1
 * én cyclus 2 plaatst in allebei kan meetellen -- haalOrders()/_normaliseer()
 * hierboven bewaart alleen het product van de order als geheel, niet per regel, en
 * upsertDeelnemers (Deelnemers.gs) bewaart alleen de EERSTE order per kind.
 *
 * @param {string} sinds 'YYYY-MM-DD'
 * @return {Object[]} {order_id, datum, naam_kind, categorieen, inschrijving, bedrag}
 */
function haalOrderRegels(sinds) {
  const geheimen  = leesGeheimen();
  const producten = _haalProductCategorieen(geheimen);
  const regels    = [];

  // Deze functie draait in de dagelijkse run vlak ná haalOrders() (Stap 1) -- twee
  // volledige orders-ophalingen kort na elkaar is precies het patroon dat de WAF
  // eerder al liet stranden bij de productcatalogus (zie _haalProductCategorieen).
  // Een paar seconden pauze breekt die burst op.
  Utilities.sleep(3000);

  let pagina = 1;
  while (true) {
    const parameters = [
      'per_page=100',
      'page=' + pagina,
      'modified_after=' + encodeURIComponent(sinds + 'T00:00:00'),
      'status=processing,completed',
      'consumer_key=' + encodeURIComponent(geheimen.woo_key),
      'consumer_secret=' + encodeURIComponent(geheimen.woo_secret)
    ].join('&');

    const batch = _haalJson(geheimen.woo_basis_url + '/wp-json/wc/v3/orders?' + parameters);
    if (!batch.length) {
      break;
    }

    batch.forEach(function (order) {
      const datum = String(order.date_created || '').slice(0, 10);
      const naamKindVeld = (order.meta_data || []).filter(function (m) {
        return m.key === 'Naam kind';
      })[0];
      const naam_kind = naamKindVeld ? String(naamKindVeld.value).trim() : '';

      (order.line_items || []).forEach(function (item) {
        const categorieen = producten[String(item.product_id)] || [];
        // 'pa_inschrijving' is de WooCommerce-variatie-attribuutsleutel (pa_-prefix)
        // voor Cyclus 1/2/3 / Seizoenkaart -- een variatie, geen categorie. Waarde is
        // de ruwe slug (bijv. 'cyclus-1'), geverifieerd tegen echte orderdata
        // (2026-08-04). Vertaling naar een leesbare fasecode gebeurt in Financieel.gs
        // via mapping.fases.
        const inschrijvingVeld = (item.meta_data || []).filter(function (m) {
          return m.key === 'pa_inschrijving';
        })[0];

        regels.push({
          order_id:     String(order.id),
          datum:        datum,
          naam_kind:    naam_kind,
          categorieen:  categorieen,
          inschrijving: inschrijvingVeld ? String(inschrijvingVeld.value).trim() : '',
          bedrag:       Number(item.total) || 0
        });
      });
    });

    pagina += 1;
    Utilities.sleep(300);
  }

  return regels;
}

/**
 * Kort gecached (5 min, ScriptCache): binnen één dagelijkseRun-uitvoering roepen
 * zowel haalOrders() (Stap 1) als haalOrderRegels() (Stap 6) deze functie aan --
 * zonder cache dus twee volledige productcatalogus-ophalingen kort na elkaar, wat
 * precies het soort dubbele belasting is die de WAF op grovia.nl eerder al liet
 * stranden (zie ADR-008-vervolg). De cache voorkomt die verdubbeling.
 */
function _haalProductCategorieen(geheimen) {
  const cache = CacheService.getScriptCache();
  const CACHE_SLEUTEL = 'grovia_producten_categorieen';

  const gecached = cache.get(CACHE_SLEUTEL);
  if (gecached) {
    return JSON.parse(gecached);
  }

  const kaart = {};
  let pagina = 1;

  while (true) {
    const parameters = [
      'per_page=100',
      'page=' + pagina,
      'consumer_key=' + encodeURIComponent(geheimen.woo_key),
      'consumer_secret=' + encodeURIComponent(geheimen.woo_secret)
    ].join('&');

    const batch = _haalJson(geheimen.woo_basis_url + '/wp-json/wc/v3/products?' + parameters);
    if (!batch.length) {
      break;
    }

    batch.forEach(function (product) {
      kaart[String(product.id)] = (product.categories || []).map(function (c) { return c.slug; });
    });

    pagina += 1;
    Utilities.sleep(300);
  }

  cache.put(CACHE_SLEUTEL, JSON.stringify(kaart), 300);
  return kaart;
}

function _normaliseer(order, producten) {
  let categorieen = [];
  (order.line_items || []).forEach(function (item) {
    const eigen = producten[String(item.product_id)] || [];
    categorieen = categorieen.concat(eigen);
  });

  const naamKindVeld = (order.meta_data || []).filter(function (m) {
    return m.key === 'Naam kind';
  })[0];

  const ixlyTakenVeld = (order.meta_data || []).filter(function (m) {
    return m.key === '_grovia_ixly_taken';
  })[0];

  const product = (order.line_items || [])
    .map(function (item) { return item.name; })
    .filter(String)
    .join(', ');

  return {
    order_id:    String(order.id),
    datum:       String(order.date_created || '').slice(0, 10),
    naam_kind:   naamKindVeld ? String(naamKindVeld.value).trim() : '',
    ouder_naam:  [order.billing.first_name, order.billing.last_name].filter(String).join(' '),
    ouder_email: order.billing.email || '',
    categorieen: categorieen,
    ixly_taken:  ixlyTakenVeld ? String(ixlyTakenVeld.value).trim() : '',
    product:     product,
    bedrag:      Number(order.total) || 0
  };
}

// Een herkenbare, niet-generieke User-Agent -- de standaard Apps Script-UA lijkt op
// scanner-verkeer voor de hosting-WAF. Geeft Vimexx bovendien iets concreets om op
// te whitelisten, mocht dat nodig blijken.
const WOO_USER_AGENT = 'Grovia-Deelnemersadministratie/1.0 (contact: max@greit.nl)';

/**
 * @param {string} url
 * @return {Object} het geparste JSON-antwoord
 *
 * Retryt tot 2x met oplopende pauze bij een HTTP 403 -- de hosting-WAF blokkeert
 * bij vlagen op requestfrequentie (CONVENTIONS-regel 2, al eerder gezien bij twee
 * volledige catalogus-ophalingen kort na elkaar). Een 403 is dus vaker een
 * tijdelijke snelheidsregel dan een echte autorisatiefout; andere foutcodes (404,
 * 500, ...) retryen niet, want daar lost wachten niets op.
 */
function _haalJson(url) {
  const opties = {
    muteHttpExceptions: true,
    headers: { 'User-Agent': WOO_USER_AGENT }
  };

  for (let poging = 1; poging <= 3; poging += 1) {
    const respons = UrlFetchApp.fetch(url, opties);
    const code    = respons.getResponseCode();

    if (code === 200) {
      return JSON.parse(respons.getContentText());
    }

    if (code === 403 && poging < 3) {
      Utilities.sleep(poging * 2000);
      continue;
    }

    throw new Error('WooCommerce gaf HTTP ' + code + ': ' + respons.getContentText().slice(0, 200));
  }
}
