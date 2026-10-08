---
description: Genereer handoff document voor de volgende sessie
---

Lees eerst BLOK-A hieronder. Werk `docs/HANDOFF.md` bij door een nieuw, geattribueerd sessieblok te **prependen** (nieuwste bovenaan, direct onder de `# Handoff` H1) — niet het hele bestand overschrijven.

**Developer-identiteit lezen:**
1. Bestaat `.claude/developer` niet? → developer onbekend; gebruik "onbekend" als naam in de kop en sla de commit-trailer over.
2. Lees `.claude/developer`. Verwacht formaat (3 regels): `naam:`, `email:`, `notion_id:`.
3. Backwards-compat: één regel zonder `naam:`-prefix = de volledige naam; email/notion_id ontbreken dan.
4. Afgeleiden: `VOLLEDIGE_NAAM` = waarde van `naam`; `KORTE_NAAM` = eerste woord van `naam`.

**Klant-repo:** staat in de Quick Facts van de `CLAUDE.md` in de hoofdmap `- **Repo-vorm:** Klant-repo`, bepaal dan het actieve project `<P>` volgens `.claude/rules/klant-repo.md` (normaal staat het al in `.claude/actief-project`). In dit hele command betekent `CLAUDE.md` dan `<P>/CLAUDE.md` en `docs/…` de map `<P>/docs/…`; git-uitvoer (`git log`, `git diff`) beperk je met `-- <P>/`. Geen klant-repo: `<P>` = `.`, niets verandert.

**Meerdere actieve projecten** (meerdere regels in `.claude/actief-project`): doorloop stap 1–9 per project, elk met een eigen HANDOFF-blok en eigen TODO, met alleen wat bij dat project hoort. In stap 10–11 maak je **één** sessielog-regel met `Project` = alle actieve projecten; taken en ADR's gaan elk naar hun eigen project (of naar de Area bij een klantbesluit). Stap 12 wordt één commit over alle actieve projecten.

**Projecttype lezen:** lees `- **Project Type:**` uit de Quick Facts van `CLAUDE.md`. Waarde is `Coding` of `BI`. **Ontbreekt het veld → `Coding`.** Waar hieronder **[Coding]** of **[BI]** staat, geldt dat blok alleen voor dat type.

Het sessieblok heeft deze vorm (de checklist hieronder vult de inhoud):

```
## YYYY-MM-DD — KORTE_NAAM

**Branch:** … **Commit:** … **Build:** …

### Wat er deze sessie is gebeurd
…

### Open items / Next steps
…

### Belangrijke context die niet mag verdwijnen
…
```

Na het prependen: trim `docs/HANDOFF.md` tot de **5 nieuwste** `## YYYY-MM-DD — …`-blokken (oudere blokken verwijderen; de `# Handoff` H1 blijft staan). Oudere overdrachten blijven in git-history.

Checklist:

1. **Datum bovenaan:** vandaag
2. **Project status:** huidige fase (bijv. greenfield, MVP, maintenance mode)
3. **Laatste werkende staat:**
   - `git branch --show-current`
   - `git log -1 --oneline`
   - Run het build command uit CLAUDE.md — rapporteer het echte resultaat
4. **Wat er deze sessie is gebeurd:** 2-4 zinnen, concreet en feitelijk. Geen vage samenvattingen.
5. **Git wijzigingen:**
   - Indien commits gedaan: `git diff --stat HEAD~N HEAD` (N = aantal commits deze sessie)
   - Indien alleen working copy changes: `git diff --stat`
