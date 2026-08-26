# Handoff — Grovia Automations

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

## 2026-08-20 — Max

**Branch:** `main` · **Commit:** `696a76a` (30 commits sinds vorige overdracht, alle gepusht) · **Build:** 🟢 `func start` registreert alle **zeven** functions (nu incl. `ixly-scores`); `node --test tests/gs/*.test.js` 223 passed, 0 failed; `venv/bin/pytest tests/ -q` 135 passed, 0 failed · **Status:** MVP — de geautomatiseerde teamindeling is gebouwd, uitgerold en draait; 16 kinderen zijn automatisch ingedeeld

### Wat er deze sessie is gebeurd

- **Het blokkerende TODO-item is opgelost: het Ixly score-endpoint is live geverifieerd.** `GET /candidate_tasks/{uuid}/score` geeft HTTP 200 met negen genormeerde schalen (2 voor Blocks, 7 voor Rally), elk met `raw`/`default_z`/`latent`. Geverifieerd tegen Magnus Boekel (order 1345). `latent` staat op een 1-10-schaal en is het getal dat in Berry's handmatige sheet stond. **De respons is cumulatief per kandidaat, niet per taak** — de Rally-taak gaf zowel rally- als blocks-scores terug.
- **De hele keten gebouwd via subagent-driven development**, negen codetaken met per taak een review: nieuwe Azure Function `ixly-scores`, `Scores.gs` (vertaling Ixly-sleutels → kolomnamen), `Teams.gs` (segmenteren, rangschikken, indelen, wegschrijven), tabblad "Ixly Scores", vier Config-blokken, en stap 8 in de dagelijkse run. Elke taak ging door een spec- én kwaliteitsreview; zes taken hadden een fixronde nodig.
- **De brede eindreview vond drie Criticals, allemaal gefixt:** een vervuilde handmatige cel gaf een NaN-totaalscore die tóch werd ingedeeld; een leeg API-antwoord werd permanent als "score" bewaard waardoor dat kind nooit meer bevraagd werd; en er ontbrak een seizoensfilter waardoor kinderen dubbel in een tabblad kwamen. Plus vijf Importants, waaronder twee stille dataverliespaden bij het wegschrijven.
- **Uitgerold en werkend.** Gedeployed naar Azure, Script Property gezet, tabbladen aangemaakt, Config gevuld, twee werkboeken per academie. Onderweg bleek de backfill van `geboortedatum_kind` nooit gedraaid te zijn — 167 van de 182 orders hádden die datum gewoon. Na de backfill zijn 16 kinderen automatisch ingedeeld over C3/C2/C1.
- **De seizoensgrens is twee keer verschoven** (1 augustus → 1 juni → 1 mei) en **Berry heeft zijn scoreformule bevestigd**: Blocks-helft en Rally-helft, elk 50%.

### Git wijzigingen

Sinds vorige overdracht (`7e3dbed..696a76a`, 30 commits): 22 bestanden, 5679 toevoegingen / 41 verwijderingen. Kern: nieuw `ixly-scores/` (Function), `google-apps-script/deelnemers/Scores.gs` (221 regels) en `Teams.gs` (785+ regels), uitbreidingen in `Sheet.gs`/`Config.gs`/`Dagelijks.gs`, `grovia_shared/ixly_api.py` (`haal_taak_score` + gedeelde `_haal_via_tokens`), spec + implementatieplan + ADR-014, en 115 nieuwe tests (node 108 → 223, pytest 118 → 135).

### Open items / Next steps

