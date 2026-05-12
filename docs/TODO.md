# TODO — Grovia Automations

## Next Up
- [ ] Mollie feedback loop: `mollie-webhook` Azure Function bouwen die na betaling automatisch de tag `StuurAssessment` zet via de FunnelKit/WordPress API → triggert Workflow 3A voor C2/C3-klanten
- [ ] FunnelKit workflows configureren: juiste tags, URL en parameters instellen (zie ARCHITECTURE.md)
- [ ] `GROVIA_FUNNELKIT_API_KEY` en `GROVIA_DEBUG_EMAIL` toevoegen aan `wp-config.php` op de WordPress-server
- [ ] Ixly + Mollie secrets toevoegen aan GitHub Secrets (IXLY_*, SMTP_*, MOLLIE_*, GROVIA_DEBUG_EMAIL)
- [ ] End-to-end test na deploy: cURLs uitvoeren tegen productie-URL

## Later
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
- [x] Auth flow gevalideerd — managed organizations flow werkt volledig (incl. IXLY_REDIRECT_URI)
- [x] Candidate upsert geïmplementeerd (opzoeken via api_identifier, aanmaken als niet gevonden)
- [x] Meerdere assignments per kandidaat geïmplementeerd (Blocks Game + Rally Game)
- [x] E-mailservice gekoppeld via Vimexx SMTP (zowel Ixly als Mollie function)
- [x] Azure Function URL vastgesteld: `grovia-automations-a9dxfzhpg3bbg8cr.westeurope-01.azurewebsites.net`
- [x] `flow_ixly_aanmelding.py` testscript uitgeschreven en gevalideerd in staging
