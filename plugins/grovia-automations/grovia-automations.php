<?php
/**
 * Plugin Name: Grovia Automations
 * Description: Custom tag logica voor Funnelkit / Ixly workflow
 * Version: 1.6
 * Author: Grovia
 */

// Funnelkit REST API key — aanmaken via Funnelkit → Settings → REST API
// Zet deze in wp-config.php als: define( 'GROVIA_FUNNELKIT_API_KEY', 'jouw-sleutel' );
define( 'GROVIA_FUNNELKIT_API_KEY', '' );

// TIJDELIJK — debug e-mailadres voor het live-testen van de nieuwe Test Router-flow.
// Mailt bij elke run de volledige log (incl. naam/email/bedrag) naar dit adres.
// VERWIJDEREN (of terugzetten naar alleen error_log) zodra er weer met echte
// klantorders getest wordt — dit lekt anders klantdata naar deze inbox.
if ( ! defined( 'GROVIA_DEBUG_EMAIL' ) ) {
    define( 'GROVIA_DEBUG_EMAIL', 'max@greit.nl' );
}

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
        'schagen-united'   => 'SU',
        'kolping-academie' => 'KA',
        'minimove'         => 'MM',
    ];

    // Typecode — whitelist voor WhatsApp uitnodiging
    // Producten met deze categorieën triggeren een WhatsApp groepsuitnodiging
    $type_map = [
        'voetbaltraining' => 'VT',
        'keeperstraining' => 'KT',
    ];

    // Categorieën die zowel de WhatsApp-uitnodiging als de assessment-tag uitsluiten
    // (evenementen en proeftrainingen zijn geen "echte" inschrijving, dus geen Ixly/
    // Action Type-uitnodiging).
    $uitsluit_categorieen = [ 'evenement', 'proef-training' ];

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

    // Bijhouden welke WhatsApp-trigger tags aangemaakt moeten worden (dedupliceert per order)
    $wa_tags_aanmaken = [];

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

        // Typecode + uitsluitcheck voor WhatsApp uitnodiging + assessment-tag
        $type_code   = '';
        $is_uitsluit = false;
        if ( $terms && ! is_wp_error( $terms ) ) {
            foreach ( $terms as $term ) {
                if ( in_array( $term->slug, $uitsluit_categorieen, true ) ) {
                    $is_uitsluit = true;
                    break;
                }
            }
            if ( ! $is_uitsluit ) {
                foreach ( $terms as $term ) {
                    if ( isset( $type_map[ $term->slug ] ) ) {
                        $type_code = $type_map[ $term->slug ];
                        break;
                    }
                }
            }
        }
        $log[] = 'Typecode: ' . ( $type_code ?: 'NIET GEVONDEN' ) . ( $is_uitsluit ? ' (uitgesloten van WhatsApp + assessment)' : '' );

        // WhatsApp trigger tag verzamelen (school + type, niet uitgesloten)
        if ( $school_code && $type_code ) {
            $wa_tag = 'WA_' . $school_code . '_' . $type_code;
            if ( ! in_array( $wa_tag, $wa_tags_aanmaken, true ) ) {
                $wa_tags_aanmaken[] = $wa_tag;
            }
        }

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

        if ( $is_uitsluit ) {
            $log[] = 'OVERGESLAGEN: categorie uitgesloten van assessment-tag (evenement/proeftraining).';
            continue;
        }

        // MiniMove doet niet mee aan Ixly/Action Type-assessment (alleen KA/SU).
        // Losse check t.o.v. $uitsluit_categorieen, want die zou ook de WhatsApp
        // trigger tag (WA_MM_VT) onderdrukken -- die moet voor MM juist wel blijven werken.
        if ( 'MM' === $school_code ) {
            $log[] = 'OVERGESLAGEN: MiniMove doet niet mee aan Ixly/Action Type-assessment.';
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

        // Stap 2: Tag ID ophalen (gepagineerd -- /tags geeft max. 25 per aanroep terug)
        $alle_tags = grovia_alle_tags_ophalen( $site_url, $api_key );
        $tag_id    = grovia_tag_id_zoeken( $alle_tags, $tag );
        $log[]     = 'Stap 2 (tags opgehaald, gepagineerd): ' . count( $alle_tags ) . ' tags totaal. Tag ID gevonden: ' . print_r( $tag_id, true );

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

    // WhatsApp trigger tags aanmaken en toewijzen aan contact
    foreach ( $wa_tags_aanmaken as $wa_tag ) {
        $log[] = '--- WhatsApp trigger tag: ' . $wa_tag;

        wp_remote_post(
            $site_url . '/wp-json/funnelkit-automations/tag/add?api_key=' . $api_key,
            [
                'headers' => [ 'Content-Type' => 'application/json' ],
                'body'    => wp_json_encode( [ 'tags' => [ $wa_tag ] ] ),
            ]
        );

        $wa_alle_tags = grovia_alle_tags_ophalen( $site_url, $api_key );
        $wa_tag_id    = grovia_tag_id_zoeken( $wa_alle_tags, $wa_tag );

        if ( $wa_tag_id ) {
            wp_remote_post(
                $site_url . '/wp-json/funnelkit-automations/contact/tag-assign/' . $contact_id . '?api_key=' . $api_key,
                [
                    'headers' => [ 'Content-Type' => 'application/json' ],
                    'body'    => wp_json_encode( [ 'tags' => [ $wa_tag_id ] ] ),
                ]
            );
            $log[] = 'WhatsApp trigger tag toegewezen: ' . $wa_tag . ' (ID: ' . $wa_tag_id . ')';
        } else {
            $log[] = 'Waarschuwing: WhatsApp trigger tag ID niet gevonden: ' . $wa_tag;
        }
    }

    $log[] = '=== Callback klaar ===';
    grovia_mail_log( $log );
}

