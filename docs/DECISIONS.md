# Architectuurbeslissingen — Grovia Automations

Beslissingen worden vastgelegd als ADR's (Architecture Decision Records).

## Formaat

```
## ADR-001: [Titel]
**Datum:** YYYY-MM-DD
**Status:** Voorgesteld / Geaccepteerd / Vervallen

**Context:** Waarom moest er een beslissing genomen worden?
**Beslissing:** Wat is er besloten?
**Gevolgen:** Wat zijn de trade-offs en consequenties?
```

---

## ADR-015: Seizoenskolom in "Ixly Scores" en bedrag_correctie in Deelnemers
**Datum:** 2026-08-22
**Status:** Geaccepteerd

**Context:**
Twee losse constateringen met dezelfde wortel — een sheet die stilzwijgend als sleutelloos of als niet-bron behandeld werd:
1. "Ixly Scores" sleutelde alleen op `naam_slug`. Bij de seizoenswissel (1 mei 2027) zou een terugkerend kind nooit opnieuw bevraagd worden (`kiesTeOphalenIndexen` ziet "heeft al een score") en zou de indeling op de meting van vorig jaar draaien.
2. Het Financieel-rapport leest elke run verse orderregels uit WooCommerce; een handmatig gecorrigeerd bedrag in Deelnemers deed niets ("WooCommerce is niet altijd de waarheid" — Max, 2026-08-22).

**Beslissing:**
- **"Ixly Scores" krijgt een `seizoen`-kolom (vooraan); de sleutel wordt `seizoen|naam_slug`** in `kiesTeOphalenIndexen`, `voegScoresSamen` en `bouwSegmenten`. Het seizoen van een deelnemersrij komt uit het gedeelde `teamSeizoenVanDeelnemer()` (1-meigrens op `uitgenodigd_op`, fallback op het opgeslagen veld) zodat ophalen en indelen nooit uit de pas lopen. Een scorerij zónder seizoen matcht bewust nergens mee. Oude rijen blijven staan als historie; eenmalige migratie `migreerIxlyScoresSeizoen()` stempelt ze met `2627`.
- **Deelnemers krijgt een handmatige kolom `bedrag_correctie` (direct na `bedrag`).** Leeg = WooCommerce telt. Gevuld = het getal is het seizoenstotaal van dat kind; `berekenFinancieel` verdeelt het naar rato van de WooCommerce-bedragen over zijn meetellende orderregels (gelijk verdeeld als die omzet nul is, zoals bij een 100%-kortingscode). `0` is een expliciete correctie naar nul; witruimte of tekst wordt genegeerd. Alleen deelnemersrijen binnen het financiële seizoensvenster (1 juni) tellen, anders zou de rij van vorig seizoen de orders van dit seizoen overrulen. De code schrijft deze kolom nooit.

**Alternatieven overwogen:**
- *Deelnemers-sleutel uitbreiden naar `seizoen|kind|cyclus` en Financieel op Deelnemers laten rekenen* — verworpen: reminders, Ixly-flow, dashboard en teamindeling nemen allemaal één rij per kind per seizoen aan; meerdere rijen per kind zou dubbele reminders en dubbele indeling geven.
- *Correcties op orderregelniveau in een Config-blok (order_id → bedrag)* — verworpen ten gunste van de Deelnemers-kolom: Max corrigeert per kind, niet per orderregel, en de kolom staat naast het automatische `bedrag` ter vergelijking.
- *De bestaande `bedrag`-kolom leidend maken* — verworpen: dan is "handmatig gewijzigd" niet te onderscheiden van "eerste-orderbedrag", en die kolom bevat maar één van mogelijk meerdere orders.

**Gevolgen:**
- Twee handmatige kolommen invoegen in het werkboek (zie TODO), .gs-bestanden opnieuw plakken, migratie één keer draaien.
- Volgend seizoen is er géén handwerk: nieuwe orders → nieuwe Deelnemers-rij → nieuwe Ixly-uitnodiging → nieuwe scorerij met het nieuwe seizoen → verse indeling.
- Handmatige scorerijen van legacy-kinderen gelden alleen voor 2627; speelt zo'n kind volgend seizoen opnieuw, dan wordt het gewoon via de API bevraagd.

**Addendum (2026-08-22) — eigen groepsnamenlijst per segment:**
Kolom 4 van het `AG:AJ`-blok accepteert naast een aantal (getal: de sterkste N namen uit de globale `AE`-lijst, zoals voorheen) nu ook een komma-gescheiden namenlijst, sterk → zwak, met vrije labels: `C3,C2a,C2b,C1` geeft vier groepen, `C2,C1` twee groepen zonder C3-niveau. Een lijst negeert de globale `AE`-lijst volledig; de "meer groepen dan namen"-waarschuwing geldt alleen voor de getal-variant. Wil je twee teams op hetzelfde niveau, geef ze onderscheidende labels (keuze van Max, optie B): identieke labels smelten in het Teamindeling-overzicht samen tot één blok. Bestaande Config met getallen blijft ongewijzigd werken.

**Addendum (2026-08-22) — totaalscore in het Teamindeling-tabblad en leeftijdsgrens per academie:**
Het tabblad "Teamindeling" toont de gewogen totaalscore als derde kolom naast naam en groep, zodat de trainer bij het schuiven ziet hoe dicht kinderen bij elkaar zitten. En de geboortejaargrens is per academie instelbaar via een nieuw Config-blok `AO2:AQ5` (vereniging | rol | geboortejaar) — een override met fallback op de globale grens per rol in `AB:AC`; een leeg blok verandert niets. Bewust een nieuw bereik en geen kolom invoegen in het bestaande blok: dat zou alle Config-bereiken rechts ervan verschuiven.

