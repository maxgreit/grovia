# TODO — Grovia Automations

> Bron van waarheid voor taken is **Notion** (projecten: Grovia-Coding + Automatisering-Grovia).
> Items met `(lokaal)` staan (nog) niet in Notion — zie onderaan.

## Next Up

- **MiniMove-strippenkaarten (4/6/8 keer) invoeren** `(lokaal)` — plan staat klaar in [2026-08-05-minimove-strippenkaarten.md](superpowers/plans/2026-08-05-minimove-strippenkaarten.md). Kern: de automatisering is al blind voor MiniMove op drie plekken, dus **Spoor 0 (productstructuur in WooCommerce) is nul regels code**. Neem eerst de drie blokkerende beslissingen (B1 variantstructuur, B2 prijsstaffel, B3 vervallen de strippen) — vooral B1 is achteraf duur om te herzien. Spoor 2 (`Strippen`-tabblad voor het afstrepen) is voorgeverifieerd: 111 tests groen.
- **`Financieel`-rapport gebruikt in juni/juli het verkeerde seizoen** — [Dagelijks.gs:168](../google-apps-script/deelnemers/Dagelijks.gs:168) voedt `berekenFinancieel()` met `bepaalSeizoen(vandaag)` (1-augustusgrens), terwijl het rapport de 1-junigrens aanhoudt. Op 2026-06-15 staat het rapport dus op seizoen 2526 én vallen de nieuwe juniorders buiten het venster — precies de orders waarvoor ADR-009 die grens bedacht. Nu niet actief (augustus), bijt weer in juni 2027. Fix (`bepaalFinancieelSeizoen`, vier regels + tests) staat uitgewerkt als Bijlage A + Task 9 van het strippenkaartplan.
- **Eerste automatische reminder-run controleren (vanaf 2026-08-05, 07:00)** `(lokaal)` — de trigger staat sinds 2026-08-04 aan. Verwacht patroon in het Log-tabblad: **2026-08-06** de nieuwe 2627-rijen (drempel 3 vanaf hun uitnodiging), **2026-08-07** de backlog (drempel 7 vanaf anker 2026-07-31). Gaat het eerder of massaler, dan is `reminder_anker` niet goed doorgekomen — dan direct de trigger pauzeren.
- **`order_ids`-Nederlandse-getalnotatie-bug fixen** — root cause gevonden: [Sheet.gs:92](../google-apps-script/deelnemers/Sheet.gs:92) schrijft de array weg met `waarde.join(',')` als onopgemaakte celwaarde, dus wordt `"935,1147"` door Sheets met een Nederlandse locale als getal geïnterpreteerd; bij teruglezen splitst [Sheet.gs:56](../google-apps-script/deelnemers/Sheet.gs:56) op komma en houdt één id over in plaats van twee. Fix: kolomformaat op tekst (`@`) zetten bij het schrijven. Nog open: of de al beschadigde `freddie-rood`-rij te repareren is of dat die order-id's handmatig terug moeten.
- **Uitnodigingsmail-template naar één startknop** — de twee aparte gameknoppen zijn overbodig (besloten 2026-08-04); één "Start hier"-knop met uitleg dat beide games daarna vanuit de Ixly-omgeving zelf te starten zijn. Wijziging in `grovia_mail.py` + deploy.
- **Berry als vaste adviseur op Ixly-kandidaten** — [ixly-aanmelding/__init__.py:156](../ixly-aanmelding/__init__.py:156) stuurt bij het aanmaken van een candidate geen `user_uuid` mee, waardoor Ixly zelf een adviseur toewijst (lijkt willekeurig). Fix: `user_uuid` uit een env var meesturen. **Geblokkeerd:** er is geen publiek endpoint om gebruikers op te zoeken, dus Berry's `user_uuid` moet uit Ixly komen (URL van zijn gebruikerspagina of via support). Bij implementatie: de env var óók in `deploy.yml` zetten, anders komt de secret nooit in Azure aan.
- **WhatsApp Business-account kan niet aan de groep worden toegevoegd** `(lokaal)` — géén codeprobleem: onze code verstuurt alleen een bericht met een groepsuitnodigingslink en bepaalt niets over wie mag joinen. Dit is gedrag van WhatsApp zelf of een groepsinstelling ("wie kan deelnemen"). Uitzetten bij Berry / de groepsbeheerder.
- **Overwegen: afzenderadres/-naam van de mail aanpassen** `(lokaal)` — staat nu op `noreply@grovia.nl` (kaal adres, geen weergavenaam). Voor bewust geparkeerd. Een ander adres vereist een nieuwe mailbox in DirectAdmin + drie GitHub Secrets (`SMTP_GEBRUIKER`/`SMTP_WACHTWOORD`/`SMTP_AFZENDER`) + deploy, want `SMTP_AFZENDER` is óók de envelope-sender. Alleen een nettere weergavenaam (`Grovia <noreply@grovia.nl>`) is één regel in `grovia_mail.py`.

