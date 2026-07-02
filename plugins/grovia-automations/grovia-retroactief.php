<?php
/**
 * Grovia — Eenmalige migratie: WAGroep guard-tags instellen voor bestaande klanten
 *
 * Gebruik: bezoek als beheerder (10 orders per keer):
 *   https://grovia.nl/wp-admin/?grovia_actie=wa_guard_retroactief&pagina=1
 *   https://grovia.nl/wp-admin/?grovia_actie=wa_guard_retroactief&pagina=2
 *   ... enzovoort totdat je "Geen orders meer" ziet.
 *
 * Na uitvoering: verwijder dit bestand en de require_once regel in grovia-automations.php.
 */

add_action( 'admin_init', function () {

    if ( ! current_user_can( 'manage_options' ) ) return;
    if ( ( $_GET['grovia_actie'] ?? '' ) !== 'wa_guard_retroactief' ) return;

    $school_map = [
        'schagen-united'   => 'SU',
        'kolping-academie' => 'KA',
        'minimove'         => 'MM',
    ];
    $type_map = [
        'voetbaltraining' => 'VT',
        'keeperstraining' => 'KT',
    ];
    $uitsluit_categorieen = [ 'evenement' ];

    $site_url = get_site_url();
    $api_key  = defined( 'GROVIA_FUNNELKIT_API_KEY' ) ? GROVIA_FUNNELKIT_API_KEY : '';

    if ( ! $api_key ) {
        wp_die( 'GROVIA_FUNNELKIT_API_KEY niet ingesteld in wp-config.php.' );
    }

    $per_pagina = 10;
    $pagina     = max( 1, (int) ( $_GET['pagina'] ?? 1 ) );
    $offset     = ( $pagina - 1 ) * $per_pagina;

    $orders = wc_get_orders( [
        'status' => [ 'completed', 'processing' ],
        'limit'  => $per_pagina,
        'offset' => $offset,
        'orderby' => 'id',
        'order'   => 'ASC',
    ] );

    $log   = [];
    $log[] = "=== Pagina $pagina (orders " . ( $offset + 1 ) . "–" . ( $offset + count( $orders ) ) . ") ===";

    if ( empty( $orders ) ) {
        $log[] = 'Geen orders meer — migratie voltooid!';
        wp_die( nl2br( esc_html( implode( "\n", $log ) ) ), 'WAGroep migratie', [ 'response' => 200 ] );
        return;
    }

    // Alle FunnelKit tags eenmalig ophalen
    $all_tags_response = wp_remote_get(
        $site_url . '/wp-json/funnelkit-automations/tags?api_key=' . $api_key,
        [ 'headers' => [ 'Content-Type' => 'application/json' ] ]
    );
    $all_tags = json_decode( wp_remote_retrieve_body( $all_tags_response ), true )['data']['tags'] ?? [];

    $tag_name_to_id = [];
    $tag_id_to_name = [];
    foreach ( $all_tags as $t ) {
        $tag_name_to_id[ strtolower( $t['name'] ) ] = $t['ID'];
        $tag_id_to_name[ (string) $t['ID'] ]         = strtolower( $t['name'] );
    }

    foreach ( $orders as $order ) {
        $order_id = $order->get_id();
        $email    = $order->get_billing_email();

        $log[] = "\n--- Order #$order_id ($email)";

        // FunnelKit contact opzoeken via directe DB-query
        global $wpdb;
        $contact_id = $wpdb->get_var( $wpdb->prepare(
            "SELECT id FROM {$wpdb->prefix}bwf_contact WHERE email = %s LIMIT 1",
            strtolower( $email )
        ) );

        if ( ! $contact_id ) {
            $log[] = "OVERGESLAGEN: geen FunnelKit contact gevonden voor $email";
            continue;
        }

        $log[] = "Contact ID: $contact_id";

        // Huidige tags van dit contact ophalen
        $c_response      = wp_remote_get(
            $site_url . '/wp-json/funnelkit-automations/contact?api_key=' . $api_key . '&id=' . $contact_id,
            [ 'headers' => [ 'Content-Type' => 'application/json' ] ]
        );
        $c_body          = json_decode( wp_remote_retrieve_body( $c_response ), true );
        $raw_tags        = $c_body['data']['contact']['contact']['db_contact']['tags'] ?? '[]';
        $contact_tag_ids = array_map( 'strval', json_decode( $raw_tags, true ) ?? [] );

        $existing_tag_names = [];
        foreach ( $contact_tag_ids as $tid ) {
            if ( isset( $tag_id_to_name[ $tid ] ) ) {
                $existing_tag_names[] = $tag_id_to_name[ $tid ];
            }
        }

        // Bepaal benodigde WAGroep guard-tags op basis van order-producten
        $wa_guard_tags = [];

        foreach ( $order->get_items() as $item ) {
            $product = $item->get_product();
            if ( ! $product ) continue;

            $parent_id = $product->is_type( 'variation' ) ? $product->get_parent_id() : $product->get_id();
            $terms     = get_the_terms( $parent_id, 'product_cat' );
            if ( ! $terms || is_wp_error( $terms ) ) continue;

            $is_uitsluit = false;
            foreach ( $terms as $term ) {
                if ( in_array( $term->slug, $uitsluit_categorieen, true ) ) {
                    $is_uitsluit = true;
                    break;
                }
            }
            if ( $is_uitsluit ) continue;

            $school_code = '';
            $type_code   = '';
            foreach ( $terms as $term ) {
                if ( isset( $school_map[ $term->slug ] ) ) { $school_code = $school_map[ $term->slug ]; }
                if ( isset( $type_map[ $term->slug ] ) )   { $type_code   = $type_map[ $term->slug ]; }
            }

            if ( $school_code && $type_code ) {
                $guard_tag = 'WAGroep_' . $school_code . '_' . $type_code;
                if ( ! in_array( $guard_tag, $wa_guard_tags, true ) ) {
                    $wa_guard_tags[] = $guard_tag;
                }
            }
        }

        if ( empty( $wa_guard_tags ) ) {
            $log[] = 'Geen WAGroep tags van toepassing voor deze order.';
            continue;
        }

        foreach ( $wa_guard_tags as $guard_tag ) {

            if ( in_array( strtolower( $guard_tag ), $existing_tag_names, true ) ) {
                $log[] = "Tag '$guard_tag' al aanwezig — overgeslagen.";
                continue;
            }

            // Tag aanmaken indien nog niet bestaat
            if ( ! isset( $tag_name_to_id[ strtolower( $guard_tag ) ] ) ) {
                wp_remote_post(
                    $site_url . '/wp-json/funnelkit-automations/tag/add?api_key=' . $api_key,
                    [
                        'headers' => [ 'Content-Type' => 'application/json' ],
                        'body'    => wp_json_encode( [ 'tags' => [ $guard_tag ] ] ),
                    ]
                );

                $fresh = json_decode(
                    wp_remote_retrieve_body( wp_remote_get(
                        $site_url . '/wp-json/funnelkit-automations/tags?api_key=' . $api_key,
                        [ 'headers' => [ 'Content-Type' => 'application/json' ] ]
                    ) ),
                    true
                )['data']['tags'] ?? [];

                foreach ( $fresh as $t ) {
                    $tag_name_to_id[ strtolower( $t['name'] ) ] = $t['ID'];
                }
            }

            $guard_tag_id = $tag_name_to_id[ strtolower( $guard_tag ) ] ?? null;

            if ( ! $guard_tag_id ) {
                $log[] = "WAARSCHUWING: ID niet gevonden voor tag '$guard_tag'.";
                continue;
            }

            wp_remote_post(
                $site_url . '/wp-json/funnelkit-automations/contact/tag-assign/' . $contact_id . '?api_key=' . $api_key,
                [
                    'headers' => [ 'Content-Type' => 'application/json' ],
                    'body'    => wp_json_encode( [ 'tags' => [ $guard_tag_id ] ] ),
                ]
            );

            $log[] = "Tag '$guard_tag' toegewezen aan contact $contact_id.";
        }
    }

    $volgende = $pagina + 1;
    $volgende_url = admin_url( '?grovia_actie=wa_guard_retroactief&pagina=' . $volgende );
    $log[] = "\n=== Pagina $pagina klaar ===";
    $log[] = "Volgende: $volgende_url";

    $output  = '<pre>' . esc_html( implode( "\n", $log ) ) . '</pre>';
    $output .= '<p><a href="' . esc_url( $volgende_url ) . '"><strong>→ Volgende pagina (' . $volgende . ')</strong></a></p>';

    wp_die( $output, 'WAGroep migratie pagina ' . $pagina, [ 'response' => 200 ] );

} );
