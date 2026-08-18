# Design: Geautomatiseerde teamindeling op basis van Ixly-scores

**Datum:** 2026-08-18 · **Auteur:** Max Rood (met Claude) · **Status:** goedgekeurd ontwerp

## Doel

De handmatige teamindeling die Grovia nu in een los Excel-bestand maakt
("Complexiteit berekening.xlsx") vervangen door een geautomatiseerde keten: scores van
de Ixly-games Blocks en Rally ophalen, per deelnemer bewaren, omrekenen naar een
totaalscore, en per vereniging een werkboek vullen met vier gerangschikte segmenten en
een voorgestelde groepsindeling. De trainer houdt het laatste woord.

## Context (live geverifieerd 2026-08-18)

Dit ontwerp bouwt op een verificatie tegen de echte Ixly-API, niet op swagger-voorbeelden
— het swagger-voorbeeld bij dit endpoint gaat over heel andere assessments (ITS/WPV) en
zegt niets over de games.

- **`GET /api/public/candidate_tasks/{uuid}/score` werkt en geeft HTTP 200.** Geverifieerd
  met de candidate_tasks van Magnus Boekel (order 1345, beide games `finished` op
  2026-08-16).
- **De respons is cumulatief per kandidaat, niet per taak.** De Blocks-taak gaf
  `games: ["blocks"]` met alleen de blocks-node; de Rally-taak gaf `games: ["rally",
  "blocks"]` mét beide nodes. De implementatie moet de `normed`-dicts van alle taken
  samenvoegen in plaats van aan te nemen dat één aanroep alles heeft.
- **Elke schaal heeft `raw`, `default_z` en `latent`.** `latent` staat op een 1-10-schaal
  en is de waarde die in Berry's handmatige sheet terechtkwam (afgerond). `raw` staat in
  de eenheid van de meting (milliseconden, aantallen) en is onderling niet vergelijkbaar.
- **Beschikbare velden** (Ixly-sleutel → onze kolomnaam):

  | Ixly | Kolom | In Berry's sheet? |
  |---|---|---|
  | `normed.blocks.planning` | `blocks_planning` | ja ("Planning") |
  | `normed.blocks.flexibility` | `blocks_flexibiliteit` | ja ("flexibiliteit in denken") |
  | `normed.rally.performance` | `rally_prestatie` | nee |
  | `normed.rally.quality` | `rally_kwaliteit` | nee |
  | `normed.rally.reaction_time` | `rally_reactiesnelheid` | nee |
  | `normed.rally.consistence` | `rally_consistentie` | ja ("Consistentie in reactiesnelheid") |
  | `normed.rally.sustained_attention` | `rally_volgehouden_aandacht` | ja ("Volgehouden aandacht") |
  | `normed.rally.response_inhibition` | `rally_respons_inhibitie` | ja ("Respons Inhibitie") |
  | `normed.rally.response_to_mistakes` | `rally_reactie_op_fouten` | ja ("Reactie op fouten") |
  | `blocks_levels_completed` | `levels_voltooid` | nee |
  | `blocks_levels_perfect` | `levels_perfect` | nee |

- **De rij "Prestatie" onder Test Blocks in Berry's sheet heeft geen tegenhanger in de
  API.** Blocks levert alleen `planning` en `flexibility`. De enige "prestatie" in de
  respons zit onder rally. Vraag staat uit bij de klant, maar blokkeert niets meer: alle
  negen genormeerde schalen gaan sowieso mee.
- **Er is geen weg van kandidaat naar taak.** `GET /candidates/api_identifier/{order_id}`
  geeft als relaties alleen `labels` (geverifieerd op order 1246), en swagger heeft geen
  lijst- of filtervariant voor assignments of candidate_tasks. Zonder een bewaarde
  `assignment_uuid` is een score dus onbereikbaar.
- **Uuid's worden pas bewaard sinds 2026-08-01** (commit `160b91e`, order-meta
  `_grovia_ixly_taken`). De ~30 legacy-kandidaten zijn destijds handmatig via Ixly's eigen
  bulkactie uitgenodigd en zijn nooit langs `ixly-aanmelding` gekomen. Hun scores zijn
  niet via de publieke API op te halen — bevestigd met de klant: die worden handmatig
  ingevoerd.

### Antwoorden van de klant