1. **Wegingen omzetten naar Berry's formule.** Plak in Config `Y2:Z12`: `blocks_planning` en `blocks_flexibiliteit` op `1`, de vier Rally-indicatoren (`rally_consistentie`, `rally_volgehouden_aandacht`, `rally_respons_inhibitie`, `rally_reactie_op_fouten`) op `0,5`, de rest op `0`. Dat rekent (Blocks-gemiddelde + Rally-gemiddelde) ÷ 2 uit. Controleer dat de getallen rechts uitlijnen — links = tekst en telt niet mee.
2. **`Teams.gs` opnieuw in de Apps Script-editor plakken** (nieuw tabblad "Teamindeling") en "Alles nu verversen" draaien. De 16 ingedeelde kinderen krijgen andere scores en mogelijk andere groepen — dat is de herberekening, geen fout.
3. **Bericht naar Berry sturen** over de "Prestatie"-kwestie en welke zes cijfers hij per kind moet aanleveren.
4. **Legacy-kinderen invullen.** Twee routes: de assignment-uuid's uit Ixly in kolom `ixly_taken` van Deelnemers zetten (dan haalt het systeem de scores zelf op), óf zes cijfers per kind met de hand in "Ixly Scores" met `bron` = `handmatig`.
5. **Antwoord van Ixly afwachten** op de vraag of "Prestatie" een totaalscore van Blocks is. Zo ja: alleen de Config-wegingen aanpassen, geen code.
6. **Seizoenstelling controleren** bij de eerstvolgende run: de regel `LET OP: N deelnemer(s) met seizoen … vallen buiten de indeling`. Klopt dat aantal niet, dan pakt de 1-meigrens verkeerd uit.
7. **Controle op onwaarschijnlijke geboortedata** — nog niet gebouwd, staat als open aanbod. Yara Breton (1984) en James Schultz (2021) worden nu gewoon ingedeeld zodra hun scores binnenkomen.
8. **Batchverhonging** — `kiesTeOphalenIndexen` roteert niet; kinderen die structureel geen volledige scores opleveren blijven een plek in de batch bezetten en kunnen nieuwe kinderen verdringen zodra het er `ixly_batch_per_run` (50) zijn.

### Belangrijke context die niet mag verdwijnen

- **Dit project kent nu DRIE seizoensgrenzen, bewust.** 1 mei voor de teamindeling (`bepaalTeamSeizoen` in `Teams.gs`), 1 juni voor Financieel (`seizoenStartdatum`), 1 augustus voor de deelnemersadministratie (`bepaalSeizoen`). Zie GLOSSARY.md.
- **Het `seizoen`-veld op een Deelnemers-rij is NIET bruikbaar om op te filteren.** `upsertDeelnemers` stempelt het met `bepaalSeizoen()` op de **orderdatum** (1-augustusgrens), dus een inschrijving van juni/juli draagt het vórige seizoenslabel. `bouwSegmenten` leidt het seizoen daarom af uit `uitgenodigd_op`. Dit is één keer fout gegaan: een ruling van Claude koos aanvankelijk de augustusgrens, wat de hele huidige lichting stil zou hebben uitgesloten.
- **De wegingen staan in Config omdat de klantformule nog niet vaststaat.** Een formulewijziging is elf cellen aanpassen, geen deploy. Dat is deze sessie meteen van pas gekomen toen Berry zijn berekening bevestigde.
- **"Prestatie" bestaat niet als Blocks-schaal in de Ixly-API.** Blocks levert alleen `planning` en `flexibility`; de enige `performance` hoort bij Rally. Berry's sheet gebruikt "Prestatie" wél als Blocks-helft, en zijn eigen Blocks-gemiddelde (Planning + flexibiliteit) wordt in zijn totaalscore niet gebruikt. Vraag ligt bij Ixly.
- **Een kind krijgt alleen een score als álle schalen met gewicht > 0 gevuld zijn.** Schalen op gewicht 0 hoeven niet ingevuld te zijn — dat maakt handmatige invoer van de legacy-groep haalbaar met zes cijfers in plaats van negen.
- **Kopregelcontrole is hard.** "Ixly Scores" en de teamtabbladen worden op kolompositie gelezen; klopt rij 1 niet, dan gooit stap 8 een fout in plaats van data in de verkeerde kolom te schrijven. Dat is deze sessie één keer afgegaan toen het tabblad zonder koppen was aangemaakt.
- **`bron = handmatig` beschermt een rij in "Ixly Scores" volledig** — die wordt nooit overschreven, ook niet als er later alsnog een uuid opduikt.
- **Datums schuiven een dag op** bij het omzetten van tekst naar datum (tijdzone). "20 november 2015" werd 19-11-2015. Meestal onschuldig, maar "1 januari 2016" werd 31-12-2015 — en dan schuift het jaar mee, precies waar de indeling op draait.
- **De `order_ids`-getalnotatiebug is nog steeds actief:** freddie-rood heeft `935,935.9359351147` staan.
- **Datakwaliteit in de brondata is zwak:** geboortedata van ouders (Yara Breton 1984), onmogelijke jaartallen (James Schultz 2021 in JO11), teamvelden die datums zijn geworden ("10-2-2026"), en clubnamen in zes schrijfwijzen. Alleen het geboortejaar beïnvloedt de indeling.