// Logt de callback-run naar de PHP error-log, en TIJDELIJK ook naar
// GROVIA_DEBUG_EMAIL voor het live-testen van de nieuwe flow (zie define hierboven).
function grovia_mail_log( $log ) {
    $body = implode( "\n", $log );
    error_log( 'Grovia Tag Callback: ' . implode( ' | ', $log ) );
    wp_mail( GROVIA_DEBUG_EMAIL, 'Grovia Tag Callback — debug log', $body );
}

function grovia_naam_slug( $naam ) {
    $naam = iconv( 'UTF-8', 'ASCII//TRANSLIT//IGNORE', $naam );
    $naam = strtolower( $naam );
    $naam = preg_replace( '/[^a-z0-9]+/', '-', $naam );
    return trim( $naam, '-' );
}

/**
 * Haalt ALLE tags op via de Funnelkit REST API, met paginering.
 * De /tags-endpoint geeft maximaal 25 tags per aanroep terug (zie "limit" in de
 * response); zonder paginering mist deze functie elke tag die niet in de eerste
 * pagina zit -- precies de bug die "tag ID niet gevonden na aanmaken" veroorzaakte
 * zodra het account meer dan 25 tags had.
 *
 * @return array Lijst van tag-objecten (['ID' => ..., 'name' => ...], ...)
 */
function grovia_alle_tags_ophalen( $site_url, $api_key ) {
    $alle_tags = [];
    $offset    = 0;

    do {
        $response = wp_remote_get(
            $site_url . '/wp-json/funnelkit-automations/tags?api_key=' . $api_key . '&offset=' . $offset,
            [ 'headers' => [ 'Content-Type' => 'application/json' ] ]
        );
        $body  = json_decode( wp_remote_retrieve_body( $response ), true );
        $batch = $body['data']['tags'] ?? [];

        $alle_tags = array_merge( $alle_tags, $batch );
        $offset   += count( $batch );
    } while ( count( $batch ) > 0 );

    return $alle_tags;
}

/**
 * Zoekt het ID van een tag op naam (hoofdletterongevoelig) in een lijst tags,
 * zoals teruggegeven door grovia_alle_tags_ophalen().
 *
 * @return int|null
 */
function grovia_tag_id_zoeken( $alle_tags, $tag_naam ) {
    foreach ( $alle_tags as $t ) {
        if ( strtolower( $t['name'] ) === strtolower( $tag_naam ) ) {
            return $t['ID'];
        }
    }
    return null;
}

// Laad de Assessment Router
require_once plugin_dir_path( __FILE__ ) . 'grovia-assessment-router.php';
