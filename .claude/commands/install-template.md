---
description: Installeer de claude-project-template in een nieuw of bestaand project en vul alle docs in
---

<!--
SETUP VEREIST — dit command werkt niet zonder aanpassing.

Dit bestand hoort in je globale Claude-map, niet in een project:
  ~/.claude/commands/install-template.md

Stappen:
1. Kopieer dit bestand naar ~/.claude/commands/install-template.md
2. Vervang TEMPLATE_DIR hieronder door het absolute pad van jouw lokale kloon van deze repo
3. Sla op — het command is daarna beschikbaar in elk project

Voorbeeld:
  TEMPLATE_DIR=/Users/jouw-naam/werk/claude-project-template
-->

TEMPLATE_DIR=/pad/naar/claude-project-template

Voer de volgende stappen uit:

## Stap 0 — Machine Setup (eenmalig, alleen bij eerste installatie)

Controleer of de volgende machine-specifieke tools al ingesteld zijn. Als dit de eerste keer is dat je de template installeert, doorloop dan eerst deze setup — anders kun je stap 0 overslaan.

**Notion MCP (optioneel, maar aanbevolen):**
Geeft Claude Code toegang tot jouw Notion-workspaces voor `/start-session`, `/handoff` en de nacht-routine.

1. Open `~/Library/Application Support/Claude/claude_desktop_config.json`
2. Voeg toe onder `mcpServers`:
```json
"notion": {
  "command": "npx",
  "args": ["-y", "@notionhq/notion-mcp-server"],
  "env": {
    "NOTION_TOKEN": "jouw_token_hier"
  }
}
```
3. Token aanmaken via [notion.so/profile/integrations](https://notion.so/profile/integrations) → "New connection" → "Access token" → selecteer jouw eigen workspace
4. Herstart Claude Code na het opslaan

Zie `docs/CONVENTIONS.md` → "Machine Setup" voor meer details.

---

## Stap 1 — Bepaal het doelpad

Voer uit: `pwd`

- Als de uitvoer gelijk is aan `$TEMPLATE_DIR`: meld
  "Je staat in de template-repo zelf. Geef het absolute pad op van het project waar je de template wil installeren."
  en wacht op invoer van de gebruiker.
- Anders: vraag "Wil je de template installeren in `<uitvoer van pwd>`?
  Bevestig (Enter) of geef een ander absoluut pad op."
  Wacht op het antwoord. Gebruik het bevestigde of opgegeven pad als DOELPAD voor alle volgende stappen.

## Stap 2 — Voer de installatie uit

Voer uit:
```
bash $TEMPLATE_DIR/install.sh DOELPAD
```
(vervang DOELPAD door het pad uit stap 1)

Als het script een foutmelding geeft of afbreekt: meld de fout en stop.

## Stap 3 — Pas apply-template toe op het doelproject

Controleer eerst of `DOELPAD/.claude/commands/apply-template.md` bestaat.
(vervang DOELPAD door het pad uit stap 1)

- Als het bestand **niet bestaat**: meld "Kon apply-template.md niet vinden in DOELPAD/.claude/commands/ — controleer of de installatie geslaagd is." en stop.
- Als het bestand **wel bestaat**: lees het en voer de instructies daarin uit, waarbij je DOELPAD gebruikt als werkmap voor alle bestandsbewerkingen:
  - Lees alle scan-bestanden vanuit DOELPAD (bijv. `DOELPAD/package.json`, `DOELPAD/README.md`, etc.)
  - Schrijf alle output-bestanden naar DOELPAD (bijv. `DOELPAD/CLAUDE.md`, `DOELPAD/docs/HANDOFF.md`, etc.)
