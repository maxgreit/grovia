---
description: Stap van /inrichten (gebruik bij voorkeur /inrichten). Zorg dat de klant-repo bi_<klant> lokaal bestaat, op GitHub staat (team bi) en aan de Notion-Area van de klant hangt. Maakt aan wat ontbreekt; veilig om opnieuw te draaien.
---

TEMPLATE_DIR=

Dit command regelt de **klant-repo** zelf, niet de projecten erin. Een project (submap) inrichten doet `/start-project` of `/apply-template`. Achtergrond: skill `bi-werkwijze` en `.claude/rules/klant-repo.md` (in de template-repo: `TEMPLATE_DIR/.claude/rules/klant-repo.md`).

Het command is idempotent: bestaat iets al, dan controleert het de koppeling en gaat door. Gebruik het ook om een repo op te zoeken en te koppelen die nog niet gekoppeld is.

## Stap 0 — Template-map en gereedschap

1. **TEMPLATE_DIR**: gebruik de waarde hierboven. Is die leeg, lees dan `.claude/.template-source` in de huidige map; bestaat die niet, lees de `TEMPLATE_DIR=`-regel uit `~/.claude/commands/install-template.md`. Nog steeds leeg: meld dat `/setup-machine` eerst gedraaid moet worden en stop.
2. **GitHub CLI**: `gh auth status`. Niet geïnstalleerd: stel `winget install --id GitHub.cli -e` voor. Niet ingelogd: vraag de gebruiker zelf `gh auth login` te draaien in een eigen terminal (GitHub.com → HTTPS → Yes → browser) en wacht. Claude kan die login niet doen.
3. **KLANTEN_DIR**: `C:\dev\klanten` op Windows, `~/dev/klanten` elders. Maak de map aan als hij ontbreekt.

## Stap 1 — Klant en namen

1. Vraag de klantnaam zoals hij in Notion staat (bijv. "Holland Gold").
2. Leid de reponaam af in snake_case: `bi_` + klantnaam in kleine letters, spaties en koppeltekens → `_`, overige leestekens weg (`bi_holland_gold`). Laat bevestigen of aanpassen.
3. `REPO` = `git-finnit/<reponaam>`, `PAD` = `KLANTEN_DIR/<reponaam>`.

## Stap 2 — Lokaal, GitHub of nieuw

**a. `PAD` bestaat en is een git-repo met remote `origin`** → controleer dat de remote naar `REPO` wijst (anders melden en stoppen), draai `git -C PAD pull`, ga naar stap 3.

**b. `PAD` bestaat niet, `gh repo view REPO` slaagt** (procesmodel situatie 2) → `gh repo clone REPO PAD`, ga naar stap 3.

**c. Nergens te vinden** → nieuwe klant-repo:

1. Vraag het pad van de OneDrive-klantmap (bijv. `…\Finn it - Dashboards\19. Ultimoo`) en controleer dat hij bestaat. Geen klantmap: laat het veld open (`<!-- onbekend — vul aan -->`).
2. `mkdir PAD`, dan `bash TEMPLATE_DIR/install.sh PAD` (kopieert `.claude/` en registreert de repo in `projects.txt`).
3. Schrijf `PAD/.gitignore` (tekst onder *Bijlage A*), `PAD/CLAUDE.md` (tekst onder *Bijlage B*, ingevuld; de Notion-Area volgt in stap 4) en `PAD/docs/DECISIONS.md` voor de klantbesluiten (tekst onder *Bijlage D*).
4. Leg vast en zet op GitHub:
   ```
   git -C PAD init -b main
   git -C PAD add .gitignore CLAUDE.md docs .claude
   git -C PAD commit -m "Maak klant-repo <reponaam> aan"
   gh repo create REPO --private --source=PAD --remote=origin --push
   gh api -X PUT orgs/git-finnit/teams/bi/repos/REPO -f permission=push
   ```
   Kan de repo niet worden aangemaakt (geen rechten in `git-finnit`), meld dat en stop; de lokale map blijft staan.

## Stap 3 — Controles op de repo

1. **Niet in OneDrive**: bevat `PAD` `OneDrive` of het pad van de gesynchroniseerde SharePoint-bibliotheek (`Finn it - Klanten - Documenten`), meld dan waarom dat niet mag (Git en OneDrive op één map beschadigen de repo) en stop.
2. **Team**: `gh api repos/REPO/teams`. Ontbreekt `bi`, koppel het (zie stap 2c.4).
3. **Privé**: `gh api repos/REPO --jq .visibility` moet `private` zijn; anders melden.
4. **Klant-repo-markering**: heeft `PAD/CLAUDE.md` geen regel `- **Repo-vorm:** Klant-repo`, bied dan aan de klantniveau-`CLAUDE.md` uit *Bijlage B* aan te vullen (bestaande inhoud behouden).
5. **Geen data**: `git -C PAD ls-files` mag geen `.pbix`, `.abf`, `.xlsx`, `.xls`, `.csv`, `.pdf` of `.pptx` bevatten. Staat er een, meld het en stel voor het uit de repo te halen; klantdata in de geschiedenis moet Kevin beoordelen.

## Stap 4 — Notion

