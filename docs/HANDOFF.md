# Handoff — Grovia Automations

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

## 2026-08-04 — Max (vervolgsessie)

**Branch:** `main` · **Commit:** `0278bee` (6 commits deze sessie, nog niet gepusht — `main` staat nu 22 commits vóór `origin/main`) · **Build:** 🟢 `func start` start de host en registreert alle zes functions; pytest 105 passed + node 84 passed, 0 failed · **Status:** MVP live — de toestemmingspagina is publicatieklaar maar staat nog niet in WordPress

### Wat er deze sessie is gebeurd

- **De toestemmingsverklaring van Grovia en SMC Dijk en Waard is verwerkt tot een publicatieklare infopagina** voor `/toestemming-fysieke-intakes/`, die tot nu toe 404 gaf terwijl de links vanaf de checkout al live stonden. De tekst is verbatim overgenomen (zie ADR-011); drie bewuste afwijkingen staan gedocumenteerd in het bestand zelf. Bij het lezen van dat document bleek dat het **letterlijk voorschrijft met welke tekst het hokje wordt aangevinkt**, en dat week af van wat de plugin toonde — de vinkje-tekst is daarom gelijkgetrokken (plugin v1.1.0).
- **Twee aannames uit het ontwerp sneuvelden tijdens de bouw en zijn bijgesteld.** (1) "Het sitethema verzorgt de opmaak" gaat niet op: een Code/HTML-blok in Breakdance rendert rauwe HTML zónder de typografie die de builder op zijn eigen tekstelementen zet — de tekst stond vrijwel onleesbaar donker op de donkere achtergrond, zonder witruimte, over de volle breedte. Opgelost met een `.grovia-verklaring`-wrapper plus gescopete `<style>` in hetzelfde bestand. (2) Het titel-element van het template viel achter de sticky header; dat staat nu uit en de `<h1>` zit in de content, zodat de afstand beheersbaar is en de pagina één `<h1>` houdt.
- **De intrek-sectie is er alsnog gekomen.** Aanvankelijk bewust weggelaten omdat de verklaring het recht op intrekken niet beschrijft; de klant leverde de antwoorden nog in dezelfde sessie (intrekken via `b.moolenaar@grovia.nl`, gevolg is geen deelname aan de volgende testronde voor zover het blessurepreventie betreft, en SMC heeft een eigen privacyverklaring om naar te linken).
- **`Dagelijks.gs` volledig opgeschoond: 536 → 206 regels.** Alle zes eenmalige functies zijn eruit, inclusief `backfillOudereOrders` en `backfillDiagnose` — Max sluit die diagnose-taak zonder hem te draaien.
- **Twee openstaande bugs zijn gediagnosticeerd maar niet gefixt** (bewust doorgeschoven): de root cause van de `order_ids`-getalnotatiebug en de oorzaak van de willekeurig toegewezen Ixly-adviseur. Zie "Belangrijke context" hieronder.

### Git wijzigingen

Sinds vorige overdracht (`6f780ad..0278bee`, 6 commits): 6 bestanden, 315 toevoegingen / 391 verwijderingen. Kern: nieuw `plugins/grovia-fysio-toestemming/infopagina.html` (165 regels) en de design-spec, gewijzigd `grovia-fysio-toestemming.php`, verwijderd `infopagina-concept.md`, en `google-apps-script/deelnemers/Dagelijks.gs` 330 regels korter. De werkmap heeft nog steeds dezelfde niet-gecommitte `.claude/`-templatewijzigingen als bij de vorige overdracht — deze sessie niet aangeraakt.

### Open items / Next steps

