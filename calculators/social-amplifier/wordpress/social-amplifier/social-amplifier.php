<?php
/**
 * Plugin Name: Social Amplifier
 * Plugin URI:  https://github.com/hexa-decim8/Molotools
 * Description: Embeddable social sharing toolkit for political campaigns. Create campaigns, bundle content into shareable toolkits, and embed them anywhere. Embed with [social_amplifier_toolkit id="..."].
 * Version:     1.0.0
 * Author:      Molotools
 * License:     GPL v2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: social-amplifier
 * Requires:    5.9
 * Requires PHP: 8.0
 * Tested up to: 6.6
 * GitHub Plugin URI: hexa-decim8/Molotools
 * GitHub Branch:     main
 * Primary Branch:    main
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

define( 'SA_VERSION',        '1.0.0' );
define( 'SA_PLUGIN_BASENAME', plugin_basename( __FILE__ ) );
define( 'SA_PLUGIN_DIR',      plugin_dir_path( __FILE__ ) );
define( 'SA_PLUGIN_URL',      plugin_dir_url( __FILE__ ) );
define( 'SA_REST_NAMESPACE',  'social-amplifier/v1' );
define( 'SA_GITHUB_REPO',     'hexa-decim8/Molotools' );
define( 'SA_RELEASE_ASSET',   'social-amplifier.zip' );

// Autoload includes.
require_once SA_PLUGIN_DIR . 'includes/class-sa-database.php';
require_once SA_PLUGIN_DIR . 'includes/class-sa-platform-base.php';
require_once SA_PLUGIN_DIR . 'includes/platforms/class-sa-platform-facebook.php';
require_once SA_PLUGIN_DIR . 'includes/platforms/class-sa-platform-instagram.php';
require_once SA_PLUGIN_DIR . 'includes/platforms/class-sa-platform-x.php';
require_once SA_PLUGIN_DIR . 'includes/platforms/class-sa-platform-tiktok.php';
require_once SA_PLUGIN_DIR . 'includes/class-sa-platform-registry.php';
require_once SA_PLUGIN_DIR . 'includes/class-sa-campaigns.php';
require_once SA_PLUGIN_DIR . 'includes/class-sa-analytics.php';
require_once SA_PLUGIN_DIR . 'includes/class-sa-rest-api.php';
require_once SA_PLUGIN_DIR . 'includes/class-sa-shortcode.php';

if ( is_admin() ) {
    require_once SA_PLUGIN_DIR . 'admin/class-sa-admin.php';
}

/**
 * Main plugin bootstrap class.
 */
final class Social_Amplifier {

    private static ?Social_Amplifier $instance = null;

    public SA_Database         $db;
    public SA_Platform_Registry $platforms;
    public SA_Campaigns        $campaigns;
    public SA_Analytics        $analytics;
    public SA_REST_API         $rest;
    public SA_Shortcode        $shortcode;

    public static function instance(): self {
        if ( null === self::$instance ) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        $this->db        = new SA_Database();
        $this->platforms = new SA_Platform_Registry();
        $this->campaigns = new SA_Campaigns( $this->db );
        $this->analytics = new SA_Analytics( $this->db );
        $this->rest      = new SA_REST_API( $this->campaigns, $this->analytics, $this->platforms );
        $this->shortcode = new SA_Shortcode();

        if ( is_admin() ) {
            new SA_Admin( $this->campaigns, $this->analytics );
        }

        add_action( 'rest_api_init',     [ $this->rest,      'register_routes' ] );
        add_action( 'wp_enqueue_scripts', [ $this->shortcode, 'maybe_enqueue_assets' ] );
    }

    /**
     * Derive a stable 32-byte encryption key from WordPress secrets.
     * Falls back to AUTH_KEY → a site-specific constant if not defined.
     */
    public static function encryption_key(): string {
        $seed = defined( 'AUTH_KEY' ) ? AUTH_KEY : 'sa-fallback-key-' . get_bloginfo( 'url' );
        return hash( 'sha256', $seed, true );
    }

    /**
     * Encrypt a token for storage. Uses AES-256-CBC.
     */
    public static function encrypt( string $plaintext ): string {
        $key  = self::encryption_key();
        $iv   = random_bytes( 16 );
        $ct   = openssl_encrypt( $plaintext, 'AES-256-CBC', $key, OPENSSL_RAW_DATA, $iv );
        return base64_encode( $iv . $ct );
    }

    /**
     * Decrypt a stored token.
     */
    public static function decrypt( string $ciphertext ): string {
        $key  = self::encryption_key();
        $raw  = base64_decode( $ciphertext );
        $iv   = substr( $raw, 0, 16 );
        $ct   = substr( $raw, 16 );
        return openssl_decrypt( $ct, 'AES-256-CBC', $key, OPENSSL_RAW_DATA, $iv );
    }

    /**
     * Generate a URL-safe unique ID.
     */
    public static function generate_id(): string {
        return bin2hex( random_bytes( 12 ) );
    }

    /**
     * Hash an IP address for privacy-conscious analytics.
     */
    public static function hash_ip( string $ip ): string {
        return substr( hash( 'sha256', $ip . ( AUTH_SALT ?? '' ) ), 0, 16 );
    }
}

// ── Activation / Deactivation ──────────────────────────────────────────────

register_activation_hook( __FILE__, function () {
    $db = new SA_Database();
    $db->maybe_run_migrations();
    flush_rewrite_rules();
} );

register_deactivation_hook( __FILE__, function () {
    flush_rewrite_rules();
} );

// ── Boot ───────────────────────────────────────────────────────────────────

add_action( 'plugins_loaded', function () {
    Social_Amplifier::instance();
} );