6. **Open items / Next steps:** concreet, geordend op prioriteit. Geen "misschien X" — "doe X".
7. **Belangrijke context die niet mag verdwijnen:** ontdekkingen, workarounds, gotchas uit deze sessie die niet elders zijn gedocumenteerd.
7b. **Doc-drift signals voor `/dag-afsluiting`.** Loop deze sessie langs en spot wijzigingen die één van de waarheid-docs raken. Welke tabel je gebruikt, hangt af van het projecttype.

    **[Coding]**

    | Trigger | Target-doc |
    |---|---|
    | Nieuwe service / middleware / area / hook-pipeline / pipeline-aanpassing | `ARCHITECTURE.md` |
    | Nieuw code-pattern of project-conventie (naming, hooks, attributes) | `CONVENTIONS.md` |
    | Nieuwe domein-term, rol, status, business-concept | `GLOSSARY.md` |
    | Wijziging in dev-setup, URL, credential, connection string, scripts, ports | `README.md` |
    | Wijziging in branch-flow, commit-regels, samenwerk-process, PR-flow | `CONTRIBUTING.md` |

    **[BI]**

    | Trigger | Target-doc |
    |---|---|
    | Nieuwe bron of connectie, gewijzigd refresh-schema, nieuwe laag of omgeving | `DATAPLATFORM.md` |
    | Nieuw of gewijzigd mart-model, gewijzigde grain, aangepaste metriek-definitie, nieuwe test | `DATAMODEL.md` |
    | Nieuw of vervallen dashboard, gewijzigde doelgroep of eigenaar, andere refresh-frequentie | `RAPPORTAGES.md` |
    | Nieuwe domein-term, dimensie, status, business-concept | `GLOSSARY.md` |
    | Wijziging in dev-setup, URL, credential, connection string, scripts, ports | `README.md` |
    | Wijziging in branch-flow, commit-regels, samenwerk-process, PR-flow | `CONTRIBUTING.md` |

    Voor elk gespot signal: zorg dat `docs/DOC-SIGNALS.md` bestaat (maak aan met standaard header als het ontbreekt — zie format hieronder), en append onderaan dit format:

    ```
    ## YYYY-MM-DD — sessie N — TARGET-DOC

    **Wat:** [beschrijving]
    **Code:** [bestanden]
    **Commit:** [hash]
    **Voorgestelde plek:** [hint voor /dag-afsluiting]
    ```

    Standaard header voor een nieuw aangemaakt DOC-SIGNALS.md (gebruik alleen als file ontbreekt):

    ```
    # Doc-drift signals — buffer voor /dag-afsluiting

    Append-only door `/handoff`. Geleegd door `/dag-afsluiting` in dezelfde commit als de doc-updates.

    ---
    ```

    **Niet zelf de waarheid-doc aanraken** — dat is `/dag-afsluiting`'s job. Als geen signals: niets toevoegen (geen lege entry).
8. **Nieuwe ADR's nodig?** Als er architecturale of datamodel-keuzes zijn gemaakt, append naar `docs/DECISIONS.md`. Bestaat dat bestand niet (bijv. een BI-project van vóór 2026-09-30), maak het dan aan met de kop `# Architectural Decision Records` en een regel uitleg.
   **Klant-repo: project- of klantbesluit?** Vraag per nieuw besluit of het alleen voor dit project geldt of voor alle projecten van de klant (bijv. een rekenregel, een bron-eigenaardigheid of een afspraak met de klant die elk dashboard raakt). Het antwoord bepaalt waar het besluit komt:
   - **Project** → `<P>/docs/DECISIONS.md`, nummering `ADR-NNN` (volgt het hoogste nummer in dat bestand).
   - **Klant** → `docs/DECISIONS.md` in de **hoofdmap**, nummering `K-NNN` (volgt het hoogste K-nummer). Bestaat het bestand niet, maak het aan met de kop `# Klantbesluiten` en de regel "Besluiten die voor alle projecten van deze klant gelden. Project-ADR's staan in `<submap>/docs/DECISIONS.md`." Een project-ADR mag naar een klantbesluit verwijzen ("volgt uit K-003").
