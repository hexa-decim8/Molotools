<?php

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/**
 * Contract that all social platform integrations must satisfy.
 */
abstract class SA_Platform_Base {

    abstract public function name(): string;
    abstract public function label(): string;
    abstract public function char_limit(): int;
    abstract public function is_configured(): bool;

    /**
     * Build the OAuth authorization URL to redirect the user to.
     */
    abstract public function get_auth_url( string $state ): string;

    /**
     * Exchange an authorization code for access/refresh tokens.
     * Returns an array with keys: access_token, refresh_token (optional),
     * expires_at (optional DateTime), platform_user_id, username.
     *
     * @throws RuntimeException on failure.
     */
    abstract public function exchange_code( string $code, string $code_verifier = '' ): array;

    /**
     * Refresh an expired access token.
     * Returns the same shape as exchange_code().
     *
     * @throws RuntimeException on failure.
     */
    abstract public function refresh_token( string $refresh_token ): array;

    /**
     * Publish a post on behalf of the user.
     * Returns [ 'post_id' => string, 'url' => string ].
     *
     * @param string $access_token
     * @param string $text
     * @param array  $options  Optional: media_url, link_url
     * @throws RuntimeException on failure.
     */
    abstract public function publish_post( string $access_token, string $text, array $options = [] ): array;

    /**
     * Return the native web share URL for this platform.
     * Used by the embed widget to open a share dialog.
     */
    abstract public function get_share_url( string $text, string $url = '' ): string;

    // ── Shared helpers ─────────────────────────────────────────────────────

    /**
     * Perform a remote GET request and decode JSON.
     * Throws RuntimeException on HTTP error.
     */
    protected function get_json( string $url, array $headers = [] ): array {
        $response = wp_remote_get( $url, [
            'headers' => $headers,
            'timeout' => 15,
        ] );
        return $this->parse_response( $response );
    }

    /**
     * Perform a remote POST request and decode JSON.
     * Throws RuntimeException on HTTP error.
     */
    protected function post_json( string $url, array $body, array $headers = [] ): array {
        $response = wp_remote_post( $url, [
            'headers' => array_merge( [ 'Content-Type' => 'application/json' ], $headers ),
            'body'    => wp_json_encode( $body ),
            'timeout' => 15,
        ] );
        return $this->parse_response( $response );
    }

    /**
     * Perform a remote POST request with URL-encoded form body and decode JSON.
     */
    protected function post_form( string $url, array $body, array $headers = [] ): array {
        $response = wp_remote_post( $url, [
            'headers' => array_merge( [ 'Content-Type' => 'application/x-www-form-urlencoded' ], $headers ),
            'body'    => $body,
            'timeout' => 15,
        ] );
        return $this->parse_response( $response );
    }

    /**
     * Parse a WP_HTTP response, decode JSON, throw on error.
     */
    private function parse_response( $response ): array {
        if ( is_wp_error( $response ) ) {
            throw new RuntimeException( $response->get_error_message() );
        }
        $code = wp_remote_retrieve_response_code( $response );
        $body = wp_remote_retrieve_body( $response );
        $data = json_decode( $body, true ) ?? [];

        if ( $code < 200 || $code >= 300 ) {
            $message = $data['error']['message']
                ?? $data['error_description']
                ?? $data['error']
                ?? "HTTP {$code}";
            throw new RuntimeException( (string) $message );
        }
        return $data;
    }
}