## 2026-08-12 — Max

**Branch:** `main` · **Commit:** `8c9b737` (15 commits sinds vorige overdracht, alle gepusht) · **Build:** 🟢 `func start` registreert alle zes functions; `venv/bin/pytest tests/ -q` 118 passed, 0 failed; `node --test tests/gs/*.test.js` 108 passed, 0 failed · **Status:** MVP in progress — Ixly-terugkoppeling en de per-academie-mailfix zijn live, nog niet met een echte order geverifieerd

### Wat er deze sessie is gebeurd

- **Twee root causes van de onbetrouwbare Ixly-terugkoppeling gevonden en gefixt.** (1) `ixly-status` vergeleek op `state == 'completed'`, terwijl Ixly `'finished'` gebruikt — een nooit-geverifieerde aanname die de terugkoppeling al maanden liet falen zonder ooit een fout te tonen (22 bestaande tests codeerden dezelfde verkeerde waarde, dus groen bewees niets). (2) De Ixly-organisatie heeft vier `api_user`-adviseurs (Max, Berry, Jeffry, Ruben); een `candidate_task` is alleen zichtbaar voor de adviseur die de kandidaat bezit, en `haal_token()` pakte altijd de eerste uit de lijst — elke run zag dus een willekeurige deelverzameling kandidaten. Gefixt door alle vier tokens te proberen. Zie ADR-013. Een tussentijdse verkeerde aanname (404 = verouderde referentie, doorgevoerd als Controleren-melding) is ontdekt en teruggedraaid vóórdat hij live ging.
- **Nieuwe kolommen `geboortedatum_kind`/`club`/`team` toegevoegd aan Deelnemers** (tussen `naam_kind` en `vereniging`, op verzoek verplaatst van de oorspronkelijke achteraan-positie), gevuld uit WooCommerce-checkoutvelden (`'Geboortedatum kind'`/`'Vereniging'`/`'Team'`) — niet te verwarren met de bestaande `vereniging`-kolom (academie-code KA/SU/MM). Vul-als-leeg-regel i.p.v. het strengere "eerste order telt"-patroon, met een eenmalige backfill voor bestaande rijen. Volledig doorlopen via de brainstorming- en TDD-skills; spec staat in `docs/superpowers/specs/2026-08-12-geboortedatum-club-team-design.md`. Max heeft de kolommen toegevoegd, de code geplakt en de backfill gedraaid.
- **Root cause van de dode debug-mail gevonden (stil sinds 2026-08-06):** dezelfde Vimexx-verzendlimiet als de SMTP-fout van 2026-08-10 uit een andere sessie ("SMTP fout: te veel e-mails verzonden") — `noreply@grovia.nl`/`mail.grovia.nl` is een **gedeeld account** tussen FunnelKit (WordPress) en onze eigen Function Apps. Die andere sessie had de FunnelKit-kant al gefixt (per-academie-afzender) maar de Function Apps-tegenhanger (`grovia_mail.py` + `ixly-aanmelding`/`grovia-herinnering`) lag nog ongecommit — dat is deze sessie afgemaakt en gedeployed.
- **Action Type-uitslagen gecontroleerd tegen Deelnemers:** 36 van 37 kloppen. Vier rijen bleken `action_type_af = JA` zonder type door een verkeerde handmatige invoer (moest `ixly_af` zijn) — Jon Kunst en Oscar Reus zijn door Max teruggezet naar NEE; Roan Brethouwer en Dominic de Groot waren écht af en lossen zichzelf op via de gedeployde statusfix.

### Git wijzigingen

Sinds vorige overdracht (`a310293..8c9b737`, 15 commits): 17 bestanden, 786 toevoegingen / 69 verwijderingen. Kern: `ixly-status/__init__.py` + `grovia_shared/ixly_api.py` (state-fix + adviseur-tokens), `google-apps-script/deelnemers/{Woo,Deelnemers,Sheet,Dagelijks}.gs` (geboortedatum/club/team + backfill), `grovia_shared/grovia_mail.py` + `ixly-aanmelding`/`grovia-herinnering` (per-academie-afzender), nieuwe spec- en ADR-documenten, en substantieel uitgebreide tests (`test_ixly_status.py`, `test_grovia_mail.py`, nieuwe `tests/gs/woo.test.js`).