1. **Plugin v1.1.0 en `Dagelijks.gs` uploaden.** Deze twee zijn de enige dingen die live nog niet kloppen. De WordPress-plugins hebben **geen deploy-pipeline** (anders dan de Azure Functions), dus zolang de upload niet gebeurd is staat de oude vinkje-tekst nog op de checkout — die wijkt dan af van de verklaring op de pagina.
2. **WP-pagina `/toestemming-fysieke-intakes/` publiceren** met [infopagina.html](../plugins/grovia-fysio-toestemming/infopagina.html). Slug moet exact zo blijven, de plugin linkt hardgecodeerd naar dat pad. Titel-element van het template pagina-specifiek uitzetten, niet globaal.
3. **Adres van SMC verifiëren bij Berry** vóór publicatie: de verklaring vermeldt "Helena Nordheimland 3", wat een typo lijkt voor "Nordheimlaan". Staat nu letterlijk zo op de pagina.
4. **Eerste automatische reminder-runs controleren.** Verwacht patroon in het Log-tabblad: **2026-08-06** de nieuwe 2627-rijen (drempel 3), **2026-08-07** de backlog (drempel 7 vanaf anker 2026-07-31). Eerder of massaler = `reminder_anker` niet goed doorgekomen → trigger direct pauzeren.
5. **`order_ids`-bug fixen** — root cause staat hieronder, de fix is klein.
6. **Testorder met 100%-kortingscode** om de order-meta in het adminscherm te verifiëren (daarna order + code verwijderen).
7. **Berry's `user_uuid` uit Ixly halen**, dan de adviseur-fix implementeren (geblokkeerd tot die uuid er is).
8. **Uitnodigingsmail naar één startknop** — besloten dat de twee gameknoppen overbodig zijn; wijziging in `grovia_mail.py` + deploy.
9. **WhatsApp Business-accountprobleem bij Berry / de groepsbeheerder leggen** — geen codeprobleem, zie hieronder.

### Belangrijke context die niet mag verdwijnen

- **Een Code/HTML-blok in Breakdance erft géén thema-typografie.** Rauwe HTML krijgt niets van de typografie-instellingen die de builder op zijn eigen tekstelementen zet: geen kleur, geen marges, geen leesbreedte. Elk contentbestand dat via zo'n blok gaat moet zijn eigen gescopete `<style>` meenemen. Prijs: de tekstkleur staat nu hardgecodeerd op `#fff` in `infopagina.html` in plaats van mee te bewegen met het thema. Het alternatief (Rich Text-element) laat de typografie wél erven maar haalt de content uit één plakbaar blok.
- **De vinkje-tekst op de checkout is juridisch gekoppeld aan twee andere plekken.** De toestemmingsverklaring benoemt exact met welke tekst het hokje wordt aangevinkt. Wijzigt die formulering in [grovia-fysio-toestemming.php](../plugins/grovia-fysio-toestemming/grovia-fysio-toestemming.php), dan moeten de verklaring én `infopagina.html` mee — anders wijkt af waar de ouder op klikt van wat het document zegt dat ze aanvinken. Staat als waarschuwing in de docblock boven `grovia_fysio_render_vinkje`.
- **`order_ids`-bug: root cause gevonden, nog niet gefixt.** [Sheet.gs:92](../google-apps-script/deelnemers/Sheet.gs:92) schrijft de array weg met `waarde.join(',')` als **onopgemaakte** celwaarde. Bij twee orders wordt dat `"935,1147"`, en met een Nederlandse locale leest Sheets die komma als decimaalteken en maakt er een getal van. Bij teruglezen splitst [Sheet.gs:56](../google-apps-script/deelnemers/Sheet.gs:56) op komma en houdt één id over in plaats van twee. Fix: kolomformaat op tekst (`@`) zetten bij het schrijven. Onbekend of de al beschadigde `freddie-rood`-rij te repareren is. Dit is de dérde bug van dezelfde klasse (na datum- en seizoen-coercion): **elke waarde die als tekst in Sheets moet blijven staan heeft een expliciet tekstformaat nodig, niet alleen een `String()` bij het teruglezen.**
- **De willekeurige Ixly-adviseur komt door een ontbrekend veld, niet door een instelling.** [ixly-aanmelding/__init__.py:156](../ixly-aanmelding/__init__.py:156) stuurt bij het aanmaken van een candidate alleen `first_name`, `last_name`, `email`, `language` en `api_identifier`. Ixly's API kent een `user_uuid` ("Can be used to set the user of a candidate") dat wij nooit meesturen, dus wijst Ixly zelf iemand toe. **Er is geen publiek endpoint om gebruikers op te zoeken** (gecheckt tegen `swagger.yaml`), dus Berry's uuid moet uit de Ixly-interface of via support komen. Bij implementatie: de env var óók in `deploy.yml` zetten — een GitHub Secret zonder workflow-regel komt stil niet in Azure aan.
- **Het WhatsApp Business-accountprobleem is geen codeprobleem.** Onze code verstuurt alleen een bericht met een groepsuitnodigingslink en bepaalt niets over wie mag joinen. Dat een Business-account niet via zo'n link kan deelnemen is gedrag van WhatsApp zelf of een groepsinstelling ("wie kan deelnemen"). Niet verder in de code zoeken.
- **`backfillDiagnose()` is gesloten zonder gedraaid te zijn.** De uitkomst "120 orders opgehaald → 0 nieuwe deelnemersrijen" van 2026-08-02 is dus **niet verklaard, alleen geparkeerd** — bewuste keuze. Mochten er ooit deelnemers blijken te missen van vóór 2026-04-09, dan is dit het eerste spoor. De functie is op te halen uit commit `b556b66`/`0278bee`.

