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

## Een werkend site-mechanisme bestaat volledig buiten git

**Gevonden:** 2026-08-05, live op grovia.nl nagekeken (niet in deze repo — er was geen andere manier
om dit te vinden).

Zowel de MiniMove-productpagina als "Voetbaltraining – Kolping Academie" hebben een werkende
maatuitvraag (drie optionele velden: `tenue_maat_shirt`, `tenue_maat_broekje`, `tenue_maat_sokken`,
maten conform de Jako-teamshop). Aangestuurd door een inline `<script>` met een functie
`needsSizesFromValue()` die het blok alleen toont als de gekozen `pa_inschrijving`-waarde "tenue"
bevat en niet "zonder" (dus in de praktijk alleen bij `seizoenkaart-inclusief-tenue`). Dit script staat
**niet in deze git-repo** en dus ook niet in `ARCHITECTURE.md` — het draait vermoedelijk via een
gedeeld Elementor "Single Product"-sjabloon (Theme Builder) of een site-brede code-snippet-plugin,
want identieke code met identieke veldnamen staat op twee losstaande producten.

Voor het strippenkaartplan is de `needsSizesFromValue()`-voorwaarde met één regel verbreed zodat hij
ook bij `strippenkaart-*`-slugs het blok toont (Spoor 5 van
[het plan](superpowers/plans/2026-08-05-minimove-strippenkaarten.md)) — die wijziging staat, net als
het script zelf, buiten git.

Twee dingen die hier ooit uit moeten volgen (niet nu, geen taak, alleen zodat het niet vergeten
wordt): (1) `ARCHITECTURE.md` mist dit hele mechanisme — bij een volgende `/dag-afsluiting` of
apply-template-ronde hoort hier een paragraaf over te komen, inclusief WAAR het precies staat zodra
dat is opgezocht (dit signaal zelf noemt het nog niet, want het is niet opgezocht dit is puur uit
netwerktracing/JS-inspectie gededuceerd); (2) op dezelfde Kolping-productpagina staan ook twee losse
tekstvelden `grovia_vereniging` en `grovia_team` die nergens in deze codebase gelezen worden — mogelijk
puur voor Berry's eigen adminoverzicht, mogelijk een gemiste koppeling. Niet onderzocht, alleen
gezien tijdens het browsen.
