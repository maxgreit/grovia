/**
 * De dagelijkse run: vijf stappen in vaste volgorde.
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