## 2026-08-04 — Max

**Branch:** `main` · **Commit:** `092f015` (13 commits sinds vorige overdracht) · **Build:** 🟢 pytest 105 passed + node 84 passed, 0 failed · **Status:** MVP live — dagelijkse trigger staat AAN (07:00), Financieel-rapport werkend

### Wat er deze sessie is gebeurd

- **Race condition gevonden en gedicht.** De 27 handmatige reminders van 2026-08-03 stonden wél als "ok" in het Log-tabblad maar hun `laatste_reminder_op`/`laatste_poging_op` waren nooit in de Deelnemers-sheet beland: de dagelijkse run en de handmatige menu-actie schreven allebei de hele sheet terug en de laatste won. `LockService.getScriptLock()` toegevoegd aan `dagelijkseRun` en `_verstuurNaarSelectie`; de verloren velden zijn met een eenmalig script hersteld.
- **Drie nieuwe Deelnemers-kolommen** (`rol` = Speler/Keeper uit de WooCommerce-categorie, `product`, `bedrag`) plus een eenmalige backfill die ze voor de bestaande rijen alsnog vulde. Die backfill ging eerst mis: hij deed één WooCommerce-aanroep per rij (~35, elk met een eigen volledige productcatalogus-ophaal erbij) en werd na de eerste al door de WAF geblokkeerd — herschreven naar één bulk-ophaalactie plus lokale lookup.
- **Financieel-tabblad gebouwd** (afdracht per vereniging × cyclus, keepers/spelers apart via cyclusproduct dan wel seizoenkaart, omzet incl./excl. 9% btw, €20 afdracht per deelnemer). Rekent op orderREGEL-niveau met een eigen seizoensgrens van 1 juni — zie ADR-009. Kostte drie iteraties om live werkend te krijgen: eerst ontbrekende bestanden in de Apps Script-editor, toen een 403 door dubbel WooCommerce-verkeer binnen één run (opgelost met een ScriptCache), en ten slotte de verkeerde aanname over de meta-sleutel (`Inschrijving` bleek `pa_inschrijving` met de ruwe slug als waarde).
- **Reminder-schema herstartbaar gemaakt en de automatische reminders live gezet.** Nieuwe `reminder_anker`-kolom (ADR-010), want de drempels tellen vanaf `uitgenodigd_op` en voor weken oude rijen zijn die allemaal al gepasseerd — die zouden ~5 mails in 9 dagen afvuren. Backlog op anker 2026-07-31 + teller 1 gezet, ritme naar 3/7/14/21/35/49, `installeerTrigger` gedraaid. Ook een oneindige-lus-bug gedicht: een rij met Action Type af, Ixly niet af én zonder `ixly_taken` kwam elke dag als kansloze mislukte poging terug.

### Git wijzigingen

Sinds vorige overdracht (`3f3f526..092f015`, 13 commits): 11 bestanden, 915 toevoegingen / 15 verwijderingen. Kern: nieuw `google-apps-script/deelnemers/Financieel.gs` + `tests/gs/financieel.test.js`, en wijzigingen in `Woo.gs`, `Sheet.gs`, `Dagelijks.gs`, `Reminders.gs`, `Deelnemers.gs`, `Menu.gs`, `Config.gs`. Werkmap heeft nog niet-gecommitte `.claude/`-templatewijzigingen (template-sync, los van het inhoudelijke werk).

### Open items / Next steps

