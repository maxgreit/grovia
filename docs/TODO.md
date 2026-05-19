# TODO — Grovia Automations

## Next Up
- [ ] **Open vraag Jan-Willem (Ixly):** Is e-mailveld op candidate nodig voor het inlogscherm? Antwoord verwerken in `_maak_candidate_aan` — zie TODO-comment in code en ADR-004. Zo nee: e-mail verwijderen. Zo ja: blijft staan (ouder-e-mail).
- [ ] FunnelKit Workflow 3A payload uitbreiden: `kind_voornaam`, `kind_achternaam`, `order_id` toevoegen als velden (merge tags: `{{billing_kind_voornaam}}`, `{{billing_kind_achternaam}}`, `{{wc_order_id}}`)
- [ ] WooCommerce checkout-veld "Naam kind" aanmaken (zodat FunnelKit kind_voornaam/kind_achternaam kan meesturen)
- [ ] Live review met klant: volledige keten doorlopen (WooCommerce testkoop → tag → router → assessment of betaallink → webhook → Ixly) — **deadline 20 mei**

## Later
- [ ] `GROVIA_FUNNELKIT_API_KEY` en `GROVIA_DEBUG_EMAIL` toevoegen aan `wp-config.php` op de WordPress-server
- [ ] Token caching + refresh implementeren in Azure Function (Ixly kondigt kortere token-lifetime aan)
- [ ] Onderzoek data warehouse opzet: WooCommerce → Azure SQL → PowerBI
- [ ] Overleggen met klant: Assessment[seizoen] tag pas zetten ná daadwerkelijk versturen assessment (nu te vroeg bij StuurBetaallinkAssessment — blokkeert contact als betaling uitblijft)

## Done
- [x] Ixly kandidaat-per-kind geïmplementeerd: `api_identifier = order_id`, candidate op naam kind, duplicate assignment guard, unit tests (17/17 groen)
- [x] Overleg Berry + Jan-Willem (Ixly): architectuurkeuze helder — `api_identifier` is de unieke sleutel, e-mail niet verplicht
- [x] `MOLLIE_REDIRECT_URL` GitHub Secret aangepast naar `https://grovia.nl/bedankt` + nieuwe deploy getriggerd
- [x] Volledige keten getest en werkend: FunnelKit Workflow 3A + 3B → Azure Functions → Mollie webhook → Ixly aanmelding
- [x] `grovia.nl/bedankt` pagina opgezet in WordPress (bedankt-preview.html als basis)
- [x] `mollie-webhook` end-to-end getest en werkend — bugfix: Mollie stuurt `pl_` ID voor payment links, code aangepast om via `/v2/payment-links/{id}/payments` de betaling op te halen
- [x] FunnelKit Workflow 3A en 3B geconfigureerd: trigger, URL + `?code=FUNCTION_KEY`, payload — inclusief `FUNNELKIT_TAG_STUUR_ASSESSMENT_ID` als secret
