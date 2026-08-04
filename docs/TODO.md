# TODO — Grovia Automations

> Bron van waarheid voor taken is **Notion** (projecten: Grovia-Coding + Automatisering-Grovia).
> Items met `(lokaal)` staan (nog) niet in Notion — zie onderaan.

## Next Up

- **Eerste automatische reminder-run controleren (vanaf 2026-08-05, 07:00)** `(lokaal)` — de trigger staat sinds 2026-08-04 aan. Verwacht patroon in het Log-tabblad: **2026-08-06** de nieuwe 2627-rijen (drempel 3 vanaf hun uitnodiging), **2026-08-07** de backlog (drempel 7 vanaf anker 2026-07-31). Gaat het eerder of massaler, dan is `reminder_anker` niet goed doorgekomen — dan direct de trigger pauzeren.
- **`backfillDiagnose()` draaien in de Apps Script-editor en resultaat beoordelen** `(lokaal)` — de eerste `backfillOudereOrders()`-run leverde 120 opgehaalde orders maar 0 nieuwe deelnemersrijen op. `backfillDiagnose()` (read-only, in `Dagelijks.gs`) telt exact hoeveel orders zijn overgeslagen via `mapping.uitgesloten`, hoeveel MiniMove waren, en hoeveel matchten met een al bestaand kind — bepaalt of dit resultaat klopt of nader onderzoek nodig heeft.
- **Legacy-kandidaten (~30) eenmalig uitnodigen voor de games** `(lokaal)` — deze kandidaten (van vóór de Ixly-assignment-uuid-fix, 2026-08-01) kunnen niet met terugwerkende kracht bijgewerkt worden. Eenmalige handmatige route: in Ixly alle betrokken kandidaten selecteren → "Uitnodiging games"-template → bulk versturen. Action Type-herinneringen hoeven niet apart geregeld te worden, die lopen al automatisch door.
- **Kort klantbericht naar Grovia sturen** `(lokaal)` over de eenmalige legacy-uitnodiging hierboven — concepttekst is al opgesteld, nog te versturen of aan te passen.
- **Tijdelijke eenmalige functies opruimen uit `Dagelijks.gs`** `(lokaal)` — `backfillOudereOrders`, `backfillDiagnose`, `herstelVerlorenReminderVan20260803`, `vulRolProductBedragVoorBestaandeRijen`, `zetOudeRijenOpNieuwSchema`, `debugInschrijvingMeta`. Allemaal al gedraaid of afgehandeld; onschadelijk om te laten staan, maar het bestand wordt er lang van.
- **Overwegen: uitnodigingsmail-template aanpassen** — één "Start hier"-knop i.p.v. twee aparte gameknoppen, met uitleg dat beide games daarna vanuit de omgeving zelf te starten zijn. Kosmetisch, niet urgent.
- **`order_ids`-Nederlandse-getalnotatie-bug onderzoeken** — Google Sheets zet een komma-gescheiden getal-achtige string (bv. `"935,1147"`) soms om naar Nederlandse getalnotatie (`"9.351.147"`), gezien in de freddie-rood-rij. Zelfde klasse bug als de al-gefixte datum- en seizoen-coercion-bugs, maar dan voor `order_ids`.
- **Overwegen: afzenderadres/-naam van de mail aanpassen** `(lokaal)` — staat nu op `noreply@grovia.nl` (kaal adres, geen weergavenaam). Voor bewust geparkeerd. Een ander adres vereist een nieuwe mailbox in DirectAdmin + drie GitHub Secrets (`SMTP_GEBRUIKER`/`SMTP_WACHTWOORD`/`SMTP_AFZENDER`) + deploy, want `SMTP_AFZENDER` is óók de envelope-sender. Alleen een nettere weergavenaam (`Grovia <noreply@grovia.nl>`) is één regel in `grovia_mail.py`.

