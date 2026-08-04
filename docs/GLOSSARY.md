# Glossarium — Grovia Automations

| Term | Betekenis |
|---|---|
| FunnelKit | WordPress plugin voor e-mailautomatisering en CRM |
| Ixly | Aanbieder van online assessments voor de sportsector |
| WCAPI | WooCommerce REST API — voor het uitlezen van winkeldata |
| Azure Functions | Serverless compute-dienst van Microsoft Azure |
| Azure SQL | Beheerde SQL-database in Microsoft Azure |
| PowerBI | Microsoft-tool voor data-visualisaties en dashboards |
| WABA | WhatsApp Business Account — Meta-account waaronder telefoonnummer en templates vallen |
| Phone Number ID | Meta-identifier van het gekoppelde WhatsApp-telefoonnummer (env var: `WHATSAPP_PHONE_NUMBER_ID`) |
| E.164 | Internationaal telefoonformaat zonder + prefix, bijv. `31612345678` |
| WhatsApp template | Vooraf door Meta goedgekeurd berichtformaat voor zakelijke WhatsApp-berichten |
| Meta Cloud API | Meta's cloud-hosted API voor het versturen van WhatsApp Business berichten |
| Action Type | MBTI-achtig vierletterig persoonlijkheidstype (bijv. `ISTJ`), uitkomst van de Action Type-test |
| Dichotomie | Eén van de vier assen waaruit een Action Type is opgebouwd: E/I, S/N, T/F, J/P |
| Action Type-test | Google Form per vereniging; scoring via `ARRAYFORMULA` in een apart "Resultaten"-tabblad |
| Cyclus | Een trainingsblok. Drie per seizoen: C1, C2, C3 |
| Seizoenkaart | Inschrijving voor alle drie de cycli tegelijk. `SMT` (met tenue) of `SZT` (zonder tenue) |
| Afdracht | €20 per deelnemer per cyclus, excl. btw, af te dragen aan de vereniging |
| Rol | Speler of Keeper, afgeleid uit de WooCommerce-categorie (Voetbaltraining / Keeperstraining) |
| Inschrijving | De WooCommerce-**variatie** die cyclus of seizoenkaart bepaalt. Komt uit de API als regelmeta `pa_inschrijving` met de ruwe slug als waarde (`cyclus-1`), niet het zichtbare label — géén categorie |
| `reminder_anker` | De datum vanaf wanneer de reminder-drempels tellen. Leeg = val terug op `uitgenodigd_op`. Bestaat om het schema per rij te kunnen herstarten (ADR-010) |
| Fysio-toestemming | Optionele toestemming op de checkout voor de fysieke testen en de declaratie daarvan via de basisverzekering fysiotherapie |
| `toestemming-vereist` | Productcategorie die het toestemmingsvinkje aanzet (opt-in). Geen categorie = geen vinkje |
| Potentieprofiel | Het samengestelde beeld van een deelnemer; blijft onvolledig zonder fysio-toestemming |
| Toestemmingsverklaring | Het door Grovia en SMC Dijk en Waard goedgekeurde document dat vastlegt waarvoor toestemming wordt gegeven. Schrijft letterlijk voor met welke tekst het checkout-hokje wordt aangevinkt (ADR-011) |
| SMC Dijk en Waard | Fysiotherapiepraktijk in Heerhugowaard; partner die twee keer per seizoen de fysieke testen afneemt |
| MoveHealth | Het app-systeem waarin deelnemers hun testresultaten en een persoonlijk blessurepreventieprogramma krijgen |

## Let op: twee seizoensgrenzen

Er bestaan bewust twee definities van "seizoen" naast elkaar:

| Grens | Waar | Waarom |
|---|---|---|
| **1 juni** | `Financieel.gs` | Cyclusverkoop voor het nieuwe seizoen begint al in juni/juli; die orders horen bij het nieuwe seizoen |
| **1 augustus** | `bepaalSeizoen()` in `Deelnemers.gs` | De deelnemersadministratie en reminder-indeling volgen het trainingsseizoen |

`Financieel.gs` roept `bepaalSeizoen()` daarom nergens aan. Dit is een valkuil bij toekomstige wijzigingen: verschuif je één grens, dan verschuif je niet automatisch de andere — en dat is de bedoeling.

## Let op: drie termen voor hetzelfde

Voor het blessurepreventie-onderdeel bestaan drie formuleringen naast elkaar, bewust nog niet gelijkgetrokken:

- **"testen en meten"** — de terminologie van de klant zelf, gebruikt in de toestemmingsverklaring en op de infopagina
- **"fysieke intakes en behandelingen"** — in de plugin-beschrijving en de URL-slug `/toestemming-fysieke-intakes/`
- **"testen"** — in de pop-uptekst, letterlijk zo door de klant aangeleverd

Gelijktrekken raakt de pop-up, de plugin-beschrijving en de slug (met een redirect voor de oude). Dat is een aparte klus.
