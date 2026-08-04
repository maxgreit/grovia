<?php
/**
 * Plugin Name: Grovia Fysio Toestemming
 * Description: Optioneel toestemmingsvinkje op de checkout voor fysieke intakes en behandelingen door de fysiopraktijk, inclusief declaratie bij de zorgverzekeraar. Verschijnt alleen als de winkelwagen een product bevat met de categorie "toestemming-vereist".
 * Version: 1.1.0
 * Author: Greit
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

// Slug van de opt-in productcategorie. Producten met deze categorie tonen het vinkje.
const GROVIA_FYSIO_CATEGORIE = 'toestemming-vereist';

// Pad van de informatiepagina (WP-pagina, handmatig beheerd; inhoud staat in infopagina.html).
const GROVIA_FYSIO_INFO_URL = '/toestemming-fysieke-intakes/';

// HPOS-compatibiliteit (custom order tables): de code gebruikt uitsluitend WC_Order-methodes.
add_action( 'before_woocommerce_init', function () {
    if ( class_exists( \Automattic\WooCommerce\Utilities\FeaturesUtil::class ) ) {
        \Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility( 'custom_order_tables', __FILE__, true );
    }
} );

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
 *
 * De tekst is LETTERLIJK voorgeschreven door de toestemmingsverklaring van
 * Grovia en SMC Dijk en Waard (definitief, 2026-08-04): die verklaring benoemt
 * exact met welke tekst het hokje aangevinkt wordt. Wijzig deze formulering
 * dus niet zonder de verklaring én infopagina.html mee aan te passen —
 * anders wijkt af waar de ouder op klikt van wat het document zegt.
 */
add_action( 'woocommerce_review_order_before_submit', 'grovia_fysio_render_vinkje' );
function grovia_fysio_render_vinkje() {
    if ( ! grovia_fysio_cart_vereist_toestemming() ) {
        return;
    }

    // Behoud de keuze als de checkout herlaadt na een validatiefout.
    $aangevinkt = ! empty( $_POST['grovia_fysio_toestemming'] ); // phpcs:ignore WordPress.Security.NonceVerification.Missing

    // Bij een AJAX fragment-refresh (update_order_review, o.a. na validatiefouten) stuurt
    // WooCommerce de formuliervelden niet als losse POST-keys mee, maar geserialiseerd in
    // post_data. Zonder deze fallback lijkt het vinkje dan altijd uitgevinkt.
    if ( ! isset( $_POST['grovia_fysio_toestemming'] ) && isset( $_POST['post_data'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Missing
        parse_str( wp_unslash( (string) $_POST['post_data'] ), $post_data ); // phpcs:ignore WordPress.Security.NonceVerification.Missing
        $aangevinkt = ! empty( $post_data['grovia_fysio_toestemming'] );
    }
    ?>
    <p class="form-row grovia-fysio-toestemming">
        <label class="woocommerce-form__label woocommerce-form__label-for-checkbox checkbox">
            <input type="checkbox" class="woocommerce-form__input woocommerce-form__input-checkbox"
                   name="grovia_fysio_toestemming" id="grovia_fysio_toestemming" value="1"
                   <?php checked( $aangevinkt ); ?> />
            <span>Ik ga ermee akkoord dat het in kaart brengen van bestaande blessures en het
            preventief voorkomen van blessures door middel van testen en meten wordt vergoed
            via de basisverzekering fysiotherapie.
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

/**
 * Eénmalige pop-up als er wordt afgerekend zonder toestemmingsvinkje.
 * Tekst letterlijk aangeleverd door de klant (2026-07-28), bewust inclusief "testen".
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
    <?php // Kleuren en vormen volgen het sitethema: achtergrond #171A09, accent #FF5C00, radius 16px. ?>
    <div id="grovia-fysio-popup" style="display:none; position:fixed; inset:0; z-index:99999; background:rgba(0,0,0,0.7); align-items:center; justify-content:center;">
        <div style="background:#1d2110; color:#fff; max-width:520px; margin:16px; padding:32px; border-radius:16px; border:1px solid rgba(255,255,255,0.15); text-align:left; box-shadow:0 12px 40px rgba(0,0,0,0.5);">
            <h3 style="margin:0 0 16px; color:#fff; font-weight:800; line-height:1.3;">Weet je zeker dat je niet wilt deelnemen aan een deel van de fysieke testen?</h3>
            <p style="color:#fff;">Als je geen toestemming geeft, heeft dat de volgende gevolgen:</p>
            <ul style="margin:0 0 16px; padding-left:20px; color:#fff;">
                <li>Je kunt niet deelnemen aan een deel van de testen.</li>
                <li>Je mist waardevolle inzichten op het gebied van blessurepreventie en jouw ontwikkelmogelijkheden.</li>
                <li>We kunnen je minder goed begeleiden in jouw ontwikkeling.</li>
                <li>Je potentieprofiel blijft onvolledig.</li>
                <li>We delen alleen naam kind, geboortedatum, emailadres en woonadres.</li>
            </ul>
            <p style="color:#fff;">Geef alsnog toestemming en volg het volledige programma, zodat je het maximale uit
            jouw ontwikkeling kunt halen.
            <a href="<?php echo esc_url( GROVIA_FYSIO_INFO_URL ); ?>" target="_blank" rel="noopener" style="color:#FF5C00; text-decoration:underline;">Lees hier meer over de toestemming</a>.</p>
            <p style="display:flex; gap:12px; flex-wrap:wrap; margin-bottom:0;">
                <button type="button" id="grovia-fysio-popup-akkoord" style="background:#FF5C00; color:#fff; border:none; border-radius:16px; padding:14px 22px; font-weight:700; cursor:pointer;">Alsnog toestemming geven</button>
                <button type="button" id="grovia-fysio-popup-zonder" style="background:transparent; color:#fff; border:1px solid rgba(255,255,255,0.5); border-radius:16px; padding:14px 22px; font-weight:700; cursor:pointer;">Doorgaan zonder toestemming</button>
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