1. **Action Type test-mail conditioneel versturen** — uitnodigingsmail moet NIET naar iedereen; voorwaarde-logica toevoegen aan de Grovia PHP-code (tag-logica) zodat alleen de juiste klanten de mail krijgen. Forms + sheets + scoring + mailtemplates zijn klaar (zie [ACTION-TYPE-TEST.md](ACTION-TYPE-TEST.md))
2. **FunnelKit automation inrichten** `(lokaal)` — één automation met decision tree, trigger op `WA_KA_VT`, `WA_KA_KT`, `WA_SU_VT`, `WA_SU_KT`, `WA_MM_VT`; per branch: remove trigger tag → conditie geen WAGroep-tag → HTTP Request Azure Function → add WAGroep-tag
3. **Database opzetten voor opslag testgegevens (Ixly brondata)** — Notion, prioriteit High
4. **Fysio-toestemming afronden** `(lokaal)` — (1) testorder met 100%-kortingscode om order-meta in admin te verifiëren (daarna order + code verwijderen), (2) WP-pagina `/toestemming-fysieke-intakes/` publiceren zodra klantteksten binnen zijn — links staan al live en geven nu 404 (concept: [infopagina-concept.md](../plugins/grovia-fysio-toestemming/infopagina-concept.md)), (3) categorie `toestemming-vereist` aan overige trainingen hangen (nu alleen Zomerspektakel Kolping)
5. **Klantvragen fysio-toestemming uitzetten bij Berry** `(lokaal)` — documentinhoud, intrekprocedure, privacyverklaring (pop-uptekst ✓ en gegevensdeling ✓ zijn al beantwoord; zie spec §Open vragen)

## Later — Datawarehouse & teamindeling (Notion)

- [ ] Database inrichting
- [ ] Azure Portal
- [ ] PowerBI Licenties
- [ ] Geautomatiseerde teamindeling opzetten
- [ ] Automatische teamranking opzetten (kids op volgorde van score, beste → minst goed) o.b.v. Ixly-data
- [ ] Google Sheet per vereniging aanmaken met vier tabbladen: jong voetbal, oud voetbal, jong keeper, oud keeper
- [ ] Script/trigger bouwen op Google Sheet die bij nieuwe rij Rubens-formule uitvoert en resultaat opslaat
- [ ] Google Sheet inrichten met tabblad ruwe antwoorden én tabblad met naam, ID, testuitslag en gekoppeld spelerprofiel
- [ ] Google Form aanmaken op basis van vragen/antwoorden persoonlijkheidstest
- [ ] E-mailreminder loop opzetten voor openstaande testen, met cap ~2–3 maanden
- [ ] Canva-koppeling: dynamische informatie automatisch vullen
- [ ] Voorstel maken omtrent automatisering

## Done

