# TODO — Grovia Automations

> Bron van waarheid voor taken is **Notion** (projecten: Grovia-Coding + Automatisering-Grovia).
> Items met `(lokaal)` staan (nog) niet in Notion — zie onderaan.

## Next Up

- **Ixly-afronding: nieuwe schrijfbare WooCommerce-sleutel aanmaken** `(lokaal)` — de fix voor de kapotte Ixly-statuscontrole (zie ADR + design-doc van 2026-08-01) heeft een NIEUWE, schrijfbare WooCommerce REST-sleutel nodig (los van de bestaande alleen-lezen sleutel van Apps Script). Aanmaken via WooCommerce → Instellingen → Geavanceerd → REST API (permissies: lezen/schrijven), en als Azure App Settings zetten: `GROVIA_WOO_CONSUMER_KEY`, `GROVIA_WOO_CONSUMER_SECRET`. Zonder deze sleutels wordt `_grovia_ixly_taken` niet bewaard (gelogd, geen fout) en blijft een nieuwe order net als de bestaande ~31 rijen op handmatige Ixly-controle staan.
- **Ixly-afronding einde-tot-einde verifiëren met een nieuwe order** `(lokaal)` — na het zetten van de sleutel hierboven: plaats een testorder, controleer dat `Deelnemers!ixly_taken` gevuld raakt, en (als je weet dat het kind de games al heeft afgerond) dat `dagelijkseRun` `ixly_af` op JA zet.

1. **Action Type test-mail conditioneel versturen** — uitnodigingsmail moet NIET naar iedereen; voorwaarde-logica toevoegen aan de Grovia PHP-code (tag-logica) zodat alleen de juiste klanten de mail krijgen. Forms + sheets + scoring + mailtemplates zijn klaar (zie [ACTION-TYPE-TEST.md](ACTION-TYPE-TEST.md))
2. **FunnelKit automation inrichten** `(lokaal)` — één automation met decision tree, trigger op `WA_KA_VT`, `WA_KA_KT`, `WA_SU_VT`, `WA_SU_KT`, `WA_MM_VT`; per branch: remove trigger tag → conditie geen WAGroep-tag → HTTP Request Azure Function → add WAGroep-tag
3. **Database opzetten voor opslag testgegevens (Ixly brondata)** — Notion, prioriteit High
4. **Fysio-toestemming afronden** `(lokaal)` — (1) testorder met 100%-kortingscode om order-meta in admin te verifiëren (daarna order + code verwijderen), (2) WP-pagina `/toestemming-fysieke-intakes/` publiceren zodra klantteksten binnen zijn — links staan al live en geven nu 404 (concept: [infopagina-concept.md](../plugins/grovia-fysio-toestemming/infopagina-concept.md)), (3) categorie `toestemming-vereist` aan overige trainingen hangen (nu alleen Zomerspektakel Kolping)
5. **Klantvragen fysio-toestemming uitzetten bij Berry** `(lokaal)` — documentinhoud, intrekprocedure, privacyverklaring (pop-uptekst ✓ en gegevensdeling ✓ zijn al beantwoord; zie spec §Open vragen)

## Later — Datawarehouse & teamindeling (Notion)

- [ ] Database inrichting
- [ ] Azure Portal
- [ ] PowerBI Licenties
- [ ] Geautomatiseerde teamindeling opzetten
- [ ] Automatische teamranking opzetten (kids op volgorde van score, beste → minst goed) o.b.v. Ixly-data
- [ ] Google Sheet per vereniging aanmaken met vier tabbladen: jong voetbal, oud voetbal, jong keeper, oud keeper
- [ ] Script/trigger bouwen op Google Sheet die bij nieuwe rij Rubens-formule uitvoert en resultaat opslaat
- [ ] Google Sheet inrichten met tabblad ruwe antwoorden én tabblad met naam, ID, testuitslag en gekoppeld spelerprofiel
- [ ] Google Form aanmaken op basis van vragen/antwoorden persoonlijkheidstest
- [ ] E-mailreminder loop opzetten voor openstaande testen, met cap ~2–3 maanden
- [ ] Canva-koppeling: dynamische informatie automatisch vullen
- [ ] Voorstel maken omtrent automatisering

## Done

- [x] Funnelkit flow voor Google Form — vervangen door inzicht: voorwaarde-logica hoort in de Grovia PHP-code (tag-logica), zie Next Up #1 (2026-06-23, Max — via Notion-sync)
- [x] Fysio-toestemming plugin gebouwd, gedeployed en live geverifieerd — vinkje via opt-in categorie `toestemming-vereist`, pop-up in sitethema met klanttekst, order-meta + admin-weergave, AJAX-refresh-bugfix (2026-07-28, Max)
- [x] Action Type test opgezet — 2 Google Forms (KA + SU) + gekoppelde sheets via Apps Script, scoring via ARRAYFORMULA in apart "Resultaten"-tabblad, 2 uitnodigingsmails (zie [ACTION-TYPE-TEST.md](ACTION-TYPE-TEST.md)) (2026-06-23, Max)
- [x] Debug-mail uitgezet in productie — `wp_mail` → `error_log` in beide plugins; `GROVIA_DEBUG_EMAIL` define verwijderd (2026-06-23, Max) ⚠️ deploy naar WP nodig
- [x] FunnelKit contact phone-sync gecontroleerd — billing_phone field mapping OK (2026-06-23, Max)
- [x] Test-contact "Max Test" opgeruimd — oude `Assessment2526` tag verwijderd (2026-06-23, Max)
- [x] Groepslinks ophalen bij Berry (Kolping Academie + Schagen United) (2026-06-23, Max — via Notion-sync)
- [x] WhatsApp berichtlevering bevestigd werkend — bericht komt aan op telefoon (2026-06-15)
- [x] order_id KeyError gefixed in logging — body.get() ipv body[] (2026-06-15)
- [x] MiniMove voetbaltraining categorie toegevoegd aan MiniMove-product in WP (2026-06-15)
- [x] FunnelKit flow + tagging uitgedacht — WA_ trigger tags + WAGroep_ guard tags via grovia-automations.php (2026-06-12)
- [x] WAGroep guard-tags retroactief ingesteld voor bestaande klanten via migratiescript (2026-06-12)
