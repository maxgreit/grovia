# Ontwerp: geboortedatums blijven staan (herstel, tekstopslag, beveiliging, bron van waarheid)

**Datum:** 2026-09-17 · **Auteur:** Max Rood (met Claude) · **Status:** concept, wacht op review

## Aanleiding

De kolom `geboortedatum_kind` in het tabblad Deelnemers van het werkboek "Grovia Deelnemers" liep sinds eind augustus herhaaldelijk leeg. Onderzoek van 2026-09-17 (versiegeschiedenis, uitvoeringslogs, live code) wees uit:

- De live Apps Script-code is identiek aan de repo; de wachter (`beschermGeboortedatums`) en het erven (`erfGeboortedatums`) draaien. Geen enkele run heeft ooit een `WACHTER:`-regel gelogd: elke run begon al met lege cellen.
- De datums verdwenen **tussen runs door, tijdens handmatige bewerkingen** door Berry en Jeffry (7 sep 16:47, 8 sep 09:24, 8 sep 20:54, 11 sep 08:16). Die versies tonen rij-operaties (hele rijen gewijzigd tot en met kolom AG: sorteren, verplaatsen of plakken). In dezelfde periode verdwenen ook `team`-waarden die op een datum lijken ("14-1"), terwijl tekstwaarden ("JO10-4") bleven staan. Het zijn dus **datum-getypeerde cellen** die sneuvelen.
- Wat precies gebeurde weten alleen Berry en Jeffry; dat is een vraag aan hen, geen blokkade voor de oplossing.

De teamwerkboeken (Kolping en Schagen) bevatten alleen door het script geschreven waarden, geen formules. Ook daar is `team` al stil omgezet naar datums ("12-2-2026"). Tekstopslag is dus veilig én lost dat mee op.

## Doel

1. De huidige datums herstellen.
2. Datums (en teamnamen) kunnen nooit meer stil van type veranderen.
3. Mensen kunnen het tabblad Deelnemers niet meer per ongeluk beschadigen, maar kunnen nog wél filteren en sorteren op een eigen tabblad.
4. Een script-eigen vangnet dat een verloren datum elke run terugzet, ook als de beveiliging ooit uitstaat.

Vier stappen, in deze volgorde uit te voeren. Elke stap is los deploybaar.

## Stap 1 — Herstel

Max draait `vulGeboortedatumClubTeamVoorBestaandeRijen()` (bestaat al in `Dagelijks.gs`) vanuit de Apps Script-editor. Die vult lege `geboortedatum_kind`/`club`/`team` uit de WooCommerce-ordermeta. Verwachting: ~98 gevulde datums (stand van 7 september 07:25). Controle: het runlog van de eerstvolgende run meldt weer kinderen per segment in plaats van ~100 "Zonder indeling".

Geen codewijziging. De functie blijft bestaan tot stap 4 live is; daarna is hij overbodig omdat de run zelf herstelt.

## Stap 2 — Tekstopslag

**Regel:** `geboortedatum_kind` wordt overal opgeslagen en doorgegeven als platte tekst `yyyy-MM-dd`. `team` en `order_ids` worden als tekst geforceerd (ze zijn al tekst in de code, maar Sheets parst "14-1" en "935,1147" zelf).

Wijzigingen:

- `Sheet.gs`
  - `leesDeelnemers`: `geboortedatum_kind` door `_alsDatumTekst` halen (bestaat al voor de andere datumkolommen; levert `yyyy-MM-dd` uit een Date óf uit tekst). Zo werkt de code met bestaande datumcellen én met tekstcellen.
  - `schrijfDeelnemers`: vóór `setValues` het kolomformaat van `geboortedatum_kind`, `team` en `order_ids` op platte tekst (`@`) zetten voor het hele databereik. Dit lost ook het bestaande TODO-item over de Nederlandse getalnotatie van `order_ids` op (freddie-rood-rij), zonder verdere codewijziging.
- `Woo.gs`: de geboortedatum uit de ordermeta normaliseren naar `yyyy-MM-dd` (nu: rauwe checkouttekst, formaat afhankelijk van het checkoutveld). Onherkenbare tekst blijft ongewijzigd doorgegeven, wordt nooit stil leeg.
- `Teams.gs`
  - `_geboortejaar` blijft werken (regex op vier cijfers; Date-tak blijft voor de overgang).
  - `_schrijfTabblad` (teamwerkboeken): kolommen `geboortedatum_kind` en `team` op `@` zetten vóór het schrijven, zodat de trainerswerkboeken hetzelfde probleem niet meer hebben.
- `Dagelijks.gs` (backfill) en `Deelnemers.gs` (erf/wachter): geen logische wijziging; ze werken op de tekstwaarde.

**Sorteerbaarheid:** `yyyy-MM-dd` sorteert als tekst chronologisch. Dat was de eis.

**Weergave:** cellen tonen `2017-03-22` in plaats van `22 maart 2017`. Bewust: leesbaar, eenduidig, onafhankelijk van iemands locale-instellingen.

