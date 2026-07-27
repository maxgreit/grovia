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
