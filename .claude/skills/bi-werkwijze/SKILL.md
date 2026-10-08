---
name: bi-werkwijze
description: Use when working in a klant-repo (root CLAUDE.md has "Repo-vorm: Klant-repo") or on Power BI / SQL projects kept in GitHub - where files belong (GitHub vs OneDrive), GitHub naming, the process model from pull to publish, data source and refresh setup, and new client deliveries. Also use when creating or converting a klant-repo.
---

# BI-werkwijze: dashboards en datamodellen in GitHub

Besloten door Kevin en Max op 2026-09-25. Een klant-repo is één GitHub-repo per klant met een submap per project; zie `.claude/rules/klant-repo.md` voor hoe de commands het actieve project bepalen.

## Wat staat waar

| Waar | Wat | Waarom |
|---|---|---|
| GitHub, lokaal `C:\dev\klanten\bi_<klant>` | Power BI-projecten (`.pbip`, TMDL, PBIR), SQL, Python, Markdown (docs, onderzoek, KPI-analyses) | Tekstbestanden waarin Desktop en Claude schrijven. `git pull` geeft de laatste versie, een wijziging komt in zijn geheel binnen of niet |
| OneDrive-klantmap | Aanleveringen, Excel, pdf, presentaties, voorstellen, uitvoer van importscripts | Klantdata en Office-bestanden: samen bewerken en delen; nooit in Git |

**Nooit Git en OneDrive op dezelfde map.** OneDrive zet onaf werk van een collega in jouw map, synchroniseert de `.git`-map mee (beschadigde repo) en kent de `.gitignore` niet.

## Naamgeving

| Wat | Patroon | Voorbeeld |
|---|---|---|
| Repo | `bi_<klant>` in `git-finnit`, snake_case | `bi_ultimoo` |
| Submap = project | `<onderwerp>`, snake_case | `finance_dashboard`, `dmt_ultimoo` |
| Commit | Nederlands, gebiedende wijs | `Voeg Planning-pagina toe` |

Toegang loopt via het GitHub-team `bi` (schrijfrechten). Notion: Area = klant (relatie `Repositories` naar de repo), projectpagina = submap.

## Procesmodel

| Situatie | Wat Claude doet |
|---|---|
| 1. Volledig nieuw dashboard, nog geen repo | `/inrichten`: maakt de klant-repo, de submap, docs en Notion-projectpagina |
| 2. Repo bestaat, niet lokaal | `/inrichten` in `C:\dev\klanten` (haalt de repo op), daarna Claude in de hoofdmap en `/start-session <submap>` |
| 3. Dashboard bestaat alleen in de Service | `/inrichten`: geeft de download- en opslaan-als-`.pbip`-stappen, legt vast en richt het project in |
| 4. Alles lokaal | `/start-session <submap>` (doet `git pull`) |

### Vastleggen

1. `git status`: geen `.pbix`, `.abf`, `.xlsx`, `.xls`, `.csv`, `.pdf` of `.pptx`. Staat er een, niet committen: melden.
2. `git add` van alleen het actieve project, commit, `git pull`, `git push`. Geen branches, geen PR's.

### Publiceren

Standaard handmatig, voor elke klant (automatisch publiceren vraagt Fabric- of Premium-capaciteit in de tenant van de klant).

1. Alleen na een gelukte push.
2. De gebruiker opent de `.pbip` in Desktop, klikt **Vernieuwen**, dan **Publiceren**, kiest de workspace en bevestigt **Vervangen**.
3. Nooit meer wijzigen in de Power BI Service zelf.

### Eerste publicatie van een nieuw dashboard

1. Service → semantic model → **Instellingen → Gegevensbronreferenties → Referenties bewerken** (Dataverse: OAuth2, organisatie-account; on-premises: gateway koppelen).
2. **Geplande vernieuwing** aanzetten, tijdstippen kiezen, foutmelding naar het vaste adres.
3. **Nu vernieuwen** en in de vernieuwingsgeschiedenis controleren dat het gelukt is.
4. Het dashboard toevoegen aan het monitoringdashboard.

## Nieuwe aanleveringen van de klant

De klant levert in de OneDrive-klantmap (`Aangeleverde bestanden\`). Heeft een project een leveringenlog (`docs/LEVERINGEN.md`), dan vergelijkt `/start-session` de map op naam, datum en grootte met dat log en meldt nieuwe of gewijzigde bestanden. Open de bestanden daarbij niet: zie `.claude/rules/datatoegang.md`.

## Klantdocumenten erbij

Claude kan naast de repo ook de OneDrive-klantmap lezen: `claude --add-dir "<OneDrive-klantmap>"`, `/add-dir` in een lopende sessie, of `permissions.additionalDirectories` in `.claude/settings.local.json` (pad verschilt per gebruiker, dus niet in de gedeelde settings).
