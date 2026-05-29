<?php
/**
 * Plugin Name: Abdulify Me
 * Plugin URI:  https://github.com/hexa-decim8/Molotools
 * Description: Upload a photo, add lightweight Abdul El-Sayed support overlays, and download the result directly in the browser. Embed with [abdulify_me].
 * Version:     0.1.12
 * Author:      Molotools
 * License:     GPL v2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: abdulify-me
 * Requires:    5.0
 * Requires PHP: 7.4
 * Tested up to: 6.6
 * GitHub Plugin URI: hexa-decim8/Molotools
 * GitHub Branch:     main
 * Primary Branch:    main
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

define( 'ABDULIFY_ME_VERSION', '0.1.12' );
define( 'ABDULIFY_ME_PLUGIN_BASENAME', 'abdulify-me/abdulify-me.php' );
define( 'ABDULIFY_ME_GITHUB_REPO', 'hexa-decim8/Molotools' );
define( 'ABDULIFY_ME_RELEASE_ASSET', 'abdulify-me.zip' );
define( 'ABDULIFY_ME_CACHE_TTL', 5 * MINUTE_IN_SECONDS );
define( 'ABDULIFY_ME_UPDATE_ERROR_TTL', 5 * MINUTE_IN_SECONDS );
define( 'ABDULIFY_ME_UPDATE_CRON_HOOK', 'am_run_scheduled_update_check' );
define( 'ABDULIFY_ME_UPDATE_CRON_SCHEDULE', 'am_every_five_minutes' );
define( 'ABDULIFY_ME_AUTO_INSTALL_LOCK_TTL', 5 * MINUTE_IN_SECONDS );

class AM_GitHub_Updater {

    private $slug;
    private $repo;
    private $version;
    private $cache_key;
    private $cache_ttl = ABDULIFY_ME_CACHE_TTL;

    public function __construct( $slug, $repo, $version ) {
        $this->slug      = $slug;
        $this->repo      = $repo;
        $this->version   = $version;
        $this->cache_key = 'am_github_update_' . md5( $slug );

        add_filter( 'pre_set_site_transient_update_plugins', array( $this, 'check_for_update' ) );
        add_filter( 'plugins_api', array( $this, 'plugin_info' ), 10, 3 );
        add_filter( 'upgrader_source_selection', array( $this, 'fix_folder_name' ), 10, 4 );
        add_filter( 'auto_update_plugin', array( $this, 'enable_auto_updates' ), 10, 2 );
        add_action( ABDULIFY_ME_UPDATE_CRON_HOOK, array( $this, 'run_scheduled_update' ) );
        add_action( 'init', array( $this, 'ensure_schedule' ) );
    }

    private function log_error( $message ) {
        update_option( 'am_updater_last_error', $message, false );
        error_log( '[Abdulify Me Updater] ' . $message );
    }

    private function clear_last_error() {
        delete_option( 'am_updater_last_error' );
    }

    private function record_successful_check() {
        update_option( 'am_updater_last_check', time(), false );
        $this->clear_last_error();
    }

    public function ensure_schedule() {
        if ( ! wp_next_scheduled( ABDULIFY_ME_UPDATE_CRON_HOOK ) ) {
            if ( ! wp_schedule_event( time() + ABDULIFY_ME_CACHE_TTL, ABDULIFY_ME_UPDATE_CRON_SCHEDULE, ABDULIFY_ME_UPDATE_CRON_HOOK ) ) {
                $this->log_error( 'Unable to schedule the recurring 5-minute update check.' );
            }
        }
    }

    public function clear_cached_release() {
        delete_transient( $this->cache_key );
    }

    private function normalize_version_from_tag( $tag_name ) {
        if ( ! is_string( $tag_name ) ) {
            return null;
        }

        $tag_name = trim( $tag_name );

        if ( preg_match( '/^(?:am-)?v?(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)$/', $tag_name, $matches ) ) {
            return $matches[1];
        }

        if ( preg_match( '/^(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)$/', $tag_name, $matches ) ) {
            return $matches[1];
        }

        return null;
    }

    private function get_release( $force = false ) {
        $cached = $force ? false : get_transient( $this->cache_key );
        if ( $cached !== false ) {
            return $cached;
        }

        $url      = 'https://api.github.com/repos/' . $this->repo . '/releases/latest';
        $response = wp_remote_get(
            $url,
            array(
                'headers' => array(
                    'Accept' => 'application/vnd.github.v3+json',
                    'User-Agent' => 'WordPress/' . get_bloginfo( 'version' ),
                ),
                'timeout' => 10,
            )
        );

        if ( is_wp_error( $response ) || wp_remote_retrieve_response_code( $response ) !== 200 ) {
            $message = is_wp_error( $response )
                ? $response->get_error_message()
                : 'GitHub API returned HTTP ' . wp_remote_retrieve_response_code( $response );

            $this->log_error( 'Release check failed: ' . $message );
            set_transient( $this->cache_key, null, ABDULIFY_ME_UPDATE_ERROR_TTL );
            return null;
        }

        $release = json_decode( wp_remote_retrieve_body( $response ) );
        if ( ! is_object( $release ) || empty( $release->tag_name ) ) {
            $this->log_error( 'GitHub release payload was invalid or missing tag_name.' );
            set_transient( $this->cache_key, null, ABDULIFY_ME_UPDATE_ERROR_TTL );
            return null;
        }

        if ( ! $this->normalize_version_from_tag( $release->tag_name ) ) {
            $this->log_error( 'Latest GitHub release tag is not a recognized version: ' . $release->tag_name );
            set_transient( $this->cache_key, null, ABDULIFY_ME_UPDATE_ERROR_TTL );
            return null;
        }

        set_transient( $this->cache_key, $release, $this->cache_ttl );
        $this->record_successful_check();
        return $release;
    }

    private function get_remote_version( $release ) {
        if ( ! is_object( $release ) || empty( $release->tag_name ) ) {
            return null;
        }

        return $this->normalize_version_from_tag( $release->tag_name );
    }

    private function build_plugin_update_item( $remote_version, $asset_url ) {
        return (object) array(
            'slug' => dirname( $this->slug ),
            'plugin' => $this->slug,
            'new_version' => $remote_version,
            'url' => 'https://github.com/' . $this->repo,
            'package' => $asset_url,
            'tested' => '',
            'requires_php' => '7.4',
            'icons' => array(),
            'banners' => array(),
        );
    }

    private function get_asset_url( $release ) {
        if ( empty( $release->assets ) ) {
            $this->log_error( 'Latest GitHub release is missing assets.' );
            return null;
        }

        foreach ( $release->assets as $asset ) {
            if ( $asset->name === ABDULIFY_ME_RELEASE_ASSET ) {
                return $asset->browser_download_url;
            }
        }

        $this->log_error( 'Latest GitHub release is missing the required ' . ABDULIFY_ME_RELEASE_ASSET . ' asset.' );
        return null;
    }

    public function refresh_update_data( $force = false ) {
        require_once ABSPATH . 'wp-includes/update.php';

        if ( $force ) {
            $this->clear_cached_release();
            delete_site_transient( 'update_plugins' );
            if ( ! function_exists( 'wp_clean_plugins_cache' ) ) {
                require_once ABSPATH . 'wp-admin/includes/plugin.php';
            }
            wp_clean_plugins_cache( true );
        }

        wp_update_plugins();

        return get_site_transient( 'update_plugins' );
    }

    private function maybe_install_update( $transient ) {
        if ( ! isset( $transient->response[ $this->slug ] ) ) {
            return;
        }

        $lock_key = 'am_updater_install_lock';
        if ( get_transient( $lock_key ) ) {
            return;
        }

        if ( ! function_exists( 'wp_clean_plugins_cache' ) ) {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
        }
        require_once ABSPATH . 'wp-admin/includes/file.php';
        require_once ABSPATH . 'wp-admin/includes/misc.php';
        require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';

        set_transient( $lock_key, 1, ABDULIFY_ME_AUTO_INSTALL_LOCK_TTL );

        $upgrader = new Plugin_Upgrader( new Automatic_Upgrader_Skin() );
        $result   = $upgrader->upgrade( $this->slug );

        delete_transient( $lock_key );

        if ( is_wp_error( $result ) ) {
            $this->log_error( 'Automatic update failed: ' . $result->get_error_message() );
            return;
        }

        if ( ! $result ) {
            $this->log_error( 'Automatic update returned an empty result.' );
            return;
        }

        $this->clear_cached_release();
        delete_site_transient( 'update_plugins' );
        wp_clean_plugins_cache( true );
    }

    public function run_scheduled_update() {
        $transient = $this->refresh_update_data( true );
        if ( ! is_object( $transient ) ) {
            $this->log_error( 'Scheduled update check did not produce a valid plugin update transient.' );
            return;
        }

        $this->maybe_install_update( $transient );
    }

    public function check_for_update( $transient ) {
        if ( empty( $transient->checked ) ) {
            return $transient;
        }

        $release = $this->get_release();
        if ( ! $release ) {
            return $transient;
        }

        $remote_version = $this->get_remote_version( $release );
        $asset_url      = $this->get_asset_url( $release );

        if ( ! $remote_version || ! $asset_url ) {
            return $transient;
        }

        if ( ! isset( $transient->response ) || ! is_array( $transient->response ) ) {
            $transient->response = array();
        }
        if ( ! isset( $transient->no_update ) || ! is_array( $transient->no_update ) ) {
            $transient->no_update = array();
        }

        if ( version_compare( $this->version, $remote_version, '<' ) ) {
            $transient->response[ $this->slug ] = $this->build_plugin_update_item( $remote_version, $asset_url );
            unset( $transient->no_update[ $this->slug ] );
        } else {
            $transient->no_update[ $this->slug ] = $this->build_plugin_update_item( $remote_version, $asset_url );
            unset( $transient->response[ $this->slug ] );
        }

        return $transient;
    }

    public function plugin_info( $result, $action, $args ) {
        if ( $action !== 'plugin_information' ) {
            return $result;
        }
        if ( ! isset( $args->slug ) || $args->slug !== dirname( $this->slug ) ) {
            return $result;
        }

        $release = $this->get_release();
        if ( ! $release ) {
            return $result;
        }

        $remote_version = $this->get_remote_version( $release );
        $asset_url      = $this->get_asset_url( $release );

        if ( ! $remote_version || ! $asset_url ) {
            return $result;
        }

        return (object) array(
            'name' => 'Abdulify Me',
            'slug' => dirname( $this->slug ),
            'version' => $remote_version,
            'author' => '<a href="https://github.com/hexa-decim8">Molotools</a>',
            'homepage' => 'https://github.com/' . $this->repo,
            'download_link' => $asset_url,
            'sections' => array(
                'description' => isset( $release->body ) ? nl2br( esc_html( $release->body ) ) : 'See GitHub for full changelog.',
            ),
        );
    }

    public function fix_folder_name( $source, $remote_source, $upgrader, $hook_extra ) {
        if ( ! isset( $hook_extra['plugin'] ) || $hook_extra['plugin'] !== $this->slug ) {
            return $source;
        }

        $correct = trailingslashit( $remote_source ) . dirname( $this->slug ) . '/';

        if ( $source !== $correct ) {
            global $wp_filesystem;
            if ( $wp_filesystem->move( $source, $correct ) ) {
                return $correct;
            }
        }

        return $source;
    }

    public function enable_auto_updates( $update, $item ) {
        if ( isset( $item->slug ) && $item->slug === dirname( $this->slug ) ) {
            return get_option( 'am_auto_update_enabled', '1' ) === '1';
        }

        return $update;
    }
}

$abdulify_me_updater = new AM_GitHub_Updater(
    ABDULIFY_ME_PLUGIN_BASENAME,
    ABDULIFY_ME_GITHUB_REPO,
    ABDULIFY_ME_VERSION
);

// ---------------------------------------------------------------------------
// Admin Settings Page for Updater
// ---------------------------------------------------------------------------
class AM_Admin_Settings {

    private $updater;

    public function __construct( $updater ) {
        $this->updater = $updater;

        add_action( 'admin_menu', array( $this, 'add_settings_page' ) );
        add_action( 'admin_init', array( $this, 'register_settings' ) );
        add_action( 'admin_post_am_check_updates', array( $this, 'handle_manual_update_check' ) );
        add_filter( 'auto_update_plugin', array( $this, 'enable_auto_updates' ), 10, 2 );
    }

    /**
     * Add settings page under Settings menu
     */
    public function add_settings_page() {
        add_options_page(
            __( 'Abdulify Me Updates', 'abdulify-me' ),
            __( 'Abdulify Me Updates', 'abdulify-me' ),
            'manage_options',
            'abdulify-me-updater',
            array( $this, 'render_settings_page' )
        );
    }

    /**
     * Register plugin settings
     */
    public function register_settings() {
        register_setting( 'am_updater_settings', 'am_auto_update_enabled' );
    }

    /**
     * Enable auto-updates if setting is enabled
     */
    public function enable_auto_updates( $update, $item ) {
        if ( isset( $item->slug ) && $item->slug === 'abdulify-me' ) {
            return get_option( 'am_auto_update_enabled', '1' ) === '1';
        }
        return $update;
    }

    /**
     * Handle manual update check
     */
    public function handle_manual_update_check() {
        if ( ! current_user_can( 'manage_options' ) ) {
            wp_die( __( 'Unauthorized access', 'abdulify-me' ) );
        }

        check_admin_referer( 'am_check_updates' );

        $this->updater->refresh_update_data( true );

        // Redirect back with success message
        wp_redirect( add_query_arg(
            array(
                'page'              => 'abdulify-me-updater',
                'update_check_done' => '1',
            ),
            admin_url( 'options-general.php' )
        ) );
        exit;
    }

    /**
     * Render the settings page
     */
    public function render_settings_page() {
        if ( ! current_user_can( 'manage_options' ) ) {
            return;
        }

        // Get current version and check for updates
        $current_version = ABDULIFY_ME_VERSION;
        $update_available = false;
        $latest_version = $current_version;

        // Check if there's an update available
        $update_plugins = get_site_transient( 'update_plugins' );
        if ( isset( $update_plugins->response['abdulify-me/abdulify-me.php'] ) ) {
            $update_available = true;
            $latest_version = $update_plugins->response['abdulify-me/abdulify-me.php']->new_version;
        }

        $auto_update_enabled = get_option( 'am_auto_update_enabled', '1' ) === '1';
        $update_check_done = isset( $_GET['update_check_done'] ) && $_GET['update_check_done'] === '1';
        $next_scheduled_check = wp_next_scheduled( ABDULIFY_ME_UPDATE_CRON_HOOK );
        $last_successful_check = (int) get_option( 'am_updater_last_check', 0 );
        $last_error = get_option( 'am_updater_last_error', '' );

        ?>
        <div class="wrap">
            <h1><?php echo esc_html( get_admin_page_title() ); ?></h1>

            <?php if ( $update_check_done ) : ?>
                <div class="notice notice-success is-dismissible">
                    <p><?php esc_html_e( 'Update check completed!', 'abdulify-me' ); ?></p>
                </div>
            <?php endif; ?>

            <div class="card" style="max-width: 800px;">
                <h2><?php esc_html_e( 'Version Information', 'abdulify-me' ); ?></h2>
                <table class="form-table">
                    <tr>
                        <th scope="row"><?php esc_html_e( 'Current Version:', 'abdulify-me' ); ?></th>
                        <td><strong><?php echo esc_html( $current_version ); ?></strong></td>
                    </tr>
                    <?php if ( $update_available ) : ?>
                        <tr>
                            <th scope="row"><?php esc_html_e( 'Latest Version:', 'abdulify-me' ); ?></th>
                            <td>
                                <strong style="color: #d63638;"><?php echo esc_html( $latest_version ); ?></strong>
                                <span style="margin-left: 10px; color: #d63638;">
                                    <?php esc_html_e( '⚠️ Update Available', 'abdulify-me' ); ?>
                                </span>
                            </td>
                        </tr>
                    <?php else : ?>
                        <tr>
                            <th scope="row"><?php esc_html_e( 'Status:', 'abdulify-me' ); ?></th>
                            <td>
                                <span style="color: #00a32a;">
                                    <?php esc_html_e( '✓ Up to date', 'abdulify-me' ); ?>
                                </span>
                            </td>
                        </tr>
                    <?php endif; ?>
                </table>
            </div>

            <div class="card" style="max-width: 800px; margin-top: 20px;">
                <h2><?php esc_html_e( 'Update Settings', 'abdulify-me' ); ?></h2>
                <form method="post" action="options.php">
                    <?php settings_fields( 'am_updater_settings' ); ?>
                    <table class="form-table">
                        <tr>
                            <th scope="row"><?php esc_html_e( 'Enable Automatic Updates', 'abdulify-me' ); ?></th>
                            <td>
                                <label>
                                    <input type="hidden" name="am_auto_update_enabled" value="0" />
                                    <input type="checkbox" name="am_auto_update_enabled" value="1" <?php checked( $auto_update_enabled, true ); ?> />
                                    <?php esc_html_e( 'Automatically update this plugin when a new version is available', 'abdulify-me' ); ?>
                                </label>
                                <p class="description"><?php esc_html_e( 'When enabled, Abdulify Me will automatically update to the latest version from GitHub.', 'abdulify-me' ); ?></p>
                            </td>
                        </tr>
                    </table>
                    <?php submit_button( __( 'Save Settings', 'abdulify-me' ) ); ?>
                </form>
            </div>

            <div class="card" style="max-width: 800px; margin-top: 20px;">
                <h2><?php esc_html_e( 'Manual Update Check', 'abdulify-me' ); ?></h2>
                <p><?php esc_html_e( 'Click the button below to manually check for updates. This will refresh the update information immediately.', 'abdulify-me' ); ?></p>
                <form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
                    <input type="hidden" name="action" value="am_check_updates" />
                    <?php wp_nonce_field( 'am_check_updates' ); ?>
                    <?php submit_button( __( 'Check for Updates', 'abdulify-me' ), 'secondary' ); ?>
                </form>
            </div>

            <div class="card" style="max-width: 800px; margin-top: 20px;">
                <h2><?php esc_html_e( 'Update Status', 'abdulify-me' ); ?></h2>
                <table class="form-table">
                    <tr>
                        <th scope="row"><?php esc_html_e( 'Last Check:', 'abdulify-me' ); ?></th>
                        <td>
                            <?php
                            if ( $last_successful_check > 0 ) {
                                echo esc_html( wp_date( get_option( 'date_format' ) . ' ' . get_option( 'time_format' ), $last_successful_check ) );
                            } else {
                                esc_html_e( 'Never', 'abdulify-me' );
                            }
                            ?>
                        </td>
                    </tr>
                    <?php if ( ! empty( $last_error ) ) : ?>
                        <tr>
                            <th scope="row"><?php esc_html_e( 'Last Error:', 'abdulify-me' ); ?></th>
                            <td>
                                <span style="color: #d63638;"><?php echo esc_html( $last_error ); ?></span>
                            </td>
                        </tr>
                    <?php endif; ?>
                </table>
            </div>
        </div>
        <?php
    }
}

