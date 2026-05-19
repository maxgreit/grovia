<?php
/**
 * Plugin Name: Grovia Automations
 * Description: Custom tag logica voor Funnelkit / Ixly workflow
 * Version: 1.5
 * Author: Grovia
 */

// Funnelkit REST API key — aanmaken via Funnelkit → Settings → REST API
// Zet deze in wp-config.php als: define( 'GROVIA_FUNNELKIT_API_KEY', 'jouw-sleutel' );
define( 'GROVIA_FUNNELKIT_API_KEY', '' );

// Debug e-mailadres — ontvangt de log na elke callback-run
define( 'GROVIA_DEBUG_EMAIL', 'max@greit.nl' );

// Koppelt de functie aan Funnelkit's callback systeem
add_action( 'grovia_generate_ixly_tag', 'grovia_generate_ixly_tag' );

function grovia_generate_ixly_tag( $data ) {

    $log   = [];
    $log[] = '=== Grovia Tag Callback gestart ===';
    $log[] = 'Data ontvangen: ' . print_r( $data, true );

    $order_id = $data['order_id'] ?? null;
    if ( ! $order_id ) {
        $log[] = 'STOP: geen order_id gevonden.';
        grovia_mail_log( $log );
        return;
    }

    $order = wc_get_order( $order_id );
    if ( ! $order ) {
        $log[] = 'STOP: order niet gevonden voor ID ' . $order_id;
        grovia_mail_log( $log );
        return;
    }

    $log[] = 'Order gevonden: #' . $order_id;

    // Contact ID komt direct uit de Funnelkit callback data
    $contact_id = $data['contact_id'] ?? null;
    $log[]      = 'Contact ID uit callback: ' . print_r( $contact_id, true );

    if ( ! $contact_id ) {
        $log[] = 'STOP: geen contact_id in callback data.';
        grovia_mail_log( $log );
        return;
    }

    // Seizoencode uit aankoopdatum (augustus = start nieuw seizoen)
    $year        = (int) $order->get_date_created()->date('Y');
    $month       = (int) $order->get_date_created()->date('m');
    $start       = $month >= 8 ? $year : $year - 1;
    $season_code = substr( $start, 2 ) . substr( $start + 1, 2 );
    $log[]       = 'Seizoencode: ' . $season_code;

    // Schoolcode — gebaseerd op productcategorie slug
    // Nieuwe school toevoegen: 'categorie-slug' => 'XX',
    $school_map = [
        'schagen-united' => 'SU',
    ];

    // Fasecode — gebaseerd op variatie-attribuut pa_inschrijving
    // Nieuwe fase toevoegen: 'attribuut-waarde' => 'XX',
    $fase_map = [
        'cyclus-1'                     => 'C1',
        'cyclus-2'                     => 'C2',
        'cyclus-3'                     => 'C3',
        'seizoenkaart-inclusief-tenue' => 'SMT',
        'seizoenkaart-zonder-tenue'    => 'SZT',
    ];

    // Naam kind uitlezen uit order meta (ingevuld door ouder bij checkout)
    // TODO: bepaal business rule als "Naam kind" leeg is — nu wordt de tag zonder naam-slug
    // gezet, waardoor de assessment-guard per seizoen blokkeert (oud gedrag).
    $naam_kind = trim( $order->get_meta( 'Naam kind' ) );
    $naam_slug = $naam_kind ? grovia_naam_slug( $naam_kind ) : '';
    $log[]     = 'Naam kind: ' . ( $naam_kind ?: '(leeg)' ) . ' → slug: ' . ( $naam_slug ?: '(geen)' );

    $site_url = get_site_url();
    $api_key  = GROVIA_FUNNELKIT_API_KEY;

    foreach ( $order->get_items() as $item ) {
        $product = $item->get_product();
        if ( ! $product ) {
            $log[] = 'Item overgeslagen: geen product gevonden.';
            continue;
        }

        $log[] = '--- Product: ' . $product->get_name() . ' (slug: ' . $product->get_slug() . ')';

        // Schoolcode via productcategorie van het hoofdproduct
        $parent_id   = $product->is_type('variation') ? $product->get_parent_id() : $product->get_id();
        $school_code = '';
        $terms       = get_the_terms( $parent_id, 'product_cat' );

        if ( $terms && ! is_wp_error( $terms ) ) {
            foreach ( $terms as $term ) {
                if ( isset( $school_map[ $term->slug ] ) ) {
                    $school_code = $school_map[ $term->slug ];
                    break;
                }
            }
        }
        $log[] = 'Schoolcode: ' . ( $school_code ?: 'NIET GEVONDEN' );

        // Fasecode via pa_inschrijving variatie-attribuut
        $fase_code    = '';
        $inschrijving = $item->get_meta( 'pa_inschrijving' );
        $log[]        = 'pa_inschrijving meta waarde: ' . print_r( $inschrijving, true );

        if ( $inschrijving && isset( $fase_map[ $inschrijving ] ) ) {
            $fase_code = $fase_map[ $inschrijving ];
        }
        $log[] = 'Fasecode: ' . ( $fase_code ?: 'NIET GEVONDEN' );

        if ( ! $school_code || ! $fase_code ) {
            $log[] = 'OVERGESLAGEN: school of fase niet gevonden voor dit product.';
            continue;
        }

        $tag   = $school_code . $fase_code . $season_code . ( $naam_slug ? '_' . $naam_slug : '' ) . '_' . $order_id;
        $log[] = 'Tag te maken: ' . $tag;

        // Stap 1: Tag aanmaken (wordt genegeerd als die al bestaat)
        $create_response = wp_remote_post(
            $site_url . '/wp-json/funnelkit-automations/tag/add?api_key=' . $api_key,
            [
                'headers' => [ 'Content-Type' => 'application/json' ],
                'body'    => wp_json_encode( [ 'tags' => [ $tag ] ] ),
            ]
        );
        $log[] = 'Stap 1 (tag aanmaken) response: ' . wp_remote_retrieve_body( $create_response );

        // Stap 2: Tag ID ophalen
        $tags_response = wp_remote_get(
            $site_url . '/wp-json/funnelkit-automations/tags?api_key=' . $api_key,
            [ 'headers' => [ 'Content-Type' => 'application/json' ] ]
        );
        $tags_raw  = wp_remote_retrieve_body( $tags_response );
        $tags_body = json_decode( $tags_raw, true );
        $log[]     = 'Stap 2 (tags ophalen) response: ' . $tags_raw;

        $tag_id = null;
        if ( ! empty( $tags_body['data']['tags'] ) ) {
            foreach ( $tags_body['data']['tags'] as $t ) {
                if ( $t['name'] === $tag ) {
                    $tag_id = $t['ID'];
                    break;
                }
            }
        }
        $log[] = 'Tag ID gevonden: ' . print_r( $tag_id, true );

        if ( ! $tag_id ) {
            $log[] = 'STOP: tag ID niet gevonden na aanmaken.';
            continue;
        }

        // Stap 3: Tag toewijzen aan contact
        $assign_response = wp_remote_post(
            $site_url . '/wp-json/funnelkit-automations/contact/tag-assign/' . $contact_id . '?api_key=' . $api_key,
            [
                'headers' => [ 'Content-Type' => 'application/json' ],
                'body'    => wp_json_encode( [ 'tags' => [ $tag_id ] ] ),
            ]
        );
        $log[] = 'Stap 3 (tag toewijzen) response: ' . wp_remote_retrieve_body( $assign_response );
    }

    $log[] = '=== Callback klaar ===';
    grovia_mail_log( $log );
}

function grovia_mail_log( $log ) {
    $body = implode( "\n", $log );
    wp_mail( GROVIA_DEBUG_EMAIL, 'Grovia Tag Callback — debug log', $body );
}

function grovia_naam_slug( $naam ) {
    $naam = iconv( 'UTF-8', 'ASCII//TRANSLIT//IGNORE', $naam );
    $naam = strtolower( $naam );
    $naam = preg_replace( '/[^a-z0-9]+/', '-', $naam );
    return trim( $naam, '-' );
}

// Laad de Assessment Router
require_once plugin_dir_path( __FILE__ ) . 'grovia-assessment-router.php';