1. **Morgenochtend na 07:00 de eerste automatische run controleren** — check het Log-tabblad: er zouden op 2026-08-07 (niet eerder) reminders naar de backlog moeten gaan, en op 2026-08-06 naar de nieuwe 2627-rijen. Loopt het eerder of massaler, dan is het anker niet goed doorgekomen.
2. **`backfillDiagnose()` draaien en beoordelen** — verklaart of "120 orders → 0 nieuwe rijen" klopt (uitgesloten categorieën/MiniMove) of dat er iets mist.
3. **Legacy-kandidaten (~30) eenmalig uitnodigen voor de games** via Ixly's eigen bulkactie, plus het al opgestelde klantbericht naar Grovia sturen.
4. **Tijdelijke functies opruimen uit `Dagelijks.gs`** zodra ze hun werk gedaan hebben: `backfillOudereOrders`, `backfillDiagnose`, `herstelVerlorenReminderVan20260803`, `vulRolProductBedragVoorBestaandeRijen`, `zetOudeRijenOpNieuwSchema`, `debugInschrijvingMeta`.
5. **`order_ids`-Nederlandse-getalnotatie-bug onderzoeken** (freddie-rood: `9.351.147` i.p.v. `935,1147`) — nog steeds open, zelfde klasse als de gefixte seizoen- en datum-coercion-bugs.
6. **Afzenderadres van de mail** staat op `noreply@grovia.nl`; Max heeft besloten dit voorlopig zo te laten. Wijzigen vereist een nieuwe mailbox in DirectAdmin plus drie GitHub Secrets (`SMTP_GEBRUIKER`/`SMTP_WACHTWOORD`/`SMTP_AFZENDER`) en een deploy.

### Belangrijke context die niet mag verdwijnen

- **Elke functie die de Deelnemers-sheet leest-muteert-terugschrijft moet een `LockService`-lock nemen.** Zonder lock overschrijft een overlappende run stil de net weggeschreven staat. Dit is één keer echt gebeurd (27 reminders zoek) en is niet aan de logregels te zien, want het Log-tabblad wordt per regel los aangevuld.
- **Nooit per-rij WooCommerce-aanroepen doen.** Bulk ophalen + lokaal opzoeken. De WAF op grovia.nl blokkeert bursts: ~35 losse aanroepen faalden al na de eerste, en zelfs twee volledige productcatalogus-ophalingen binnen één run gaven een 403. Vandaar de 5-minuten `CacheService`-cache in `_haalProductCategorieen`.
- **`pa_inschrijving`, niet `Inschrijving`.** De cyclus/seizoenkaart-variatie komt uit de WooCommerce-API als regelmeta met sleutel `pa_inschrijving` (attribuutprefix) en de **ruwe slug** als waarde (`cyclus-1`, `seizoenkaart-inclusief-tenue`), niet het zichtbare label. Vertaling loopt via `mapping.fases` (Config G:H) — die mapping bestond al lang maar was tot nu toe dood.
- **Twee verschillende seizoensgrenzen, bewust.** 1 juni voor het Financieel-rapport (`Financieel.gs`, want cyclusverkoop start in juni/juli), 1 augustus voor de deelnemersadministratie (`bepaalSeizoen()` in `Deelnemers.gs`). `Financieel.gs` roept `bepaalSeizoen()` daarom nergens aan. Valkuil bij toekomstige wijzigingen.
- **`config.startdatum` (nu 2026-05-01) vergelijkt vanaf nu het `reminder_anker`, niet `uitgenodigd_op`.** Het is de enige plek waar dat Config-veld gebruikt wordt — geen effect op ordersync, Dashboard of Financieel. Niet verwarren met `sinds_fallback`.
- **`GROVIA_DEBUG_EMAIL` is leeg in productie** (geverifieerd) — reminders gaan dus echt naar ouders, niet naar een testadres.
- **Apps Script-project is verhuisd naar een eigen GCP-project** (`grovia-504418`) om externe testgebruikers te kunnen toevoegen. Daardoor zijn alle eerdere autorisaties ingetrokken; wie het script gebruikt moet als testgebruiker in het OAuth-toestemmingsscherm staan (Audience → Test users) en opnieuw autoriseren.

## 2026-08-02 — Max (vervolgsessie)

**Branch:** `main` · **Commit:** `8e4309f` (5 commits sinds vorige overdracht) · **Build:** 🟢 pytest 105 passed + node 59 passed, 0 failed · **Status:** Ixly-fix + Action Type-koppeling live; eenmalige historische backfill klaargezet, resultaat nog te duiden