// Register the updater settings page
$am_admin_settings = new AM_Admin_Settings( $abdulify_me_updater );

function abdulify_me_register_cron_schedule( $schedules ) {
    $schedules[ ABDULIFY_ME_UPDATE_CRON_SCHEDULE ] = array(
        'interval' => ABDULIFY_ME_CACHE_TTL,
        'display' => __( 'Every 5 Minutes (Abdulify Me)', 'abdulify-me' ),
    );

    return $schedules;
}
add_filter( 'cron_schedules', 'abdulify_me_register_cron_schedule' );

function abdulify_me_activate() {
    global $abdulify_me_updater;

    if ( $abdulify_me_updater instanceof AM_GitHub_Updater ) {
        $abdulify_me_updater->ensure_schedule();
    }
}
register_activation_hook( __FILE__, 'abdulify_me_activate' );

function abdulify_me_deactivate() {
    wp_clear_scheduled_hook( ABDULIFY_ME_UPDATE_CRON_HOOK );
    delete_transient( 'am_updater_install_lock' );
}
register_deactivation_hook( __FILE__, 'abdulify_me_deactivate' );

final class Abdulify_Me_Plugin {
    const SHORTCODE = 'abdulify_me';
    const SETTINGS_GROUP = 'abdulify_me_settings';
    const SESSION_ID_TRANSIENT = 'abdulify_me_session_';
    const OVERLAY_DIR = 'overlays';
    const OVERLAY_PREFIX = 'AFS-Social';

