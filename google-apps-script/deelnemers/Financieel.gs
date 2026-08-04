/**
 * Pure berekeningslogica voor het Financieel-tabblad.
 *
 * Werkt op orderREGEL-niveau (haalOrderRegels in Woo.gs), niet op de samengevatte
 * Deelnemers-rij: een kind dat losse orders voor cyclus 1 én cyclus 2 plaatst moet in
 * allebei meetellen. Een seizoenkaart geldt voor alle drie de cycli tegelijk -- de
 * omzet wordt door 3 gedeeld over de cycli, en het kind telt in alle drie mee als
 * seizoenkaarthouder (naast wie dat specifieke cyclusproduct kocht).
 *
 * Seizoensgrens hier is BEWUST 1 juni, niet de 1-augustus-grens van bepaalSeizoen()
 * (Deelnemers.gs). Cyclus-verkoop voor het nieuwe seizoen start al in juni/juli --
 * met de augustus-grens zouden die vroege orders per ongeluk nog bij het VORIGE
 * seizoen worden opgeteld. Deze twee seizoensbegrippen zijn dus bewust verschillend
 * en onafhankelijk van elkaar; dit bestand roept bepaalSeizoen() nergens aan.
 *
 * 'Inschrijving' komt binnen als ruwe WooCommerce-attribuutslug (via de
 * 'pa_inschrijving'-regelmeta, bijv. 'cyclus-1', 'seizoenkaart-inclusief-tenue'),
 * en wordt hier vertaald via mapping.fases (Config-tabblad, kolommen G:H) -- die
 * mapping bestond al, maar werd nergens gebruikt totdat bleek dat dit precies
 * waarvoor hij bedoeld is.
 *
 * Dit bestand raakt bewust geen SpreadsheetApp of UrlFetchApp aan, zodat de logica
 * met `node --test tests/gs/` te testen is. Sheet-toegang zit in Sheet.gs.
 */

const FINANCIEEL_AFDRACHT_PER_DEELNEMER = 20;
const FINANCIEEL_BTW_PERCENTAGE = 9;

/**
 * @param {string} inschrijvingSlug ruwe waarde uit de 'pa_inschrijving'-regelmeta
 *   (bijv. 'cyclus-1', 'seizoenkaart-inclusief-tenue')
 * @param {Object} fasesMapping mapping.fases uit het Config-tabblad (slug -> fasecode)
 * @return {string} 'C1'/'C2'/'C3'/'SEIZOENKAART', of '' als onherkend
 */
function bepaalInschrijvingType(inschrijvingSlug, fasesMapping) {
  const fasecode = fasesMapping[String(inschrijvingSlug || '').trim()] || '';
  if (fasecode === 'C1' || fasecode === 'C2' || fasecode === 'C3') {
    return fasecode;
  }
  if (fasecode === 'SMT' || fasecode === 'SZT') {
    return 'SEIZOENKAART';
  }
  return '';
}

/**
 * @param {string} seizoen bijv. '2627'
 * @return {string} 'YYYY-MM-DD', 1 juni van het startjaar van dat seizoen
 */
function seizoenStartdatum(seizoen) {
  return '20' + String(seizoen).slice(0, 2) + '-06-01';
}

/**
 * @param {string} seizoen bijv. '2627'
 * @return {string} 'YYYY-MM-DD', 1 juni van het eindjaar (= start van het VOLGENDE
 *   seizoen) -- de bovengrens (exclusief) van dit seizoen.
 */
function _seizoenEinddatum(seizoen) {
  return '20' + String(seizoen).slice(2, 4) + '-06-01';
}

/**
 * @param {Object[]} regels orderregels uit Woo.gs (haalOrderRegels)
 * @param {Object} mapping {scholen, rollen, fases, uitgesloten} uit het Config-tabblad
 * @param {string} seizoen bijv. '2627' -- regels buiten dit seizoen tellen niet mee
 * @return {Object[]} één rij per vereniging x cyclus, voor het Financieel-tabblad
 */
