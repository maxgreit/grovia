# Fysio-Toestemming Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Optioneel toestemmingsvinkje op de WooCommerce-checkout van grovia.nl voor fysieke intakes/behandelingen door de fysiopraktijk, met éénmalige pop-up-nudge en registratie op de order.

**Architecture:** Eén standalone WordPress-plugin (`plugins/grovia-fysio-toestemming/`, één PHP-bestand) die via klassieke WooCommerce-hooks een conditioneel vinkje rendert (opt-in productcategorie `toestemming-vereist`), de keuze als order-meta opslaat en in het admin-orderscherm toont. Pop-up is inline jQuery op de checkout-pagina.

**Tech Stack:** PHP (WordPress/WooCommerce hooks), jQuery (zit al in WooCommerce-checkout), geen build-stap.

## Global Constraints

- **Voertaal code, comments, commits: Nederlands** (CLAUDE.md).
- **Terminologie: "intakes en behandelingen", nooit "testen"** — in alle gebruikersteksten (spec-eis fysiopraktijk/zorgverzekeraar).
- **Geen secrets in code** (CLAUDE.md) — deze plugin heeft er geen nodig.
- Categorie-slug: `toestemming-vereist`. Info-pagina-pad: `/toestemming-fysieke-intakes/`. Meta-keys: `_grovia_fysio_toestemming` (`ja`/`nee`), `_grovia_fysio_toestemming_tijdstip`.
- Vinkje is **niet verplicht**; bestelling mag altijd door.
- Alle gebruikersteksten zijn **concepten** tot klantakkoord (zie spec §Open vragen) — markeer nergens als definitief.
- Lint lokaal via Docker (geen lokale PHP): `docker run --rm -v "$PWD/plugins/grovia-fysio-toestemming:/app" php:8.2-cli php -l /app/grovia-fysio-toestemming.php`
- Stijlreferentie: `plugins/grovia-automations/grovia-automations.php` (Nederlandse comments, `error_log` voor logging, defensieve checks).

---

### Task 1: Plugin-skelet + categorie-detectie

**Files:**
- Create: `plugins/grovia-fysio-toestemming/grovia-fysio-toestemming.php`

**Interfaces:**
- Produces: `grovia_fysio_cart_vereist_toestemming(): bool` — true als de winkelwagen ≥1 product met categorie `toestemming-vereist` bevat. Constantes `GROVIA_FYSIO_CATEGORIE` en `GROVIA_FYSIO_INFO_URL`. Alle latere tasks hangen hun hooks in dit bestand.

- [ ] **Step 1: Schrijf het pluginbestand met header, constantes en detectiefunctie**

```php
<?php
/**
 * Plugin Name: Grovia Fysio Toestemming
 * Description: Optioneel toestemmingsvinkje op de checkout voor fysieke intakes en behandelingen door de fysiopraktijk, inclusief declaratie bij de zorgverzekeraar. Verschijnt alleen als de winkelwagen een product bevat met de categorie "toestemming-vereist".
 * Version: 1.0.0
 * Author: Greit
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

// Slug van de opt-in productcategorie. Producten met deze categorie tonen het vinkje.
const GROVIA_FYSIO_CATEGORIE = 'toestemming-vereist';

// Pad van de informatiepagina (WP-pagina, handmatig aangemaakt en gepubliceerd na klantakkoord).
const GROVIA_FYSIO_INFO_URL = '/toestemming-fysieke-intakes/';

/**
 * Bepaalt of de winkelwagen minstens één product bevat waarvoor toestemming
 * gevraagd moet worden. Bij variaties telt de categorie van het hoofdproduct
 * (cart item 'product_id' is altijd het hoofdproduct).
 */
function grovia_fysio_cart_vereist_toestemming() {
    if ( ! function_exists( 'WC' ) || null === WC()->cart ) {
        return false;
    }

    foreach ( WC()->cart->get_cart() as $cart_item ) {
        $product_id = ! empty( $cart_item['product_id'] ) ? (int) $cart_item['product_id'] : 0;
        if ( $product_id && has_term( GROVIA_FYSIO_CATEGORIE, 'product_cat', $product_id ) ) {
            return true;
        }
    }

    return false;
}
```

