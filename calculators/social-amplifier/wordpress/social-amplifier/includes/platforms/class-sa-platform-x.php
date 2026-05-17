<?php

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/**
 * X (Twitter) API v2 integration with OAuth 2.0 PKCE.
 */
class SA_Platform_X extends SA_Platform_Base {

    private string $client_id;
    private string $client_secret;
    private string $redirect_uri;

    public function __construct( string $client_id, string $client_secret, string $redirect_uri ) {
        $this->client_id     = $client_id;
        $this->client_secret = $client_secret;
        $this->redirect_uri  = $redirect_uri;
    }

    public function name(): string       { return 'x'; }
    public function label(): string      { return 'X (Twitter)'; }
    public function char_limit(): int    { return 280; }
    public function is_configured(): bool { return ! empty( $this->client_id ) && ! empty( $this->client_secret ); }

    /**
     * Build the OAuth 2.0 PKCE authorization URL.
     * The $state value is also used as the code_challenge (plain method).
     * The caller must store the state/verifier in a transient.
     */
    public function get_auth_url( string $state ): string {
        // PKCE: derive a proper S256 challenge from the verifier.
        $code_verifier  = $state; // verifier == state token stored by auth endpoint
        $code_challenge = rtrim( strtr( base64_encode( hash( 'sha256', $code_verifier, true ) ), '+/', '-_' ), '=' );

        $params = http_build_query( [
            'response_type'         => 'code',
            'client_id'             => $this->client_id,
            'redirect_uri'          => $this->redirect_uri,
            'scope'                 => 'tweet.read tweet.write users.read offline.access',
            'state'                 => $state,
            'code_challenge'        => $code_challenge,
            'code_challenge_method' => 'S256',
        ] );
        return "https://twitter.com/i/oauth2/authorize?{$params}";
    }

    public function exchange_code( string $code, string $code_verifier = '' ): array {
        $data = $this->post_form(
            'https://api.twitter.com/2/oauth2/token',
            [
                'code'          => $code,
                'grant_type'    => 'authorization_code',
                'redirect_uri'  => $this->redirect_uri,
                'code_verifier' => $code_verifier,
            ],
            [ 'Authorization' => 'Basic ' . base64_encode( "{$this->client_id}:{$this->client_secret}" ) ]
        );

        $profile = $this->get_profile( $data['access_token'] );

        return [
            'access_token'     => $data['access_token'],
            'refresh_token'    => $data['refresh_token'] ?? null,
            'expires_at'       => isset( $data['expires_in'] )
                ? ( new DateTime() )->modify( '+' . (int) $data['expires_in'] . ' seconds' )
                : null,
            'platform_user_id' => $profile['id'],
            'username'         => $profile['username'],
            'follower_count'   => $profile['follower_count'] ?? 0,
        ];
    }

    public function refresh_token( string $refresh_token ): array {
        $data = $this->post_form(
            'https://api.twitter.com/2/oauth2/token',
            [
                'refresh_token' => $refresh_token,
                'grant_type'    => 'refresh_token',
            ],
            [ 'Authorization' => 'Basic ' . base64_encode( "{$this->client_id}:{$this->client_secret}" ) ]
        );

        return [
            'access_token'  => $data['access_token'],
            'refresh_token' => $data['refresh_token'] ?? null,
            'expires_at'    => isset( $data['expires_in'] )
                ? ( new DateTime() )->modify( '+' . (int) $data['expires_in'] . ' seconds' )
                : null,
        ];
    }

    public function publish_post( string $access_token, string $text, array $options = [] ): array {
        $data = $this->post_json(
            'https://api.twitter.com/2/tweets',
            [ 'text' => $text ],
            [ 'Authorization' => "Bearer {$access_token}" ]
        );

        $id = $data['data']['id'];
        return [
            'post_id' => $id,
            'url'     => "https://x.com/i/status/{$id}",
        ];
    }

    public function get_share_url( string $text, string $url = '' ): string {
        $full = $url ? "{$text} {$url}" : $text;
        return 'https://twitter.com/intent/tweet?text=' . rawurlencode( $full );
    }

    private function get_profile( string $access_token ): array {
        $data = $this->get_json(
            'https://api.twitter.com/2/users/me?user.fields=profile_image_url,public_metrics',
            [ 'Authorization' => "Bearer {$access_token}" ]
        );

        return [
            'id'             => $data['data']['id'],
            'username'       => $data['data']['username'],
            'follower_count' => $data['data']['public_metrics']['followers_count'] ?? 0,
        ];
    }
}
