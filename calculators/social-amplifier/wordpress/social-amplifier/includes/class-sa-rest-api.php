<?php

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/**
 * Registers all REST API routes for the Social Amplifier plugin.
 *
 * Namespace: social-amplifier/v1
 *
 * Public (no auth):
 *   GET  /share/toolkit/{id}            – embed widget payload
 *   POST /analytics/share               – record a share event
 *   GET  /share/r/{shareId}             – click redirect + tracking
 *   GET  /auth/{platform}/connect       – begin OAuth flow
 *   GET  /auth/{platform}/callback      – OAuth callback
 *
 * Admin (manage_options):
 *   POST   /organizations
 *   GET    /organizations
 *   GET    /organizations/{slug}
 *   GET    /organizations/{orgId}/campaigns
 *   POST   /organizations/{orgId}/campaigns
 *   GET    /campaigns/{id}
 *   PATCH  /campaigns/{id}/status
 *   GET    /campaigns/{campaignId}/content
 *   POST   /campaigns/{campaignId}/content
 *   PATCH  /content/{id}
 *   DELETE /content/{id}
 *   GET    /campaigns/{campaignId}/toolkits
 *   POST   /campaigns/{campaignId}/toolkits
 *   GET    /toolkits/{id}
 *   GET    /analytics/toolkit/{id}
 *   GET    /analytics/campaign/{id}
 */
class SA_REST_API {

    private SA_Campaigns        $campaigns;
    private SA_Analytics        $analytics;
    private SA_Platform_Registry $platforms;

    public function __construct(
        SA_Campaigns $campaigns,
        SA_Analytics $analytics,
        SA_Platform_Registry $platforms
    ) {
        $this->campaigns = $campaigns;
        $this->analytics = $analytics;
        $this->platforms = $platforms;
    }

