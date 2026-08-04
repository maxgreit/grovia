# Handoff — Grovia Automations

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

## 2026-08-01 — Max (nachtsessie, autonoom uitgevoerd)

**Branch:** `fix/ixly-assignment-uuid` (NIET gemerged naar main) · **Commit:** `963635e` (9 commits) · **Build:** 🟢 pytest 104 passed + node 59 passed, 0 failed · **Status:** klaar voor jouw review, wacht op je expliciete merge-akkoord

### Wat er deze sessie is gebeurd

- **Live-testen van de reminders/dashboard-feature (vorige sessie, `main`) legde een fundamentele bug bloot:** de Ixly-voltooiingscontrole werkte nooit, omdat de publieke Ixly-API geen endpoint heeft om de assignments van een kandidaat op te vragen (alleen `POST /assignments` bestaat, geen GET/lijst-variant — bevestigd tegen `swagger.yaml`).
- **Root cause + fix samen met jou ontworpen** (spec: [docs/superpowers/specs/2026-08-01-ixly-assignment-uuid-persisted-design.md](superpowers/specs/2026-08-01-ixly-assignment-uuid-persisted-design.md)): `ixly-aanmelding` bewaart voortaan `naam:assignment_uuid`-paren als WooCommerce order-meta (`_grovia_ixly_taken`) bij het aanmaken van een assignment. `ixly-status` en `grovia-herinnering` gebruiken die bewaarde uuid's om per taak het WEL werkende `GET /assignments/{uuid}` te bevragen, in plaats van de kapotte lijst-aanroep. Bestaande ~31 kandidaten van vóór deze fix blijven bewust op handmatige controle (geen terugvulling — jouw "Optie A"-keuze).
- **8-taken implementatieplan autonoom uitgevoerd** (subagent-driven-development: implementer + task-review per taak) + **finale whole-branch review op het meest capabele model**, die 4 Important bevindingen vond (secrets-instelling in strijd met ADR-003, een merge-gat waarbij `ixly_taken` bij een bestaande rij nooit werd bijgevuld, reminders die legacy-rijen dagelijks als mislukte poging zouden blijven terugkomen, een verouderde docstring) — alle 4 gefixt en in een scoped re-review bevestigd opgelost.
- **De los gespotte `order_ids`-bug** (Google Sheets zet `"935,1147"` om naar `9.351.147`) is NIET door deze branch geraakt of verergerd — bewust apart te tracken, zie hieronder.

### Wat jij nog moet doen

1. **Review de branch en geef akkoord voor de merge naar `main`** — ik heb dat bewust niet zelf gedaan; de branch staat klaar (`fix/ixly-assignment-uuid`, commit `963635e`), alle tests groen, eindreview clean.
2. **Nieuwe schrijfbare WooCommerce REST-sleutel aanmaken** (WooCommerce → Instellingen → Geavanceerd → REST API, permissies lezen/schrijven) en als **GitHub Secrets** (niet Azure Portal — zie ADR-003) toevoegen: `GROVIA_WORDPRESS_URL`, `GROVIA_WOO_CONSUMER_KEY`, `GROVIA_WOO_CONSUMER_SECRET`. Zonder deze secrets wordt `_grovia_ixly_taken` stil niet bewaard (alleen gelogd) en blijft een nieuwe order net als de bestaande ~31 rijen op handmatige controle staan.
3. **Na de merge/deploy: einde-tot-einde verifiëren met een nieuwe order** — testorder plaatsen, controleren dat `Deelnemers!ixly_taken` gevuld raakt, en in de Azure-logs controleren dat er GEEN "niet (volledig) gezet"-foutregel voorkomt (het faalpad is bewust stil). Volledige checklist staat al in [docs/TODO.md](TODO.md).
4. **De `order_ids`-bug onderzoeken** (zelfde klasse als de al-gefixte datum-coercion-bug, maar dan voor de komma-gescheiden `order_ids`-kolom die Google Sheets omzet naar Nederlandse getalnotatie — gezien in de `freddie-rood`-rij). Geen blocker voor deze merge, maar nog nergens getrackt.
5. Openstaande items uit de vorige sessie blijven ook staan: Action Type-mail conditioneel versturen, FunnelKit-automation, Ixly-database (zie `## Next Up` in [docs/TODO.md](TODO.md)).

### Belangrijke context die niet mag verdwijnen

