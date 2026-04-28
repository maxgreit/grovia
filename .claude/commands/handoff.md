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

Na het schrijven: toon zowel de nieuwe HANDOFF.md als de geüpdatete TODO.md voor review.

Belangrijk: evidence before assertions. Geen "alles werkt" zonder build check. Geen "klaar" zonder git status check.
