---
description: Pas de project-template toe op een bestaand project — detecteer de stack, stel vragen en vul alle docs-bestanden in met echte content.
---

Voer de volgende stappen uit om de template toe te passen op dit bestaande project. Het project heeft al code — gebruik die als primaire informatiebron en vul aan met gerichte vragen.

## Stap 0 — Bestaande bestanden controleren

Controleer of `CLAUDE.md` en/of de map `docs/` al bestaan.

- Als ze **niet bestaan**: ga direct door naar stap 1.
- Als ze **wel bestaan**: meld wat je aantreft (welke bestanden, kort wat erin staat) en vraag:

  > "Ik zie dat er al een `CLAUDE.md` en/of `docs/`-bestanden zijn. Wat wil je dat ik doe?
  > - **Overschrijven** — ik vervang alles met de ingevulde template
  > - **Samenvoegen** — ik voeg de template-structuur toe en bewaar bestaande content waar dat kan
  > - **Stoppen** — ik doe niets"

  Wacht op het antwoord voordat je verdergaat.

## Stap 0.5 — Projecttype bepalen

Vraag dit vóór de scan, want het antwoord bepaalt waarop gescand wordt en welke vragen zinvol zijn:

> "Is dit een **code-project** of een **BI-project**?
> - **Coding** — applicatie- of servicecode (web, API, desktop, library)
> - **BI** — datawerk: SQL, dbt-modellen, pipelines, rapportages"

Wacht op het antwoord. Het gekozen type stuurt de rest van dit command aan (scan, vragen, docs-set, Notion) en wordt in stap 3 vastgelegd in `CLAUDE.md` onder Quick Facts als `- **Project Type:** Coding` of `- **Project Type:** BI`.

> **Resolutieregel voor álle commands:** ontbreekt het veld `Project Type` in `CLAUDE.md`, dan geldt `Coding`. Projecten van vóór deze wijziging blijven daardoor werken zoals ze deden — geen migratie nodig.

Waar hieronder **[Coding]** of **[BI]** staat, geldt dat blok alleen voor dat type. Blokken zonder markering gelden voor beide.

## Stap 1 — Codebase scannen

Lees de volgende bestanden en mappen als ze bestaan, zonder ze te rapporteren aan de gebruiker — gebruik ze puur als context:

- `package.json` / `package-lock.json` / `yarn.lock` / `pnpm-lock.yaml`
- `Cargo.toml` / `pyproject.toml` / `*.csproj` / `build.gradle` / `pom.xml` / `composer.json`
- `Dockerfile` / `docker-compose.yml` / `.github/workflows/*.yml`
- `*.env.example` / `.env.example`
- `README.md` (als die bestaat)
- De root-mappenstructuur (één niveau diep)
- `src/` of `app/`-mappenstructuur (één niveau diep)
- Eventuele CI-configuratiebestanden

**[BI]** Scan aanvullend:

- `dbt_project.yml` / `packages.yml` / `profiles.yml`
- `models/`-structuur (submappen zijn meestal de laagindeling: staging, intermediate, marts)
- `macros/`, `seeds/`, `snapshots/`, `tests/`
- Losse `*.sql`-bestanden in de repo-root of een `sql/`-map
- Orchestratie: `dags/` (Airflow), `meltano.yml`, `pipelines/`, scheduling-config in CI

Leid hier zo veel mogelijk uit af:

**Beide types:** projectnaam, taal van de code (variabelenamen, comments), build/verificatie-command, externe services.

**[Coding]**
- **Stack** (frontend, backend, database, hosting)
- **Run command**
- **Testframework**
- **Code-patronen** (mapstructuur, naamgeving)
- **Entiteiten in het domein** (op basis van bestandsnamen, modellen, routes)

