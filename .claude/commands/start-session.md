---
description: Start een nieuwe sessie — laad context en bevestig begrip
---

Voer de volgende stappen in deze volgorde uit:

1. Lees `CLAUDE.md` volledig
2. Bepaal wie er aan het werk is:
   a. Controleer of `.claude/developer` bestaat — zo ja, gebruik die naam (geen vraag nodig)
   b. Zo niet: kijk naar de developer/team-sectie in `CLAUDE.md` — als er meerdere developers staan, vraag dan wie er nu werkt
   c. Bestaan er persoonlijke `docs/TODO_<naam>.md` bestanden? Laad dan de juiste én `docs/TODO_shared.md`
   d. Zo niet: lees `docs/TODO.md`
3. Lees `docs/HANDOFF.md` volledig
4. Run `git status` — check of er uncommitted changes zijn
5. Run `git log -3 --oneline` — laatste 3 commits
6. Run het build command uit `CLAUDE.md` — evidence-based build status, geen aanname
7. Geef een bondige samenvatting (max 10 regels) met:
   - Actieve developer (indien meerdere developers in project)
   - Huidige project status
   - Laatste commit
   - Build status (green/red)
   - Uncommitted changes (indien aanwezig)
   - Top 1-3 items uit TODO Next Up
   - Voorstel voor deze sessie

BELANGRIJK:
- Begin NOG NIET met code wijzigen totdat ik bevestig
- Als er uncommitted changes zijn: vraag of die gecommit of gediscarded moeten worden
- Als Superpowers actief is (zie CLAUDE.md): laat skills activeren voor features en bugs — ga niet zelf direct implementeren

Wacht op mijn bevestiging voor je verder gaat.
