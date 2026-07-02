---
description: Eenmalige machine-setup voor de claude-project-template — installeert install-template, vult projects.txt en configureert Notion
---

Voer de volgende stappen uit. Draai dit command altijd vanuit de **template-repo directory** (de map waar je dit command uitvoert is de template-repo zelf).

## Stap 0 — Developer-identiteit

### 0.1 Controleer bestaand bestand

Controleer of `.claude/developer` al bestaat in de huidige directory.

**Bestaat al:**
Lees het. Toon: "Je staat geregistreerd als `<naam>` (`<email>`). Ben jij dat? (ja/nee)"
- **"ja":** ga direct naar Stap 1
- **"nee":** ga door naar Stap 0.2

**Bestaat niet of "nee":**
Ga naar Stap 0.2.

### 0.2 Identiteit instellen

Lees de `## Key People` sectie uit `CLAUDE.md` en toon de developers als genummerde lijst:

```
Wie ben jij?
1. <naam 1>
2. <naam 2>
```

Wacht op het antwoord. Als er maar één developer is: gebruik die automatisch zonder te vragen.

Vraag: "Wat is jouw e-mailadres?"

Schrijf `.claude/developer` met de gekozen naam en het opgegeven e-mailadres:

```
naam: <volledige naam, exact zoals in Key People>
email: <e-mailadres>
```

(De `notion_id` wordt later toegevoegd in Stap 3, na de Notion-configuratie.)

Meld: "✅ Developer-identiteit ingesteld: `<naam>` (`<email>`)"

---

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
4. Als nieuw pad opgegeven: update de `TEMPLATE_DIR=` regel en sla op. Meld: "✅ TEMPLATE_DIR bijgewerkt"
5. Als Enter: meld "✅ Geen wijziging nodig"

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

## Workspace: [naam2]
- tasks: [collection ID]
...
```

Meld: "✅ ~/.claude/notion.md aangemaakt met N workspace(s)"

### 3.3 Notion-config review (al geconfigureerd)

Lees `~/.claude/notion.md` en toon alle workspaces met hun 6 database-IDs.

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

### 3.4 — Notion-ID voor actieve developer

Als `.claude/developer` bestaat maar nog geen `notion_id`-regel bevat:
- Zoek de Notion-gebruiker via `notion-search` met de query `email:<email uit .claude/developer>`
- **Één match:** voeg `notion_id: <gevonden-id>` toe aan `.claude/developer`. Meld: "✅ Notion-ID geresolved voor `<naam>`"
- **Geen of meerdere matches:** toon de kandidaten (naam + e-mail) en laat kiezen, of meld: "Notion-ID niet geresolved — vul `notion_id` handmatig aan in `.claude/developer` als je Notion-koppeling wilt."

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

## Stap 4 — Afsluiting

Toon een samenvatting:

```
✅ Machine-setup voltooid

Gedaan:
<<<<<<< Updated upstream
- install-template.md   : [aangemaakt / TEMPLATE_DIR bijgewerkt / ongewijzigd]
- projects.txt          : [N projecten geregistreerd / ongewijzigd]
- ~/.claude/notion.md   : [aangemaakt / bijgewerkt / overgeslagen]
- ~/.claude/developer   : [aangemaakt / bijgewerkt / ongewijzigd]
=======
- Developer-identiteit : [<naam> — aangemaakt / bevestigd]
- install-template.md  : [aangemaakt / TEMPLATE_DIR bijgewerkt / ongewijzigd]
- projects.txt         : [N projecten geregistreerd / ongewijzigd]
- ~/.claude/notion.md  : [aangemaakt / bijgewerkt / overgeslagen]
- Notion-ID            : [geresolved / niet geresolved / overgeslagen]
>>>>>>> Stashed changes

Je kunt nu /install-template gebruiken vanuit elk nieuw project.
Draai /setup-machine opnieuw als je de config wilt aanpassen.
```
