---
description: Richt een project in met de Finn it-werkwijze — kijkt wat er staat, doet een voorstel (Coding of BI, klant-repo, nieuw of bestaand) en regelt repo, docs en Notion. Ook om een bestaande klant-repo op te halen.
---

TEMPLATE_DIR=

Dit is de enige ingang om een project of klant-repo in te richten. Het kijkt eerst wat er staat, doet één voorstel en voert daarna de juiste stappen uit. Die stappen staan in vier andere commands, die je hier als **stap-instructies** leest en uitvoert (niet de gebruiker laten typen):

| Stap-instructie | Waarvoor |
|---|---|
| `TEMPLATE_DIR/.claude/commands/koppel-klant-repo.md` | Klant-repo aanmaken of ophalen, team `bi`, Notion-Area, OneDrive |
| `TEMPLATE_DIR/.claude/commands/install-template.md` | Template (`.claude/`) in een map zetten (via `install.sh`) |
| `TEMPLATE_DIR/.claude/commands/apply-template.md` | Bestaand project scannen en docs, `CLAUDE.md` en Notion-pagina schrijven |
| `TEMPLATE_DIR/.claude/commands/start-project.md` | Nieuw, leeg project inrichten met vragen |

Neem antwoorden die in stap 2 al gegeven zijn over; vraag ze in de stap-instructies niet opnieuw (projecttype, klant-repo, klant, submap).

## Stap 0 — Voorbereiding

1. **TEMPLATE_DIR**: de waarde hierboven. Leeg? Lees `.claude/.template-source` in de werkmap, anders de `TEMPLATE_DIR=`-regel uit `~/.claude/commands/install-template.md`. Nog leeg: meld dat `/setup-machine` eerst moet draaien (vanuit de template-repo) en stop.
2. **Doelmap** = de werkmap (`pwd`).
   - Is dat `TEMPLATE_DIR` zelf: vraag waar het project staat, of dat het om een klant-repo gaat die nog niet lokaal is (dan wordt de doelmap `C:\dev\klanten`).
   - Ligt de werkmap in een submap van een klant-repo (een bovenliggende `CLAUDE.md` met `- **Repo-vorm:** Klant-repo`): doelmap = die hoofdmap, en de submap is het voorgestelde project.

## Stap 1 — Kijken wat er staat

Bekijk alleen namen en structuur; open geen databestanden (`.claude/rules/datatoegang.md`).

1. **Template en docs**: bestaan `.claude/`, `CLAUDE.md`, `docs/`? Staat `- **Repo-vorm:** Klant-repo` in de `CLAUDE.md`?
2. **Git**: is het een repo, met welke `origin`? Werkt `gh auth status`?
3. **Plek**: ligt de doelmap onder OneDrive (pad bevat `OneDrive` of `Finn it - Klanten - Documenten`)? Staat er dan een `.claude/` of `CLAUDE.md`, dan is het een **bestaand Claude-project in OneDrive**.
4. **Bronbestanden** (tot twee niveaus diep, `.git`, `node_modules` en `.claude` overslaan):
   - BI-signalen: `*.pbip`, `*.SemanticModel/`, `*.Report/`, `*.pbix`, `*.sql`, `dbt_project.yml`, `models/`
   - Coding-signalen: `package.json`, `*.csproj`, `*.sln`, `pyproject.toml`, `requirements.txt`, `go.mod`, `Cargo.toml`, `composer.json`, `pom.xml`
   - Geen van beide en de map is (vrijwel) leeg: **nieuw project**.
5. **Klant-repo**: welke submappen zijn er, en welke hebben al een eigen `CLAUDE.md`?

## Stap 2 — Eén voorstel, één bevestiging

Leid af en toon het voorstel als lijst, met per regel waarop het gebaseerd is:

| Onderdeel | Voorstel | Regel |
|---|---|---|
| Situatie | nieuw / bestaand / klant-repo ophalen | bronbestanden aanwezig of niet; lege map in `C:\dev\klanten` = ophalen of aanmaken |
| Type | `BI` of `Coding` | de signalen uit stap 1.4; allebei aanwezig → de meeste |
| Repo-vorm | klant-repo (BI) of losse repo (Coding) | al gemarkeerd → niet vragen |
| Klant | naam | uit `bi_<klant>`, de mapnaam (`19. Ultimoo` → Ultimoo) of de OneDrive-klantmap |
| Project(en) | submapnamen in snake_case | klant-repo: submappen met `.pbip`/`.sql` zonder `CLAUDE.md`; nieuw: een naam voorstellen (`finance_dashboard`) |
| Notion | Area en projectpagina opzoeken of aanmaken | — |

Vraag: *"Klopt dit? Bevestig, of pas een regel aan."* Wacht op het antwoord en neem correcties over.

**Stop in deze gevallen** (en zeg waarom):
- **Bestaand Claude-project in OneDrive dat een klant-repo moet worden**: omzetten (geschiedenis opschonen, klantdata eruit, submappen) is handwerk. Verwijs naar Kevin.
- **Coding-project of losse repo onder OneDrive**: stel voor het eerst naar `C:\dev\` te verplaatsen; Git en OneDrive horen niet op dezelfde map.

## Stap 3 — Uitvoeren

### Route BI: klant-repo

1. **Repo**: voer `koppel-klant-repo.md` uit met de klant uit stap 2. Resultaat: de hoofdmap `PAD` bestaat lokaal, staat op GitHub (privé, team `bi`) en hangt aan de Notion-Area. Werk vanaf hier in `PAD`.
2. **Dashboards die alleen in de Power BI Service staan**: geef de gebruiker per dashboard de stappen en wacht tot ze klaar zijn:
   1. Service → rapport → **Bestand → Dit bestand downloaden** → de kopie met gegevens, naar `Downloads`.
   2. Openen in Desktop → **Bestand → Opslaan als → Power BI-project (\*.pbip)** in `PAD/<submap>/`. Niets wijzigen, Desktop sluiten.
   3. Daarna: `git status` controleren op databestanden, vastleggen, `git pull`, `git push`, en de gedownloade `.pbix` uit `Downloads` verwijderen.
3. **Per project (submap)**: schrijf de submap naar `PAD/.claude/actief-project` en voer uit:
   - bronbestanden in de submap → `apply-template.md` (klant-repo-route, stap 0.6);
   - lege of nieuwe submap → `start-project.md` (vraag 0b: klant-repo).
4. Herhaal stap 3 voor elk project uit het voorstel.

### Route BI: losse repo, of Coding

1. Staat er nog geen `.claude/`: voer `install-template.md` uit (dat draait `install.sh` en daarna `apply-template`).
2. Staat `.claude/` er al:
   - bestaand project → `apply-template.md`;
   - nieuw project → `start-project.md` (inclusief de GitHub-vraag).

### Route: klant-repo ophalen

Is de situatie "ophalen" (de repo bestaat op GitHub maar niet lokaal): voer `koppel-klant-repo.md` uit. Die clonet en controleert de koppelingen; er hoeft verder niets ingericht te worden.

## Stap 4 — Afronden

1. Controleer: `git status` schoon (of alleen bewust niet-vastgelegde bestanden), geen `.pbix`, `.abf`, `.xlsx`, `.csv`, `.pdf` of `.pptx` in de repo, en elk project heeft een `CLAUDE.md` en `docs/HANDOFF.md`.
2. Meld wat er bestond, wat is aangemaakt en wat openstaat (bijv. een Repositories-koppeling in Notion die pas na de nachtelijke GitHub-koppeling kan).
3. Volgende stap:
   - klant-repo: *"Start Claude Code in `PAD` en typ `/start-session <submap>`."*
   - losse repo: *"Typ `/start-session`."*
