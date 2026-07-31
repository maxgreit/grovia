/**
 * Pure upsert-logica voor het Deelnemers-tabblad.
 *
 * Dit bestand raakt bewust geen SpreadsheetApp of UrlFetchApp aan, zodat de logica
 * met `node --test tests/gs/` te testen is. Alle Sheet-toegang zit in Sheet.gs.
 */

/**
 * Zet een naam om naar een slug voor gebruik als rij-identiteit.
 *
 * Hoeft NIET identiek te zijn aan grovia_naam_slug() in PHP: deze slug wordt nergens
 * met een PHP-waarde vergeleken en dient alleen om rijen binnen dit werkboek te
 * identificeren. Vereiste is enkel dat hij consistent is met zichzelf.
 *
 * @param {string} naam
 * @return {string}
 */
function naarSlug(naam) {
  return String(naam || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Bepaal de seizoencode uit een datum. Augustus is de start van een nieuw seizoen.
 *
 * @param {string} datum 'YYYY-MM-DD'
 * @return {string} bijv. '2526'
 */
function bepaalSeizoen(datum) {
  const jaar  = Number(String(datum).slice(0, 4));
  const maand = Number(String(datum).slice(5, 7));
  const start = maand >= 8 ? jaar : jaar - 1;
  return String(start).slice(2) + String(start + 1).slice(2);
}

/**
 * Voeg orders samen met de bestaande rijen.
 *
 * @param {Object[]} bestaandeRijen rijen zoals gelezen uit het Deelnemers-tabblad
 * @param {Object[]} orders genormaliseerde orders uit Woo.gs
 * @param {Object} mapping {scholen, fases, uitgesloten} uit het Config-tabblad
 * @return {{rijen: Object[], controleren: Object[]}}
 */
function upsertDeelnemers(bestaandeRijen, orders, mapping) {
  const rijen = bestaandeRijen.map(function (r) {
    return Object.assign({}, r, { order_ids: r.order_ids.slice() });
  });
  const controleren = [];

  const index = {};
  rijen.forEach(function (rij, i) {
    index[rij.seizoen + '|' + rij.naam_slug] = i;
  });

  orders.forEach(function (order) {
    const categorieen = order.categorieen || [];

    if (categorieen.some(function (c) { return mapping.uitgesloten.indexOf(c) !== -1; })) {
      return;
    }

    let vereniging = '';
    categorieen.forEach(function (c) {
      if (!vereniging && mapping.scholen[c]) {
        vereniging = mapping.scholen[c];
      }
    });

    // MiniMove doet niet mee aan de testen en komt dus niet in de administratie.
    if (vereniging === 'MM') {
      return;
    }

    const slug = naarSlug(order.naam_kind);

    if (!vereniging || !slug) {
      controleren.push({
        order_id: order.order_id,
        datum: order.datum,
        naam_kind: order.naam_kind || '',
        ouder_email: order.ouder_email || '',
        reden: !slug ? 'geen naam kind' : 'geen bekende vereniging'
      });
      return;
    }

    const seizoen = bepaalSeizoen(order.datum);
    const sleutel = seizoen + '|' + slug;

    if (index[sleutel] === undefined) {
      rijen.push({
        seizoen: seizoen,
        naam_slug: slug,
        naam_kind: order.naam_kind,
        vereniging: vereniging,
        ouder_naam: order.ouder_naam || '',
        ouder_email: order.ouder_email || '',
        order_ids: [String(order.order_id)],
        code: String(order.order_id),
        uitgenodigd_op: order.datum,
        action_type_af: false,
        action_type_op: '',
        action_type: '',
        ixly_af: false,
        ixly_op: '',
        reminders_verzonden: 0,
        laatste_reminder_op: '',
        laatste_poging_op: ''
      });
      index[sleutel] = rijen.length - 1;
      return;
    }

    const rij = rijen[index[sleutel]];
    const id  = String(order.order_id);

    if (rij.order_ids.indexOf(id) === -1) {
      rij.order_ids.push(id);
      rij.order_ids.sort(function (a, b) { return Number(a) - Number(b); });
    }

    // De uitnodiging ging op de eerste order uit; code en datum volgen die order.
    rij.code = rij.order_ids[0];
    if (order.datum < rij.uitgenodigd_op) {
      rij.uitgenodigd_op = order.datum;
    }
  });

  return { rijen: rijen, controleren: controleren };
}

// Alleen voor `node --test`; Apps Script kent `module` niet en slaat dit over.
if (typeof module !== 'undefined') {
  module.exports = { upsertDeelnemers: upsertDeelnemers, naarSlug: naarSlug, bepaalSeizoen: bepaalSeizoen };
}