- **"Neem alles mee"** — alle beschikbare velden meewegen, "dan krijg je een totaalbeeld
  en wordt de verdeling zo eerlijk en concreet mogelijk".
- **Ruben's formule is nog in beraad** juist vanwege de nieuwe datapunten. De wegingen
  moeten dus instelbaar zijn; de standaard in dit ontwerp is voorlopig.

## Scope-beslissingen

| Vraag | Keuze | Reden |
|---|---|---|
| Ranglijst of ook indeling? | Beide | Expliciet gevraagd |
| Weging Blocks vs Rally | Per schaal instelbaar in Config | Rally heeft 7 schalen en Blocks 2; een ongewogen gemiddelde laat Rally 78% van de score bepalen. Ruben's formule landt hier zodra die rond is |
| Ruwe leveltellingen | Tonen, gewicht 0 | Staan niet op de 1-10-schaal; meemiddelen vertekent |
| Welke deelnemers | Alleen het **huidige seizoen**, bepaald met `bepaalSeizoen(vandaag)` uit `Deelnemers.gs` (1-augustusgrens) | Zie hieronder |
| Segmentatie | Vereniging × leeftijd × rol | Volgt `docs/TODO.md`: "Google Sheet per vereniging met vier tabbladen: jong voetbal, oud voetbal, jong keeper, oud keeper" |
| Leeftijdsgrens | Geboortejaar in Config, apart per rol | Grens verschilt tussen spelers en keepers |
| Groepsvorming | Aantal groepen per segment in Config | Aantallen wisselen per seizoen |
| Opslag | Apart werkboek per vereniging | Trainers zien geen ouder-e-mailadressen, bedragen of Financieel |
| Handmatige correcties | Twee kolommen: voorstel + definitief | De trainersblik mag niet door een dagelijkse herberekening gewist worden |
| Rekenlogica | In Apps Script, niet in de Function | Volgt `ixly-status`; alle rekenlogica staat bij `Financieel.gs`/`MiniMove.gs` waar de node-tests al draaien |

## Componenten

### 1. `ixly-scores/` — nieuwe Azure Function

Eén taak: assignment-uuid's in, scores uit. Hergebruikt `grovia_shared/ixly_api.py`
volledig. **Geen nieuwe omgevingsvariabelen**, dus ook niet de `deploy.yml`-valkuil waar
dit project twee keer op is gestruikeld (`ACTION_TYPE_ENTRY_*`, en de env var voor de
vaste adviseur die daar nog steeds op wacht).

```
in:  {"deelnemers": [{"order_id": "1345",
                      "taken": [{"naam": "Blocks Game", "assignment_uuid": "..."},
                                {"naam": "Rally Game",  "assignment_uuid": "..."}]}]}
uit: {"resultaten": {"1345": {"blocks": {"planning": 4.04, "flexibility": 5.89},
                              "rally":  {"performance": 3.59, ...},
                              "levels_completed": 18, "levels_perfect": 9}}}
```

Geeft alleen `latent` door; `raw` en `default_z` blijven achter. De sleutels blijven die
van Ixly zelf — het vertalen naar Nederlandse kolomnamen gebeurt op één plek, in
`Scores.gs` (zie hieronder), zodat de Function niets van de sheetstructuur hoeft te weten. Bovengrens van 100
deelnemers per aanroep, net als `ixly-status`, met dezelfde HTTP 400 bij overschrijding.
Eén stukke deelnemer blokkeert de rest niet.

### 2. `grovia_shared/ixly_api.py` — `haal_taak_score()`

Nieuwe functie naast `haal_taak_status()`, met dezelfde tokenlus: een `candidate_task` is
alleen zichtbaar voor de adviseur die de kandidaat bezit, dus alle vier de adviseur-tokens
langslopen tot er een de taak ziet (zie ADR-013). Geeft `{}` terug als geen enkel token de
taak vindt; een echte HTTP-fout propageert.

### 3. `google-apps-script/deelnemers/Scores.gs` — ophalen en bewaren

Verzamelt de rijen met `ixly_af = JA` waarvan de score nog ontbreekt én die een gevulde
`ixly_taken` hebben, roept de Function aan, en schrijft weg in het nieuwe tabblad "Ixly
Scores". De vertaaltabel van Ixly's Engelse sleutels naar onze kolomnamen staat hier op
één plek, mét de herkomst in een comment — dezelfde discipline als `AFGERONDE_STATES` na
de `'completed'`-bug.

