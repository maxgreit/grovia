# Handoff — Grovia Automations

**Datum:** 2026-05-20  
**Status:** MVP in progress — volledige keten bijna werkend; couponveld checkout open

---

## Laatste werkende staat

- **Branch:** `main`
- **Laatste commit:** `2638ac8 Fix: 404 op assignments-endpoint behandelen als lege lijst`
- **Build:** `func --version` → 4.5.0 aanwezig. `func start` start niet lokaal (poort 7071 bezet) — geen code-error, meest recente Azure deploy slaagde.

---

## Wat er deze sessie is gebeurd

Twee onderzoeksvragen beantwoord en één bugfix uitgewerkt (nog niet doorgevoerd op server). Eerst is de Ixly Swagger (`swagger.yaml`) doorgespit om te begrijpen welke velden de `candidate_tasks`- en `candidate_tasks/score`-endpoints teruggeven — de score-response bevat ITS- en WPV-blokken, maar of dit ook de structuur is voor Blocks Game en Rally Game is nog onbekend. Daarna is onderzocht waarom het WooCommerce couponveld niet zichtbaar was op de checkout: er zijn twee oorzaken gevonden, een PHP-hook die verwijderd was en een CSS-regel met `display:none !important` op `.woocommerce-info`. De fix is volledig uitgewerkt (zie Next Steps), gedocumenteerd in Notion, maar **nog niet doorgevoerd op de server**.

---

## Git wijzigingen

Geen commits deze sessie. Working copy: `.claude/commands/apply-template.md` gewijzigd (template-update, geen projectcode). Ongetracked: presentatiebestanden (`Grovia_Automations_Uitleg.pptx`, `make_presentation.js`, `node_modules/`, `package*.json`).

---

## Open items / Next steps

### Prioriteit 1 — Couponveld checkout (nog niet doorgevoerd)

De fix bestaat uit twee delen die allebei nog op de server moeten worden doorgevoerd. Daarna het veld stylen zodat het past bij de donkere checkout-stijl.

**Stap 1 — CSS fix** (Elementor → checkout-pagina → Custom CSS):

Vervang blok 1:
```css
/* 1) Notices uit */
.woocommerce-checkout .woocommerce-message,
.woocommerce-checkout .woocommerce-info,
.woocommerce-checkout .woocommerce-error{
  display:none !important;
}
```

Door:
```css
/* 1) Notices uit (coupon toggle uitgezonderd) */
.woocommerce-checkout .woocommerce-message,
.woocommerce-checkout .woocommerce-error{
  display:none !important;
}
.woocommerce-checkout .woocommerce-info{
  display:none !important;
}
.woocommerce-checkout .woocommerce-form-coupon-toggle,
.woocommerce-checkout .woocommerce-form-coupon-toggle .woocommerce-info{
  display:block !important;
}
```

**Stap 2 — Styling couponveld** (in dezelfde Custom CSS, nieuw blok toevoegen):

Het couponveld (`woocommerce-form-coupon-toggle`, `checkout_coupon`-form, inputs) is nog niet gestyled in de dark theme stijl. Moet aansluiten bij de bestaande checkout-stijl: donkere achtergrond, witte tekst, border `rgba(255,255,255,.12)`, border-radius 14-16px.

**Stap 3 — PHP fix** (Appearance → Theme File Editor → `functions.php`, of via SFTP):

Voeg toe ná het bestaande `remove_action`-blok:
```php
add_action('woocommerce_before_checkout_form', 'woocommerce_checkout_coupon_form', 10);
```

Volledig: zie Notion-pagina "Fix: WooCommerce couponveld zichtbaar maken op checkout".

---

### Prioriteit 2 — Hoofdblocker assessment-keten

4. **GitHub Secret `IXLY_AANMELDING_URL` toevoegen** — GitHub → repo → Settings → Secrets → New secret  
   Naam: `IXLY_AANMELDING_URL`  
   Waarde: `https://grovia-automations-a9dxfzhpg3bbg8cr.westeurope-01.azurewebsites.net/api/ixly-aanmelding?code=<FUNCTION_KEY>`  
   → daarna workflow handmatig triggeren zodat Azure de variabele ontvangt

5. **Volledige keten doorlopen**: testkoop → tag callback log ✓ → router log ✓ → betaallink e-mail ✓ → betalen → `mollie-webhook` log → `ixly-aanmelding` log → assessment e-mail ontvangen

6. **wp-config.php controleren**: alle drie defines aanwezig?
   ```php
   define( 'GROVIA_FUNNELKIT_API_KEY',     'sleutel' );
   define( 'GROVIA_IXLY_AANMELDING_URL',   'https://...azurewebsites.net/api/ixly-aanmelding?code=...' );
   define( 'GROVIA_MOLLIE_BETAALLINK_URL', 'https://...azurewebsites.net/api/mollie-betaallink?code=...' );
   ```

---

## Belangrijke context die niet mag verdwijnen

### Oorzaak verborgen couponveld — twee lagen
1. **PHP:** `remove_action('woocommerce_before_checkout_form', 'woocommerce_output_all_notices', 10)` in `functions.php` verwijderde de notices-hook. WooCommerce's `woocommerce_checkout_coupon_form` is een aparte hook maar het "Heb je een waardebon?"-linkje gebruikt intern `wc_print_notice()` met klasse `woocommerce-info`.
2. **CSS:** De Elementor Custom CSS van de checkout-pagina had `.woocommerce-checkout .woocommerce-info { display:none !important; }` — dit verborg het element volledig ook al stond het in de DOM.
Het element was dus wél aanwezig in de HTML (controleerbaar via DevTools → zoek op "coupon"), maar onzichtbaar door CSS.

### Formulier-producten worden bepaald door productcategorie
De velden "Vereniging" en "Team" op de productpagina verschijnen alleen voor producten in de categorie **"Formulier"**. De check zit in `functions.php` van het child-thema via `grovia_is_formulier_product()`. Code staat **alleen op de server**, niet in de lokale repo.

### Ixly score-endpoints: structuur onzeker voor Blocks/Rally
`/api/public/candidate_tasks/{uuid}/score` geeft in de Swagger een ITS+WPV-structuur terug (interesses, persoonlijkheid). Of dit ook geldt voor de Blocks Game en Rally Game (spelgebaseerde kindassessments) is niet bevestigd. Gebruik `explore.py` met een echte `candidate_task_uuid` van een afgeronde assignment om de werkelijke response te zien.

### Tagformaat (herhaling, kritisch)
Nieuw: `SUC12627_lisa-jansen_42` (order_id altijd als laatste segment, numeriek)  
De router gebruikt `strrpos()` om het laatste segment te vinden en controleert of het numeriek is.

### Schoolcodes
```php
$school_map = [
    'schagen-united'   => 'SU',
    'kolping-academie' => 'KA',
];
```

### SMTP
WordPress SMTP (WP Mail SMTP) werkt weer — credentials gereset via Vimexx. Debug-mails → `max@greit.nl`.
