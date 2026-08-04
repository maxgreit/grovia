/**
 * De dagelijkse run: zes stappen in vaste volgorde.
 *
 * Kernregel: als de afrondingsdata van deze run niet betrouwbaar is, gaan er GEEN
 * reminders uit. Een gemiste dag kost niets — morgen loopt de run weer. Een reminder
 * naar een kind dat de test gisteren gemaakt heeft, kost het vertrouwen in het systeem.
 */

const RESULTATEN_SHEETS = {
  KA: '1HQmSEdj07CVlY1_mTcJoBjseRo4nqQs1TdIrx9ZFXkU',
  SU: '1e4-BfBpyCaDufVHYbZoRLXN9auRV52rQnqVeaKSgOuw'
};

/**
 * Installeer de dagelijkse trigger. Eenmalig draaien.
 */
function installeerTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === 'dagelijkseTrigger') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger('dagelijkseTrigger')
    .timeBased()
    .atHour(7)
    .everyDays(1)
    .create();

  Logger.log('Dagelijkse trigger gezet op 07:00.');
}

function dagelijkseTrigger() {
  Logger.log(dagelijkseRun(true));
}

/**
 * @param {boolean} magMailen false = alleen verversen, geen reminders
 * @return {string} samenvatting voor het log of een dialoogvenster
 */
function dagelijkseRun(magMailen) {
  // Zonder deze lock kan een overlappende run (de dagelijkse trigger tegelijk met een
  // handmatige menu-actie) elkaars wegschrijven overschrijven met een verouderde staat
  // -- geconstateerd op 2026-08-03, toen ~27 net verstuurde reminders wel in het Log
  // stonden maar niet in de Deelnemers-sheet. 30s wachttijd i.p.v. direct opgeven, want
  // de dagelijkse run mag een handmatige actie best even laten uitlopen.
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    throw new Error('Kon geen lock verkrijgen -- een andere synchronisatie is nog bezig.');
  }
  try {
    return _dagelijkseRunKern(magMailen);
  } finally {
    lock.releaseLock();
  }
}