**Overgang:** de eerste run na het plakken leest de bestaande Date-cellen (via `_alsDatumTekst`), zet het kolomformaat op tekst en schrijft tekst terug. Eenmalig, geen migratiefunctie nodig. Let op de bekende tijdzone-valkuil (Date → tekst kan een dag verschuiven bij middernachtdatums): `_alsDatumTekst` gebruikt de scripttijdzone, dus dat is al afgedekt; in tests expliciet controleren met `1 januari 2016`.

**Tests (node):** lezen van Date-cel → `yyyy-MM-dd`; lezen van tekstcel blijft gelijk; schrijven zet formaat op `@` voor precies de drie kolommen; Woo-normalisatie voor de voorkomende invoerformaten (`22-03-2017`, `22/03/2017`, `2017-03-22`, onbruikbare tekst); `_geboortejaar` op tekst.

## Stap 3 — Beveiliging en filtertabblad

**Beveiliging:** het hele tabblad Deelnemers krijgt een bereikbeveiliging waarbij alleen Max mag bewerken. De dagelijkse trigger draait als Max en blijft werken. Menu-acties (reminders, "Alles nu verversen") mislukken voor anderen; die gebruiken ze niet. Handmatige kolommen (`bedrag_correctie`, correcties op `action_type`) vult Max.

Dit wordt handmatig ingesteld in de Sheets-UI (Gegevens → Bladen en bereiken beveiligen), niet via code: het is een eenmalige instelling en code die beveiligingen zet is lastiger te controleren dan de UI.

**Filtertabblad "Overzicht":** nieuw tabblad met in `A1` één formule:

```
=QUERY(Deelnemers!A:AA; "select * where B is not null"; 1)
```

Daaronder niets anders. Dat tabblad is niet beveiligd. Berry en Jeffry filteren en sorteren daar via een **filterweergave** (Gegevens → Filterweergaven), niet met "Bereik sorteren": sorteren van een QUERY-uitkomst zelf geeft een fout of verwarring. Ik maak twee filterweergaven aan ("Kolping", "Schagen", gefilterd op `vereniging`) zodat ze alleen hoeven te klikken. Korte instructie in het tabblad zelf (rij 1 is de kopregel uit de QUERY, dus de instructie komt in de tabbladnaam of een notitie op `A1`).

Waarom QUERY en niet `={Deelnemers!A:AA}`: QUERY laat lege rijen weg en houdt de kopregel, zodat filterweergaven netjes werken.

**Communicatie:** één bericht aan Berry en Jeffry: "Deelnemers is nu alleen-lezen; filteren en sorteren doe je in Overzicht via de filterweergaven. Wat deden jullie op 7, 8 en 11 september?"

## Stap 4 — Bron van waarheid

Nieuw verborgen tabblad **"Geboortedatums"** met kolommen `naam_slug`, `geboortedatum_kind`, `bijgewerkt_op`. Alleen het script schrijft erin; beveiligd voor iedereen behalve Max.

Gedrag in de dagelijkse run, in stap 1 direct na `erfGeboortedatums`:

1. **Terugvullen:** elke Deelnemers-rij met lege `geboortedatum_kind` krijgt de waarde uit Geboortedatums voor dezelfde `naam_slug`, als die er is. Aantal wordt in het runlog gemeld ("N geboortedatum(s) teruggezet uit Geboortedatums") en, net als de wachter, als `fout`-regel in het Log-tabblad, zodat leeglopen zichtbaar blijft.
2. **Bijwerken:** elke Deelnemers-rij mét datum schrijft die naar Geboortedatums (nieuw of overschrijven). Eén datum per slug; de meest recente run wint.

Ontwerpkeuzes:

- Sleutel is `naam_slug` zonder seizoen: een geboortedatum verandert nooit en dit is precies wat `erfGeboortedatums` ook al aanneemt. Terugkeerders erven dus ook via dit tabblad.
- Geboortedatums wordt **nooit** geleegd door de run; er is geen "clearContent + herschrijven" zoals bij Deelnemers, alleen upsert op slug. Een fout in Deelnemers kan zo niet doorlekken.
- Geen nieuwe Sheet-abstractie: dezelfde `leesX`/`schrijfX`-stijl als `Sheet.gs` nu heeft, met een `GEBOORTEDATUM_KOLOMMEN`-lijst en kopregelcontrole (zoals "Ixly Scores").
- De bestaande wachter en erf blijven; het vangnet komt erbij. `vulGeboortedatumClubTeamVoorBestaandeRijen` blijft als noodgereedschap voor kinderen die nog nooit een datum in het werkboek hadden.

**Tests (node):** terugvullen bij lege cel; niet overschrijven bij gevulde cel; bijwerken van de bron uit gevulde rijen; slug zonder bron blijft leeg; runlog-melding alleen bij herstel.

**Uitrol:** tabblad aanmaken met kopregel, `Sheet.gs`/`Deelnemers.gs`/`Dagelijks.gs` plakken in één zitting buiten de 07:00-run, "Alles nu verversen" draaien en controleren dat Geboortedatums gevuld is met ~98 rijen.

## Buiten scope

- Onwaarschijnlijke geboortedata detecteren (bestaand TODO-item, los oppakken).
- Kopregelcontrole op Deelnemers zelf (zinnig, maar apart).
- Achterhalen welke exacte muisklik van Berry of Jeffry de datums wiste; het ontwerp maakt dat irrelevant.
