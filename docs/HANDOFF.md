# Handoff — Grovia Automations

**Datum:** 2026-05-19  
**Status:** MVP in progress — end-to-end keten bijna werkend, laatste stap (assessment e-mail na betaling) nog niet bevestigd

---

## Laatste werkende staat

- **Branch:** `main`
- **Laatste commit:** `57224b8 19-05-2026: IXLY URL toegevoegd aan YAML, Kolping Academie toegevoegd aan php`
- **Build:** `func start` start niet lokaal (poort 7071 bezet door andere instantie) — geen codeerror, meest recente Azure deploy slaagde

---

## Wat er deze sessie is gebeurd

De architectuur is fundamenteel vereenvoudigd: `grovia_assessment_router` (PHP) maakt nu **direct** HTTP calls naar de Azure Functions, zonder tussenkomst van FunnelKit HTTP Request-stappen of `StuurAssessment`/`StuurBetaallink` tags. Het tagformaat is uitgebreid met `order_id` als laatste segment (`SUC22526_freddie-rood_935`), zodat de router de WooCommerce-orderdata zelf kan ophalen via `wc_get_order()`. De deploy-workflow is bijgewerkt: `IXLY_AANMELDING_URL` toegevoegd, drie verouderde variabelen verwijderd. End-to-end getest tot en met betaling: tag callback ✓, assessment router ✓, betaallink e-mail ✓, betaling voldaan ✓ — de `mollie-webhook` → `ixly-aanmelding` stap faalde omdat `IXLY_AANMELDING_URL` nog niet als GitHub Secret was gezet.

---

## Open items / Next steps

### Prioriteit 1 — Moet morgen als eerste
1. **GitHub Secret `IXLY_AANMELDING_URL` toevoegen**
   GitHub → repo → Settings → Secrets → New secret
   Naam: `IXLY_AANMELDING_URL`
   Waarde: `https://grovia-automations-a9dxfzhpg3bbg8cr.westeurope-01.azurewebsites.net/api/ixly-aanmelding?code=<FUNCTION_KEY>`
   → daarna pushen of workflow handmatig triggeren zodat Azure de var ontvangt

2. **Volledige keten doorlopen**
   Testkoop doen → controleer: tag callback log ✓ → router log ✓ → betaallink e-mail ✓ → betalen → `mollie-webhook` log in Azure → `ixly-aanmelding` log → assessment e-mail ontvangen

3. **wp-config.php op server aanvullen** (controleer of alle drie defines aanwezig zijn):
   ```php
   define( 'GROVIA_FUNNELKIT_API_KEY',     'sleutel' );
   define( 'GROVIA_IXLY_AANMELDING_URL',   'https://...azurewebsites.net/api/ixly-aanmelding?code=...' );
   define( 'GROVIA_MOLLIE_BETAALLINK_URL', 'https://...azurewebsites.net/api/mollie-betaallink?code=...' );
   ```

### Prioriteit 2 — Na succesvolle keten
4. **`StuurAssessment` en `StuurBetaallink` flows in FunnelKit deactiveren** (niet verwijderen)
5. **Test-contact opruimen**: contact "Max Test" heeft `Assessment2526` (oud, zonder naam_slug) — verwijder die tag zodat toekomstige tests niet worden geblokkeerd
6. **Verouderde GitHub Secrets verwijderen**: `GROVIA_FUNNELKIT_API_KEY`, `GROVIA_WORDPRESS_URL`, `FUNNELKIT_TAG_STUUR_ASSESSMENT_ID`

### Later
- Token caching + refresh implementeren in Azure Function (Ixly kondigt kortere token-lifetime aan)
- Onderzoek data warehouse opzet: WooCommerce → Azure SQL → PowerBI

---

## Belangrijke context die niet mag verdwijnen

### Nieuw tagformaat
Oud: `SUC12627_lisa-jansen`
Nieuw: `SUC12627_lisa-jansen_42` (order_id altijd als laatste segment, numeriek)
De router gebruikt `strrpos()` om het laatste segment te vinden en controleert of het numeriek is.

### PHP haalt order-data op via wc_get_order()
De router heeft **geen** FunnelKit merge tags of HTTP payload nodig. FunnelKit stuurt alleen `contact_id` en `tag_name` — alles verder (email, naam, bedrag) wordt direct uit WooCommerce gelezen. Geen FunnelKit-aanpassingen nodig voor nieuwe scholen of fases.

### Assessment-guard werkt per kind per seizoen
Guard tag: `Assessment{seizoen}_{naam_slug}` (bijv. `Assessment2526_freddie-rood`)
Zelfde kind, zelfde seizoen → altijd geblokkeerd, ook bij herbestelling.
Volgend seizoen → nieuwe guard tag, assessment toegestaan.
Leeg naam_kind → guard is `Assessment2526` (seizoensbreed, oud gedrag, TODO).

### IXLY_AANMELDING_URL in mollie-webhook
De `mollie-webhook` Azure Function heeft `IXLY_AANMELDING_URL` nodig als environment variable. Deze staat nu in deploy.yml maar de GitHub Secret was nog niet aangemaakt — dit is de enige openstaande blocker voor de volledige keten.

### Schoolcodes
```php
$school_map = [
    'schagen-united'   => 'SU',
    'kolping-academie' => 'KA',  // toegevoegd 2026-05-19
];
```
Nieuwe school toevoegen: slug via WooCommerce → Producten → Categorieën.

### SMTP op WordPress
WordPress SMTP was kapot (verkeerde credentials in WP Mail SMTP). Opgelost door credentials te resetten via Vimexx-hostingpanel. Debug-mails gaan naar `max@greit.nl`.