- **`code` (het WooCommerce order-ID) is in het nieuwe contract gedegradeerd van functionele sleutel naar echo-sleutel.** Vóór deze fix zocht `ixly-status` de kandidaat op via `code` als `api_identifier`; nu dragen de bewaarde `assignment_uuid`'s de betekenis en wordt `code` alleen gebruikt om het resultaat terug te matchen. Dat maakt de Ixly-statuscontrole ongevoelig voor de `order_ids`-bug hierboven (punt 4) — maar `code` wordt nog wel elders gebruikt (reminder-mail, Action Type-koppeling), dus de bug bijt daar nog steeds.
- **`GROVIA_WOO_CONSUMER_KEY/SECRET` is bewust een APARTE, schrijfbare sleutel** — niet de bestaande alleen-lezen sleutel die Apps Script gebruikt. Least-privilege: alleen `ixly-aanmelding` schrijft, Apps Script blijft read-only.
- **Enkele geparkeerde Minor-bevindingen uit de eindreview** (bewust niet gefixt, geen functioneel risico): `var` i.p.v. `const` in twee nieuwe `Sheet.gs`-functies, een Engelse-genitief-typo in een docstring, een niet-bijgewerkte JSDoc, `parseIxlyTaken` kan geen komma in een taaknaam aan (nu geen probleem, 2 hardgecodeerde taken).
- **`docs/ARCHITECTURE.md` loopt inmiddels achter** (kent `ixly-status`/`grovia-herinnering`/het Deelnemers-werkboek nog niet) — bestond al vóór deze branch, geen regressie, maar wel de tweede branch op rij die er niets aan verandert.

## 2026-07-28 — Max

**Branch:** `main` · **Commit:** `99867d0` (13 commits deze sessie, gepusht) · **Build:** 🟢 PHP-lint (Docker `php:8.2-cli`) + `py_compile` OK · **Status:** MVP in progress

### Wat er deze sessie is gebeurd

- **Nieuwe plugin `grovia-fysio-toestemming` gebouwd én live op grovia.nl.** Optioneel toestemmingsvinkje op de checkout voor fysieke intakes/behandelingen fysiopraktijk + declaratie zorgverzekeraar. Opt-in via productcategorie `toestemming-vereist` (nu toegekend aan Zomerspektakel Kolping). Keuze wordt opgeslagen als order-meta (`_grovia_fysio_toestemming` ja/nee + tijdstip, afwezig = n.v.t.) en getoond in het admin-orderscherm. Eénmalige pop-up-nudge via `sessionStorage`, gestyled in het sitethema (kaart `#1d2110`, accent `#FF5C00`, radius 16px).
- **Proces:** spec + implementatieplan via superpowers (subagent-driven, per taak gereviewd). Finale review vond een echte bug — vinkje-status ging verloren bij AJAX fragment-refresh (`update_order_review` stuurt velden in `post_data`) — gefixt met `parse_str`-fallback.
- **Pop-uptekst letterlijk van de klant overgenomen** (bewust mét "testen", afwijkend van de "intakes en behandelingen"-terminologie elders — keuze van Max na expliciete vraag).
- **Live geverifieerd met de browser:** vinkje conditioneel ✓, pop-up eenmalig ✓, beide knoppen ✓, vinkje overleeft validatiefout ✓, geen vinkje zonder categorie-product ✓. Geen testorder geplaatst.

### Open items / Next steps

1. **Testorder met 100%-kortingscode** (Max, vandaag) — hele keten incl. order-meta in admin verifiëren; daarna order + kortingscode verwijderen.
2. **WP-pagina `/toestemming-fysieke-intakes/` publiceren** — geeft nu 404 terwijl de links al live staan; concepttekst in [plugins/grovia-fysio-toestemming/infopagina-concept.md](../plugins/grovia-fysio-toestemming/infopagina-concept.md), wacht op klantantwoorden (vragenlijst ligt bij Max/Berry).
3. **Categorie `toestemming-vereist` aan de overige trainingen hangen** zodra de klant bepaalt welke producten meedoen (nu alleen Zomerspektakel).
4. Eerdere Next Ups blijven staan: Action Type-mail conditioneel, FunnelKit WA-automation, Ixly-database.

### Belangrijke context die niet mag verdwijnen

- **WooCommerce fragment-refresh wist custom checkout-velden:** bij `update_order_review` (o.a. na élke validatiefout) komen veldwaarden niet als losse `$_POST`-keys binnen maar geserialiseerd in `$_POST['post_data']`. Custom checkboxes moeten die fallback zelf parsen (WC herstelt alleen z'n eigen `#terms`). Zit nu in de plugin — geldt ook voor toekomstige checkout-velden.
- **De checkout leeft op `/checkout/`, niet `/afrekenen/`** (dat pad geeft 404).
- **Order-meta is niet handmatig te previewen:** admin-orders doorlopen de checkout-hooks niet en underscore-meta is beschermd; testen kan alleen via een echte (gratis) checkout.
- **Terminologie-mix is bewust:** pop-up zegt "testen" (klanttekst letterlijk), vinkje + infopagina zeggen "intakes en behandelingen". Als de fysio er één lijn van wil maken: kleine tekstwijziging.
- De pop-uptekst beantwoordt klantvraag 3 (gegevensdeling): naam kind, geboortedatum, e-mailadres, woonadres — bruikbaar voor de infopagina; let op: woonadres = factuuradres van de ouder.
