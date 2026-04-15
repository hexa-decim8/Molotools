<?php
/**
 * Plugin Name: Billionaire Wealth Tax Calculator
 * Plugin URI:  https://github.com/hexa-decim8/Molotools
 * Description: Interactive calculator showing estimated 10-year tax revenue from billionaire wealth at rates of 1%–10%, based on the 2026 Forbes estimate of $8.2 trillion. Embed with [billionaire_wealth_tax].
 * Version:     1.3.32
 * Author:      Molotools
 * License:     GPL v2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: wealth-tax-calculator
 * Requires:    5.0
 * Requires PHP: 7.4
 * Tested up to: 6.6
 * GitHub Plugin URI: hexa-decim8/Molotools
 * GitHub Branch:     main
 * Primary Branch:    main
 */

// Prevent direct access.
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

// Plugin version constant - update this when releasing new versions
define( 'WTC_VERSION', '1.3.32' );

// Plugin constants
define( 'WTC_PLUGIN_BASENAME', 'wealth-tax-calculator/wealth-tax-calculator.php' );
define( 'WTC_GITHUB_REPO', 'hexa-decim8/Molotools' );
define( 'WTC_RELEASE_ASSET', 'wealth-tax-calculator.zip' );
define( 'WTC_BILLIONAIRE_WEALTH', 8.2e12 ); // $8.2 trillion (Forbes 2026 estimate)
define( 'WTC_TAX_RATE_MIN', 1 );
define( 'WTC_TAX_RATE_MAX', 10 );
define( 'WTC_CACHE_TTL', 5 * MINUTE_IN_SECONDS );
define( 'WTC_UPDATE_ERROR_TTL', 5 * MINUTE_IN_SECONDS );
define( 'WTC_UPDATE_CRON_HOOK', 'wtc_run_scheduled_update_check' );
define( 'WTC_UPDATE_CRON_SCHEDULE', 'wtc_every_five_minutes' );
define( 'WTC_AUTO_INSTALL_LOCK_TTL', 5 * MINUTE_IN_SECONDS );
define( 'WTC_ANALYTICS_OPTION_KEY', 'wtc_policy_analytics_daily' );
define( 'WTC_ANALYTICS_ENABLED_OPTION', 'wtc_analytics_enabled' );
define( 'WTC_ANALYTICS_GEO_OPTION', 'wtc_analytics_geo_enabled' );
define( 'WTC_ANALYTICS_RETENTION_OPTION', 'wtc_analytics_retention_days' );

// ---------------------------------------------------------------------------
// Self-contained GitHub update checker — no extra plugins required.
// Hooks into WordPress's native update system.
// Checks: https://api.github.com/repos/hexa-decim8/Molotools/releases/latest
// Expects a release asset named "wealth-tax-calculator.zip" on each release.
// Uses a best-effort 5-minute WP-Cron schedule for release checks and installs.
// ---------------------------------------------------------------------------
class WTC_GitHub_Updater {

    private $slug;       // plugin slug: folder/file.php
    private $repo;       // GitHub repo: owner/repo
    private $version;    // current installed version
    private $cache_key;
    private $cache_ttl = WTC_CACHE_TTL;

    public function __construct( $slug, $repo, $version ) {
        $this->slug      = $slug;
        $this->repo      = $repo;
        $this->version   = $version;
        $this->cache_key = 'wtc_github_update_' . md5( $slug );

        add_filter( 'pre_set_site_transient_update_plugins', array( $this, 'check_for_update' ) );
        add_filter( 'plugins_api',                           array( $this, 'plugin_info' ), 10, 3 );
        add_filter( 'upgrader_source_selection',             array( $this, 'fix_folder_name' ), 10, 4 );
        add_action( WTC_UPDATE_CRON_HOOK,                    array( $this, 'run_scheduled_update' ) );
        add_action( 'init',                                  array( $this, 'ensure_schedule' ) );
    }

    private function log_error( $message ) {
        update_option( 'wtc_updater_last_error', $message, false );
        error_log( '[WTC Updater] ' . $message );
    }

    private function clear_last_error() {
        delete_option( 'wtc_updater_last_error' );
    }

    private function record_successful_check() {
        update_option( 'wtc_updater_last_check', time(), false );
        $this->clear_last_error();
    }

    public function ensure_schedule() {
        if ( ! wp_next_scheduled( WTC_UPDATE_CRON_HOOK ) ) {
            if ( ! wp_schedule_event( time() + WTC_CACHE_TTL, WTC_UPDATE_CRON_SCHEDULE, WTC_UPDATE_CRON_HOOK ) ) {
                $this->log_error( 'Unable to schedule the recurring 5-minute update check.' );
            }
        }
    }

    public function clear_cached_release() {
        delete_transient( $this->cache_key );
    }

    /**
     * Fetch the latest release from GitHub, cached for 5 minutes.
     */
    private function get_release( $force = false ) {
        $cached = $force ? false : get_transient( $this->cache_key );
        if ( $cached !== false ) {
            return $cached;
        }

        $url      = 'https://api.github.com/repos/' . $this->repo . '/releases/latest';
        $response = wp_remote_get( $url, array(
            'headers' => array(
                'Accept'     => 'application/vnd.github.v3+json',
                'User-Agent' => 'WordPress/' . get_bloginfo( 'version' ),
            ),
            'timeout' => 10,
        ) );

        if ( is_wp_error( $response ) || wp_remote_retrieve_response_code( $response ) !== 200 ) {
            // Cache a short negative result to avoid hammering the API on errors.
            $message = is_wp_error( $response )
                ? $response->get_error_message()
                : 'GitHub API returned HTTP ' . wp_remote_retrieve_response_code( $response );

            $this->log_error( 'Release check failed: ' . $message );
            set_transient( $this->cache_key, null, WTC_UPDATE_ERROR_TTL );
            return null;
        }

        $release = json_decode( wp_remote_retrieve_body( $response ) );
        if ( ! is_object( $release ) || empty( $release->tag_name ) ) {
            $this->log_error( 'GitHub release payload was invalid or missing tag_name.' );
            set_transient( $this->cache_key, null, WTC_UPDATE_ERROR_TTL );
            return null;
        }

        set_transient( $this->cache_key, $release, $this->cache_ttl );
        $this->record_successful_check();
        return $release;
    }

    private function build_plugin_update_item( $remote_version, $asset_url ) {
        return (object) array(
            'slug'        => dirname( $this->slug ),
            'plugin'      => $this->slug,
            'new_version' => $remote_version,
            'url'         => 'https://github.com/' . $this->repo,
            'package'     => $asset_url,
            'tested'      => '',
            'requires_php'=> '7.4',
            'icons'       => array(),
            'banners'     => array(),
        );
    }