    public function register_routes(): void {
        $ns = SA_REST_NAMESPACE;

        // ── Public ────────────────────────────────────────────────────────

        register_rest_route( $ns, '/share/toolkit/(?P<id>[a-z0-9]+)', [
            'methods'             => 'GET',
            'callback'            => [ $this, 'get_toolkit_embed' ],
            'permission_callback' => '__return_true',
            'args'                => [ 'id' => [ 'required' => true, 'type' => 'string' ] ],
        ] );

        register_rest_route( $ns, '/analytics/share', [
            'methods'             => 'POST',
            'callback'            => [ $this, 'record_share' ],
            'permission_callback' => '__return_true',
        ] );

        register_rest_route( $ns, '/share/r/(?P<share_id>[a-z0-9]+)', [
            'methods'             => 'GET',
            'callback'            => [ $this, 'click_redirect' ],
            'permission_callback' => '__return_true',
            'args'                => [ 'share_id' => [ 'required' => true, 'type' => 'string' ] ],
        ] );

        // ── OAuth ─────────────────────────────────────────────────────────

        register_rest_route( $ns, '/auth/(?P<platform>[a-z]+)/connect', [
            'methods'             => 'GET',
            'callback'            => [ $this, 'oauth_connect' ],
            'permission_callback' => [ $this, 'require_admin' ],
            'args'                => [ 'platform' => [ 'required' => true, 'type' => 'string' ] ],
        ] );

        register_rest_route( $ns, '/auth/(?P<platform>[a-z]+)/callback', [
            'methods'             => 'GET',
            'callback'            => [ $this, 'oauth_callback' ],
            'permission_callback' => '__return_true',   // state param guards this
            'args'                => [ 'platform' => [ 'required' => true, 'type' => 'string' ] ],
        ] );

        // ── Organizations ─────────────────────────────────────────────────

        register_rest_route( $ns, '/organizations', [
            [
                'methods'             => 'GET',
                'callback'            => [ $this, 'list_organizations' ],
                'permission_callback' => [ $this, 'require_admin' ],
            ],
            [
                'methods'             => 'POST',
                'callback'            => [ $this, 'create_organization' ],
                'permission_callback' => [ $this, 'require_admin' ],
            ],
        ] );

        register_rest_route( $ns, '/organizations/(?P<slug>[a-z0-9-]+)', [
            'methods'             => 'GET',
            'callback'            => [ $this, 'get_organization' ],
            'permission_callback' => [ $this, 'require_admin' ],
        ] );

        // ── Campaigns ─────────────────────────────────────────────────────

        register_rest_route( $ns, '/organizations/(?P<org_id>[a-z0-9]+)/campaigns', [
            [
                'methods'             => 'GET',
                'callback'            => [ $this, 'list_campaigns' ],
                'permission_callback' => [ $this, 'require_admin' ],
            ],
            [
                'methods'             => 'POST',
                'callback'            => [ $this, 'create_campaign' ],
                'permission_callback' => [ $this, 'require_admin' ],
            ],
        ] );

        register_rest_route( $ns, '/campaigns/(?P<id>[a-z0-9]+)', [
            'methods'             => 'GET',
            'callback'            => [ $this, 'get_campaign' ],
            'permission_callback' => [ $this, 'require_admin' ],
        ] );

        register_rest_route( $ns, '/campaigns/(?P<id>[a-z0-9]+)/status', [
            'methods'             => 'PATCH',
            'callback'            => [ $this, 'update_campaign_status' ],
            'permission_callback' => [ $this, 'require_admin' ],
        ] );

        // ── Content ───────────────────────────────────────────────────────

        register_rest_route( $ns, '/campaigns/(?P<campaign_id>[a-z0-9]+)/content', [
            [
                'methods'             => 'GET',
                'callback'            => [ $this, 'list_content' ],
                'permission_callback' => [ $this, 'require_admin' ],
            ],
            [
                'methods'             => 'POST',
                'callback'            => [ $this, 'create_content' ],
                'permission_callback' => [ $this, 'require_admin' ],
            ],
        ] );

        register_rest_route( $ns, '/content/(?P<id>[a-z0-9]+)', [
            [
                'methods'             => 'PATCH',
                'callback'            => [ $this, 'update_content' ],
                'permission_callback' => [ $this, 'require_admin' ],
            ],
            [
                'methods'             => 'DELETE',
                'callback'            => [ $this, 'delete_content' ],
                'permission_callback' => [ $this, 'require_admin' ],
            ],
        ] );

        // ── Toolkits ──────────────────────────────────────────────────────

        register_rest_route( $ns, '/campaigns/(?P<campaign_id>[a-z0-9]+)/toolkits', [
            [
                'methods'             => 'GET',
                'callback'            => [ $this, 'list_toolkits' ],
                'permission_callback' => [ $this, 'require_admin' ],
            ],
            [
                'methods'             => 'POST',
                'callback'            => [ $this, 'create_toolkit' ],
                'permission_callback' => [ $this, 'require_admin' ],
            ],
        ] );

        register_rest_route( $ns, '/toolkits/(?P<id>[a-z0-9]+)', [
            'methods'             => 'GET',
            'callback'            => [ $this, 'get_toolkit' ],
            'permission_callback' => [ $this, 'require_admin' ],
        ] );

        // ── Analytics ─────────────────────────────────────────────────────

        register_rest_route( $ns, '/analytics/toolkit/(?P<id>[a-z0-9]+)', [
            'methods'             => 'GET',
            'callback'            => [ $this, 'get_toolkit_analytics' ],
            'permission_callback' => [ $this, 'require_admin' ],
        ] );

        register_rest_route( $ns, '/analytics/campaign/(?P<id>[a-z0-9]+)', [
            'methods'             => 'GET',
            'callback'            => [ $this, 'get_campaign_analytics' ],
            'permission_callback' => [ $this, 'require_admin' ],
        ] );
    }

    // ── Permission callbacks ───────────────────────────────────────────────

    public function require_admin( WP_REST_Request $request ): bool|WP_Error {
        if ( ! current_user_can( 'manage_options' ) ) {
            return new WP_Error( 'rest_forbidden', __( 'You must be an administrator.', 'social-amplifier' ), [ 'status' => 403 ] );
        }
        return true;
    }

    // ── Public endpoints ──────────────────────────────────────────────────

    public function get_toolkit_embed( WP_REST_Request $request ): WP_REST_Response|WP_Error {
        $toolkit = $this->campaigns->get_toolkit_for_embed( $request['id'] );
        if ( ! $toolkit ) {
            return new WP_Error( 'not_found', 'Toolkit not found or inactive.', [ 'status' => 404 ] );
        }
        return rest_ensure_response( $toolkit );
    }

