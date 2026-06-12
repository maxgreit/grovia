# TODO — Grovia Automations

## Next Up

1. **FunnelKit automation inrichten** — één automation met decision tree, trigger op `WA_KA_VT`, `WA_KA_KT`, `WA_SU_VT`, `WA_SU_KT`, `WA_MM_VT`; per branch: remove trigger tag → conditie geen WAGroep-tag → HTTP Request Azure Function → add WAGroep-tag
2. **Groepslinks aanleveren bij Berry** — WhatsApp-groepslinks voor KA voetbal, KA keepers, SU voetbal, SU keepers, MiniMove
3. **MiniMove `voetbaltraining` categorie toevoegen** in WP aan MiniMove-product (niet de proeftraining)

## Blocked

## Later

- [ ] WhatsApp levering debuggen — Meta accepteert berichten (wamid terug) maar bericht komt niet aan op telefoon; mogelijke oorzaak: privacy-instelling ontvanger of delay
- [ ] Debug-mail uitzetten in productie — stuurt nu volledige klantdata (naam, email, bedrag) naar max@greit.nl bij elke run; anonimiseren of afschermen via WP_DEBUG-check
- [ ] Test-contact "Max Test" opruimen: verwijder `Assessment2526` tag (oud, zonder naam_slug)
- [ ] Onderzoek data warehouse opzet: WooCommerce → Azure SQL → PowerBI
- [ ] Ixly score-response verifiëren voor Blocks Game en Rally Game via explore.py

## Done

- [x] FunnelKit flow + tagging uitgedacht — WA_ trigger tags + WAGroep_ guard tags via grovia-automations.php (2026-06-12)
- [x] WAGroep guard-tags retroactief ingesteld voor bestaande klanten via migratiescript (2026-06-12)
- [x] WhatsApp Azure Function uitgebreid met components (voornaam, schoolnaam, groepslink) (2026-06-12)
- [x] WP productcategorieën aangemaakt: voetbaltraining, keeperstraining, evenement (2026-06-12)
- [x] grovia-automations.php uitgebreid met WA trigger tag logica (school + type detectie) (2026-06-12)
- [x] `groviagroepsappuitnodiging` template goedgekeurd in Grovia WABA (2026-06-12)
- [x] `groviagroepsapp` template aangemaakt in juiste Grovia WABA — ingediend ter beoordeling (2026-06-09)
- [x] WABA-structuur uitgezocht: prepaid nummer zit in Grovia WABA (ID: 1320633513537881) (2026-06-09)
- [x] Berry regelt prepaid SIM — geregeld, nummer toegevoegd aan Meta Cloud API (2026-06-06)
- [x] Meta Business Verification afronden — KvK-uittreksel geüpload (2026-06-06)
- [x] WhatsApp Azure Function lokaal getest — functie bereikt Meta API correct (2026-06-06)