- [ ] **Step 2: Lint**

Run: `docker run --rm -v "$PWD/plugins/grovia-fysio-toestemming:/app" php:8.2-cli php -l /app/grovia-fysio-toestemming.php`
Expected: `No syntax errors detected`

- [ ] **Step 3: Commit**

```bash
git add plugins/grovia-fysio-toestemming/grovia-fysio-toestemming.php
git commit -m "feat: skelet grovia-fysio-toestemming plugin met categorie-detectie"
```

---

### Task 2: Vinkje op de checkout + opslag als order-meta

**Files:**
- Modify: `plugins/grovia-fysio-toestemming/grovia-fysio-toestemming.php` (toevoegen onderaan)

**Interfaces:**
- Consumes: `grovia_fysio_cart_vereist_toestemming()`, `GROVIA_FYSIO_INFO_URL` (Task 1)
- Produces: checkbox met `id="grovia_fysio_toestemming"` en `name="grovia_fysio_toestemming"` (Task 3 haakt hier met JS op in); order-meta `_grovia_fysio_toestemming` + `_grovia_fysio_toestemming_tijdstip` (Task 4 leest deze uit).

- [ ] **Step 1: Voeg render- en opslaghooks toe**

Onderaan het bestand toevoegen:

```php
/**
 * Rendert het toestemmingsvinkje direct onder het algemene-voorwaarden-vinkje.
 * CONCEPTTEKST — definitieve formulering volgt na akkoord van Berry/fysiopraktijk.
 */
add_action( 'woocommerce_review_order_before_submit', 'grovia_fysio_render_vinkje' );
function grovia_fysio_render_vinkje() {
    if ( ! grovia_fysio_cart_vereist_toestemming() ) {
        return;
    }

    // Behoud de keuze als de checkout herlaadt na een validatiefout.
    $aangevinkt = ! empty( $_POST['grovia_fysio_toestemming'] ); // phpcs:ignore WordPress.Security.NonceVerification.Missing
    ?>
    <p class="form-row grovia-fysio-toestemming">
        <label class="woocommerce-form__label woocommerce-form__label-for-checkbox checkbox">
            <input type="checkbox" class="woocommerce-form__input woocommerce-form__input-checkbox"
                   name="grovia_fysio_toestemming" id="grovia_fysio_toestemming" value="1"
                   <?php checked( $aangevinkt ); ?> />
            <span>Ik geef toestemming voor de fysieke intakes en behandelingen door de fysiopraktijk
            en het declareren hiervan bij de zorgverzekeraar.
            <a href="<?php echo esc_url( GROVIA_FYSIO_INFO_URL ); ?>" target="_blank" rel="noopener">Lees hier wat dit inhoudt</a>.</span>
        </label>
    </p>
    <?php
}

/**
 * Slaat de keuze op als order-meta. Alleen als het vinkje getoond werd:
 * afwezige meta betekent "niet van toepassing", 'nee' betekent "bewust niet gegeven".
 */
add_action( 'woocommerce_checkout_create_order', 'grovia_fysio_sla_toestemming_op', 10, 2 );
function grovia_fysio_sla_toestemming_op( $order, $data ) {
    if ( ! grovia_fysio_cart_vereist_toestemming() ) {
        return;
    }

    $gegeven = ! empty( $_POST['grovia_fysio_toestemming'] ); // phpcs:ignore WordPress.Security.NonceVerification.Missing
    $order->update_meta_data( '_grovia_fysio_toestemming', $gegeven ? 'ja' : 'nee' );
    $order->update_meta_data( '_grovia_fysio_toestemming_tijdstip', current_time( 'mysql' ) );
}
```

- [ ] **Step 2: Lint**

Run: `docker run --rm -v "$PWD/plugins/grovia-fysio-toestemming:/app" php:8.2-cli php -l /app/grovia-fysio-toestemming.php`
Expected: `No syntax errors detected`

- [ ] **Step 3: Commit**

```bash
git add plugins/grovia-fysio-toestemming/grovia-fysio-toestemming.php
git commit -m "feat: toestemmingsvinkje op checkout + opslag als order-meta"
```

---

### Task 3: Eénmalige pop-up-nudge

