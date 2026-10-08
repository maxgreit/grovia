# Klant-repo: welk project is actief

Een **klant-repo** is één GitHub-repo per klant (`git-finnit/bi_<klant>`, lokaal `C:\dev\klanten\bi_<klant>`) met één submap per project. Je herkent hem aan deze regel in de Quick Facts van de `CLAUDE.md` in de hoofdmap:

```
- **Repo-vorm:** Klant-repo
```

Ontbreekt die regel, dan is het een gewone repo: één project, alles in de hoofdmap. Dan geldt niets van dit bestand.

## Claude start in de hoofdmap

Commands en skills staan in de `.claude/` van de hoofdmap. Claude Code laadt die alleen uit de map waarin het start, dus in een klant-repo start je altijd in de hoofdmap. Staat de huidige werkmap in een submap van een klant-repo, meld dan dat Claude opnieuw in de hoofdmap gestart moet worden.

## Het actieve project `<P>`

Commands werken op één project tegelijk. `<P>` is de submap van dat project, relatief aan de hoofdmap (bijvoorbeeld `finance_dashboard`). Bepaal `<P>` in deze volgorde:

1. **Argument** van het command, bijvoorbeeld `/start-session finance_dashboard`. Meerdere submappen, of *beide* / *alle*, maakt meerdere projecten actief (zie *Meerdere projecten tegelijk*).
2. **`.claude/actief-project`** (per machine, staat in `.gitignore`): één submapnaam per regel.
3. **Projectenregister** in de `CLAUDE.md` van de hoofdmap (tabel onder `## Projecten`, kolom *Submap*): staat er precies één project in, neem dat.
4. Anders: toon het register en vraag welk project.

Schrijf de keuze naar `.claude/actief-project`. Controleer dat `<P>/CLAUDE.md` bestaat; zo niet, meld dat het project nog niet is ingericht (`/apply-template`).

In een gewone repo is `<P>` gelijk aan `.`.

## Wat `<P>` betekent in de commands

Waar een command `CLAUDE.md` of `docs/…` noemt, gaat het om het **project**:

| In het command | In een klant-repo |
|---|---|
| `CLAUDE.md` (projectvelden: Project Type, Notion Coding Project, build) | `<P>/CLAUDE.md` |
| `docs/HANDOFF.md`, `docs/TODO.md`, `docs/…` | `<P>/docs/…` |
| `README.md`, `CONTRIBUTING.md` (waarheid-docs) | `<P>/README.md`, `<P>/CONTRIBUTING.md` |
| `Notion Workspace`, `Key People` | `<P>/CLAUDE.md`, anders de `CLAUDE.md` van de hoofdmap |
| `.claude/…` (developer, notion.md, template-versie) | `.claude/…` in de hoofdmap |

Lees altijd óók de `CLAUDE.md` van de hoofdmap: die bevat de klant, de Notion-Area, de plek van de klantdata en het projectenregister.

## Meerdere projecten tegelijk

Soms hoort één wijziging bij twee projecten, bijvoorbeeld een aanpassing in het rapportvlak van de DMT plus de bijbehorende wijziging in het dashboard. Dan zijn er meerdere actieve projecten `<P1>`, `<P2>`, …. Dat is de uitzondering: werk je aan één kant, houd het bij één project, zodat de geschiedenis per project schoon blijft.

- `/start-session`: laadt `CLAUDE.md`, HANDOFF en TODO van elk actief project en geeft de samenvatting per project.
- `/handoff`: schrijft per project een eigen blok in de eigen `docs/HANDOFF.md` en werkt de eigen `docs/TODO.md` bij, met alleen wat bij dat project hoort; een besluit gaat naar het project waar het over gaat (of naar de klant, `K-NNN`). Vastleggen gebeurt in **één commit** over de betrokken projecten. In Notion komt **één** sessielog-regel met `Project` = alle actieve projecten; taken gaan elk naar hun eigen project.
- `/dag-afsluiting`: loopt de projecten na elkaar door, met per project een eigen commit en dagrapport.

## Afhankelijkheden tussen projecten

Het projectenregister heeft een kolom *Hangt af van*. Een project dat afhangt van een ander (een dashboard van een datamodel) leest objecten die het leverende project beheert; die staan in `docs/CONTRACT.md` van het leverende project.

- **Wijzig je in het leverende project een contractobject**, controleer dan het afhankelijke project of zet de impact op zijn TODO onder `### Impact vanuit <leverend project>`.
- **Start je een sessie in het afhankelijke project**, dan toont `/start-session` de commits in het leverende project sinds de laatste handoff van dit project.

## Klantniveau: klantbesluiten

Besluiten die voor alle projecten van de klant gelden (een rekenregel, een eigenaardigheid van de bron, een afspraak met de klant) staan in `docs/DECISIONS.md` in de **hoofdmap**, genummerd `K-NNN`. Project-ADR's (`ADR-NNN`) staan in `<P>/docs/DECISIONS.md` en mogen naar een klantbesluit verwijzen. Een klantbesluit gaat vóór een project-ADR die ermee in strijd is: meld zo'n conflict. In Notion hangt een klantbesluit aan de Area van de klant (relatie `Area` in de ADR-database), niet aan een project.

## Git in een klant-repo

- Werk direct op `main`. Vóór het werk `git pull`; na het werk commit, `git pull`, `git push`.
- Commits van een command beperken zich tot `<P>/` en, als het register is bijgewerkt, de `CLAUDE.md` en `docs/` van de hoofdmap. Wijzigingen in een ander project neem je niet mee: meld ze.
- **Uitzondering: een contractwijziging.** Hangt een project af van een ander (kolom *Hangt af van* in het register) en raakt een wijziging het contract daartussen (`docs/CONTRACT.md` van het leverende project), dan mag die wijziging in één commit over beide projecten gaan. Noem hem in de HANDOFF van beide projecten.
- `git log` en `git diff` voor één project: voeg `-- <P>/` toe.
- Klantdata staat in OneDrive, nooit in de repo. Controleer vóór elke commit met `git status` dat er geen `.pbix`, `.abf`, `.xlsx`, `.xls`, `.csv`, `.pdf` of `.pptx` tussen staat.

Werkwijze, naamgeving en procesmodel: skill `bi-werkwijze`.