    public function record_share( WP_REST_Request $request ): WP_REST_Response|WP_Error {
        $body       = $request->get_json_params();
        $toolkit_id = sanitize_text_field( $body['toolkit_id'] ?? '' );
        $content_id = sanitize_text_field( $body['content_id'] ?? '' );
        $platform   = sanitize_key( $body['platform']   ?? '' );
        $method     = sanitize_key( $body['share_method'] ?? 'native' );

        if ( ! $toolkit_id || ! $content_id || ! $platform ) {
            return new WP_Error( 'bad_request', 'toolkit_id, content_id, and platform are required.', [ 'status' => 400 ] );
        }

        if ( ! in_array( $platform, SA_Platform_Registry::known_platforms(), true ) ) {
            return new WP_Error( 'bad_request', 'Unknown platform.', [ 'status' => 400 ] );
        }

        $id = $this->analytics->record_share( [
            'toolkit_id'   => $toolkit_id,
            'content_id'   => $content_id,
            'platform'     => $platform,
            'share_method' => $method,
        ] );

        return rest_ensure_response( [ 'id' => $id ] );
    }

    public function click_redirect( WP_REST_Request $request ): never {
        global $wpdb;

        $share_id = sanitize_text_field( $request['share_id'] );
        $row      = $wpdb->get_row(
            $wpdb->prepare(
                "SELECT se.toolkit_id, se.content_id, c.link_url
                 FROM {$this->campaigns->db->share_events_table()} se
                 LEFT JOIN {$this->campaigns->db->content_table()} c ON c.id = se.content_id
                 WHERE se.id = %s",
                $share_id
            ),
            ARRAY_A
        );

        // Record click regardless of whether we found the row.
        $this->analytics->record_click( [
            'share_event_id' => $share_id,
            'toolkit_id'     => $row['toolkit_id'] ?? '',
            'content_id'     => $row['content_id'] ?? null,
            'referrer'       => isset( $_SERVER['HTTP_REFERER'] ) ? sanitize_url( $_SERVER['HTTP_REFERER'] ) : null,
            'user_agent'     => isset( $_SERVER['HTTP_USER_AGENT'] ) ? sanitize_text_field( $_SERVER['HTTP_USER_AGENT'] ) : null,
            'ip'             => $_SERVER['REMOTE_ADDR'] ?? '',
        ] );

        $redirect = ( $row && ! empty( $row['link_url'] ) ) ? $row['link_url'] : home_url();
        wp_safe_redirect( esc_url_raw( $redirect ), 302 );
        exit;
    }

    // ── OAuth endpoints ───────────────────────────────────────────────────

    public function oauth_connect( WP_REST_Request $request ): WP_REST_Response|WP_Error {
        $platform_name = sanitize_key( $request['platform'] );
        $platform      = $this->platforms->get( $platform_name );

        if ( ! $platform || ! $platform->is_configured() ) {
            return new WP_Error( 'not_configured', "Platform '{$platform_name}' is not configured.", [ 'status' => 400 ] );
        }

        // Generate a cryptographically random state token.
        $state = bin2hex( random_bytes( 32 ) );

        // Store state + code_verifier (same value) in a transient (10 min TTL).
        set_transient( 'sa_oauth_state_' . $state, [
            'platform'       => $platform_name,
            'code_verifier'  => $state,
            'return_url'     => esc_url_raw( $request->get_param( 'return_url' ) ?? admin_url( 'options-general.php?page=social-amplifier' ) ),
        ], 10 * MINUTE_IN_SECONDS );

        $auth_url = $platform->get_auth_url( $state );

        // Redirect the browser to the platform's OAuth dialog.
        wp_redirect( $auth_url ); // phpcs:ignore WordPress.Security.SafeRedirect
        exit;
    }

