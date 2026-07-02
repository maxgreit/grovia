# TODO — Grovia Automations

> Bron van waarheid voor taken is **Notion** (projecten: Grovia-Coding + Automatisering-Grovia).
> Items met `(lokaal)` staan (nog) niet in Notion — zie onderaan.

## Next Up

1. **Action Type test-mail conditioneel versturen** — uitnodigingsmail moet NIET naar iedereen; voorwaarde-logica toevoegen aan de Grovia PHP-code (tag-logica) zodat alleen de juiste klanten de mail krijgen. Forms + sheets + scoring + mailtemplates zijn klaar (zie [ACTION-TYPE-TEST.md](ACTION-TYPE-TEST.md))
2. **FunnelKit automation inrichten** `(lokaal)` — één automation met decision tree, trigger op `WA_KA_VT`, `WA_KA_KT`, `WA_SU_VT`, `WA_SU_KT`, `WA_MM_VT`; per branch: remove trigger tag → conditie geen WAGroep-tag → HTTP Request Azure Function → add WAGroep-tag
3. **Database opzetten voor opslag testgegevens (Ixly brondata)** — Notion, prioriteit High

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
- [ ] Funnelkit flow voor Google Form
- [ ] E-mailreminder loop opzetten voor openstaande testen, met cap ~2–3 maanden
- [ ] Canva-koppeling: dynamische informatie automatisch vullen
- [ ] Voorstel maken omtrent automatisering

## Done

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
