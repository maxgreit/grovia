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

## 2026-08-05 — sessie 1 — ARCHITECTURE.md

**Wat:** Nieuwe subsystem toegevoegd: MiniMove-aankopen + aanwezigheidsregistratie in het "Grovia
Deelnemers"-werkboek. Twee nieuwe tabbladen ("MiniMove Deelnemers", "MiniMove Aanwezigheid"),
gevuld/bijgehouden door een nieuwe Stap 7 in de dagelijkse run (hergebruikt de orderregels van
Stap 6/Financieel, geen extra WooCommerce-aanroep). Zie ADR-012 voor de volledige beslissing.
**Code:** `google-apps-script/deelnemers/MiniMove.gs` (nieuw), `Config.gs`, `Sheet.gs`, `Dagelijks.gs`
**Commit:** nog niet gecommit (working copy)
**Voorgestelde plek:** een paragraaf naast de bestaande beschrijving van de dagelijkse run/Financieel-
stap, met de datastroom (orderregel → `bepaalMiniMoveAankopen()` → upsert → twee tabbladen) en de
vermelding dat de checkout-UI zelf (collapsible weergave, maatuitvraag) buiten git leeft — zie het
signaal hierboven ("Een werkend site-mechanisme bestaat volledig buiten git").

## 2026-08-05 — sessie 1 — CONVENTIONS.md

**Wat:** Twee nieuwe, niet voor de hand liggende patronen die verdere `.gs`-code zouden moeten volgen:
(1) `Range.setFormula()` moet het argument-scheidingsteken van de werkboek-locale gebruiken (`;`
i.p.v. `,` bij een Nederlandstalig werkboek) — anders een stille `#ERROR!`. Nu opgelost via
`SpreadsheetApp.getSpreadsheetLocale()`, maar dit geldt voor élke toekomstige `setFormula()`-aanroep.
(2) WooCommerce REST-aanroepen via `UrlFetchApp` horen een herkenbare User-Agent te hebben en een
retry-met-backoff op HTTP 403 (rate-gebaseerde WAF-blokkades kwamen al eerder voor bij twee volledige
ophalingen kort na elkaar binnen één run).
**Code:** `google-apps-script/deelnemers/Sheet.gs` (`FORMULE_SCHEIDING`), `Woo.gs` (`_haalJson`,
`WOO_USER_AGENT`)
**Commit:** nog niet gecommit (working copy)
**Voorgestelde plek:** een nieuwe regel bij de bestaande CONVENTIONS-regels over Sheets-schrijfgedrag
(regel 2/3 gaan al over WAF-bursts en tekstformaat) — dit zijn twee vergelijkbare, code-brede gotchas.

## 2026-08-05 — sessie 1 — GLOSSARY.md

**Wat:** Nieuwe domeintermen door de MiniMove-strippenkaarten-overgang: `strippenkaart`/`seizoenkaart`/
`hele-cyclus` als mogelijke waarden van `type_aankoop` (seizoenkaart en hele-cyclus zijn de
inmiddels-verwijderde, maar voor historische orders nog relevante, koopopties), en de tabbladnamen
"MiniMove Deelnemers" / "MiniMove Aanwezigheid" als nieuwe artefacten naast het bestaande
"Deelnemers"/"Financieel".
**Code:** `google-apps-script/deelnemers/MiniMove.gs`
**Commit:** nog niet gecommit (working copy)
**Voorgestelde plek:** naast de bestaande definities van cyclus/seizoenkaart (als die er al staan) —
expliciet vermelden dat MiniMove sinds 2026-08-05 geen seizoenkaart/losse-cyclus-optie meer verkoopt,
alleen strippenkaarten.

## Groene tests bewezen niets over de Ixly-statusvocabulaire

**Gevonden:** 2026-08-11, tijdens het debuggen van de Ixly-terugkoppeling.

`ixly-status` vergeleek op `state == "completed"`. Ixly gebruikt `finished`. De waarde `completed`
komt in `swagger.yaml` nergens voor als state — alleen `created` staat er als voorbeeld. De
terugkoppeling heeft dus **nooit** gewerkt, en dat is maanden onopgemerkt gebleven doordat alle 22
tests op deze functie dezelfde verzonnen waarde meecodeerden: de suite was groen én verkeerd.

Kandidaat voor `CONVENTIONS.md`: bij een externe API is een statuswaarde/enum die niet in de spec
staat een **aanname**, en een test die die aanname als fixture gebruikt bevestigt alleen zichzelf.
Zulke waarden minimaal één keer tegen de live API vaststellen (`explore.py` staat er al voor) en de
herkomst in een comment vastleggen — zoals nu bij `AFGERONDE_STATES` in `ixly-status/__init__.py`.

Tweede, kleinere signaal uit dezelfde sessie: `ARCHITECTURE.md:184` en `DECISIONS.md:132` beschrijven
de `_grovia_ixly_taken`-omweg, maar niet dat een `candidate_task` bij Ixly kan verdwijnen terwijl de
assignment blijft bestaan (order 1240). Dat er dan géén API-route naar de nieuwe uuid is, is nu
opnieuw geverifieerd en verdient een regel bij ADR-008.