### Open items / Next steps

1. **Testorder plaatsen en de hele keten verifiëren** — geen van de drie live gegane fixes (Ixly-status, adviseur-loterij, per-academie-afzender) is nog met een echte order bevestigd. Zie `docs/TODO.md` voor de volledige checklist (mail-afzender, order-meta, geboortedatum/club/team op een nieuwe rij, optioneel de games ook echt spelen).
2. **Beslissen over de debug-mails** ("Grovia Tag Callback"/"Grovia Test Router") — blijven kwetsbaar voor dezelfde Vimexx-limiet, de per-academie-fix dekt ze niet. Eigen afzender geven of verwijderen (ze zijn toch al TIJDELIJK en hun nut is twijfelachtig gebleken).
3. **Azure Application Insights-anomalie uitzoeken** — toont geen historie ouder dan een paar uur ondanks 90/30 dagen ingestelde retentie en geen dagcap. Ondermijnt toekomstig debuggen van dit soort problemen.
4. **Order 1344 blijft geparkeerd** — geen kandidaat in Ixly, oorzaak alleen met WP-admin/FunnelKit-toegang te achterhalen (zie `docs/TODO.md`).
5. Overige openstaande items ongewijzigd — zie `## Next Up` in `docs/TODO.md` (WAF-supportticket, plugin v1.7 upload, `order_ids`-notatiebug, Berry als vaste adviseur, etc.).

### Belangrijke context die niet mag verdwijnen

- **Een externe-API-statuswaarde die niet in de spec staat is een aanname, geen feit — en een test die dezelfde aanname als fixture gebruikt bevestigt alleen zichzelf.** De `'completed'`-bug stond 22 tests lang onopgemerkt precies hierdoor. Zulke waarden minimaal één keer tegen de live API vaststellen (zoals nu bij `AFGERONDE_STATES` in `ixly-status/__init__.py`) en de herkomst in een comment vastleggen.
- **`candidate_task` is adviseur-gebonden, `assignment` niet.** Live geverifieerd: dezelfde assignment-uuid geeft bij alle vier de Ixly-adviseur-tokens HTTP 200, maar de bijbehorende `candidate_task` geeft 404 bij drie van de vier en 200 bij precies één — afhankelijk van welke adviseur de kandidaat "bezit". Verklaart waarom eerder onderzoek (404 = verdwenen taak) een verkeerde conclusie trok: dezelfde taak loste een moment later met een ander token gewoon weer op.
- **`noreply@grovia.nl`/`mail.grovia.nl` is één gedeeld account tussen FunnelKit en de Function Apps** — een burst vanuit het ene systeem kan het andere laten stranden op de Vimexx-verzendlimiet. Nergens in `ARCHITECTURE.md` vastgelegd (zie `docs/DOC-SIGNALS.md`). De twee debug-mails (`wp_mail()` zonder eigen afzender) zijn hier het eerste zichtbare slachtoffer van geweest, stil sinds 2026-08-06.
- **`GROVIA_DEBUG_EMAIL` overschrijft alleen de ontvanger, niet de afzender** — nuttig om te weten bij het testen van de per-academie-afzenderfix: een testorder onder je eigen e-mailadres als besteller test de afzender net zo goed als met de debug-var aan, en is bovendien dichter bij de echte flow.
- **Kolomvolgorde in `KOLOMMEN` (Sheet.gs) moet exact matchen met de fysieke kolomvolgorde in het werkboek** — geen nieuwe les, maar deze sessie opnieuw relevant: de geboortedatum/club/team-kolommen zijn ná het schrijven van de code nog van "achteraan" naar "tussen naam_kind en vereniging" verplaatst, wat zonder risico kon omdat er nog niets fysiek in de Sheet was aangepast. Was dat al wel gebeurd, dan had een kolomvolgorde-mismatch stil verkeerde data door elkaar geschoven.
- **Notion is bijgewerkt aan het eind van deze sessie**, na een eerdere aanname dat de config ontbrak — die klopte niet, `~/.claude/notion.md` bestaat wel. Twee feature-taken aangemaakt ("Ixly-terugkoppeling debuggen en fixen", "Mail-infrastructuur: Vimexx-verzendlimiet aanpakken") met subtaken, drie losse taken, ADR-013 en een sessielogboek-entry. Drie bestaande taken op Done gezet ("Werk van 2026-08-05 committen naar git", "Opgeschoonde Dagelijks.gs uploaden", "Overwegen: afzenderadres aanpassen" — de laatste is inhoudelijk vervangen door de bredere per-academie-afzenderfix).

