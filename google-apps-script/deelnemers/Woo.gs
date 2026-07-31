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
      'after=' + encodeURIComponent(sinds + 'T00:00:00'),
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

  return {
    order_id:    String(order.id),
    datum:       String(order.date_created || '').slice(0, 10),
    naam_kind:   naamKindVeld ? String(naamKindVeld.value).trim() : '',
    ouder_naam:  [order.billing.first_name, order.billing.last_name].filter(String).join(' '),
    ouder_email: order.billing.email || '',
    categorieen: categorieen
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
