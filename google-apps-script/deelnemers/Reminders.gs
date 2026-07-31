/**
 * Bepaalt wie een reminder krijgt en laat grovia-herinnering hem versturen.
 *
 * De drempels zijn dagen ná uitgenodigd_op: 7, 14, 21, 35, 49 — maximaal vijf per kind.
 * Mailen gebeurt niet hier maar in Azure, waar de SMTP en de huisstijl al staan.
 */

/**
 * @param {Object[]} rijen deelnemersrijen
 * @param {string} vandaag 'YYYY-MM-DD'
 * @param {Object} config uit leesConfig()
 * @return {{teVersturen: Object[], afgekapt: number}}
 */
function bepaalReminders(rijen, vandaag, config) {
  const drempels = config.reminder_dagen;
  const kandidaten = [];

  rijen.forEach(function (rij, index) {
    if (!rij.ouder_email || !rij.uitgenodigd_op) {
      return;
    }
    if (rij.action_type_af && rij.ixly_af) {
      return;
    }
    // Geen automatische reminders over de achterstand van vóór de startdatum.
    if (config.startdatum && rij.uitgenodigd_op < config.startdatum) {
      return;
    }
    if (rij.reminders_verzonden >= drempels.length) {
      return;
    }
    // Minimaal één volle dag tussen twee GESLAAGDE berichten (automatisch of handmatig) --
    // voorkomt dat een handmatige reminder de volgende dag alsnog door de automatische run
    // wordt "ingehaald". Dit venster geldt bewust NIET voor laatste_poging_op: een mislukte
    // poging moet de eerstvolgende dag gewoon opnieuw geprobeerd worden (Task 10-gedrag),
    // dus daar blijft de exacte-dag-vergelijking staan.
    if (_recentBericht(rij.laatste_reminder_op, vandaag) || rij.laatste_poging_op === vandaag) {
      return;
    }

    const drempel = drempels[rij.reminders_verzonden];
    if (_dagenTussen(rij.uitgenodigd_op, vandaag) < drempel) {
      return;
    }

    const open = [];
    if (!rij.action_type_af) {
      open.push('action_type');
    }
    if (!rij.ixly_af) {
      open.push('ixly');
    }

    kandidaten.push({ index: index, open_testen: open, drempel: drempel });
  });

  const grens = config.max_mails_per_run;
  return {
    teVersturen: kandidaten.slice(0, grens),
    afgekapt: Math.max(0, kandidaten.length - grens)
  };
}

/**
 * Verstuurt de reminders en werkt de tellers bij.
 *
 * De teller gaat alleen omhoog na een HTTP 200; bij een mislukking wordt alleen
 * laatste_poging_op gezet, zodat de volgende dagelijkse run het opnieuw probeert.
 *
 * @param {Object[]} rijen
 * @param {Object[]} teVersturen uit bepaalReminders
 * @param {string} vandaag 'YYYY-MM-DD'
 * @param {Object} config
 * @param {string} soort 'reminder-automatisch', 'reminder-handmatig' of 'uitnodiging-handmatig'
 * @return {{rijen: Object[], verstuurd: number, mislukt: number}}
 */
function verstuurReminders(rijen, teVersturen, vandaag, config, soort) {
  const kopie = rijen.map(function (r) { return Object.assign({}, r); });
  let verstuurd = 0;
  let mislukt   = 0;

  teVersturen.forEach(function (opdracht) {
    const rij = kopie[opdracht.index];
    const ontvanger = config.testmodus ? config.testmodus_adres : rij.ouder_email;

    try {
      _roepHerinneringAan({
        email:       ontvanger,
        voornaam:    (rij.ouder_naam || '').split(' ')[0] || 'daar',
        naam_kind:   rij.naam_kind,
        school_code: rij.vereniging,
        code:        String(rij.code),
        open_testen: opdracht.open_testen
      });

      // Handmatig verbruikt geen automatische poging, maar blokkeert wel vandaag.
      if (soort === 'reminder-automatisch') {
        rij.reminders_verzonden += 1;
      }
      rij.laatste_reminder_op = vandaag;
      rij.laatste_poging_op   = vandaag;
      verstuurd += 1;

      logRegel(soort, Object.assign({}, rij, { open_testen: opdracht.open_testen }), 'ok',
        'drempel ' + opdracht.drempel + (config.testmodus ? ' (TESTMODUS naar ' + ontvanger + ')' : ''));

    } catch (fout) {
      rij.laatste_poging_op = vandaag;
      mislukt += 1;
      logRegel(soort, Object.assign({}, rij, { open_testen: opdracht.open_testen }), 'mislukt',
        String(fout.message || fout));
    }
  });

  return { rijen: kopie, verstuurd: verstuurd, mislukt: mislukt };
}

function _roepHerinneringAan(payload) {
  const url = leesGeheimen().herinnering_url;
  if (!url) {
    throw new Error('GROVIA_HERINNERING_URL niet gezet in de Script Properties.');
  }

  const respons = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const code = respons.getResponseCode();
  if (code !== 200) {
    throw new Error('grovia-herinnering gaf HTTP ' + code + ': ' + respons.getContentText().slice(0, 200));
  }

  const body = JSON.parse(respons.getContentText());
  if (!body.verstuurd) {
    throw new Error('niet verstuurd: ' + (body.reden || body.fout || 'onbekend'));
  }
}

function _dagenTussen(van, tot) {
  const eenDag = 24 * 60 * 60 * 1000;
  return Math.floor((new Date(tot + 'T00:00:00') - new Date(van + 'T00:00:00')) / eenDag);
}

/**
 * True als er vandaag of gisteren al een bericht (automatisch of handmatig) is
 * verstuurd of geprobeerd -- voorkomt dat een handmatige reminder de volgende dag
 * alsnog door de automatische run wordt "ingehaald".
 */
function _recentBericht(datum, vandaag) {
  if (!datum) {
    return false;
  }
  return _dagenTussen(datum, vandaag) <= 1;
}

// Alleen voor `node --test`; Apps Script kent `module` niet en slaat dit over.
if (typeof module !== 'undefined') {
  module.exports = { bepaalReminders: bepaalReminders };
}
