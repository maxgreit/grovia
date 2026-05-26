# TODO — Grovia Automations

## Next Up

1. **Go-live Ixly (productie)** — in progress in Notion
2. **WhatsApp Business API** — wacht op toegang Meta Business account (klant voegt Max toe als admin)
3. **WhatsApp groepsuitnodiging automatiseren via API** — plan aanwezig in `docs/superpowers/plans/2026-05-21-whatsapp-uitnodiging.md`

## Later

- [ ] StuurAssessment en StuurBetaallink flows in FunnelKit deactiveren (na succesvolle keten)
- [ ] Test-contact "Max Test" opruimen: verwijder `Assessment2526` tag (oud, zonder naam_slug)
- [ ] Verouderde GitHub Secrets verwijderen: `GROVIA_FUNNELKIT_API_KEY`, `GROVIA_WORDPRESS_URL`, `FUNNELKIT_TAG_STUUR_ASSESSMENT_ID`
- [ ] Token caching + refresh implementeren in Azure Function (Ixly kondigt kortere token-lifetime aan)
- [ ] Onderzoek data warehouse opzet: WooCommerce → Azure SQL → PowerBI
- [ ] Business rule vastleggen voor leeg "Naam kind" veld bij checkout
- [ ] Ixly score-response verifiëren voor Blocks Game en Rally Game via explore.py

## Done

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