    public function oauth_callback( WP_REST_Request $request ): WP_REST_Response|WP_Error {
        $platform_name = sanitize_key( $request['platform'] );
        $code          = sanitize_text_field( $request->get_param( 'code' )  ?? '' );
        $state         = sanitize_text_field( $request->get_param( 'state' ) ?? '' );
        $error         = $request->get_param( 'error' );

        if ( $error ) {
            return new WP_Error( 'oauth_error', sanitize_text_field( $error ), [ 'status' => 400 ] );
        }

        // Validate state token.
        $stored = get_transient( 'sa_oauth_state_' . $state );
        if ( ! $stored || $stored['platform'] !== $platform_name ) {
            return new WP_Error( 'invalid_state', 'OAuth state mismatch or expired. Please try connecting again.', [ 'status' => 400 ] );
        }
        delete_transient( 'sa_oauth_state_' . $state );

        $platform = $this->platforms->get( $platform_name );
        if ( ! $platform ) {
            return new WP_Error( 'not_configured', "Platform '{$platform_name}' is not configured.", [ 'status' => 400 ] );
        }

        try {
            $tokens = $platform->exchange_code( $code, $stored['code_verifier'] );
        } catch ( RuntimeException $e ) {
            return new WP_Error( 'token_exchange_failed', $e->getMessage(), [ 'status' => 502 ] );
        }

        // Persist connected account. Store tokens encrypted at rest.
        global $wpdb;
        $account_id = Social_Amplifier::generate_id();
        $now        = current_time( 'mysql', true );

        $wpdb->insert(
            sa()->db->supporter_accounts_table(),
            [
                'id'               => $account_id,
                'supporter_id'     => get_current_user_id() ?: 'anonymous',
                'platform'         => $platform_name,
                'platform_user_id' => $tokens['platform_user_id'] ?? null,
                'access_token'     => Social_Amplifier::encrypt( $tokens['access_token'] ),
                'refresh_token'    => isset( $tokens['refresh_token'] )
                    ? Social_Amplifier::encrypt( $tokens['refresh_token'] )
                    : null,
                'token_expires_at' => isset( $tokens['expires_at'] )
                    ? $tokens['expires_at']->format( 'Y-m-d H:i:s' )
                    : null,
                'username'         => $tokens['username'] ?? null,
                'follower_count'   => $tokens['follower_count'] ?? null,
                'connected_at'     => $now,
            ]
        );

        $return_url = add_query_arg( [
            'connected'  => $platform_name,
            'account_id' => $account_id,
        ], $stored['return_url'] );

        wp_safe_redirect( $return_url );
        exit;
    }

    // ── Organization endpoints ────────────────────────────────────────────

    public function list_organizations( WP_REST_Request $request ): WP_REST_Response {
        return rest_ensure_response( $this->campaigns->list_organizations() );
    }

    public function create_organization( WP_REST_Request $request ): WP_REST_Response|WP_Error {
        $body = $request->get_json_params();
        $name = sanitize_text_field( $body['name'] ?? '' );
        $slug = sanitize_title( $body['slug']        ?? '' );

        if ( ! $name || ! $slug ) {
            return new WP_Error( 'bad_request', 'name and slug are required.', [ 'status' => 400 ] );
        }
        if ( ! preg_match( '/^[a-z0-9-]+$/', $slug ) ) {
            return new WP_Error( 'bad_request', 'slug must contain only lowercase letters, numbers, and hyphens.', [ 'status' => 400 ] );
        }

        $org = $this->campaigns->create_organization( [
            'name'        => $name,
            'slug'        => $slug,
            'description' => $body['description'] ?? null,
        ] );

        return new WP_REST_Response( $org, 201 );
    }

    public function get_organization( WP_REST_Request $request ): WP_REST_Response|WP_Error {
        $org = $this->campaigns->get_organization_by_slug( $request['slug'] );
        if ( ! $org ) {
            return new WP_Error( 'not_found', 'Organization not found.', [ 'status' => 404 ] );
        }
        return rest_ensure_response( $org );
    }

    // ── Campaign endpoints ────────────────────────────────────────────────

    public function list_campaigns( WP_REST_Request $request ): WP_REST_Response {
        return rest_ensure_response( $this->campaigns->list_campaigns( $request['org_id'] ) );
    }

    public function create_campaign( WP_REST_Request $request ): WP_REST_Response|WP_Error {
        $body = $request->get_json_params();
        $name = sanitize_text_field( $body['name'] ?? '' );
        $slug = sanitize_title( $body['slug']       ?? '' );

        if ( ! $name || ! $slug ) {
            return new WP_Error( 'bad_request', 'name and slug are required.', [ 'status' => 400 ] );
        }

        $campaign = $this->campaigns->create_campaign( [
            'org_id'      => $request['org_id'],
            'name'        => $name,
            'slug'        => $slug,
            'description' => $body['description'] ?? null,
            'status'      => $body['status']      ?? 'draft',
            'starts_at'   => $body['starts_at']   ?? null,
            'ends_at'     => $body['ends_at']     ?? null,
        ] );

        return new WP_REST_Response( $campaign, 201 );
    }

    public function get_campaign( WP_REST_Request $request ): WP_REST_Response|WP_Error {
        $campaign = $this->campaigns->get_campaign( $request['id'] );
        if ( ! $campaign ) {
            return new WP_Error( 'not_found', 'Campaign not found.', [ 'status' => 404 ] );
        }
        return rest_ensure_response( $campaign );
    }

