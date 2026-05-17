---
description: Genereer handoff document voor de volgende sessie
---

Schrijf `docs/HANDOFF.md` volledig opnieuw (overschrijven, niet appenden).

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
8. **Nieuwe ADR's nodig?** Als er architecturale keuzes zijn gemaakt, append naar `docs/DECISIONS.md`.
9. **Update `docs/TODO.md`:**
   - Voltooide items → Done sectie (max 5 meest recent)
   - Nieuwe items uit deze sessie → Next Up (max 5 items)
   - Items die nu geblokkeerd zijn → Blocked met reden
10. **Notion Taken synchroniseren** (als `CLAUDE.md` een `Notion Coding Project` URL bevat):
    - Bepaal de workspace (greit of finnit) uit de `View` property op de coding project pagina (zie stap hierboven)
    - Taken database:
      - greit: `collection://2f7b8e17-1c13-8180-a507-000bac3f81b7`
      - finnit: `collection://2deb8e17-1c13-816f-a310-000b50926493`
    - **Notion → TODO.md:** Gebruik `notion-search` om taken van dit project op te halen. Voor elke taak met Status "Done" die nog als open item in `docs/TODO.md` staat: verplaats die naar de Done sectie.
    - **Nieuwe taken aanmaken:** Vergelijk de vorige `docs/HANDOFF.md` Open items met de nieuwe Next Up in `docs/TODO.md`. Maak voor elk nieuw item een taak aan via `notion-create-pages`:
      - Properties: `Taak` (naam), `Status` ("Not started"), `Type` (["Programmeren"]), `View` (["greit"] of ["finnit"]), `Project` (URL van het coding project als JSON-array: `["https://..."]`)
    - **Voltooide taken sluiten:** Voor elk item dat deze sessie naar Done is verplaatst: zoek de Notion-taak via `notion-search` op taaknaam, update `Status` naar "Done" via `notion-update-page`
11. **Notion Coding Project updaten** (als `CLAUDE.md` een `Notion Coding Project` URL bevat):
    - Fetch de coding project pagina via `notion-fetch`
    - Maak een nieuwe sessie-entry aan in de Sessielogboek database via `notion-create-pages`:
      - Bepaal de workspace (greit of finnit) uit de `View` property op de coding project pagina
      - Parent data_source_id:
        - greit: `collection://be8223aa-09fb-40e0-9203-c1170ddcecfd`
        - finnit: `collection://4a173d39-1720-4d56-b800-5de1c0754d09`
      - Properties: `Sessie` (korte sessietitel), `date:Datum:start` (vandaag, YYYY-MM-DD), `date:Datum:is_datetime` (0), `Project` (URL van het coding project uit CLAUDE.md als JSON-array), `Status` ("Gedaan")
      - Content: samenvatting van de sessie (wat gedaan, gotchas/beslissingen)
    - Update de **Tech Stack** sectie op de coding project pagina via `notion-update-page` als er iets is veranderd
    - Zijn er nieuwe ADR's gemaakt deze sessie? Maak dan voor elke ADR een entry aan in de ADR database via `notion-create-pages`:
      - Parent data_source_id:
        - greit: `collection://230762f5-8781-4da3-81ec-ca95bb69b23a`
        - finnit: `collection://1e9f798c-d242-4c3b-a30e-cd23aa301896`
      - Properties: `ADR` (bijv. "ADR-004: Naam van de beslissing"), `Project` (URL van het coding project uit CLAUDE.md als JSON-array), `Status` ("Geaccepteerd" voor geaccepteerde ADRs, "Vervangen" voor vervangen ADRs), `date:Datum:start` (vandaag, YYYY-MM-DD), `date:Datum:is_datetime` (0)
      - Content: achtergrond, beslissing, alternatieven overwogen, consequenties

Na het schrijven: toon zowel de nieuwe HANDOFF.md als de geüpdatete TODO.md voor review.

Belangrijk: evidence before assertions. Geen "alles werkt" zonder build check. Geen "klaar" zonder git status check.
