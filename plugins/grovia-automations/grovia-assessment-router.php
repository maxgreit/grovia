<?php
/**
 * Assessment Router
 * Bepaalt op basis van tags of een contact een assessment
 * of betaallink moet ontvangen, en roept de Azure Function direct aan.
 *
 * Triggered via Funnelkit Custom Callback: grovia_assessment_router
 * Trigger: Tag Added
 *
 * Tagformaat: {school}{fase}{seizoen}_{naam-kind-slug}_{order_id}
 *   bijv. SUC12627_lisa-jansen_42
 *
 * Versie: 2.0
 */

// Funnelkit REST API key — aanmaken via Funnelkit → Settings → REST API
if ( ! defined( 'GROVIA_FUNNELKIT_API_KEY' ) ) {
    define( 'GROVIA_FUNNELKIT_API_KEY', '' );
}

// Azure Function URLs — zet deze in wp-config.php
// define( 'GROVIA_IXLY_AANMELDING_URL', 'https://....azurewebsites.net/api/ixly-aanmelding?code=...' );
// define( 'GROVIA_MOLLIE_BETAALLINK_URL', 'https://....azurewebsites.net/api/mollie-betaallink?code=...' );
if ( ! defined( 'GROVIA_IXLY_AANMELDING_URL' ) ) {
    define( 'GROVIA_IXLY_AANMELDING_URL', '' );
}
if ( ! defined( 'GROVIA_MOLLIE_BETAALLINK_URL' ) ) {
    define( 'GROVIA_MOLLIE_BETAALLINK_URL', '' );
}

// Debug e-mailadres — ontvangt de log na elke callback-run
if ( ! defined( 'GROVIA_DEBUG_EMAIL' ) ) {
    define( 'GROVIA_DEBUG_EMAIL', 'max@greit.nl' );
}

// Fases die een betaallink vereisen (cyclus 2 of 3)
define( 'GROVIA_BETAALLINK_FASES', [ 'C2', 'C3' ] );

add_action( 'grovia_assessment_router', 'grovia_assessment_router' );