- [x] Automatische reminders live gezet — `installeerTrigger` gedraaid (dagelijks 07:00), ritme naar 3/7/14/21/35/49, backlog via de nieuwe `reminder_anker`-kolom op anker 2026-07-31 + teller 1 gezet zodat de handmatige reminder van 08-03 als #1 geldt. Zie ADR-010 (2026-08-04, Max)
- [x] Financieel-tabblad gebouwd en werkend — afdracht per vereniging × cyclus, keepers/spelers apart via cyclusproduct dan wel seizoenkaart, omzet incl./excl. 9% btw, €20 per deelnemer. Rekent op orderregelniveau met eigen seizoensgrens 1 juni; cyclus komt uit `pa_inschrijving` via `mapping.fases`. Ververst automatisch mee als Stap 6 van de dagelijkse run. Zie ADR-009 (2026-08-04, Max)
- [x] Kolommen `rol` (Speler/Keeper), `product` en `bedrag` toegevoegd aan het Deelnemers-tabblad, inclusief eenmalige backfill voor de bestaande rijen (2026-08-04, Max)
- [x] Race condition tussen de dagelijkse run en handmatige menu-acties gedicht met `LockService` — oorzaak van 27 reminders die wél in het Log stonden maar niet in de Deelnemers-sheet; verloren velden hersteld (2026-08-04, Max)
- [x] Oneindige-lus-bug in de reminderlogica gedicht — een rij met Action Type af, Ixly niet af én zonder `ixly_taken` kwam elke dag als kansloze mislukte poging terug (2026-08-04, Max)
- [x] Controleren of de dagelijkse Apps Script-trigger actief staat — gedraaid en bevestigd op 07:00 (2026-08-04, Max)
- [x] Apps Script gekoppeld aan een eigen GCP-project (`grovia-504418`) zodat externe testgebruikers (klant) het script mogen uitvoeren (2026-08-04, Max)
- [x] Action Type-controlecode-koppeling gefixt — `ACTION_TYPE_ENTRY_*`-env vars ontbraken volledig in `deploy.yml` (root cause van élke inzending in "Handmatig koppelen"); toegevoegd + geverifieerd in Azure. Kolomindex in `ActionType.gs` definitief bevestigd op 23 tegen de opgeschoonde KA/SU-antwoordsheets (2026-08-02, Max)
- [x] Ixly-passwordless-loginlink-mysterie afgesloten — geen bug: met een nieuw, nooit gebruikt testadres werkt de link gewoon; de eerdere "niet meer geldig"-melding kwam doordat het testadres al een bestaand Ixly-account had (2026-08-02, Max)
- [x] Ixly-assignment-uuid-fix gemerged, gedeployed en einde-tot-einde bevestigd werkend — `ixly-aanmelding` bewaart assignment-uuid's als WooCommerce order-meta, `ixly-status`/`grovia-herinnering` lezen ze terug via `GET /assignments/{uuid}`. Onderweg twee losse productieproblemen gevonden en opgelost: WooCommerce-sleutel had alleen leesrechten (401), en een server-side WAF blokkeerde de standaard `python-requests`-User-Agent (403) — beide opgelost, zie ADR-008 (2026-08-02, Max)
- [x] Funnelkit flow voor Google Form — vervangen door inzicht: voorwaarde-logica hoort in de Grovia PHP-code (tag-logica), zie Next Up #1 (2026-06-23, Max — via Notion-sync)
- [x] Fysio-toestemming plugin gebouwd, gedeployed en live geverifieerd — vinkje via opt-in categorie `toestemming-vereist`, pop-up in sitethema met klanttekst, order-meta + admin-weergave, AJAX-refresh-bugfix (2026-07-28, Max)
- [x] Action Type test opgezet — 2 Google Forms (KA + SU) + gekoppelde sheets via Apps Script, scoring via ARRAYFORMULA in apart "Resultaten"-tabblad, 2 uitnodigingsmails (zie [ACTION-TYPE-TEST.md](ACTION-TYPE-TEST.md)) (2026-06-23, Max)
- [x] Debug-mail uitgezet in productie — `wp_mail` → `error_log` in beide plugins; `GROVIA_DEBUG_EMAIL` define verwijderd (2026-06-23, Max) ⚠️ deploy naar WP nodig
- [x] FunnelKit contact phone-sync gecontroleerd — billing_phone field mapping OK (2026-06-23, Max)
- [x] Test-contact "Max Test" opgeruimd — oude `Assessment2526` tag verwijderd (2026-06-23, Max)
- [x] Groepslinks ophalen bij Berry (Kolping Academie + Schagen United) (2026-06-23, Max — via Notion-sync)
- [x] WhatsApp berichtlevering bevestigd werkend — bericht komt aan op telefoon (2026-06-15)
- [x] order_id KeyError gefixed in logging — body.get() ipv body[] (2026-06-15)
- [x] MiniMove voetbaltraining categorie toegevoegd aan MiniMove-product in WP (2026-06-15)
- [x] FunnelKit flow + tagging uitgedacht — WA_ trigger tags + WAGroep_ guard tags via grovia-automations.php (2026-06-12)
- [x] WAGroep guard-tags retroactief ingesteld voor bestaande klanten via migratiescript (2026-06-12)