1. **Action Type test-mail conditioneel versturen** — uitnodigingsmail moet NIET naar iedereen; voorwaarde-logica toevoegen aan de Grovia PHP-code (tag-logica) zodat alleen de juiste klanten de mail krijgen. Forms + sheets + scoring + mailtemplates zijn klaar (zie [ACTION-TYPE-TEST.md](ACTION-TYPE-TEST.md))
2. **FunnelKit automation inrichten** `(lokaal)` — één automation met decision tree, trigger op `WA_KA_VT`, `WA_KA_KT`, `WA_SU_VT`, `WA_SU_KT`, `WA_MM_VT`; per branch: remove trigger tag → conditie geen WAGroep-tag → HTTP Request Azure Function → add WAGroep-tag
3. **Database opzetten voor opslag testgegevens (Ixly brondata)** — Notion, prioriteit High
4. **Fysio-toestemming afronden** `(lokaal)` — (1) **WP-pagina `/toestemming-fysieke-intakes/` publiceren** met de inhoud uit [infopagina.html](../plugins/grovia-fysio-toestemming/infopagina.html) (links staan al live en geven nu 404), (2) **plugin v1.1.0 uploaden naar WordPress** — de vinkje-tekst is gelijkgetrokken met de toestemmingsverklaring; zolang dit niet gedeployed is staat de oude formulering nog live, (3) testorder met 100%-kortingscode om order-meta in admin te verifiëren (daarna order + code verwijderen), (4) categorie `toestemming-vereist` aan overige trainingen hangen (nu alleen Zomerspektakel Kolping)
5. **Adres van SMC Dijk en Waard verifiëren** `(lokaal)` — de verklaring vermeldt "Helena Nordheimland 3, 1705 LM Heerhugowaard"; die straatnaam ziet er uit als een typo (Nordheimlaan?). Staat nu letterlijk zo op de infopagina — checken bij Berry/SMC voor publicatie, een fout adres op een live pagina is vervelend

## Later — Datawarehouse & teamindeling (Notion)

- [ ] Database inrichting
- [ ] Azure Portal
- [ ] PowerBI Licenties
- [ ] Geautomatiseerde teamindeling opzetten `(geblokkeerd: wacht op de eerste analyseerbare Ixly-respons — zonder echte scoredata is er niets om op in te delen)`
- [ ] Ixly score-response verifiëren voor Blocks Game en Rally Game via `explore.py` — voorwaarde voor de teamindeling hierboven
- [ ] Automatische teamranking opzetten (kids op volgorde van score, beste → minst goed) o.b.v. Ixly-data
- [ ] Google Sheet per vereniging aanmaken met vier tabbladen: jong voetbal, oud voetbal, jong keeper, oud keeper
- [ ] Script/trigger bouwen op Google Sheet die bij nieuwe rij Rubens-formule uitvoert en resultaat opslaat
- [ ] Google Sheet inrichten met tabblad ruwe antwoorden én tabblad met naam, ID, testuitslag en gekoppeld spelerprofiel
- [ ] Google Form aanmaken op basis van vragen/antwoorden persoonlijkheidstest
- [ ] E-mailreminder loop opzetten voor openstaande testen, met cap ~2–3 maanden
- [ ] Canva-koppeling: dynamische informatie automatisch vullen
- [ ] Voorstel maken omtrent automatisering

## Done

