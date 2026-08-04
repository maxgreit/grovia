---
description: Initialiseer een nieuw project — stel vragen en vul alle templates in
---

Voer de volgende stappen uit om een nieuw project te initialiseren. Vraag de informatie interactief uit en schrijf daarna alle bestanden weg.

## Stap 1 — Projectinformatie uitvragen

Stel de volgende vragen één voor één. Wacht op het antwoord voordat je verdergaat.

0. **Projecttype:** Is dit een **code-project** (`Coding` — applicatie- of servicecode) of een **BI-project** (`BI` — SQL, dbt-modellen, pipelines, rapportages)?

   Stel deze vraag als eerste: het antwoord bepaalt vraag 3, 4 en 5 hieronder, én welke bestanden je in stap 2 wegschrijft. Het wordt vastgelegd in `CLAUDE.md` onder Quick Facts als `- **Project Type:** Coding` of `- **Project Type:** BI`.

   > **Resolutieregel voor álle commands:** ontbreekt het veld, dan geldt `Coding`.

   Waar hieronder **[Coding]** of **[BI]** staat, geldt dat blok alleen voor dat type.

1. **Projectnaam:** Wat is de naam van dit project?
2. **Beschrijving:** Beschrijf het project in 1-2 zinnen. Wat doet het, voor wie?
3. **Stack:**

   **[Coding]**
   - Frontend (bijv. React, Razor Pages, Vue, geen)
   - Backend (bijv. ASP.NET Core, Node/Express, Django, Laravel)
   - Database (bijv. SQL Server, PostgreSQL, MySQL, geen)
   - Hosting (bijv. VPS, Azure, Vercel, lokaal)
   - Overige services (bijv. e-mail API, error tracking, authenticatie)

   **[BI]**
   - Warehouse/platform (bijv. BigQuery, Snowflake, SQL Server, Postgres)
   - Transformatietool (bijv. dbt, losse SQL, Python)
   - Orchestratie (bijv. Airflow, dbt Cloud, cron, geen)
   - Bronsystemen (welke systemen leveren data, en hoe komt die binnen)
   - Rapportagelaag (bijv. Power BI, Looker, Metabase, geen)
4. **Build command:** **[Coding]** welk commando bouwt het project? (bijv. `dotnet build`, `npm run build`) — **[BI]** welk commando verifieert de modellen? (bijv. `dbt build`, `dbt test`). Is er niets, antwoord "n.v.t."
5. **Run command:** **[Coding]** welk commando start de lokale server? (bijv. `dotnet run`, `npm run dev`) — **[BI]** welk commando draait een volledige refresh lokaal? (bijv. `dbt run`)
6. **Taal:** Voertaal voor code? Voor docs/commits/UI? (bijv. code in Engels, docs in Nederlands)
7. **Kritieke regels:** Zijn er nu al harde constraints bekend? (bijv. "secrets nooit in code", "geen directe DB-toegang in controllers"). Mogen ook "geen" zijn.
8. **Superpowers:** Gebruik je de Superpowers plugin? (ja/nee) — dit bepaalt of de sessie-instructies daarnaar verwijzen.
9. **Key people:** Wie zijn de kernpersonen? (naam + rol, bijv. "Jan — lead developer, Lisa — designer")
9b. **Jij (actieve developer):** Jouw volledige naam + e-mailadres (voor commit-attributie en Notion-toewijzing) — moet matchen met een naam in Key people.
10. **Project status:** Wat is de huidige fase? (bijv. "greenfield", "MVP", "maintenance mode")
11. **GitHub repository:** Is er al een GitHub-repo voor dit project? Geef de URL op, zeg "aanmaken" als je die nu wilt aanmaken, of "later" om dit over te slaan.
12. **Notion Coding Project:** Moet dit project bijgehouden worden in Notion? (ja/nee)

## Stap 2 — Templates vullen

Na het uitvragen, schrijf de volgende bestanden weg met de verzamelde informatie.

**Welke docs schrijf je?** Dit hangt af van het projecttype uit vraag 0:

| Bestand | Coding | BI |
|---|---|---|
| `CLAUDE.md`, `docs/HANDOFF.md`, `docs/TODO.md`, `docs/GLOSSARY.md`, `.claude/developer`, `.claude/settings.local.json` | ✅ | ✅ |
| `docs/DECISIONS.md` | ✅ | ❌ |
| `docs/ARCHITECTURE.md` | ✅ | ❌ |
| `docs/CONVENTIONS.md` | ✅ | ❌ |
| `docs/DATAPLATFORM.md` | ❌ | ✅ |
| `docs/DATAMODEL.md` | ❌ | ✅ |
| `docs/RAPPORTAGES.md` | ❌ | ✅ |

