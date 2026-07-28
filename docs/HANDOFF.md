# Handoff — Grovia Automations

## 2026-07-28 — Max

**Branch:** `main` · **Commit:** `99867d0` (13 commits deze sessie, gepusht) · **Build:** 🟢 PHP-lint (Docker `php:8.2-cli`) + `py_compile` OK · **Status:** MVP in progress

### Wat er deze sessie is gebeurd

- **Nieuwe plugin `grovia-fysio-toestemming` gebouwd én live op grovia.nl.** Optioneel toestemmingsvinkje op de checkout voor fysieke intakes/behandelingen fysiopraktijk + declaratie zorgverzekeraar. Opt-in via productcategorie `toestemming-vereist` (nu toegekend aan Zomerspektakel Kolping). Keuze wordt opgeslagen als order-meta (`_grovia_fysio_toestemming` ja/nee + tijdstip, afwezig = n.v.t.) en getoond in het admin-orderscherm. Eénmalige pop-up-nudge via `sessionStorage`, gestyled in het sitethema (kaart `#1d2110`, accent `#FF5C00`, radius 16px).
- **Proces:** spec + implementatieplan via superpowers (subagent-driven, per taak gereviewd). Finale review vond een echte bug — vinkje-status ging verloren bij AJAX fragment-refresh (`update_order_review` stuurt velden in `post_data`) — gefixt met `parse_str`-fallback.
- **Pop-uptekst letterlijk van de klant overgenomen** (bewust mét "testen", afwijkend van de "intakes en behandelingen"-terminologie elders — keuze van Max na expliciete vraag).
- **Live geverifieerd met de browser:** vinkje conditioneel ✓, pop-up eenmalig ✓, beide knoppen ✓, vinkje overleeft validatiefout ✓, geen vinkje zonder categorie-product ✓. Geen testorder geplaatst.

### Open items / Next steps

1. **Testorder met 100%-kortingscode** (Max, vandaag) — hele keten incl. order-meta in admin verifiëren; daarna order + kortingscode verwijderen.
2. **WP-pagina `/toestemming-fysieke-intakes/` publiceren** — geeft nu 404 terwijl de links al live staan; concepttekst in [plugins/grovia-fysio-toestemming/infopagina-concept.md](../plugins/grovia-fysio-toestemming/infopagina-concept.md), wacht op klantantwoorden (vragenlijst ligt bij Max/Berry).
3. **Categorie `toestemming-vereist` aan de overige trainingen hangen** zodra de klant bepaalt welke producten meedoen (nu alleen Zomerspektakel).
4. Eerdere Next Ups blijven staan: Action Type-mail conditioneel, FunnelKit WA-automation, Ixly-database.

### Belangrijke context die niet mag verdwijnen

