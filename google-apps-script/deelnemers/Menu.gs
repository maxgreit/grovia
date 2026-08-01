/**
 * Het menu "Grovia" met de handmatige acties.
 *
 * Elke verzendactie vraagt eerst om bevestiging, met hoeveel mails naar wie gaan.
 */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Grovia')
    .addItem('Reminder sturen naar selectie', 'menuReminderSelectie')
    .addItem('Uitnodiging opnieuw sturen naar selectie', 'menuUitnodigingSelectie')
    .addSeparator()
    .addItem('Alles nu verversen', 'menuVerversAlles')
    .addToUi();
}

/**
 * Stuurt een reminder naar de geselecteerde rijen. Verbruikt geen automatische poging.
 */
function menuReminderSelectie() {
  _verstuurNaarSelectie('reminder-handmatig');
}

/**
 * Stuurt de openstaande testen opnieuw. Technisch identiek aan een reminder: dezelfde
 * mail met dezelfde links. Aparte menu-ingang omdat de klant het als iets anders ziet.
 */
function menuUitnodigingSelectie() {
  _verstuurNaarSelectie('uitnodiging-handmatig');
}

function menuVerversAlles() {
  const ui = SpreadsheetApp.getUi();
  try {
    const samenvatting = dagelijkseRun(false);
    ui.alert('Klaar', samenvatting, ui.ButtonSet.OK);
  } catch (fout) {
    ui.alert('Mislukt', String(fout.message || fout), ui.ButtonSet.OK);
  }
}

function _verstuurNaarSelectie(soort) {
  const ui = SpreadsheetApp.getUi();
  const config = leesConfig();
  const rijen = leesDeelnemers();

  const indexen = _geselecteerdeIndexen();
  if (!indexen.length) {
    ui.alert('Geen selectie', 'Selecteer eerst één of meer rijen in het tabblad Deelnemers.', ui.ButtonSet.OK);
    return;
  }

  const teVersturen = [];
  const overgeslagen = [];

  indexen.forEach(function (index) {
    const rij = rijen[index];
    if (!rij) {
      return;
    }
    if (!rij.ouder_email) {
      overgeslagen.push(rij.naam_kind + ' (geen e-mailadres)');
      return;
    }
    if (rij.action_type_af && rij.ixly_af) {
      overgeslagen.push(rij.naam_kind + ' (alles al afgerond)');
      return;
    }

    const open = [];
    if (!rij.action_type_af) {
      open.push('action_type');
    }
    // Zonder ixly_taken is er niets te automatiseren (legacy-rij van vóór de
    // assignment-uuid-fix, of een order waarvan de order-meta nog niet is
    // aangekomen) -- dan hoort 'ixly' niet in open_testen, anders komt de rij
    // dagelijks als kansloze poging terug.
    if (!rij.ixly_af && rij.ixly_taken && rij.ixly_taken.length) {
      open.push('ixly');
    }
    teVersturen.push({ index: index, open_testen: open, drempel: 0 });
  });

  if (!teVersturen.length) {
    ui.alert('Niets te versturen', 'Overgeslagen:\n' + overgeslagen.join('\n'), ui.ButtonSet.OK);
    return;
  }

  const ontvangers = teVersturen.map(function (o) {
    return '· ' + rijen[o.index].naam_kind + ' → ' +
      (config.testmodus ? config.testmodus_adres : rijen[o.index].ouder_email);
  }).join('\n');

  const waarschuwing = config.testmodus
    ? '\n\nTESTMODUS staat AAN — alles gaat naar ' + config.testmodus_adres + '.'
    : '';

  const antwoord = ui.alert(
    'Versturen?',
    teVersturen.length + ' mail(s):\n\n' + ontvangers + waarschuwing +
      (overgeslagen.length ? '\n\nOvergeslagen:\n' + overgeslagen.join('\n') : ''),
    ui.ButtonSet.YES_NO
  );

  if (antwoord !== ui.Button.YES) {
    return;
  }

  const vandaag = _vandaag();
  const resultaat = verstuurReminders(rijen, teVersturen, vandaag, config, soort);
  schrijfDeelnemers(resultaat.rijen);

  ui.alert('Klaar',
    resultaat.verstuurd + ' verstuurd, ' + resultaat.mislukt + ' mislukt.\nZie het tabblad Log.',
    ui.ButtonSet.OK);
}

/**
 * @return {number[]} nul-gebaseerde indexen in de deelnemerslijst
 */
function _geselecteerdeIndexen() {
  const blad = SpreadsheetApp.getActiveSheet();
  if (blad.getName() !== 'Deelnemers') {
    return [];
  }

  const indexen = [];
  blad.getActiveRangeList().getRanges().forEach(function (bereik) {
    for (let rij = bereik.getRow(); rij < bereik.getRow() + bereik.getNumRows(); rij += 1) {
      if (rij >= 2 && indexen.indexOf(rij - 2) === -1) {
        indexen.push(rij - 2);
      }
    }
  });
  return indexen;
}

function _vandaag() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}
