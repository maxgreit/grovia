/**
 * Pure logica voor de MiniMove-administratie: welk aankooptype (strippenkaart,
 * seizoenkaart of de inmiddels verwijderde hele-cyclus) een orderregel is, en de
 * upsert voor het "MiniMove Deelnemers"-tabblad.
 *
 * Draait op dezelfde orderregels die de dagelijkse run al voor het Financieel-
 * rapport ophaalt (haalOrderRegels in Woo.gs) -- geen eigen WooCommerce-aanroep,
 * CONVENTIONS-regel 2 (geen dubbele catalogus-ophaling per run).
 *
 * Dit bestand raakt bewust geen SpreadsheetApp of UrlFetchApp aan, zodat de logica
 * met `node --test tests/gs/` te testen is. Sheet-toegang zit in Sheet.gs.
 */

// MiniMove heeft dit seizoen 4 cycli. Een seizoenkaart geldt voor alle cycli
// tegelijk en splitst zich hieronder dus op in evenzoveel rijen -- het bedrag
// verdeelt zich mee, zelfde principe als de /3-deling voor Kolping/Schagen in
// Financieel.gs (daar 3 cycli, hier 4).
const MINIMOVE_AANTAL_CYCLI = 4;

const MINIMOVE_STRIPPENKAART_PATROON = /^cyclus-([1-4])-strippenkaart-(4|6|8)-keer$/;

/**
 * Herkent het aankooptype uit de ruwe 'pa_inschrijving'-slug van een orderregel.
 * Puur op patroonherkenning, geen Config-mappingtabel nodig: de cyclus en het
 * aantal strippen staan al letterlijk in de slug.
 *
 * @param {string} inschrijvingSlug bijv. 'cyclus-1-strippenkaart-4-keer'
 * @return {{cyclus: string, type: string, gekocht: (number|null)}[]} leeg als de
 *   slug niet bij MiniMove hoort. 1 item voor een strippenkaart of hele-cyclus,
 *   MINIMOVE_AANTAL_CYCLI items (één per cyclus) voor een seizoenkaart.
 *   gekocht is null voor seizoenkaart/hele-cyclus (onbeperkt binnen de cyclus/
 *   het seizoen, geen strippenbudget).
 */
function bepaalMiniMoveAankopen(inschrijvingSlug) {
  const slug = String(inschrijvingSlug || '').trim();

  const strippenMatch = slug.match(MINIMOVE_STRIPPENKAART_PATROON);
  if (strippenMatch) {
    return [{ cyclus: strippenMatch[1], type: 'strippenkaart', gekocht: Number(strippenMatch[2]) }];
  }

  if (slug === 'seizoenkaart-inclusief-tenue' || slug === 'seizoenkaart-zonder-tenue') {
    const aankopen = [];
    for (let c = 1; c <= MINIMOVE_AANTAL_CYCLI; c += 1) {
      aankopen.push({ cyclus: String(c), type: 'seizoenkaart', gekocht: null });
    }
    return aankopen;
  }

  // 'hele-cyclus': de losse Cyclus 1-4-optie die tot 2026-08-05 bestond. Nieuwe
  // orders komen hier niet meer bij, maar kinderen die 'm eerder kochten trainen
  // deze cyclus nog gewoon mee.
  const heleCyclusMatch = slug.match(/^cyclus-([1-4])$/);
  if (heleCyclusMatch) {
    return [{ cyclus: heleCyclusMatch[1], type: 'hele-cyclus', gekocht: null }];
  }

  return [];
}

/**
 * @param {Object[]} bestaandeRijen rijen zoals gelezen uit "MiniMove Deelnemers"
 * @param {Object[]} regels orderregels uit Woo.gs (haalOrderRegels)
 * @param {Object} mapping {scholen, uitgesloten} uit het Config-tabblad
 * @return {{rijen: Object[], controleren: Object[]}}
 */
function upsertMiniMoveDeelnemers(bestaandeRijen, regels, mapping) {
  const rijen = bestaandeRijen.map(function (r) {
    return Object.assign({}, r, { order_ids: r.order_ids.slice() });
  });
  const controleren = [];

  const index = {};
  rijen.forEach(function (rij, i) {
    index[rij.seizoen + '|' + rij.cyclus + '|' + rij.naam_slug] = i;
  });

  regels.forEach(function (regel) {
    const categorieen = regel.categorieen || [];
    if (categorieen.some(function (c) { return mapping.uitgesloten.indexOf(c) !== -1; })) {
      return;
    }

    let vereniging = '';
    categorieen.forEach(function (c) {
      if (!vereniging && mapping.scholen[c]) {
        vereniging = mapping.scholen[c];
      }
    });
    if (vereniging !== 'MM') {
      return;
    }

    const aankopen = bepaalMiniMoveAankopen(regel.inschrijving);
    const slug = naarSlug(regel.naam_kind);

    if (!aankopen.length || !slug) {
      controleren.push({
        order_id: regel.order_id,
        datum: regel.datum,
        naam_kind: regel.naam_kind || '',
        reden: !slug ? 'geen naam kind' : 'onbekend MiniMove-inschrijvingstype: ' + regel.inschrijving
      });
      return;
    }

    const seizoen = bepaalSeizoen(regel.datum);
    const bedragPerRij = aankopen.length > 1 ? regel.bedrag / aankopen.length : regel.bedrag;

    aankopen.forEach(function (aankoop) {
      const sleutel = seizoen + '|' + aankoop.cyclus + '|' + slug;
      const id = String(regel.order_id);

      if (index[sleutel] === undefined) {
        rijen.push({
          seizoen: seizoen,
          cyclus: aankoop.cyclus,
          naam_slug: slug,
          naam_kind: regel.naam_kind,
          type_aankoop: aankoop.type,
          gekocht: aankoop.gekocht,
          bedrag: bedragPerRij,
          order_ids: [id],
          laatste_order_op: regel.datum
        });
        index[sleutel] = rijen.length - 1;
        return;
      }

      const rij = rijen[index[sleutel]];
      if (rij.order_ids.indexOf(id) !== -1) {
        return;
      }

      rij.order_ids.push(id);
      rij.order_ids.sort(function (a, b) { return Number(a) - Number(b); });

      // Twee strippenkaarten voor dezelfde cyclus tellen op. Elke andere combinatie
      // (bijv. een seizoenkaart erbovenop) vervangt het aankooptype -- een
      // seizoenkaart/hele-cyclus is altijd "meer" dan een vast aantal strippen, dus
      // dat wint bewust in plaats van dat de twee samen een vreemd hybride worden.
      if (aankoop.type === 'strippenkaart' && rij.type_aankoop === 'strippenkaart') {
        rij.gekocht += aankoop.gekocht;
      } else {
        rij.type_aankoop = aankoop.type;
        rij.gekocht = aankoop.gekocht;
      }

      rij.bedrag += bedragPerRij;
      if (regel.datum > rij.laatste_order_op) {
        rij.laatste_order_op = regel.datum;
      }
    });
  });

  return { rijen: rijen, controleren: controleren };
}

// Alleen voor `node --test`; Apps Script kent `module` niet en slaat dit over.
if (typeof module !== 'undefined') {
  module.exports = {
    MINIMOVE_AANTAL_CYCLI: MINIMOVE_AANTAL_CYCLI,
    bepaalMiniMoveAankopen: bepaalMiniMoveAankopen,
    upsertMiniMoveDeelnemers: upsertMiniMoveDeelnemers
  };
}