    /**
     * Find the plugin zip asset in the release.
     * Looks for an asset named "wealth-tax-calculator.zip".
     */
    private function get_asset_url( $release ) {
        if ( empty( $release->assets ) ) {
            $this->log_error( 'Latest GitHub release is missing assets.' );
            return null;
        }
        foreach ( $release->assets as $asset ) {
            if ( $asset->name === WTC_RELEASE_ASSET ) {
                return $asset->browser_download_url;
            }
        }

        $this->log_error( 'Latest GitHub release is missing the required ' . WTC_RELEASE_ASSET . ' asset.' );
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

    private function auto_updates_enabled() {
        return get_option( 'wtc_auto_update_enabled', '0' ) === '1';
    }

    private function maybe_install_update( $transient ) {
        if ( ! $this->auto_updates_enabled() ) {
            return;
        }

        if ( ! isset( $transient->response[ $this->slug ] ) ) {
            return;
        }

        $lock_key = 'wtc_updater_install_lock';
        if ( get_transient( $lock_key ) ) {
            return;
        }

        if ( ! function_exists( 'wp_clean_plugins_cache' ) ) {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
        }
        require_once ABSPATH . 'wp-admin/includes/file.php';
        require_once ABSPATH . 'wp-admin/includes/misc.php';
        require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';

        set_transient( $lock_key, 1, WTC_AUTO_INSTALL_LOCK_TTL );

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

    /**
     * Inject update data into WordPress's plugin update transient.
     */
    public function check_for_update( $transient ) {
        if ( empty( $transient->checked ) ) {
            return $transient;
        }

        $release = $this->get_release();
        if ( ! $release ) {
            return $transient;
        }

        $remote_version = ltrim( $release->tag_name, 'v' );
        $asset_url      = $this->get_asset_url( $release );

        if ( ! isset( $transient->response ) || ! is_array( $transient->response ) ) {
            $transient->response = array();
        }
        if ( ! isset( $transient->no_update ) || ! is_array( $transient->no_update ) ) {
            $transient->no_update = array();
        }

        if ( version_compare( $this->version, $remote_version, '<' ) && $asset_url ) {
            $transient->response[ $this->slug ] = $this->build_plugin_update_item( $remote_version, $asset_url );
            unset( $transient->no_update[ $this->slug ] );
        } elseif ( $asset_url ) {
            $transient->no_update[ $this->slug ] = $this->build_plugin_update_item( $remote_version, $asset_url );
            unset( $transient->response[ $this->slug ] );
        }

        return $transient;
    }

    /**
     * Populate the "View Details" modal in the plugins list.
     */
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

        $remote_version = ltrim( $release->tag_name, 'v' );
        $asset_url      = $this->get_asset_url( $release );

        return (object) array(
            'name'          => 'Billionaire Wealth Tax Calculator',
            'slug'          => dirname( $this->slug ),
            'version'       => $remote_version,
            'author'        => '<a href="https://github.com/hexa-decim8">Molotools</a>',
            'homepage'      => 'https://github.com/' . $this->repo,
            'download_link' => $asset_url,
            'sections'      => array(
                'description' => isset( $release->body ) ? nl2br( esc_html( $release->body ) ) : 'See GitHub for full changelog.',
            ),
        );
    }

    /**
     * After extraction WordPress may name the folder from the zip root entry
     * (e.g. "wealth-tax-calculator-1.2.0"). Rename it to the correct slug.
     */
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
}

// Register the updater.
$wtc_updater = new WTC_GitHub_Updater(
    WTC_PLUGIN_BASENAME,
    WTC_GITHUB_REPO,
    WTC_VERSION
);

// ---------------------------------------------------------------------------
// Admin Settings Page
// ---------------------------------------------------------------------------
class WTC_Admin_Settings {

    private $updater;
    
    public function __construct( $updater ) {
        $this->updater = $updater;
        
        add_action( 'admin_menu', array( $this, 'add_settings_page' ) );
        add_action( 'admin_init', array( $this, 'register_settings' ) );
        add_action( 'admin_post_wtc_check_updates', array( $this, 'handle_manual_update_check' ) );
        add_filter( 'auto_update_plugin', array( $this, 'enable_auto_updates' ), 10, 2 );
    }

    /**
     * Add settings page under Settings menu
     */
    public function add_settings_page() {
        add_options_page(
            'Wealth Tax Calculator Updates',
            'Wealth Tax Updates',
            'manage_options',
            'wealth-tax-calculator',
            array( $this, 'render_settings_page' )
        );
    }

    /**
     * Register plugin settings
     */
    public function register_settings() {
        register_setting( 'wtc_settings', 'wtc_auto_update_enabled' );
    }

    /**
     * Enable auto-updates if setting is enabled
     */
    public function enable_auto_updates( $update, $item ) {
        if ( isset( $item->slug ) && $item->slug === 'wealth-tax-calculator' ) {
            return get_option( 'wtc_auto_update_enabled', '0' ) === '1';
        }
        return $update;
    }

