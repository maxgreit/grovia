# Handoff — Grovia Automations

## 2026-09-23 — Max

**Branch:** `main` · **Commit:** `9f3fe31` (3 commits deze sessie; `main` staat 24 commits vóór `origin/main`, niets gepusht) · **Build:** 🟢 `func start` registreert alle zeven functions; `node --test tests/gs/*.test.js` 292 passed, 0 failed · **Status:** MVP — maatuitvraag tenue per product gesplitst en verplicht gemaakt bij de voetbalscholen

### Wat er deze sessie is gebeurd

- **`functions.php` van het child-theme "Hello Elementor Child" staat nu in git** ([plugins/hello-elementor-child/functions.php](../plugins/hello-elementor-child/functions.php)), met README. Dit was tot nu toe het enige site-gedrag dat alleen in wp-admin leefde (DOC-SIGNAL van 2026-08-05). Baseline = de live stand die Max op 2026-09-23 plakte; live bijwerken blijft handwerk via Weergave → Thema bestand editor.
- **Maatlijsten per product gesplitst** (Max' verzoek, maten volgens Jako): MiniMove (categorie `minimove`) 98/104/110/116/128/140/152; voetbalscholen (Kolping, Schagen en alle toekomstige) dezelfde reeks plus 164 en S–XXL. 92 en XS zijn weg. Sokken ongewijzigd. Onderscheid via `has_term('minimove','product_cat')`, zelfde slug als de fasecode `MM` in de plugin.
- **Maatvelden verplicht bij de voetbalscholen bij "inclusief tenue", niet bij MiniMove** (addendum ADR-012 in `docs/DECISIONS.md`): rood sterretje + `required`-attribuut op shirt/broekje/sokken (alleen gezet als het blok zichtbaar is, via `data-verplicht` op de wrapper en `toggleSizes()` in de JS), plus een `woocommerce_add_to_cart_validation`-filter (prioriteit 10) als servervangnet. Max vond de servermelding alleen (rode balk bovenaan) te lelijk; het sterretje-patroon van Vereniging/Team is nu leidend.
- Sessiestart: Notion-sync gedaan, geen Done-taken die nog in TODO stonden; vijf open Notion-taken zonder TODO-item gesignaleerd (zie TODO Next Up).

### Git wijzigingen

`git diff --stat HEAD~3 HEAD`: 3 bestanden, 660 toevoegingen — `plugins/hello-elementor-child/functions.php` (+639), `README.md` (+12), `docs/DECISIONS.md` (+9).

### Open items / Next steps

1. **Max: de drie wijzigingen live zetten in `functions.php`** (blok 3 maatlijsten + sterretje/`data-verplicht`, blok 4 validatie, `toggleSizes()` in blok 6) en testen: Schagen "inclusief tenue" zonder maten → browserballon, geen rode balk; "zonder tenue" → gaat door; MiniMove → geen sterretjes, strippenkaart zonder maten gaat door. Blok 4 stond op 2026-09-23 al live (Max' screenshot toonde de rode balk); de sterretje-wijziging vermoedelijk nog niet.
2. **Commits pushen** — 24 commits vóór `origin/main`.
3. `.claude/`-templatebestanden (versie 2026-08-31) staan nog uncommitted; committen of discarden.
4. Overige items ongewijzigd — zie `## Next Up` in `docs/TODO.md` (bericht Berry/Jeffry, freddie-rood-rij, `migreerIxlyScoresSeizoen`, runlog 18 sep).

### Belangrijke context die niet mag verdwijnen

- **Een `required`-attribuut op een verborgen `<select>` blokkeert het formulier stil**: de browser kan het veld niet tonen en verstuurt niets. Daarom zet `toggleSizes()` `required` alleen als het maatblok zichtbaar is én `data-verplicht="1"`.
- **De validatie-filter voor de maten (prioriteit 10) staat los van die van Vereniging/Team (prioriteit 20)**; beide leven in hetzelfde bestand. Op MiniMove doet de maatfilter niets, op andere producten alleen bij een slug met `tenue` zonder `zonder`.
- **Elke live wijziging aan `functions.php` hoort nu ook in git** (`plugins/hello-elementor-child/`), anders lopen repo en site weer uit elkaar. Ververs de Thema bestand editor vlak vóór het opslaan (stale-tab-incident 2026-08-05).
- `func start` bleef aan het einde van de vorige aanroep als proces hangen op poort 7071; `pkill -f azure-functions-core-tools` vóór een nieuwe build-check.

## 2026-09-17 — Max

**Branch:** `main` · **Commit:** `b346610` (20 commits vóór origin/main, waarvan 18 deze sessie; niets gepusht) · **Build:** 🟢 `func start` registreert alle zeven functions; `node --test tests/gs/*.test.js` 292 passed, 0 failed (269 → 292) · **Status:** MVP — ADR-016 (geboortedatum-behoud) gebouwd, gemerged, **geplakt en live geverifieerd**

### Wat er deze sessie is gebeurd

- **Dader van de geboortedatum-leegloop gevonden, en het is niet het script.** Live code bleek identiek aan de repo, geen enkele `WACHTER:`-regel in het Log, elke run begon al met lege cellen. De versiegeschiedenis (uitgelezen via de DOM van het versie-frame, want screenshots werkten niet met een verborgen browser-pane) laat zien dat de datums verdwenen tijdens handmatige rij-operaties van Jeffry (7 sep 16:47, 8 sep 09:24, 9 sep 14:59, 11 sep 08:16) en Berry (8 sep 20:54, alle 101 rijen in alle kolommen gewijzigd én herordend). Tussen 7 sep 07:25 (98 datums) en 8 sep 20:54 (23) verloren 77 rijen hun datum plus 10 `team`-waarden zoals "14-1"; tekstcellen bleven staan, datumcellen sneuvelden. Welke muisklik het precies was: vraag aan Berry/Jeffry.
- **Max heeft de datums hersteld** met `vulGeboortedatumClubTeamVoorBestaandeRijen` (stap 1 van de spec).
- **ADR-016 gebouwd (subagent-driven, TDD, eindreview met 4 Important-fixes):** `normaliseerGeboortedatum` (Woo.gs), `TEKST_KOLOMMEN`/`tekstKolomIndexen`/`_forceerTekstKolommen` (Sheet.gs: `@`-formaat vóór elke `setValues` op `geboortedatum_kind`, `team`, `order_ids` — ook MiniMove Deelnemers), zelfde in `_schrijfTabblad` (Teams.gs), `_alsTeamTekst` (Date → `d-M`), verborgen tabblad "Geboortedatums" (`leesGeboortedatums`/`schrijfGeboortedatums`, auto-aangemaakt, weigert te krimpen) met pure `vulUitGeboortedatums`/`werkGeboortedatumsBij` (Deelnemers.gs) en het vangnetblok in stap 1 van `_dagelijkseRunKern` (runlog `VANGNET: …`, wachter-momentopname daarna ververst). Spec: `docs/superpowers/specs/2026-09-17-geboortedatum-behoud-design.md`, plan: `docs/superpowers/plans/2026-09-17-geboortedatum-behoud.md`.
- **Uitrol door Max:** vijf bestanden geplakt, "Alles nu verversen" groen (kolom D `yyyy-mm-dd`, team weer `13-1`, Geboortedatums gevuld met 98 rijen, teamindeling 63+51 regels, nog 21+8 "Zonder indeling" i.p.v. 61+39). Automatisch plakken via de browser werd door de tool-beveiliging geblokkeerd; dat blijft handwerk. Filterweergaven overgeslagen (bewust: alleen gemak); Deelnemers wordt vergrendeld met uitzondering `K2:K1000` (`bedrag_correctie`) zodat Berry/Jeffry alleen die kolom kunnen bewerken.
- **Berry's twee Action Type-vragen** (dubbele inzendingen, kolom "Type" i.p.v. "Omschrijving" in Resultaten) door Max zelf afgehandeld; geen code of TODO.

### Git wijzigingen

`git diff --stat 317d2fd~1 b346610`: 16 bestanden, 1317 toevoegingen / 7 verwijderingen — Woo.gs, Sheet.gs, Teams.gs, Deelnemers.gs, Dagelijks.gs, vijf testbestanden (+23 tests), spec, plan, ADR-016, ARCHITECTURE, GLOSSARY, TODO, HANDOFF.

### Open items / Next steps

1. **Bericht aan Berry en Jeffry**: Deelnemers is alleen-lezen behalve kolom K (`bedrag_correctie`); filteren/sorteren in tabblad "Overzicht"; en wat deden zij op 7, 8, 9 en 11 september?
2. **Controleer de eerstvolgende automatische run (18 sep 07:24)** in het runlog: geen `Geboortedatums MISLUKT`, geen `VANGNET`-regel (die zou betekenen dat er tussen nu en morgen weer iets geleegd is).
3. **Commits pushen** — `main` staat 20 commits vóór `origin/main`.
4. `.claude/`-template-wijzigingen (versie 2026-08-31) staan nog uncommitted; committen of discarden.
5. `freddie-rood`-rij: `order_ids` handmatig herstellen of rij verwijderen (Max beslist).
6. Overige items ongewijzigd, zie `## Next Up` in `docs/TODO.md`.

### Belangrijke context die niet mag verdwijnen

- **De versiegeschiedenis van Sheets toont alleen gewijzigde rijen**, ook met "Ongewijzigde rijen tonen" aan; de volledige staat is alleen te lezen in versies waarin álle rijen veranderden. Sheets markeert gewiste cellen bovendien niet altijd als gewijzigd in tussenliggende versies; het verlies van de laatste 21 datums (8–11 sep) is nergens als celwijziging zichtbaar.
- **Datumcellen zijn de kwetsbare soort**, tekstcellen niet. Daarom `@`-formaat vóór `setValues` (na `clearContent`) — andersom is de omzetting al gebeurd. Dit geldt voor elk nieuw tabblad met datum- of getalachtige tekst (`TEKST_KOLOMMEN` in Sheet.gs).
- **De run leest en schrijft `bedrag_correctie` ongewijzigd terug**; een handmatige correctie overleeft de run, behalve als iemand precies tijdens de run van 07:24 typt.
- **`schrijfGeboortedatums` weigert te schrijven als het tabblad meer rijen heeft dan de bron** (lege `naam_slug`-cel); dat verschijnt als `Geboortedatums MISLUKT` in het runlog en is dan een actie, geen ruis.
- **Google Forms "1 reactie per persoon" vereist Google-login** en is daarom afgeraden; `koppelReacties` neemt al de eerste inzending per controlecode.
- **Code in de Apps Script-editor injecteren via de browser wordt geblokkeerd**; lezen via `window.monaco.editor.getModels()` werkt wel (handig om live code met de repo te vergelijken).

## 2026-08-26 — Max (sessie "Laatste Wijzigingen", gestart 2026-08-22)

**Branch:** `main` · **Commit:** `1a1f14f` (5 commits deze sessie: `4a0a77d..2e880e7`; `1a1f14f` zelf komt uit de parallelle geboortedatum-sessie) · **Build:** 🟢 `func start` draait en registreert alle **zeven** functions (geverifieerd via `/admin/functions` op de draaiende host); `node --test tests/gs/*.test.js` 269 passed, 0 failed; `venv/bin/pytest tests/ -q` 135 passed, 0 failed · **Status:** MVP — ADR-015 volledig gebouwd én **uitgerold in het werkboek**; teamindeling draait seizoensbewust

### Wat er deze sessie is gebeurd

- **ADR-015 gebouwd (TDD):** "Ixly Scores" sleutelt nu op `seizoen|naam_slug` (kolom `seizoen` vooraan; terugkeerders worden volgend seizoen opnieuw bevraagd en ingedeeld i.p.v. stil op de oude meting te draaien), met gedeelde `teamSeizoenVanDeelnemer()` (1-meigrens) voor ophalen én indelen, en eenmalige migratie `migreerIxlyScoresSeizoen()`. Plus nieuwe handmatige kolom `bedrag_correctie` in Deelnemers: gevuld = seizoenstotaal van dat kind, naar rato verdeeld over zijn orderregels in Financieel ("WooCommerce is niet altijd de waarheid"); leeg = Woo telt, `0` = expliciet nul, witruimte/tekst genegeerd. Commit `c226c07`.
- **Drie teamindeling-features erbij:** (1) groepsnamenlijst per segment in Config `AG:AJ` kolom 4 — naast een getal mag nu `C3,C2a,C2b,C1` (vier groepen) of `C2,C1`, vrije labels, sterk → zwak (`4fd2772`); (2) totaalscore als derde kolom in het "Teamindeling"-tabblad; (3) leeftijdsgrens per academie in nieuw Config-blok `AO2:AQ5` (vereniging | rol | geboortejaar, override met fallback op `AB:AC`) (`b2beb66`).
- **De volledige werkboek-uitrol is op 26-08 door Max afgerond:** beide kolommen ingevoegd (`seizoen` vóór A in "Ixly Scores", `bedrag_correctie` na `bedrag` in Deelnemers), de vijf resterende .gs-bestanden geplakt (Sheet/Config/Scores/Teams/Financieel; Deelnemers/Dagelijks stonden al op main via de parallelle sessie), `migreerIxlyScoresSeizoen` gedraaid en "Alles nu verversen" groen: alle 8 stappen, 66 kinderen ingedeeld (KA 39 + SU 27), 31 in "Zonder indeling", en precies 1 deelnemer met seizoen 2526 buiten de indeling (de verwachte LET OP-regel).
- **Config `AG:AJ` en `AO:AQ` zijn bewust leeg gelaten** — beide blokken zijn optioneel; leeg = drie groepen (C3/C2/C1) per segment en de globale grenzen (Speler 2017, Keeper 2015). Max heeft de invul-recepten gekregen.
- Aan het begin van de sessie: sessie-overdracht 2026-08-21 gecommit (`4a0a77d`), en de Notion-afwijking gesignaleerd dat de taak "order_ids-getalnotatiebug fixen" daar op Done staat terwijl TODO/HANDOFF de bug als actief beschrijven — niet opgelost, alleen geconstateerd.

### Git wijzigingen

`git diff --stat 2fdd6a1..2e880e7` (de 5 commits van deze sessie): kern `Financieel.gs` (+120), `Teams.gs`, `Scores.gs`, `Sheet.gs`, `Config.gs`, `Deelnemers.gs`, `Dagelijks.gs` (migratie), ADR-015 + addenda in `DECISIONS.md`, `ARCHITECTURE.md`, en 39 nieuwe tests (node 223 → 262; de parallelle sessie bracht het daarna op 269).

### Open items / Next steps

1. **Commits pushen** — `main` staat 7 commits vóór `origin/main` (`4a0a77d..1a1f14f`).
2. **Dader van de geboortedatum-leegloop aanwijzen** — zie het TODO-item en de handoff van de parallelle sessie hieronder; check ook het runlog op `WACHTER:`-regels.
3. **`migreerIxlyScoresSeizoen` uit `Dagelijks.gs` verwijderen** (werkboek én repo) — de migratie is gedraaid, de functie is klaar met zijn werk.
4. **31 kinderen in "Zonder indeling" nalopen** — grotendeels de bekende gevallen (zes zonder totaalscore, drie zonder games, kinderen zonder geboortedatum), maar het aantal is nog niet stuk voor stuk geverifieerd na de uitrol.
5. Overige items ongewijzigd — zie `## Next Up` in `docs/TODO.md` (Berry-beslissingen, testorder, WAF-ticket, plugin v1.7, batchverhonging, etc.).

### Belangrijke context die niet mag verdwijnen

- **Kolommen invoegen en `Sheet.gs` plakken moeten altijd in ÉÉN zitting, buiten de 07:00-run om.** Deelnemers heeft geen kopregelcontrole; een mix van oude `KOLOMMEN` met nieuwe fysieke kolommen (of andersom) schuift bij het eerstvolgende schrijven stil alle data een kolom op. Dit is deze uitrol goed gegaan door die volgorde expliciet af te dwingen.
- **Een scorerij zonder seizoen matcht bewust nergens mee** — na een vergeten migratie zou elk kind "nog geen score bekend" tonen (zichtbaar), niet stil verkeerd ingedeeld worden. `bron = handmatig`-rijen gelden alleen voor het gestempelde seizoen 2627; speelt zo'n kind volgend seizoen opnieuw, dan wordt het gewoon via de API bevraagd.
- **`bedrag_correctie` geldt alleen voor deelnemersrijen binnen het financiële seizoensvenster (1 juni)** — anders zou de rij van vorig seizoen (zelfde kind, zelfde slug) de orders van dit seizoen overrulen. En `Number(' ')` is 0: witruimte in de cel wordt daarom expliciet als leeg behandeld, anders corrigeert een per ongeluk getypte spatie de omzet van een kind stil naar nul.
- **Dubbele groepslabels smelten samen in het "Teamindeling"-overzicht** (het groepeert op label). Twee teams op hetzelfde niveau moeten dus onderscheidende labels krijgen (`C2a`/`C2b`) — bewuste keuze van Max (optie B, geen automatische nummering).
- **De eerste seizoenswissel van de teamindeling valt op 1 mei 2027** — vanaf dan moeten terugkeerders automatisch opnieuw bevraagd worden; dat is precies wat deze sessie geregeld heeft, maar het is ook het eerste moment waarop het bewezen wordt.

## 2026-08-26 — Max

**Branch:** `main` · **Commit:** `183bfc7` (1 commit deze sessie, nog niet gepusht) · **Build:** 🟢 `func start` registreert alle **zeven** functions; `node --test tests/gs/*.test.js` 269 passed, 0 failed (223 → 269); `venv/bin/pytest tests/ -q` 135 passed, 0 failed · **Status:** MVP — teamindeling draait; geboortedatum-leegloop aangepakt met erf + wachter

### Wat er deze sessie is gebeurd

- **Debugsessie: geboortedatums in het Deelnemers-tabblad liepen herhaaldelijk leeg.** Alle schrijvers naar het tabblad (Sheet/Deelnemers/Dagelijks/ActionType/IxlyStatus/Reminders/Menu/Woo.gs, live-versies uit Apps Script vergeleken met de repo) blijken de geboortedatum correct rond te pompen — de code kán het legen niet verklaren. De versiegeschiedenis toont naast de 07:26-runs ook bewerkingen door Berry (24-08 19:18) en Jeffry (25-08 22:08); de dader is nog niet definitief aangewezen.
- **Fix in twee lagen gebouwd (TDD, commit `183bfc7`):** (1) `erfGeboortedatums` — een nieuwe seizoensrij erft de geboortedatum van de rij van hetzelfde kind uit een eerder seizoen (club/team bewust niet), en draait elke run in stap 1 als zelfherstellende vulling; (2) `beschermGeboortedatums` + `_schrijfMetWachter` — wachter vóór elk van de vier schrijfmomenten in de dagelijkse run die een onderweg geleegde geboortedatum terugzet en de schuldige stap in runlog + Log-tabblad meldt.
- **Max heeft de nieuwe `Deelnemers.gs` en `Dagelijks.gs` in het werkboek geplakt** en de geboortedatums opnieuw gevuld via `vulGeboortedatumClubTeamVoorBestaandeRijen`. Sheet.gs is bewust NIET geplakt (ADR-015-kolomwissel staat nog open); `migreerIxlyScoresSeizoen` bewust nog niet gedraaid.
- **Sessie "Laatste Wijzigingen" (22-08) is per bericht bijgepraat** met wat al gedaan is, met het verzoek Max een restlijstje voor de ADR-015-uitrol te geven.

### Git wijzigingen

`git diff --stat HEAD~1 HEAD`: 3 bestanden, 235 toevoegingen / 8 verwijderingen — `google-apps-script/deelnemers/Deelnemers.gs` (+86), `Dagelijks.gs`, `tests/gs/deelnemers.test.js` (+114; 223 → 269 node-tests).

### Open items / Next steps

1. **Dader van het leeglopen aanwijzen via de versiegeschiedenis** — open de diffs van 23-08 07:25 (eerste run na de zaterdag-backfill), 24-08 19:18 (Berry) en 25-08 22:08 (Jeffry), zoek één kind op en zie in welke versie de datum verdwijnt. Vraag Berry/Jeffry wat ze precies deden (sorteren + plakken over een bereik is de klassieker). Check morgen ook het runlog op een `WACHTER:`-regel — die noemt de schuldige stap als het tóch de run is.
2. **Checken of het checkoutveld 'Geboortedatum kind' nog op de site staat** — verdacht omdat nieuwe orders wél club/team maar (in de leeggelopen periode) geen geboortedatum leken aan te leveren; de backfill bewees later dat de orders hem wél hebben, dus lage prioriteit, maar goedkoop om uit te sluiten.
3. **ADR-015-uitrol afmaken** — zie het item in TODO Next Up; Deelnemers.gs + Dagelijks.gs zijn al geplakt, de rest (kolommen + Sheet/Scores/Teams/Financieel/Config.gs + migratie) moet in één zitting, buiten de 07:00-run om. De sessie "Laatste Wijzigingen" levert het restlijstje.
4. **Commit `183bfc7` pushen.**
5. **Freddie-rood-rij**: `order_ids` staat corrupt (`935,935.9359351147`, Nederlandse-getalnotatie-bug, zie bestaand TODO-item); Max overweegt de rij te verwijderen — zijn keuze, geen actie nodig tenzij hij hem wil herstellen.

### Belangrijke context die niet mag verdwijnen

- **De wachter beschermt alleen tegen legen bínnen een run** (momentopname bij het lezen). Wordt de kolom tussen twee runs door een mens geleegd, dan leest de volgende run al lege cellen en valt er niets te herstellen — behalve voor kinderen met een gevulde rij in een ander seizoen (erf-pad). De backfill `vulGeboortedatumClubTeamVoorBestaandeRijen` blijft dus het herstelgereedschap zolang de dader niet gevonden is; bewust nog niet uit `Dagelijks.gs` verwijderd.
- **Werkboek-scriptversies liepen achter op de repo**: het live Apps Script bleek de stand van `59d59fd` (pre-ADR-015). Bij het vergelijken van live gedrag met de repo altijd eerst de geplakte versie opvragen.
- **Deelnemers heeft géén kopregelcontrole** (alleen "Ixly Scores" heeft die). Een kolomvolgorde-mismatch tussen `KOLOMMEN` en het werkboek schuift bij het eerstvolgende schrijven stil alle data op. Daarom: kolommen invoegen en Sheet.gs plakken altijd in één zitting. Een `controleerKopregel`-guard op Deelnemers is een zinnige toekomstige verbetering (niet gebouwd deze sessie).
- **`erfGeboortedatums` erft bewust alléén de geboortedatum** — club en team kunnen per seizoen echt wijzigen en erven niet mee.

## 2026-08-21 — Max

**Branch:** `main` · **Commit:** `2fdd6a1` (0 commits deze sessie — alleen `docs/TODO.md` gewijzigd in de working copy) · **Build:** 🟢 `func start` registreert alle **zeven** functions; `node --test tests/gs/*.test.js` 223 passed, 0 failed; `venv/bin/pytest tests/ -q` 135 passed, 0 failed (geen code gewijzigd deze sessie, alleen docs + operationeel werk) · **Status:** MVP — de legacy-testscores zijn verzameld en in "Ixly Scores" gezet; teamindeling draait

### Wat er deze sessie is gebeurd

- **De testscores van de legacy-kinderen (vóór augustus aangemeld, geen `ixly_taken`) verzameld en in "Ixly Scores" gezet.** Route (a) uit het TODO — assignment-uuid's uit Ixly halen — blijkt **onmogelijk**: die uuid's staan nergens in de Ixly-webinterface (die gebruikt interne nummers als `CandidateAssessment/543754`) en het publieke API-lijst-endpoint (`GET /assignments` zonder uuid) is leeg. Dus route (b) gevolgd.
- **Werkwijze:** Max was bij ~22 van deze kinderen niet de adviseur, waardoor de rapporten "niet gedeeld" waren; per kind de adviseur op Max gezet (bulk-adviseur bestaat niet in Ixly — de "Wijzigen"-knop verdwijnt zodra je >1 kandidaat aanvinkt). Daarna de twee rapport-PDF's per kind gedownload en de stenscores eruit geparsed met `pdftotext` (mapping: PDF-"Accuraatheid" → `rally_kwaliteit`, "Reactiesnelheid" → `rally_reactiesnelheid`, enz.; "Prestatie" uit het Blocks-rapport bewust weggelaten).
- **Resultaat:** 51 rapporten geparsed → **21 kinderen compleet**. Een plak-klaar blok gemaakt dat exact over de bestaande lege placeholder-rijen (rij 35-65) van "Ixly Scores" valt (`bron` = `handmatig`); alle 27 `naam_slug`'s matchen exact met kolom B in Deelnemers. Max heeft het geplakt en "Alles nu verversen" gedraaid.
- **Zes kinderen krijgen géén totaalscore** en belanden in "Zonder indeling" — een notitie voor Berry (`Desktop/Rapporten/NOTITIE-BERRY-zes-kinderen.md`) met de cijfers per kind is gemaakt en meegestuurd.

### Git wijzigingen

Geen commits deze sessie. `git diff --stat`: alleen `docs/TODO.md` (legacy-item herschreven naar de werkelijke stand + nieuw item "Notitie voor Berry"). De echte deliverables staan buiten de repo: het plakblok en de Berry-notitie in `/Users/maxrood/Desktop/Rapporten/`, en de scores nu in het "Grovia Deelnemers"-werkboek.

### Open items / Next steps

1. **Beslissing Berry over de zes uitzonderingskinderen** (zie notitie). Vier missen `blocks_flexibiliteit` omdat het rapport "onvoldoende informatie" meldt (nick-v-dalen, sven-breton, kiyo-van-de-geer, leon-gesko-caromelle); twee deden alleen Blocks, geen Rally (abdullah, stef-czapelski). Berry kiest: waarde toekennen of zo laten / alsnog Rally laten spelen.
2. **Controleren of de indeling na de verversing klopt** — verwacht: de 21 complete kinderen verdeeld over de groepen, en precies die zes in "Zonder indeling" (plus de drie zonder games: duuk-van-houten, thijs-winder, delano-hewitt).
3. **Adviseurswijzigingen eventueel terugdraaien** — bij ~22 kinderen is de Ixly-adviseur van Berry/Ruben naar Max gezet om de rapporten te kunnen zien. Als dat terug moet naar de oorspronkelijke adviseur, is dat handwerk per kind (geen bulk).
4. Overige items ongewijzigd — zie `## Next Up` in `docs/TODO.md` (wegingen Berry's formule, testorder-verificatie, WAF-supportticket, plugin v1.7, etc.).

### Belangrijke context die niet mag verdwijnen

- **Assignment-uuid's van legacy-kinderen zijn niet op te halen.** Niet via de Ixly-UI (interne nummers, geen uuid's) en niet via de publieke API (`GET /assignments` heeft geen lijst/filter-variant, is altijd leeg). Voor kinderen zónder bewaarde `ixly_taken` is handmatig invoeren via "Ixly Scores" de enige route. Onze eigen flow (`ixly-aanmelding`) bewaart de uuid's daarom sinds die fix zelf als order-meta `_grovia_ixly_taken`.
- **Een `candidate_task`/rapport is alleen zichtbaar voor de adviseur die de kandidaat bezit.** Max moest bij ~22 kinderen eerst als adviseur worden gezet voordat de rapporten benaderbaar waren. Dit is dezelfde adviseur-eigendomsregel die eerder de "adviseur-loterij" veroorzaakte (zie ADR-013).
- **`blocks_flexibiliteit` kan structureel ontbreken.** Als een kind de Blocks-levels te vlot oplost, meldt het rapport letterlijk "onvoldoende informatie om op dit onderdeel een score te bepalen" — de score bestáát dan niet. Dit veld heeft gewicht 1 in Berry's formule, dus zulke kinderen krijgen geen totaalscore (→ "Zonder indeling"). Vier van de legacy-kinderen zitten in dit geval.
- **De Rally-PDF bevat geen "Prestatie".** Het Blocks-rapport heeft "Prestatie" (bewust weggelaten), het Rally-rapport heeft zes indicatoren (Accuraatheid, Reactiesnelheid, Respons inhibitie, Consistentie, Volgehouden aandacht, Reactie op fouten). De API-schaal `performance` (opgeslagen als `rally_prestatie`, weegt 0 in de formule) staat niet in de PDF, dus die kolom blijft leeg voor handmatige rijen — geen effect op de score.
- **Downloaden via de in-app browser: max ~1 per paginalading.** Meerdere downloads achter elkaar worden stil geblokkeerd. Werkwijze die wél werkte: één download per losse actie, met een gap ertussen. Voor bulk is de eigen Chrome van de gebruiker sneller (één keer "meerdere downloads toestaan"). Bestandsnamen doen er niet toe: elk rapport bevat zelf naam + game, dus parsen op inhoud identificeert het kind eenduidig.
- **Curl met het JS-leesbare `login_session_id`-cookie werkt niet** (HTTP 406 / login-redirect) — de echte Ixly-sessiecookie is `httpOnly`. Downloaden moet dus via de browser, niet via curl.