## 2026-08-05 — Max

**Branch:** `main` · **Commit:** `11e8a45` (0 commits deze sessie — alles staat nog in de working copy) · **Build:** 🟢 `func start`-host draait (poort 7071 al bezet door een lopend proces, bevestigt een geslaagde eerdere start); `node --test tests/gs/*.test.js` 97 passed, 0 failed; `venv/bin/pytest tests/ -q` 105 passed · **Status:** MVP in progress — MiniMove-checkout volledig live, nieuwe Sheets-tracking op één configuratiestap na live

### Wat er deze sessie is gebeurd

- **MiniMove-checkout definitief afgerond.** De oude opties (Cyclus 1-4 los, Seizoenkaart – inclusief/zonder tenue, MiniMove proeftrainingen) zijn als koopoptie verwijderd — zowel de variaties als de attribuutwaarden op het product, de onderliggende WooCommerce-termen blijven bestaan voor Kolping/Schagen. De productbeschrijving is herschreven naar het nieuwe strippenkaart-model. De maatvelden (shirt/broekje/sokken) zijn eerst verplicht gemaakt (rood sterretje, net als Vereniging/Team bij Kolping/Schagen) en dezelfde dag weer teruggedraaid naar optioneel: een kind kan al een tenue hebben van een eerdere cyclus. Zie ADR-012.
- **Nieuwe functionaliteit gebouwd via de brainstorming-skill: MiniMove-aankopen + aanwezigheidsregistratie** in het bestaande "Grovia Deelnemers"-werkboek. Nieuw bestand `MiniMove.gs` (patroonherkenning op de `pa_inschrijving`-slug, geen Config-mappingtabel nodig), uitbreidingen in `Config.gs`/`Sheet.gs`/`Dagelijks.gs` (nieuwe Stap 7, hergebruikt de orderregels van Stap 6/Financieel — geen extra WooCommerce-aanroep), 13 nieuwe tests. Twee tabbladen: "MiniMove Deelnemers" (automatisch) en "MiniMove Aanwezigheid" (4 blokken, handmatig afgevinkt door de trainer, die bewust volledige werkboek-toegang krijgt).
- **Drie bugs gevonden en gefixt tijdens het live opzetten door Max:** (1) `MiniMove.gs` ontbrak als apart bestand in de Apps Script-editor ("upsertMiniMoveDeelnemers is not defined"), (2) `#ERROR!` op de `gebruikt`-formule door het verkeerde argumentscheidingsteken voor de Nederlandse werkboek-locale, gefixt met `SpreadsheetApp.getSpreadsheetLocale()`, (3) nieuwe kindrijen aten de lege bufferregels vóór de volgende cyclusmarkering op — gefixt door nieuwe rijen na de laatst gevulde rij in te voegen i.p.v. vlak vóór de marker.
- **Een terugkerende WooCommerce-WAF-403 (CONVENTIONS-regel 2) opnieuw geraakt, dit keer in Stap 6/7**, en structureel verzacht in `Woo.gs`: retry-met-backoff op 403, een herkenbare User-Agent, pauzes tussen aanroepen en pagina's. Voor een permanente oplossing is een supportticket aan Vimexx opgesteld, nog niet verstuurd. ADR-012 legt alle beslissingen van deze sessie vast.

### Git wijzigingen

Geen commits deze sessie — alles staat in de working copy. `git diff --stat`: 7 bestanden, 495 toevoegingen / 195 verwijderingen. Kern: nieuw `google-apps-script/deelnemers/MiniMove.gs` + `tests/gs/minimove.test.js`, substantiële wijzigingen in `Sheet.gs` (+200), `Woo.gs` (+48/-… retry/UA/pauzes), `Dagelijks.gs` (Stap 7), `Config.gs` (kalenderblok), en het strippenkaartplan (`docs/superpowers/plans/2026-08-05-minimove-strippenkaarten.md`, 355 regels gewijzigd — grotendeels bijgewerkt om de live implementatie te weerspiegelen). Ook `plugins/grovia-automations/grovia-automations.php` (fasecodes, v1.6 → v1.7) staat nog ongecommit.

