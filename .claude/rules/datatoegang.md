# Datatoegang: klantdata

Deze regel geldt in elk project, ook in auto mode. Een project-`CLAUDE.md` mag strenger zijn, nooit ruimer.

Hij geldt voor elke manier om bij data van een klant te komen: DAX tegen een Power BI-model, SQL tegen een database of warehouse, en elk command dat dat doet (`pbir model -q`, `Invoke-ASCmd`, ADOMD, `dscmd`, `sqlcmd`, `Invoke-Sqlcmd`, `psql`, `bq`, `dbt show`). Hij geldt ook voor het openen van exports en databestanden (`.xlsx`, `.csv`, `.parquet`).

## Mag zonder te vragen

- Metadata en schema: tabellen, kolommen, datatypes, relaties, en de definities van measures, views en stored procedures.
- Aantallen: `COUNTROWS`, `COUNT(*)`, `DISTINCTCOUNT`.
- Totalen en gemiddelden zonder uitsplitsing naar persoon, klant, project, medewerker of vrije tekst.
- De uitkomst van een measure op totaalniveau, of uitgesplitst naar tijd (jaar, maand, week) of naar een vaste categorie zonder namen, zoals een urencategorie.

## Eerst vragen, of de gebruiker de query laten draaien

- Detailniveau: losse rijen, transacties, urenregels en voorbeeldrijen (`SELECT *`, `TOP 10`, `EVALUATE 'Tabel'`).
- Namen, e-mailadressen, telefoonnummers, adressen, omschrijvingen, opmerkingen en andere vrije tekst.
- Uitsplitsingen of top-N-lijsten per persoon, klant, project of medewerker.
- Exports en databestanden openen.

Vraag zo: laat de query zien, zeg wat hij teruggeeft en waarom je dat nodig hebt, en bied aan dat de gebruiker hem zelf draait en alleen de uitkomst terugmeldt. Wacht op een expliciet ja.

## Bij twijfel

Weet je niet zeker of een uitkomst klantgegevens bevat, behandel hem dan als detailniveau en vraag.

## Wat je met uitkomsten doet

Neem klantgegevens die je toch te zien krijgt niet over in bestanden, commits, docs, Notion of samenvattingen. Een totaal of een aantal mag; een naam of omschrijving niet.

## Nachtsessies

In een nachtsessie is niemand om te vragen. Alles uit "Eerst vragen" is dan verboden.