De **waarheid-docs** (de set die `/dag-afsluiting` bewaakt) zijn daarmee **[Coding]** `CONVENTIONS.md`, `ARCHITECTURE.md`, `GLOSSARY.md`, `README.md`, `CONTRIBUTING.md` — en **[BI]** `DATAPLATFORM.md`, `DATAMODEL.md`, `RAPPORTAGES.md`, `GLOSSARY.md`, `README.md`, `CONTRIBUTING.md`.

### `CLAUDE.md`
Schrijf volledig opnieuw. Gebruik de antwoorden om alle `[placeholders]` in te vullen. Laat secties voor kritieke regels leeg of vul ze in met wat is opgegeven. Neem in Quick Facts de regel `- **Project Type:** Coding` of `- **Project Type:** BI` op, en laat de `File Update Discipline`-tabel en de `Documentation Map` de docs-set van dit type volgen.

### `docs/HANDOFF.md`
Schrijf de initiële handoff: datum van vandaag, project status uit stap 10, "Dit is de eerste sessie — nog geen werkende staat." Laat open items leeg.

### `docs/TODO.md`
Schrijf één TODO-bestand met secties per persoon (`## Gedeeld`, een `## <Naam>` per persoon uit Key people, `## Done (recent)`). Zet onder `## Gedeeld` het enige initiële item:
- **[Coding]** "Stel architectuurkeuzes vast en vul docs/ARCHITECTURE.md in."
- **[BI]** "Leg bronsystemen, laagindeling en refresh-schema vast in docs/DATAPLATFORM.md."

### `docs/DECISIONS.md` — **[Coding]**
Schrijf de header + instructie, nog geen ADR's.

> **[BI]** schrijf dit bestand niet. BI-projecten hebben geen ADR-flow — niet lokaal en niet in Notion.

### `.claude/developer`

Schrijf de actieve developer-identiteit (gitignored, per machine):

```
naam: <volledige naam uit vraag 9b>
email: <e-mail uit vraag 9b>
notion_id: <geresolved, zie hieronder>
```

**Notion user-ID resolven:**
- Alleen als `~/.claude/notion.md` bestaat én er een `Notion Workspace:` in CLAUDE.md staat (anders `notion_id` weglaten).
- Zoek de Notion-gebruiker via `notion-search` met `query_type: "user"` en het e-mailadres als `query`.
  - Eén match → gebruik diens user-ID.
  - Geen/meerdere matches → toon kandidaten (naam + e-mail), laat kiezen, of laat `notion_id` leeg met de melding "Notion-ID niet geresolved — AssignedTo wordt niet gezet tot je dit aanvult".

### `docs/ARCHITECTURE.md` — **[Coding]**
Schrijf de sectiekoppen in, laat secties leeg.

### `docs/CONVENTIONS.md` — **[Coding]**
Schrijf de sectiekoppen in, laat secties leeg.

### `docs/DATAPLATFORM.md` — **[BI]**
Schrijf de sectiekoppen in (Bronsystemen, Warehouse, Laagindeling, Orchestratie & refresh, Externe afhankelijkheden), gevuld met wat uit vraag 3 bekend is. Laat de rest leeg.

### `docs/DATAMODEL.md` — **[BI]**
Schrijf de sectiekoppen in (Kernentiteiten & grain, Lineage, Businessdefinities, Naamgeving, Teststrategie), laat secties leeg.

### `docs/RAPPORTAGES.md` — **[BI]**
Schrijf de tabelheader in (naam, doelgroep, eigenaar, refresh-frequentie, onderliggende modellen), laat de tabel leeg.

### `docs/GLOSSARY.md`
Schrijf de tabelheader in, laat tabel leeg.

### `.claude/settings.local.json`
Schrijf het build command en run command in als toegestane commando's.

## Stap 2.5 — Notion Coding Project

Handel vraag 12 af afhankelijk van het antwoord:

**"nee":** Sla deze stap over.

**"ja":** Maak een projectpagina aan in de actieve workspace:

**Notion-config lezen:**
1. Controleer of `~/.claude/notion.md` bestaat → nee: sla alle Notion-stappen over
2. Lees `~/.claude/notion.md`; bestaat `.claude/notion.md` ook in het huidige project? → lees dat ook; project-level waarden overschrijven globale waarden per database-sleutel
3. Lees het `Notion Workspace:` veld uit `CLAUDE.md` (onder Quick Facts) → dit is de actieve workspace-naam
   → Geen `Notion Workspace:` veld: sla Notion-stappen over
4. Zoek onder `## Workspace: <naam>` de benodigde collection-IDs op (Projecten data source, Coding area, Coding template ID, Sessielogboek data source)

1. Maak een pagina in de Projecten database van de workspace via `notion-create-pages`, **vanuit de Notion page-template** — niet met zelfgeschreven content. Fetch de Projecten-database via `notion-fetch`, lees de `page_templates`-lijst en geef het juiste template-ID mee als `template_id` (dan géén `content` meegeven):

   | | Page-template | `Project Type` |
   |---|---|---|
   | **[Coding]** | "Nieuw Code Project" | `Coding` |
   | **[BI]** | "Nieuw BI Project" | `BI` |

   Properties:
   - `Project Naam`: `[projectnaam]` (of `[hoofdproject] Coding` als het een zijtak is)
   - `Project Type`: zie tabel
   - `Project status`: `On track`
   - `Areas`: **[Coding]** koppel aan de Coding area van die workspace. **[BI]** vraag welke area erbij hoort — de Coding area is voor een BI-project meestal niet de juiste. Weet de gebruiker het niet, laat de relatie dan leeg in plaats van 'm fout te vullen.

   > **Waarom via de template?** De projectpagina bevat gekoppelde database-views (Taken, Sessielogboek, Dag Rapporten, Nacht Rapporten, bij Coding ook ADR's) die gefilterd zijn op `Project = deze pagina`. Notion herschrijft die zelfverwijzing bij het instantiëren van een template; via de API kan het niet, want de view-DSL negeert `relation`- en `status`-filters stilzwijgend. Zelf gebouwde views tonen álle taken van álle projecten.

   Bestaat de template niet? Meld dat, maak de pagina met properties en tekstsecties zonder gekoppelde views, en zeg erbij dat de template eenmalig in Notion aangemaakt moet worden.

2. Werk de content bij met projectspecifieke info via `notion-update-page` — **[Coding]** stack, repo, commando's; **[BI]** bronsystemen, warehouse, refresh-schema, rapportages. Raak de gekoppelde database-blokken niet aan.
3. Voeg de URL van de aangemaakte pagina toe aan `CLAUDE.md` onder Quick Facts als `Notion Coding Project`. Die veldnaam is voor beide types gelijk.

## Stap 2.6 — Git & GitHub

Handel vraag 11 af afhankelijk van het antwoord:

**"later":** Sla deze stap over. Vermeld in de bevestiging dat de repo nog aangemaakt moet worden.

**URL opgegeven of "aanmaken":** Vraag eerst naar de SSH-alias:

> Lees `~/.ssh/config` en zoek alle `Host`-entries waarvan `HostName github.com` is. Toon de gevonden aliassen en vraag: "Welke SSH-alias moet ik gebruiken voor deze repo? (of 'geen' als je de standaard `github.com` wilt gebruiken)"

Vervang vervolgens `github.com` in de remote URL met de gekozen alias. Bijvoorbeeld: `git@github.com:user/repo.git` → `git@MijnAlias:user/repo.git`.

**URL opgegeven (repo bestaat al):** Noteer de (aangepaste) URL in `CLAUDE.md` onder Quick Facts. Voer geen git-commando's uit tenzij er nog geen `.git`-map is.

**"aanmaken":** Vraag bevestiging voor elke actie en voer daarna stap voor stap uit:
1. Genereer `.gitignore` op basis van de gekozen stack (Node, Python, .env, OS-bestanden)
2. `git init && git branch -m main`
3. `git add CLAUDE.md docs/ .claude/ .gitignore`
4. Laat de commit message zien en vraag bevestiging: `git commit -m "project initialisatie"`
5. Vraag of de repo-naam klopt, dan: `gh repo create [projectnaam] --private --source=. --remote=origin --push`

## Stap 3 — Bevestiging

Toon een samenvatting van wat er aangemaakt is en welke bestanden nog handmatig aangevuld moeten worden. Geef daarna het advies: "Gebruik `/start-session` om elke volgende sessie te starten."