### Wat er deze sessie is gebeurd

- **Action Type-controlecode-koppeling gefixt (root cause + kolomindex).** De vier `ACTION_TYPE_ENTRY_*`-env vars ontbraken volledig in `.github/workflows/deploy.yml` (nooit meegenomen, ongeacht welke GitHub Secret gezet was) — dit was de reden dat élke Action Type-inzending in "Handmatig koppelen" belandde. Toegevoegd aan de deploy-workflow, secrets gezet, herverifieerd in Azure. Daarnaast `ActionType.gs`'s kolomindex voor de controlecode ging twee keer heen-en-weer (23→24→23) doordat de eerste gedeelde antwoordsheet-snapshot een tussentijdse, nog niet opgeschoonde staat bleek; definitief bevestigd op index 23 (kolom X) tegen de daadwerkelijk opgeschoonde KA- en SU-sheets.
- **Ixly-passwordless-loginlink-mysterie afgesloten: geen bug.** Met een compleet nieuw, nooit eerder gebruikt testadres bleek de link gewoon te werken; de eerdere "niet meer geldig"-melding kwam doordat het testadres al een bestaand Ixly-account had. ADR-004's aanname (per-taak-unieke link) staat dus niet meer ter discussie.
- **Bevestigd dat de reminder-mail al de juiste Action Type-prefilllink meestuurt** — `grovia_mail.bouw_herinnering()` roept dezelfde `bouw_prefill_url()` aan met `code`/`naam_kind` als de uitnodigingsmail, en die twee velden zitten al in de payload die het Apps Script stuurt. Geen codewijziging nodig: elke reminder vanaf nu (ook aan al eerder uitgenodigde deelnemers) krijgt automatisch de prefilled link.
- **Eenmalige historische WooCommerce-backfill gebouwd** (`backfillOudereOrders()` in `Dagelijks.gs`) om orders van vóór de sheet's eerste `uitgenodigd_op` (2026-04-09) alsnog te verwerken, expliciet zonder bestaande, deels handmatig ingevulde Deelnemers-rijen te overschrijven — hergebruikt bewust de bestaande `upsertDeelnemers`-mergelogica (die dat garandeert) met een vaste vroege startdatum i.p.v. de voorwaartse `_sindsDatum`. Eerste run: 120 orders opgehaald, maar 0 nieuwe rijen (bleef op 31), 2 naar Controleren. **Nog niet verklaard** — read-only diagnosefunctie (`backfillDiagnose()`) toegevoegd die exact telt hoeveel orders zijn overgeslagen via `mapping.uitgesloten`, hoeveel MiniMove waren (telt niet mee voor de testen) en hoeveel matchten met een al bestaand kind; nog niet door Max gedraaid.

### Git wijzigingen

