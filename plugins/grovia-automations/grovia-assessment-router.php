<?php
/**
 * Assessment Router
 * Bepaalt op basis van tags of een contact een assessment
 * en/of betaallink moet ontvangen.
 *
 * Triggered via Funnelkit Custom Callback: grovia_assessment_router
 * Trigger: Tag Added
 *
 * Versie: 1.0
 */

// Funnelkit REST API key — aanmaken via Funnelkit → Settings → REST API
if ( ! defined( 'GROVIA_FUNNELKIT_API_KEY' ) ) {
    define( 'GROVIA_FUNNELKIT_API_KEY', '' );
}

// Debug e-mailadres — ontvangt de log na elke callback-run
if ( ! defined( 'GROVIA_DEBUG_EMAIL' ) ) {
    define( 'GROVIA_DEBUG_EMAIL', 'max@greit.nl' );
}

add_action( 'grovia_assessment_router', 'grovia_assessment_router' );

function grovia_assessment_router( $data ) {

    $log   = [];
    $log[] = '=== Assessment Router gestart ===';
    $log[] = 'Data: ' . print_r( $data, true );

    // De zojuist toegevoegde tag staat in $data['tag_name']
    $new_tag = $data['tag_name'] ?? null;

    if ( ! $new_tag ) {
        $log[] = 'STOP: geen tag_name gevonden in data.';
        grovia_router_mail_log( $log );
        return;
    }

    $log[] = 'Nieuwe tag: ' . $new_tag;

    // Tagformaat: [School][Fase][Seizoen] — bijv. SUC12627
    // Minimale taglengte: 2 (school) + 2 (fase) + 4 (seizoen) = 8 tekens
    if ( strlen( $new_tag ) < 8 ) {
        $log[] = 'STOP: tag te kort om te verwerken (' . $new_tag . ')';
        grovia_router_mail_log( $log );
        return;
    }

    // Seizoencode = laatste 4 tekens
    $season_code = substr( $new_tag, -4 );

    // Schoolcode = eerste 2 tekens
    $school_code = substr( $new_tag, 0, 2 );

    // Fasecode = alles ertussenin
    $fase_code = substr( $new_tag, 2, strlen( $new_tag ) - 6 );

    $log[] = "School: $school_code | Fase: $fase_code | Seizoen: $season_code";

    // Alleen verwerken als seizoencode numeriek is (bijv. 2627)
    if ( ! ctype_digit( $season_code ) ) {
        $log[] = 'STOP: seizoencode is niet numeriek, waarschijnlijk geen Ixly-tag.';
        grovia_router_mail_log( $log );
        return;
    }

    // Fases die een betaallink vereisen (cyclus 2 of 3 zonder cyclus 1)
    $betaallink_fases = [ 'C2', 'C3' ];

    $contact_id = $data['contact_id'] ?? null;
    if ( ! $contact_id ) {
        $log[] = 'STOP: geen contact_id gevonden.';
        grovia_router_mail_log( $log );
        return;
    }

    $site_url = get_site_url();
    $api_key  = GROVIA_FUNNELKIT_API_KEY;

    // Haal alle huidige tags van het contact op
    $contact_response = wp_remote_get(
        $site_url . '/wp-json/funnelkit-automations/contact?api_key=' . $api_key
            . '&id=' . $contact_id,
        [ 'headers' => [ 'Content-Type' => 'application/json' ] ]
    );
    $contact_raw  = wp_remote_retrieve_body( $contact_response );
    $contact_body = json_decode( $contact_raw, true );
    $log[]        = 'Contact response: ' . $contact_raw;

    // Tag IDs van het contact ophalen
    $raw_tags = $contact_body['data']['contact']['contact']['db_contact']['tags'] ?? '[]';
    $tag_ids  = json_decode( $raw_tags, true );
    $log[]    = 'Huidige tag IDs: ' . print_r( $tag_ids, true );

    // Haal alle tags op zodat we namen kunnen opzoeken bij IDs
    $all_tags_response = wp_remote_get(
        $site_url . '/wp-json/funnelkit-automations/tags?api_key=' . $api_key,
        [ 'headers' => [ 'Content-Type' => 'application/json' ] ]
    );
    $all_tags_body = json_decode( wp_remote_retrieve_body( $all_tags_response ), true );
    $all_tags      = $all_tags_body['data']['tags'] ?? [];

    // Bouw een map van tag ID naar tagnaam
    $tag_id_to_name = [];
    foreach ( $all_tags as $t ) {
        $tag_id_to_name[ (string) $t['ID'] ] = $t['name'];
    }

    // Verzamel de huidige tagnamen van dit contact
    $contact_tag_names = [];
    foreach ( $tag_ids as $tid ) {
        $tid = (string) $tid;
        if ( isset( $tag_id_to_name[ $tid ] ) ) {
            $contact_tag_names[] = $tag_id_to_name[ $tid ];
        }
    }
    $log[] = 'Huidige tagnamen contact: ' . implode( ', ', $contact_tag_names );

    // Assessment-tag voor dit seizoen — schoolonafhankelijk
    // Patroon: Assessment[seizoen] bijv. Assessment2627
    $assessment_tag_name = 'Assessment' . $season_code;
    $log[] = 'Zoek naar assessment-tag: ' . $assessment_tag_name;

    // Check: heeft contact al een assessment gehad dit seizoen?
    $heeft_assessment = false;
    foreach ( $contact_tag_names as $tn ) {
        if ( strtolower( $tn ) === strtolower( $assessment_tag_name ) ) {
            $heeft_assessment = true;
            break;
        }
    }

    if ( $heeft_assessment ) {
        $log[] = 'Contact heeft al een assessment ontvangen dit seizoen. Stop.';
        grovia_router_mail_log( $log );
        return;
    }

    $log[] = 'Geen assessment gevonden dit seizoen — gaan verder.';

    // Bepaal uitkomst-tag op basis van fase
    $uitkomst_tag = in_array( $fase_code, $betaallink_fases )
        ? 'StuurBetaallinkAssessment'
        : 'StuurAssessment';

    $log[] = 'Uitkomst-tag: ' . $uitkomst_tag;

    // Maak beide tags aan als die nog niet bestaan
    wp_remote_post(
        $site_url . '/wp-json/funnelkit-automations/tag/add?api_key=' . $api_key,
        [
            'headers' => [ 'Content-Type' => 'application/json' ],
            'body'    => wp_json_encode( [ 'tags' => [ $uitkomst_tag, $assessment_tag_name ] ] ),
        ]
    );

    // Haal tag IDs op voor beide tags
    $tags_response = wp_remote_get(
        $site_url . '/wp-json/funnelkit-automations/tags?api_key=' . $api_key,
        [ 'headers' => [ 'Content-Type' => 'application/json' ] ]
    );
    $tags_body    = json_decode( wp_remote_retrieve_body( $tags_response ), true );
    $all_tags_new = $tags_body['data']['tags'] ?? [];

    $uitkomst_tag_id   = null;
    $assessment_tag_id = null;
    foreach ( $all_tags_new as $t ) {
        if ( $t['name'] === $uitkomst_tag ) {
            $uitkomst_tag_id = $t['ID'];
        }
        if ( strtolower( $t['name'] ) === strtolower( $assessment_tag_name ) ) {
            $assessment_tag_id = $t['ID'];
        }
    }

    $log[] = "Uitkomst tag ID: $uitkomst_tag_id | Assessment tag ID: $assessment_tag_id";

    // Wijs beide tags toe aan het contact
    $tags_to_assign = array_values( array_filter( [ $uitkomst_tag_id, $assessment_tag_id ] ) );

    $assign_response = wp_remote_post(
        $site_url . '/wp-json/funnelkit-automations/contact/tag-assign/' . $contact_id
            . '?api_key=' . $api_key,
        [
            'headers' => [ 'Content-Type' => 'application/json' ],
            'body'    => wp_json_encode( [ 'tags' => $tags_to_assign ] ),
        ]
    );
    $log[] = 'Tag assign response: ' . wp_remote_retrieve_body( $assign_response );

    $log[] = '=== Assessment Router klaar ===';
    grovia_router_mail_log( $log );
}

function grovia_router_mail_log( $log ) {
    $body = implode( "\n", $log );
    wp_mail( GROVIA_DEBUG_EMAIL, 'Grovia Assessment Router — debug log', $body );
}