    /**
     * Handle manual update check
     */
    public function handle_manual_update_check() {
        if ( ! current_user_can( 'manage_options' ) ) {
            wp_die( 'Unauthorized access' );
        }

        check_admin_referer( 'wtc_check_updates' );

        $this->updater->refresh_update_data( true );

        // Redirect back with success message
        wp_redirect( add_query_arg(
            array(
                'page'              => 'wealth-tax-calculator',
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
        $current_version = WTC_VERSION;
        $update_available = false;
        $latest_version = $current_version;

        // Check if there's an update available
        $update_plugins = get_site_transient( 'update_plugins' );
        if ( isset( $update_plugins->response['wealth-tax-calculator/wealth-tax-calculator.php'] ) ) {
            $update_available = true;
            $latest_version = $update_plugins->response['wealth-tax-calculator/wealth-tax-calculator.php']->new_version;
        }

        $auto_update_enabled = get_option( 'wtc_auto_update_enabled', '0' ) === '1';
        $update_check_done = isset( $_GET['update_check_done'] ) && $_GET['update_check_done'] === '1';
        $next_scheduled_check = wp_next_scheduled( WTC_UPDATE_CRON_HOOK );
        $last_successful_check = (int) get_option( 'wtc_updater_last_check', 0 );
        $last_error = get_option( 'wtc_updater_last_error', '' );

        ?>
        <div class="wrap">
            <h1><?php echo esc_html( get_admin_page_title() ); ?></h1>

            <?php if ( $update_check_done ) : ?>
                <div class="notice notice-success is-dismissible">
                    <p><?php esc_html_e( 'Update check completed!', 'wealth-tax-calculator' ); ?></p>
                </div>
            <?php endif; ?>

            <div class="card" style="max-width: 800px;">
                <h2><?php esc_html_e( 'Version Information', 'wealth-tax-calculator' ); ?></h2>
                <table class="form-table">
                    <tr>
                        <th scope="row"><?php esc_html_e( 'Current Version:', 'wealth-tax-calculator' ); ?></th>
                        <td><strong><?php echo esc_html( $current_version ); ?></strong></td>
                    </tr>
                    <?php if ( $update_available ) : ?>
                        <tr>
                            <th scope="row"><?php esc_html_e( 'Latest Version:', 'wealth-tax-calculator' ); ?></th>
                            <td>
                                <strong style="color: #d63638;"><?php echo esc_html( $latest_version ); ?></strong>
                                <span style="margin-left: 10px; color: #d63638;">
                                    <?php esc_html_e( '⚠️ Update Available', 'wealth-tax-calculator' ); ?>
                                </span>
                            </td>
                        </tr>
                    <?php else : ?>
                        <tr>
                            <th scope="row"><?php esc_html_e( 'Status:', 'wealth-tax-calculator' ); ?></th>
                            <td>
                                <span style="color: #00a32a;">
                                    <?php esc_html_e( '✓ Up to date', 'wealth-tax-calculator' ); ?>
                                </span>
                            </td>
                        </tr>
                    <?php endif; ?>
                    <tr>
                        <th scope="row"><?php esc_html_e( 'Repository:', 'wealth-tax-calculator' ); ?></th>
                        <td>
                            <a href="https://github.com/hexa-decim8/Molotools" target="_blank">
                                hexa-decim8/Molotools ↗
                            </a>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><?php esc_html_e( 'Last Successful Check:', 'wealth-tax-calculator' ); ?></th>
                        <td>
                            <?php
                            echo $last_successful_check
                                ? esc_html( date_i18n( 'Y-m-d H:i:s', $last_successful_check ) )
                                : esc_html__( 'No successful checks yet', 'wealth-tax-calculator' );
                            ?>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><?php esc_html_e( 'Next Scheduled Check:', 'wealth-tax-calculator' ); ?></th>
                        <td>
                            <?php
                            echo $next_scheduled_check
                                ? esc_html( date_i18n( 'Y-m-d H:i:s', $next_scheduled_check ) )
                                : esc_html__( 'Not scheduled', 'wealth-tax-calculator' );
                            ?>
                        </td>
                    </tr>
                </table>

                <?php if ( $update_available ) : ?>
                    <p>
                        <a href="<?php echo esc_url( admin_url( 'plugins.php' ) ); ?>" class="button button-primary">
                            <?php esc_html_e( 'Go to Plugins Page to Update', 'wealth-tax-calculator' ); ?>
                        </a>
                    </p>
                <?php endif; ?>
            </div>

            <div class="card" style="max-width: 800px; margin-top: 20px;">
                <h2><?php esc_html_e( 'Update Settings', 'wealth-tax-calculator' ); ?></h2>
                <form method="post" action="options.php">
                    <?php settings_fields( 'wtc_settings' ); ?>
                    <table class="form-table">
                        <tr>
                            <th scope="row"><?php esc_html_e( 'Automatic Updates:', 'wealth-tax-calculator' ); ?></th>
                            <td>
                                <label>
                                    <input
                                        type="checkbox"
                                        name="wtc_auto_update_enabled"
                                        value="1"
                                        <?php checked( $auto_update_enabled, true ); ?>
                                    />
                                    <?php esc_html_e( 'Enable automatic updates for this plugin', 'wealth-tax-calculator' ); ?>
                                </label>
                                <p class="description">
                                    <?php esc_html_e( 'When enabled, the plugin will check GitHub roughly every 5 minutes and install a newer release during the next scheduled run.', 'wealth-tax-calculator' ); ?>
                                </p>
                            </td>
                        </tr>
                    </table>
                    <?php submit_button( __( 'Save Settings', 'wealth-tax-calculator' ) ); ?>
                </form>
            </div>

            <?php if ( ! empty( $last_error ) ) : ?>
                <div class="card" style="max-width: 800px; margin-top: 20px;">
                    <h2><?php esc_html_e( 'Updater Status', 'wealth-tax-calculator' ); ?></h2>
                    <p style="color: #d63638;"><strong><?php esc_html_e( 'Last updater error:', 'wealth-tax-calculator' ); ?></strong> <?php echo esc_html( $last_error ); ?></p>
                </div>
            <?php endif; ?>

            <div class="card" style="max-width: 800px; margin-top: 20px;">
                <h2><?php esc_html_e( 'Manual Update Check', 'wealth-tax-calculator' ); ?></h2>
                <p><?php esc_html_e( 'Click the button below to manually check for updates from GitHub.', 'wealth-tax-calculator' ); ?></p>
                <form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
                    <input type="hidden" name="action" value="wtc_check_updates" />
                    <?php wp_nonce_field( 'wtc_check_updates' ); ?>
                    <?php submit_button( __( 'Check for Updates Now', 'wealth-tax-calculator' ), 'secondary' ); ?>
                </form>
            </div>

            <div class="card" style="max-width: 800px; margin-top: 20px;">
                <h2><?php esc_html_e( 'How Updates Work', 'wealth-tax-calculator' ); ?></h2>
                <ul style="list-style: disc; margin-left: 20px;">
                    <li><?php esc_html_e( 'Updates are fetched from GitHub releases', 'wealth-tax-calculator' ); ?></li>
                    <li><?php esc_html_e( 'The plugin schedules a best-effort update check every 5 minutes using WP-Cron', 'wealth-tax-calculator' ); ?></li>
                    <li><?php esc_html_e( 'Exact 5-minute timing depends on site traffic unless a real server cron is configured', 'wealth-tax-calculator' ); ?></li>
                    <li><?php esc_html_e( 'You can manually check for updates using the button above', 'wealth-tax-calculator' ); ?></li>
                    <li><?php esc_html_e( 'Enable automatic updates to let scheduled checks install new releases without opening the Plugins page', 'wealth-tax-calculator' ); ?></li>
                    <li><?php esc_html_e( 'Updates are shown in the WordPress Plugins page when available', 'wealth-tax-calculator' ); ?></li>
                </ul>
            </div>
        </div>
        <?php
    }
}

// Initialize admin settings page
if ( is_admin() ) {
    new WTC_Admin_Settings( $wtc_updater );
}

class WTC_Policy_Analytics {

    public function __construct() {
        add_action( 'admin_init', array( $this, 'register_settings' ) );
        add_action( 'admin_menu', array( $this, 'add_analytics_submenu' ) );
        add_action( 'admin_post_wtc_reset_analytics', array( $this, 'handle_reset_analytics' ) );
        add_action( 'wp_ajax_wtc_track_policy_event', array( $this, 'track_policy_event' ) );
        add_action( 'wp_ajax_nopriv_wtc_track_policy_event', array( $this, 'track_policy_event' ) );
        add_action( WTC_UPDATE_CRON_HOOK, array( $this, 'prune_old_analytics_data' ) );
    }

    public function is_enabled() {
        return get_option( WTC_ANALYTICS_ENABLED_OPTION, '0' ) === '1';
    }

    public function geo_enabled() {
        return get_option( WTC_ANALYTICS_GEO_OPTION, '0' ) === '1';
    }

    public function get_retention_days() {
        $days = (int) get_option( WTC_ANALYTICS_RETENTION_OPTION, 90 );
        return max( 7, min( 365, $days ) );
    }

    public function register_settings() {
        register_setting( 'wtc_analytics_settings', WTC_ANALYTICS_ENABLED_OPTION, array( $this, 'sanitize_checkbox_flag' ) );
        register_setting( 'wtc_analytics_settings', WTC_ANALYTICS_GEO_OPTION, array( $this, 'sanitize_checkbox_flag' ) );
        register_setting( 'wtc_analytics_settings', WTC_ANALYTICS_RETENTION_OPTION, array( $this, 'sanitize_retention_days' ) );
    }

    public function sanitize_checkbox_flag( $value ) {
        return (string) $value === '1' ? '1' : '0';
    }

    public function sanitize_retention_days( $value ) {
        $days = (int) $value;
        if ( $days < 7 ) {
            return 7;
        }
        if ( $days > 365 ) {
            return 365;
        }
        return $days;
    }

    public function add_analytics_submenu() {
        add_submenu_page(
            'options-general.php',
            __( 'Wealth Tax Analytics', 'wealth-tax-calculator' ),
            __( 'Wealth Tax Analytics', 'wealth-tax-calculator' ),
            'manage_options',
            'wealth-tax-calculator-analytics',
            array( $this, 'render_analytics_page' )
        );
    }

    public function render_analytics_page() {
        if ( ! current_user_can( 'manage_options' ) ) {
            return;
        }

        $analytics_data = get_option( WTC_ANALYTICS_OPTION_KEY, array() );
        if ( ! is_array( $analytics_data ) ) {
            $analytics_data = array();
        }

        $summary = $this->build_summary( $analytics_data );
        ?>
        <div class="wrap">
            <h1><?php esc_html_e( 'Wealth Tax Calculator Analytics', 'wealth-tax-calculator' ); ?></h1>

            <div class="card" style="max-width: 920px; margin-top: 20px;">
                <h2><?php esc_html_e( 'Tracking Settings', 'wealth-tax-calculator' ); ?></h2>
                <form method="post" action="options.php">
                    <?php settings_fields( 'wtc_analytics_settings' ); ?>
                    <table class="form-table">
                        <tr>
                            <th scope="row"><?php esc_html_e( 'Enable Analytics', 'wealth-tax-calculator' ); ?></th>
                            <td>
                                <label>
                                    <input type="hidden" name="<?php echo esc_attr( WTC_ANALYTICS_ENABLED_OPTION ); ?>" value="0" />
                                    <input type="checkbox" name="<?php echo esc_attr( WTC_ANALYTICS_ENABLED_OPTION ); ?>" value="1" <?php checked( $this->is_enabled(), true ); ?> />
                                    <?php esc_html_e( 'Track anonymous aggregate policy interactions', 'wealth-tax-calculator' ); ?>
                                </label>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row"><?php esc_html_e( 'Location Tracking', 'wealth-tax-calculator' ); ?></th>
                            <td>
                                <label>
                                    <input type="hidden" name="<?php echo esc_attr( WTC_ANALYTICS_GEO_OPTION ); ?>" value="0" />
                                    <input type="checkbox" name="<?php echo esc_attr( WTC_ANALYTICS_GEO_OPTION ); ?>" value="1" <?php checked( $this->geo_enabled(), true ); ?> />
                                    <?php esc_html_e( 'Enable coarse IP-based US region tracking (Michigan city detail)', 'wealth-tax-calculator' ); ?>
                                </label>
                                <p class="description"><?php esc_html_e( 'When enabled, analytics only include US responses. Michigan responses are grouped by city (mi_city), while other US responses are grouped by state (us_state). No raw IP is stored in analytics records.', 'wealth-tax-calculator' ); ?></p>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row"><?php esc_html_e( 'Retention (days)', 'wealth-tax-calculator' ); ?></th>
                            <td>
                                <input type="number" min="7" max="365" name="<?php echo esc_attr( WTC_ANALYTICS_RETENTION_OPTION ); ?>" value="<?php echo esc_attr( $this->get_retention_days() ); ?>" />
                            </td>
                        </tr>
                    </table>
                    <?php submit_button( __( 'Save Analytics Settings', 'wealth-tax-calculator' ) ); ?>
                </form>
            </div>

            <div class="card" style="max-width: 920px; margin-top: 20px;">
                <h2><?php esc_html_e( 'Summary', 'wealth-tax-calculator' ); ?></h2>
                <p><strong><?php esc_html_e( 'Tracked interactions:', 'wealth-tax-calculator' ); ?></strong> <?php echo esc_html( number_format_i18n( $summary['total_events'] ) ); ?></p>
                <p><strong><?php esc_html_e( 'Days stored:', 'wealth-tax-calculator' ); ?></strong> <?php echo esc_html( number_format_i18n( $summary['days_count'] ) ); ?></p>
            </div>

            <div class="card" style="max-width: 920px; margin-top: 20px;">
                <h2><?php esc_html_e( 'Most Selected Sub-Policies', 'wealth-tax-calculator' ); ?></h2>
                <?php $this->render_simple_count_table( $summary['enabled_counts'], __( 'Sub-policy', 'wealth-tax-calculator' ), __( 'Enabled count', 'wealth-tax-calculator' ) ); ?>
            </div>

            <div class="card" style="max-width: 920px; margin-top: 20px;">
                <h2><?php esc_html_e( 'Most Prioritized (Rank #1)', 'wealth-tax-calculator' ); ?></h2>
                <?php $this->render_simple_count_table( $summary['top_rank_counts'], __( 'Sub-policy', 'wealth-tax-calculator' ), __( 'Times ranked #1', 'wealth-tax-calculator' ) ); ?>
            </div>

            <?php if ( $this->geo_enabled() ) : ?>
                <div class="card" style="max-width: 920px; margin-top: 20px;">
                    <h2><?php esc_html_e( 'Region Buckets', 'wealth-tax-calculator' ); ?></h2>
                    <?php $this->render_simple_count_table( $summary['region_counts'], __( 'Region bucket', 'wealth-tax-calculator' ), __( 'Interactions', 'wealth-tax-calculator' ) ); ?>
                </div>
            <?php endif; ?>

            <div class="card" style="max-width: 920px; margin-top: 20px;">
                <h2><?php esc_html_e( 'Data Management', 'wealth-tax-calculator' ); ?></h2>
                <form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
                    <input type="hidden" name="action" value="wtc_reset_analytics" />
                    <?php wp_nonce_field( 'wtc_reset_analytics' ); ?>
                    <?php submit_button( __( 'Reset Analytics Data', 'wealth-tax-calculator' ), 'delete' ); ?>
                </form>
            </div>
        </div>
        <?php
    }

    private function render_simple_count_table( $counts, $col_one, $col_two ) {
        if ( empty( $counts ) ) {
            echo '<p>' . esc_html__( 'No data yet.', 'wealth-tax-calculator' ) . '</p>';
            return;
        }

        $limit = 15;
        $rows  = 0;

        echo '<table class="widefat striped">';
        echo '<thead><tr><th>' . esc_html( $col_one ) . '</th><th>' . esc_html( $col_two ) . '</th></tr></thead>';
        echo '<tbody>';

        foreach ( $counts as $key => $value ) {
            if ( $rows >= $limit ) {
                break;
            }

            echo '<tr>';
            echo '<td>' . esc_html( $key ) . '</td>';
            echo '<td>' . esc_html( number_format_i18n( (int) $value ) ) . '</td>';
            echo '</tr>';
            $rows++;
        }

        echo '</tbody>';
        echo '</table>';
    }

    private function build_summary( $analytics_data ) {
        $enabled_counts  = array();
        $top_rank_counts = array();
        $region_counts   = array();
        $total_events    = 0;

        foreach ( $analytics_data as $day ) {
            if ( ! is_array( $day ) ) {
                continue;
            }

            $total_events += isset( $day['event_total'] ) ? (int) $day['event_total'] : 0;

            if ( ! empty( $day['policy_enabled'] ) && is_array( $day['policy_enabled'] ) ) {
                foreach ( $day['policy_enabled'] as $policy_key => $count ) {
                    if ( ! isset( $enabled_counts[ $policy_key ] ) ) {
                        $enabled_counts[ $policy_key ] = 0;
                    }
                    $enabled_counts[ $policy_key ] += (int) $count;
                }
            }

            if ( ! empty( $day['priority_rank_counts']['1'] ) && is_array( $day['priority_rank_counts']['1'] ) ) {
                foreach ( $day['priority_rank_counts']['1'] as $policy_key => $count ) {
                    if ( ! isset( $top_rank_counts[ $policy_key ] ) ) {
                        $top_rank_counts[ $policy_key ] = 0;
                    }
                    $top_rank_counts[ $policy_key ] += (int) $count;
                }
            }

            if ( ! empty( $day['regions'] ) && is_array( $day['regions'] ) ) {
                foreach ( $day['regions'] as $bucket => $count ) {
                    if ( ! isset( $region_counts[ $bucket ] ) ) {
                        $region_counts[ $bucket ] = 0;
                    }
                    $region_counts[ $bucket ] += (int) $count;
                }
            }
        }

        arsort( $enabled_counts );
        arsort( $top_rank_counts );
        arsort( $region_counts );

        return array(
            'enabled_counts'  => $enabled_counts,
            'top_rank_counts' => $top_rank_counts,
            'region_counts'   => $region_counts,
            'days_count'      => count( $analytics_data ),
            'total_events'    => $total_events,
        );
    }

    public function handle_reset_analytics() {
        if ( ! current_user_can( 'manage_options' ) ) {
            wp_die( 'Unauthorized access' );
        }

        check_admin_referer( 'wtc_reset_analytics' );
        delete_option( WTC_ANALYTICS_OPTION_KEY );

        wp_redirect( add_query_arg(
            array(
                'page' => 'wealth-tax-calculator-analytics',
                'reset' => '1',
            ),
            admin_url( 'options-general.php' )
        ) );
        exit;
    }

    public function track_policy_event() {
        if ( ! $this->is_enabled() ) {
            wp_send_json_error( array( 'message' => 'analytics-disabled' ), 403 );
        }

        $nonce = isset( $_POST['nonce'] ) ? sanitize_text_field( wp_unslash( $_POST['nonce'] ) ) : '';
        if ( ! wp_verify_nonce( $nonce, 'wtc_track_policy_event' ) ) {
            wp_send_json_error( array( 'message' => 'invalid-nonce' ), 403 );
        }

        $event_type = isset( $_POST['event_type'] ) ? sanitize_key( wp_unslash( $_POST['event_type'] ) ) : '';
        $policy_key = isset( $_POST['policy_key'] ) ? sanitize_text_field( wp_unslash( $_POST['policy_key'] ) ) : '';
        $mode       = isset( $_POST['mode'] ) ? sanitize_key( wp_unslash( $_POST['mode'] ) ) : 'advanced';
        $enabled    = isset( $_POST['enabled'] ) ? sanitize_text_field( wp_unslash( $_POST['enabled'] ) ) : '';
        $rank       = isset( $_POST['rank'] ) ? (int) $_POST['rank'] : 0;
        $order_raw  = isset( $_POST['order'] ) ? wp_unslash( $_POST['order'] ) : '[]';

        if ( ! in_array( $event_type, array( 'policy_toggle', 'policy_reorder' ), true ) ) {
            wp_send_json_error( array( 'message' => 'invalid-event-type' ), 400 );
        }

        if ( ! preg_match( '/^[a-zA-Z]+:[0-9]+$/', $policy_key ) ) {
            wp_send_json_error( array( 'message' => 'invalid-policy-key' ), 400 );
        }

        if ( ! in_array( $mode, array( 'basic', 'advanced' ), true ) ) {
            $mode = 'advanced';
        }

        $order = json_decode( $order_raw, true );
        if ( ! is_array( $order ) ) {
            $order = array();
        }

        $today = gmdate( 'Y-m-d' );
        $data  = get_option( WTC_ANALYTICS_OPTION_KEY, array() );
        if ( ! is_array( $data ) ) {
            $data = array();
        }

        if ( ! isset( $data[ $today ] ) || ! is_array( $data[ $today ] ) ) {
            $data[ $today ] = array(
                'event_total'           => 0,
                'policy_enabled'        => array(),
                'policy_disabled'       => array(),
                'priority_rank_counts'  => array(),
                'mode_counts'           => array(),
                'regions'               => array(),
            );
        }

        $region_bucket = null;
        if ( $this->geo_enabled() ) {
            $geo_context = $this->get_geo_context();
            if ( ! $geo_context['include'] ) {
                wp_send_json_success( array( 'ok' => true, 'excluded' => 'non-us' ) );
            }
            $region_bucket = $geo_context['bucket'];
        }

        $day =& $data[ $today ];
        $day['event_total'] = isset( $day['event_total'] ) ? (int) $day['event_total'] + 1 : 1;

        if ( ! isset( $day['mode_counts'][ $mode ] ) ) {
            $day['mode_counts'][ $mode ] = 0;
        }
        $day['mode_counts'][ $mode ] += 1;

        if ( $event_type === 'policy_toggle' ) {
            $is_enabled = $enabled === '1';
            $target_key = $is_enabled ? 'policy_enabled' : 'policy_disabled';
            if ( ! isset( $day[ $target_key ][ $policy_key ] ) ) {
                $day[ $target_key ][ $policy_key ] = 0;
            }
            $day[ $target_key ][ $policy_key ] += 1;
        }

        if ( $event_type === 'policy_reorder' ) {
            for ( $i = 0; $i < count( $order ); $i++ ) {
                $rank_key = (string) ( $i + 1 );
                $item_key = sanitize_text_field( $order[ $i ] );

                if ( ! preg_match( '/^[a-zA-Z]+:[0-9]+$/', $item_key ) ) {
                    continue;
                }

                if ( ! isset( $day['priority_rank_counts'][ $rank_key ] ) ) {
                    $day['priority_rank_counts'][ $rank_key ] = array();
                }
                if ( ! isset( $day['priority_rank_counts'][ $rank_key ][ $item_key ] ) ) {
                    $day['priority_rank_counts'][ $rank_key ][ $item_key ] = 0;
                }
                $day['priority_rank_counts'][ $rank_key ][ $item_key ] += 1;
            }

            if ( $rank > 0 ) {
                $rank_key = (string) $rank;
                if ( ! isset( $day['priority_rank_counts'][ $rank_key ] ) ) {
                    $day['priority_rank_counts'][ $rank_key ] = array();
                }
                if ( ! isset( $day['priority_rank_counts'][ $rank_key ][ $policy_key ] ) ) {
                    $day['priority_rank_counts'][ $rank_key ][ $policy_key ] = 0;
                }
                $day['priority_rank_counts'][ $rank_key ][ $policy_key ] += 1;
            }
        }

        if ( $this->geo_enabled() ) {
            if ( ! isset( $day['regions'][ $region_bucket ] ) ) {
                $day['regions'][ $region_bucket ] = 0;
            }
            $day['regions'][ $region_bucket ] += 1;
        }

        update_option( WTC_ANALYTICS_OPTION_KEY, $data, false );
        wp_send_json_success( array( 'ok' => true ) );
    }

    private function get_client_ip() {
        $candidates = array(
            isset( $_SERVER['HTTP_CF_CONNECTING_IP'] ) ? $_SERVER['HTTP_CF_CONNECTING_IP'] : '',
            isset( $_SERVER['HTTP_X_FORWARDED_FOR'] ) ? $_SERVER['HTTP_X_FORWARDED_FOR'] : '',
            isset( $_SERVER['REMOTE_ADDR'] ) ? $_SERVER['REMOTE_ADDR'] : '',
        );

        foreach ( $candidates as $candidate ) {
            if ( ! $candidate ) {
                continue;
            }

            $parts = explode( ',', $candidate );
            $ip    = trim( $parts[0] );

            if ( filter_var( $ip, FILTER_VALIDATE_IP ) ) {
                return $ip;
            }
        }

        return '';
    }

    private function get_geo_context() {
        $ip = $this->get_client_ip();
        if ( ! $ip ) {
            return array(
                'include' => true,
                'bucket'  => 'unknown',
            );
        }

        $cache_key = 'wtc_geo_bucket_' . md5( $ip );
        $cached    = get_transient( $cache_key );
        if ( is_array( $cached ) && isset( $cached['include'], $cached['bucket'] ) ) {
            return array(
                'include' => (bool) $cached['include'],
                'bucket'  => sanitize_text_field( $cached['bucket'] ),
            );
        }
        if ( false !== $cached && is_string( $cached ) ) {
            // Backward compatibility for string-only transient values.
            return array(
                'include' => $cached !== 'outside_michigan',
                'bucket'  => sanitize_text_field( $cached ),
            );
        }

        $url      = 'https://ipapi.co/' . rawurlencode( $ip ) . '/json/';
        $response = wp_remote_get(
            $url,
            array(
                'timeout' => 2,
                'headers' => array(
                    'User-Agent' => 'WordPress/' . get_bloginfo( 'version' ),
                ),
            )
        );

        if ( is_wp_error( $response ) || wp_remote_retrieve_response_code( $response ) !== 200 ) {
            $unknown = array(
                'include' => true,
                'bucket'  => 'unknown',
            );
            set_transient( $cache_key, $unknown, 12 * HOUR_IN_SECONDS );
            return $unknown;
        }

        $body = json_decode( wp_remote_retrieve_body( $response ), true );
        if ( ! is_array( $body ) ) {
            $unknown = array(
                'include' => true,
                'bucket'  => 'unknown',
            );
            set_transient( $cache_key, $unknown, 12 * HOUR_IN_SECONDS );
            return $unknown;
        }

        $country = isset( $body['country_code'] ) ? strtoupper( sanitize_text_field( $body['country_code'] ) ) : '';
        $region  = isset( $body['region_code'] ) ? strtoupper( sanitize_text_field( $body['region_code'] ) ) : '';
        $city    = isset( $body['city'] ) ? sanitize_title( sanitize_text_field( $body['city'] ) ) : '';

        $include = true;
        $bucket  = 'unknown';

        if ( $country !== 'US' ) {
            $include = false;
            $bucket  = 'non_us';
        } elseif ( $region === 'MI' ) {
            $bucket = $city ? 'mi_' . $city : 'mi_unknown';
        } elseif ( $region ) {
            $bucket = 'us_' . strtolower( $region );
        } else {
            $bucket = 'us_unknown';
        }

        $result = array(
            'include' => $include,
            'bucket'  => $bucket,
        );

        set_transient( $cache_key, $result, 24 * HOUR_IN_SECONDS );
        return $result;
    }

    public function prune_old_analytics_data() {
        $data = get_option( WTC_ANALYTICS_OPTION_KEY, array() );
        if ( ! is_array( $data ) || empty( $data ) ) {
            return;
        }

        $cutoff = gmdate( 'Y-m-d', strtotime( '-' . $this->get_retention_days() . ' days' ) );
        foreach ( $data as $date => $day_data ) {
            if ( $date < $cutoff ) {
                unset( $data[ $date ] );
            }
        }

        update_option( WTC_ANALYTICS_OPTION_KEY, $data, false );
    }
}

$wtc_policy_analytics = new WTC_Policy_Analytics();

/**
 * Register the plugin's 5-minute WP-Cron schedule.
 */
function wtc_register_cron_schedule( $schedules ) {
    $schedules[ WTC_UPDATE_CRON_SCHEDULE ] = array(
        'interval' => WTC_CACHE_TTL,
        'display'  => __( 'Every 5 Minutes (Wealth Tax Calculator)', 'wealth-tax-calculator' ),
    );

    return $schedules;
}
add_filter( 'cron_schedules', 'wtc_register_cron_schedule' );

/**
 * Ensure the recurring updater hook exists.
 */
function wtc_schedule_update_checks() {
    if ( ! wp_next_scheduled( WTC_UPDATE_CRON_HOOK ) ) {
        wp_schedule_event( time() + WTC_CACHE_TTL, WTC_UPDATE_CRON_SCHEDULE, WTC_UPDATE_CRON_HOOK );
    }
}

/**
 * Activation hook - runs when plugin is activated
 */
function wtc_activate() {
    // Clear any existing cached data on activation
    global $wpdb;
    $wpdb->query(
        "DELETE FROM {$wpdb->options} 
        WHERE option_name LIKE '_transient_wtc_comparisons_data_%' 
        OR option_name LIKE '_transient_timeout_wtc_comparisons_data_%'"
    );

    wtc_schedule_update_checks();
    
    // Initialize any default options here if needed in the future
    // add_option( 'wtc_plugin_settings', array() );
}
register_activation_hook( __FILE__, 'wtc_activate' );

/**
 * Deactivation hook - clear the recurring updater hook.
 */
function wtc_deactivate() {
    wp_clear_scheduled_hook( WTC_UPDATE_CRON_HOOK );
    delete_transient( 'wtc_updater_install_lock' );
}
register_deactivation_hook( __FILE__, 'wtc_deactivate' );

class Billionaire_Wealth_Tax_Calculator {

    private $plugin_url;
    private $plugin_dir;

    public function __construct() {
        $this->plugin_url = plugin_dir_url( __FILE__ );
        $this->plugin_dir = plugin_dir_path( __FILE__ );

        add_shortcode( 'billionaire_wealth_tax', array( $this, 'render_calculator' ) );
        add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_assets' ) );
    }

    /**
     * Load and cache comparison data from JSON file.
     *
     * @return array Comparison data array.
     */
    private function get_comparisons_data() {
        $cache_key = 'wtc_comparisons_data_v' . WTC_VERSION;
        $cached_data = get_transient( $cache_key );

        if ( false !== $cached_data ) {
            return $cached_data;
        }

        $json_file = $this->plugin_dir . 'data/comparisons.json';
        
        if ( ! file_exists( $json_file ) ) {
            error_log( 'Wealth Tax Calculator: comparisons.json not found' );
            return array();
        }

        $json_content = file_get_contents( $json_file );
        $data = json_decode( $json_content, true );

        if ( json_last_error() !== JSON_ERROR_NONE ) {
            error_log( 'Wealth Tax Calculator: JSON decode error - ' . json_last_error_msg() );
            return array();
        }

        $comparisons = isset( $data['comparisons'] ) ? $data['comparisons'] : array();

        // Cache for 30 days
        set_transient( $cache_key, $comparisons, 30 * DAY_IN_SECONDS );

        return $comparisons;
    }

    /**
     * Enqueue CSS and JavaScript only on pages that contain the shortcode.
     */
    public function enqueue_assets() {
        global $post;

        if ( ! is_a( $post, 'WP_Post' ) || ! has_shortcode( $post->post_content, 'billionaire_wealth_tax' ) ) {
            return;
        }

        // Use minified files in production, source files in debug mode
        $css_file = ( defined( 'WP_DEBUG' ) && WP_DEBUG ) ? 'styles.css' : 'styles.min.css';
        $js_file  = ( defined( 'WP_DEBUG' ) && WP_DEBUG ) ? 'calculator.js' : 'calculator.min.js';

        wp_enqueue_style(
            'wealth-tax-calculator-fontawesome',
            'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css',
            array(),
            '6.5.2'
        );

        wp_enqueue_style(
            'wealth-tax-calculator-styles',
            $this->plugin_url . 'css/' . $css_file,
            array( 'wealth-tax-calculator-fontawesome' ),
            WTC_VERSION
        );

        wp_enqueue_script(
            'wealth-tax-calculator-dragdealer',
            $this->plugin_url . 'js/dragdealer.js',
            array(),
            WTC_VERSION,
            true
        );

        wp_enqueue_script(
            'wealth-tax-calculator-script',
            $this->plugin_url . 'js/' . $js_file,
            array( 'wealth-tax-calculator-dragdealer' ),
            WTC_VERSION,
            true // Load in footer.
        );

        // Inject configuration and data into JavaScript
        wp_localize_script(
            'wealth-tax-calculator-script',
            'wealthTaxConfig',
            array(
                'billionaireWealth' => WTC_BILLIONAIRE_WEALTH,
                'comparisons'       => $this->get_comparisons_data(),
                'version'           => WTC_VERSION,
                'analytics'         => array(
                    'enabled'  => get_option( WTC_ANALYTICS_ENABLED_OPTION, '0' ) === '1',
                    'endpoint' => admin_url( 'admin-ajax.php' ),
                    'nonce'    => wp_create_nonce( 'wtc_track_policy_event' ),
                ),
            )
        );
    }

    private function format_currency( $amount ) {
        if ( $amount >= 1e12 ) {
            return '$' . number_format( $amount / 1e12, 2 ) . ' Trillion';
        }

        if ( $amount >= 1e9 ) {
            return '$' . number_format( $amount / 1e9, 1 ) . ' Billion';
        }

        return '$' . number_format( round( $amount ) );
    }

    private function get_initial_policy_funding_total() {
        return 290e9 + 300e9 + 1.1e12
            + 152e9
            + 2.5e12 + 90e9 + 2.125e12
            + 959e9
            + 856e9
            + 700e9;
    }

    private function get_initial_allocation_summary_markup() {
        $default_tax_rate = 2;
        $revenue          = 4.4e12 * ( $default_tax_rate / 5 );
        $selected_funding = $this->get_initial_policy_funding_total();
        $overrun_amount   = max( $selected_funding - $revenue, 0 );
        $remaining_amount = max( $revenue - $selected_funding, 0 );
        $is_over_budget   = $overrun_amount > 0;

        ob_start();
        ?>
        <div class="allocation-summary<?php echo $is_over_budget ? ' is-over-budget' : ''; ?>">
            <span class="allocation-available-line"><?php echo esc_html( '10-year tax revenue available: ' . $this->format_currency( $revenue ) ); ?></span>
            <span class="allocation-selected-line"><?php echo esc_html( 'Selected policy funding: ' . $this->format_currency( $selected_funding ) ); ?></span>
            <span class="allocation-budget-line<?php echo $is_over_budget ? ' allocation-budget-warning' : ''; ?>">
                <?php echo esc_html( $is_over_budget ? 'Over budget by: ' . $this->format_currency( $overrun_amount ) : 'Remaining revenue: ' . $this->format_currency( $remaining_amount ) ); ?>
            </span>
            <span class="allocation-budget-hint<?php echo $is_over_budget ? ' allocation-overrun-message' : ''; ?>">
                <?php echo esc_html( $is_over_budget ? 'You need to tax billionaires more! Use the button to raise the rate by 1%.' : 'Selected policy costs are within available revenue.' ); ?>
            </span>
        </div>
        <?php

        return ob_get_clean();
    }

    /**
     * Render the calculator HTML for the shortcode.
     *
     * Usage: [billionaire_wealth_tax]
     */
    public function render_calculator( $atts ) {
        ob_start();
        ?>
        <div class="calculator-container wealth-tax-widget mode-advanced">
            <div class="wtc-share-block wtc-share-block-top">
                <div class="container" aria-label="Share this calculator">
                    <div class="share-window">
                        <div class="share-bar">
                            <div class="trigger"><a href="#" data-share-action="facebook" target="_blank" rel="noopener noreferrer" aria-label="Share on Facebook"><i class="fab fa-facebook-f" aria-hidden="true"></i><span class="wtc-sr-only">Facebook</span></a></div>
                            <div class="trigger"><a href="#" data-share-action="twitter" target="_blank" rel="noopener noreferrer" aria-label="Share on X"><i class="fab fa-x-twitter" aria-hidden="true"></i><span class="wtc-sr-only">X</span></a></div>
                            <div class="trigger"><a href="#" data-share-action="bluesky" target="_blank" rel="noopener noreferrer" aria-label="Share on Bluesky"><i class="fab fa-bluesky" aria-hidden="true"></i><span class="wtc-sr-only">Bluesky</span></a></div>
                            <div class="trigger"><a href="#" data-share-action="pinterest" target="_blank" rel="noopener noreferrer" aria-label="Share on Pinterest"><i class="fab fa-pinterest-p" aria-hidden="true"></i><span class="wtc-sr-only">Pinterest</span></a></div>
                            <div class="trigger"><a href="#" data-share-action="linkedin" target="_blank" rel="noopener noreferrer" aria-label="Share on LinkedIn"><i class="fab fa-linkedin-in" aria-hidden="true"></i><span class="wtc-sr-only">LinkedIn</span></a></div>
                            <div class="trigger"><a href="#" data-share-action="whatsapp" target="_blank" rel="noopener noreferrer" aria-label="Share on WhatsApp"><i class="fab fa-whatsapp" aria-hidden="true"></i><span class="wtc-sr-only">WhatsApp</span></a></div>
                            <div class="trigger"><a href="#" data-share-action="email" target="_blank" rel="noopener noreferrer" aria-label="Share by Email"><i class="fas fa-paper-plane" aria-hidden="true"></i><span class="wtc-sr-only">Email</span></a></div>
                        </div>
                    </div>
                    <div class="share">
                        <div class="trigger share-btn"><a href="#" data-share-action="copy" aria-label="Copy share link"><i class="fas fa-plus" aria-hidden="true"></i> Share</a></div>
                    </div>
                    <div class="copy-link">
                        <div class="trigger copy-link-btn"><a href="#" data-share-action="copy" aria-label="Copy link"><i class="fas fa-link" aria-hidden="true"></i> Copy link</a></div>
                    </div>
                </div>
                <p class="wtc-share-status" aria-live="polite"></p>
            </div>

            <div class="calculator-content">
                <div class="calculator-inputs">
                    <div class="mode-toggle-section">
                        <div class="mode-toggle">
                            <button class="mode-button" data-mode="basic">Basic</button>
                            <button class="mode-button active" data-mode="advanced">Advanced</button>
                        </div>
                    </div>

                    <div class="input-section">
                        <h3 class="wtc-step-heading">Step 1: Select Billionaire Taxation Rate</h3>
                        <div class="slider-container wtc-slider-shell">
                            <input type="hidden" id="wtc-taxRate" value="2" aria-label="Tax rate percentage">

                            <div class="wtc-money-stage" aria-hidden="true">
                                <div class="wtc-money-stage-glow"></div>
                                <div class="wtc-money-field" id="wtc-moneyField"></div>
                            </div>

                            <div id="wtc-pr-slider" class="wtc-dragdealer">
                                <div class="wtc-stripe">
                                    <div id="wtc-highlight-fill" class="wtc-highlight-fill"></div>

                                    <div class="handle">
                                        <div class="wtc-infobox" id="wtc-sliderInfobox">
                                            <div class="wtc-titlebar">
                                                <span id="wtc-plan-holder">Tax Rate:</span>
                                                <span id="wtc-device-holder">2.0%</span>
                                            </div>
                                            <div class="wtc-innerbox">
                                                <div class="wtc-annual-label">10-YEAR REVENUE:</div>
                                                <div class="wtc-annual-price" id="wtc-annualPrice">$880.0 Billion</div>
                                            </div>
                                        </div>

                                        <div
                                            class="wtc-square"
                                            id="wtc-sliderHandle"
                                            role="slider"
                                            tabindex="0"
                                            aria-valuemin="1"
                                            aria-valuemax="10"
                                            aria-valuenow="2"
                                            aria-valuetext="2.0%"
                                            aria-label="Tax rate percentage"
                                        >
                                            <span class="value" id="wtc-sliderValue">2.0%</span>
                                            <span class="menu-line"></span>
                                            <span class="menu-line"></span>
                                            <span class="menu-line"></span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="range-labels">
                            <span>1%</span>
                            <span>10%</span>
                        </div>
                    </div>

                    <h3 class="wtc-step-heading">Step 2: Select Your Policies</h3>
                    <div class="policy-allocation-section">
                        <h3 class="policy-header">Allocate Revenue to Policies</h3>
                        <p class="policy-description">Use the checkboxes below to include or exclude individual policy options.</p>

                        <div class="allocation-results" id="wtc-allocationResults">
                            <p class="allocation-prompt">Loading policy options...</p>
                        </div>
                    </div>
                </div>

                <div class="calculator-results">
                    <div class="results-section">
                        <div class="context-box">
                            <h3>What Could This Fund?</h3>
                            <div class="comparison-text" id="wtc-comparisonText">Loading&hellip;</div>
                        </div>

                        <h3 class="wtc-step-heading">Step 3: Prioritize Your Policies</h3>
                        <p class="wtc-step-subheading">Drag and drop policies from top (highest priority) to bottom (lowest priority).</p>
                        <div id="wtc-selectedPoliciesBox" class="selected-policies-box">
                            <h4>
                                Selected Policies
                                <span class="selected-policies-mobile-hint">(click, hold, and drag to reposition)</span>
                            </h4>
                            <div id="wtc-selectedPoliciesList" class="selected-policies-list">
                                <p class="selected-policies-empty">No policies selected yet.</p>
                            </div>
                        </div>

                        <div id="wtc-nextStepWrapper" class="wtc-next-step-wrapper">
                            <button type="button" id="wtc-nextStepButton" class="wtc-next-step-button">
                                Next Step <span aria-hidden="true">&rarr;</span>
                            </button>
                        </div>

                        <div class="sources-box">
                            <h4>Sources</h4>
                            <ol class="sources-list" id="wtc-sourcesList">
                                <li>Loading&hellip;</li>
                            </ol>
                        </div>
                    </div>

                    <div class="info-box">
                        <p class="info-text">
                            This calculator is based on the Forbes 2026 estimate of <strong>$8.2 trillion</strong>
                            in wealth of America's 938 billionaires. Using calculations from economists Emmanuel Saez and
                            Gabriel Zucman, imposing a tax of 5% on this wealth and factoring a 10% tax evasion/avoidance
                            rate would generate $368.5 billion annually and around $4.4 trillion over the ten-year budget
                            window 2026-2037. Tax rates range from 1-10% to show potential revenue at different taxation
                            levels.
                        </p>
                    </div>
                </div>
            </div>

            <div class="wtc-share-block wtc-share-block-bottom">
                <div class="container" aria-label="Share this calculator">
                    <div class="share-window">
                        <div class="share-bar">
                            <div class="trigger"><a href="#" data-share-action="facebook" target="_blank" rel="noopener noreferrer" aria-label="Share on Facebook"><i class="fab fa-facebook-f" aria-hidden="true"></i><span class="wtc-sr-only">Facebook</span></a></div>
                            <div class="trigger"><a href="#" data-share-action="twitter" target="_blank" rel="noopener noreferrer" aria-label="Share on X"><i class="fab fa-x-twitter" aria-hidden="true"></i><span class="wtc-sr-only">X</span></a></div>
                            <div class="trigger"><a href="#" data-share-action="bluesky" target="_blank" rel="noopener noreferrer" aria-label="Share on Bluesky"><i class="fab fa-bluesky" aria-hidden="true"></i><span class="wtc-sr-only">Bluesky</span></a></div>
                            <div class="trigger"><a href="#" data-share-action="pinterest" target="_blank" rel="noopener noreferrer" aria-label="Share on Pinterest"><i class="fab fa-pinterest-p" aria-hidden="true"></i><span class="wtc-sr-only">Pinterest</span></a></div>
                            <div class="trigger"><a href="#" data-share-action="linkedin" target="_blank" rel="noopener noreferrer" aria-label="Share on LinkedIn"><i class="fab fa-linkedin-in" aria-hidden="true"></i><span class="wtc-sr-only">LinkedIn</span></a></div>
                            <div class="trigger"><a href="#" data-share-action="whatsapp" target="_blank" rel="noopener noreferrer" aria-label="Share on WhatsApp"><i class="fab fa-whatsapp" aria-hidden="true"></i><span class="wtc-sr-only">WhatsApp</span></a></div>
                            <div class="trigger"><a href="#" data-share-action="email" target="_blank" rel="noopener noreferrer" aria-label="Share by Email"><i class="fas fa-paper-plane" aria-hidden="true"></i><span class="wtc-sr-only">Email</span></a></div>
                        </div>
                    </div>
                    <div class="share">
                        <div class="trigger share-btn"><a href="#" data-share-action="copy" aria-label="Copy share link"><i class="fas fa-plus" aria-hidden="true"></i> Share</a></div>
                    </div>
                    <div class="copy-link">
                        <div class="trigger copy-link-btn"><a href="#" data-share-action="copy" aria-label="Copy link"><i class="fas fa-link" aria-hidden="true"></i> Copy link</a></div>
                    </div>
                </div>
                <p class="wtc-share-status" aria-live="polite"></p>
            </div>

            <div id="wtc-finalSummary" class="wtc-final-summary" role="region" aria-label="Tax Plan Final Summary" aria-hidden="true">
                <div class="wtc-final-summary-inner">
                    <div class="wtc-final-summary-header">
                        <button type="button" id="wtc-finalSummaryBack" class="wtc-fs-back-button">
                            <span aria-hidden="true">&larr;</span> Back to Calculator
                        </button>
                        <h2 class="wtc-final-summary-title">Your Tax Plan Summary</h2>
                    </div>
                    <div class="wtc-share-block wtc-share-block-summary-top">
                        <div class="container" aria-label="Share this calculator">
                            <div class="share-window">
                                <div class="share-bar">
                                    <div class="trigger"><a href="#" data-share-action="facebook" target="_blank" rel="noopener noreferrer" aria-label="Share on Facebook"><i class="fab fa-facebook-f" aria-hidden="true"></i><span class="wtc-sr-only">Facebook</span></a></div>
                                    <div class="trigger"><a href="#" data-share-action="twitter" target="_blank" rel="noopener noreferrer" aria-label="Share on X"><i class="fab fa-x-twitter" aria-hidden="true"></i><span class="wtc-sr-only">X</span></a></div>
                                    <div class="trigger"><a href="#" data-share-action="bluesky" target="_blank" rel="noopener noreferrer" aria-label="Share on Bluesky"><i class="fab fa-bluesky" aria-hidden="true"></i><span class="wtc-sr-only">Bluesky</span></a></div>
                                    <div class="trigger"><a href="#" data-share-action="pinterest" target="_blank" rel="noopener noreferrer" aria-label="Share on Pinterest"><i class="fab fa-pinterest-p" aria-hidden="true"></i><span class="wtc-sr-only">Pinterest</span></a></div>
                                    <div class="trigger"><a href="#" data-share-action="linkedin" target="_blank" rel="noopener noreferrer" aria-label="Share on LinkedIn"><i class="fab fa-linkedin-in" aria-hidden="true"></i><span class="wtc-sr-only">LinkedIn</span></a></div>
                                    <div class="trigger"><a href="#" data-share-action="whatsapp" target="_blank" rel="noopener noreferrer" aria-label="Share on WhatsApp"><i class="fab fa-whatsapp" aria-hidden="true"></i><span class="wtc-sr-only">WhatsApp</span></a></div>
                                    <div class="trigger"><a href="#" data-share-action="email" target="_blank" rel="noopener noreferrer" aria-label="Share by Email"><i class="fas fa-paper-plane" aria-hidden="true"></i><span class="wtc-sr-only">Email</span></a></div>
                                </div>
                            </div>
                            <div class="share">
                                <div class="trigger share-btn"><a href="#" data-share-action="copy" aria-label="Copy share link"><i class="fas fa-plus" aria-hidden="true"></i> Share</a></div>
                            </div>
                            <div class="copy-link">
                                <div class="trigger copy-link-btn"><a href="#" data-share-action="copy" aria-label="Copy link"><i class="fas fa-link" aria-hidden="true"></i> Copy link</a></div>
                            </div>
                        </div>
                        <p class="wtc-share-status" aria-live="polite"></p>
                    </div>
                    <div id="wtc-finalSummaryBody" class="wtc-final-summary-body"></div>
                    <div class="wtc-share-block wtc-share-block-summary-bottom">
                        <div class="container" aria-label="Share this calculator">
                            <div class="share-window">
                                <div class="share-bar">
                                    <div class="trigger"><a href="#" data-share-action="facebook" target="_blank" rel="noopener noreferrer" aria-label="Share on Facebook"><i class="fab fa-facebook-f" aria-hidden="true"></i><span class="wtc-sr-only">Facebook</span></a></div>
                                    <div class="trigger"><a href="#" data-share-action="twitter" target="_blank" rel="noopener noreferrer" aria-label="Share on X"><i class="fab fa-x-twitter" aria-hidden="true"></i><span class="wtc-sr-only">X</span></a></div>
                                    <div class="trigger"><a href="#" data-share-action="bluesky" target="_blank" rel="noopener noreferrer" aria-label="Share on Bluesky"><i class="fab fa-bluesky" aria-hidden="true"></i><span class="wtc-sr-only">Bluesky</span></a></div>
                                    <div class="trigger"><a href="#" data-share-action="pinterest" target="_blank" rel="noopener noreferrer" aria-label="Share on Pinterest"><i class="fab fa-pinterest-p" aria-hidden="true"></i><span class="wtc-sr-only">Pinterest</span></a></div>
                                    <div class="trigger"><a href="#" data-share-action="linkedin" target="_blank" rel="noopener noreferrer" aria-label="Share on LinkedIn"><i class="fab fa-linkedin-in" aria-hidden="true"></i><span class="wtc-sr-only">LinkedIn</span></a></div>
                                    <div class="trigger"><a href="#" data-share-action="whatsapp" target="_blank" rel="noopener noreferrer" aria-label="Share on WhatsApp"><i class="fab fa-whatsapp" aria-hidden="true"></i><span class="wtc-sr-only">WhatsApp</span></a></div>
                                    <div class="trigger"><a href="#" data-share-action="email" target="_blank" rel="noopener noreferrer" aria-label="Share by Email"><i class="fas fa-paper-plane" aria-hidden="true"></i><span class="wtc-sr-only">Email</span></a></div>
                                </div>
                            </div>
                            <div class="share">
                                <div class="trigger share-btn"><a href="#" data-share-action="copy" aria-label="Copy share link"><i class="fas fa-plus" aria-hidden="true"></i> Share</a></div>
                            </div>
                            <div class="copy-link">
                                <div class="trigger copy-link-btn"><a href="#" data-share-action="copy" aria-label="Copy link"><i class="fas fa-link" aria-hidden="true"></i> Copy link</a></div>
                            </div>
                        </div>
                        <p class="wtc-share-status" aria-live="polite"></p>
                    </div>
                </div>
            </div>
        </div>
        <?php
        return ob_get_clean();
    }
}

new Billionaire_Wealth_Tax_Calculator();
