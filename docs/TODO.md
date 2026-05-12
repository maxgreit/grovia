# TODO — Grovia Automations

## Next Up
- [ ] Ixly auth flow valideren — `python explore.py` runnen, stap 2 (grant token) en stap 3 (user access token) verifiëren (koppeling staat nu)
- [ ] Candidate aanmaken en opzoeken testen via `explore.py` (POST candidate, GET via api_identifier)
- [ ] E-mailservice kiezen en koppelen aan Azure Function (SendGrid / Postmark / Azure Communication Services)
- [ ] `GROVIA_FUNNELKIT_API_KEY` en `GROVIA_DEBUG_EMAIL` toevoegen aan `wp-config.php` op de WordPress-server
- [ ] Ixly secrets toevoegen aan GitHub Secrets + deploy workflow zodra auth flow gevalideerd is

## Geblokkeerd
- [ ] Volledige end-to-end test Azure Function — wacht op e-mailservice keuze + Ixly auth validatie

## Later
- [ ] Mollie feedback loop: `mollie-webhook` Azure Function bouwen die na betaling automatisch de tag `StuurAssessment` zet via de FunnelKit/WordPress API → triggert Workflow 3A voor C2/C3-klanten
- [ ] Token caching + refresh implementeren in Azure Function (Ixly kondigt kortere token-lifetime aan)
- [ ] Workflow 3B automatiseren: betaallink genereren voor C2/C3 instapkosten
- [ ] Onderzoek data warehouse opzet: WooCommerce → Azure SQL → PowerBI
- [ ] Overleggen met klant: Assessment[seizoen] tag pas zetten ná daadwerkelijk versturen assessment (nu te vroeg bij StuurBetaallinkAssessment — blokkeert contact als betaling uitblijft)

## Done
- [x] Ixly organisatiekoppeling tot stand gebracht (Ixly heeft API-applicatie gekoppeld)
- [x] `requirements.txt` aangemaakt met gepinde versies
- [x] GitHub Actions dependency audit workflow toegevoegd
- [x] Base URL gecorrigeerd naar `https://assessmentplatform.com`
- [x] Ixly managed organizations auth flow geïmplementeerd in `explore.py` en Azure Function