Scores worden **één keer opgehaald en daarna bewaard**: een kind met een score wordt niet
opnieuw bij Ixly bevraagd. Dat scheelt honderden aanroepen per week en maakt het tabblad
de bron van waarheid, ook voor handmatig ingevoerde kinderen.

**Een lege of onvolledige respons is géén score en wordt niet weggeschreven.** De Function
geeft een volledig lege, foutloze vorm terug zodra een assignment nog niet zichtbaar is of
Ixly de score nog niet berekend heeft — en stap 8 draait bewust in dezelfde run als stap 3,
dus een kind dat vandaag afrondt wordt vandaag al bevraagd. Zou zo'n rij bewaard worden, dan
geldt dat kind voortaan als "heeft al een score" en wordt het nooit meer opgehaald.
`heeftVolledigeScores()` eist daarom alle negen genormeerde schalen; de score-respons van
Ixly is cumulatief per kandidaat, dus een volgende run levert alsnog álles op.

### 4. Tabblad "Ixly Scores" (hoofdwerkboek)

15 kolommen: `naam_slug`, `naam_kind`, de 2 blocks-schalen, de 7 rally-schalen,
`levels_voltooid`, `levels_perfect`, `bron`, `opgehaald_op`.

`bron` is `api` of `handmatig`. Staat er `handmatig`, dan blijft de rij met rust — ook als
er later alsnog een uuid opduikt. Het systeem vult verder alleen lege cellen aan, hetzelfde
vul-als-leeg-patroon als bij geboortedatum/club/team.

### 5. `google-apps-script/deelnemers/Teams.gs` — segmenteren, rangschikken, indelen

- **Seizoen.** De indeling gaat over het **huidige seizoen** en over niets anders. Het
  seizoen komt uit `bepaalSeizoen(vandaag)` (`Deelnemers.gs`), dus met de **1-augustusgrens
  van de deelnemersadministratie** — uitdrukkelijk *niet* de 1-junigrens van
  `seizoenStartdatum()` in `Financieel.gs`. Dit project heeft bewust twee verschillende
  seizoensbegrippen: de verkoop van het nieuwe seizoen start al in juni/juli, dus voor het
  financiële rapport ligt de grens eerder. De teamindeling filtert echter de
  deelnemersadministratie zelf, en die is gesleuteld op `seizoen|naam_slug` met diezelfde
  augustusgrens. Zonder dit filter komt hetzelfde kind twee keer in één tabblad (Deelnemers
  heeft één rij per kind per seizoen, "Ixly Scores" sleutelt alleen op `naam_slug`), worden
  kinderen van vorig seizoen mee ingedeeld en groeit "Zonder indeling" uit tot een
  historische ledenlijst van minderjarigen die met trainers gedeeld wordt. `bouwSegmenten()`
  eist het seizoen daarom als verplicht argument: geen stille "dan maar alles".
- **Segmenteren.** Vereniging en rol uit Deelnemers; `MM` (MiniMove) valt af, die doen niet
  mee aan de testen — consistent met `upsertDeelnemers`. Leeftijd volgt uit het geboortejaar
  tegen de Config-grens van de betreffende rol.
- **Totaalscore.** Gewogen gemiddelde van de schalen met gewicht > 0. Alleen kinderen met
  **alle negen** schalen krijgen een score en een ranking; een onvolledige set is niet
  vergelijkbaar en gaat naar "Zonder indeling" met de reden erbij.
- **Ranking.** Hoogste score is 1, zoals in de handmatige sheet. Gelijke scores krijgen
  gelijke ranking; de volgorde daarbinnen ligt vast op `naam_slug`, zodat een herberekening
  de lijst niet laat schudden.
- **Groepsverdeling.** Het aantal groepen komt uit Config; de gerangschikte lijst wordt zo
  gelijk mogelijk verdeeld (20 kinderen, 3 groepen → 7/7/6), waarbij de bovenste groepen de
  extra plek krijgen. De groepsnamen staan in Config **in volgorde van sterk naar zwak**.
- **Wegschrijven.** `definitieve_groep` wordt eerst per `naam_slug` ingelezen en daarna
  teruggezet — matchen op naam, nooit op rijnummer.