    public function __construct() {
        add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_assets' ) );
        add_shortcode( self::SHORTCODE, array( $this, 'render_shortcode' ) );
        add_action( 'admin_menu', array( $this, 'register_settings_page' ) );
        add_action( 'admin_init', array( $this, 'register_settings' ) );
    }

    public function register_settings_page() {
        add_options_page(
            __( 'Abdulify Me', 'abdulify-me' ),
            __( 'Abdulify Me', 'abdulify-me' ),
            'manage_options',
            'abdulify-me-settings',
            array( $this, 'render_settings_page' )
        );
    }

    public function register_settings() {
        // No settings currently registered; kept for future use.
    }

    public function render_settings_page() {
        if ( ! current_user_can( 'manage_options' ) ) {
            return;
        }

        ?>
        <div class="wrap">
            <h1><?php esc_html_e( 'Abdulify Me Settings', 'abdulify-me' ); ?></h1>
            <form method="post" action="options.php">
                <?php
                settings_fields( self::SETTINGS_GROUP );
                do_settings_sections( self::SETTINGS_GROUP );
                submit_button();
                ?>
            </form>
        </div>
        <?php
    }

    private function get_overlay_dir_path() {
        return trailingslashit( plugin_dir_path( __FILE__ ) ) . self::OVERLAY_DIR . '/';
    }

