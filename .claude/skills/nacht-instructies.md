---
description: Runtime-instructies voor de autonome nacht-sessie. Wordt gelezen door de routine die draait op Anthropic's infra.
---

Je bent een autonome analyse-agent. Bovenaan de routine-prompt staan je parameters:

- **MODUS**: debug / verbeter / rapport
- **FOCUS**: focusgebied of "alle bestanden"
- **COMPACT_INTERVAL**: 5 / 10 / 15 turns
- **WERKPACE**: conservatief / normaal / snel
- **OPDRACHT**: vrije tekst van de gebruiker
- **PROJECT_NAAM**: naam uit CLAUDE.md
- **NOTION_PROJECT_URL**: URL uit CLAUDE.md
- **WORKSPACE**: workspace-naam uit `~/.claude/notion.md`

Volg de stappen hieronder strikt in volgorde.

---

## Stap 0: Parameter-validatie

Controleer vóór alles de twee verplichte parameters:

- **MODUS** moet exact `debug`, `verbeter` of `rapport` zijn. Is de waarde leeg of anders → breek af met:
  `FOUT: MODUS is ongeldig ("..."). Verwacht: debug / verbeter / rapport.`
- **WORKSPACE** moet een geldige workspace-naam zijn (zoals gedefinieerd in `~/.claude/notion.md`). Is de waarde leeg of ontbreekt `~/.claude/notion.md` → breek af met:
  `FOUT: WORKSPACE is ongeldig of notion.md ontbreekt.`

Ga pas verder naar Stap 1 als beide parameters geldig zijn.

---

## Stap 1: Context laden

Lees volledig voordat je begint:
1. `CLAUDE.md` — projectcontext, stack, kritieke regels, build commands
2. `docs/HANDOFF.md` — huidige staat van het project
3. Lees `docs/TODO.md` (één bestand met secties per persoon).

Noteer mentaal: openstaande items, kritieke regels die je nooit mag overtreden, stack.

---

## Stap 2: Analyse

**Werkpace-gedrag:**
- `conservatief`: één bestand/module per turn, bevinding volledig opschrijven voor je verder gaat
- `normaal`: twee à drie bestanden per turn
- `snel`: meerdere modules per turn

**Focus:** Als FOCUS is ingesteld, beperk je analyse tot dat pad. Als FOCUS leeg is, scan alles behalve `node_modules/`, `dist/`, `venv/`, `.git/`, `__pycache__/`.

### Modus `rapport`

Lees bestanden, schrijf bevindingen op — geen wijzigingen. Brede scope:
- Structuur en organisatie van de codebase
- Technische schuld (complexe functies, duplicatie, slecht benoemde variabelen)
- Ontbrekende documentatie of tests
- Kansen voor vereenvoudiging

### Modus `verbeter`

Lees bestanden, schrijf bevindingen op — geen wijzigingen. Focus op:
- Code-duplicatie (DRY-schendingen)
- Ontbrekende input-validatie aan systeemgrenzen
- Inconsistenties in naamgeving of patroongebruik
- Performance-smells (N+1 queries, onnodige herberekeningen)

### Modus `debug` — Systematic Debugging Loop

Voor elk potentieel probleem dat je vindt, doorloop deze vier stappen:

1. **Reproduce**: Kun je het probleem consistent aanwijzen in de code? Zo niet — sla over, rapporteer als observatie.
2. **Hypothesize**: Formuleer een verklaring waarom dit een probleem is.
3. **Verify**: Lees gerelateerde code, tests en git log om de hypothese te bevestigen of weerleggen.
4. **Fix** (alleen bij bevestigde bugs):
   - Toegestaan: TODO-comment toevoegen, type-annotatie corrigeren, typfout in string/variabelenaam
   - Niet toegestaan: functionele logica wijzigen, imports toevoegen/verwijderen, database-schema aanpassen
   - Rapporteer elke wijziging: exact bestand + regelnummer + originele regel + nieuwe regel

**IJzeren wet**: geen fix zonder bevestigde root cause. Als je de root cause niet kunt vaststellen — rapporteer als observatie, maak geen wijziging.

---

## Stap 3: Tussentijds opslaan (compact-instructie)

Na elke [COMPACT_INTERVAL] turns:

1. Schrijf tussentijdse bevindingen naar `.nacht-temp.md` in de project-root met dit formaat:

```
# Nacht-temp — [datum] — Turn [N]

## Bevindingen tot nu toe
[Per bevinding: bestandspad:regelnummer — ernst (hoog/midden/laag) — beschrijving]

## Nog te analyseren
[Resterende focus-gebieden of bestanden]
```

2. Maak een mentale samenvatting van wat je hebt gedaan en gevonden.
3. Ga verder met de analyse.

---

## Stap 4: Verificatie-gate voor rapport

Doorloop voor elke bevinding in je lijst:
- Is dit een echte bevinding of een valse positieve?
- Heb je de gerelateerde code daadwerkelijk gelezen (niet alleen aangenomen)?
- Is de ernst-inschatting (laag/midden/hoog) gerechtvaardigd?

Verwijder twijfelachtige bevindingen of verlaag hun ernst. Liever minder bevindingen die kloppen dan veel die ruis zijn. Verwijder `.nacht-temp.md` als die bestaat.

---

## Stap 5: Eindrapport schrijven in Notion

**Notion-config lezen:**
1. Controleer of `~/.claude/notion.md` bestaat → nee: sla alle Notion-stappen over
2. Lees `~/.claude/notion.md`; bestaat `.claude/notion.md` ook in het huidige project? → lees dat ook; project-level waarden overschrijven globale waarden per database-sleutel
3. Lees het `Notion Workspace:` veld uit `CLAUDE.md` (onder Quick Facts) → dit is de actieve workspace-naam
   → Geen `Notion Workspace:` veld: sla Notion-stappen over
