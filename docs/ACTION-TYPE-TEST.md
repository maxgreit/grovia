# Action Type Test — referentie

De Action Type test is een MBTI-achtige vragenlijst (20 a/b-vragen → 4-letter Action Type,
bijv. `ISTJ`). Per vereniging één Google Form + gekoppelde resultaten-sheet.

Setup-script: [`google-apps-script/action-type-setup.gs`](../google-apps-script/action-type-setup.gs)
Drive-map (forms + sheets): https://drive.google.com/drive/folders/1rquUBAEV3z7emUm53mKIMfst3tvbIT8G

## Links

### Kolping Academie
| | |
|---|---|
| Form (FunnelKit-link, KA-tag) | https://docs.google.com/forms/d/e/1FAIpQLSc6HIBgffV-rQiM4KDFW4weK3JGOzGKWrGwUP1D7HtNYg_Qiw/viewform |
| Form (bewerken) | https://docs.google.com/forms/d/1228GYdB01e4jAAyzzu0Yb4NgXUnxK0Ph84dhHCSQjKo/edit |
| Resultaten-sheet | https://docs.google.com/spreadsheets/d/1HQmSEdj07CVlY1_mTcJoBjseRo4nqQs1TdIrx9ZFXkU/edit |

### Schagen United
| | |
|---|---|
| Form (FunnelKit-link, SU-tag) | https://docs.google.com/forms/d/e/1FAIpQLSd521BhxYq3L27FNmqZ5w2D1Bra6Sk9NwB_dvgRlKHRIDbl8g/viewform |
| Form (bewerken) | https://docs.google.com/forms/d/1SoQJr6xLtN6cXo1yN7ztjUBiFrq_3jEwyIHtTsubk3U/edit |
| Resultaten-sheet | https://docs.google.com/spreadsheets/d/1e4-BfBpyCaDufVHYbZoRLXN9auRV52rQnqVeaKSgOuw/edit |

## Scoring

5 vragen per dichotomie (oneven → nooit gelijkspel), `a` = eerste letter:

| Dichotomie | Vragen | a | b |
|---|---|---|---|
| E/I | 1, 5, 9, 13, 17 | E | I |
| S/N | 2, 6, 10, 14, 18 | S | N |
| T/F | 3, 7, 11, 15, 19 | T | F |
| J/P | 4, 8, 12, 16, 20 | J | P |

De lettercombinatie wordt automatisch berekend door een `ARRAYFORMULA` in een **apart
tabblad "Resultaten"** (kolommen Naam + Action Type) — geen trigger nodig.

> **Let op:** de formule staat bewust NIET in het reactie-tabblad zelf. Google Forms
> overschrijft kolommen direct naast de formuliervragen bij elke nieuwe inzending
> (je ziet dan bijv. "Column 24" verschijnen). Het tabblad "Resultaten" verwijst naar
> de reacties en wordt door Forms niet aangeraakt.

Kolomvolgorde reactie-tabblad: `A=Timestamp B=Naam C..V=Vraag 1..20 W=Begrijpelijkheid`.
De functie `herstelActionType` in het script herstelt het Resultaten-tabblad voor
bestaande sheets zonder nieuwe formulieren/links te maken.

## FunnelKit-koppeling

Stuur klanten de juiste form-link op basis van de school-tag: **KA → Kolping-form**,
**SU → Schagen-form**.

## Speler-koppeling

Elk van de 16 Action Types is gekoppeld aan een voetballer (quote + korte omschrijving),
overgenomen uit `Action Types.docx`. De data staat hardcoded in `ACTION_TYPES`
(`google-apps-script/action-type-setup.gs`) en wordt weggeschreven naar:

- Een naslagtabblad **"Action Types"** (alle 16 rijen: Code, Type, Speler, Omschrijving, Quote).
- 3 extra kolommen in **"Resultaten"** (Speler, Omschrijving, Quote), automatisch opgezocht per
  deelnemer op basis van hun berekende Action Type.

Zie [`docs/superpowers/specs/2026-07-01-action-type-player-lookup-design.md`](superpowers/specs/2026-07-01-action-type-player-lookup-design.md)
voor het volledige ontwerp.

## Open punten

- Extra tabs per categorie (jong/oud × voetbal/keeper) volgen later, op basis van Ixly-data.