function _dagelijkseRunKern(magMailen) {
  const config  = leesConfig();
  const vandaag = _vandaagTekst();
  const melding = [];
  let dataBetrouwbaar = true;

  // Stap 1 -- deelnemers ophalen
  let rijen = leesDeelnemers();
  try {
    const sinds  = _sindsDatum(rijen, config);
    const orders = haalOrders(sinds);
    const ingest = upsertDeelnemers(rijen, orders, config.mapping);

    rijen = ingest.rijen;
    melding.push('Stap 1: ' + orders.length + ' orders, ' + rijen.length + ' deelnemers.');

    if (ingest.controleren.length) {
      const regelsControleren = ingest.controleren.map(function (c) {
        return [c.order_id, c.datum, c.naam_kind, c.ouder_email, c.reden];
      });
      // Dedup op order_id (index 0) -- een order_id komt maar één keer voor, dus
      // dezelfde order wordt niet elke run opnieuw aan Controleren toegevoegd.
      voegNieuweToe('Controleren', regelsControleren, [0]);
      melding.push('  ' + ingest.controleren.length + ' order(s) naar Controleren.');
    }
  } catch (fout) {
    dataBetrouwbaar = false;
    melding.push('Stap 1 MISLUKT: ' + fout.message);
    logRegel('fout', {}, 'mislukt', 'ingest: ' + fout.message);
  }

  // Tussentijds wegschrijven: als het script vastloopt (bijv. de 6-minutenlimiet) tussen
  // hier en het einde, zijn de resultaten van stap 1 al veilig bewaard (bevinding 7).
  schrijfDeelnemers(rijen);

  // Stap 2 -- Action Type-afronding
  try {
    const koppeling = koppelReacties(rijen, haalReacties(RESULTATEN_SHEETS));
    rijen = koppeling.rijen;
    melding.push('Stap 2: Action Type bijgewerkt.');

    if (koppeling.ongekoppeld.length) {
      const regelsKoppeling = koppeling.ongekoppeld.map(function (o) {
        return [o.naam, o.tijdstip, o.action_type, o.reden];
      });
      // Dedup op naam (index 0) + tijdstip (index 1) -- dat is de natuurlijke identiteit
      // van één formulierinzending.
      voegNieuweToe('Handmatig koppelen', regelsKoppeling, [0, 1]);
      melding.push('  ' + koppeling.ongekoppeld.length + ' reactie(s) niet gekoppeld.');
    }
  } catch (fout) {
    dataBetrouwbaar = false;
    melding.push('Stap 2 MISLUKT: ' + fout.message);
    logRegel('fout', {}, 'mislukt', 'action type: ' + fout.message);
  }

  // Tussentijds wegschrijven: stap 1-2 zijn nu veilig bewaard vóór Ixly begint.
  schrijfDeelnemers(rijen);

  // Stap 3 -- Ixly-afronding
  try {
    const ixly = werkIxlyBij(rijen, config.ixly_batch_per_run, vandaag);
    rijen = ixly.rijen;
    melding.push('Stap 3: ' + ixly.bijgewerkt + ' Ixly-afronding(en) bijgewerkt.');

    if (ixly.fouten.length) {
      dataBetrouwbaar = false;
      melding.push('  ' + ixly.fouten.length + ' fout(en): ' + ixly.fouten.slice(0, 3).join('; '));
      logRegel('fout', {}, 'mislukt', 'ixly: ' + ixly.fouten.join('; '));
    }
  } catch (fout) {
    dataBetrouwbaar = false;
    melding.push('Stap 3 MISLUKT: ' + fout.message);
    logRegel('fout', {}, 'mislukt', 'ixly: ' + fout.message);
  }

  // Tussentijds wegschrijven: stap 1-3 zijn nu veilig bewaard vóór de reminders beginnen.
  schrijfDeelnemers(rijen);

  // Stap 4 -- reminders, alleen bij betrouwbare data
  if (!magMailen) {
    melding.push('Stap 4: overgeslagen (alleen verversen).');
  } else if (!dataBetrouwbaar) {
    melding.push('Stap 4: OVERGESLAGEN — data niet betrouwbaar, geen reminders vandaag.');
    logRegel('fout', {}, 'mislukt', 'reminders overgeslagen wegens onbetrouwbare data');
  } else {
    const beslissing = bepaalReminders(rijen, vandaag, config);
    const resultaat  = verstuurReminders(rijen, beslissing.teVersturen, vandaag, config, 'reminder-automatisch');

    rijen = resultaat.rijen;
    melding.push('Stap 4: ' + resultaat.verstuurd + ' verstuurd, ' + resultaat.mislukt + ' mislukt.');

    if (beslissing.afgekapt > 0) {
      melding.push('  LET OP: ' + beslissing.afgekapt + ' reminder(s) afgekapt door max_mails_per_run.');
      logRegel('fout', {}, 'mislukt', beslissing.afgekapt + ' reminders afgekapt door de bovengrens');
    }
  }

  // Tussentijds wegschrijven: de verzonden reminders en bijgewerkte tellers van stap 4
  // zijn nu bewaard, ook als de run hierna nog vastloopt.
  schrijfDeelnemers(rijen);

  // Stap 5 -- dashboard
  bouwDashboard(rijen);
  melding.push('Stap 5: dashboard verversd.');

  // Stap 6 -- Financieel-rapport (huidig seizoen). Onafhankelijk van dataBetrouwbaar
  // en van reminders/Ixly/Action Type hierboven -- dit is een puur afgeleid,
  // read-only rapport uit de losse orderregels, geen deel van de Deelnemers-sheet.
  try {
    const seizoen = bepaalSeizoen(vandaag);
    const regels  = haalOrderRegels(seizoenStartdatum(seizoen));
    schrijfFinancieel(berekenFinancieel(regels, config.mapping, seizoen));
    melding.push('Stap 6: Financieel-rapport ververst (' + regels.length + ' orderregels, seizoen ' + seizoen + ').');
  } catch (fout) {
    melding.push('Stap 6 MISLUKT: ' + fout.message);
    logRegel('fout', {}, 'mislukt', 'financieel: ' + fout.message);
  }

  return melding.join('\n');
}