- [x] Alle tijdelijke eenmalige functies uit `Dagelijks.gs` verwijderd — `backfillOudereOrders`, `backfillDiagnose`, `herstelVerlorenReminderVan20260803`, `vulRolProductBedragVoorBestaandeRijen`, `zetOudeRijenOpNieuwSchema`, `debugInschrijvingMeta`. Bestand van 536 naar 206 regels; op te halen uit de git-historie als er ooit één terug moet (2026-08-04, Max)
- [x] `backfillDiagnose()` gesloten zonder te draaien — de "120 orders → 0 nieuwe rijen"-uitkomst wordt niet verder onderzocht; bewuste keuze van Max, niet omdat het verklaard is (2026-08-04, Max)
- [x] Legacy-kandidaten (~30) eenmalig uitgenodigd voor de games via Ixly (2026-08-04, Max)
- [x] Kort klantbericht naar Grovia gestuurd over de eenmalige legacy-uitnodiging (2026-08-04, Max)
- [x] Toestemmingsverklaring (Grovia + SMC Dijk en Waard) verwerkt tot publicatieklare infopagina en de vinkje-tekst op de checkout gelijkgetrokken met de letterlijk voorgeschreven formulering uit die verklaring — plugin v1.1.0. Publiceren in WP en uploaden van de plugin staat nog open, zie Next Up #4 (2026-08-04, Max)
- [x] Klantvragen fysio-toestemming beantwoord — documentinhoud, gegevensdeling en pop-uptekst via de toestemmingsverklaring; intrekken gaat via `b.moolenaar@grovia.nl` met als gevolg geen deelname aan de volgende testronde voor zover het blessurepreventie betreft; SMC heeft een eigen privacyverklaring waar de infopagina nu naar linkt (2026-08-04, Max)
- [x] Automatische reminders live gezet — `installeerTrigger` gedraaid (dagelijks 07:00), ritme naar 3/7/14/21/35/49, backlog via de nieuwe `reminder_anker`-kolom op anker 2026-07-31 + teller 1 gezet zodat de handmatige reminder van 08-03 als #1 geldt. Zie ADR-010 (2026-08-04, Max)
- [x] Financieel-tabblad gebouwd en werkend — afdracht per vereniging × cyclus, keepers/spelers apart via cyclusproduct dan wel seizoenkaart, omzet incl./excl. 9% btw, €20 per deelnemer. Rekent op orderregelniveau met eigen seizoensgrens 1 juni; cyclus komt uit `pa_inschrijving` via `mapping.fases`. Ververst automatisch mee als Stap 6 van de dagelijkse run. Zie ADR-009 (2026-08-04, Max)
- [x] Kolommen `rol` (Speler/Keeper), `product` en `bedrag` toegevoegd aan het Deelnemers-tabblad, inclusief eenmalige backfill voor de bestaande rijen (2026-08-04, Max)
- [x] Race condition tussen de dagelijkse run en handmatige menu-acties gedicht met `LockService` — oorzaak van 27 reminders die wél in het Log stonden maar niet in de Deelnemers-sheet; verloren velden hersteld (2026-08-04, Max)
- [x] Oneindige-lus-bug in de reminderlogica gedicht — een rij met Action Type af, Ixly niet af én zonder `ixly_taken` kwam elke dag als kansloze mislukte poging terug (2026-08-04, Max)
- [x] Controleren of de dagelijkse Apps Script-trigger actief staat — gedraaid en bevestigd op 07:00 (2026-08-04, Max)
- [x] Apps Script gekoppeld aan een eigen GCP-project (`grovia-504418`) zodat externe testgebruikers (klant) het script mogen uitvoeren (2026-08-04, Max)
- [x] Action Type-controlecode-koppeling gefixt — `ACTION_TYPE_ENTRY_*`-env vars ontbraken volledig in `deploy.yml` (root cause van élke inzending in "Handmatig koppelen"); toegevoegd + geverifieerd in Azure. Kolomindex in `ActionType.gs` definitief bevestigd op 23 tegen de opgeschoonde KA/SU-antwoordsheets (2026-08-02, Max)
- [x] Ixly-passwordless-loginlink-mysterie afgesloten — geen bug: met een nieuw, nooit gebruikt testadres werkt de link gewoon; de eerdere "niet meer geldig"-melding kwam doordat het testadres al een bestaand Ixly-account had (2026-08-02, Max)

> 13 oudere Done-items getrimd op 2026-08-04; volledige historie staat in git.