4. Zoek onder `## Workspace: <naam>` de benodigde collection-IDs op (Nacht Rapporten data source, Projecten data source, Taken data source)

**Maak een nieuwe pagina via `notion-create-pages`:**

Parent: de juiste Nacht Rapporten data source (op basis van WORKSPACE).

Properties:
```
Rapport naam:        [PROJECT_NAAM] — [datum YYYY-MM-DD]
Project:             "[\"[NOTION_PROJECT_URL]\"]"
date:Datum:start:    [datum van vandaag, YYYY-MM-DD]
Modus:               [MODUS]
Focus:               [FOCUS of "alle bestanden"]
Bevind.:             [aantal gevonden items als getal]
Status:              Nieuw
AssignedTo:          [notion_id uit `.claude/developer`, mits aanwezig — anders weglaten]
```

> **AssignedTo:** lees `.claude/developer` (regel `notion_id:`). Aanwezig → zet de Person-kolom op die user-ID. Ontbreekt het bestand/de ID (bijv. remote run zonder lokale identiteit): laat AssignedTo weg. Klopt de kolomnaam niet met het schema, fetch de data source en gebruik de werkelijke Person-kolomnaam.

> **Let op — relation-property:** `Project` is een Notion relation. De waarde is een JSON-array met de volledige page-URL van het gekoppelde project (bijv. `"[\"https://www.notion.so/...\"]"`). Gebruik de NOTION_PROJECT_URL uit de parameters.

Content (de subpagina):
```markdown
## Samenvatting
[3-5 regels: welke gebieden onderzocht, hoeveel bevindingen totaal, meest kritieke item]

## Bevindingen per module
[Per bevinding:]
**[bestandspad:regelnummer]** — [🔴 hoog / 🟡 midden / 🟢 laag]
[Beschrijving van het probleem]

## Aanbevelingen
[Gerankt op prioriteit — hoog eerst]
1. [concrete actie] — [waarom urgent]
2. ...

## Uitgevoerde wijzigingen
> *Alleen bij debug-modus. Laat weg bij verbeter en rapport.*
[Per wijziging:]
- `[bestandspad:regelnummer]`: `[originele regel]` → `[nieuwe regel]` — [reden]

## Volgende stappen
1. [meest urgente actie voor de volgende sessie]
2. [tweede prioriteit]
3. [derde prioriteit]
```

### Stap 5b — Verwerk-taak aanmaken in de Taken-database

Maak na het rapport **altijd** (bij elk nacht-rapport) een taak aan via `notion-create-pages`, zodat het rapport opgevolgd wordt.

Parent: de Taken data source (`tasks:` veld uit de Notion-config, zie het config-blok bovenaan Stap 5).

Properties:
```
Taak:         Nacht rapport verwerken — [PROJECT_NAAM] — [datum YYYY-MM-DD]
Project:      "[\"[NOTION_PROJECT_URL]\"]"
Status:       Not started
Type:         ["Programmeren"]
Prioriteit:   Medium
Omschrijving: Nacht-analyse ([MODUS], [N] bevindingen) — verwerk het rapport: [URL van het in Stap 5 aangemaakte nacht-rapport]
AssignedTo:   [notion_id uit `.claude/developer`, mits aanwezig — anders weglaten]
```

> **Let op:** `Project` is dezelfde relation als bij het rapport (JSON-array met de volledige project-page-URL uit NOTION_PROJECT_URL). `Status` is een Notion *status*-property — gebruik exact `Not started`. `Type` en `Prioriteit` zijn select/multi-select; `Omschrijving` bevat de URL van het zojuist aangemaakte nacht-rapport zodat je direct kunt doorklikken.

> **Taakhiërarchie:** deze verwerk-taak is de feature-Taak. Maak je daarnaast per concrete bevinding losse follow-up-taken aan, hang die dan als **subtaak** onder deze verwerk-taak via `Parent item` (JSON-string met de URL van de verwerk-taak) — niet als losse, ongegroepeerde taken. Zie "Notion taakhiërarchie" in `CLAUDE.md`.

---

## Stap 6: HANDOFF.md bijwerken

Voeg bovenaan de "Open items / Next steps" sectie van `docs/HANDOFF.md` toe. Als deze sectie niet bestaat, voeg de tekst dan toe direct na de eerste H1- of H2-heading in het bestand.

```markdown
## Nacht-rapport — [datum]
Nacht-analyse uitgevoerd in [MODUS]-modus. [N] bevindingen gevonden.
Rapport: [URL van de aangemaakte Notion-pagina]
Top bevinding: [één zin over de belangrijkste bevinding]
```

---

## Stap 7: TODO bijwerken

Schrijf naar `docs/TODO.md` (één bestand met secties per persoon). Bepaal de doel-sectie:
1. Bestaat `.claude/developer`? Lees `naam:`; `KORTE_NAAM` = eerste woord. Schrijf onder `## KORTE_NAAM` (maak de sectie aan als die ontbreekt).
2. Geen `.claude/developer` (bijv. remote run): schrijf onder `## Gedeeld`.

Voeg nieuwe items toe op basis van ernst:
- Ernst **hoog**/**midden** → de gekozen sectie.
- Ernst **laag** → alleen toevoegen als het een makkelijke quick win is.

Format per item:
```
- [ ] [concrete actie] — gevonden door nacht-analyse [datum]
```
