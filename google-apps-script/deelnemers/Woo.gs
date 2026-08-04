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
  }

  return orders;
}

/**
 * Haalt orderREGELS (niet orders) op sinds een datum, met de 'Inschrijving'-waarde
 * (Cyclus 1/2/3, Seizoenkaart) per regel. Op regelniveau i.p.v. orderniveau, zodat
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
        // 'Inschrijving' is de variatie-attribuutwaarde (Cyclus 1/2/3, Seizoenkaart --
        // met/zonder tenue) -- een variatie, geen categorie. Zichtbaar als gewone
        // (niet-onderstreepte) regelmeta in het orderscherm, zelfde soort uitlezing
        // als 'Naam kind' hierboven.
        const inschrijvingVeld = (item.meta_data || []).filter(function (m) {
          return m.key === 'Inschrijving';
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
  }

  return regels;
}

function _haalProductCategorieen(geheimen) {
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
  }

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

function _haalJson(url) {
  const respons = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  const code    = respons.getResponseCode();

  if (code !== 200) {
    throw new Error('WooCommerce gaf HTTP ' + code + ': ' + respons.getContentText().slice(0, 200));
  }

  return JSON.parse(respons.getContentText());
}
