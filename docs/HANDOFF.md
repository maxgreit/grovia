# Handoff — Grovia Automations

## 2026-09-25 — Max

**Branch:** `main` · **Commit:** `fdcb9b5` (3 commits deze sessie, `main` staat 3 commits vóór `origin/main`, niets gepusht) · **Build:** 🟢 `node --test tests/gs/*.test.js` 293 passed, 0 failed; `venv/bin/pytest tests/ -q` 135 passed, 0 failed · **Status:** MVP — vierde academie SVW aangesloten, code klaar, uitrol nog deels handwerk

### Wat er deze sessie is gebeurd

- **Vierde academie SVW toegevoegd** (zie ADR-017): schoolcode `SVW` (3 letters — geverifieerd dat geen enkele plek in de codebase een vaste 2-letter-lengte aanneemt) in `school_map` (`grovia-automations.php`, `grovia-retroactief.php`) en in de `VERENIGINGEN`-arrays (`Dashboard.gs`, `Financieel.gs`, met bijbehorende TDD-testuitbreiding in `financieel.test.js`). Eerste versie gebruikte per ongeluk slug `svw`; gecorrigeerd naar de echte WooCommerce-categorieslug `svw27-academie` nadat Max een screenshot van de categorielijst deelde.
- **Uitsluitlijst voor proeftrainingen losgekoppeld.** `proef-training` blokkeerde tot nu toe zowel de WhatsApp-groepsuitnodiging als de Ixly/Action Type-assessmenttag via één gedeelde `$uitsluit_categorieen`. Op Max' verzoek gesplitst in `$uitsluit_wa_categorieen` (alleen `evenement`) en `$uitsluit_assessment_categorieen` (`evenement` + `proef-training`) — proeftraining-deelnemers krijgen zo wél de WhatsApp-uitnodiging, geen assessment-uitnodiging (die volgt pas na een echte inschrijving). Geldt voor alle academies, niet SVW-specifiek; andere academies geven geen proeftrainingen meer dus zonder effect daar.
- **FunnelKit-automation voor SVW door Max zelf ingericht** deze sessie: trigger-tag `WA_SVW_VT`, groepslink in het HTTP Request-veld `groepslink`, schoolnaam-veld op `SVW'27 Academie` (bevestigd via de MiniMove-branch als referentiepatroon), en een losse welkomstmail-stap. Het bijbehorende FunnelKit-schema was als screenshot te laag in resolutie om exact uit te lezen (ook na 4-12x uitvergroten met PIL) — geverifieerd via de code (`$wa_tag = 'WA_' . $school_code . '_' . $type_code` in `grovia-automations.php:183`) in plaats van op het plaatje te vertrouwen.
- ADR-017 vastgelegd; twee doc-signals toegevoegd (GLOSSARY.md — lemma "schoolcode" ontbreekt, "Welkomstmail" is een dubbelzinnige term die minstens twee/drie verschillende mails aanduidt; CONVENTIONS.md — patroon "aparte uitsluitlijst per doel, nooit gedeeld tussen twee onafhankelijke beslissingen").

### Git wijzigingen

`git diff --stat HEAD~3 HEAD`: 7 bestanden, 44 toevoegingen / 21 verwijderingen — `grovia-automations.php` (+41/-19, de schoolcode + uitsluitlijst-splitsing), `grovia-retroactief.php`, `Dashboard.gs`, `Financieel.gs`, `ARCHITECTURE.md`, `TODO.md`, `financieel.test.js` (+16 regels, nieuwe SVW-testcase).

### Open items / Next steps

1. **Max: `grovia-automations.php` plakken in de Thema bestand editor** (WordPress) — repo-versie is de waarheid, bestand is al gedeeld om te kopiëren. `grovia-retroactief.php` was al eerder gedeeld en hoefde alleen de schoolcode-regel te krijgen.
2. **Config-tabblad kolom D:E aanvullen**: `svw27-academie` → `SVW`, anders herkent het Financieel-rapport en de teamindeling SVW-orders niet.
3. **Testorder plaatsen** op een SVW-proeftrainingsproduct met 100%-kortingscode: checken dat (a) de WhatsApp-uitnodiging aankomt met de juiste groepslink, (b) er géén Ixly/Action Type-mail uitgaat, (c) de welkomstmail aankomt, (d) de rij correct verschijnt in Deelnemers/Financieel/Dashboard. Order + code achteraf verwijderen.
4. **Commits pushen** — `main` staat 3 commits vóór `origin/main`.
5. Overige items ongewijzigd — zie `## Next Up` in `docs/TODO.md` (bericht Berry/Jeffry, freddie-rood-rij, maatvelden `functions.php` live zetten, 4 onverwerkte oudere doc-signals + 2 nieuwe van deze sessie).

### Belangrijke context die niet mag verdwijnen

- **`$uitsluit_categorieen` was één schakelaar voor twee onafhankelijke beslissingen** (WhatsApp-uitnodiging én assessment-tag). Dat patroon bestond ook al impliciet voor MiniMove (`'MM' === $school_code`-check, los van de gedeelde lijst) — nu expliciet gemaakt met twee aparte lijsten. Bij een vijfde academie of nieuwe categorie: check altijd of een uitsluiting voor élke afhankelijke tag moet gelden, of maar voor één.
- **WooCommerce genereert categorie-slugs automatisch uit de naam** — "SVW'27 Academie" werd `svw27-academie` (apostrof weg, spaties naar streepjes), niet het voor de hand liggende `svw`. Altijd de daadwerkelijke slug uit wp-admin verifiëren (Producten → Categorieën → Bewerken) voordat die in `school_map` komt, niet raden op basis van de weergavenaam.
- **Een laagresolutie-screenshot van een FunnelKit-automation is niet betrouwbaar uit te lezen**, ook niet na fors uitvergroten (interpolatie voegt geen echte pixelinformatie toe). Val in zo'n geval terug op de code als bron van waarheid (hier: de exacte `WA_<schoolcode>_<typecode>`-tagformatstring in `grovia-automations.php`) in plaats van te gokken op basis van een wazig plaatje.
- **"Welkomstmail" is een overladen term** in dit project: verwijst meestal naar de Ixly-uitnodigingsmail met `login_url` (Azure Function `ixly-aanmelding`), maar Max heeft deze sessie ook een letterlijke, aparte welkomst-/bevestigingsmail voor SVW-proeftrainingen in FunnelKit gezet — een derde ding met dezelfde naam. Zie doc-signal voor GLOSSARY.md.

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