---

## ADR-014: Teamindeling — instelbare wegingen, ongewogen leveltellingen, gescheiden voorstel/definitief, apart "Zonder indeling"-tabblad
**Datum:** 2026-08-18
**Status:** Geaccepteerd

**Context:**
De geautomatiseerde teamindeling (zie [design-spec](superpowers/specs/2026-08-18-teamindeling-ixly-scores-design.md)) rekent een gewogen totaalscore uit negen genormeerde Ixly-schalen (2 Blocks, 7 Rally) en deelt daarmee kinderen in groepen in. Vier deelbeslissingen waren nodig over hoe die score tot stand komt en hoe de uitkomst zich verhoudt tot het handwerk van de trainer.

**Beslissing:**
- **De wegingen per schaal staan in Config, niet in code.** Rally levert zeven genormeerde schalen en Blocks maar twee; een ongewogen gemiddelde van alle negen zou Rally daarmee ~78% van de totaalscore laten bepalen, puur als gevolg van hoeveel schalen elke game toevallig heeft — geen inhoudelijke keuze. De klant ("Ruben's formule") heeft bovendien nog geen definitieve formule vastgesteld; de huidige wegingen (1 voor elk van de negen genormeerde schalen) zijn een instelbare, expliciet voorlopige placeholder totdat die formule rond is. Config aanpassen is dan genoeg, geen deploy.
- **De ruwe leveltellingen (`levels_voltooid`, `levels_perfect`) worden getoond maar met gewicht 0 niet meegewogen.** Ze staan niet op de 1-10-schaal van de negen genormeerde `latent`-schalen — aantallen en een genormeerde schaal meemiddelen zou de totaalscore vertekenen zonder dat er een omrekening naar diezelfde schaal bestaat.
- **`voorgestelde_groep` en `definitieve_groep` zijn twee gescheiden kolommen.** De trainer mag de automatische indeling overrulen, en die keuze moet een dagelijkse herberekening overleven — `Teams.gs` leest `definitieve_groep` daarom eerst per `naam_slug` in en zet die na de herberekening terug, matchend op naam, nooit op rijnummer. Zonder deze scheiding zou elke run de trainer stil overschrijven.
- **De teamindeling gaat uitsluitend over het HUIDIGE seizoen, bepaald met de 1-MEIgrens (`bepaalTeamSeizoen()` in `Teams.gs`).** `Deelnemers` is gesleuteld op `seizoen|naam_slug` (één rij per kind per seizoen), terwijl "Ixly Scores" alleen op `naam_slug` sleutelt; zonder seizoensfilter kwam hetzelfde kind twee keer in één segment, werden kinderen van vorig seizoen mee ingedeeld en groeide "Zonder indeling" uit tot een historische ledenlijst van minderjarigen die met trainers gedeeld wordt. Het seizoen van een rij wordt afgeleid uit `uitgenodigd_op`, **niet** uit het opgeslagen `seizoen`-veld: dat veld is door `upsertDeelnemers` met `bepaalSeizoen()` op de orderdatum gestempeld (1 augustus), waardoor een inschrijving van juni/juli het vórige seizoenslabel draagt — precies de lichting die dit seizoen traint. Eerst stond hier de 1-augustusgrens; dat bleek de huidige lichting uit te sluiten en is op 2026-08-18 door Max gecorrigeerd naar 1 mei, de seizoensomslag die Grovia zelf hanteert. `bouwSegmenten()` eist het seizoen als verplicht argument, en kinderen die afvallen worden per seizoen geteld en in het runlog gemeld in plaats van stil weggelaten.
- **Kinderen zonder volledige scoreset (alle negen schalen) of zonder `geboortedatum_kind` belanden in een apart tabblad "Zonder indeling"**, met de reden erbij, in plaats van stil weggefilterd te worden. Een onvolledige set is niet eerlijk vergelijkbaar met een volledige, dus meedoen aan de ranking zou een vertekend beeld geven — maar stil verdwijnen is precies het patroon dat bij de eerdere backfill ("120 orders → 0 rijen") nooit verklaard raakte, en dat risico wilden we hier niet herhalen.

**Alternatieven overwogen:**
- *Vaste wegingen in code* — verworpen: de formule van de klant staat nog niet vast en zal naar verwachting nog wijzigen; een Config-wijziging is dan het juiste niveau, geen codewijziging en deploy.
- *Leveltellingen omrekenen naar een 1-10-schaal en meewegen* — verworpen (nog): er is geen vastgestelde normering voor die omrekening; ze worden voorlopig alleen getoond.
- *Eén kolom voor de groep, direct overschreven door de trainer* — verworpen: een dagelijkse herberekening zou dan elke handmatige correctie stilzwijgend wissen.
- *Onvolledige rijen gewoon overslaan (niet tonen)* — verworpen: dezelfde valkuil als de backfill die nooit verklaard raakte; "Zonder indeling" maakt zichtbaar wie er ontbreekt en waarom.
- *Geen seizoensfilter, of filteren op het opgeslagen `seizoen`-veld* — allebei verworpen: geen filter levert dubbele rijen en een ledenlijst van oud-deelnemers op, en het opgeslagen veld draagt de 1-augustusstempel van de orderdatum, waardoor de juni/juli-inschrijvingen van het lopende seizoen stil buiten de indeling vielen.

