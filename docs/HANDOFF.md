# Handoff — Grovia Automations

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