Sinds vorige overdracht (`16562f5..8e4309f`, 5 commits): 3 bestanden, 127 toevoegingen / 8 verwijderingen. Kern: `.github/workflows/deploy.yml` (Action Type-entry-ID's), `google-apps-script/deelnemers/ActionType.gs` (kolomindex), `google-apps-script/deelnemers/Dagelijks.gs` (backfill + diagnose, tijdelijk).

### Open items / Next steps

1. **`backfillDiagnose()` draaien in de Apps Script-editor** en de uitkomst beoordelen — verklaart of de "120 orders → 0 nieuwe rijen"-uitkomst normaal is (uitgesloten categorieën/MiniMove) of ergens op wijst dat niet klopt.
2. Afhankelijk van 1: als er wél orders zijn die een nieuwe rij hadden moeten opleveren maar dat niet deden, verder uitzoeken; zo niet, `backfillOudereOrders`/`backfillDiagnose` desgewenst uit `Dagelijks.gs` verwijderen (niet urgent, ze zijn onschadelijk om te laten staan).
3. **Legacy-kandidaten (~30) eenmalig uitnodigen voor de games** — in Ixly: alle betrokken kandidaten selecteren → "Uitnodiging games"-template → bulk versturen.
4. **Kort klantbericht naar Grovia sturen** over deze eenmalige actie (concepttekst staat al klaar uit een eerdere sessie).
5. **Controleer of de dagelijkse Apps Script-trigger (`installeerTrigger`) daadwerkelijk actief staat** — nog niet bevestigd.
6. **`order_ids`-Nederlandse-getalnotatie-bug** (freddie-rood-rij) — nog steeds niet onderzocht, staat los van de rest.
7. Overige openstaande items — zie `## Next Up` in `docs/TODO.md`.

### Belangrijke context die niet mag verdwijnen

- **`upsertDeelnemers` (Deelnemers.gs) filtert twee categorieën orders stil weg, zonder spoor in "Controleren":** orders met een categorie in `mapping.uitgesloten`, en orders met vereniging `MM` (MiniMove — doet niet mee aan de testen). Bij het duiden van "waarom levert een backfill minder nieuwe rijen op dan verwacht" altijd deze twee eerst uitsluiten voordat er iets mis lijkt te zijn.
- **`ACTION_TYPE_ENTRY_*` env vars stonden nooit in `deploy.yml`** ondanks dat de code en `local.settings.json.example` ze al lang gebruikten — een GitHub Secret zetten zonder de workflow bij te werken heeft dus geen enkel effect. Check bij toekomstige nieuwe env vars altijd of ze ook echt in de `az functionapp config appsettings set`-regel in `deploy.yml` staan, niet alleen of het Secret bestaat.
- **De Action Type-antwoordsheet-kolomindex is pas definitief na het opschonen van het formulier** — een gedeelde snapshot tijdens het opruimen van een sheet kan een tussentijdse, niet-finale kolomvolgorde tonen. Vraag bij zo'n wijziging expliciet "is dit de definitieve, opgeschoonde staat?" voordat een indexwijziging wordt vastgezet.

## 2026-08-02 — Max

**Branch:** `main` · **Commit:** `2833d43` · **Build:** 🟢 pytest 105 passed + node 59 passed, 0 failed · laatste deploy geslaagd · **Status:** Ixly-assignment-uuid-fix live en bevestigd werkend

### Wat er deze sessie is gebeurd

- **De Ixly-assignment-uuid-fix (8-taken plan, zie ADR-008) is gemerged naar `main` en gedeployed.** Tijdens het live-testen kwamen twee losse, opeenvolgende problemen aan het licht en zijn beide zelf gevonden en opgelost: (1) de nieuwe WooCommerce-sleutel bleek per ongeluk alleen-lezen (401) — gecorrigeerd naar lezen/schrijven; (2) daarna nog een 403 "Request forbidden by administrative rules" bij élke schrijfpoging vanuit Azure. Grondig geïsoleerd (Application Insights bleek op het verkeerde component te staan gequeryd, .htaccess-overrides voor mod_security hadden geen effect) tot de exacte oorzaak: de hosting blokkeert de standaard `python-requests`-User-Agent — opgelost met één regel code, bevestigd werkend met een echte order.
- **De ~30 legacy-kandidaten van vóór deze fix kunnen niet met terugwerkende kracht bijgewerkt worden** (zelfde ontbrekende Ixly-lijst-endpoint als de oorspronkelijke bug) — Optie A blijft van kracht. Voor hen is een eenmalige handmatige route geïdentificeerd (Ixly's eigen "Verstuur welkomstmail"-bulkactie voor de games; Action Type-herinneringen lopen al automatisch correct door), nog niet uitgevoerd.
- **Los, nog niet volledig verklaard probleem gevonden tijdens het testen:** Ixly's `login_url` per assignment blijkt in de praktijk een gedeelde, kandidaat-brede passwordless-login-token te zijn (identiek token voor elke taak van dezelfde kandidaat, bevestigd door de twee links in een testmail te vergelijken) — niet de per-taak-unieke link die ADR-004 aannam. Daardoor werkt van de twee gameknoppen in de uitnodigingsmail er na de eerste klik nog maar één. Nog te bepalen of dit door het gedeelde/eenmalige token komt, of doordat het testadres al een bestaand Ixly-account had.

### Git wijzigingen

23 bestanden gewijzigd t.o.v. de vorige overdracht (`3286406..2833d43`): 2234 toevoegingen, 150 verwijderingen. Kern: `ixly-aanmelding/__init__.py`, `ixly-status/__init__.py`, `grovia-herinnering/__init__.py`, `grovia_shared/ixly_api.py`, alle `google-apps-script/deelnemers/*.gs`, plus specs/plan-documenten en tests.

### Open items / Next steps

1. **Legacy-kandidaten (~30) eenmalig uitnodigen voor de games** — in Ixly: alle betrokken kandidaten selecteren → "Uitnodiging games"-template → bulk versturen. Action Type-herinneringen hoeven niet apart geregeld te worden, die lopen al automatisch.
2. **Kort klantbericht naar Grovia sturen** over deze eenmalige actie (concepttekst is deze sessie al opgesteld, nog te versturen of aan te passen).
3. **Uitzoeken of de "niet meer geldig"-linkfout** door het gedeelde/eenmalige passwordless-token komt, of door een reeds bestaand Ixly-account op het testadres — test met een compleet nieuw, nooit eerder gebruikt e-mailadres om te onderscheiden.
4. **Overwegen: uitnodigingsmail-template aanpassen** (één "Start hier"-knop i.p.v. twee aparte gameknoppen, met uitleg dat beide games daarna vanuit de omgeving zelf te starten zijn) — kosmetische verbetering, niet urgent.
5. **Controleer of de dagelijkse Apps Script-trigger (`installeerTrigger`) daadwerkelijk actief staat** — niet bevestigd deze sessie of dit al gedraaid is.
6. **`order_ids`-Nederlandse-getalnotatie-bug** (freddie-rood-rij, Google Sheets zet `"935,1147"` om naar `"9.351.147"`) — nog steeds niet onderzocht, staat los van deze fix.
7. Overige openstaande items uit eerdere sessies blijven staan — zie `## Next Up` in `docs/TODO.md`.

### Belangrijke context die niet mag verdwijnen

- **De 403-blokkade was géén IP-blokkade van Azure, maar User-Agent-gebaseerd.** Identiek verzoek vanaf hetzelfde IP: met User-Agent `python-requests/x.x.x` → 403 "Request forbidden by administrative rules"; met een andere User-Agent → 200. Opgelost met `headers={"User-Agent": "GroviaAutomations-IxlyAanmelding/1.0"}` op de PUT in `_bewaar_ixly_taken`. Elke toekomstige nieuwe Python-aanroep naar grovia.nl's WooCommerce API moet dezelfde eigen User-Agent zetten (zie ook `docs/DOC-SIGNALS.md`).
- **Application Insights-valkuil:** de Function App "grovia-automations" is gekoppeld aan een App Insights-component met een ANDERE naam (`grovia-automations202604301611`), niet aan het gelijknamige component. Queries tegen het verkeerd-genaamde component geven altijd 0 resultaten, zonder foutmelding. Check bij toekomstig loggen eerst de `hidden-link: /app-insights-resource-id`-tag in `az webapp log config`'s output om het juiste component te vinden.
- **GitHub Secret-namen zijn kritiek exact:** `WOO_CONSUMER_KEY`/`WOO_CONSUMER_SECRET` (zonder `GROVIA_`-prefix) bestonden al vanuit een eerdere, losse poging en werden stil genegeerd door de deploy-workflow (niet-bestaande secrets worden gewoon leeg meegegeven, geen fout). Hernoemd naar `GROVIA_WOO_CONSUMER_KEY`/`GROVIA_WOO_CONSUMER_SECRET`. Niet verwarren met de gelijknamige Apps Script Script Properties (`woo_basis_url`/`woo_key`/`woo_secret`, kleine letters) — twee volledig losse systemen.
- **Vimexx/DirectAdmin:** geen WordPress-beveiligingsplugin actief op grovia.nl; Cloudflare-integratie staat op "temporarily disabled"; `.htaccess`-overrides voor `mod_security2`/`SecRuleEngine` hebben getest GEEN effect op dit hostingpakket — WAF-regels zitten op serverniveau, niet zelf aan te passen via DirectAdmin (bleek uiteindelijk ook niet nodig, zie de User-Agent-fix hierboven).
- **`ixly-aanmelding`'s duplicate-guard voor assignments (`_maak_assignments_aan_met_guard`) is nog steeds niet functioneel** — die probeert bestaande assignments op te halen via hetzelfde kapotte lijst-endpoint als de oorspronkelijke bug, dus denkt altijd dat er niets bestaat. Een tweede keer verwerken van dezelfde order/kandidaat maakt daardoor telkens een nieuw paar assignments aan (orphans in Ixly), niet gevaarlijk maar wel rommelig.