**Gevolgen:**
- Vier nieuwe Config-blokken (wegingen, geboortejaargrens per rol, aantal groepen + groepsnamen per segment, werkboek-ID per vereniging) moeten bij livegang handmatig gevuld worden — zie de uitrolstap in `docs/TODO.md`.
- Zodra Ruben's formule vaststaat, is het bijstellen van de Config-wegingen de enige wijziging die nodig is; er hoeft geen code aangepast te worden.
- De groepsnamen in Config staan in volgorde van sterk naar zwak; die volgorde moet bevestigd zijn vóór livegang (open vraag 2 in de design-spec) — een verkeerde volgorde zou de sterkste kinderen in de zwakste groep zetten.

---

## ADR-013: Ixly-statuscontrole probeert alle adviseur-tokens i.p.v. de eerste
**Datum:** 2026-08-12
**Status:** Geaccepteerd

**Context:**
De Ixly-terugkoppeling (`ixly-status`) bleek onbetrouwbaar: sommige kinderen die hun games echt hadden afgerond, bleven in de Sheet op `ixly_af = NEE` staan. Root cause #1 was een aparte statuswaarde-bug (`'completed'` i.p.v. het werkelijke `'finished'`, zie de fix in `ixly-status/__init__.py`). Na die fix bleef een deel van de kinderen ONVERKLAARBAAR wisselend wél/niet oplosbaar — dezelfde `assignment_uuid` gaf de ene keer 200, de andere keer 404 op `GET /candidate_tasks/{uuid}`. Live onderzoek (`managed_organizations/{uuid}`) toonde: de Ixly-organisatie heeft vier `api_user`-adviseurs (Max Rood, Berry Moolenaar, Jeffry Moolenaar, Ruben Mogge), elk met een eigen `access_grant`/token. Een `candidate_task` is alleen zichtbaar voor de adviseur die de betreffende kandidaat "bezit" — met andere adviseur-tokens getest, gaf exact dezelfde taak 404 bij drie van de vier en 200 bij precies één. `haal_token()` (`grovia_shared/ixly_api.py`) pakte altijd de EERSTE `api_user` uit de `included[]`-lijst, en die volgorde is niet gegarandeerd — elke run zag dus een willekeurige deelverzameling kandidaten, de rest leek stil "niet af". Dit verklaarde ook waarom een eerdere aanname ("404 = verouderde/verdwenen referentie", doorgevoerd als Controleren-melding in commit `bc7027e`) fout was: dezelfde referentie loste een moment later gewoon weer op met een ander token. Die aanpak is teruggedraaid (`2f9618d`).

**Beslissing:**
- `haal_taak_status()` probeert bij een 404 op `candidate_task` **alle vier de adviseur-tokens**, niet alleen het eerste, tot de taak oplost of alle tokens uitgeput zijn. Assignments zelf zijn org-breed zichtbaar (200 bij elk token, geverifieerd) — alleen `candidate_tasks` zijn adviseur-gebonden, dus de fix raakt alleen dat ene endpoint.
- Geen poging om de loterij bij de bron te repareren voor bestaande kandidaten: een candidate blijft bij de adviseur die Ixly er destijds toevallig aan toewees. Zie het losse, nog niet geïmplementeerde "Berry als vaste adviseur"-item (`docs/TODO.md`) voor het structureel voorkomen van nieuwe loterij-gevallen (via `user_uuid` meesturen bij het aanmaken van een candidate) — dat lost dit alleen voor NIEUWE kandidaten op, deze ADR blijft dus ook daarna nodig voor de bestaande ~35 rijen.

