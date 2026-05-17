# Grovia Automations — CLAUDE.md

## Quick Facts

| | |
|---|---|
| **Project** | Grovia Automations |
| **Klant** | Grovia (voetbalschool) |
| **Developer** | Max Rood |
| **Status** | MVP in progress |
| **GitHub** | `git@GreitMax:maxgreit/grovia.git` (SSH-alias: GreitMax) |
| **Notion Coding Project** | https://www.notion.so/361b8e171c1381c984b7f9a63c4d5a25 |
| **Build** | `func start` (Azure Functions) |
| **Run** | `func start` |

## Beschrijving

Automatiseringen voor Grovia, een voetbalschool die voetbaltrainingen aanbiedt. Het project omvat drie pijlers:

1. **E-mailautomatisering** — via FunnelKit Automations in combinatie met zelfgeschreven PHP-plugins voor WordPress (MVP in progress)
2. **Assessment aanmeldingen** — Azure Functions voor het aanmelden bij Ixly Assessments (nog uit te denken)
3. **Data warehouse** — mogelijk later: WooCommerce-data via de WCAPI inladen in Azure SQL Database met PowerBI-visualisaties

## Tech Stack

| Onderdeel | Technologie |
|---|---|
| Frontend | Geen (nog niet) |
| Backend | PHP (WordPress plugins), Azure Functions |
| Database | Azure SQL Database (mogelijk later) |
| Hosting | WordPress (bestaand), Azure |
| Automatisering | FunnelKit Automations |
| Externe services | Ixly Assessments API, WooCommerce API (WCAPI), PowerBI |

## Voertaal

- **Code:** Nederlands
- **Docs / commits / UI:** Nederlands

## Kritieke Regels

- **NOOIT secrets, API-sleutels, wachtwoorden of tokens in code opslaan.** Gebruik altijd omgevingsvariabelen of een secrets manager. Als ik dit zie of dreig te doen, moet ik Max hier actief op wijzen en corrigeren.
- Gebruik `.env`-bestanden lokaal en zorg dat deze nooit gecommit worden (`.gitignore`).

## Superpowers

Dit project gebruikt de **Superpowers plugin**. Gebruik sessie-instructies en geheugen via de Superpowers-workflow.

## Sessie starten

Gebruik `/start-session` om elke nieuwe sessie te starten. Dit laadt de relevante context en bevestigt begrip van de huidige staat.

## Documentatie

| Bestand | Inhoud |
|---|---|
| `docs/HANDOFF.md` | Overdracht tussen sessies — wat werkt, wat open staat |
| `docs/TODO.md` | Actielijst — Next Up, Later, Ideeën |
| `docs/DECISIONS.md` | Architectuurbeslissingen (ADR's) |
| `docs/ARCHITECTURE.md` | Technische opzet en componentenoverzicht |
| `docs/CONVENTIONS.md` | Naamgeving, stijl, patronen |
| `docs/GLOSSARY.md` | Projectspecifieke termen en afkortingen |