**Files:**
- Modify: `plugins/grovia-fysio-toestemming/grovia-fysio-toestemming.php` (toevoegen onderaan)

**Interfaces:**
- Consumes: `grovia_fysio_cart_vereist_toestemming()` (Task 1); checkbox `#grovia_fysio_toestemming` (Task 2).
- Produces: n.v.t. (laatste front-end onderdeel).

- [ ] **Step 1: Voeg pop-up-markup en script toe**

Onderaan het bestand toevoegen. Werking: WooCommerce's `checkout_place_order`-event; `return false` annuleert die ene submit. `sessionStorage` zorgt dat de pop-up per browsersessie maar één keer verschijnt.

```php
/**
 * Eénmalige pop-up als er wordt afgerekend zonder toestemmingsvinkje.
 * CONCEPTTEKST — definitieve formulering volgt na akkoord van Berry/fysiopraktijk.
 * Zonder JavaScript werkt de checkout gewoon; alleen de nudge ontbreekt dan.
 */
add_action( 'wp_footer', 'grovia_fysio_popup' );
function grovia_fysio_popup() {
    if ( ! function_exists( 'is_checkout' ) || ! is_checkout() || is_order_received_page() ) {
        return;
    }
    if ( ! grovia_fysio_cart_vereist_toestemming() ) {
        return;
    }
    ?>
    <div id="grovia-fysio-popup" style="display:none; position:fixed; inset:0; z-index:99999; background:rgba(0,0,0,0.6); align-items:center; justify-content:center;">
        <div style="background:#fff; color:#1a1a1a; max-width:480px; margin:16px; padding:32px; border-radius:8px; text-align:left;">
            <h3 style="margin-top:0;">Nog even over de fysieke intakes</h3>
            <p>Je hebt geen toestemming gegeven voor de fysieke intakes en behandelingen door de
            fysiopraktijk. Zonder toestemming kan je kind hier niet aan meedoen.
            <a href="<?php echo esc_url( GROVIA_FYSIO_INFO_URL ); ?>" target="_blank" rel="noopener">Lees hier wat de intakes inhouden</a>.</p>
            <p>Je bent vrij in je keuze — de inschrijving gaat in beide gevallen gewoon door.</p>
            <p style="display:flex; gap:12px; flex-wrap:wrap; margin-bottom:0;">
                <button type="button" id="grovia-fysio-popup-akkoord" class="button alt">Alsnog toestemming geven</button>
                <button type="button" id="grovia-fysio-popup-zonder" class="button">Doorgaan zonder toestemming</button>
            </p>
        </div>
    </div>
    <script>
    jQuery( function( $ ) {
        var SLEUTEL = 'groviaFysioPopupGetoond';

        $( 'form.checkout' ).on( 'checkout_place_order', function() {
            if ( $( '#grovia_fysio_toestemming' ).is( ':checked' ) ) {
                return true;
            }
            if ( sessionStorage.getItem( SLEUTEL ) ) {
                return true;
            }
            sessionStorage.setItem( SLEUTEL, '1' );
            $( '#grovia-fysio-popup' ).css( 'display', 'flex' );
            return false; // annuleer alleen deze submit
        } );

        $( '#grovia-fysio-popup-akkoord' ).on( 'click', function() {
            $( '#grovia_fysio_toestemming' ).prop( 'checked', true );
            $( '#grovia-fysio-popup' ).hide();
            $( 'form.checkout' ).trigger( 'submit' );
        } );

        $( '#grovia-fysio-popup-zonder' ).on( 'click', function() {
            $( '#grovia-fysio-popup' ).hide();
        } );
    } );
    </script>
    <?php
}
```

- [ ] **Step 2: Lint**

Run: `docker run --rm -v "$PWD/plugins/grovia-fysio-toestemming:/app" php:8.2-cli php -l /app/grovia-fysio-toestemming.php`
Expected: `No syntax errors detected`

- [ ] **Step 3: Commit**

```bash
git add plugins/grovia-fysio-toestemming/grovia-fysio-toestemming.php
git commit -m "feat: eenmalige pop-up-nudge bij afrekenen zonder toestemming"
```

---

### Task 4: Weergave in het admin-orderscherm

