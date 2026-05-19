# TODO — Grovia Automations

## Next Up

1. **GitHub Secret `IXLY_AANMELDING_URL` toevoegen + deploy triggeren** — blocker voor volledige keten
2. **Volledige keten doorlopen**: testkoop → betaallink e-mail → betalen → assessment e-mail ontvangen
3. **wp-config.php controleren**: alle drie defines aanwezig? (GROVIA_FUNNELKIT_API_KEY, GROVIA_IXLY_AANMELDING_URL, GROVIA_MOLLIE_BETAALLINK_URL)
4. **StuurAssessment en StuurBetaallink flows in FunnelKit deactiveren** (na succesvolle keten)
5. **Test-contact "Max Test" opruimen**: verwijder `Assessment2526` tag (oud, zonder naam_slug) zodat hertest niet wordt geblokkeerd

## Blocked

- **Volledige keten (mollie-webhook → ixly-aanmelding)**: IXLY_AANMELDING_URL GitHub Secret ontbreekt → Azure Function heeft variabele niet

## Later

- [ ] Verouderde GitHub Secrets verwijderen: `GROVIA_FUNNELKIT_API_KEY`, `GROVIA_WORDPRESS_URL`, `FUNNELKIT_TAG_STUUR_ASSESSMENT_ID`
- [ ] Token caching + refresh implementeren in Azure Function (Ixly kondigt kortere token-lifetime aan)
- [ ] Onderzoek data warehouse opzet: WooCommerce → Azure SQL → PowerBI
- [ ] Business rule vastleggen voor leeg "Naam kind" veld bij checkout

## Done

- [x] PHP assessment router herschreven: directe Azure Function calls vanuit PHP, geen StuurAssessment/StuurBetaallink tags meer nodig (2026-05-19)
- [x] Tagformaat uitgebreid met order_id: `SUC12627_lisa-jansen_42` — router haalt orderdata op via wc_get_order() (2026-05-19)
- [x] deploy.yml bijgewerkt: IXLY_AANMELDING_URL toegevoegd, GROVIA_FUNNELKIT_API_KEY/GROVIA_WORDPRESS_URL/FUNNELKIT_TAG_STUUR_ASSESSMENT_ID verwijderd (2026-05-19)
- [x] Kolping Academie (KA) toegevoegd aan school_map (2026-05-19)
- [x] WordPress SMTP opgelost: credentials gereset via Vimexx, debug-mails werken weer (2026-05-19)
- [x] E-mailveld op Ixly candidate: per assignment een eigen login_url; e-mail bevat beide links (Blocks + Rally)
