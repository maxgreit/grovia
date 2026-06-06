# TODO — Grovia Automations

## Next Up

1. **WhatsApp groepsuitnodiging — Azure Function implementeren** — plan klaar in `docs/superpowers/plans/2026-05-21-whatsapp-uitnodiging.md`, wacht op deblokkering

## Blocked

- **Berry regelt prepaid SIM** — blocker voor WhatsApp API-koppeling; Berry koopt Lebara/Lycamobile prepaid SIM (~€5), nieuw nummer wordt het API-nummer (bestaand Grovia-nummer blijft in de app). Daarna: nummer toevoegen in developers.facebook.com → Phone Number ID + Access Token noteren → 4 GitHub Secrets toevoegen.
- **Meta Business Verification afronden** — Berry moet via Beveiligingscentrum (business.facebook.com → Instellingen → Beveiligingscentrum) een KvK-uittreksel uploaden.

## Later

- [ ] WhatsApp template: voornaam + groepslink als {{2}} toevoegen zodra klant template-tekst heeft bepaald (nu: alleen voornaam voor hello_world test)

- [ ] StuurAssessment en StuurBetaallink flows in FunnelKit deactiveren (na succesvolle keten)
- [ ] Test-contact "Max Test" opruimen: verwijder `Assessment2526` tag (oud, zonder naam_slug)
- [ ] Verouderde GitHub Secrets verwijderen: `GROVIA_FUNNELKIT_API_KEY`, `GROVIA_WORDPRESS_URL`, `FUNNELKIT_TAG_STUUR_ASSESSMENT_ID`
- [ ] Token caching + refresh implementeren in Azure Function (Ixly kondigt kortere token-lifetime aan)
- [ ] Onderzoek data warehouse opzet: WooCommerce → Azure SQL → PowerBI
- [ ] Business rule vastleggen voor leeg "Naam kind" veld bij checkout
- [ ] Ixly score-response verifiëren voor Blocks Game en Rally Game via explore.py

## Done

- [x] Go-live Ixly (productie) — IXLY_ORGANIZATION_UUID omgezet, bedrag €20 hardcoded, live getest (2026-05-26)
- [x] WhatsApp integratie onderzoeken (groepsuitnodiging via link) — oriëntatie afgerond (Notion: Done)
- [x] GitHub Secret `IXLY_AANMELDING_URL` toegevoegd + deploy getriggerd (2026-05-19, Notion: Done)
- [x] Couponveld checkout gevonden en fix uitgewerkt — CSS + PHP oorzaak gedocumenteerd in Notion (2026-05-20)
- [x] Couponveld checkout — CSS fix doorgevoerd + dark theme styling (2026-05-21)
- [x] Volledige keten getest: testkoop → betaallink → betaling → assessment e-mail (2026-05-21)
- [x] wp-config.php gecontroleerd: alle drie defines aanwezig (GROVIA_IXLY_AANMELDING_URL, GROVIA_MOLLIE_BETAALLINK_URL, GROVIA_FUNNELKIT_API_KEY) (2026-05-21)
- [x] PHP assessment router herschreven: directe Azure Function calls vanuit PHP, geen StuurAssessment/StuurBetaallink tags meer nodig (2026-05-19)
- [x] Tagformaat uitgebreid met order_id: `SUC12627_lisa-jansen_42` — router haalt orderdata op via wc_get_order() (2026-05-19)
- [x] deploy.yml bijgewerkt: IXLY_AANMELDING_URL toegevoegd, GROVIA_FUNNELKIT_API_KEY/GROVIA_WORDPRESS_URL/FUNNELKIT_TAG_STUUR_ASSESSMENT_ID verwijderd (2026-05-19)
- [x] Kolping Academie (KA) toegevoegd aan school_map (2026-05-19)
