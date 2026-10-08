# Handoff — Grovia Automations

## 2026-10-08 — Max

**Branch:** `main` · **Commit:** `d286025` (2 code-commits + deze handoff-commit) · **Build:** 🟢 `venv/bin/pytest tests/ -q` 144 passed, 0 failed; `node --test tests/gs/*.test.js` 293 passed, 0 failed · **Status:** MVP — verplichte keuze speler/keeper voor evenementen gebouwd en live

### Wat er deze sessie is gebeurd

- **Keuze speler/keeper op de productpagina (verzoek Berry, ADR-019).** Nieuw blok in `plugins/hello-elementor-child/functions.php` ("GROVIA - Keuze speler of keeper"): staat een product in de WooCommerce-categorie `keuze-speler-keeper`, dan krijgt de productpagina twee radioknoppen (Speler/Keeper, verplicht via `required` + servervalidatie). De keuze komt in winkelwagen, order en mails als "Speler of keeper". Max heeft het geplakt en live getest op "LED Event": het werkt.
- **Labels wit gemaakt** (`color:#fff;opacity:1`): het thema liet de labeltekst bijna onleesbaar grijs zien op de donkere achtergrond. Deze wijziging is als losse regel aan Max gegeven.
- Gecontroleerd dat de nieuwe categorie niets anders in gang zet: `grovia-automations.php` reageert alleen op bekende slugs in `$school_map`, dus geen Ixly, welkomstmail, WhatsApp of Deelnemers-rij. Max bevestigt dat het puur om het aangeven van speler of keeper gaat.
- Notion: de eerste Notion-connector gaf een 404 op de Coding-pagina; de tweede connector werkt wel. Sessielog en ADR-019 zijn daarmee aangemaakt. De taak-sync is overgeslagen (alle nieuwe items zijn klein en staan als `(lokaal)` in TODO).

### Git wijzigingen

`git diff --stat HEAD~2 HEAD`: 1 bestand, `plugins/hello-elementor-child/functions.php` (+97). Plus deze handoff-commit (HANDOFF, TODO, DECISIONS, DOC-SIGNALS).

### Open items / Next steps

1. **Controleren dat de witte labels live staan** en Berry laten weten: bij een evenement de categorie "Keuze speler/keeper" aanvinken, verder niets.
2. **SVW-testorder plaatsen** — ongewijzigd, zie TODO.
3. **Uncommitted template-sync in `.claude/`** (9 gewijzigd, 4 nieuw) — bewust niet meegenomen in deze commit; beslissen: committen of terugdraaien.
4. Overige items ongewijzigd — zie `## Next Up` in `docs/TODO.md`.

### Belangrijke context die niet mag verdwijnen

- **De speler/keeper-keuze staat alleen op de orderregel** (meta-sleutel "Speler of keeper"), niet in de Deelnemers-sheet. De kolom `rol` in Deelnemers wordt nog steeds uit de categorie afgeleid (bijv. "Keeperstraining"). Gaan evenementen ooit wél door de keten, dan moet `Deelnemers.gs` deze ordermeta gaan lezen.
- **Geen PHP op deze Mac**: `php -l` kan niet; PHP-wijzigingen in het child-theme zijn alleen nagelezen en daarna live door Max getest.
- **Labels in het donkere thema**: losse `<label>`-elementen erven een grijze, doorschijnende stijl. Zet bij nieuwe velden expliciet `color:#fff;opacity:1`.

## 2026-09-30 — Max

**Branch:** `main` · **Commit:** `757110d` (2 commits deze sessie, gepusht — `main` staat gelijk aan `origin/main`) · **Build:** 🟢 `venv/bin/pytest tests/ -q` 144 passed, 0 failed; `node --test tests/gs/*.test.js` 293 passed, 0 failed · **Status:** MVP — Ixly-reminder-bug gevonden en verholpen, SVW-uitrol wacht alleen nog op de testorder

### Wat er deze sessie is gebeurd

- **SVW bevestigd live**: Max heeft `grovia-automations.php` geplakt in de Thema bestand editor en het Config-tabblad D:E aangevuld (`svw27-academie → SVW`). Alleen de testorder staat nog open (zie TODO).
- **Ixly-reminder-bug gevonden en opgelost (ADR-018).** Lev Klaver kreeg op 26-9 een automatische reminder met "Ixly staat nog open" terwijl Ixly's eigen `completed_at` al 24-9 was. Met `superpowers:systematic-debugging` live in de Sheet uitgezocht: geen batch-verhongering (~26 open rijen, ruim onder `ixly_batch_per_run`=50) — de dagelijkse check zag de rij dus wel, maar kreeg een verouderd antwoord van Ixly of miste een deelopvraging; de exacte oorzaak is niet met zekerheid vast te stellen (Application Insights-logs te kortlevend). Vangnet gebouwd: `grovia-herinnering` doet nu vlak vóór een "ixly"-reminder zelf een verse statuscheck (`ixly_api.haal_taken_details`) i.p.v. te vertrouwen op de mogelijk verouderde `ixly_af` uit de Sheet. `bepaal_afronding` en de per-taak-opvraging zijn verplaatst van `ixly-status` naar `grovia_shared/ixly_api.py`, zodat beide Functions exact dezelfde afrondingsdefinitie gebruiken (`ixly-status` behoudt dunne aliassen, bestaande tests ongewijzigd).
- **Geverifieerd dat het geen breder probleem is:** Max heeft "Grovia → Alles nu verversen" gedraaid (`magMailen=false`, dus geen mails) — 0 van de 26 open Ixly-rijen bleek bij een verse check alsnog afgerond. Het Lev Klaver-geval lijkt dus eenmalig, geen sluimerend probleem bij andere kinderen.
- **Git-pushprobleem gevonden en opgelost** (zie context hieronder) — niet code-gerelateerd, maar blokkeerde het pushen van bovenstaande fix.

