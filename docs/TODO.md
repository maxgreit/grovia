# TODO — Grovia Automations

## Next Up
- [ ] Ixly auth flow valideren zodra organisatiekoppeling staat (explore.py → managed organizations lijst)
- [ ] E-mailservice kiezen en koppelen aan Azure Function (SendGrid / Postmark / Azure Communication Services)
- [ ] Uncommitted changes committen (functions/, plugins/, docs/, explore.py, etc.)
- [ ] `GROVIA_FUNNELKIT_API_KEY` en `GROVIA_DEBUG_EMAIL` toevoegen aan `wp-config.php` op de WordPress-server

## Geblokkeerd
- [ ] Ixly connectie testen — **wacht op Ixly**: organisatie moet gekoppeld worden aan API-applicatie + API-gebruiker aangemaakt worden
- [ ] Ixly secrets toevoegen aan GitHub Secrets + deploy workflow zodra Ixly koppeling staat (`IXLY_BASE_URL`, `IXLY_CLIENT_ID`, `IXLY_CLIENT_SECRET`, `IXLY_ORGANIZATION_UUID`)

## Later
- [ ] Mollie feedback loop: `mollie-webhook` Azure Function bouwen die na betaling automatisch de tag `StuurAssessment` zet via de FunnelKit/WordPress API → triggert Workflow 3A voor C2/C3-klanten
- [ ] Token caching + refresh implementeren in Azure Function (Ixly kondigt kortere token-lifetime aan)
- [ ] Workflow 3B automatiseren: betaallink genereren voor C2/C3 instapkosten
- [ ] Onderzoek data warehouse opzet: WooCommerce → Azure SQL → PowerBI
- [ ] Overleggen met klant: Assessment[seizoen] tag pas zetten ná daadwerkelijk versturen assessment (nu te vroeg bij StuurBetaallinkAssessment — blokkeert contact als betaling uitblijft)

## Done
- [x] `requirements.txt` aangemaakt met gepinde versies
- [x] GitHub Actions dependency audit workflow toegevoegd
- [x] Base URL gecorrigeerd naar `https://assessmentplatform.com`
- [x] Ixly managed organizations auth flow geïmplementeerd in `explore.py` en Azure Function
- [x] FunnelKit workflow structuur vastgesteld (4 workflows, rol Azure Function bepaald)
