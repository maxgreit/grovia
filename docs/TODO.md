# TODO — Grovia Automations

## Next Up
- [ ] `mollie-webhook` end-to-end testen met echte testbetaling — ngrok of productie (Mollie stuurt in testmodus geen webhooks naar externe URLs)
- [ ] `grovia.nl/bedankt` aanmaken in WordPress op basis van `bedankt-preview.html`
- [ ] Volledige keten testen: testkoop WooCommerce → tag → router → assessment of betaallink → na betaling webhook → Ixly aanmelding

## Later
- [ ] `GROVIA_FUNNELKIT_API_KEY` en `GROVIA_DEBUG_EMAIL` toevoegen aan `wp-config.php` op de WordPress-server
- [ ] Token caching + refresh implementeren in Azure Function (Ixly kondigt kortere token-lifetime aan)
- [ ] Onderzoek data warehouse opzet: WooCommerce → Azure SQL → PowerBI
- [ ] Overleggen met klant: Assessment[seizoen] tag pas zetten ná daadwerkelijk versturen assessment (nu te vroeg bij StuurBetaallinkAssessment — blokkeert contact als betaling uitblijft)

## Done
- [x] FunnelKit Workflow 3A en 3B geconfigureerd: trigger, URL + `?code=FUNCTION_KEY`, payload — inclusief `FUNNELKIT_TAG_STUUR_ASSESSMENT_ID` als secret
- [x] Alle secrets toegevoegd aan GitHub Secrets en `deploy.yml` bijgewerkt — alle drie functions correct geconfigureerd op productie
- [x] `mollie-betaallink` gefixed: metadata verwijderd (niet ondersteund door Payment Links API), klantidentificatie nu via query params in webhookUrl
- [x] End-to-end test `ixly-aanmelding` geslaagd op productie — candidate aangemaakt, assignments gekoppeld, e-mail verstuurd met `login_url`
- [x] `mollie-webhook` bijgewerkt: leest email + wc_klant_id nu uit query params i.p.v. metadata
- [x] `bedankt-preview.html` gemaakt voor grovia.nl/bedankt (Figtree + Roboto, Grovia kleurpalet)