**[BI]**
- **Warehouse/platform** (uit `profiles.yml` of connectie-config: BigQuery, Snowflake, SQL Server, Postgres)
- **Laagindeling** (uit de `models/`-submappen)
- **Bronsystemen** (uit `sources`-definities in `.yml`-bestanden)
- **Verificatie-command** (meestal `dbt build` of `dbt test`)
- **Orchestratie en refresh-schema** (uit DAG-definities of scheduling-config)
- **Kernentiteiten en metrieken** (uit mart-modelnamen)

## Stap 2 — Gerichte vragen stellen

Stel alleen vragen over wat je **niet** uit de code kon afleiden. Presenteer voor elk punt eerst je eigen voorstel (op basis van de scan) en vraag om bevestiging of correctie. Bundel vragen per thema in één bericht — stel ze niet één voor één tenzij het antwoord de volgende vraag bepaalt.

Vragen die altijd gesteld worden, ook als je een voorstel hebt:

1. **Beschrijving:** Wat doet dit project, voor wie? (1-2 zinnen)
2. **Project status:** Greenfield, MVP, of maintenance mode?
3. **Productie-URL:** Is het al deployed? Zo ja, op welk adres?
4. **Key people:** Wie zijn de kernpersonen? (naam + rol)
4b. **Jij (actieve developer):** Wat is jouw volledige naam en e-mailadres? (voor commit-attributie en Notion-toewijzing) — moet overeenkomen met een naam in Key People.
5. **Voertaal docs/commits/UI:** Code-taal heb je waarschijnlijk al — maar wat is de taal voor documentatie, commit messages en de UI?
6. **Kritieke projectregels:** Zijn er harde constraints die Claude moet kennen? (bijv. "geen directe DB-queries buiten de repository-laag")
7. **Domein-termen:** Zijn er termen die specifiek zijn voor dit project die een buitenstaander niet zou begrijpen? (bijv. interne naam voor een entiteit of proces)

Stel ook situationele vragen als je die niet kon afleiden.

**[Coding]**
- Hosting / deployment-aanpak (als niet af te leiden uit CI of Dockerfile)
- Authenticatie-aanpak (als niet af te leiden uit dependencies)
- Database-schema of hoofdentiteiten (als niet af te leiden uit modellen)
- Teststrategie (als geen testframework gevonden)

**[BI]**
- Bronsystemen: welke systemen leveren data, en hoe komt die binnen (API, database-replica, export)?
- Warehouse en omgevingen: waar staat de data, en is er onderscheid dev/prod?
- Refresh-schema: hoe vaak draaien de pipelines, en waardoor worden ze getriggerd?
- Rapportage-afnemers: welke dashboards/rapporten hangen eraan, en wie gebruikt ze?
- Data-quality: worden er tests gedraaid (dbt tests, freshness-checks), en wat gebeurt er bij een failure?

## Stap 3 — Alle bestanden schrijven

Na het verzamelen van alle informatie, schrijf de volgende bestanden weg. Gebruik **altijd echte content** — geen lege placeholders laten staan als je de informatie hebt. Vul secties die je niet kunt invullen in met een expliciete `<!-- onbekend — vul aan -->` comment.

**Welke docs schrijf je?** Dit hangt af van het projecttype uit stap 0.5:

| Bestand | Coding | BI |
|---|---|---|
| `CLAUDE.md` | ✅ | ✅ |
| `docs/HANDOFF.md` | ✅ | ✅ |
| `docs/TODO.md` | ✅ | ✅ |
| `docs/DOC-SIGNALS.md` | ✅ | ✅ |
| `docs/GLOSSARY.md` | ✅ | ✅ |
| `docs/DECISIONS.md` | ✅ | ❌ |
| `docs/ARCHITECTURE.md` | ✅ | ❌ |
| `docs/CONVENTIONS.md` | ✅ | ❌ |
| `docs/DATAPLATFORM.md` | ❌ | ✅ |
| `docs/DATAMODEL.md` | ❌ | ✅ |
| `docs/RAPPORTAGES.md` | ❌ | ✅ |

De **waarheid-docs** (de set die `/dag-afsluiting` bewaakt) zijn daarmee:

- **[Coding]** `CONVENTIONS.md`, `ARCHITECTURE.md`, `GLOSSARY.md`, `README.md`, `CONTRIBUTING.md`
- **[BI]** `DATAPLATFORM.md`, `DATAMODEL.md`, `RAPPORTAGES.md`, `GLOSSARY.md`, `README.md`, `CONTRIBUTING.md`

Schrijf géén bestanden die niet bij het type horen — een leeg `ARCHITECTURE.md` in een dbt-repo is precies de drift die we willen voorkomen.

### `CLAUDE.md`

Schrijf volledig opnieuw op basis van de template. Regels:

- Alle `[placeholders]` invullen met verzamelde informatie
- **Quick Facts bevat `- **Project Type:** Coding` of `- **Project Type:** BI`** — het antwoord uit stap 0.5
- **Superpowers-sectie altijd opnemen**
- Project Status Regels: neem alleen de sectie op die past bij de status (greenfield/MVP of maintenance mode)
- Kritieke regels: voeg de secrets-sectie altijd op, voeg projectspecifieke regels toe op basis van wat opgegeven is
- Build command en run command: gebruik wat gedetecteerd of opgegeven is. **[BI]** vul bij Build het verificatie-command in (bijv. `dbt build` of `dbt test`); is er niets, schrijf dan expliciet "n.v.t." in plaats van het veld leeg te laten
- **File Update Discipline tabel** moet de DOC-SIGNALS-rij en de waarheid-docs-cluster-rij bevatten, met de waarheid-docs die bij het projecttype horen (zie de docs-set hieronder). Zie de CLAUDE.md van deze template-repo voor het exacte format.
- **Documentation Map** toont de docs-set die je daadwerkelijk hebt weggeschreven — geen bestanden die niet bestaan

### `docs/HANDOFF.md`

Schrijf de initiële handoff op basis van de huidige staat van het project:

- Datum van vandaag
- Huidige branch (`git branch --show-current`)
- Laatste commit (`git log -1 --oneline`)
- Build-status: vermeld het build command, schrijf "niet gecontroleerd in deze sessie — voer zelf uit"
- Wat er in deze sessie is gebeurd: "Template toegepast op bestaand project. Alle docs-bestanden zijn aangemaakt en gevuld op basis van codebase-scan en projectinformatie."
- Open items: top 3 meest voor de hand liggende volgende stappen op basis van de huidige staat

### `docs/TODO.md`

Schrijf één TODO-bestand met secties per persoon. Maak een `## <Naam>`-sectie aan voor elke persoon uit Key People, plus `## Gedeeld` en `## Done (recent)`. Zet de initiële items onder `## Gedeeld`:

```
# TODO

> Eén bestand, secties per persoon. Werk in je eigen sectie. `/handoff` verplaatst afgevinkte items naar **Done (recent)**.

## Gedeeld

- [ ] Controleer en vul aan: `[waarheid-doc 1]` — vooral de secties die onbekend bleven
- [ ] Controleer en vul aan: `[waarheid-doc 2]` — voeg toe wat nog ontbreekt
- [ ] Voer een bouwcheck uit: `[build command]`

## <Naam per persoon uit Key People>

## Done (recent)
```

Vul `[waarheid-doc 1]` en `[waarheid-doc 2]` in met de eerste twee waarheid-docs van het projecttype — **[Coding]** `docs/ARCHITECTURE.md` en `docs/CONVENTIONS.md`, **[BI]** `docs/DATAPLATFORM.md` en `docs/DATAMODEL.md`.

Voeg onder `## Gedeeld` toe wat logisch volgt uit de projectstatus (bijv. "schrijf eerste tests" als er geen testfiles zijn, of **[BI]** "voeg dbt tests toe op de mart-modellen" als `tests/` leeg is).

### `docs/DECISIONS.md` — **[Coding]**

