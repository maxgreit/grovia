# Design: Geboortedatum, club en team toevoegen aan Deelnemers

**Datum:** 2026-08-12 · **Auteur:** Max Rood (met Claude) · **Status:** goedgekeurd ontwerp

## Doel

Drie extra gegevens per deelnemer vastleggen in het Deelnemers-tabblad, afkomstig uit
WooCommerce order-metadata die bij checkout wordt ingevuld: de geboortedatum van het
kind, de voetbalclub waar het speelt, en het team. Moet ook met terugwerkende kracht
gevuld worden voor bestaande rijen (backfill).

## Context (bevindingen inspectie 2026-08-12)

- **Naamsverwarring vooraf opgelost:** het Deelnemers-tabblad heeft al een kolom
  `vereniging`, maar die bevat de **academie-code** (`KA`/`SU`/`MM`), afgeleid uit de
  WooCommerce-productcategorie via `mapping.scholen` (Config.gs) — niet de
  voetbalclub. De nieuwe kolom voor de échte club heet daarom **`club`**, niet
  `vereniging`.
- **Live geverifieerd tegen negen echte orders** (935, 1055, 1056, 1133, 1136, 1144,
  1159, 1192, 1198, 1218, 1240, 1246, 1270) welke velden waar zitten:
  - `'Geboortedatum kind'` — **order-niveau** meta, bijv. `'2016-06-21'`.
  - `'Vereniging'` — **orderregel-niveau** meta (per product), bijv. `'Vrone'`,
    `'Schagen united'`, `'Kolping'`.
  - `'Team'` — **orderregel-niveau** meta, bijv. `'O11-1'`, `'12-4'`, `'JO11-07'`.
- **Historische dekking, geverifieerd, geen aanname:**
  - Order 935 (Freddie Rood, 2026-04-09) mist alle drie — verklaard: dit is Max'
    eigen testorder, waar deze velden bewust niet zijn ingevuld. Geen indicatie dat
    het veld toen nog niet bestond.
  - Order 1055/1056 (2026-05-17, echte klantorders): **wel** geboortedatum, **geen**
    club/team.
  - Order 1133 (2026-06-05) en alles daarna: alle drie aanwezig.
  - Conclusie: geboortedatum zit er al vrijwel vanaf het begin in; club/team zijn als
    checkoutveld pas ergens tussen 17 mei en 5 juni 2026 toegevoegd. Rijen van vóór
    die knip blijven voor club/team leeg na de backfill — dat is de data-realiteit,
    geen bug.
- **Orderregel-conflict, geverifieerd:** order 1270 (Roan Brethouwer) heeft twee
  orderregels (Cyclus 1 + Cyclus 2, in dezelfde order) met net andere Team-waarden
  (`'JO11-07'` vs `'JO11-7'`) — typo-ruis, geen echt verschil. Dit is een
  **binnen-order** conflict tussen orderregels, geen conflict tussen twee losse
  orders.
- **Kolomvolgorde-constraint (bestaand):** de kolomvolgorde in `KOLOMMEN` (Sheet.gs)
  moet exact overeenkomen met de fysieke kolomvolgorde in het live werkboek. Nieuwe
  kolommen dus altijd op de plek waar Max ze ook echt in de Sheet-UI invoegt — niet
  per definitie achteraan. Precedent: `rol`/`product`/`bedrag` staan ook niet
  achteraan, maar bewust na `vereniging`, op verzoek.
- **Amendement (zelfde dag, vóór rollout):** aanvankelijk achteraan gepland (zoals
  bij `ixly_taken`/`reminder_anker`), op verzoek verplaatst naar **tussen
  `naam_kind` en `vereniging`** — zie Component 2. Kon nog zonder risico, want er
  was nog niets fysiek in het werkboek aangepast.

## Scope-beslissingen

| Beslissing | Keuze |
|---|---|
| Kolomnamen | `geboortedatum_kind`, `club`, `team` (naamgeving consistent met bestaand `naam_kind` ← `'Naam kind'`) |
| Bron binnen één order met meerdere regels | Eerste orderregel telt voor `club`/`team` (het geobserveerde conflict is typo-ruis, niet inhoudelijk) |
| Bron over meerdere losse orders van hetzelfde kind | **Vul alleen als de rij nog leeg staat, nooit overschrijven** — zelfde patroon als `ixly_taken`, bewust NIET het datumvergelijkings-patroon van rol/product/bedrag (dat patroon blijft voor altijd leeg als de vroegste order het veld mist; "vul-als-leeg" vult vanzelf zodra een latere order wél data heeft) |
| Backfill-mechanisme | Eenmalige functie, zelfde vorm als de al verwijderde `vulRolProductBedragVoorBestaandeRijen`: bulk `include=`-ophaal van alle betrokken order-ID's (geen aanroep per rij), lokaal per rij invullen, dan de functie weer verwijderen |
| Historische gaten | Bewust geaccepteerd: rijen ouder dan begin juni blijven zonder club/team; rijen zonder enige order met deze velden blijven leeg |

## Componenten

### 1. `google-apps-script/deelnemers/Woo.gs` — extractie

`_normaliseer(order, producten)` (gebruikt door `haalOrders()`) krijgt drie nieuwe
velden op het genormaliseerde order-object:

- `geboortedatum_kind`: order-niveau meta `'Geboortedatum kind'`, of `''` als afwezig.
- `club`: meta `'Vereniging'` van de **eerste** `line_items`-regel, of `''`.
- `team`: meta `'Team'` van de **eerste** `line_items`-regel, of `''`.

Puur toevoegen aan de bestaande extractielogica (naast `ixly_taken`, dat al hetzelfde
patroon volgt: order-meta zoeken, trimmen, lege string als fallback).

### 2. `google-apps-script/deelnemers/Sheet.gs` — kolommen

`KOLOMMEN` krijgt `geboortedatum_kind`, `club`, `team` toegevoegd **tussen
`naam_kind` en `vereniging`** (zelfde patroon als `rol`/`product`/`bedrag`, die na
`vereniging` staan in plaats van achteraan). **Max moet drie kolommen op die plek
invoegen in het werkboek zelf**, met kopregel, vóór dit live gaat — niet achteraan.

Geen coercion nodig voor deze drie velden in `leesDeelnemers()` — het zijn platte
strings, geen datum/boolean/getal-coercion zoals bij `ixly_af`/`seizoen`.
`geboortedatum_kind` blijft bewust een tekst-datum (`'YYYY-MM-DD'`), geen
`_alsDatumTekst()`-behandeling — die functie is voor kolommen die Sheets soms zelf
omzet naar een echte Date-cel; een simpele importwaarde uit de API heeft dat risico
hier niet op dezelfde manier, en er wordt nergens op deze datum gerekend (geen
leeftijdsberekening in scope).

### 3. `google-apps-script/deelnemers/Deelnemers.gs` — upsert-logica

In `upsertDeelnemers()`:

- **Nieuwe rij:** `geboortedatum_kind`, `club`, `team` direct overnemen van de
  binnenkomende order (net als `rol`/`product`/`bedrag` nu al bij rij-aanmaak
  gebeurt).
- **Bestaande rij:** vlak bij de bestaande `ixly_taken`-vul-als-leeg-regel, dezelfde
  vorm voor de drie nieuwe velden:
  ```js
  if (!rij.geboortedatum_kind && order.geboortedatum_kind) {
    rij.geboortedatum_kind = order.geboortedatum_kind;
  }
  if (!rij.club && order.club) { rij.club = order.club; }
  if (!rij.team && order.team) { rij.team = order.team; }
  ```

### 4. Eenmalige backfill-functie (`Dagelijks.gs` of `Menu.gs`, tijdelijk)

1. Lees alle Deelnemers-rijen.
2. Verzamel alle `order_ids` van rijen waar minstens één van de drie velden leeg is.
3. Haal die orders **in bulk** op via WooCommerce's `include=<id1>,<id2>,...`
   (gechunkt per ~50-100 ID's per aanroep, zelfde WAF-veilige patroon als
   `_haalProductCategorieen`: herkenbare User-Agent, pauzes tussen aanroepen).
4. Extraheer per opgehaalde order dezelfde drie velden (hergebruik de logica uit
   `_normaliseer()`, of een losse kleine helper als hergebruik niet praktisch is).
5. Per rij: doorloop haar `order_ids` **chronologisch** (al oplopend gesorteerd) en
   vul per veld de eerste order die dat veld heeft — zelfde vul-als-leeg-regel als
   bij de dagelijkse sync.
6. Schrijf de bijgewerkte rijen terug (`schrijfDeelnemers`).
7. **Na één succesvolle run handmatig verwijderen** uit `Dagelijks.gs`/`Menu.gs` —
   zelfde discipline als bij `backfillOudereOrders`,
   `vulRolProductBedragVoorBestaandeRijen` e.a. (zie `docs/HANDOFF.md`,
   2026-08-04-sessie).

### 5. Testen (`node --test`)

- `Woo.gs`: extractie van alle drie velden uit een order-fixture, inclusief het geval
  zonder deze meta's (lege string) en het geval met meerdere `line_items` (eerste
  regel telt).
- `Deelnemers.gs`: vul-als-leeg-gedrag voor alle drie velden — (a) rij-aanmaak vult
  direct, (b) een latere order met data vult een lege rij, (c) een order zónder deze
  velden overschrijft een al gevulde rij niet, (d) een order met een ANDERE waarde
  overschrijft een al gevulde rij ook niet (bewust, "eerste order met data wint, punt
  uit").

## Bekende beperkingen (bewust geaccepteerd)

- Rijen zonder enige order met deze velden (test-orders, of orders van vóór het
  checkoutveld bestond) blijven na de backfill leeg. Geen foutmelding, geen
  "Controleren"-regel — dit is verwacht gedrag, geen storing.
- Bij een echt inhoudelijk verschil tussen twee losse orders (zeldzaam; niet
  waargenomen buiten de typo-ruis van order 1270) wint de eerst-verwerkte order met
  data, wat niet per se de chronologisch vroegste hoeft te zijn binnen één sync-run
  (WooCommerce's API-volgorde is niet gegarandeerd chronologisch oplopend). Voor
  waarden als geboortedatum/team die in de praktijk niet wijzigen tussen orders van
  hetzelfde kind, is dit verwaarloosbaar.