function grovia_assessment_router( $data ) {

    $log   = [];
    $log[] = '=== Assessment Router gestart ===';
    $log[] = 'Data: ' . print_r( $data, true );

    $new_tag = $data['tag_name'] ?? null;
    if ( ! $new_tag ) {
        $log[] = 'STOP: geen tag_name gevonden in data.';
        grovia_router_mail_log( $log );
        return;
    }

    $log[] = 'Nieuwe tag: ' . $new_tag;

    // ── Tag parseren ──────────────────────────────────────────────────────────
    // Formaat: {school}{fase}{seizoen}_{naam_slug}_{order_id}
    // Eerste underscore scheidt tag_base van de rest.
    // Laatste segment van de rest is altijd de numerieke order_id.

    $underscore_pos = strpos( $new_tag, '_' );
    if ( $underscore_pos === false ) {
        $log[] = 'STOP: geen underscore in tag — geen Ixly/betaallink-tag.';
        grovia_router_mail_log( $log );
        return;
    }

    $tag_base  = substr( $new_tag, 0, $underscore_pos );
    $remainder = substr( $new_tag, $underscore_pos + 1 );

    // Minimale taglengte voor base: school(2) + fase(2+) + seizoen(4) = 8 tekens
    if ( strlen( $tag_base ) < 8 ) {
        $log[] = 'STOP: tag base te kort (' . $tag_base . ')';
        grovia_router_mail_log( $log );
        return;
    }

    // Seizoencode = laatste 4 tekens van base
    $season_code = substr( $tag_base, -4 );
    $school_code = substr( $tag_base, 0, 2 );
    $fase_code   = substr( $tag_base, 2, strlen( $tag_base ) - 6 );

    $log[] = "School: $school_code | Fase: $fase_code | Seizoen: $season_code";

    if ( ! ctype_digit( $season_code ) ) {
        $log[] = 'STOP: seizoencode niet numeriek — geen Ixly-tag.';
        grovia_router_mail_log( $log );
        return;
    }

    // Extraheer order_id (laatste segment na laatste underscore, moet numeriek zijn)
    $last_underscore = strrpos( $remainder, '_' );
    if ( $last_underscore !== false ) {
        $last_part = substr( $remainder, $last_underscore + 1 );
        $naam_slug = substr( $remainder, 0, $last_underscore );
    } else {
        $last_part = $remainder;
        $naam_slug = '';
    }

    if ( ! ctype_digit( $last_part ) ) {
        $log[] = 'STOP: laatste tagsegment niet numeriek — geen order_id gevonden.';
        grovia_router_mail_log( $log );
        return;
    }

    $order_id = (int) $last_part;
    $log[]    = "Naam slug: " . ( $naam_slug ?: '(geen)' ) . " | Order ID: $order_id";

    // ── Contact ophalen ───────────────────────────────────────────────────────

    $contact_id = $data['contact_id'] ?? null;
    if ( ! $contact_id ) {
        $log[] = 'STOP: geen contact_id gevonden.';
        grovia_router_mail_log( $log );
        return;
    }

    // ── Order data ophalen via WooCommerce ────────────────────────────────────

    $order = wc_get_order( $order_id );
    if ( ! $order ) {
        $log[] = 'STOP: order niet gevonden: ' . $order_id;
        grovia_router_mail_log( $log );
        return;
    }

    $email       = $order->get_billing_email();
    $voornaam    = $order->get_billing_first_name();
    $achternaam  = $order->get_billing_last_name();
    $wc_klant_id = (string) $order->get_customer_id();
    $naam_kind   = trim( $order->get_meta( 'Naam kind' ) );
    $bedrag      = number_format( (float) $order->get_total(), 2, '.', '' );

    $log[] = "Email: $email | Naam: $voornaam $achternaam | Naam kind: " . ( $naam_kind ?: '(leeg)' ) . " | Bedrag: $bedrag";

    // ── Assessment-guard per kind per seizoen ─────────────────────────────────

    $assessment_tag_name = 'Assessment' . $season_code . ( $naam_slug ? '_' . $naam_slug : '' );
    $log[]               = 'Zoek naar assessment-guard-tag: ' . $assessment_tag_name;

    $site_url = get_site_url();
    $api_key  = GROVIA_FUNNELKIT_API_KEY;

    // Huidige tags van het contact ophalen
    $contact_response = wp_remote_get(
        $site_url . '/wp-json/funnelkit-automations/contact?api_key=' . $api_key . '&id=' . $contact_id,
        [ 'headers' => [ 'Content-Type' => 'application/json' ] ]
    );
    $contact_body = json_decode( wp_remote_retrieve_body( $contact_response ), true );
    $raw_tags     = $contact_body['data']['contact']['contact']['db_contact']['tags'] ?? '[]';
    $tag_ids      = json_decode( $raw_tags, true );

    $all_tags_response = wp_remote_get(
        $site_url . '/wp-json/funnelkit-automations/tags?api_key=' . $api_key,
        [ 'headers' => [ 'Content-Type' => 'application/json' ] ]
    );
    $all_tags_body = json_decode( wp_remote_retrieve_body( $all_tags_response ), true );
    $all_tags      = $all_tags_body['data']['tags'] ?? [];

    $tag_id_to_name = [];
    foreach ( $all_tags as $t ) {
        $tag_id_to_name[ (string) $t['ID'] ] = $t['name'];
    }

    $contact_tag_names = [];
    foreach ( $tag_ids as $tid ) {
        $tid = (string) $tid;
        if ( isset( $tag_id_to_name[ $tid ] ) ) {
            $contact_tag_names[] = $tag_id_to_name[ $tid ];
        }
    }
    $log[] = 'Huidige tagnamen contact: ' . implode( ', ', $contact_tag_names );

    $heeft_assessment = false;
    foreach ( $contact_tag_names as $tn ) {
        if ( strtolower( $tn ) === strtolower( $assessment_tag_name ) ) {
            $heeft_assessment = true;
            break;
        }
    }

    if ( $heeft_assessment ) {
        $log[] = 'Contact heeft al een assessment ontvangen dit seizoen voor dit kind. Stop.';
        grovia_router_mail_log( $log );
        return;
    }

    $log[] = 'Geen assessment gevonden — gaan verder.';

    // ── Assessment-guard-tag toewijzen ────────────────────────────────────────

    wp_remote_post(
        $site_url . '/wp-json/funnelkit-automations/tag/add?api_key=' . $api_key,
        [
            'headers' => [ 'Content-Type' => 'application/json' ],
            'body'    => wp_json_encode( [ 'tags' => [ $assessment_tag_name ] ] ),
        ]
    );

    $tags_response = wp_remote_get(
        $site_url . '/wp-json/funnelkit-automations/tags?api_key=' . $api_key,
        [ 'headers' => [ 'Content-Type' => 'application/json' ] ]
    );
    $all_tags_new = json_decode( wp_remote_retrieve_body( $tags_response ), true )['data']['tags'] ?? [];

    $assessment_tag_id = null;
    foreach ( $all_tags_new as $t ) {
        if ( strtolower( $t['name'] ) === strtolower( $assessment_tag_name ) ) {
            $assessment_tag_id = $t['ID'];
            break;
        }
    }

    if ( $assessment_tag_id ) {
        wp_remote_post(
            $site_url . '/wp-json/funnelkit-automations/contact/tag-assign/' . $contact_id . '?api_key=' . $api_key,
            [
                'headers' => [ 'Content-Type' => 'application/json' ],
                'body'    => wp_json_encode( [ 'tags' => [ $assessment_tag_id ] ] ),
            ]
        );
        $log[] = "Assessment-guard-tag '$assessment_tag_name' (ID: $assessment_tag_id) toegewezen.";
    } else {
        $log[] = 'Waarschuwing: assessment-guard-tag ID niet gevonden na aanmaken.';
    }

    // ── Azure Function aanroepen ───────────────────────────────────────────────

    $is_betaallink = in_array( $fase_code, GROVIA_BETAALLINK_FASES );

    if ( $is_betaallink ) {
        $azure_url = GROVIA_MOLLIE_BETAALLINK_URL;
        $payload   = [
            'voornaam'    => $voornaam,
            'achternaam'  => $achternaam,
            'naam_kind'   => $naam_kind,
            'email'       => $email,
            'wc_klant_id' => $wc_klant_id,
            'order_id'    => (string) $order_id,
            'bedrag'      => $bedrag,
            'seizoen'     => $season_code,
        ];
        $log[] = "Fase $fase_code → betaallink aanvragen.";
    } else {
        $azure_url = GROVIA_IXLY_AANMELDING_URL;
        $payload   = [
            'voornaam'    => $voornaam,
            'achternaam'  => $achternaam,
            'naam_kind'   => $naam_kind,
            'email'       => $email,
            'wc_klant_id' => $wc_klant_id,
            'order_id'    => (string) $order_id,
        ];
        $log[] = "Fase $fase_code → assessment aanvragen.";
    }

    if ( ! $azure_url ) {
        $log[] = 'STOP: Azure Function URL niet geconfigureerd in wp-config.php.';
        grovia_router_mail_log( $log );
        return;
    }

    $azure_response = wp_remote_post( $azure_url, [
        'headers' => [ 'Content-Type' => 'application/json' ],
        'body'    => wp_json_encode( $payload ),
        'timeout' => 30,
    ] );

    $azure_code = wp_remote_retrieve_response_code( $azure_response );
    $azure_body = wp_remote_retrieve_body( $azure_response );
    $log[]      = "Azure Function response: HTTP $azure_code — $azure_body";

    if ( is_wp_error( $azure_response ) ) {
        $log[] = 'Azure Function fout: ' . $azure_response->get_error_message();
    }

    $log[] = '=== Assessment Router klaar ===';
    grovia_router_mail_log( $log );
}

function grovia_router_mail_log( $log ) {
    $body = implode( "\n", $log );
    wp_mail( GROVIA_DEBUG_EMAIL, 'Grovia Assessment Router — debug log', $body );
}