function berekenFinancieel(regels, mapping, seizoen) {
  const VERENIGINGEN = ['KA', 'SU'];
  const CYCLI = ['C1', 'C2', 'C3'];

  const data = {};
  VERENIGINGEN.forEach(function (v) {
    data[v] = { seizoenkaart: { omzet: 0, Speler: {}, Keeper: {} }, cyclus: {} };
    CYCLI.forEach(function (c) {
      data[v].cyclus[c] = { omzet: 0, Speler: {}, Keeper: {} };
    });
  });

  const seizoenVan = seizoenStartdatum(seizoen);
  const seizoenTot = _seizoenEinddatum(seizoen);

  regels.forEach(function (regel) {
    if (regel.datum < seizoenVan || regel.datum >= seizoenTot) {
      return;
    }

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
    if (VERENIGINGEN.indexOf(vereniging) === -1) {
      return;
    }

    let rol = '';
    categorieen.forEach(function (c) {
      if (!rol && mapping.rollen[c]) {
        rol = mapping.rollen[c];
      }
    });
    if (rol !== 'Speler' && rol !== 'Keeper') {
      return;
    }

    const slug = naarSlug(regel.naam_kind);
    if (!slug) {
      return;
    }

    const type = bepaalInschrijvingType(regel.inschrijving, mapping.fases);
    if (!type) {
      return;
    }

    if (type === 'SEIZOENKAART') {
      data[vereniging].seizoenkaart[rol][slug] = true;
      data[vereniging].seizoenkaart.omzet += regel.bedrag;
    } else {
      data[vereniging].cyclus[type][rol][slug] = true;
      data[vereniging].cyclus[type].omzet += regel.bedrag;
    }
  });

  const rijen = [];
  VERENIGINGEN.forEach(function (vereniging) {
    CYCLI.forEach(function (cyclus) {
      const cyclusData       = data[vereniging].cyclus[cyclus];
      const seizoenkaartData = data[vereniging].seizoenkaart;

      const keepersCyclusproduct = Object.keys(cyclusData.Keeper).length;
      const keepersSeizoenkaart  = Object.keys(seizoenkaartData.Keeper).length;
      const spelersCyclusproduct = Object.keys(cyclusData.Speler).length;
      const spelersSeizoenkaart  = Object.keys(seizoenkaartData.Speler).length;

      const inkomstenInclBtw = cyclusData.omzet + (seizoenkaartData.omzet / 3);
      const inkomstenExclBtw = inkomstenInclBtw / (1 + FINANCIEEL_BTW_PERCENTAGE / 100);

      const totaalDeelnemers =
        keepersCyclusproduct + keepersSeizoenkaart + spelersCyclusproduct + spelersSeizoenkaart;

      rijen.push({
        vereniging: vereniging,
        cyclus: cyclus,
        inkomsten_incl_btw: _rond(inkomstenInclBtw),
        inkomsten_excl_btw: _rond(inkomstenExclBtw),
        keepers_cyclusproduct: keepersCyclusproduct,
        keepers_seizoenkaart: keepersSeizoenkaart,
        keepers_totaal: keepersCyclusproduct + keepersSeizoenkaart,
        spelers_cyclusproduct: spelersCyclusproduct,
        spelers_seizoenkaart: spelersSeizoenkaart,
        spelers_totaal: spelersCyclusproduct + spelersSeizoenkaart,
        afdracht_excl_btw: totaalDeelnemers * FINANCIEEL_AFDRACHT_PER_DEELNEMER
      });
    });
  });

  return rijen;
}

function _rond(bedrag) {
  return Math.round(bedrag * 100) / 100;
}

// Alleen voor `node --test`; Apps Script kent `module` niet en slaat dit over.
if (typeof module !== 'undefined') {
  module.exports = {
    bepaalInschrijvingType: bepaalInschrijvingType,
    seizoenStartdatum: seizoenStartdatum,
    berekenFinancieel: berekenFinancieel
  };
}
