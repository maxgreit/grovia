# Doc-drift signals — buffer voor /dag-afsluiting

Append-only door `/handoff`. Geleegd door `/dag-afsluiting` in dezelfde commit als de doc-updates.

---

## `ARCHITECTURE.md` beschrijft de MM-mail verkeerd

**Gevonden:** 2026-08-04, tijdens het in kaart brengen van MiniMove voor het strippenkaartplan.

[ARCHITECTURE.md:82](ARCHITECTURE.md) zegt: "`MM` of een ontbrekende/onbekende code krijgt alleen
de games-mail." De code doet iets anders: `grovia_mail.bouw_uitnodiging()` geeft `None` terug als
`school_code` niet in `SCHOOL_DATA` staat, en er gaat dan **geen enkele mail** uit
([grovia_mail.py:95-100](../grovia_shared/grovia_mail.py)). De kandidaat en de assignments worden in
Ixly wél aangemaakt — dat is een aparte, technische stap. Vandaag onschadelijk omdat de PHP nooit een
MM-assessment-tag aanmaakt (`grovia-automations.php:182`), dus dit pad wordt niet bereikt. Wel
misleidend zodra iemand overweegt MiniMove mee te laten doen.

## Testcommando's in de docs werken niet op deze machine

**Gevonden:** 2026-08-04, geverifieerd op ongewijzigde `main`.

- `node --test tests/gs/` (staat zo in de docblock van elk `tests/gs/*.test.js`) faalt op Node
  v23.9.0 met `Cannot find module .../tests/gs`. Werkt wel: `node --test tests/gs/*.test.js`.
- `python3.11 -m pytest` geeft `No module named pytest`; pytest zit alleen in de venv. Werkt wel:
  `venv/bin/pytest tests/ -q`.

Beide baselines zijn groen met de werkende invocatie (84 respectievelijk 105 passed). Kandidaat voor
een regel in `CONVENTIONS.md` of een `package.json`-script, zodat het commando één plek heeft.

## `Dagelijks.gs`-docblock zegt "zes stappen"

Alleen relevant zodra Spoor 2 van het strippenkaartplan gedaan is — dan zijn het zeven. Staat als
stap in Task 9 van [het plan](superpowers/plans/2026-08-05-minimove-strippenkaarten.md), dus dit
signal mag weg zodra dat spoor gedaan of definitief afgeblazen is.