**Alternatieven overwogen:**
- *Eén vast token afdwingen voor alle bestaande kandidaten* (bijv. altijd Berry's token gebruiken) — verworpen: kandidaten zijn al verspreid aangemaakt onder vier verschillende adviseurs, een vast token zou de meerderheid van de bestaande rijen juist onoplosbaar maken in plaats van juist op te lossen.
- *Alleen Berry als vaste adviseur instellen bij het aanmaken van nieuwe candidates* (de "Berry als vaste adviseur"-fix) zonder de bestaande loterij op te lossen — onvoldoende als enige maatregel: lost niets op voor de ~35 al bestaande kandidaten, die de kern van het huidige betrouwbaarheidsprobleem vormen.

**Gevolgen:**
- Elke Ixly-taakstatuscontrole kan nu tot 4x zoveel HTTP-calls doen per taak (in het slechtste geval, als de eerste drie tokens allemaal 404 geven) — geen probleem gebleken bij de huidige volumes, wel iets om in de gaten te houden als het contactenbestand verder groeit.
- Live geverifieerd op de volledige set van 35 rijen met assignment-uuid's: met alle vier tokens is elke taak vindbaar (0 "niet gevonden"), tegen consequent enkele 404's met alleen het eerste token.
- Nauw verwant aan ADR-008 (Ixly-kandidaat-strategie, `_grovia_ixly_taken`-omweg) — deze ADR beschrijft een aanvullende, later ontdekte beperking van diezelfde constructie.

---

## ADR-012: MiniMove-strippenkaarten — productstructuur, checkout en aanwezigheidsregistratie
**Datum:** 2026-08-05
**Status:** Geaccepteerd

**Context:**
MiniMove verkocht een vaste cyclusprijs (Cyclus 1-4 à € 105, elk de hele cyclus van 8 trainingen). De klant wilde dit vervangen door strippenkaarten (4/6/8 keer, op te maken binnen één cyclus) én wilde kunnen bijhouden wie welke kaart heeft gekocht en wie bij welke training aanwezig was. Drie deelbeslissingen waren nodig: hoe de varianten in WooCommerce staan, wat er met de oude opties gebeurt, en hoe/waar aankopen en aanwezigheid worden vastgelegd.

**Beslissing:**
- **Eén samengestelde `pa_inschrijving`-waarde per combinatie, niet twee losse attributen.** 12 waarden (`cyclus-N-strippenkaart-M-keer`, N=1-4, M=4/6/8) i.p.v. het oorspronkelijk voorgestelde ontwerp met drie losse strippenkaartwaarden zonder cyclus. Gekozen op klantvoorstel: cyclus én aantal staan zo al in de aankoop-slug zelf, zonder dat de cyclus via de orderdatum afgeleid hoeft te worden.
- **De oude opties (Cyclus 1-4 los, Seizoenkaart – inclusief/zonder tenue, MiniMove proeftrainingen) zijn als koopoptie verwijderd** — zowel de variaties als de attribuutwaarden op het product, de onderliggende WooCommerce-termen blijven wel bestaan (gedeeld met Kolping/Schagen). Historische orders met deze slugs blijven wel herkend in de administratie (zie hieronder), want kinderen die ze eerder kochten trainen deze cyclus nog gewoon mee.
- **De maatvelden (shirt/broekje/sokken) zijn zichtbaar bij een tenue- of strippenkaart-aankoop, maar niet verplicht.** Eerst wél verplicht gemaakt (shirt+broekje) met een rood sterretje, dezelfde dag weer teruggedraaid: een kind dat via een eerdere cyclus al een tenue heeft ontvangen hoeft niet opnieuw maten door te geven.
- **Nieuwe Sheets-administratie, twee tabbladen in het bestaande "Grovia Deelnemers"-werkboek** (niet een apart werkboek): "MiniMove Deelnemers" (één rij per kind per cyclus, automatisch gevuld als nieuwe stap in de dagelijkse run, hergebruikt de orderregels die Stap 6/Financieel al ophaalt — geen extra WooCommerce-aanroep) en "MiniMove Aanwezigheid" (4 blokken onder elkaar met de echte trainingsdata als kolomkop, handmatig afgevinkt door de trainer na elke training). Aankooptype wordt puur via patroonherkenning op de slug bepaald (regex), niet via een Config-mappingtabel — robuuster tegen toekomstige wijzigingen.
- **De trainer krijgt voorlopig volledige toegang tot het hele werkboek** (dus ook Kolping/Schagen-gegevens en het Financieel-rapport) — expliciete, bewuste keuze omdat de trainer mede-eigenaar is; toegang beperken kan later alsnog als dat nodig blijkt.
- **Formules i.p.v. berekende waarden voor "gebruikt"/"over"** in het aanwezigheidstabblad (`=COUNTIF(...)`/`=gekocht-gebruikt`), zodat een aanvinkactie van de trainer meteen zichtbaar is zonder op de volgende dagelijkse run te wachten.

**Alternatieven overwogen:**
- *Drie losse strippenkaartwaarden zonder cyclus, cyclus afleiden uit de orderdatum* (oorspronkelijke aanbeveling) — verworpen op klantvoorstel; de samengestelde slug is expliciet en heeft geen kalenderlogica nodig om de cyclus te bepalen.
- *Eén aanwezigheidstabblad per cyclus (4 tabbladen)* i.p.v. 4 blokken in één tabblad — verworpen: te veel tabbladen voor het verwachte aantal aanmeldingen (geen duizenden).
- *Rode sterretjes + verplichte maatvelden houden* (zoals Vereniging/Team bij Kolping/Schagen) — verworpen na heroverweging: goed patroon in het algemeen, maar hier onjuist omdat een kind al een tenue kan hebben van een eerdere cyclus.

**Gevolgen:**
- De dagelijkse run heeft nu 7 stappen i.p.v. 6; Stap 7 (MiniMove) draait in zijn eigen try/catch en blokkeert Financieel (Stap 6) niet, en andersom.
- Geen deploy-pipeline voor Apps Script: `MiniMove.gs` (nieuw) en de wijzigingen in `Config.gs`/`Sheet.gs`/`Dagelijks.gs` moeten handmatig in de Apps Script-editor geplakt worden, en de twee nieuwe tabbladen + het Config-kalenderblokje (kolommen O:W, cyclus 1-4 in kolom O) moeten eenmalig handmatig aangemaakt worden.
- **`setFormula()` in Apps Script vereist het juiste argument-scheidingsteken voor de locale van het werkboek** (`;` i.p.v. `,` bij een Nederlandstalig werkboek) — anders geeft Sheets een `#ERROR!`. Ontdekt tijdens het live opzetten; de code bepaalt dit nu zelf via `SpreadsheetApp.getSpreadsheetLocale()`.
- De collapsible checkout-weergave en het maatuitvraag-mechanisme blijven, zoals eerder al het geval, buiten deze git-repo (child-theme `functions.php`, Weergave → Thema bestand editor) — niet via een deploy te volgen, alleen via dit ADR en het strippenkaartplan.
- Een terugkerende WAF-403 op de WooCommerce REST API (twee volledige orders-ophalingen kort na elkaar binnen één run) is verzacht met een retry-met-backoff, een herkenbare User-Agent en pauzes tussen aanroepen in `Woo.gs` — een blijvende oplossing (whitelisting) ligt bij de hostingpartij; supportticket opgesteld, nog niet verstuurd.

---

## ADR-011: Toestemmingsverklaring verbatim op een handmatig beheerde WP-pagina
**Datum:** 2026-08-04
**Status:** Geaccepteerd

**Context:**
De checkout toont sinds 2026-07-28 een toestemmingsvinkje dat linkt naar `/toestemming-fysieke-intakes/` — een pagina die nooit is aangemaakt en dus 404 gaf, omdat de inhoud van de klant moest komen. Op 2026-08-04 leverde Grovia de definitieve, door Berry en SMC Dijk en Waard goedgekeurde toestemmingsverklaring aan. Twee vragen: hoe verwerken we die tekst, en waar leeft de pagina?

**Beslissing:**
- **De tekst wordt verbatim overgenomen**, alleen omgezet naar HTML-koppen en -lijsten. Het is een toestemmingsverklaring waarop een derde partij bij de zorgverzekeraar declareert; elke herformulering is juridisch een nieuwe tekst en moet opnieuw langs beide partijen. Drie bewuste afwijkingen, gedocumenteerd in het bestand zelf: een zelfverwijzende zin over de aanmeldpagina is weggelaten, het contactblok van Grovia is ingekort (adres en site staan al in de sitefooter), en er is een sectie "Toestemming intrekken" toegevoegd die niet in de verklaring staat maar onder de AVG wel benoemd moet worden.
- **De vinkje-tekst in de plugin volgt de verklaring letterlijk.** Die verklaring benoemt exact met welke tekst het hokje wordt aangevinkt; de live tekst week daarvan af. `name`, `id` en de order-meta-sleutels blijven ongemoeid, dus bestaande orders zijn niet geraakt.
- **De pagina blijft een handmatig beheerde WordPress-pagina**, niet iets dat de plugin zelf serveert. De content staat als kale body-HTML in `plugins/grovia-fysio-toestemming/infopagina.html` en wordt in de WP-editor geplakt.
- **De opmaak zit in datzelfde bestand**, in een `<style>` gescoped op `.grovia-verklaring`. Niet de oorspronkelijke bedoeling — zie Gevolgen.

**Alternatieven overwogen:**
- *Een webversie schrijven op basis van de verklaring* — verworpen: leest prettiger, maar je verliest de goedgekeurde formulering en heropent de akkoordronde bij twee partijen.
- *De plugin de pagina laten serveren via een eigen route* — verworpen: elke tekstwijziging wordt dan een deploy en de klant kan er zelf niet bij. Voor een juridische tekst die de klant beheert is dat de verkeerde kant op.
- *De intrekprocedure zelf formuleren* — verworpen: de bewaring van al gedeelde gegevens is de wettelijke bewaarplicht van SMC als zorgverlener. We verwijzen naar hun eigen privacyverklaring in plaats van het te beschrijven.
- *De tekst als Breakdance Rich Text-element invoeren* i.p.v. een Code/HTML-blok — nog steeds een optie: dat laat de typografie wél erven, maar haalt de content uit één plakbaar blok.

**Gevolgen:**
- Het bestand in git is de bron, niet de spiegel: de tekst in WordPress kan ervan gaan afwijken zonder dat iets dat signaleert.
- **De aanname dat het sitethema de opmaak zou verzorgen bleek onjuist.** Een Code/HTML-blok in Breakdance rendert rauwe HTML zonder de typografie-instellingen die de builder op zijn eigen tekstelementen zet. Daardoor staat de tekstkleur nu hardgecodeerd op `#fff` in het contentbestand in plaats van mee te bewegen met de thema-instellingen. Kleuren volgen het sitethema (`#171A09` / `#FF5C00`), net als de pop-up in de plugin al deed.
- **De `<h1>` staat in de content, niet in het template.** Het titel-element van het template viel achter de sticky header; dat staat op deze pagina uit. Voordeel: de afstand is beheersbaar vanuit hetzelfde bestand en de pagina houdt precies één `<h1>`.
- Drie plekken zijn nu juridisch aan elkaar gekoppeld: de verklaring, `infopagina.html` en de vinkje-tekst in de plugin. Wijzigt één, dan moeten de andere twee mee. Staat als waarschuwing in de docblock boven `grovia_fysio_render_vinkje`.
- De WordPress-plugins hebben geen deploy-pipeline: de wijziging is pas live na een handmatige upload.

---

## ADR-010: `reminder_anker` als apart schema-ankerveld i.p.v. `uitgenodigd_op` herschrijven
**Datum:** 2026-08-04
**Status:** Geaccepteerd

**Context:**
De reminder-drempels (`config.reminder_dagen`, cumulatieve dagen) werden altijd geteld vanaf `uitgenodigd_op`. Voor rijen waarvan de uitnodiging weken oud is zijn álle drempels al gepasseerd: zo'n rij vuurt dan elke twee dagen een reminder af (alleen geremd door het 1-dagsvenster) tot het maximum bereikt is — ~5 mails in 9 dagen. Dat gebeurt ongeacht wat `reminders_verzonden` op staat, dus de teller handmatig op 1 zetten lost het niet op. Nodig was een manier om het schema per rij bewust te herstarten.

**Beslissing:**
- Nieuwe kolom `reminder_anker` in het Deelnemers-tabblad. Leeg = val terug op `uitgenodigd_op` (nieuwe deelnemers werken dus ongewijzigd); gevuld = tel de drempels vanaf die datum.
- `uitgenodigd_op` blijft ongemoeid als brondata. Die kolom wordt ook gebruikt door het Dashboard (doorlooptijdstatistieken, "dagen open") en door `_sindsDatum` (het WooCommerce-sync-venster); overschrijven zou rapportage én ordersynchronisatie vervuilen.
- De `config.startdatum`-grens vergelijkt vanaf nu het **anker**, niet `uitgenodigd_op`: een bewust herstart schema is een expliciete opt-in voor die rij, ook al ligt de oorspronkelijke uitnodiging vóór de startdatum.

**Alternatieven overwogen:**
- *`uitgenodigd_op` rebasen naar een recente datum* — verworpen: corrumpeert Dashboard-doorlooptijden en het sync-venster.
- *Drempels herinterpreteren als tussenpozen sinds `laatste_reminder_op`* — verworpen: geeft voor het gelukkige pad exact hetzelfde schema, maar verandert de semantiek voor élke rij en maakt het lastiger te voorspellen wanneer iemand klaar is met de reeks.

**Gevolgen:**
- Een rij met een gevuld anker is zichtbaar "handmatig bijgestuurd" — dat is expliciet en controleerbaar in de sheet.
- De startdatum-grens is nu een grens op het anker, niet op de uitnodiging. Wie de achterstand alsnog wil uitsluiten moet de startdatum boven de ankerdatum zetten, niet boven de uitnodigingsdatum.
- Eenmalig toegepast op de ~27 backlog-rijen (anker 2026-07-31, teller 1), zodat de handmatige reminder van 2026-08-03 als reminder #1 op drempeldag 3 geldt.

---

## ADR-009: Financieel-rapport op orderregelniveau met eigen seizoensgrens (1 juni)
**Datum:** 2026-08-04
**Status:** Geaccepteerd

**Context:**
De klant vroeg om afdracht-rapportage per vereniging × cyclus (€20 per deelnemer per cyclus, excl. btw), met omzet incl./excl. btw en aparte tellingen voor keepers/spelers via cyclusproduct dan wel seizoenkaart. Twee problemen met de bestaande datastructuur: (1) het Deelnemers-tabblad bewaart per kind alleen product/bedrag van de **eerste** order, dus een kind dat losse orders voor cyclus 1 én cyclus 2 plaatst zou maar in één cyclus meetellen; (2) `bepaalSeizoen()` kantelt op 1 augustus, terwijl cyclusverkoop voor het nieuwe seizoen al in juni/juli begint — die vroege orders zouden dan bij het vórige seizoen worden opgeteld.

**Beslissing:**
- Het Financieel-rapport rekent op **orderregelniveau** (`haalOrderRegels` in `Woo.gs`), niet op de samengevatte Deelnemers-rij. Losse cyclusaankopen door hetzelfde kind tellen daardoor in elke betreffende cyclus mee.
- `Financieel.gs` gebruikt een **eigen seizoensgrens van 1 juni t/m 1 juni**, volledig los van `bepaalSeizoen()`'s 1-augustusgrens. Het bestand roept `bepaalSeizoen()` nergens aan; de twee seizoensbegrippen bestaan bewust naast elkaar.
- Cyclus/seizoenkaart wordt bepaald uit de variatie-attribuutmeta **`pa_inschrijving`** (ruwe slug, bijv. `cyclus-1`), vertaald via de al bestaande maar tot nu toe ongebruikte `mapping.fases` in het Config-tabblad (G:H).
- Een seizoenkaart telt in alle drie de cycli mee als deelnemer; de omzet wordt door 3 gedeeld over de cycli. Btw vast op 9%.

**Alternatieven overwogen:**
- *Rekenen vanuit het Deelnemers-tabblad* — verworpen om reden (1) hierboven; de samenvatting per kind is fundamenteel ongeschikt voor cyclus-rapportage.
- *Cyclus als productcategorie behandelen* (eerste aanname) — onjuist gebleken: het zijn WooCommerce-**variaties**, geen categorieën, en de API-sleutel is `pa_inschrijving` met de slug als waarde, niet het zichtbare label.
- *`bepaalSeizoen()` naar 1 juni verschuiven* — verworpen: dat zou de seizoenindeling van het hele Deelnemers-tabblad en de reminder-administratie retroactief verschuiven.

**Gevolgen:**
- Twee verschillende seizoensdefinities in één codebase (1 juni voor financiën, 1 augustus voor deelnemersadministratie). Bewust en gedocumenteerd in beide bestanden, maar wél een valkuil bij toekomstige wijzigingen.
- Het Financieel-tabblad is een puur afgeleid, read-only rapport: Stap 6 van `dagelijkseRun` overschrijft het volledig, onafhankelijk van `dataBetrouwbaar`.
- `mapping.fases` is nu functioneel in gebruik; wijzigingen in de WooCommerce-variatieslugs vereisen een Config-aanpassing, geen codewijziging.

---

## ADR-008: Assignment-uuid bewaren als WooCommerce order-meta i.p.v. Ixly-lijst-endpoint
**Datum:** 2026-08-01
**Status:** Geaccepteerd

**Context:**
De Ixly-voltooiingscontrole (`ixly-status`) en de game-links in reminder-mails (`grovia-herinnering`) bleken altijd leeg/kapot: beide gingen ervan uit dat een candidate's assignments op te vragen zijn via een lijst-endpoint (`GET /assignments?candidate_uuid=...`). Bevestigd tegen `swagger.yaml`: dat endpoint bestaat niet publiek — alleen `POST /assignments` (aanmaken) en `GET /assignments/{uuid}` (één assignment via zijn eigen uuid) zijn gedocumenteerd. Dit brak stilletjes zowel de voltooiingscontrole als de game-links sinds de eerste implementatie.

**Beslissing:**
- `ixly-aanmelding` bewaart bij het aanmaken van assignments het paar `naam:assignment_uuid` per taak als WooCommerce order-meta (`_grovia_ixly_taken`), via een aparte, schrijfbare WooCommerce-sleutel (least-privilege: apart van Apps Script's bestaande alleen-lezen sleutel).
- `ixly-status` en `grovia-herinnering` gebruiken die bewaarde uuid's om per taak `GET /assignments/{uuid}` te bevragen — het enige endpoint dat wél werkt.
- Bestaande kandidaten van vóór deze fix (~31 rijen) worden **niet** met terugwerkende kracht bijgewerkt (Optie A) — er bestaat geen manier om hun assignment-uuid's achteraf op te halen (zelfde ontbrekende endpoint), dus die blijven op handmatige Ixly-controle staan.
- De Google Sheet (`ixly_taken`-kolom) en de reminder-logica sluiten rijen zonder bewaarde uuid's expliciet uit van automatische Ixly-verwerking, in plaats van te falen op een lege lijst.

**Gevolgen:**
- `code` (het WooCommerce order-ID) is gedegradeerd van functionele opzoeksleutel naar echo-sleutel — de assignment-uuid's dragen nu de betekenis. Dit maakt de Ixly-status-check ongevoelig voor een bekende, aparte `order_ids`-notatiebug in de sheet.
- Nieuw faalpunt ontdekt en opgelost tijdens livegang: de hosting van grovia.nl blokkeert schrijfverzoeken met de standaard `requests`-User-Agent (WAF-regel) — opgelost met een expliciete, eigen User-Agent-header op die ene aanroep.
- `grovia_shared.ixly_api.zoek_candidate`/`haal_assignments` (het kapotte lijst-pad) zijn na deze fix ongebruikt maar niet verwijderd — opruimen staat niet in scope van deze ADR.

---

## ADR-007: Fysio-toestemming als aparte plugin met opt-in productcategorie
**Datum:** 2026-07-28
**Status:** Geaccepteerd

**Context:** De fysiopraktijk vereist expliciete, vrijwillige toestemming van ouders voor fysieke intakes/behandelingen en declaratie bij de zorgverzekeraar. De conditie (welke producten) moet door de klant zelf beheersbaar zijn zonder code-wijziging.

**Beslissing:** (1) Eigen standalone plugin `grovia-fysio-toestemming` i.p.v. uitbreiding van `grovia-automations` — losse verantwoordelijkheid, los te (de)activeren. (2) Opt-in via productcategorie `toestemming-vereist` i.p.v. een uitsluitlijst — nieuwe producten krijgen het vinkje nooit per ongeluk en Berry stuurt het zelf in WooCommerce. (3) Order-meta-semantiek: afwezig = niet van toepassing, `nee` = bewust geweigerd — dit onderscheid is relevant voor de fysiopraktijk.

**Alternatieven overwogen:** uitsluitlijst op categorie (zoals `grovia-automations` doet) — verworpen omdat elk nieuw product dan stilzwijgend het vinkje krijgt; kant-en-klare checkout-field-plugin — verworpen (geen conditionele weergave + pop-up zonder betaalde versie, extra afhankelijkheid).

**Gevolgen:** Eén extra plugin om te deployen. De categorie moet per product bewust worden toegekend (nu alleen Zomerspektakel Kolping). Checkout-velden in fragmenten moeten `$_POST['post_data']` parsen om AJAX-refreshes te overleven (geldt ook voor toekomstige velden).

## ADR-006: Apart prepaid nummer voor WhatsApp Business API
**Datum:** 2026-06-02
**Status:** Geaccepteerd

**Context:**
Bij het koppelen van het bestaande Grovia WhatsApp Business-nummer aan de Meta Cloud API bleek dat dit een verplichte migratie vereist: het nummer verlaat de WhatsApp Business App en is daarna alleen nog via de API te gebruiken. Grovia gebruikt het bestaande nummer actief voor groepsbeheer (aanmaken/beheren van WhatsApp-groepen), wat verloren zou gaan.

**Beslissing:**
Een apart prepaid telefoonnummer (nieuwe SIM, ~€5 eenmalig via Lebara/Lycamobile) wordt gekoppeld aan de Meta Cloud API. Het bestaande Grovia-nummer blijft in de WhatsApp Business App voor dagelijks gebruik en groepsbeheer. De geautomatiseerde uitnodigingen worden verzonden vanuit het prepaid nummer.

**Gevolgen:**
- Klanten ontvangen WhatsApp-berichten van een onbekend nummer (niet het vertrouwde Grovia-nummer)
- Grovia behoudt volledige controle over het bestaande nummer en alle groepen
- Prepaid SIM is eenmalig nodig voor de verificatiestap — daarna op te bergen
- De groepsuitnodigingslink (uit de WhatsApp Business App) wordt meegestuurd via de API als template-parameter

---

## ADR-005: PHP maakt directe Azure Function calls — geen FunnelKit HTTP Request stappen
**Datum:** 2026-05-19
**Status:** Geaccepteerd

**Context:**
De originele architectuur gebruikte FunnelKit HTTP Request-stappen om data door te sturen naar Azure Functions. Dit vereiste dat merge tags (naam_kind, order_id) beschikbaar waren in de FunnelKit-flow, wat complex te configureren was en de flow-configuratie fragiel maakte. Bovendien was het onduidelijk of FunnelKit `tag_name` als dynamic trigger context beschikbaar stelde in HTTP Request-stappen.

**Beslissing:**
`grovia_assessment_router` (PHP, WordPress) roept de Azure Functions **direct** aan via `wp_remote_post()`. FunnelKit hoeft alleen te triggeren (Tag Added) en de Custom Callback aan te roepen. De PHP-code leest alle benodigde data zelf op via `wc_get_order($order_id)` — de `order_id` is ingebed in het tagformaat als laatste numeriek segment.

Tagformaat: `{school}{fase}{seizoen}_{naam_slug}_{order_id}` (bijv. `SUC22526_freddie-rood_935`)

**Gevolgen:**
- FunnelKit-flows zijn minimaal: trigger + één Custom Callback-stap, geen configuratie van payloads of merge tags
- `StuurAssessment` en `StuurBetaallink` tags zijn overbodig geworden
- PHP heeft directe WooCommerce-databasetoegang (geen API-call nodig voor orderdata)
- Nieuwe scholen/fases toevoegen = alleen PHP aanpassen, geen FunnelKit-configuratie
- Azure Function URLs (incl. functie-sleutels) moeten als WordPress-constanten in `wp-config.php` worden gezet

---

## ADR-004: Ixly kandidaat-strategie — kind als candidate, order_id als api_identifier
**Datum:** 2026-05-19
**Status:** Geaccepteerd

**Context:**
Ouders kopen assessments voor kinderen, soms meerdere kinderen met hetzelfde ouder-e-mailadres. Ixly bevestigde (Jan-Willem, mei 2026) dat het `api_identifier`-veld de unieke sleutel is per candidate. E-mail is geen verplicht veld op candidates en wordt in een toekomstige API-versie geweigerd. Jan-Willem bevestigde (19 mei 2026) dat er geen loginomgeving is — elke assignment levert een directe link op waarmee het assessment gestart kan worden.

**Beslissing:**
- `api_identifier` = `order_id` (uniek per WooCommerce-bestelling)
- Candidate aangemaakt op naam van het kind (`kind_voornaam`, `kind_achternaam`)
- E-mailveld op candidate tijdelijk ingevuld met ouder-e-mail (voor nu, per advies Jan-Willem)
- Elke assignment heeft een eigen `login_url` — uitnodigings-e-mail bevat één link per game
- Uitnodigings-e-mail gaat naar ouder-e-mailadres, geadresseerd aan het kind

**Gevolgen:**
- Twee kinderen van dezelfde ouder → twee losse candidates, elk met eigen assignments en links
- Duplicate guard toegevoegd: bestaande assignments worden niet opnieuw aangemaakt
- `_maak_assignments_aan_met_guard` retourneert lijst met `login_url` per item (niet één gedeelde URL)

---

## ADR-003: GitHub Secrets als secrets-beheer voor Azure
**Datum:** 2026-04-30
**Status:** Geaccepteerd

**Context:** Azure Function App heeft omgevingsvariabelen nodig (Mollie, SMTP, Ixly). Deze mogen niet in code of in de Azure Portal handmatig worden beheerd.

**Beslissing:** Alle secrets worden opgeslagen als GitHub Secrets en via de deploy workflow (`az functionapp config appsettings set`) in Azure gezet bij elke deployment.

**Gevolgen:** Eén plek voor secrets (GitHub). `GROVIA_DEBUG_EMAIL` staat bewust niet in de workflow — alleen lokaal in `.env` voor testdoeleinden.

---

## ADR-002: Mollie Payment Links API voor betaallinks
**Datum:** 2026-04-30  
**Status:** Geaccepteerd (bijgewerkt 2026-05-17)

**Context:** Workflow 3B vereist een betaallink die per e-mail verstuurd wordt. De Mollie Payments API geeft een checkout-URL die binnen ~15 minuten verloopt — ongeschikt voor e-mail.

**Beslissing:** Gebruik de Mollie Payment Links API (`POST /v2/payment-links`). Betaallink verloopt niet automatisch, hosted door Mollie, geen SDK nodig (puur `requests`).

**Gevolgen:** Geen extra dependency. `MOLLIE_WEBHOOK_URL` is optioneel — wordt gebruikt voor de feedback loop naar FunnelKit na geslaagde betaling.

**Addendum (2026-05-17) — metadata niet ondersteund op Payment Links:**  
De `/v2/payment-links` endpoint ondersteunt het `metadata`-veld **niet** (geeft 422: `"Non-existent body parameter"`). Dit staat in contrast met de reguliere Payments API die metadata wél ondersteunt. Klantidentificatie (email, wc_klant_id) wordt daarom ingebed als query params in de `webhookUrl`: `.../mollie-webhook?email=...&wc_klant_id=...`. Mollie behoudt deze query params bij het aanroepen van de webhook. Payment-objecten aangemaakt via payment links hebben `metadata: null`.

**Addendum (2026-05-17) — Mollie stuurt `pl_` ID voor payment links:**  
Geverifieerd in productie: de webhook voor een payment link ontvangt `id=pl_xxxxx` (payment link ID), niet `id=tr_xxxxx` (transactie ID). Om de betaalstatus te verifiëren moet `/v2/payment-links/{pl_id}/payments` worden aangeroepen. De `mollie-webhook` function handelt beide gevallen af: `pl_` via de payment-links endpoint, `tr_` direct via `/v2/payments/{id}`.

---

## ADR-001: API-sleutels via wp-config.php
**Datum:** 2026-04-28
**Status:** Geaccepteerd

**Context:** De FunnelKit REST API-sleutel wordt gebruikt in beide WordPress-plugins. Hardcoding in plugincode is een veiligheidsrisico en verstoort versiebeheer.

**Beslissing:** Secrets worden gedefinieerd in `wp-config.php` via `define()`, buiten de pluginbestanden. De plugins lezen de constante op via `GROVIA_FUNNELKIT_API_KEY`.

**Gevolgen:** Sleutels staan nooit in git. `wp-config.php` valt buiten de repo. Bij deployments moet de sleutel handmatig in `wp-config.php` worden gezet op de server.
