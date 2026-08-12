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
  let regels = [];
  let seizoen = '';
  try {
    seizoen = bepaalSeizoen(vandaag);
    regels  = haalOrderRegels(seizoenStartdatum(seizoen));
    schrijfFinancieel(berekenFinancieel(regels, config.mapping, seizoen));
    melding.push('Stap 6: Financieel-rapport ververst (' + regels.length + ' orderregels, seizoen ' + seizoen + ').');
  } catch (fout) {
    melding.push('Stap 6 MISLUKT: ' + fout.message);
    logRegel('fout', {}, 'mislukt', 'financieel: ' + fout.message);
  }

  // Stap 7 -- MiniMove: aankopen + aanwezigheid. Hergebruikt de orderregels van
  // Stap 6 hierboven (CONVENTIONS-regel 2: geen tweede WooCommerce-catalogus-
  // ophaling binnen dezelfde run). Eigen try/catch: een fout hier mag Financieel
  // en de rest van de run niet blokkeren, en andersom.
  try {
    const minimoveIngest = upsertMiniMoveDeelnemers(leesMiniMoveDeelnemers(), regels, config.mapping);
    schrijfMiniMoveDeelnemers(minimoveIngest.rijen);
    synchroniseerMiniMoveAanwezigheid(minimoveIngest.rijen, config.minimove_kalender);
    melding.push('Stap 7: MiniMove bijgewerkt (' + minimoveIngest.rijen.length + ' deelnemer(s) x cyclus).');

    if (minimoveIngest.controleren.length) {
      // Zelfde kolomvorm als Stap 1 hierboven (order_id, datum, naam_kind,
      // ouder_email, reden) zodat beide bronnen in hetzelfde "Controleren"-tabblad
      // netjes onder elkaar staan -- haalOrderRegels() levert geen ouder_email,
      // vandaar de lege placeholder.
      const regelsControleren = minimoveIngest.controleren.map(function (c) {
        return [c.order_id, c.datum, c.naam_kind, '', c.reden];
      });
      voegNieuweToe('Controleren', regelsControleren, [0]);
      melding.push('  ' + minimoveIngest.controleren.length + ' order(s) naar Controleren.');
    }
  } catch (fout) {
    melding.push('Stap 7 MISLUKT: ' + fout.message);
    logRegel('fout', {}, 'mislukt', 'minimove: ' + fout.message);
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
 * TIJDELIJK, eenmalig te draaien: vult geboortedatum_kind/club/team met
 * terugwerkende kracht voor rijen die al bestonden vóórdat deze drie kolommen
 * toegevoegd zijn.
 *
 * Zelfde bewezen bulk-patroon als destijds vulRolProductBedragVoorBestaandeRijen
 * (git-historie f29873d): ÉÉN haalOrders()-aanroep voor alle orders, geen aanroep
 * per rij -- dat triggerde toen al na de eerste aanroep een WAF-403.
 *
 * Doorloopt per rij ALLE order_ids (niet alleen de eerste) en pakt per veld de
 * eerste order die het heeft -- zelfde vul-als-leeg-regel als upsertDeelnemers
 * (Deelnemers.gs), bewust NIET "eerste order telt": club/team bestaan pas als
 * checkoutveld sinds ergens tussen 2026-05-17 en 2026-06-05, dus de vroegste order
 * van een rij mist ze soms terwijl een latere order van hetzelfde kind ze wel heeft.
 * Zie docs/superpowers/specs/2026-08-12-geboortedatum-club-team-design.md.
 *
 * Raakt een rij niet aan als alle drie al gevuld zijn (onschadelijk om per ongeluk
 * twee keer te draaien). Na gebruik weer uit dit bestand verwijderen.
 */
function vulGeboortedatumClubTeamVoorBestaandeRijen() {
  const rijen = leesDeelnemers();

  const orders = haalOrders('2020-01-01');
  const opOrderId = {};
  orders.forEach(function (order) {
    opOrderId[order.order_id] = order;
  });

  let bijgewerkt = 0;
  const nietGevonden = [];

  rijen.forEach(function (rij) {
    if (rij.geboortedatum_kind && rij.club && rij.team) {
      return;
    }

    const bijbehorendeOrders = rij.order_ids.map(function (id) { return opOrderId[id]; }).filter(Boolean);
    if (!bijbehorendeOrders.length) {
      nietGevonden.push(rij.naam_kind + ' (orders ' + rij.order_ids.join(',') + ')');
      return;
    }

    const vantevoren = [rij.geboortedatum_kind, rij.club, rij.team].join('|');

    bijbehorendeOrders.forEach(function (order) {
      if (!rij.geboortedatum_kind && order.geboortedatum_kind) {
        rij.geboortedatum_kind = order.geboortedatum_kind;
      }
      if (!rij.club && order.club) {
        rij.club = order.club;
      }
      if (!rij.team && order.team) {
        rij.team = order.team;
      }
    });

    if (vantevoren !== [rij.geboortedatum_kind, rij.club, rij.team].join('|')) {
      bijgewerkt++;
    }
  });

  schrijfDeelnemers(rijen);

  const samenvatting = bijgewerkt + ' rij(en) bijgewerkt.' +
    (nietGevonden.length ? ' Niet gevonden: ' + nietGevonden.join(', ') : '');

  Logger.log(samenvatting);
  return samenvatting;
}