    private function get_overlay_dir_url() {
        return trailingslashit( plugin_dir_url( __FILE__ ) ) . self::OVERLAY_DIR . '/';
    }

    private function normalize_overlay_id( $name ) {
        $normalized = strtolower( (string) $name );
        $normalized = preg_replace( '/[^a-z0-9._-]+/', '-', $normalized );
        $normalized = trim( (string) $normalized, '-._' );

        return $normalized ?: strtolower( self::OVERLAY_PREFIX );
    }

    private function format_overlay_label( $value ) {
        $label = str_replace( array( '-', '_' ), ' ', (string) $value );
        $label = preg_replace( '/\s+/', ' ', (string) $label );
        $label = trim( (string) $label );

        if ( '' === $label ) {
            return self::OVERLAY_PREFIX;
        }

        if ( function_exists( 'mb_convert_case' ) ) {
            return mb_convert_case( $label, MB_CASE_TITLE, 'UTF-8' );
        }

        return ucwords( strtolower( $label ) );
    }

    private function get_available_overlays() {
        $overlay_dir = $this->get_overlay_dir_path();
        if ( ! is_dir( $overlay_dir ) ) {
            return array();
        }

        $files = scandir( $overlay_dir );
        if ( false === $files ) {
            return array();
        }

        $allowed_extensions = array( 'png', 'jpg', 'jpeg', 'webp', 'svg' );
        $overlay_url_base   = $this->get_overlay_dir_url();
        $overlays           = array();

        foreach ( $files as $file_name ) {
            if ( ! is_string( $file_name ) || '.' === $file_name || '..' === $file_name ) {
                continue;
            }

            $source_path = $overlay_dir . $file_name;
            if ( ! is_file( $source_path ) ) {
                continue;
            }

            if ( 0 !== stripos( $file_name, self::OVERLAY_PREFIX ) ) {
                continue;
            }

            $extension = strtolower( (string) pathinfo( $file_name, PATHINFO_EXTENSION ) );
            if ( ! in_array( $extension, $allowed_extensions, true ) ) {
                continue;
            }

            $base_name = (string) pathinfo( $file_name, PATHINFO_FILENAME );
            $overlay_id = $this->normalize_overlay_id( $base_name );

            $overlays[ $overlay_id ] = array(
                'id'    => $overlay_id,
                'label' => $this->format_overlay_label( $base_name ),
                'url'   => $overlay_url_base . rawurlencode( $file_name ),
                'file'  => $file_name,
            );
        }

        if ( empty( $overlays ) ) {
            return array();
        }

        uasort(
            $overlays,
            static function ( $a, $b ) {
                return strcasecmp( (string) $a['label'], (string) $b['label'] );
            }
        );

        return array_values( $overlays );
    }