/**
 * Vanaf welke datum orders ophalen. Een dag overlap tegen randgevallen rond middernacht.
 *
 * @param {Object[]} rijen
 * @param {Object} config uit leesConfig()
 * @return {string} 'YYYY-MM-DD'
 */
function _sindsDatum(rijen, config) {
  if (!rijen.length) {
    return config.sinds_fallback;
  }

  const datums = rijen
    .map(function (r) { return r.uitgenodigd_op; })
    .filter(String)
    .sort();

  const laatste = datums[datums.length - 1];
  const dag = new Date(laatste + 'T00:00:00');
  dag.setDate(dag.getDate() - 1);

  return Utilities.formatDate(dag, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function _vandaagTekst() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

/**
 * TIJDELIJK, eenmalig te draaien: haalt ALLE oudere WooCommerce-orders op (van vóór
 * de datum waar de normale dagelijkse sync al bij zat, die alleen voorwaarts kijkt
 * via _sindsDatum) en voegt ze toe aan de Deelnemers-sheet.
 *
 * Overschrijft GEEN bestaande rijen of hun al ingevulde velden (action_type_af,
 * ixly_af, testresultaten, etc.) -- upsertDeelnemers voegt bij een bestaande rij
 * alleen order_ids/code/uitgenodigd_op toe (en ixly_taken alleen als die nog leeg
 * is), en maakt alleen voor een écht nieuw kind een nieuwe rij aan. Zelfde pad als
 * dagelijkseRun Stap 1, alleen met een vaste, vroege startdatum in plaats van de
 * berekende _sindsDatum. Na gebruik weer uit dit bestand verwijderen.
 *
 * @return {string} samenvatting, ook gelogd via Logger.log
 */
function backfillOudereOrders() {
  const config    = leesConfig();
  const rijenVoor = leesDeelnemers();

  const orders = haalOrders('2020-01-01');
  const ingest = upsertDeelnemers(rijenVoor, orders, config.mapping);

  schrijfDeelnemers(ingest.rijen);

  if (ingest.controleren.length) {
    const regelsControleren = ingest.controleren.map(function (c) {
      return [c.order_id, c.datum, c.naam_kind, c.ouder_email, c.reden];
    });
    voegNieuweToe('Controleren', regelsControleren, [0]);
  }

  const samenvatting =
    orders.length + ' orders opgehaald, ' +
    ingest.rijen.length + ' deelnemersrijen totaal (was ' + rijenVoor.length + '), ' +
    ingest.controleren.length + ' order(s) naar Controleren.';

  Logger.log(samenvatting);
  return samenvatting;
}

/**
 * TIJDELIJK, alleen-lezen diagnose: verklaart waarom backfillOudereOrders() maar een
 * deel van de opgehaalde orders in nieuwe rijen omzette. Schrijft niets weg -- volgt
 * dezelfde categorisatie als upsertDeelnemers (Deelnemers.gs), maar telt in plaats
 * van te muteren. Na gebruik weer uit dit bestand verwijderen.
 *
 * @return {string} telling per categorie, ook gelogd via Logger.log
 */
function backfillDiagnose() {
  const config  = leesConfig();
  const mapping = config.mapping;
  const rijenVoor = leesDeelnemers();
  const orders = haalOrders('2020-01-01');

  const index = {};
  rijenVoor.forEach(function (rij) {
    index[rij.seizoen + '|' + rij.naam_slug] = true;
  });

  let uitgesloten = 0;
  let miniMove = 0;
  let geenVerenigingOfNaam = 0;
  let matchtBestaand = 0;
  let nieuweRij = 0;
  const uitgeslotenCategorieen = {};

  orders.forEach(function (order) {
    const categorieen = order.categorieen || [];

    if (categorieen.some(function (c) { return mapping.uitgesloten.indexOf(c) !== -1; })) {
      uitgesloten++;
      categorieen.forEach(function (c) {
        if (mapping.uitgesloten.indexOf(c) !== -1) {
          uitgeslotenCategorieen[c] = (uitgeslotenCategorieen[c] || 0) + 1;
        }
      });
      return;
    }

    let vereniging = '';
    categorieen.forEach(function (c) {
      if (!vereniging && mapping.scholen[c]) {
        vereniging = mapping.scholen[c];
      }
    });

    if (vereniging === 'MM') {
      miniMove++;
      return;
    }

    const slug = naarSlug(order.naam_kind);
    if (!vereniging || !slug) {
      geenVerenigingOfNaam++;
      return;
    }

    const sleutel = bepaalSeizoen(order.datum) + '|' + slug;
    if (index[sleutel]) {
      matchtBestaand++;
    } else {
      nieuweRij++;
      index[sleutel] = true;
    }
  });

  const samenvatting = [
    orders.length + ' orders totaal.',
    uitgesloten + ' uitgesloten via mapping.uitgesloten (' + JSON.stringify(uitgeslotenCategorieen) + ').',
    miniMove + ' MiniMove (doet niet mee aan de testen).',
    geenVerenigingOfNaam + ' zonder herkende vereniging/naam kind (naar Controleren).',
    matchtBestaand + ' matchen een al bestaand kind (order_id toegevoegd, geen nieuwe rij).',
    nieuweRij + ' zouden een nieuwe rij opleveren.'
  ].join('\n');

  Logger.log(samenvatting);
  return samenvatting;
}

/**
 * TIJDELIJK, eenmalig te draaien: herstelt laatste_reminder_op/laatste_poging_op voor
 * rijen die op 2026-08-03 wél een handmatige reminder kregen (zie het Log-tabblad,
 * allemaal "ok"), maar waarvan de Deelnemers-sheet die twee velden nooit heeft
 * vastgelegd. Oorzaak: een race condition tussen de dagelijkse run en de handmatige
 * bulkverzending (geen LockService aanwezig ten tijde van die verzending -- inmiddels
 * opgelost, zie dagelijkseRun/_verstuurNaarSelectie). Zonder deze reparatie zou de
 * automatische reminder-logica deze rijen morgen als "nog nooit gemaild" behandelen en
 * ze een dag na de handmatige reminder nogmaals mailen.
 *
 * Matcht op seizoen 2526 + naam_slug (dezelfde sleutel als upsertDeelnemers), en zet de
 * twee velden ALLEEN als ze nu leeg zijn -- rijen die al correct staan (freddie-rood,
 * duuk-van-houten) worden niet aangeraakt. Na gebruik weer uit dit bestand verwijderen.
 *
 * @return {string} samenvatting, ook gelogd via Logger.log
 */
function herstelVerlorenReminderVan20260803() {
  const NAAM_SLUGS = [
    'abdullah', 'vince-van-cleef', 'nick-v-dalen', 'sven-breton', 'jens-mosch',
    'lisa-van-der-lippe', 'thijs-winder', 'joep-de-wert', 'dean-van-roode',
    'ryan-van-haaren', 'pepijn-koppes', 'revi-dirksen', 'vincent-sturkenboom',
    'dilan-pathirage', 'ruwan-pathirage', 'niels-rentenaar', 'delano-hewitt',
    'bram-schut', 'don-de-ridder', 'sven-groeneveld', 'stef-czapelski',
    'arnout-jansen', 'jaimy-hoes', 'leon-gesko-caromelle', 'julian-van-der-stap',
    'finn-stam', 'teun-stam'
  ];
  const DATUM = '2026-08-03';

  const rijen = leesDeelnemers();
  let hersteld = 0;
  const nietGevonden = [];

  NAAM_SLUGS.forEach(function (slug) {
    const rij = rijen.filter(function (r) { return String(r.seizoen) === '2526' && r.naam_slug === slug; })[0];
    if (!rij) {
      nietGevonden.push(slug);
      return;
    }
    if (!rij.laatste_reminder_op) {
      rij.laatste_reminder_op = DATUM;
    }
    if (!rij.laatste_poging_op) {
      rij.laatste_poging_op = DATUM;
    }
    hersteld++;
  });

  schrijfDeelnemers(rijen);

  const samenvatting = hersteld + ' rij(en) hersteld.' +
    (nietGevonden.length ? ' Niet gevonden: ' + nietGevonden.join(', ') : '');

  Logger.log(samenvatting);
  return samenvatting;
}

/**
 * TIJDELIJK, eenmalig te draaien: vult rol/product/bedrag met terugwerkende kracht
 * voor rijen die al bestonden vóórdat deze drie kolommen toegevoegd zijn.
 *
 * Haalt ALLE orders in ÉÉN bulk-aanroep op (zelfde bewezen-betrouwbare patroon als
 * backfillOudereOrders hierboven) en zoekt daarna per rij de eerste order (rij.code,
 * altijd het laagste order_id) op in het resultaat -- geen losse aanroep per rij.
 * Een eerdere versie deed wél 35 losse aanroepen (elk met een eigen herhaalde
 * productcatalogus-ophaal erbij), wat de WAF op grovia.nl na de eerste aanroep al
 * begon te blokkeren (403) -- dit is dus geen "nog een keer proberen"-situatie maar
 * een architectuurfout die hiermee is rechtgezet.
 *
 * Raakt een rij NIET aan als rol én product al gevuld zijn (dus onschadelijk om
 * per ongeluk twee keer te draaien). Na gebruik weer uit dit bestand verwijderen.
 *
 * @return {string} samenvatting, ook gelogd via Logger.log
 */
function vulRolProductBedragVoorBestaandeRijen() {
  const config = leesConfig();
  const rijen  = leesDeelnemers();

  const orders = haalOrders('2020-01-01');
  const opOrderId = {};
  orders.forEach(function (order) {
    opOrderId[order.order_id] = order;
  });

  let bijgewerkt = 0;
  const nietGevonden = [];

  rijen.forEach(function (rij) {
    if (rij.rol && rij.product) {
      return;
    }
    const eersteOrderId = rij.order_ids[0];
    const order = opOrderId[eersteOrderId];
    if (!order) {
      nietGevonden.push(rij.naam_kind + ' (order ' + eersteOrderId + ')');
      return;
    }

    let rol = '';
    (order.categorieen || []).forEach(function (c) {
      if (!rol && config.mapping.rollen[c]) {
        rol = config.mapping.rollen[c];
      }
    });

    rij.rol     = rol;
    rij.product = order.product || '';
    rij.bedrag  = order.bedrag || 0;
    bijgewerkt++;
  });

  schrijfDeelnemers(rijen);

  const samenvatting = bijgewerkt + ' rij(en) bijgewerkt.' +
    (nietGevonden.length ? ' Niet gevonden: ' + nietGevonden.join(', ') : '');

  Logger.log(samenvatting);
  return samenvatting;
}

/**
 * TIJDELIJK, eenmalig te draaien: zet de oude deelnemers op het nieuwe reminder-schema.
 *
 * Die rijen kregen op 2026-08-03 een HANDMATIGE reminder (die de teller niet verhoogt),
 * en hun uitnodiging is weken oud -- dus alle drempels zijn al gepasseerd. Zonder deze
 * ingreep zou de automatische run ze in ~9 dagen alle resterende reminders achter elkaar
 * sturen (elke 2 dagen één, alleen geremd door het 1-dagsvenster).
 *
 * Deze functie behandelt die handmatige reminder als reminder #1 op drempeldag 3:
 * reminders_verzonden = 1 en reminder_anker = 2026-07-31 (= 08-03 min 3 dagen). Met
 * reminder_dagen 3,7,14,21,35,49 wordt de volgende dan drempel 7 -> 2026-08-07, vier
 * dagen na de handmatige. Daarna 08-14, 08-21, 09-04, 09-18.
 *
 * Selecteert op DATA, niet op een namenlijst: elke nog niet afgeronde rij met
 * laatste_reminder_op 2026-08-03 en teller 0. Slaat rijen over die al een anker hebben,
 * dus onschadelijk om twee keer te draaien. Na gebruik weer uit dit bestand verwijderen.
 *
 * @return {string} samenvatting, ook gelogd via Logger.log
 */
function zetOudeRijenOpNieuwSchema() {
  const HANDMATIGE_REMINDER = '2026-08-03';
  const ANKER = '2026-07-31';

  const rijen = leesDeelnemers();
  let bijgewerkt = 0;
  const overgeslagen = [];

  rijen.forEach(function (rij) {
    if (rij.laatste_reminder_op !== HANDMATIGE_REMINDER) {
      return;
    }
    if (rij.reminder_anker) {
      overgeslagen.push(rij.naam_kind + ' (heeft al een anker)');
      return;
    }
    if (rij.reminders_verzonden !== 0) {
      overgeslagen.push(rij.naam_kind + ' (teller staat al op ' + rij.reminders_verzonden + ')');
      return;
    }

    rij.reminder_anker      = ANKER;
    rij.reminders_verzonden = 1;
    bijgewerkt++;
  });

  schrijfDeelnemers(rijen);

  const samenvatting = bijgewerkt + ' rij(en) op het nieuwe schema gezet (anker ' + ANKER +
    ', teller 1). Volgende automatische reminder: 2026-08-07.' +
    (overgeslagen.length ? ' Overgeslagen: ' + overgeslagen.join(', ') : '');

  Logger.log(samenvatting);
  return samenvatting;
}

/**
 * TIJDELIJK, alleen-lezen diagnose: dumpt de ruwe line_item.meta_data van een paar
 * echte orders sinds 1 juni, zodat we de werkelijke API-sleutelnaam van de
 * 'Inschrijving'-waarde kunnen vaststellen. Het Financieel-rapport staat nu overal
 * op 0 -- vermoedelijk omdat de aanname dat de sleutel letterlijk 'Inschrijving'
 * heet niet klopt (kon niet live geverifieerd worden). Run dit, kopieer de
 * Logger-output hierheen. Na gebruik weer uit dit bestand verwijderen.
 *
 * @return {string} de gedumpte regels, ook gelogd via Logger.log
 */
function debugInschrijvingMeta() {
  const geheimen = leesGeheimen();
  const parameters = [
    'per_page=5',
    'modified_after=' + encodeURIComponent('2026-06-01T00:00:00'),
    'status=processing,completed',
    'consumer_key=' + encodeURIComponent(geheimen.woo_key),
    'consumer_secret=' + encodeURIComponent(geheimen.woo_secret)
  ].join('&');

  const orders = _haalJson(geheimen.woo_basis_url + '/wp-json/wc/v3/orders?' + parameters);
  const regels = [];

  orders.forEach(function (order) {
    (order.line_items || []).forEach(function (item) {
      regels.push({
        order_id: order.id,
        product: item.name,
        meta: (item.meta_data || []).map(function (m) { return m.key + ' = ' + m.value; })
      });
    });
  });

  const samenvatting = JSON.stringify(regels, null, 2);
  Logger.log(samenvatting);
  return samenvatting;
}
