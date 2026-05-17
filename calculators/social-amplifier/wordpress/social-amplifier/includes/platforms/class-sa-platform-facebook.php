<?php

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/**
 * Facebook Graph API v19 integration.
 */
class SA_Platform_Facebook extends SA_Platform_Base {

    private string $app_id;
    private string $app_secret;
    private string $redirect_uri;

    public function __construct( string $app_id, string $app_secret, string $redirect_uri ) {
        $this->app_id       = $app_id;
        $this->app_secret   = $app_secret;
        $this->redirect_uri = $redirect_uri;
    }

    public function name(): string       { return 'facebook'; }
    public function label(): string      { return 'Facebook'; }
    public function char_limit(): int    { return 63206; }
    public function is_configured(): bool { return ! empty( $this->app_id ) && ! empty( $this->app_secret ); }

    public function get_auth_url( string $state ): string {
        $params = http_build_query( [
            'client_id'    => $this->app_id,
            'redirect_uri' => $this->redirect_uri,
            'state'        => $state,
            'scope'        => 'pages_manage_posts,pages_read_engagement,public_profile',
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
        ], 'https://graph.facebook.com/v19.0/oauth/access_token' ) );

        $profile = $this->get_profile( $data['access_token'] );

        return [
            'access_token'     => $data['access_token'],
            'refresh_token'    => null,
            'expires_at'       => isset( $data['expires_in'] )
                ? ( new DateTime() )->modify( '+' . (int) $data['expires_in'] . ' seconds' )
                : null,
            'platform_user_id' => $profile['id'],
            'username'         => $profile['username'],
            'follower_count'   => 0,
        ];
    }

    public function refresh_token( string $refresh_token ): array {
        // Facebook uses long-lived tokens; exchange short-lived for long-lived.
        $data = $this->get_json( add_query_arg( [
            'grant_type'       => 'fb_exchange_token',
            'client_id'        => $this->app_id,
            'client_secret'    => $this->app_secret,
            'fb_exchange_token' => $refresh_token,
        ], 'https://graph.facebook.com/v19.0/oauth/access_token' ) );

        return [
            'access_token'  => $data['access_token'],
            'refresh_token' => null,
            'expires_at'    => isset( $data['expires_in'] )
                ? ( new DateTime() )->modify( '+' . (int) $data['expires_in'] . ' seconds' )
                : null,
        ];
    }

    public function publish_post( string $access_token, string $text, array $options = [] ): array {
        $body = [ 'message' => $text ];
        if ( ! empty( $options['link_url'] ) ) {
            $body['link'] = $options['link_url'];
        }

        $data = $this->post_json(
            'https://graph.facebook.com/v19.0/me/feed',
            $body,
            [ 'Authorization' => "Bearer {$access_token}" ]
        );

        return [
            'post_id' => $data['id'],
            'url'     => "https://www.facebook.com/{$data['id']}",
        ];
    }

    public function get_share_url( string $text, string $url = '' ): string {
        $params = [];
        if ( $url )  $params['u']     = $url;
        if ( $text ) $params['quote'] = $text;
        return 'https://www.facebook.com/sharer/sharer.php?' . http_build_query( $params );
    }

    private function get_profile( string $access_token ): array {
        $data = $this->get_json( add_query_arg( [
            'fields'       => 'id,name,picture',
            'access_token' => $access_token,
        ], 'https://graph.facebook.com/v19.0/me' ) );

        return [
            'id'       => $data['id'],
            'username' => $data['name'],
        ];
    }
}