    public function enqueue_assets() {
        if ( is_admin() || ! is_singular() ) {
            return;
        }

        global $post;
        if ( ! ( $post instanceof WP_Post ) || ! has_shortcode( $post->post_content, self::SHORTCODE ) ) {
            return;
        }

        $asset_suffix = ( defined( 'WP_DEBUG' ) && WP_DEBUG ) ? '' : '.min';

        wp_enqueue_style(
            'abdulify-me',
            plugin_dir_url( __FILE__ ) . 'css/abdulify-me' . $asset_suffix . '.css',
            array(),
            ABDULIFY_ME_VERSION
        );

        wp_enqueue_script(
            'abdulify-me',
            plugin_dir_url( __FILE__ ) . 'js/abdulify-me' . $asset_suffix . '.js',
            array(),
            ABDULIFY_ME_VERSION,
            true
        );

        $tint_color = apply_filters( 'abdulify_me_tint_color', '#175f8c' );
        $colors     = array(
            'bg'              => apply_filters( 'abdulify_me_color_bg', '#f6f1e5' ),
            'surface'         => apply_filters( 'abdulify_me_color_surface', '#ffffff' ),
            'primary'         => apply_filters( 'abdulify_me_color_primary', '#0f4f78' ),
            'primaryStrong'   => apply_filters( 'abdulify_me_color_primary_strong', '#0b3957' ),
            'accent'          => apply_filters( 'abdulify_me_color_accent', '#f0a33b' ),
            'ink'             => apply_filters( 'abdulify_me_color_ink', '#1f2530' ),
            'muted'           => apply_filters( 'abdulify_me_color_muted', '#5f6877' ),
            'border'          => apply_filters( 'abdulify_me_color_border', '#dbe3ec' ),
            'statusInfo'      => apply_filters( 'abdulify_me_color_status_info', '#5f6877' ),
            'statusError'     => apply_filters( 'abdulify_me_color_status_error', '#b3212f' ),
            'placeholderBg'   => apply_filters( 'abdulify_me_color_placeholder_bg', '#f2f6fb' ),
            'placeholderText' => apply_filters( 'abdulify_me_color_placeholder_text', '#335f88' ),
            'ribbon'          => apply_filters( 'abdulify_me_color_ribbon', '' ),
            'ribbonText'      => apply_filters( 'abdulify_me_color_ribbon_text', '#ffffff' ),
            'badgeStroke'     => apply_filters( 'abdulify_me_color_badge_stroke', '#0b3957' ),
            'badgeText'       => apply_filters( 'abdulify_me_color_badge_text', '#0b3957' ),
            'tint'            => apply_filters( 'abdulify_me_color_tint', $tint_color ),
        );

        wp_localize_script(
            'abdulify-me',
            'abdulifyMeConfig',
            array(
                'tintColor'   => $tint_color,
                'colors'      => $colors,
                'maxBytes'    => 8 * 1024 * 1024,
                'overlays'    => $this->get_available_overlays(),
                'nonce'       => wp_create_nonce( 'abdulify_me_client' ),
                'ajaxUrl'     => admin_url( 'admin-ajax.php' ),
            )
        );
    }