    public function update_campaign_status( WP_REST_Request $request ): WP_REST_Response|WP_Error {
        $body   = $request->get_json_params();
        $status = sanitize_key( $body['status'] ?? '' );
        $valid  = [ 'draft', 'active', 'paused', 'ended' ];

        if ( ! in_array( $status, $valid, true ) ) {
            return new WP_Error( 'bad_request', 'status must be one of: ' . implode( ', ', $valid ), [ 'status' => 400 ] );
        }

        $this->campaigns->update_campaign_status( $request['id'], $status );
        return rest_ensure_response( [ 'ok' => true ] );
    }

    // ── Content endpoints ─────────────────────────────────────────────────

    public function list_content( WP_REST_Request $request ): WP_REST_Response {
        return rest_ensure_response( $this->campaigns->list_content( $request['campaign_id'] ) );
    }

    public function create_content( WP_REST_Request $request ): WP_REST_Response|WP_Error {
        $body  = $request->get_json_params();
        $title = sanitize_text_field( $body['title'] ?? '' );
        if ( ! $title ) {
            return new WP_Error( 'bad_request', 'title is required.', [ 'status' => 400 ] );
        }

        $item = $this->campaigns->create_content( [
            'campaign_id'       => $request['campaign_id'],
            'type'              => $body['type']  ?? 'text',
            'title'             => $title,
            'body'              => $body['body']       ?? null,
            'media_url'         => $body['media_url']  ?? null,
            'link_url'          => $body['link_url']   ?? null,
            'platform_variants' => $body['platform_variants'] ?? null,
        ] );

        return new WP_REST_Response( $item, 201 );
    }

    public function update_content( WP_REST_Request $request ): WP_REST_Response|WP_Error {
        $body = $request->get_json_params();
        $this->campaigns->update_content( $request['id'], $body );
        $item = $this->campaigns->get_content( $request['id'] );
        if ( ! $item ) {
            return new WP_Error( 'not_found', 'Content not found.', [ 'status' => 404 ] );
        }
        return rest_ensure_response( $item );
    }

    public function delete_content( WP_REST_Request $request ): WP_REST_Response {
        $this->campaigns->delete_content( $request['id'] );
        return rest_ensure_response( [ 'ok' => true ] );
    }

    // ── Toolkit endpoints ─────────────────────────────────────────────────

    public function list_toolkits( WP_REST_Request $request ): WP_REST_Response {
        return rest_ensure_response( $this->campaigns->list_toolkits( $request['campaign_id'] ) );
    }

    public function create_toolkit( WP_REST_Request $request ): WP_REST_Response|WP_Error {
        $body = $request->get_json_params();
        $name = sanitize_text_field( $body['name'] ?? '' );
        $slug = sanitize_title( $body['slug']       ?? '' );

        if ( ! $name || ! $slug ) {
            return new WP_Error( 'bad_request', 'name and slug are required.', [ 'status' => 400 ] );
        }

        $toolkit = $this->campaigns->create_toolkit( array_merge( $body, [
            'campaign_id' => $request['campaign_id'],
            'name'        => $name,
            'slug'        => $slug,
        ] ) );

        return new WP_REST_Response( $toolkit, 201 );
    }

    public function get_toolkit( WP_REST_Request $request ): WP_REST_Response|WP_Error {
        $toolkit = $this->campaigns->get_toolkit( $request['id'] );
        if ( ! $toolkit ) {
            return new WP_Error( 'not_found', 'Toolkit not found.', [ 'status' => 404 ] );
        }
        return rest_ensure_response( $toolkit );
    }

    // ── Analytics endpoints ───────────────────────────────────────────────

    public function get_toolkit_analytics( WP_REST_Request $request ): WP_REST_Response {
        $period = min( 365, max( 1, (int) ( $request->get_param( 'period' ) ?? 30 ) ) );
        return rest_ensure_response( $this->analytics->get_toolkit_summary( $request['id'], (string) $period ) );
    }

    public function get_campaign_analytics( WP_REST_Request $request ): WP_REST_Response {
        $period = min( 365, max( 1, (int) ( $request->get_param( 'period' ) ?? 30 ) ) );
        return rest_ensure_response( $this->analytics->get_campaign_summary( $request['id'], (string) $period ) );
    }
}

/**
 * Helper to access the global plugin instance.
 */
function sa(): Social_Amplifier {
    return Social_Amplifier::instance();
}
