<?php

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/**
 * Instantiates and provides access to all configured social platform integrations.
 * Credentials are read from WordPress options set on the admin settings page.
 */
class SA_Platform_Registry {

    /** @var SA_Platform_Base[] */
    private array $platforms = [];

    public function __construct() {
        $opts = get_option( 'sa_platform_credentials', [] );

        $base = rest_url( SA_REST_NAMESPACE );

        if ( ! empty( $opts['facebook_app_id'] ) ) {
            $this->platforms['facebook'] = new SA_Platform_Facebook(
                $opts['facebook_app_id'],
                $opts['facebook_app_secret'] ?? '',
                $base . '/auth/facebook/callback'
            );
        }

        if ( ! empty( $opts['instagram_app_id'] ) ) {
            $this->platforms['instagram'] = new SA_Platform_Instagram(
                $opts['instagram_app_id'],
                $opts['instagram_app_secret'] ?? '',
                $base . '/auth/instagram/callback'
            );
        }

        if ( ! empty( $opts['x_client_id'] ) ) {
            $this->platforms['x'] = new SA_Platform_X(
                $opts['x_client_id'],
                $opts['x_client_secret'] ?? '',
                $base . '/auth/x/callback'
            );
        }

        if ( ! empty( $opts['tiktok_client_key'] ) ) {
            $this->platforms['tiktok'] = new SA_Platform_TikTok(
                $opts['tiktok_client_key'],
                $opts['tiktok_client_secret'] ?? '',
                $base . '/auth/tiktok/callback'
            );
        }
    }

    public function get( string $name ): ?SA_Platform_Base {
        return $this->platforms[ $name ] ?? null;
    }

    /** @return SA_Platform_Base[] */
    public function all(): array {
        return $this->platforms;
    }

    /** Return only configured platforms. */
    public function configured(): array {
        return array_filter( $this->platforms, fn( $p ) => $p->is_configured() );
    }

    public function is_registered( string $name ): bool {
        return isset( $this->platforms[ $name ] );
    }

    /**
     * Return the list of all known platform names regardless of configuration.
     */
    public static function known_platforms(): array {
        return [ 'facebook', 'instagram', 'x', 'tiktok' ];
    }
}