**Files:**
- Modify: `plugins/grovia-fysio-toestemming/grovia-fysio-toestemming.php` (toevoegen onderaan)

**Interfaces:**
- Consumes: order-meta `_grovia_fysio_toestemming` (`ja`/`nee`) en `_grovia_fysio_toestemming_tijdstip` (Task 2).
- Produces: n.v.t.

- [ ] **Step 1: Voeg admin-hook toe**

Onderaan het bestand toevoegen:

```php
/**
 * Toont de toestemmingskeuze in het admin-orderscherm, naast de factuurgegevens.
 * Geen meta = vinkje was niet van toepassing op deze order: dan niets tonen.
 */
add_action( 'woocommerce_admin_order_data_after_billing_address', 'grovia_fysio_toon_in_admin' );
function grovia_fysio_toon_in_admin( $order ) {
    $toestemming = $order->get_meta( '_grovia_fysio_toestemming' );
    if ( '' === $toestemming ) {
        return;
    }

    $tijdstip = $order->get_meta( '_grovia_fysio_toestemming_tijdstip' );
    printf(
        '<p><strong>%s</strong><br>%s%s</p>',
        esc_html__( 'Toestemming fysieke intakes:', 'grovia-fysio-toestemming' ),
        esc_html( 'ja' === $toestemming ? 'Ja' : 'Nee' ),
        $tijdstip ? esc_html( ' (' . $tijdstip . ')' ) : ''
    );
}
```

- [ ] **Step 2: Lint**

Run: `docker run --rm -v "$PWD/plugins/grovia-fysio-toestemming:/app" php:8.2-cli php -l /app/grovia-fysio-toestemming.php`
Expected: `No syntax errors detected`

- [ ] **Step 3: Commit**

```bash
git add plugins/grovia-fysio-toestemming/grovia-fysio-toestemming.php
git commit -m "feat: toestemmingskeuze zichtbaar in admin-orderscherm"
```

---

### Task 5: Concepttekst informatiepagina

**Files:**
- Create: `plugins/grovia-fysio-toestemming/infopagina-concept.md`

**Interfaces:**
- Consumes: n.v.t. — tekstdocument, geen code.
- Produces: concepttekst die Max in WordPress plakt (pagina `/toestemming-fysieke-intakes/`) zodra Berry/de fysiopraktijk inhoudelijk akkoord is.

- [ ] **Step 1: Schrijf de concepttekst**

Volledig bestand:

```markdown
# Toestemming fysieke intakes en behandelingen — CONCEPT

> ⚠️ CONCEPT. Publiceren als WP-pagina op `/toestemming-fysieke-intakes/` pas na
> inhoudelijk akkoord van Berry en de fysiopraktijk. Onderdelen tussen
> [VIERKANTE HAKEN] moeten door de klant worden ingevuld (zie spec §Open vragen).

---

## Toestemming fysieke intakes en behandelingen

Bij de trainingen van [ACADEMIE/GROVIA] hoort een fysieke intake door
[NAAM FYSIOPRAKTIJK]. Op deze pagina lees je wat dit inhoudt en waarvoor je
toestemming geeft.

### Wat houden de intakes en behandelingen in?

[IN TE VULLEN DOOR FYSIOPRAKTIJK — beschrijving van de intake en eventuele
vervolgbehandelingen, in begrijpelijke taal voor ouders.]

### Wie voert ze uit?

De intakes en behandelingen worden uitgevoerd door [NAAM FYSIOPRAKTIJK],
[VESTIGINGSPLAATS]. [EVT. NAMEN/REGISTRATIES BEHANDELAARS.]

### Waar zijn ze voor bedoeld?

[IN TE VULLEN — doel: inzicht in fysieke ontwikkeling, blessurepreventie,
betere begeleiding van de speler of keeper.]

### Welke gegevens worden gedeeld?

Om de intake mogelijk te maken deelt Grovia de volgende gegevens met
[NAAM FYSIOPRAKTIJK]: [OPSOMMING — bijv. naam en geboortedatum van het kind en
contactgegevens van de ouder/verzorger]. De fysiopraktijk gaat hier als
zorgverlener vertrouwelijk mee om.

### Declaratie bij de zorgverzekeraar

De intakes en behandelingen worden door [NAAM FYSIOPRAKTIJK] gedeclareerd bij
de zorgverzekeraar. [IN TE VULLEN — uit welke verzekering dit komt en of dit
gevolgen heeft voor het eigen risico of de aanvullende verzekering.]

### Vrijwillig, en intrekken kan

Je bent vrij om wel of geen toestemming te geven; de inschrijving gaat in beide
gevallen gewoon door. Zonder toestemming kan je kind alleen niet meedoen aan de
fysieke intakes en behandelingen. Toestemming intrekken kan op elk moment via
[CONTACTGEGEVENS — GROVIA OF FYSIOPRAKTIJK].
```