9. **Update `docs/TODO.md`** (één bestand met secties `## Gedeeld`, `## <naam>` per persoon, `## Done (recent)`):
   - Afgevinkte items deze sessie → verplaats naar `## Done (recent)` met `(YYYY-MM-DD, KORTE_NAAM)` erachter; trim die sectie op de ~15 meest recente.
   - Nieuwe persoonlijke items → onder `## KORTE_NAAM` (maak de sectie aan als die ontbreekt).
   - Nieuwe items die het hele team raken → onder `## Gedeeld`.
   - Items die nu geblokkeerd zijn: markeer inline met `(geblokkeerd: reden)` in de eigen sectie.

**Developer-identiteit (geldt voor AssignedTo in stap 10 en 11):** lees `.claude/developer` zoals beschreven bovenaan dit command; gebruik `notion_id` als AssignedTo-waarde. Ontbreekt `notion_id`: zet AssignedTo niet en meld dit kort.

**Notion-config lezen (geldt voor stap 10 en 11):**
1. Controleer of `~/.claude/notion.md` bestaat → nee: sla stap 10 en 11 volledig over
2. Lees `~/.claude/notion.md`; bestaat `.claude/notion.md` ook in het huidige project? → lees dat ook; project-level waarden overschrijven globale waarden per database-sleutel
3. Lees het `Notion Workspace:` veld uit `CLAUDE.md` (onder Quick Facts) → dit is de actieve workspace-naam
   → Geen `Notion Workspace:` veld: sla stap 10 en 11 over
4. Zoek onder `## Workspace: <naam>` de benodigde collection-IDs op:
   - `tasks` → taken-database (stap 10)
   - `sessielogboek` → sessielogboek-database (stap 11)
   - `adr` → ADR-database (stap 11)

10. **Notion Taken synchroniseren** (als `CLAUDE.md` een `Notion Coding Project` URL bevat):
    - Taken database:
      - Gebruik het `tasks:` veld uit de Notion-config (zie blok hierboven)
    - **Notion → TODO.md:** Gebruik `notion-search` om taken van dit project op te halen. Voor elke taak met Status "Done" die nog als open item in `docs/TODO.md` staat: verplaats die naar de Done sectie.
    - **Nieuwe taken aanmaken (gegroepeerd per feature):** Vergelijk de vorige `docs/HANDOFF.md` Open items met de nieuwe Next Up in `docs/TODO.md`. Houd de taakhiërarchie aan — **Project → feature-Taak → subtaken** (zie "Notion taakhiërarchie" in `CLAUDE.md`). Maak **geen** reeks losse, ongegroepeerde taken voor één feature.
      - **Bepaal per nieuw item bij welke feature het hoort.** Items die samen één feature vormen, krijgen één gedeelde feature-Taak als parent.
      - **Feature-Taak (parent):** zoek via `notion-search` of er voor dit project al een taak met die feature-naam bestaat. Zo niet, maak 'm aan met properties `Taak` (feature-naam), `Status` ("Not started"), `Type` (["Programmeren"]), `Project` (JSON-array: `["https://..."]`). **Geen** `Parent item`.
      - **Subtaken (children):** maak voor elk concreet item een taak met dezelfde properties én `Parent item` = JSON-string met de URL van de feature-Taak (`"https://app.notion.com/p/<feature-taak-url>"`). De `Parent item`-relatie heeft limit 1; Notion vult `Sub-item` automatisch op de parent.
      - Staat een item op zichzelf (geen onderdeel van een grotere feature)? Maak dan één enkele taak zonder `Parent item`.
      - Nesting mag dieper dan twee niveaus: een subtaak mag zelf weer subtaken krijgen (`Parent item` → de subtaak). Gebruik die diepte alleen waar het de structuur echt verheldert.
      - Voeg op elke taak toe: `AssignedTo` (Person) = de `notion_id` uit `.claude/developer`, mits aanwezig.
      > Klopt een property-naam (`AssignedTo`, `Parent item`) niet met het database-schema? Fetch de data source via `notion-fetch` en gebruik de werkelijke kolomnaam.
    - **Voltooide taken sluiten:** Voor elk item dat deze sessie naar Done is verplaatst: zoek de Notion-taak via `notion-search` op taaknaam, update `Status` naar "Done" via `notion-update-page`
