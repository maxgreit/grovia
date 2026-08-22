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
 * @param {Object[]} [deelnemers] rijen uit leesDeelnemers(), voor bedrag_correctie.
 *   Weglaten (of leeg) = WooCommerce is de waarheid, zoals voorheen.
 * @return {Object[]} één rij per vereniging x cyclus, voor het Financieel-tabblad
 */
function berekenFinancieel(regels, mapping, seizoen, deelnemers) {
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

  // Pas 1: classificeren. Alleen regels die aan álle voorwaarden voldoen tellen mee;
  // de classificatie wordt eerst verzameld zodat de bedrag_correctie hieronder over de
  // meetellende regels van een kind verdeeld kan worden vóór het optellen.
  const meetellend = [];
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

    meetellend.push({
      vereniging: vereniging, rol: rol, slug: slug, type: type, bedrag: regel.bedrag
    });
  });

  _pasBedragCorrectiesToe(meetellend, deelnemers, seizoenVan, seizoenTot);

  meetellend.forEach(function (regel) {
    if (regel.type === 'SEIZOENKAART') {
      data[regel.vereniging].seizoenkaart[regel.rol][regel.slug] = true;
      data[regel.vereniging].seizoenkaart.omzet += regel.bedrag;
    } else {
      data[regel.vereniging].cyclus[regel.type][regel.rol][regel.slug] = true;
      data[regel.vereniging].cyclus[regel.type].omzet += regel.bedrag;
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

/**
 * Overschrijft de WooCommerce-bedragen van meetellende regels met de handmatige
 * bedrag_correctie uit Deelnemers ("WooCommerce is niet altijd de waarheid").
 *
 * Regels, allemaal bewust:
 *   - Alleen deelnemersrijen met een échte numerieke correctie tellen ('' of tekst =
 *     geen correctie; 0 is wél een correctie -- expliciet naar nul).
 *   - De rij moet met uitgenodigd_op binnen het financiële seizoensvenster vallen,
 *     anders zou de rij van vorig seizoen (zelfde kind, zelfde slug) de orders van dit
 *     seizoen overrulen.
 *   - De correctie is het SEIZOENSTOTAAL van dat kind en wordt naar rato van de
 *     WooCommerce-bedragen over zijn meetellende regels verdeeld; is die omzet nul
 *     (100%-kortingscode), dan gelijk verdeeld. Zonder meetellende regels valt er
 *     niets te corrigeren -- een correctie kan geen vereniging of cyclus verzinnen.
 *
 * Muteert de regels in place; alleen het bedrag verandert.
 *
 * @param {Object[]} meetellend geclassificeerde regels uit berekenFinancieel
 * @param {Object[]} deelnemers rijen uit leesDeelnemers(), mag leeg/undefined zijn
 * @param {string} seizoenVan 'YYYY-MM-DD' (inclusief)
 * @param {string} seizoenTot 'YYYY-MM-DD' (exclusief)
 */
function _pasBedragCorrectiesToe(meetellend, deelnemers, seizoenVan, seizoenTot) {
  const correcties = {};
  (deelnemers || []).forEach(function (rij) {
    const correctie = rij.bedrag_correctie;
    if (correctie === '' || correctie === undefined || correctie === null) {
      return;
    }
    if (typeof correctie !== 'number' || !isFinite(correctie)) {
      return;
    }
    const datum = String(rij.uitgenodigd_op || '');
    if (datum < seizoenVan || datum >= seizoenTot) {
      return;
    }
    correcties[String(rij.naam_slug)] = correctie;
  });

  Object.keys(correcties).forEach(function (slug) {
    const eigen = meetellend.filter(function (regel) { return regel.slug === slug; });
    if (!eigen.length) {
      return;
    }
    const som = eigen.reduce(function (totaal, regel) { return totaal + regel.bedrag; }, 0);
    eigen.forEach(function (regel) {
      regel.bedrag = som > 0
        ? regel.bedrag * (correcties[slug] / som)
        : correcties[slug] / eigen.length;
    });
  });
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
