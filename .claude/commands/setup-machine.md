---
description: Eenmalige machine-setup voor de claude-project-template — installeert /inrichten en de stap-commands (install-template, koppel-klant-repo), vult projects.txt en configureert Notion
---

Voer de volgende stappen uit. Draai dit command altijd vanuit de **template-repo directory** (de map waar je dit command uitvoert is de template-repo zelf).

## Stap 1 — Machine-paden

### 1.1 TEMPLATE_DIR bepalen

Voer uit: `pwd`

Sla de uitvoer op als `TEMPLATE_DIR` voor de rest van dit command.

### 1.2 install-template.md installeren of reviewen

Controleer of `~/.claude/commands/install-template.md` bestaat.

**Bestaat niet:**
1. Lees `TEMPLATE_DIR/.claude/commands/install-template.md`
2. Vervang de regel `TEMPLATE_DIR=` door `TEMPLATE_DIR=<uitvoer van stap 1.1>`
3. Schrijf het resultaat naar `~/.claude/commands/install-template.md`
4. Meld: "✅ install-template.md geïnstalleerd in ~/.claude/commands/"

**Bestaat al:**
1. Lees `~/.claude/commands/install-template.md`
2. Zoek de `TEMPLATE_DIR=` regel en toon de huidige waarde
3. Vraag: "install-template.md gevonden. Huidig TEMPLATE_DIR: `<waarde>` — klopt dit nog? (Enter = ja, of geef nieuw absoluut pad)"
4. Schrijf daarna altijd de **actuele inhoud** uit `TEMPLATE_DIR/.claude/commands/install-template.md` naar `~/.claude/commands/install-template.md`, met de bevestigde of nieuwe waarde in de `TEMPLATE_DIR=`-regel. Anders blijft een oude versie van het command staan na een template-update.
5. Meld: "✅ install-template.md bijgewerkt (TEMPLATE_DIR: `<waarde>`)"

### 1.3 koppel-klant-repo.md installeren

`/koppel-klant-repo` moet werken vóórdat er een klant-repo bestaat, dus hij hoort machine-breed te staan, net als `install-template`.

1. Lees `TEMPLATE_DIR/.claude/commands/koppel-klant-repo.md`
2. Vervang de regel `TEMPLATE_DIR=` door `TEMPLATE_DIR=<uitvoer van stap 1.1>`
3. Schrijf het resultaat naar `~/.claude/commands/koppel-klant-repo.md` (bestaat hij al: overschrijven, er staan geen lokale aanpassingen in)
4. Meld: "✅ koppel-klant-repo.md geïnstalleerd in ~/.claude/commands/"

### 1.4 inrichten.md installeren

`/inrichten` is de ingang om een project of klant-repo in te richten, en moet dus overal werken. Installeer hem op dezelfde manier als 1.3: lees `TEMPLATE_DIR/.claude/commands/inrichten.md`, vervang `TEMPLATE_DIR=` door `TEMPLATE_DIR=<uitvoer van stap 1.1>` en schrijf naar `~/.claude/commands/inrichten.md`. Meld: "✅ inrichten.md geïnstalleerd in ~/.claude/commands/"

---

## Stap 2 — Projects scannen

### 2.1 Scanpad bepalen

Controleer of `TEMPLATE_DIR/projects.txt` bestaat en minstens één niet-lege regel bevat.

**Bestaat niet of leeg:**
Vraag: "Wat is het root-pad waar je projecten staan? (bijv. `/Users/naam/werk` of `C:\Users\naam\projects`)"
Sla het antwoord op als `SCANPAD`.

**Bestaat al:**
Lees de eerste regel uit `projects.txt` als hint voor het scanpad. Bepaal de gemeenschappelijke parent-map van de eerste regel als hint.
Vraag: "projects.txt gevonden. Wil je opnieuw scannen om nieuwe projecten toe te voegen of verouderde te verwijderen? (ja/nee)"
- "nee": meld "✅ projects.txt ongewijzigd" en ga naar Stap 3
- "ja": vraag "Bevestig het scanpad (bijv. de map die al je projecten bevat):" en sla het op als `SCANPAD`

### 2.2 Scan uitvoeren