Lees `~/.claude/notion.md` (en `PAD/.claude/notion.md` als die bestaat). Workspace = het `Notion Workspace`-veld uit `PAD/CLAUDE.md`, standaard `finnit`. Nodig: de sleutels `areas` en `repositories`. Ontbreken ze, meld dat `/setup-machine` ze toevoegt en sla deze stap over.

1. **Area**: zoek in `areas` op `Area Naam` = klantnaam. Niet gevonden: vraag bevestiging en maak hem aan (`Area Naam` = klantnaam, `Area Status` = Actief). Zet de URL in `PAD/CLAUDE.md` bij `Notion Area`.
2. **Repositories**: zoek in `repositories` op `Repo` = reponaam. Deze database wordt gevuld door een automatische koppeling met GitHub, dus een nieuwe repo staat er vaak pas de volgende dag in.
   - Gevonden: zet op die pagina `Area` = de Area-URL (de relatie is tweezijdig; op de Area heet hij `Repositories`).
   - Niet gevonden: maak geen eigen pagina aan (dat geeft dubbelingen). Meld dat de koppeling volgt en dat dit command later opnieuw gedraaid kan worden.

## Stap 5 — OneDrive-klantmap

Bestaat de klantmap en staat er geen `Dashboards.md`, schrijf die (tekst onder *Bijlage C*). Zo weet iedereen die de OneDrive-map opent waar de dashboards staan.

## Stap 6 — Vastleggen en melden

1. Is `PAD/CLAUDE.md` gewijzigd: commit (`Werk klant-repo-gegevens bij`), `git pull`, `git push`.
2. Meld per onderdeel: wat al bestond, wat is aangemaakt, wat is gekoppeld en wat nog openstaat (bijv. de Repositories-koppeling).
3. Volgende stap: start Claude Code in `PAD` (de hoofdmap) en richt een project in met `/start-project` (nieuw) of `/apply-template` (bestaande submap).

---

## Bijlage A — `.gitignore`

```
# Data en exports: nooit in Git (klantdata blijft in OneDrive)
*.pbix
*.abf
**/.pbi/localSettings.json
*.xlsx
*.xls
*.xlsm
*.csv
*.parquet
*.pdf
*.pptx
*.docx
**/import-output/

# Secrets
.env
.env.*

# Tijdelijke en gegenereerde bestanden
~$*
Thumbs.db
.DS_Store
__pycache__/
**/.superpowers/

# AI — lokale bestanden niet committen, commands en skills wel
.claude/settings.local.json
.claude/.template-source
.claude/.DS_Store
.claude/worktrees/
.claude/developer
.claude/actief-project
```

## Bijlage B — `CLAUDE.md` op klantniveau

```
# Klant-repo: <Klant>

## Quick Facts

- **Repo-vorm:** Klant-repo
- **Klant:** <Klant>
- **GitHub Repo:** [`git-finnit/<reponaam>`](https://github.com/git-finnit/<reponaam>) — team **bi**; lokaal `<PAD>` (nooit onder OneDrive)
- **Notion Area:** [<Klant>](<Area-URL>)
- **Notion Workspace:** finnit
- **Klantdata (OneDrive):** `<pad naar de OneDrive-klantmap>`
- **Taal:** Nederlands

## Projecten

Elke submap is één project met een eigen `CLAUDE.md`, `docs/` en Notion-projectpagina. **Start Claude Code in deze hoofdmap** en kies het project met `/start-session <submap>`.

| Submap | Onderdeel | Notion-project | Hangt af van | Inhoud |
|---|---|---|---|---|

## Wat staat waar

| Waar | Wat |
|---|---|
| Deze repo | Power BI-projecten (PBIP), SQL, Python, Markdown-docs |
| OneDrive-klantmap | Aanleveringen, Excel, pdf, presentaties, importuitvoer — nooit in Git |

Klantbesluiten (gelden voor alle projecten): `docs/DECISIONS.md`, genummerd K-NNN.

Werkwijze, naamgeving en procesmodel: skill `bi-werkwijze`. Actief project en git-regels: `.claude/rules/klant-repo.md`.
```

## Bijlage C — `Dashboards.md` in de OneDrive-klantmap

```
# Dashboards <Klant>

De dashboards en datamodellen van <Klant> staan niet in OneDrive maar in GitHub:

- Repo: https://github.com/git-finnit/<reponaam> (team bi)
- Lokaal: C:\dev\klanten\<reponaam> — ophalen via Claude Code: "/koppel-klant-repo"

Klantdata (aanleveringen, Excel, pdf, presentaties) blijft in deze OneDrive-map en komt nooit in Git.
```

## Bijlage D — `docs/DECISIONS.md` in de hoofdmap

```
# Klantbesluiten

Besluiten die voor alle projecten van deze klant gelden, genummerd K-NNN. Project-ADR's staan in `<submap>/docs/DECISIONS.md` en mogen hiernaar verwijzen ("volgt uit K-003"). In Notion hangen klantbesluiten aan de Area van de klant.

## Format

## K-NNN: [Titel]

- **Datum:** YYYY-MM-DD
- **Status:** Accepted | Superseded door K-NNN
- **Beslissing:** …
- **Reden:** …
- **Gevolgen:** welke projecten dit raakt en wat er daar door verandert
```