### Open items / Next steps

1. **Max: kolom O (rijen 1-4) in het Config-tabblad invullen** met de cyclusnummers 1/2/3/4, naast de 8 trainingsdata die al in P:W staan. Zonder dit blijft `config.minimove_kalender` leeg en verschijnen er geen datums in de kolomkoppen van "MiniMove Aanwezigheid".
2. **`dagelijkseRun` nog eenmaal draaien en verifiëren** — datums moeten nu in F:M staan, geen `#ERROR!` meer, nieuwe kindrijen op de juiste plek (met lege buffer intact).
3. **Vimexx-supportticket versturen** — concept staat klaar, Max moet het exacte tijdstip van de laatste 403 (Log-tabblad of Apps Script-uitvoeringsgeschiedenis) en zijn klant-/pakketgegevens invullen.
4. **Plugin v1.7 uploaden naar WordPress** (geen deploy-pipeline) — zonder upload blijft de debug-log bij een MiniMove-order de verkeerde reden noemen; geen functionele impact.
5. **Alles committen.** Er is deze sessie niets gecommit ondanks substantiële wijzigingen (zie Git wijzigingen hierboven) — dit als eerste doen bij de volgende sessie, vóór er nieuw werk bovenop komt.
6. **(bestaand) Eerste automatische reminder-run controleren** — trigger staat al sinds 2026-08-04 aan, verwacht patroon vanaf vandaag 07:00.
7. **(bestaand) `Financieel`-rapport-seizoensbug in juni/juli** — nog niet opgepakt, fix staat uitgewerkt in het strippenkaartplan (Bijlage A).

### Belangrijke context die niet mag verdwijnen

- **Een browsertab die niet ververst is vóór het bewerken van `functions.php` overschreef per ongeluk een live wijziging met een verouderde staat.** Deze editor leeft alleen in wp-admin, zonder versiebeheer — een open tab kan een oudere staat vasthouden dan wat er live staat. **Altijd de Thema bestand editor verversen vlak vóór een wijziging**, ook als er "net" nog iets in dezelfde tab is aangepast. De verloren wijziging (collapsible checkout-uitklap + de eerdere `needsSizesFromValue`-verbreding) is dezelfde sessie herbouwd en opnieuw geverifieerd.
- **`setFormula()` in Apps Script vereist het argumentscheidingsteken van de werkboek-locale** (`;` i.p.v. `,` bij een Nederlandstalig werkboek) — een formule met de verkeerde scheiding geeft een stille `#ERROR!`, geen duidelijke foutmelding. Geldt voor élke toekomstige `setFormula()`-aanroep in dit project, niet alleen MiniMove. Zie ADR-012 en het CONVENTIONS-signaal in `DOC-SIGNALS.md`.
- **MiniMove verkoopt sinds 2026-08-05 geen seizoenkaart of losse cyclus meer, alleen strippenkaarten** — maar historische orders met die oude slugs blijven herkend in `MiniMove.gs` (`type_aankoop` 'seizoenkaart'/'hele-cyclus') zodat kinderen die ze eerder kochten en deze cyclus nog meetrainen, gewoon in de aanwezigheidsregistratie verschijnen.
- **De collapsible checkout-UI en het maatuitvraag-mechanisme leven volledig buiten deze git-repo** (child-theme "Hello Elementor Child" → `functions.php`, bereikbaar via Weergave → Thema bestand editor) — dit was al zo, maar is deze sessie nogmaals bevestigd als de plek waar toekomstige checkout-UI-wijzigingen voor MiniMove/Kolping/Schagen moeten landen.
- **`synchroniseerMiniMoveAanwezigheid` verwerkt de 4 cyclusblokken bewust van cyclus 4 naar 1** (achterste blok eerst): een rij invoegen in een later blok verschuift nooit een blok dat daarboven staat, dus de rijnummers die aan het begin één keer zijn ingelezen blijven voor de nog te verwerken (eerdere) blokken geldig — geen herhaald inlezen nodig. Wijzig deze volgorde niet zonder de rij-boekhouding opnieuw door te denken.