Zoek recursief vanuit `SCANPAD` naar alle mappen die een `.claude/` submap bevatten. Sla `TEMPLATE_DIR` zelf over.

Toon de gevonden mappen als genummerde lijst:

```
Gevonden projecten:
1. /Users/naam/werk/project-a
2. /Users/naam/werk/project-b
...
```

Vraag: "Kloppen deze projecten? Geef kommagescheiden nummers op om te verwijderen (bijv. `3,7`), of druk Enter om alles te accepteren."

Verwijder de aangegeven nummers uit de lijst.

### 2.3 projects.txt schrijven

Schrijf de bevestigde lijst naar `TEMPLATE_DIR/projects.txt` (één absoluut pad per regel, geen lege regels).
Meld: "✅ projects.txt bijgewerkt met N projecten"

---

## Stap 3 — Notion-config

### 3.1 Bestaande config checken

Controleer of `~/.claude/notion.md` bestaat.

- **Bestaat niet:** Ga naar Stap 3.2 (wizard)
- **Bestaat al:** Ga naar Stap 3.3 (review)

### 3.2 Notion-wizard (eerste keer)

Vraag: "Gebruik je Notion voor projectbeheer? (ja/nee)"

Bij **"nee":** Meld "Notion-config overgeslagen. Je kunt dit later instellen door `/setup-machine` opnieuw te draaien." Ga naar Stap 4.

Bij **"ja":** Vraag: "Hoeveel Notion workspaces wil je configureren? (bijv. 1 of 2)"