    public function render_shortcode( $atts = array() ) {
        $atts = shortcode_atts(
            array(
                'title'    => __( 'Abdulify Me', 'abdulify-me' ),
                'subtitle' => __( 'Upload a photo, apply an AFS-Social border, and download your image.', 'abdulify-me' ),
            ),
            $atts,
            self::SHORTCODE
        );

        $title    = esc_html( $atts['title'] );
        $subtitle = esc_html( $atts['subtitle'] );

        ob_start();
        ?>
        <section class="am-widget" data-am-widget>
            <header class="am-header">
                <h2 class="am-title"><?php echo $title; ?></h2>
                <p class="am-subtitle"><?php echo $subtitle; ?></p>
            </header>

            <div class="am-grid">
                <div class="am-panel">
                    <label class="am-upload">
                        <span class="am-upload-title"><?php esc_html_e( 'Upload Photo', 'abdulify-me' ); ?></span>
                        <span class="am-upload-help"><?php esc_html_e( 'PNG or JPG up to 8 MB', 'abdulify-me' ); ?></span>
                        <input class="am-photo-input" type="file" accept="image/png,image/jpeg,image/webp">
                    </label>

                    <fieldset class="am-controls" aria-label="<?php esc_attr_e( 'Photo border', 'abdulify-me' ); ?>">
                        <legend><?php esc_html_e( 'Border', 'abdulify-me' ); ?></legend>

                        <label class="am-control-row">
                            <span><?php esc_html_e( 'AFS-Social border', 'abdulify-me' ); ?></span>
                        </label>
                        <select class="am-select" data-am-overlay-select>
                            <option value=""><?php esc_html_e( 'Select a border', 'abdulify-me' ); ?></option>
                        </select>

                        <div class="am-zoom-controls">
                            <label class="am-zoom-label" for="am-zoom-slider"><?php esc_html_e( 'Zoom', 'abdulify-me' ); ?> <span class="am-zoom-value" data-am-zoom-value>100%</span></label>
                            <div class="am-zoom-row">
                                <input class="am-zoom-slider" id="am-zoom-slider" type="range" min="1" max="5" step="0.05" value="1" data-am-zoom-slider disabled>
                                <button class="am-button am-zoom-reset" type="button" data-am-zoom-reset disabled title="<?php esc_attr_e( 'Reset zoom and position', 'abdulify-me' ); ?>">
                                    <?php esc_html_e( 'Reset', 'abdulify-me' ); ?>
                                </button>
                            </div>
                            <p class="am-zoom-hint"><?php esc_html_e( 'Scroll to zoom, drag to reposition', 'abdulify-me' ); ?></p>
                        </div>
                    </fieldset>

                    <div class="am-actions">
                        <button class="am-button am-download" type="button" data-am-download disabled>
                            <?php esc_html_e( 'Download Image', 'abdulify-me' ); ?>
                        </button>
                    </div>

                    <div class="am-set-profile" aria-label="<?php esc_attr_e( 'Set as profile picture', 'abdulify-me' ); ?>">
                        <span class="am-set-profile-label"><?php esc_html_e( 'Set as Profile Picture', 'abdulify-me' ); ?></span>
                        <div class="am-set-profile-buttons">
                            <button class="am-button am-set-profile-fb" type="button" data-am-set-profile-fb disabled aria-label="<?php esc_attr_e( 'Set as Facebook profile picture', 'abdulify-me' ); ?>" title="<?php esc_attr_e( 'Downloads your photo and opens Facebook profile picture editor', 'abdulify-me' ); ?>">
                                <svg class="am-set-profile-icon" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                                <span><?php esc_html_e( 'Facebook', 'abdulify-me' ); ?></span>
                            </button>
                            <button class="am-button am-set-profile-ig" type="button" data-am-set-profile-ig disabled aria-label="<?php esc_attr_e( 'Set as Instagram profile picture', 'abdulify-me' ); ?>" title="<?php esc_attr_e( 'Downloads your photo for use as Instagram profile picture', 'abdulify-me' ); ?>">
                                <svg class="am-set-profile-icon" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                                <span><?php esc_html_e( 'Instagram', 'abdulify-me' ); ?></span>
                            </button>
                            <button class="am-button am-set-profile-share" type="button" data-am-set-profile-share disabled aria-label="<?php esc_attr_e( 'Share profile picture via device', 'abdulify-me' ); ?>" title="<?php esc_attr_e( 'Share directly to an app on your device', 'abdulify-me' ); ?>">
                                <svg class="am-set-profile-icon" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"/></svg>
                                <span><?php esc_html_e( 'Share', 'abdulify-me' ); ?></span>
                            </button>
                        </div>
                    </div>

                    <p class="am-status" data-am-status><?php esc_html_e( 'Choose a photo to begin.', 'abdulify-me' ); ?></p>
                </div>

                <div class="am-preview-panel">
                    <canvas class="am-canvas" data-am-canvas width="1200" height="1200" aria-label="<?php esc_attr_e( 'Image preview', 'abdulify-me' ); ?>"></canvas>
                </div>
            </div>
        </section>
        <?php

        return (string) ob_get_clean();
    }
}

new Abdulify_Me_Plugin();