Schrijf de header + format-instructie. Voeg één ADR toe voor de meest significante architecturale keuze die je uit de codebase kon afleiden (bijv. framework-keuze, database-keuze). Als je niets kunt afleiden, laat de sectie leeg met een comment.

> **[BI]** schrijf dit bestand niet. BI-projecten hebben geen ADR-flow — niet lokaal en niet in Notion.

### `docs/ARCHITECTURE.md` — **[Coding]**

Schrijf alle secties in met echte content op basis van de scan:

- **Systeem-overzicht:** wie zijn de gebruikers, welke systemen communiceren
- **Tech Stack tabel:** vul in wat je weet, markeer onbekende rijen met `onbekend`
- **Data Model:** beschrijf de hoofdentiteiten die je kon afleiden uit modellen, routes, of bestandsnamen
- **Request Flows:** beschrijf de meest voor de hand liggende flow (bijv. authenticatie of de primaire use case)
- **Deployment:** vul in op basis van Dockerfile / CI / hostingkeuze
- **Externe Afhankelijkheden tabel:** vul in op basis van dependencies en env-variabelen

### `docs/CONVENTIONS.md` — **[Coding]**

Schrijf secties in met patronen die je uit de codebase kon afleiden:

- **Naamgeving:** wat zie je aan naamgeving van bestanden, klassen, functies?
- **Projectstructuur:** beschrijf de mappenstructuur zoals je die aantrof
- **Patronen die we gebruiken:** wat zie je aan architectuurpatronen?
- **Patronen die we NIET gebruiken:** laat leeg met comment als onbekend
- **Error Handling:** wat zie je in de code?
- **Database & Migraties:** vul in als relevant
- **Testing:** wat zie je aan testbestanden en testpatronen?
- **Stijlgids:** wat zie je aan linting-config, formattering?

### `docs/DATAPLATFORM.md` — **[BI]**

Schrijf alle secties in met echte content op basis van de scan en de antwoorden:

- **Bronsystemen:** welke systemen leveren data, hoe komt die binnen (API, replica, export), en met welke frequentie
- **Warehouse:** platform, projecten/databases, schema's, omgevingen (dev/prod)
- **Laagindeling:** de lagen zoals je ze aantrof in `models/` (bijv. raw → staging → intermediate → marts) en wat elke laag wel en niet mag doen
- **Orchestratie & refresh:** wat draait wanneer, waardoor getriggerd, en waar je een run terugziet
- **Externe afhankelijkheden tabel:** connectoren, API's, credentials-locaties (nooit de waardes zelf)

### `docs/DATAMODEL.md` — **[BI]**

- **Kernentiteiten:** de belangrijkste mart-modellen, met per model de **grain** (één rij = wat?)
- **Lineage:** van bron naar mart, zo concreet als de scan toelaat
- **Businessdefinities:** hoe de centrale metrieken exact berekend worden, inclusief de randgevallen die mensen anders verkeerd interpreteren
- **Naamgeving:** conventies voor modelnamen, kolomnamen, prefixes per laag — zoals je ze in de repo aantrof
- **Teststrategie:** welke dbt tests of data-quality checks er zijn, en wat er gebeurt bij een failure

### `docs/RAPPORTAGES.md` — **[BI]**

Tabel met per rapportage: **naam**, **doelgroep**, **eigenaar**, **refresh-frequentie**, **onderliggende modellen**. Vul in wat je uit de antwoorden hebt; laat onbekende kolommen expliciet leeg met `<!-- onbekend — vul aan -->`.

### `docs/GLOSSARY.md`

Schrijf de tabelheader in. Voeg rijen toe voor domein-termen die opgegeven zijn of die je uit de codebase hebt afgeleid (entiteitsnamen, interne termen). Laat de code-referentie zo concreet mogelijk (bijv. `src/models/Order.ts`).

### `docs/DOC-SIGNALS.md`

Schrijf de file met **alleen de header en format-uitleg** (geen retroactieve signal-vulling — projecten beginnen met een lege buffer). Vul `[waarheid-docs]` in de header in met de set die bij het projecttype hoort:

````
# Doc-drift signals — buffer voor /dag-afsluiting

Append-only door `/handoff`. Geleegd door `/dag-afsluiting` in dezelfde commit als de doc-updates.

**Doel:** captures van wijzigingen die één van de "waarheid-docs" raken ([waarheid-docs]). `/handoff` voegt entries toe; `/dag-afsluiting` verwerkt en leegt.

**Format per entry:**

```
## YYYY-MM-DD — sessie N — TARGET-DOC

**Wat:** [korte beschrijving van de wijziging]
**Code:** [betrokken bestanden, paden t.o.v. repo-root]
**Commit:** [commit-hash van de relevante commit]
**Voorgestelde plek:** [hint voor /dag-afsluiting — welke sectie in de waarheid-doc]
```

---

<!-- Entries hieronder. Verwijder deze regel bij de eerste echte entry. -->
````

### `.claude/settings.local.json`

Als dit bestand nog niet bestaat: schrijf het aan met het build command en run command als toegestane commando's.
Als het al bestaat: lees het, en voeg de commando's toe als ze er nog niet in staan. Overschrijf bestaande permissies niet.

### `.gitignore` — `.claude/` regels

Zorg dat de volgende granulaire regels aanwezig zijn in `.gitignore`. Doel: lokale/machine-specifieke bestanden uitsluiten, maar commands en skills wél committen (zodat remote routines er toegang toe hebben).

Te blokkeren:
```
# AI — lokale bestanden niet committen, commands en skills wel
.claude/settings.local.json
.claude/.template-source
.claude/.DS_Store
.claude/worktrees/
.claude/developer
```

Werkwijze:
- Als `.gitignore` niet bestaat: maak het aan met alleen dit blok.
- Als `.gitignore` bestaat én een blanket `.claude/` of `.claude` regel bevat: vervang die regel door het blok hierboven.
- Als `.gitignore` bestaat maar geen `.claude`-regel heeft: voeg het blok toe aan het einde.
- Als de granulaire regels al aanwezig zijn: niets doen.

### Developer-identiteit — `~/.claude/developer` (globaal) + optionele project-override

De developer-identiteit hoort op machine-niveau in `~/.claude/developer` en geldt als **standaard** voor álle projecten — net als `~/.claude/notion.md`. `/setup-machine` maakt 'm aan. Een project mag 'm per veld overschrijven via een eigen `.claude/developer` (gitignored, nooit committen).

- Bestaat `~/.claude/developer` al en komt de naam/e-mail overeen met vraag 4b? → niets schrijven; de globale identiteit wordt gebruikt.
- Bestaat `~/.claude/developer` nog niet? → schrijf de identiteit dáárheen (globaal, per machine).
- Wijkt alleen de `notion_id` af voor de workspace van dít project? → schrijf uitsluitend de afwijkende velden naar het project-`.claude/developer` (gitignored override).

Formaat (beide bestanden):

```
naam: <volledige naam uit vraag 4b>
email: <e-mail uit vraag 4b>
notion_id: <geresolved, zie hieronder>
```

**Notion user-ID resolven:**
- Alleen als `~/.claude/notion.md` bestaat én er een `Notion Workspace:` in CLAUDE.md staat (anders `notion_id` weglaten).
- Zoek de Notion-gebruiker via `notion-search` met `query_type: "user"` en het e-mailadres als `query`.
  - Eén match → gebruik diens user-ID.
  - Geen/meerdere matches → toon kandidaten (naam + e-mail), laat kiezen, of laat `notion_id` leeg met de melding "Notion-ID niet geresolved — AssignedTo wordt niet gezet tot je dit aanvult".

## Stap 3.5 — Notion Coding Project

Vraag: Moet dit project bijgehouden worden in Notion? (ja/nee)

**"nee":** Sla deze stap over.