> **Naamgeving — belangrijk voor samenwerking.** De workspace-naam koppelt een project (`Notion Workspace:` veld in CLAUDE.md, staat in git) aan een blok hieronder. Voor **gedeelde team-workspaces** (waar collega's ook aan werken) moet iedereen **dezelfde naam** gebruiken, anders vindt de lookup het blok niet. Voor **privé-workspaces** (alleen jij) maakt de naam niet uit: collega's zonder dat blok slaan de Notion-stappen automatisch over (graceful skip).

Herhaal voor elke workspace:

1. Vraag: "Naam van workspace [N]? (bijv. `mijnbedrijf` — geen spaties, lowercase. Gebruik voor gedeelde team-workspaces de met je team afgesproken naam.)"
2. Vraag voor elk van de databases de collection ID. Gebruik deze exacte vragen:
   - "Tasks database collection ID voor `[naam]`? (bijv. `collection://xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)"
   - "Projects database collection ID voor `[naam]`?"
   - "ADR database collection ID voor `[naam]`?"
   - "Sessielogboek database collection ID voor `[naam]`?"
   - "Nacht Rapporten database collection ID voor `[naam]`?"
   - "Dag Rapporten database collection ID voor `[naam]`?"
   - "Areas database collection ID voor `[naam]`? (Area = klant; gebruikt door `/koppel-klant-repo`)"
   - "Repositories database collection ID voor `[naam]`? (door de GitHub-koppeling gevuld)"

   Voor de workspace `finnit` zijn dat `collection://b4c693b7-2ec6-8370-8877-87596481d0cc` (Areas) en `collection://3633c203-9ff2-40dd-aef0-431085ab8912` (Repositories).

   Niet elke workspace heeft alle databases — laat een database weg als die niet bestaat voor deze workspace. De gebruiker kan dit aangeven met "n/a" of Enter.

   **Tip:** Je vindt de collection ID via Notion → open de database als full page → kopieer de page-link → de UUID in de URL is de database-ID. Schrijf het als `collection://UUID`.

Schrijf het resultaat naar `~/.claude/notion.md`:

```
# Notion Config

## Workspace: [naam]
- tasks: [collection ID]
- projects: [collection ID]
- adr: [collection ID]
- sessielogboek: [collection ID]
- nacht_rapporten: [collection ID]
- dag_rapporten: [collection ID]
- areas: [collection ID]
- repositories: [collection ID]

## Workspace: [naam2]
- tasks: [collection ID]
...
```

Meld: "✅ ~/.claude/notion.md aangemaakt met N workspace(s)"

### 3.3 Notion-config review (al geconfigureerd)

Lees `~/.claude/notion.md` en toon alle workspaces met hun database-IDs. Ontbreken `areas` of `repositories` in een workspace, vraag ze dan nu (zie de vragen in stap 3.2).

Voor elke workspace, vraag: "Workspace `[naam]` — klopt deze config nog? (ja / nee / verwijder)"

- **"ja":** geen actie voor deze workspace
- **"verwijder":** verwijder het volledige `## Workspace: [naam]` blok uit de config
- **"nee":** loop door alle 6 databases en vraag per database:
  "Huidige ID voor `[sleutel]`: `[id]` — klopt dit? (Enter = ja, of geef nieuwe collection ID)"
  Vervang bij een nieuw ID de waarde in de config.

Vraag na alle workspaces: "Wil je een nieuwe workspace toevoegen? (ja/nee)"
- Bij "ja": voer de wizard uit voor één nieuwe workspace (zie Stap 3.2, sla de intro-vraag over) en voeg het blok toe aan `~/.claude/notion.md`

Sla de bijgewerkte config op naar `~/.claude/notion.md`.
Meld: "✅ ~/.claude/notion.md bijgewerkt"

---

## Stap 3.5 — Developer-identiteit (`~/.claude/developer`)

Deze identiteit is de **standaard** developer voor élk project op deze machine (commit-attributie + Notion-toewijzing) — net als `~/.claude/notion.md`. Een project kan 'm per veld overschrijven via een eigen `.claude/developer` (gitignored).

Controleer of `~/.claude/developer` bestaat.

**Bestaat niet:**
1. Vraag: "Wat is je volledige naam? (voor commit-attributie)"
2. Vraag: "Wat is je e-mailadres?"
3. **Notion user-ID resolven** — alleen als `~/.claude/notion.md` bestaat (uit Stap 3). Zoek de gebruiker via `notion-search` met `query_type: "user"` en het e-mailadres als `query`. Eén match → diens user-ID; geen/meerdere matches → toon kandidaten en laat kiezen, of laat `notion_id` leeg. Bestaat er geen Notion-config: laat `notion_id` weg.
4. Schrijf naar `~/.claude/developer`:
   ```
   naam: <naam>
   email: <e-mail>
   notion_id: <geresolved of weggelaten>
   ```
5. Meld: "✅ ~/.claude/developer aangemaakt"

**Bestaat al:**
Lees `~/.claude/developer` en toon `naam` / `email` / `notion_id`. Vraag: "Klopt deze developer-identiteit nog? (Enter = ja, of geef correcties)". Werk de afwijkende velden bij en sla op. Meld "✅ ~/.claude/developer bijgewerkt" of "✅ Geen wijziging nodig".

---

## Stap 5 — Power BI: skill en databeveiliging

### 5.0 Databeveiliging (altijd uitvoeren)

Deze instellingen gelden voor elke machine, ongeacht of er Power BI-dashboards gebouwd worden. Ze voorkomen dat `.abf`- en `.pbix`-bestanden gelezen worden en dat DAX- of SQL-query's met klantdata stilzwijgend worden uitgevoerd. De inhoudelijke grens (wat mag, wat eerst gevraagd wordt) staat in `.claude/rules/datatoegang.md`, dat in elk project automatisch geladen wordt.

Voeg toe aan `~/.claude/settings.json` — **bestaande sleutels behouden**, alleen samenvoegen:

```json
{
  "permissions": {
    "ask": [
      "Bash(pbir model:*)",
      "Bash(*Invoke-ASCmd*)",
      "Bash(*AdomdClient*)",
      "Bash(*dscmd*)",
      "Bash(*sqlcmd*)",
      "Bash(*Invoke-Sqlcmd*)",
      "Bash(psql:*)",
      "Bash(bq query:*)",
      "Bash(dbt show:*)"
    ],
    "deny": [
      "Read(**/*.abf)",
      "Read(**/*.pbix)"
    ]
  },
  "autoMode": {
    "soft_deny": [
      "$defaults",
      "Query's met klantdata uitvoeren (DAX via pbir model -q, Invoke-ASCmd, ADOMD, dscmd; SQL via sqlcmd, Invoke-Sqlcmd, psql, bq, dbt show) die detailrijen, namen, omschrijvingen of vrije tekst teruggeven. Metadata, aantallen en totalen zonder namen mogen wel (zie .claude/rules/datatoegang.md). Vraag eerst, ook in auto mode.",
      "Spreadsheets of exports lezen die klantdata kunnen bevatten (.xlsx, .csv) uit een klantprojectmap. Vraag eerst en zeg welk bestand en waarom."
    ]
  }
}
```

Meld: "✅ Power BI-beveiliging ingesteld in ~/.claude/settings.json"

---

Vraag daarna:

> "Bouw je op deze machine Power BI-dashboards? (j/n)"

**Nee:** sla stap 5.1 over.

**Ja:** voer stap 5.1 uit.

### 5.1 De dashboard-skill installeren

De skill `powerbi-dashboard-design` bevat de huisregels voor dashboardbouw: layout, KPI-patroon, PBIR-valkuilen en de screenshot-loop. Hij hoort **machine-breed** te staan, niet per project — dan geldt hij voor elk dashboard en verspreidt een update zich vanzelf.

1. Kopieer `TEMPLATE_DIR/skills/powerbi-dashboard-design` naar `~/.claude/skills/`
2. Bestaat de map al? Meld de huidige inhoud, vraag of hij overschreven mag worden, en respecteer het antwoord — er kunnen lokale aanvullingen in staan
3. Verifieer door de skill aan te roepen; hij hoort te laden met basismap `~/.claude/skills/powerbi-dashboard-design`
4. Meld: "✅ skill powerbi-dashboard-design geïnstalleerd"
5. **Klant-repo's**: maak `C:\dev\klanten` aan (elders: `~/dev/klanten`) als die ontbreekt. Controleer `gh auth status`: GitHub CLI ontbreekt → stel `winget install --id GitHub.cli -e` voor; niet ingelogd → vraag de gebruiker zelf `gh auth login` te draaien (GitHub.com → HTTPS → Yes → browser, en `git-finnit` autoriseren). Meld: "✅ klant-repo's: C:\dev\klanten en GitHub CLI klaar"

### 5.2 Databeveiliging controleren

Een PBIP-map bevat de data in `.pbi/cache.abf`, en met een draaiende Power BI Desktop plus de `pbir` CLI is het model rechtstreeks te bevragen met DAX. Dat is bij klantdashboards zelden de bedoeling.

De instellingen daarvoor zijn in stap 5.0 al samengevoegd in `~/.claude/settings.json`. Staan ze er niet, voer stap 5.0 dan alsnog uit. Er is één blok, zodat er één plek is om te onderhouden.

Wat dit doet: `pbir desktop screenshot` en `refresh` blijven werken, dus de visuele controle blijft intact. Alleen query's via `pbir model` of een database-CLI vragen om toestemming; wat daarbij zonder vragen mag, staat in `.claude/rules/datatoegang.md`.

Meld daarna deze twee punten:

- **Zet in Claude → Settings → Privacy de schakelaar "Help improve our AI models" uit.** Dat kan alleen handmatig. Die instelling dekt ook Claude Code-sessies.
- **Test de `ask`-regel één keer in auto mode.** Of `permissions.ask` daar wordt gehonoreerd is niet met zekerheid vastgesteld; de `autoMode.soft_deny` is de tweede lijn. Komt er geen vraag, dan is een PreToolUse-hook nodig.

---

## Stap 4 — Afsluiting

Toon een samenvatting:

```
✅ Machine-setup voltooid

Gedaan:
- install-template.md   : [aangemaakt / TEMPLATE_DIR bijgewerkt / ongewijzigd]
- koppel-klant-repo.md  : [geïnstalleerd]
- inrichten.md          : [geïnstalleerd]
- projects.txt          : [N projecten geregistreerd / ongewijzigd]
- ~/.claude/notion.md   : [aangemaakt / bijgewerkt / overgeslagen]
- ~/.claude/developer   : [aangemaakt / bijgewerkt / ongewijzigd]
- Power BI-beveiliging  : [ingesteld / ongewijzigd]
- Power BI-skill        : [geïnstalleerd / bijgewerkt / overgeslagen (geen PBI-dashboards)]

Je kunt nu /inrichten gebruiken om een project of klant-repo in te richten of op te halen.
Draai /setup-machine opnieuw als je de config wilt aanpassen.
```