### 6. Config-uitbreidingen

Vier nieuwe blokken, in de stijl van de bestaande `mapping.fases` en `minimove_kalender`:

1. **Wegingen** per schaal — standaard 1 voor de negen genormeerde schalen, 0 voor de twee
   leveltellingen. Voorlopig, tot Ruben's formule vastligt.
2. **Geboortejaargrens**, apart voor spelers en keepers.
3. **Aantal groepen** per segment (vereniging × leeftijd × rol) en de groepsnamen van sterk
   naar zwak.
4. **Werkboek-ID per vereniging** (KA, SU).

### 7. Werkboeken per vereniging

Vier tabbladen (jong voetbal, oud voetbal, jong keeper, oud keeper) plus **"Zonder
indeling"** voor kinderen zonder geboortedatum of zonder volledige score. Die laatste is er
bewust: stil wegfilteren is precies waar de eerdere backfill ("120 orders → 0 rijen") nooit
verklaard raakte.

Per tabblad: naam, geboortedatum, club, team, de negen schalen, de twee leveltellingen,
totaalscore, ranking, `voorgestelde_groep`, `definitieve_groep`, `bijgewerkt_op`. Géén
ouder-e-mailadressen en géén bedragen.

### 8. `Dagelijks.gs` — Stap 8

Nieuwe stap ná de bestaande Ixly-statusstap, zodat een kind dat vandaag afrondt in dezelfde
run zijn scores krijgt. Onder dezelfde `LockService`-lock als de rest.

**Stap 8 vangt zijn eigen fouten af en gooit ze niet door.** Een Ixly-storing, een ontbrekend
werkboek-ID of een ontbrekende toegang mag niet via de `dataBetrouwbaar`-regel alle reminders
van die dag blokkeren. Fouten gaan naar het Log-tabblad.

### 9. Testen (TDD)

**Node (`tests/gs/`):** weging inclusief gewicht 0, onvolledige schalenset, gelijke scores en
de deterministische volgorde, restverdeling bij niet-deelbare aantallen, behoud van
`definitieve_groep` bij herberekening, segmentatie inclusief ontbrekende geboortedatum en de
`MM`-uitsluiting.

**Pytest (`tests/`):** respons-parsing, het samenvoegen van de cumulatieve `normed`-dicts uit
twee taken, ontbrekende game, 404 bij drie van de vier tokens, en de bovengrens van 100.

Fixtures worden gebouwd op de **echt waargenomen** respons van 2026-08-18, niet op een
bedachte vorm — de `'completed'`-bug stond 22 tests lang onopgemerkt doordat de fixtures
dezelfde aanname als de code codeerden.

## Bekende beperkingen (bewust geaccepteerd)

- **De bestaande deelnemers komen er niet vanzelf in.** Geen bewaarde uuid's, geen weg terug
  via de API. Handmatige invoer in "Ixly Scores" met `bron = handmatig`.
- **De jong/oud-splitsing werkt alleen waar `geboortedatum_kind` gevuld is.** Dat veld wordt
  pas sinds ergens tussen 2026-05-17 en 2026-06-05 uitgevraagd op de checkout. De rest belandt
  in "Zonder indeling" tot iemand de datum aanvult.
- **De standaardwegingen zijn voorlopig.** Gelijk gewicht is geen inhoudelijke keuze maar een
  plaatshouder tot Ruben's formule rond is.
- **Er wordt niet gecontroleerd of Ixly de scores later bijstelt.** Eenmaal opgehaald blijft
  staan. Als dat ooit blijkt te gebeuren, is een handmatige "opnieuw ophalen"-menuactie de
  kleinste oplossing.

## Open vragen bij de klant

1. **Waar komt "Prestatie" onder Test Blocks vandaan?** De API kent die schaal niet voor
   Blocks. Uitstaand; blokkeert de bouw niet.
2. **Is C3 inderdaad de sterkste groep?** In de handmatige sheet staan ranking 1 en 2 in C3 en
   ranking 20 en 21 in C1, omgekeerd aan wat de nummering suggereert. De volgorde staat daarom
   in Config, maar moet bevestigd zijn vóór livegang.
3. **Ruben's formule** — zodra vastgesteld, worden de Config-wegingen daarop gezet.
