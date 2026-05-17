<?php

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/**
 * Instagram Graph API integration (via Meta).
 *
 * Requires a Business or Creator account linked to a Facebook Page.
 * Auth flow is identical to Facebook (same Facebook OAuth dialog).
 */
class SA_Platform_Instagram extends SA_Platform_Base {

    private string $app_id;
    private string $app_secret;
    private string $redirect_uri;

    public function __construct( string $app_id, string $app_secret, string $redirect_uri ) {
        $this->app_id       = $app_id;
        $this->app_secret   = $app_secret;
        $this->redirect_uri = $redirect_uri;
    }

    public function name(): string       { return 'instagram'; }
    public function label(): string      { return 'Instagram'; }
    public function char_limit(): int    { return 2200; }
    public function is_configured(): bool { return ! empty( $this->app_id ) && ! empty( $this->app_secret ); }

    public function get_auth_url( string $state ): string {
        $params = http_build_query( [
            'client_id'     => $this->app_id,
            'redirect_uri'  => $this->redirect_uri,
            'state'         => $state,
            'scope'         => 'instagram_basic,instagram_content_publish,pages_show_list',
            'response_type' => 'code',
        ] );
        return "https://www.facebook.com/v19.0/dialog/oauth?{$params}";
    }

    public function exchange_code( string $code, string $code_verifier = '' ): array {
        $data = $this->get_json( add_query_arg( [
            'client_id'     => $this->app_id,
            'client_secret' => $this->app_secret,
            'redirect_uri'  => $this->redirect_uri,
            'code'          => $code,
            'grant_type'    => 'authorization_code',
        ], 'https://graph.facebook.com/v19.0/oauth/access_token' ) );

        return [
            'access_token'     => $data['access_token'],
            'refresh_token'    => null,
            'expires_at'       => isset( $data['expires_in'] )
                ? ( new DateTime() )->modify( '+' . (int) $data['expires_in'] . ' seconds' )
                : null,
            'platform_user_id' => null,
            'username'         => null,
            'follower_count'   => 0,
        ];
    }

    public function refresh_token( string $refresh_token ): array {
        $data = $this->get_json( add_query_arg( [
            'grant_type'   => 'ig_refresh_token',
            'access_token' => $refresh_token,
        ], 'https://graph.instagram.com/refresh_access_token' ) );

        return [
            'access_token'  => $data['access_token'],
            'refresh_token' => null,
            'expires_at'    => isset( $data['expires_in'] )
                ? ( new DateTime() )->modify( '+' . (int) $data['expires_in'] . ' seconds' )
                : null,
        ];
    }

    public function publish_post( string $access_token, string $text, array $options = [] ): array {
        if ( empty( $options['media_url'] ) ) {
            throw new RuntimeException( 'Instagram requires an image or video URL to publish.' );
        }

        // Resolve the IG Business Account ID via the linked Facebook Page.
        $accounts  = $this->get_json( add_query_arg( [ 'access_token' => $access_token ], 'https://graph.facebook.com/v19.0/me/accounts' ) );
        $page_id   = $accounts['data'][0]['id'] ?? null;
        if ( ! $page_id ) {
            throw new RuntimeException( 'No Facebook Page found for Instagram publishing.' );
        }

        $ig_data      = $this->get_json( add_query_arg( [
            'fields'       => 'instagram_business_account',
            'access_token' => $access_token,
        ], "https://graph.facebook.com/v19.0/{$page_id}" ) );
        $ig_account_id = $ig_data['instagram_business_account']['id'] ?? null;
        if ( ! $ig_account_id ) {
            throw new RuntimeException( 'No Instagram Business account linked to this Facebook Page.' );
        }

        // Create media container.
        $container = $this->post_json(
            "https://graph.facebook.com/v19.0/{$ig_account_id}/media",
            [
                'caption'     => $text,
                'image_url'   => $options['media_url'],
                'access_token' => $access_token,
            ]
        );

        // Publish the container.
        $publish = $this->post_json(
            "https://graph.facebook.com/v19.0/{$ig_account_id}/media_publish",
            [
                'creation_id'  => $container['id'],
                'access_token' => $access_token,
            ]
        );

        return [
            'post_id' => $publish['id'],
            'url'     => "https://www.instagram.com/p/{$publish['id']}/",
        ];
    }

    public function get_share_url( string $text, string $url = '' ): string {
        // Instagram has no web share dialog. The embed widget handles this by
        // copying text to clipboard and showing a toast.
        return '';
    }
}