### Git wijzigingen

`git diff --stat HEAD~2 HEAD`: 7 bestanden, 323 toevoegingen / 109 verwijderingen — `grovia-herinnering/__init__.py`, `grovia_shared/ixly_api.py`, `ixly-status/__init__.py`, `tests/test_grovia_herinnering.py` (+9 tests), `tests/test_ixly_api.py` (nieuw testblok), `docs/DECISIONS.md` (ADR-018), `docs/TODO.md`.

### Open items / Next steps

1. **Testorder SVW plaatsen** op een proeftrainingsproduct en de hele keten verifiëren (WhatsApp met juiste groepslink, geen Ixly-mail, welkomstmail, correcte rij in Deelnemers/Financieel/Dashboard) — zie TODO.
2. **Controleren of de Ixly-reminder-fix live staat** — `757110d` is gepusht, `.github/workflows/deploy.yml` rolt 'm automatisch uit; check de eerstvolgende workflow-run of de Azure-portal.
3. Overige items ongewijzigd — zie `## Next Up` in `docs/TODO.md` (bericht Berry/Jeffry, freddie-rood-rij, maatvelden `functions.php` live zetten). Vier doc-signals deze sessie toegevoegd (nu 6 onverwerkt totaal) — overweeg `/dag-afsluiting`.
4. **(Optioneel, niet urgent)** Uitzoeken waarom de `GreitMax`-SSH-sleutel bij GitHub nu als `maxfinnit` authenticeert i.p.v. `maxgreit` — de working fix (`id_rsa` via host-alias `github-maxgreit`) is voldoende voor nu, maar de onderliggende account/sleutel-koppeling bij GitHub is nooit rechtgezet.

### Belangrijke context die niet mag verdwijnen

- **"Alles nu verversen" (menu Grovia) is veilig voor ad-hoc verificatie**: draait `dagelijkseRun(false)` — ververst Ixly-status/dashboard/financieel, stuurt gegarandeerd geen mail (Stap 4 wordt expliciet overgeslagen bij `magMailen=false`). Handig vervolgens voor elke "is dit structureel of eenmalig"-vraag zonder risico.
- **Een laagresolutie-screenshot of dichtgeklapt menu is geen bewijs** — het "Grovia"-custom-menu laadde niet in de browserpane na een gid-wissel (custom menu's komen van `onOpen`, dat niet altijd opnieuw vuurt); Max moest het zelf in zijn eigen scherm aanklikken. Reken bij een custom Sheets-menu niet op zichtbaarheid in de pane, vraag het de developer te doen.
- **In Google Sheets: het "+"-icoon in de tabbladbalk maakt direct een nieuw leeg tabblad aan, zonder bevestiging.** Per ongeluk gebeurd deze sessie tijdens het zoeken naar het Log-tabblad; meteen weer verwijderd (rechtsklik tabblad → Verwijderen). Gebruik het lijst-icoon (☰) naast de tabbladen om te wisselen, nooit "+".
- **Git-SSH-account-mismatch:** `git@github.com` (en de bestaande `GreitMax`-alias, die naar `id_ed25519_greit` wijst) authenticeert momenteel als GitHub-gebruiker `maxfinnit`, niet `maxgreit` — `git@github.com:maxgreit/grovia.git` gaf daardoor "Permission denied to maxfinnit" bij pushen, ondanks dat dezelfde remote/sleutel eerder deze week wél werkte. Getest met `ssh -T git@github.com` per sleutel: `~/.ssh/id_rsa` (het ongelabelde algemene sleutelpaar) bleek als enige nog als `maxgreit` te authenticeren. Fix: nieuwe host-alias `github-maxgreit` in `~/.ssh/config` (`IdentityFile ~/.ssh/id_rsa`), remote `origin` van dit repo omgezet naar `git@github-maxgreit:maxgreit/grovia.git`. Alleen dit repo's remote is aangepast; andere lokale repo's/aliassen zijn ongemoeid. De root cause (waarom de GreitMax-sleutel nu als maxfinnit resolvet) is niet gevonden — vermoedelijk is de sleutel bij GitHub aan het verkeerde account gekoppeld.

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
