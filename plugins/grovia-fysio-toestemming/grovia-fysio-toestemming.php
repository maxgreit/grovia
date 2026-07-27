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