11. **Notion Coding Project updaten** (als `CLAUDE.md` een `Notion Coding Project` URL bevat):
    - Fetch de coding project pagina via `notion-fetch`
    - Maak een nieuwe sessie-entry aan in de Sessielogboek database via `notion-create-pages`:
      - Parent data_source_id:
        - Gebruik het `sessielogboek:` veld uit de Notion-config (zie blok hierboven)
      - Properties: `Sessie` (korte sessietitel), `date:Datum:start` (vandaag, YYYY-MM-DD), `date:Datum:is_datetime` (0), `Project` (URL van het coding project uit CLAUDE.md als JSON-array), `Status` ("Gedaan")
      - Voeg toe: `AssignedTo` (Person) = de `notion_id` uit `.claude/developer`, mits aanwezig.
      - Content: samenvatting van de sessie (wat gedaan, gotchas/beslissingen)
    - Update de projectsectie op de pagina via `notion-update-page` als er iets is veranderd — **[Coding]** de **Tech Stack** sectie, **[BI]** de secties *Context* + *Databronnen* (vanuit `docs/DATAPLATFORM.md`), *Datamodel* (vanuit `docs/DATAMODEL.md`) en *Rapportages* (vanuit `docs/RAPPORTAGES.md`). Raak de gekoppelde database-blokken niet aan.
    - Zijn er nieuwe ADR's gemaakt deze sessie? Maak dan voor elke ADR een entry aan in de ADR database via `notion-create-pages`:
      - Parent data_source_id:
        - Gebruik het `adr:` veld uit de Notion-config (zie blok hierboven)
      - Properties: `ADR` (bijv. "ADR-004: Naam van de beslissing"), `Project` (URL van het coding project uit CLAUDE.md als JSON-array), `Status` ("Geaccepteerd" voor geaccepteerde ADRs, "Vervangen" voor vervangen ADRs), `date:Datum:start` (vandaag, YYYY-MM-DD), `date:Datum:is_datetime` (0)
      - **Klantbesluit (`K-NNN`)**: zet géén `Project` maar `Area` = de `Notion Area`-URL uit de `CLAUDE.md` van de hoofdmap (JSON-array), en begin de titel met het K-nummer ("K-003: …"). Zo staat het besluit op de Area-pagina en geldt het voor elk project, ook latere.
      - Content: achtergrond, beslissing, alternatieven overwogen, consequenties

Na het schrijven: toon zowel de nieuwe HANDOFF.md als de geüpdatete TODO.md voor review.

12. **Alleen in een klant-repo: vastleggen en pushen.** De werkwijze is direct op `main` (skill `bi-werkwijze`).
    1. `git status`: staat er een `.pbix`, `.abf`, `.xlsx`, `.xls`, `.csv`, `.pdf` of `.pptx` tussen, stop en meld het.
    2. Staan er wijzigingen buiten `<P>/` (behalve de `CLAUDE.md` van de hoofdmap), neem die niet mee en noem ze in je melding.
    3. `git add <P>/` (bij meerdere actieve projecten: elk `<P>/`; en `CLAUDE.md` en `docs/` van de hoofdmap als die gewijzigd zijn), commit met een korte Nederlandse omschrijving van de sessie, dan `git pull` en `git push`.
    4. Mislukt de push, meld de fout; niet forceren.

## Commits in deze sessie

Bevat `.claude/developer` een `naam` + `email`? Voeg dan aan élke commit die je in deze sessie maakt een attributie-trailer toe (naast de bestaande Claude-trailer):

```
Co-Authored-By: VOLLEDIGE_NAAM <email>
Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

Ontbreekt `.claude/developer` of de e-mail: laat de developer-trailer weg.

Belangrijk: evidence before assertions. Geen "alles werkt" zonder build check. Geen "klaar" zonder git status check.
