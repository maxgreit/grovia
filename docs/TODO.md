# TODO — Grovia Automations

## Next Up
- [ ] `FUNNELKIT_TAG_STUUR_ASSESSMENT_ID` opzoeken via cURL of FunnelKit-interface en instellen als env var + GitHub Secret
- [ ] Alle secrets toevoegen aan GitHub Secrets: `GROVIA_FUNNELKIT_API_KEY`, `GROVIA_WORDPRESS_URL`, `FUNNELKIT_TAG_STUUR_ASSESSMENT_ID`, `MOLLIE_WEBHOOK_URL`, `IXLY_*`, `SMTP_*`, `MOLLIE_*`
- [ ] FunnelKit workflows configureren: juiste tags, URL en parameters instellen (zie ARCHITECTURE.md)
- [ ] `grovia.nl/bedankt` aanmaken in WordPress op basis van `bedankt-preview.html`
- [ ] End-to-end test na deploy: cURLs uitvoeren tegen productie-URL

## Later
- [ ] `GROVIA_FUNNELKIT_API_KEY` en `GROVIA_DEBUG_EMAIL` toevoegen aan `wp-config.php` op de WordPress-server
- [ ] Token caching + refresh implementeren in Azure Function (Ixly kondigt kortere token-lifetime aan)
- [ ] Onderzoek data warehouse opzet: WooCommerce → Azure SQL → PowerBI
- [ ] Overleggen met klant: Assessment[seizoen] tag pas zetten ná daadwerkelijk versturen assessment (nu te vroeg bij StuurBetaallinkAssessment — blokkeert contact als betaling uitblijft)

## Done
- [x] `mollie-webhook` Azure Function gebouwd (betaling verifiëren → tag StuurAssessment zetten via FunnelKit API)
- [x] `mollie-betaallink` gefixed: metadata meegegeven aan payment link (email, wc_klant_id, voornaam, achternaam)
- [x] `bedankt-preview.html` gemaakt voor grovia.nl/bedankt (Figtree + Roboto, Grovia kleurpalet)
- [x] Ixly aanmelding flow volledig uitgebouwd + gevalideerd in staging
- [x] E-mailservice gekoppeld via Vimexx SMTP (zowel Ixly als Mollie function)