**"ja":**
- Controleer of `~/.claude/notion.md` bestaat
  - Nee: meld "Draai eerst `/setup-machine` vanuit de template-repo om Notion in te stellen." → sla de rest van Stap 3.5 over
  - Ja: lees de beschikbare workspace-namen uit `~/.claude/notion.md` (alle `## Workspace: <naam>` koppen)
- Toon de beschikbare workspaces en vraag: "Welke workspace hoort bij dit project? [toon lijst]"
- Voeg het gekozen antwoord toe aan `CLAUDE.md` onder Quick Facts als:
  `- **Notion Workspace:** <gekozen naam>`

Dan:

1. **Maak de pagina aan vanuit de Notion page-template** — niet met zelfgeschreven content. Fetch de Projecten-database via `notion-fetch` en lees de `page_templates`-lijst. Kies de template die bij het projecttype hoort:

   | | Page-template | `Project Type` |
   |---|---|---|
   | **[Coding]** | "Nieuw Code Project" | `Coding` |
   | **[BI]** | "Nieuw BI Project" | `BI` |

   Geef het template-ID mee als `template_id` aan `notion-create-pages`, samen met de properties (`Project Naam`, `Project Type`, `Project status`, `Areas`). Geef dan **geen** `content` mee — de template levert die.

   > **Waarom via de template en niet met eigen content?** De projectpagina bevat gekoppelde database-views (Taken, Sessielogboek, Dag Rapporten, Nacht Rapporten, en bij Coding ook ADR's) die gefilterd zijn op `Project = deze pagina`. Notion herschrijft die zelfverwijzing bij het instantiëren van een template. Via de API kan dat niet: de view-DSL negeert `relation`- en `status`-filters stilzwijgend (je krijgt een lege filtergroep terug, zonder foutmelding). Een handgebouwde pagina krijgt dus views die álle taken van álle projecten tonen.

   **Bestaat de template niet** (bijv. nog geen "Nieuw BI Project" in deze workspace)? Meld dat expliciet, maak de pagina met properties en tekstsecties zónder gekoppelde views, en zeg erbij: "De gekoppelde database-views ontbreken — maak eenmalig een page-template `Nieuw BI Project` in Notion (dupliceer `Nieuw Code Project`, vervang Tech Stack/Architectuur/Setup door Dataplatform/Datamodel/Rapportages, verwijder de ADR-view) zodat volgende projecten ze wel krijgen."

2. Werk de content bij met projectspecifieke info via `notion-update-page` — **[Coding]** stack, repo, commando's; **[BI]** bronsystemen, warehouse, refresh-schema, rapportages. Raak de gekoppelde database-blokken niet aan.
3. Voeg de URL toe aan `CLAUDE.md` onder Quick Facts als `Notion Coding Project`

> De veldnaam `Notion Coding Project` is voor beide types gelijk. Die naam is historisch en wordt bewust niet hernoemd — hij komt voor in zes commands en in de Quick Facts van elk bestaand project, en een gemiste verwijzing laat Notion stilletjes uitvallen zonder foutmelding.

**Notion-config lezen voor Stap 3.5:**
- Lees `~/.claude/notion.md`
- Zoek onder `## Workspace: <gekozen naam>`:
  - `projects:` → gebruik als parent data source voor het aanmaken van de Coding Project pagina
  - `sessielogboek:` → gebruik als parent data source voor sessielogboek-entries

> **Let op:** De Coding area URL en Coding template ID zijn workspace-specifiek en staan niet in `~/.claude/notion.md`. Vraag deze eenmalig op als ze niet beschikbaar zijn, of sla het automatisch aanmaken van de Notion-pagina over en doe dit handmatig.

## Stap 4 — Bevestiging

Toon een overzicht:

- Welke bestanden zijn aangemaakt of bijgewerkt
- Welke secties je *niet* volledig hebt kunnen invullen (en waarom)
- Aanbeveling: "Gebruik `/start-session` om elke volgende sessie te starten."