- [ ] **Step 2: Commit**

```bash
git add plugins/grovia-fysio-toestemming/infopagina-concept.md
git commit -m "docs: concepttekst informatiepagina fysio-toestemming"
```

---

### Task 6: Documentatie + deploy-instructies

**Files:**
- Modify: `docs/ARCHITECTURE.md` (componentenoverzicht — voeg de plugin toe in dezelfde stijl als de bestaande componenten)
- Modify: `docs/TODO.md` (sectie `## Next Up`)

**Interfaces:**
- Consumes: alle voorgaande tasks (beschrijft het geheel).
- Produces: n.v.t.

- [ ] **Step 1: Voeg de plugin toe aan ARCHITECTURE.md**

Lees eerst de bestaande structuur van `docs/ARCHITECTURE.md` en voeg in het componenten-/pluginoverzicht een beschrijving toe in dezelfde opmaak als de bestaande entries, met deze inhoud:

- **`grovia-fysio-toestemming`** (aparte plugin, `plugins/grovia-fysio-toestemming/`): optioneel toestemmingsvinkje op de checkout voor fysieke intakes/behandelingen fysiopraktijk + declaratie zorgverzekeraar. Verschijnt alleen bij producten met categorie `toestemming-vereist` (opt-in). Slaat keuze op als order-meta `_grovia_fysio_toestemming` (`ja`/`nee`, afwezig = n.v.t.) + tijdstip; zichtbaar in admin-orderscherm. Eénmalige pop-up-nudge (sessionStorage) bij afrekenen zonder vinkje. Infopagina: `/toestemming-fysieke-intakes/`.

- [ ] **Step 2: Voeg vervolgacties toe aan TODO.md Next Up**

Toevoegen aan `## Next Up` in `docs/TODO.md`:

```markdown
- **Fysio-toestemming live zetten** `(lokaal)` — (1) categorie `toestemming-vereist` aanmaken in WooCommerce en aan voetbal-/keeperstrainingen hangen, (2) WP-pagina `/toestemming-fysieke-intakes/` aanmaken zodra klantteksten binnen zijn (concept: [infopagina-concept.md](../plugins/grovia-fysio-toestemming/infopagina-concept.md)), (3) plugin-map uploaden naar `wp-content/plugins/` + activeren, (4) testplan uit de spec draaien
- **Klantvragen fysio-toestemming uitzetten bij Berry** `(lokaal)` — pop-uptekst, documentinhoud, gegevensdeling, intrekprocedure, privacyverklaring (zie spec §Open vragen)
```

- [ ] **Step 3: Commit**

```bash
git add docs/ARCHITECTURE.md docs/TODO.md
git commit -m "docs: fysio-toestemming plugin gedocumenteerd + vervolgacties in TODO"
```

---

## Verificatie op de site (na deploy, handmatig — hoort bij Next Up, niet bij dit plan)

1. Categorie `toestemming-vereist` aan een testproduct hangen.
2. Checkout met dat product → vinkje zichtbaar onder het voorwaarden-vinkje.
3. Checkout met alleen MiniMove/proeftraining → geen vinkje.
4. Afrekenen zonder vinkje → pop-up verschijnt precies één keer; "Alsnog toestemming geven" zet vinkje en rekent af; "Doorgaan zonder toestemming" laat de volgende klik gewoon afrekenen.
5. Order mét vinkje → admin toont "Toestemming fysieke intakes: Ja (tijdstip)"; zonder vinkje → "Nee"; uitgesloten order → geen regel.
