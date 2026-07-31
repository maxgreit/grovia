/**
 * Koppelt de reacties uit de twee Action Type-resultatensheets aan deelnemers.
 *
 * De bestaande resultatensheets worden ALLEEN GELEZEN. Google Forms overschrijft
 * kolommen in en naast het reactie-tabblad bij elke inzending; schrijven daar zou
 * de scoring-formule slopen.
 */

/**
 * @param {Object[]} rijen deelnemersrijen
 * @param {Object[]} reacties {code, naam, tijdstip, action_type}
 * @return {{rijen: Object[], ongekoppeld: Object[]}}
 */
function koppelReacties(rijen, reacties) {
  const kopie = rijen.map(function (r) { return Object.assign({}, r); });
  const ongekoppeld = [];

  const opCode = {};
  kopie.forEach(function (rij, i) {
    opCode[String(rij.code).trim()] = i;
  });

  reacties.forEach(function (reactie) {
    const code = String(reactie.code || '').trim();

    if (!code) {
      ongekoppeld.push({
        naam: reactie.naam, tijdstip: reactie.tijdstip,
        action_type: reactie.action_type, reden: 'geen controlecode ingevuld'
      });
      return;
    }

    const index = opCode[code];
    if (index === undefined) {
      ongekoppeld.push({
        naam: reactie.naam, tijdstip: reactie.tijdstip,
        action_type: reactie.action_type, reden: 'code niet gevonden'
      });
      return;
    }

    if (!String(reactie.action_type || '').trim()) {
      ongekoppeld.push({
        naam: reactie.naam, tijdstip: reactie.tijdstip,
        action_type: '', reden: 'geen action type berekend'
      });
      return;
    }

    // Eerste inzending is de geldige; een tweede overschrijft niets.
    if (kopie[index].action_type_af) {
      return;
    }

    kopie[index].action_type_af = true;
    kopie[index].action_type    = String(reactie.action_type).trim();
    kopie[index].action_type_op = String(reactie.tijdstip).slice(0, 10);
  });

  return { rijen: kopie, ongekoppeld: ongekoppeld };
}

/**
 * Leest de reacties uit de resultatensheets van beide verenigingen.
 *
 * Het reactie-tabblad heeft de kolomvolgorde A=Timestamp B=Naam C..V=Vraag 1..20
 * W=Begrijpelijkheid X=Controlecode. Het Resultaten-tabblad heeft A=Naam B=Action Type.
 * De koppeling tussen die twee is de rijpositie: rij N in Resultaten hoort bij rij N
 * in het reactie-tabblad.
 *
 * @param {Object} sheetIds {KA: '<id>', SU: '<id>'}
 * @return {Object[]} {code, naam, tijdstip, action_type}
 */
function haalReacties(sheetIds) {
  const alles = [];

  Object.keys(sheetIds).forEach(function (vereniging) {
    const werkboek = SpreadsheetApp.openById(sheetIds[vereniging]);

    const reactieTab = werkboek.getSheets().filter(function (tab) {
      return tab.getName() !== 'Resultaten' && tab.getName() !== 'Action Types';
    })[0];
    const resultatenTab = werkboek.getSheetByName('Resultaten');

    if (!reactieTab || !resultatenTab || reactieTab.getLastRow() < 2) {
      return;
    }

    const aantal    = reactieTab.getLastRow() - 1;
    const reacties  = reactieTab.getRange(2, 1, aantal, 24).getValues();
    const resultaten = resultatenTab.getRange(2, 1, aantal, 2).getValues();

    reacties.forEach(function (rij, i) {
      alles.push({
        tijdstip:    _datumTekst(rij[0]),
        naam:        String(rij[1] || '').trim(),
        // AANNAME, NOG NIET GEVERIFIEERD: kolom X (index 23) is gebaseerd op de
        // veronderstelling dat het Controlecode-veld als laatste veld na de 20
        // vragen + Begrijpelijkheid landt. Dit is pas een feit zodra Max het
        // Controlecode-veld daadwerkelijk heeft toegevoegd in de Google Forms-editor
        // (Task 6 stap 3). Eerstvolgende stap daarna: deze index handmatig
        // controleren tegen de echte reactie-tabbladen (zie Task 8 stap 5 /
        // testReacties()) en zo nodig hier én in docs/ACTION-TYPE-TEST.md aanpassen.
        code:        String(rij[23] || '').trim(),
        action_type: String((resultaten[i] || [])[1] || '').trim(),
        vereniging:  vereniging
      });
    });
  });

  return alles;
}

function _datumTekst(waarde) {
  if (waarde instanceof Date) {
    return Utilities.formatDate(waarde, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(waarde || '').slice(0, 10);
}

// Alleen voor `node --test`; Apps Script kent `module` niet en slaat dit over.
if (typeof module !== 'undefined') {
  module.exports = { koppelReacties: koppelReacties };
}