- **WooCommerce fragment-refresh wist custom checkout-velden:** bij `update_order_review` (o.a. na élke validatiefout) komen veldwaarden niet als losse `$_POST`-keys binnen maar geserialiseerd in `$_POST['post_data']`. Custom checkboxes moeten die fallback zelf parsen (WC herstelt alleen z'n eigen `#terms`). Zit nu in de plugin — geldt ook voor toekomstige checkout-velden.
- **De checkout leeft op `/checkout/`, niet `/afrekenen/`** (dat pad geeft 404).
- **Order-meta is niet handmatig te previewen:** admin-orders doorlopen de checkout-hooks niet en underscore-meta is beschermd; testen kan alleen via een echte (gratis) checkout.
- **Terminologie-mix is bewust:** pop-up zegt "testen" (klanttekst letterlijk), vinkje + infopagina zeggen "intakes en behandelingen". Als de fysio er één lijn van wil maken: kleine tekstwijziging.
- De pop-uptekst beantwoordt klantvraag 3 (gegevensdeling): naam kind, geboortedatum, e-mailadres, woonadres — bruikbaar voor de infopagina; let op: woonadres = factuuradres van de ouder.

## 2026-06-23 — Max

**Branch:** `main` · **Commit:** `870c670` (geen commits deze sessie — alles working copy) · **Build:** 🟢 Python `py_compile` OK (10 eigen bestanden)

### Wat er deze sessie is gebeurd

- **Action Type test volledig opgezet.** Apps Script ([google-apps-script/action-type-setup.gs](../google-apps-script/action-type-setup.gs)) genereert per vereniging (Kolping Academie + Schagen United) een Google Form (20 a/b-vragen 1-op-1 uit `test_docs/Test.docx`) + gekoppelde Sheet. De Action Type-lettercombinatie (MBTI-stijl, bv. `ISTJ`) wordt berekend met een `ARRAYFORMULA`. Forms + sheets staan in de Grovia Drive-map; alle links in [docs/ACTION-TYPE-TEST.md](ACTION-TYPE-TEST.md).
- **Scoring-bug gefixt:** formule stond eerst in kolom X van het reactie-tabblad, maar Google Forms overschrijft die kolom bij elke inzending ("Column 24"). Verplaatst naar een apart tabblad **"Resultaten"** dat naar de reacties verwijst. Script heeft nu een `herstelActionType`-functie voor bestaande sheets.
- **2 uitnodigingsmails** gemaakt ([email-templates/](../email-templates/)), platte ASCII (FunnelKit-renderer verminkt emoji/`—`/`é`), Kolping oranje / Schagen rood knop, alleen merge-tag `{{contact_first_name}}`.
- **Privacy-fix PHP:** debug-mail (`wp_mail` naar `max@greit.nl` met klantdata) vervangen door `error_log` in beide plugins; `GROVIA_DEBUG_EMAIL` verwijderd. ⚠️ moet nog naar WordPress gedeployed.
- **Docs/Notion-sync:** CLAUDE.md Notion-project-URL gecorrigeerd (was 404) + 2e projectreferentie; TODO herstructureerd met Notion als bron van waarheid; diverse Notion-taken op Done.

### Open items / Next steps

1. **Action Type test-mail conditioneel versturen** — niet iedereen mag de mail krijgen; voorwaarde-logica toevoegen aan de Grovia PHP-code (tag-logica). Forms/sheets/scoring/mails zijn klaar, alleen de trigger-conditie ontbreekt.
2. **PHP-fixes deployen naar WordPress** — debug-mail-fix (error_log) draait nog niet in productie tot deploy.
3. **`herstelActionType` draaien** (Max) — als de Action Type nog niet in het "Resultaten"-tabblad van de 2 bestaande sheets staat.
4. **FunnelKit WhatsApp-automation inrichten** (decision tree op `WA_*` tags → HTTP Request → guard-tag).
5. **Datawarehouse/teamindeling** (Notion, later): Ixly-brondata DB, 4 categorie-tabs (jong/oud × voetbal/keeper), ID/spelerprofiel-koppeling, teamranking.

### Belangrijke context die niet mag verdwijnen

- **Google Forms overschrijft formules in/naast het reactie-tabblad.** Alle afgeleide berekeningen in een apart tabblad zetten dat verwijst — nooit in de responses-kolommen zelf.
- **Apps Script `setFormula` vereist en_US-notatie** (komma's), ongeacht de sheet-taal.
- **Geen prefill mogelijk vanuit FunnelKit** voor `order_id`/`naam_kind`: dat zijn custom order-meta, geen merge-tags. Alleen contact-velden (`{{contact_first_name}}` e.d.) werken. Daarom vult het kind zelf de naam in (mail vraagt expliciet om volledige naam).
- **Beschikbare order-data in PHP** ([grovia-assessment-router.php:123](../plugins/grovia-automations/grovia-assessment-router.php)): `voornaam`/`achternaam` = ouder (billing), `naam_kind` = order-meta "Naam kind", + `email`, `wc_klant_id`, `order_id`.
- **Action Types.docx beschrijft maar 12 van 16 types** (ExxJ ontbreken) — alleen relevant bij tonen van typebeschrijving, niet voor de lettercombinatie.
- **Uncommitted:** ook een niet-gecommitte template-sync in `.claude/` staat klaar (los van het inhoudelijke werk).

## 2026-06-15 — Max

**Branch:** `main` · **Commit:** `870c670` · **Build:** 🟢 Python `py_compile` OK

### Wat er deze sessie is gebeurd

Dag-afsluiting verwerkt: ARCHITECTURE.md uitgebreid met `whatsapp-uitnodiging` endpoint + WABA-tabel, GLOSSARY.md met 5 WhatsApp/Meta termen. WhatsApp berichtlevering end-to-end bevestigd werkend. `KeyError` op `order_id` in logging gefixt (crashte de function ná succesvolle Meta API-call → 500 terwijl bericht wél verstuurd was). FunnelKit HTTP Request-stap geconfigureerd met correcte payload.

### Open items / Next steps

- FunnelKit automation inrichten (decision tree op WA_-tags → HTTP Request → WAGroep-guard-tag)
- Groepslinks ophalen bij Berry (KA/SU voetbal+keepers, MiniMove)
- FunnelKit phone-sync controleren (`{{contact_phone}}` field mapping)

### Belangrijke context die niet mag verdwijnen

- FunnelKit HTTP Request-veldnamen zijn case-sensitive en lowercase: `voornaam`, `telefoon`, `schoolnaam`, `groepslink`.
- Template `groviagroepsappuitnodiging` (taalcode `nl`) goedgekeurd; params `{{1}}` voornaam, `{{2}}` schoolnaam, `{{3}}` groepslink.
- Trigger tags: `WA_KA_VT`/`WA_KA_KT`/`WA_SU_VT`/`WA_SU_KT`/`WA_MM_VT`; guard tags: `WAGroep_*`.
- Azure endpoint: `POST …/api/whatsapp-uitnodiging?code=<sleutel>`. WABA ID 1320633513537881, Phone Number ID 1192313800624887.
