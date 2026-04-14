<?php
/**
 * Plugin Name: Billionaire Wealth Tax Calculator
 * Plugin URI:  https://github.com/hexa-decim8/Molotools
 * Description: Interactive calculator showing estimated 10-year tax revenue from billionaire wealth at rates of 1%–10%, based on the 2026 Forbes estimate of $8.2 trillion. Embed with [billionaire_wealth_tax].
 * Version:     1.3.30
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
define( 'WTC_VERSION', '1.3.30' );

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
define( 'WTC_ANALYTICS_FINGERPRINT_OPTION', 'wtc_analytics_fingerprint_enabled' );

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
        add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_admin_map_assets' ) );
        add_action( 'admin_post_wtc_reset_analytics', array( $this, 'handle_reset_analytics' ) );
        add_action( 'wp_ajax_wtc_track_policy_event', array( $this, 'track_policy_event' ) );
        add_action( 'wp_ajax_nopriv_wtc_track_policy_event', array( $this, 'track_policy_event' ) );
        add_action( WTC_UPDATE_CRON_HOOK, array( $this, 'prune_old_analytics_data' ) );
    }

    public function enqueue_admin_map_assets( $hook ) {
        if ( 'settings_page_wealth-tax-calculator-analytics' !== $hook ) {
            return;
        }
        wp_enqueue_style(
            'wtc-admin-map',
            plugin_dir_url( __FILE__ ) . 'css/admin-map.css',
            array(),
            WTC_VERSION
        );
        wp_enqueue_script(
            'wtc-admin-map',
            plugin_dir_url( __FILE__ ) . 'js/admin-map.js',
            array(),
            WTC_VERSION,
            true
        );

        $analytics_data = get_option( WTC_ANALYTICS_OPTION_KEY, array() );
        if ( ! is_array( $analytics_data ) ) {
            $analytics_data = array();
        }
        $summary       = $this->build_summary( $analytics_data );
        $region_counts = isset( $summary['region_counts'] ) ? $summary['region_counts'] : array();
        $county_counts = isset( $summary['county_counts'] ) ? $summary['county_counts'] : array();
        $us_states     = $this->aggregate_us_state_counts( $region_counts );

        $mi_cities = array();
        foreach ( $region_counts as $bucket => $count ) {
            if ( strncmp( $bucket, 'mi_', 3 ) === 0 && 'mi_unknown' !== $bucket ) {
                $mi_cities[ substr( $bucket, 3 ) ] = (int) $count;
            }
        }

        $us_states = array();
        foreach ( $region_counts as $bucket => $count ) {
            if ( strncmp( $bucket, 'us_', 3 ) !== 0 || 'us_unknown' === $bucket ) {
                continue;
            }

            $state_code = strtoupper( substr( $bucket, 3 ) );
            if ( 'MI' === $state_code || ! preg_match( '/^[A-Z]{2}$/', $state_code ) ) {
                continue;
            }

            $us_states[ $state_code ] = (int) $count;
        }

        wp_localize_script(
            'wtc-admin-map',
            'wtcMichiganMap',
            array(
                'cities'   => $mi_cities,
                'counties' => $mi_counties,
            )
        );

        wp_localize_script(
            'wtc-admin-map',
            'wtcUsMap',
            array(
                'states' => $us_states,
            )
        );
        wp_localize_script(
            'wtc-admin-map',
            'wtcUnitedStatesMap',
            array( 'states' => $us_states )
        );
    }

    public function is_enabled() {
        return get_option( WTC_ANALYTICS_ENABLED_OPTION, '0' ) === '1';
    }

    public function geo_enabled() {
        return get_option( WTC_ANALYTICS_GEO_OPTION, '0' ) === '1';
    }

    public function fingerprint_enabled() {
        return get_option( WTC_ANALYTICS_FINGERPRINT_OPTION, '1' ) === '1';
    }

    public function get_retention_days() {
        $days = (int) get_option( WTC_ANALYTICS_RETENTION_OPTION, 90 );
        return max( 7, min( 365, $days ) );
    }

    public function get_frontend_popularity_summary() {
        if ( ! $this->is_enabled() ) {
            return array(
                'enabled_rows'  => array(),
                'top_rank_rows' => array(),
            );
        }

        $analytics_data = get_option( WTC_ANALYTICS_OPTION_KEY, array() );
        if ( ! is_array( $analytics_data ) ) {
            $analytics_data = array();
        }

        $summary = $this->build_summary( $analytics_data );

        return array(
            'enabled_rows'  => isset( $summary['enabled_rows'] ) && is_array( $summary['enabled_rows'] ) ? $summary['enabled_rows'] : array(),
            'top_rank_rows' => isset( $summary['top_rank_rows'] ) && is_array( $summary['top_rank_rows'] ) ? $summary['top_rank_rows'] : array(),
        );
    }

    public function register_settings() {
        register_setting( 'wtc_analytics_settings', WTC_ANALYTICS_ENABLED_OPTION, array( $this, 'sanitize_checkbox_flag' ) );
        register_setting( 'wtc_analytics_settings', WTC_ANALYTICS_GEO_OPTION, array( $this, 'sanitize_checkbox_flag' ) );
        register_setting( 'wtc_analytics_settings', WTC_ANALYTICS_FINGERPRINT_OPTION, array( $this, 'sanitize_checkbox_flag' ) );
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
        $submitted_sessions = isset( $summary['total_events'] ) ? (int) $summary['total_events'] : 0;
        $unique_sessions    = isset( $summary['unique_sessions'] ) ? (int) $summary['unique_sessions'] : 0;
        $days_stored        = isset( $summary['days_count'] ) ? (int) $summary['days_count'] : 0;
        $average_tax_rate   = isset( $summary['average_tax_rate'] ) ? (float) $summary['average_tax_rate'] : 0.0;
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
                                    <?php esc_html_e( 'Filter to US-only responses', 'wealth-tax-calculator' ); ?>
                                </label>
                                <p class="description"><?php esc_html_e( 'Coarse IP-based region tracking is always active (state-level for US, city-level plus inferred county buckets for Michigan). When this option is enabled, non-US visitors are excluded from analytics entirely. No raw IP addresses are stored.', 'wealth-tax-calculator' ); ?></p>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row"><?php esc_html_e( 'Cross-Session Tracking', 'wealth-tax-calculator' ); ?></th>
                            <td>
                                <label>
                                    <input type="hidden" name="<?php echo esc_attr( WTC_ANALYTICS_FINGERPRINT_OPTION ); ?>" value="0" />
                                    <input type="checkbox" name="<?php echo esc_attr( WTC_ANALYTICS_FINGERPRINT_OPTION ); ?>" value="1" <?php checked( $this->fingerprint_enabled(), true ); ?> />
                                    <?php esc_html_e( 'Track how selections change between visits from the same visitor', 'wealth-tax-calculator' ); ?>
                                </label>
                                <p class="description"><?php esc_html_e( 'A privacy-safe fingerprint (hashed IP + browser signature, salted and non-reversible) is recorded alongside each submission. This lets the analytics page show when the same visitor returns and changes their tax rate, policy selections, or priority order. No raw IP addresses are stored.', 'wealth-tax-calculator' ); ?></p>
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

            <div class="card wtc-analytics-card" style="max-width: 920px; margin-top: 20px;">
                <h2><?php esc_html_e( 'Visual Summary', 'wealth-tax-calculator' ); ?></h2>

                <div class="wtc-analytics-stats" role="list" aria-label="<?php esc_attr_e( 'Analytics summary metrics', 'wealth-tax-calculator' ); ?>">
                    <div class="wtc-analytics-stat" role="listitem">
                        <span class="wtc-analytics-stat-label"><?php esc_html_e( 'Submitted Sessions', 'wealth-tax-calculator' ); ?></span>
                        <span class="wtc-analytics-stat-value"><?php echo esc_html( number_format_i18n( $submitted_sessions ) ); ?></span>
                    </div>
                    <div class="wtc-analytics-stat" role="listitem">
                        <span class="wtc-analytics-stat-label"><?php esc_html_e( 'Unique Sessions', 'wealth-tax-calculator' ); ?></span>
                        <span class="wtc-analytics-stat-value"><?php echo esc_html( number_format_i18n( $unique_sessions ) ); ?></span>
                    </div>
                    <div class="wtc-analytics-stat" role="listitem">
                        <span class="wtc-analytics-stat-label"><?php esc_html_e( 'Average Tax Rate', 'wealth-tax-calculator' ); ?></span>
                        <span class="wtc-analytics-stat-value"><?php echo esc_html( $average_tax_rate > 0 ? number_format_i18n( $average_tax_rate, 1 ) . '%' : '—' ); ?></span>
                    </div>
                    <?php if ( $this->fingerprint_enabled() ) : ?>
                    <div class="wtc-analytics-stat" role="listitem">
                        <span class="wtc-analytics-stat-label"><?php esc_html_e( 'Repeat Visitors', 'wealth-tax-calculator' ); ?></span>
                        <span class="wtc-analytics-stat-value"><?php echo esc_html( number_format_i18n( $repeat_fingerprints ) ); ?></span>
                    </div>
                    <div class="wtc-analytics-stat" role="listitem">
                        <span class="wtc-analytics-stat-label"><?php esc_html_e( 'Change Events', 'wealth-tax-calculator' ); ?></span>
                        <span class="wtc-analytics-stat-value"><?php echo esc_html( number_format_i18n( $change_events_total ) ); ?></span>
                    </div>
                    <?php endif; ?>
                </div>

                <div class="wtc-analytics-chart-panel">
                    <section class="wtc-analytics-chart-card">
                        <h3 class="wtc-analytics-chart-title"><?php esc_html_e( 'Category Allocation Mix', 'wealth-tax-calculator' ); ?></h3>
                        <?php if ( ! empty( $summary['policy_group_rows'] ) && is_array( $summary['policy_group_rows'] ) ) : ?>
                            <?php
                            $group_total = 0;
                            foreach ( $summary['policy_group_rows'] as $group_row ) {
                                if ( ! is_array( $group_row ) ) {
                                    continue;
                                }
                                $group_total += isset( $group_row['selected_amount'] ) ? (int) $group_row['selected_amount'] : 0;
                            }
                            ?>
                            <div class="wtc-analytics-stacked-bar" role="img" aria-label="<?php esc_attr_e( 'Category allocation mix', 'wealth-tax-calculator' ); ?>">
                                <?php foreach ( $summary['policy_group_rows'] as $group_row ) : ?>
                                    <?php
                                    if ( ! is_array( $group_row ) ) {
                                        continue;
                                    }

                                    $selected_amount = isset( $group_row['selected_amount'] ) ? (int) $group_row['selected_amount'] : 0;
                                    if ( $selected_amount <= 0 || $group_total <= 0 ) {
                                        continue;
                                    }

                                    $segment_width = max( 2, round( ( $selected_amount / $group_total ) * 100, 2 ) );
                                    $segment_title = sprintf(
                                        /* translators: 1: policy group label, 2: selected amount */
                                        __( '%1$s: %2$s selected over 10 years', 'wealth-tax-calculator' ),
                                        isset( $group_row['label'] ) ? sanitize_text_field( $group_row['label'] ) : __( 'Unknown', 'wealth-tax-calculator' ),
                                        $this->format_compact_currency( $selected_amount )
                                    );
                                    ?>
                                    <span class="wtc-analytics-stacked-segment" style="width: <?php echo esc_attr( $segment_width ); ?>%; background: <?php echo esc_attr( isset( $group_row['color'] ) ? sanitize_hex_color( $group_row['color'] ) : '#406BBF' ); ?>;" title="<?php echo esc_attr( $segment_title ); ?>"></span>
                                <?php endforeach; ?>
                            </div>

                            <div class="wtc-analytics-legend">
                                <?php foreach ( $summary['policy_group_rows'] as $group_row ) : ?>
                                    <?php
                                    if ( ! is_array( $group_row ) ) {
                                        continue;
                                    }
                                    $selected_amount = isset( $group_row['selected_amount'] ) ? (int) $group_row['selected_amount'] : 0;
                                    if ( $selected_amount <= 0 ) {
                                        continue;
                                    }
                                    ?>
                                    <div class="wtc-analytics-legend-item">
                                        <span class="wtc-analytics-legend-swatch" style="background: <?php echo esc_attr( isset( $group_row['color'] ) ? sanitize_hex_color( $group_row['color'] ) : '#406BBF' ); ?>"></span>
                                        <span class="wtc-analytics-legend-label"><?php echo esc_html( isset( $group_row['label'] ) ? sanitize_text_field( $group_row['label'] ) : __( 'Unknown', 'wealth-tax-calculator' ) ); ?></span>
                                        <span class="wtc-analytics-legend-value"><?php echo esc_html( $this->format_compact_currency( $selected_amount ) ); ?></span>
                                    </div>
                                <?php endforeach; ?>
                            </div>
                        <?php else : ?>
                            <p class="wtc-analytics-empty"><?php esc_html_e( 'Category mix appears after submissions are recorded.', 'wealth-tax-calculator' ); ?></p>
                        <?php endif; ?>
                    </section>

                    <section class="wtc-analytics-chart-card">
                        <h3 class="wtc-analytics-chart-title"><?php esc_html_e( 'Policy Popularity', 'wealth-tax-calculator' ); ?></h3>

                        <div class="wtc-analytics-chart-toggle" role="tablist" aria-label="<?php esc_attr_e( 'Policy popularity mode', 'wealth-tax-calculator' ); ?>">
                            <button type="button" class="wtc-analytics-toggle-btn is-active" data-wtc-target="enabled" role="tab" aria-selected="true"><?php esc_html_e( 'Most Selected', 'wealth-tax-calculator' ); ?></button>
                            <button type="button" class="wtc-analytics-toggle-btn" data-wtc-target="top-rank" role="tab" aria-selected="false"><?php esc_html_e( 'Top Ranked #1', 'wealth-tax-calculator' ); ?></button>
                        </div>

                        <div class="wtc-analytics-popularity-panel is-active" data-wtc-panel="enabled">
                            <?php $this->render_analytics_popularity_chart( isset( $summary['enabled_rows'] ) ? $summary['enabled_rows'] : array(), __( 'Popularity data appears after submissions are recorded.', 'wealth-tax-calculator' ) ); ?>
                        </div>
                        <div class="wtc-analytics-popularity-panel" data-wtc-panel="top-rank" hidden>
                            <?php $this->render_analytics_popularity_chart( isset( $summary['top_rank_rows'] ) ? $summary['top_rank_rows'] : array(), __( 'Top-rank data appears after submissions are recorded.', 'wealth-tax-calculator' ) ); ?>
                        </div>
                    </section>
                </div>
            </div>

            <?php $this->render_us_map( $summary['region_counts'] ); ?>

            <?php $this->render_michigan_map( $summary['region_counts'] ); ?>

            <div class="card" style="max-width: 920px; margin-top: 20px;">
                <h2><?php esc_html_e( 'Most Selected Sub-Policies (Final Submissions)', 'wealth-tax-calculator' ); ?></h2>
                <?php $this->render_policy_count_table( $summary['enabled_rows'], __( 'Sessions selected', 'wealth-tax-calculator' ) ); ?>
            </div>

            <div class="card" style="max-width: 920px; margin-top: 20px;">
                <h2><?php esc_html_e( 'Most Prioritized (Rank #1)', 'wealth-tax-calculator' ); ?></h2>
                <?php $this->render_policy_count_table( $summary['top_rank_rows'], __( 'Times ranked #1', 'wealth-tax-calculator' ) ); ?>
            </div>

            <div class="card" style="max-width: 920px; margin-top: 20px;">
                <h2><?php esc_html_e( 'Priority Rank Breakdown', 'wealth-tax-calculator' ); ?></h2>
                <?php $this->render_rank_breakdown_table( $summary['rank_rows'] ); ?>
            </div>

            <div class="card" style="max-width: 920px; margin-top: 20px;">
                <h2><?php esc_html_e( 'Region Buckets', 'wealth-tax-calculator' ); ?></h2>
                <p class="description"><?php esc_html_e( 'Includes all tracked regions. Michigan uses mi_* buckets; other US states use us_* buckets (for example, us_md for Maryland).', 'wealth-tax-calculator' ); ?></p>
                <?php $this->render_simple_count_table( $summary['region_counts'], __( 'Region bucket', 'wealth-tax-calculator' ), __( 'Submitted sessions', 'wealth-tax-calculator' ), 100 ); ?>
            </div>

            <div class="card" style="max-width: 920px; margin-top: 20px;">
                <h2><?php esc_html_e( 'Michigan County Buckets', 'wealth-tax-calculator' ); ?></h2>
                <?php $this->render_county_count_table( $summary['county_counts'] ); ?>
            </div>

            <div class="card" style="max-width: 920px; margin-top: 20px;">
                <h2><?php esc_html_e( 'Tax Rate Distribution', 'wealth-tax-calculator' ); ?></h2>
                <?php $this->render_simple_count_table( $summary['tax_rate_counts'], __( 'Tax rate (%)', 'wealth-tax-calculator' ), __( 'Submitted sessions', 'wealth-tax-calculator' ) ); ?>
            </div>

            <div class="card" style="max-width: 920px; margin-top: 20px;">
                <h2><?php esc_html_e( 'Recent Submission Detail', 'wealth-tax-calculator' ); ?></h2>
                <?php $this->render_recent_submissions_table( $summary['recent_submissions'] ); ?>
            </div>

            <?php if ( $this->fingerprint_enabled() ) : ?>
            <div class="card" style="max-width: 920px; margin-top: 20px;">
                <h2><?php esc_html_e( 'Cross-Session Changes (Same Visitor)', 'wealth-tax-calculator' ); ?></h2>
                <?php $this->render_cross_session_changes_table( isset( $summary['cross_session_changes'] ) ? $summary['cross_session_changes'] : array() ); ?>
            </div>
            <?php endif; ?>
            </div>

            <div class="wtc-analytics-section-panel" data-wtc-section-panel="michigan" hidden>

            <div class="card wtc-analytics-card" style="max-width: 920px; margin-top: 20px;">
                <h2><?php esc_html_e( 'Michigan-Only Statistics (Excludes Non-Michigan Data)', 'wealth-tax-calculator' ); ?></h2>
                <p class="description"><?php esc_html_e( 'This section only includes Michigan buckets (mi_* and mi_county_*), including unknown Michigan buckets. All non-Michigan buckets such as us_* and non_us are excluded.', 'wealth-tax-calculator' ); ?></p>

                <div class="wtc-analytics-stats" role="list" aria-label="<?php esc_attr_e( 'Michigan-only analytics summary metrics', 'wealth-tax-calculator' ); ?>">
                    <div class="wtc-analytics-stat" role="listitem">
                        <span class="wtc-analytics-stat-label"><?php esc_html_e( 'Michigan Submitted Sessions', 'wealth-tax-calculator' ); ?></span>
                        <span class="wtc-analytics-stat-value"><?php echo esc_html( number_format_i18n( $mi_submitted_sessions ) ); ?></span>
                    </div>
                    <div class="wtc-analytics-stat" role="listitem">
                        <span class="wtc-analytics-stat-label"><?php esc_html_e( 'Michigan Unique Sessions', 'wealth-tax-calculator' ); ?></span>
                        <span class="wtc-analytics-stat-value"><?php echo esc_html( number_format_i18n( $mi_unique_sessions ) ); ?></span>
                    </div>
                    <div class="wtc-analytics-stat" role="listitem">
                        <span class="wtc-analytics-stat-label"><?php esc_html_e( 'Michigan Days Stored', 'wealth-tax-calculator' ); ?></span>
                        <span class="wtc-analytics-stat-value"><?php echo esc_html( number_format_i18n( $mi_days_stored ) ); ?></span>
                    </div>
                    <?php if ( $this->fingerprint_enabled() ) : ?>
                    <div class="wtc-analytics-stat" role="listitem">
                        <span class="wtc-analytics-stat-label"><?php esc_html_e( 'Michigan Repeat Visitors', 'wealth-tax-calculator' ); ?></span>
                        <span class="wtc-analytics-stat-value"><?php echo esc_html( number_format_i18n( $mi_repeat_fingerprints ) ); ?></span>
                    </div>
                    <div class="wtc-analytics-stat" role="listitem">
                        <span class="wtc-analytics-stat-label"><?php esc_html_e( 'Michigan Change Events', 'wealth-tax-calculator' ); ?></span>
                        <span class="wtc-analytics-stat-value"><?php echo esc_html( number_format_i18n( $mi_change_events_total ) ); ?></span>
                    </div>
                    <?php endif; ?>
                </div>

                <h3><?php esc_html_e( 'Most Selected Sub-Policies (Michigan)', 'wealth-tax-calculator' ); ?></h3>
                <?php $this->render_policy_count_table( isset( $mi_summary['enabled_rows'] ) ? $mi_summary['enabled_rows'] : array(), __( 'Sessions selected', 'wealth-tax-calculator' ) ); ?>

                <h3><?php esc_html_e( 'Most Prioritized (Rank #1, Michigan)', 'wealth-tax-calculator' ); ?></h3>
                <?php $this->render_policy_count_table( isset( $mi_summary['top_rank_rows'] ) ? $mi_summary['top_rank_rows'] : array(), __( 'Times ranked #1', 'wealth-tax-calculator' ) ); ?>

                <h3><?php esc_html_e( 'Priority Rank Breakdown (Michigan)', 'wealth-tax-calculator' ); ?></h3>
                <?php $this->render_rank_breakdown_table( isset( $mi_summary['rank_rows'] ) ? $mi_summary['rank_rows'] : array() ); ?>

                <h3><?php esc_html_e( 'Michigan Region Buckets', 'wealth-tax-calculator' ); ?></h3>
                <?php $this->render_simple_count_table( isset( $mi_summary['region_counts'] ) ? $mi_summary['region_counts'] : array(), __( 'Region bucket', 'wealth-tax-calculator' ), __( 'Submitted sessions', 'wealth-tax-calculator' ), 100 ); ?>

                <h3><?php esc_html_e( 'Michigan County Buckets', 'wealth-tax-calculator' ); ?></h3>
                <?php $this->render_county_count_table( isset( $mi_summary['county_counts'] ) ? $mi_summary['county_counts'] : array() ); ?>

                <h3><?php esc_html_e( 'Tax Rate Distribution (Michigan)', 'wealth-tax-calculator' ); ?></h3>
                <?php $this->render_simple_count_table( isset( $mi_summary['tax_rate_counts'] ) ? $mi_summary['tax_rate_counts'] : array(), __( 'Tax rate (%)', 'wealth-tax-calculator' ), __( 'Submitted sessions', 'wealth-tax-calculator' ) ); ?>

                <h3><?php esc_html_e( 'Recent Submission Detail (Michigan)', 'wealth-tax-calculator' ); ?></h3>
                <?php $this->render_recent_submissions_table( isset( $mi_summary['recent_submissions'] ) ? $mi_summary['recent_submissions'] : array() ); ?>
            </div>
            </div>

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

    private function get_policy_group_palette() {
        return array(
            'healthcare'   => array( 'label' => __( 'Healthcare', 'wealth-tax-calculator' ), 'color' => '#D1495B' ),
            'education'    => array( 'label' => __( 'Education', 'wealth-tax-calculator' ), 'color' => '#2B59C3' ),
            'business'     => array( 'label' => __( 'Tax Relief', 'wealth-tax-calculator' ), 'color' => '#2A9D8F' ),
            'directrelief' => array( 'label' => __( 'Direct Relief', 'wealth-tax-calculator' ), 'color' => '#F4A261' ),
            'housing'      => array( 'label' => __( 'Housing', 'wealth-tax-calculator' ), 'color' => '#7B2CBF' ),
            'childcare'    => array( 'label' => __( 'Childcare & Families', 'wealth-tax-calculator' ), 'color' => '#3A86FF' ),
        );
    }

    private function get_chart_swatches() {
        return array( '#D1495B', '#2B59C3', '#2A9D8F', '#F4A261', '#7B2CBF', '#3A86FF', '#EF476F', '#118AB2', '#06D6A0', '#FFD166', '#8338EC', '#8E9AAF' );
    }

    private function get_policy_group_label( $policy_group ) {
        $policy_group = sanitize_key( $policy_group );
        $palette      = $this->get_policy_group_palette();
        if ( isset( $palette[ $policy_group ]['label'] ) ) {
            return $palette[ $policy_group ]['label'];
        }

        return ucwords( str_replace( array( '-', '_' ), ' ', $policy_group ) );
    }

    private function get_policy_group_color( $policy_group ) {
        $policy_group = sanitize_key( $policy_group );
        $palette      = $this->get_policy_group_palette();
        if ( isset( $palette[ $policy_group ]['color'] ) ) {
            return $palette[ $policy_group ]['color'];
        }

        return '#406BBF';
    }

    private function format_compact_currency( $amount ) {
        $amount = (float) $amount;

        if ( $amount >= 1e12 ) {
            return '$' . number_format( $amount / 1e12, 2 ) . 'T';
        }

        if ( $amount >= 1e9 ) {
            return '$' . number_format( $amount / 1e9, 1 ) . 'B';
        }

        return '$' . number_format_i18n( (int) round( $amount ) );
    }

    private function render_analytics_popularity_chart( $rows, $empty_text ) {
        $rows = is_array( $rows ) ? $rows : array();
        $rows = array_values( $rows );

        $normalized_rows = array();
        $total_count     = 0;

        foreach ( $rows as $row ) {
            if ( ! is_array( $row ) ) {
                continue;
            }

            $count = isset( $row['count'] ) ? (int) $row['count'] : 0;
            if ( $count <= 0 ) {
                continue;
            }

            $normalized_rows[] = array(
                'label' => isset( $row['label'] ) ? sanitize_text_field( $row['label'] ) : '',
                'count' => $count,
            );
            $total_count += $count;
        }

        if ( $total_count <= 0 || empty( $normalized_rows ) ) {
            echo '<p class="wtc-analytics-empty">' . esc_html( $empty_text ) . '</p>';
            return;
        }

        $swatches       = $this->get_chart_swatches();
        $gradient_parts = array();
        $current_angle  = 0.0;

        foreach ( $normalized_rows as $index => $row ) {
            $ratio      = $row['count'] / $total_count;
            $next_angle = $current_angle + ( $ratio * 360 );
            $color      = $swatches[ $index % count( $swatches ) ];

            $normalized_rows[ $index ]['color']   = $color;
            $normalized_rows[ $index ]['percent'] = round( $ratio * 100, 1 );

            $gradient_parts[] = $color . ' ' . number_format( $current_angle, 2, '.', '' ) . 'deg ' . number_format( $next_angle, 2, '.', '' ) . 'deg';
            $current_angle    = $next_angle;
        }

        echo '<div class="wtc-analytics-donut" role="img" aria-label="' . esc_attr__( 'Policy popularity chart', 'wealth-tax-calculator' ) . '" style="background: conic-gradient(' . esc_attr( implode( ', ', $gradient_parts ) ) . ');"></div>';
        echo '<div class="wtc-analytics-legend wtc-analytics-legend-scroll">';

        foreach ( $normalized_rows as $row ) {
            echo '<div class="wtc-analytics-legend-item">';
            echo '<span class="wtc-analytics-legend-swatch" style="background:' . esc_attr( sanitize_hex_color( $row['color'] ) ) . '"></span>';
            echo '<span class="wtc-analytics-legend-label">' . esc_html( $row['label'] ) . '</span>';
            echo '<span class="wtc-analytics-legend-value">' . esc_html( number_format_i18n( $row['count'] ) . ' (' . number_format_i18n( $row['percent'], 1 ) . '%)' ) . '</span>';
            echo '</div>';
        }

        echo '</div>';
    }

    private function get_us_state_code_map() {
        return array(
            'AL' => __( 'Alabama', 'wealth-tax-calculator' ),
            'AK' => __( 'Alaska', 'wealth-tax-calculator' ),
            'AZ' => __( 'Arizona', 'wealth-tax-calculator' ),
            'AR' => __( 'Arkansas', 'wealth-tax-calculator' ),
            'CA' => __( 'California', 'wealth-tax-calculator' ),
            'CO' => __( 'Colorado', 'wealth-tax-calculator' ),
            'CT' => __( 'Connecticut', 'wealth-tax-calculator' ),
            'DE' => __( 'Delaware', 'wealth-tax-calculator' ),
            'FL' => __( 'Florida', 'wealth-tax-calculator' ),
            'GA' => __( 'Georgia', 'wealth-tax-calculator' ),
            'HI' => __( 'Hawaii', 'wealth-tax-calculator' ),
            'ID' => __( 'Idaho', 'wealth-tax-calculator' ),
            'IL' => __( 'Illinois', 'wealth-tax-calculator' ),
            'IN' => __( 'Indiana', 'wealth-tax-calculator' ),
            'IA' => __( 'Iowa', 'wealth-tax-calculator' ),
            'KS' => __( 'Kansas', 'wealth-tax-calculator' ),
            'KY' => __( 'Kentucky', 'wealth-tax-calculator' ),
            'LA' => __( 'Louisiana', 'wealth-tax-calculator' ),
            'ME' => __( 'Maine', 'wealth-tax-calculator' ),
            'MD' => __( 'Maryland', 'wealth-tax-calculator' ),
            'MA' => __( 'Massachusetts', 'wealth-tax-calculator' ),
            'MI' => __( 'Michigan', 'wealth-tax-calculator' ),
            'MN' => __( 'Minnesota', 'wealth-tax-calculator' ),
            'MS' => __( 'Mississippi', 'wealth-tax-calculator' ),
            'MO' => __( 'Missouri', 'wealth-tax-calculator' ),
            'MT' => __( 'Montana', 'wealth-tax-calculator' ),
            'NE' => __( 'Nebraska', 'wealth-tax-calculator' ),
            'NV' => __( 'Nevada', 'wealth-tax-calculator' ),
            'NH' => __( 'New Hampshire', 'wealth-tax-calculator' ),
            'NJ' => __( 'New Jersey', 'wealth-tax-calculator' ),
            'NM' => __( 'New Mexico', 'wealth-tax-calculator' ),
            'NY' => __( 'New York', 'wealth-tax-calculator' ),
            'NC' => __( 'North Carolina', 'wealth-tax-calculator' ),
            'ND' => __( 'North Dakota', 'wealth-tax-calculator' ),
            'OH' => __( 'Ohio', 'wealth-tax-calculator' ),
            'OK' => __( 'Oklahoma', 'wealth-tax-calculator' ),
            'OR' => __( 'Oregon', 'wealth-tax-calculator' ),
            'PA' => __( 'Pennsylvania', 'wealth-tax-calculator' ),
            'RI' => __( 'Rhode Island', 'wealth-tax-calculator' ),
            'SC' => __( 'South Carolina', 'wealth-tax-calculator' ),
            'SD' => __( 'South Dakota', 'wealth-tax-calculator' ),
            'TN' => __( 'Tennessee', 'wealth-tax-calculator' ),
            'TX' => __( 'Texas', 'wealth-tax-calculator' ),
            'UT' => __( 'Utah', 'wealth-tax-calculator' ),
            'VT' => __( 'Vermont', 'wealth-tax-calculator' ),
            'VA' => __( 'Virginia', 'wealth-tax-calculator' ),
            'WA' => __( 'Washington', 'wealth-tax-calculator' ),
            'WV' => __( 'West Virginia', 'wealth-tax-calculator' ),
            'WI' => __( 'Wisconsin', 'wealth-tax-calculator' ),
            'WY' => __( 'Wyoming', 'wealth-tax-calculator' ),
        );
    }

    private function aggregate_us_state_counts( array $region_counts ) {
        $state_map    = $this->get_us_state_code_map();
        $state_counts = array();
        foreach ( $state_map as $code => $label ) {
            $state_counts[ $code ] = 0;
        }

        $michigan_total = 0;
        foreach ( $region_counts as $bucket => $count ) {
            $bucket = sanitize_text_field( $bucket );
            $count  = (int) $count;
            if ( $count <= 0 ) {
                continue;
            }

            if ( strncmp( $bucket, 'mi_', 3 ) === 0 ) {
                $michigan_total += $count;
                continue;
            }

            if ( strncmp( $bucket, 'us_', 3 ) !== 0 ) {
                continue;
            }

            $state_code = strtoupper( substr( $bucket, 3 ) );
            if ( isset( $state_counts[ $state_code ] ) ) {
                $state_counts[ $state_code ] += $count;
            }
        }

        $state_counts['MI'] += $michigan_total;

        return $state_counts;
    }

    private function render_us_state_map( array $region_counts ) {
        $state_counts = $this->aggregate_us_state_counts( $region_counts );
        $state_map    = $this->get_us_state_code_map();
        $has_data     = false;
        foreach ( $state_counts as $count ) {
            if ( (int) $count > 0 ) {
                $has_data = true;
                break;
            }
        }
        ?>
        <div class="card wtc-us-map-card" style="max-width: 920px; margin-top: 20px;">
            <h2><?php esc_html_e( 'US Visitors Map', 'wealth-tax-calculator' ); ?></h2>
            <p class="description"><?php esc_html_e( 'All 50 states are shown. Tile intensity increases with submitted sessions.', 'wealth-tax-calculator' ); ?></p>
            <?php if ( ! $has_data ) : ?>
                <p><?php esc_html_e( 'No US state visitor data yet. Tiles are shown with zero counts until submissions are recorded.', 'wealth-tax-calculator' ); ?></p>
            <?php endif; ?>
            <div class="wtc-us-map-wrap">
                <div id="wtc-us-state-map" role="img" aria-label="<?php esc_attr_e( 'US state visitor heat map', 'wealth-tax-calculator' ); ?>"></div>
                <div id="wtc-us-map-tooltip"></div>
            </div>
            <div class="wtc-us-map-legend" aria-hidden="true">
                <span class="wtc-us-map-legend-swatch wtc-us-map-legend-low"></span>
                <span><?php esc_html_e( 'Lower session volume', 'wealth-tax-calculator' ); ?></span>
                <span class="wtc-us-map-legend-swatch wtc-us-map-legend-high"></span>
                <span><?php esc_html_e( 'Higher session volume', 'wealth-tax-calculator' ); ?></span>
            </div>
            <details class="wtc-us-map-state-summary">
                <summary><?php esc_html_e( 'State totals', 'wealth-tax-calculator' ); ?></summary>
                <table class="widefat striped">
                    <thead>
                        <tr>
                            <th><?php esc_html_e( 'State', 'wealth-tax-calculator' ); ?></th>
                            <th><?php esc_html_e( 'Submitted sessions', 'wealth-tax-calculator' ); ?></th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ( $state_map as $code => $label ) : ?>
                            <tr>
                                <td><?php echo esc_html( $label . ' (' . $code . ')' ); ?></td>
                                <td><?php echo esc_html( number_format_i18n( isset( $state_counts[ $code ] ) ? (int) $state_counts[ $code ] : 0 ) ); ?></td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </details>
        </div>
        <?php
    }

    private function render_michigan_map( array $region_counts ) {
        $mi_cities  = array();
        $mi_unknown = 0;
        foreach ( $region_counts as $bucket => $count ) {
            if ( strncmp( $bucket, 'mi_', 3 ) !== 0 ) {
                continue;
            }
            if ( 'mi_unknown' === $bucket ) {
                $mi_unknown += (int) $count;
            } else {
                $mi_cities[ substr( $bucket, 3 ) ] = (int) $count;
            }
        }

        $svg_path = plugin_dir_path( __FILE__ ) . 'data/michigan-counties.svg';
        $has_data = ! empty( $mi_cities ) || $mi_unknown > 0;
        ?>
        <div class="card wtc-mi-map-card" style="max-width: 920px; margin-top: 20px;">
            <h2><?php esc_html_e( 'Michigan Visitors Map', 'wealth-tax-calculator' ); ?></h2>
            <p class="description"><?php esc_html_e( 'This map shows Michigan-only city data. Visitors from other states (for example, Maryland) appear in the Region Buckets table below.', 'wealth-tax-calculator' ); ?></p>
            <?php if ( ! $has_data ) : ?>
                <p><?php esc_html_e( 'No Michigan visitor data yet.', 'wealth-tax-calculator' ); ?></p>
            <?php else : ?>
                <div class="wtc-mi-map-wrap">
                    <?php
                    if ( file_exists( $svg_path ) ) {
                        // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents, WordPress.Security.EscapeOutput.OutputNotEscaped
                        echo file_get_contents( $svg_path );
                    }
                    ?>
                    <div id="wtc-mi-map-tooltip"></div>
                </div>
                <div class="wtc-mi-map-legend" aria-hidden="true">
                    <span class="wtc-mi-map-legend-item">
                        <svg width="10" height="10" viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                            <circle cx="5" cy="5" r="4" fill="#406BBF" fill-opacity="0.75" stroke="#233071" stroke-width="1"/>
                        </svg>
                        <span><?php esc_html_e( 'Smaller = fewer sessions', 'wealth-tax-calculator' ); ?></span>
                    </span>
                    <span class="wtc-mi-map-legend-item">
                        <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                            <circle cx="9" cy="9" r="8" fill="#406BBF" fill-opacity="0.75" stroke="#233071" stroke-width="1"/>
                        </svg>
                        <span><?php esc_html_e( 'Larger = more sessions', 'wealth-tax-calculator' ); ?></span>
                    </span>
                </div>
                <?php
                $known_slugs    = $this->get_known_city_slugs();
                $unknown_cities = array_diff_key( $mi_cities, $known_slugs );
                $total_unlocated = $mi_unknown;
                foreach ( $unknown_cities as $c ) {
                    $total_unlocated += $c;
                }
                if ( $total_unlocated > 0 ) :
                ?>
                    <details class="wtc-mi-unlocated">
                        <summary><?php
                            /* translators: %d: number of sessions */
                            printf( esc_html__( 'Unlocated Michigan sessions: %d', 'wealth-tax-calculator' ), (int) $total_unlocated );
                        ?></summary>
                        <table class="widefat striped">
                            <thead><tr>
                                <th><?php esc_html_e( 'City slug', 'wealth-tax-calculator' ); ?></th>
                                <th><?php esc_html_e( 'Sessions', 'wealth-tax-calculator' ); ?></th>
                            </tr></thead>
                            <tbody>
                            <?php if ( $mi_unknown > 0 ) : ?>
                                <tr><td><?php esc_html_e( '(city unknown)', 'wealth-tax-calculator' ); ?></td><td><?php echo esc_html( number_format_i18n( $mi_unknown ) ); ?></td></tr>
                            <?php endif; ?>
                            <?php foreach ( $unknown_cities as $slug => $count ) : ?>
                                <tr><td><?php echo esc_html( $slug ); ?></td><td><?php echo esc_html( number_format_i18n( $count ) ); ?></td></tr>
                            <?php endforeach; ?>
                            </tbody>
                        </table>
                    </details>
                <?php endif; ?>
            <?php endif; ?>
        </div>
        <?php
    }

    private function render_us_map( array $region_counts ) {
        $us_states  = array();
        $us_unknown = 0;
        foreach ( $region_counts as $bucket => $count ) {
            if ( strncmp( $bucket, 'us_', 3 ) !== 0 ) {
                continue;
            }

            if ( 'us_unknown' === $bucket ) {
                $us_unknown += (int) $count;
                continue;
            }

            $state_code = strtoupper( substr( $bucket, 3 ) );
            if ( 'MI' === $state_code || ! preg_match( '/^[A-Z]{2}$/', $state_code ) ) {
                continue;
            }

            $us_states[ $state_code ] = (int) $count;
        }

        $svg_path = plugin_dir_path( __FILE__ ) . 'data/us-states-tile-map.svg';
        $has_data = ! empty( $us_states );
        ?>
        <div class="card wtc-us-map-card" style="max-width: 920px; margin-top: 20px;">
            <h2><?php esc_html_e( 'U.S. Visitors Outside Michigan', 'wealth-tax-calculator' ); ?></h2>
            <p class="description"><?php esc_html_e( 'State-level view of submitted sessions from outside Michigan. Michigan traffic remains in the detailed map below.', 'wealth-tax-calculator' ); ?></p>
            <?php if ( ! $has_data ) : ?>
                <p><?php esc_html_e( 'No outside-Michigan U.S. visitor data yet.', 'wealth-tax-calculator' ); ?></p>
            <?php else : ?>
                <div class="wtc-us-map-wrap">
                    <?php
                    if ( file_exists( $svg_path ) ) {
                        // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents, WordPress.Security.EscapeOutput.OutputNotEscaped
                        echo file_get_contents( $svg_path );
                    }
                    ?>
                    <div id="wtc-us-map-tooltip"></div>
                </div>
                <div class="wtc-us-map-legend" aria-hidden="true">
                    <span class="wtc-us-map-legend-item"><span class="wtc-us-map-legend-swatch wtc-us-level-1"></span><span><?php esc_html_e( 'Lower session volume', 'wealth-tax-calculator' ); ?></span></span>
                    <span class="wtc-us-map-legend-item"><span class="wtc-us-map-legend-swatch wtc-us-level-3"></span><span><?php esc_html_e( 'Moderate session volume', 'wealth-tax-calculator' ); ?></span></span>
                    <span class="wtc-us-map-legend-item"><span class="wtc-us-map-legend-swatch wtc-us-level-5"></span><span><?php esc_html_e( 'Higher session volume', 'wealth-tax-calculator' ); ?></span></span>
                </div>
                <?php if ( $us_unknown > 0 ) : ?>
                    <p class="wtc-us-map-footnote">
                        <?php
                        printf(
                            /* translators: %d: number of sessions */
                            esc_html__( 'State could not be resolved for %d additional U.S. sessions.', 'wealth-tax-calculator' ),
                            (int) $us_unknown
                        );
                        ?>
                    </p>
                <?php endif; ?>
            <?php endif; ?>
        </div>
        <?php
    }

    private function get_known_city_slugs() {
        return array_flip( array(
            'detroit', 'grand-rapids', 'warren', 'sterling-heights', 'ann-arbor',
            'lansing', 'flint', 'dearborn', 'livonia', 'troy', 'westland',
            'kalamazoo', 'saginaw', 'muskegon', 'holland', 'battle-creek',
            'bay-city', 'pontiac', 'midland', 'jackson', 'portage', 'royal-oak',
            'southfield', 'farmington-hills', 'st-clair-shores', 'canton',
            'clinton-township', 'ypsilanti', 'dearborn-heights', 'taylor',
            'roseville', 'novi', 'east-lansing', 'mount-pleasant', 'port-huron',
            'traverse-city', 'alpena', 'marquette', 'escanaba', 'sault-ste-marie',
            'iron-mountain', 'houghton', 'cadillac', 'petoskey', 'manistee',
            'big-rapids', 'niles', 'benton-harbor', 'adrian', 'monroe', 'owosso',
            'mount-clemens', 'auburn-hills', 'wyoming', 'kentwood', 'romulus',
            'ferndale', 'lincoln-park', 'allen-park', 'southgate', 'wyandotte',
            'trenton', 'grosse-pointe', 'hamtramck', 'inkster', 'garden-city',
            'walker', 'grandville', 'hudsonville', 'zeeland', 'comstock-park',
            'ionia', 'greenville', 'okemos', 'rochester-hills', 'oak-park',
            'waterford', 'west-bloomfield', 'shelby-township', 'macomb-township',
            'harper-woods', 'grosse-pointe-woods', 'grosse-pointe-park', 'riverview',
            'highland-park', 'alma', 'sturgis', 'st-joseph', 'iron-river',
            'ironwood', 'menominee', 'gaylord', 'rogers-city', 'cheboygan',
            'boyne-city', 'charlevoix', 'ludington', 'reed-city', 'newaygo',
            'allegan', 'st-johns', 'hastings', 'charlotte', 'mason', 'howell',
            'brighton', 'milford', 'fenton', 'grand-blanc', 'burton', 'davison',
            'swartz-creek', 'lapeer', 'imlay-city', 'sandusky', 'port-austin',
            'bad-axe', 'caro', 'cass-city', 'tawas-city', 'oscoda', 'west-branch',
            'grayling', 'roscommon', 'houghton-lake', 'clare', 'gladwin',
            'harrison', 'lake-city', 'evart', 'howard-city', 'muskegon-heights',
            'norton-shores', 'spring-lake', 'coopersville', 'lowell', 'grand-haven',
            'wayland', 'otsego', 'paw-paw', 'dowagiac', 'south-haven',
            'stevensville', 'three-rivers', 'coldwater', 'marshall', 'albion',
            'tecumseh', 'milan', 'saline', 'chelsea', 'dexter', 'south-lyon',
            'wixom', 'clio', 'mount-morris', 'linden', 'holly', 'lake-orion',
            'clarkston', 'oxford', 'romeo', 'richmond', 'new-baltimore',
            'chesterfield-township', 'utica', 'eastpointe', 'fraser', 'center-line',
            'madison-heights', 'hazel-park', 'berkley', 'clawson', 'birmingham',
            'bloomfield-hills', 'waterford-charter-township', 'white-lake-township',
            'highland-township', 'hartland-township', 'commerce-township',
            'shelby-charter-township', 'harrison-township', 'washington-township',
        ) );
    }

    private function get_michigan_county_slug_lookup() {
        return array_flip( array(
            'alcona', 'alger', 'allegan', 'alpena', 'antrim', 'arenac', 'baraga', 'barry', 'bay', 'benzie', 'berrien', 'branch', 'calhoun',
            'cass', 'charlevoix', 'cheboygan', 'chippewa', 'clare', 'clinton', 'crawford', 'delta', 'dickinson', 'eaton', 'emmet', 'genesee',
            'gladwin', 'gogebic', 'grand-traverse', 'gratiot', 'hillsdale', 'houghton', 'huron', 'ingham', 'ionia', 'iosco', 'iron', 'isabella',
            'jackson', 'kalamazoo', 'kalkaska', 'kent', 'keweenaw', 'lake', 'lapeer', 'leelanau', 'lenawee', 'livingston', 'luce', 'mackinac',
            'macomb', 'manistee', 'marquette', 'mason', 'mecosta', 'menominee', 'midland', 'missaukee', 'monroe', 'montcalm', 'montmorency',
            'muskegon', 'newaygo', 'oakland', 'oceana', 'ogemaw', 'ontonagon', 'osceola', 'oscoda', 'otsego', 'ottawa', 'presque-isle',
            'roscommon', 'saginaw', 'sanilac', 'schoolcraft', 'shiawassee', 'st-clair', 'st-joseph', 'tuscola', 'van-buren', 'washtenaw',
            'wayne', 'wexford',
        ) );
    }

    private function normalize_county_slug( $county ) {
        $county = sanitize_text_field( $county );
        if ( $county === '' ) {
            return '';
        }

        $county = preg_replace( '/\s+county$/i', '', $county );
        $slug   = sanitize_title( $county );
        if ( $slug === '' ) {
            return '';
        }

        $lookup = $this->get_michigan_county_slug_lookup();
        return isset( $lookup[ $slug ] ) ? $slug : '';
    }

    private function get_michigan_city_to_county_map() {
        return array(
            'detroit' => 'wayne',
            'dearborn' => 'wayne',
            'dearborn-heights' => 'wayne',
            'livonia' => 'wayne',
            'westland' => 'wayne',
            'taylor' => 'wayne',
            'romulus' => 'wayne',
            'lincoln-park' => 'wayne',
            'allen-park' => 'wayne',
            'southgate' => 'wayne',
            'wyandotte' => 'wayne',
            'trenton' => 'wayne',
            'inkster' => 'wayne',
            'garden-city' => 'wayne',
            'hamtramck' => 'wayne',
            'grand-rapids' => 'kent',
            'wyoming' => 'kent',
            'kentwood' => 'kent',
            'walker' => 'kent',
            'grandville' => 'kent',
            'comstock-park' => 'kent',
            'lowell' => 'kent',
            'lansing' => 'ingham',
            'east-lansing' => 'ingham',
            'okemos' => 'ingham',
            'mason' => 'ingham',
            'flint' => 'genesee',
            'grand-blanc' => 'genesee',
            'burton' => 'genesee',
            'davison' => 'genesee',
            'clio' => 'genesee',
            'mount-morris' => 'genesee',
            'ann-arbor' => 'washtenaw',
            'ypsilanti' => 'washtenaw',
            'saline' => 'washtenaw',
            'chelsea' => 'washtenaw',
            'dexter' => 'washtenaw',
            'milan' => 'washtenaw',
            'kalamazoo' => 'kalamazoo',
            'portage' => 'kalamazoo',
            'battle-creek' => 'calhoun',
            'marshall' => 'calhoun',
            'albion' => 'calhoun',
            'jackson' => 'jackson',
            'saginaw' => 'saginaw',
            'bay-city' => 'bay',
            'midland' => 'midland',
            'muskegon' => 'muskegon',
            'muskegon-heights' => 'muskegon',
            'norton-shores' => 'muskegon',
            'holland' => 'ottawa',
            'grand-haven' => 'ottawa',
            'zeeland' => 'ottawa',
            'traverse-city' => 'grand-traverse',
            'petoskey' => 'emmet',
            'charlevoix' => 'charlevoix',
            'marquette' => 'marquette',
            'escanaba' => 'delta',
            'sault-ste-marie' => 'chippewa',
            'iron-mountain' => 'dickinson',
            'houghton' => 'houghton',
            'cadillac' => 'wexford',
            'monroe' => 'monroe',
            'adrian' => 'lenawee',
            'niles' => 'berrien',
            'benton-harbor' => 'berrien',
            'st-joseph' => 'berrien',
            'coldwater' => 'branch',
            'sturgis' => 'st-joseph',
            'three-rivers' => 'st-joseph',
            'port-huron' => 'st-clair',
            'lapeer' => 'lapeer',
            'howell' => 'livingston',
            'brighton' => 'livingston',
            'fenton' => 'genesee',
            'royal-oak' => 'oakland',
            'southfield' => 'oakland',
            'farmington-hills' => 'oakland',
            'troy' => 'oakland',
            'pontiac' => 'oakland',
            'novi' => 'oakland',
            'oak-park' => 'oakland',
            'waterford' => 'oakland',
            'west-bloomfield' => 'oakland',
            'rochester-hills' => 'oakland',
            'wixom' => 'oakland',
            'milford' => 'oakland',
            'warren' => 'macomb',
            'sterling-heights' => 'macomb',
            'roseville' => 'macomb',
            'clinton-township' => 'macomb',
            'mount-clemens' => 'macomb',
            'shelby-township' => 'macomb',
            'macomb-township' => 'macomb',
            'utica' => 'macomb',
            'fraser' => 'macomb',
            'eastpointe' => 'macomb',
            'st-clair-shores' => 'macomb',
            'auburn-hills' => 'oakland',
            'oakland' => 'oakland',
            'wayne' => 'wayne',
            'macomb' => 'macomb',
            'kent' => 'kent',
            'washtenaw' => 'washtenaw',
            'genesee' => 'genesee',
            'ingham' => 'ingham',
        );
    }

    private function get_michigan_postal_to_county_map() {
        return array(
            '48201' => 'wayne',
            '48226' => 'wayne',
            '48126' => 'wayne',
            '48180' => 'wayne',
            '49503' => 'kent',
            '48933' => 'ingham',
            '48104' => 'washtenaw',
            '48502' => 'genesee',
            '49007' => 'kalamazoo',
            '48604' => 'saginaw',
            '48067' => 'oakland',
            '48336' => 'oakland',
            '48066' => 'macomb',
            '48093' => 'macomb',
        );
    }

    private function infer_michigan_county_slug( $city_slug, $postal ) {
        $city_slug = sanitize_title( sanitize_text_field( $city_slug ) );
        $postal    = sanitize_text_field( $postal );

        $city_to_county = $this->get_michigan_city_to_county_map();
        if ( $city_slug !== '' && isset( $city_to_county[ $city_slug ] ) ) {
            return sanitize_title( $city_to_county[ $city_slug ] );
        }

        $county_lookup = $this->get_michigan_county_slug_lookup();
        if ( $city_slug !== '' && isset( $county_lookup[ $city_slug ] ) ) {
            return $city_slug;
        }

        if ( preg_match( '/^\d{5}$/', $postal ) ) {
            $postal_to_county = $this->get_michigan_postal_to_county_map();
            if ( isset( $postal_to_county[ $postal ] ) ) {
                return sanitize_title( $postal_to_county[ $postal ] );
            }
        }

        return '';
    }

    private function normalize_michigan_county_bucket( $bucket, $city_slug = '', $postal = '' ) {
        $bucket = sanitize_text_field( $bucket );
        if ( strncmp( $bucket, 'mi_county_', 10 ) === 0 ) {
            $county_slug = $this->normalize_county_slug( substr( $bucket, 10 ) );
            return $county_slug ? 'mi_county_' . $county_slug : 'mi_county_unknown';
        }

        if ( strncmp( $bucket, 'mi_', 3 ) === 0 ) {
            $city_slug = $city_slug ? $city_slug : substr( $bucket, 3 );
            $county    = $this->infer_michigan_county_slug( $city_slug, $postal );
            return $county ? 'mi_county_' . $county : 'mi_county_unknown';
        }

        return '';
    }

    private function is_michigan_region_bucket( $bucket ) {
        $bucket = sanitize_text_field( $bucket );
        return strncmp( $bucket, 'mi_', 3 ) === 0;
    }

    private function filter_analytics_data_to_michigan( $analytics_data ) {
        if ( ! is_array( $analytics_data ) ) {
            return array();
        }

        $filtered_data = array();

        foreach ( $analytics_data as $day_key => $day ) {
            if ( ! is_array( $day ) ) {
                continue;
            }

            $filtered_day = array(
                'event_total'          => 0,
                'policy_enabled'       => array(),
                'policy_disabled'      => array(),
                'priority_rank_counts' => array(),
                'mode_counts'          => array(),
                'regions'              => array(),
                'counties'             => array(),
                'tax_rate_counts'      => array(),
                'sessions'             => array(),
                'final_submissions'    => array(),
            );

            if ( ! empty( $day['final_submissions'] ) && is_array( $day['final_submissions'] ) ) {
                foreach ( $day['final_submissions'] as $session_hash => $submission ) {
                    if ( ! is_array( $submission ) ) {
                        continue;
                    }

                    $region_bucket = isset( $submission['region_bucket'] ) ? sanitize_text_field( $submission['region_bucket'] ) : '';
                    if ( ! $this->is_michigan_region_bucket( $region_bucket ) ) {
                        continue;
                    }

                    $filtered_day['final_submissions'][ $session_hash ] = $submission;
                    $filtered_day['event_total'] += 1;

                    if ( is_string( $session_hash ) && $session_hash !== '' ) {
                        $filtered_day['sessions'][ $session_hash ] = 1;
                    }

                    $mode = isset( $submission['mode'] ) ? sanitize_key( $submission['mode'] ) : '';
                    if ( $mode !== '' ) {
                        if ( ! isset( $filtered_day['mode_counts'][ $mode ] ) ) {
                            $filtered_day['mode_counts'][ $mode ] = 0;
                        }
                        $filtered_day['mode_counts'][ $mode ] += 1;
                    }

                    if ( ! isset( $filtered_day['regions'][ $region_bucket ] ) ) {
                        $filtered_day['regions'][ $region_bucket ] = 0;
                    }
                    $filtered_day['regions'][ $region_bucket ] += 1;

                    $county_bucket = isset( $submission['county_bucket'] ) ? sanitize_text_field( $submission['county_bucket'] ) : '';
                    $city_slug     = substr( $region_bucket, 3 );
                    $county_bucket = $this->normalize_michigan_county_bucket( $county_bucket, $city_slug );

                    if ( $county_bucket !== '' ) {
                        if ( ! isset( $filtered_day['counties'][ $county_bucket ] ) ) {
                            $filtered_day['counties'][ $county_bucket ] = 0;
                        }
                        $filtered_day['counties'][ $county_bucket ] += 1;
                    }

                    $rate = isset( $submission['tax_rate_bucket'] ) ? sanitize_text_field( $submission['tax_rate_bucket'] ) : '';
                    if ( $rate !== '' ) {
                        if ( ! isset( $filtered_day['tax_rate_counts'][ $rate ] ) ) {
                            $filtered_day['tax_rate_counts'][ $rate ] = 0;
                        }
                        $filtered_day['tax_rate_counts'][ $rate ] += 1;
                    }
                }
            } else {
                if ( ! empty( $day['regions'] ) && is_array( $day['regions'] ) ) {
                    foreach ( $day['regions'] as $bucket => $count ) {
                        $bucket = sanitize_text_field( $bucket );
                        if ( ! $this->is_michigan_region_bucket( $bucket ) ) {
                            continue;
                        }

                        $bucket_count = max( 0, (int) $count );
                        if ( ! isset( $filtered_day['regions'][ $bucket ] ) ) {
                            $filtered_day['regions'][ $bucket ] = 0;
                        }
                        $filtered_day['regions'][ $bucket ] += $bucket_count;
                        $filtered_day['event_total'] += $bucket_count;
                    }
                }

                if ( ! empty( $day['counties'] ) && is_array( $day['counties'] ) ) {
                    foreach ( $day['counties'] as $bucket => $count ) {
                        $bucket = $this->normalize_michigan_county_bucket( $bucket );
                        if ( $bucket === '' ) {
                            continue;
                        }

                        if ( ! isset( $filtered_day['counties'][ $bucket ] ) ) {
                            $filtered_day['counties'][ $bucket ] = 0;
                        }
                        $filtered_day['counties'][ $bucket ] += max( 0, (int) $count );
                    }
                }
            }

            if ( $filtered_day['event_total'] > 0 || ! empty( $filtered_day['regions'] ) || ! empty( $filtered_day['counties'] ) ) {
                $filtered_data[ $day_key ] = $filtered_day;
            }
        }

        return $filtered_data;
    }

    private function format_county_bucket_label( $bucket ) {
        $bucket = sanitize_text_field( $bucket );
        if ( $bucket === 'mi_county_unknown' ) {
            return __( 'Michigan (county unknown)', 'wealth-tax-calculator' );
        }

        if ( strncmp( $bucket, 'mi_county_', 10 ) === 0 ) {
            $county_slug = sanitize_title( substr( $bucket, 10 ) );
            if ( $county_slug !== '' ) {
                return ucwords( str_replace( '-', ' ', $county_slug ) ) . ' County';
            }
        }

        return $bucket;
    }

    private function render_simple_count_table( $counts, $col_one, $col_two, $limit = 15 ) {
        if ( empty( $counts ) ) {
            echo '<p>' . esc_html__( 'No data yet.', 'wealth-tax-calculator' ) . '</p>';
            return;
        }

        $limit = (int) $limit;
        if ( $limit < 1 ) {
            $limit = 15;
        }
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

    private function render_county_count_table( $counts ) {
        if ( empty( $counts ) ) {
            echo '<p>' . esc_html__( 'No data yet.', 'wealth-tax-calculator' ) . '</p>';
            return;
        }

        $limit = 20;
        $rows  = 0;

        echo '<table class="widefat striped">';
        echo '<thead><tr><th>' . esc_html__( 'County', 'wealth-tax-calculator' ) . '</th><th>' . esc_html__( 'Unique submitted sessions', 'wealth-tax-calculator' ) . '</th></tr></thead>';
        echo '<tbody>';

        foreach ( $counts as $key => $value ) {
            if ( $rows >= $limit ) {
                break;
            }

            echo '<tr>';
            echo '<td>' . esc_html( $this->format_county_bucket_label( $key ) ) . '</td>';
            echo '<td>' . esc_html( number_format_i18n( (int) $value ) ) . '</td>';
            echo '</tr>';
            $rows++;
        }

        echo '</tbody>';
        echo '</table>';
    }

    private function render_policy_count_table( $rows, $count_header ) {
        if ( empty( $rows ) ) {
            echo '<p>' . esc_html__( 'No data yet.', 'wealth-tax-calculator' ) . '</p>';
            return;
        }

        $limit = 15;
        $count = 0;

        echo '<table class="widefat striped">';
        echo '<thead><tr><th>' . esc_html__( 'Sub-policy', 'wealth-tax-calculator' ) . '</th><th>' . esc_html( $count_header ) . '</th></tr></thead>';
        echo '<tbody>';

        foreach ( $rows as $row ) {
            if ( $count >= $limit || ! is_array( $row ) ) {
                break;
            }

            $label      = isset( $row['label'] ) ? sanitize_text_field( $row['label'] ) : '';
            $policy_key = isset( $row['policy_key'] ) ? sanitize_text_field( $row['policy_key'] ) : '';
            $cell_text  = $label !== '' ? $label : $policy_key;

            if ( $policy_key !== '' && $policy_key !== $cell_text ) {
                $cell_text .= ' (' . $policy_key . ')';
            }

            echo '<tr>';
            echo '<td>' . esc_html( $cell_text ) . '</td>';
            echo '<td>' . esc_html( number_format_i18n( (int) $row['count'] ) ) . '</td>';
            echo '</tr>';
            $count++;
        }

        echo '</tbody>';
        echo '</table>';
    }

    private function render_rank_breakdown_table( $rows ) {
        if ( empty( $rows ) ) {
            echo '<p>' . esc_html__( 'No data yet.', 'wealth-tax-calculator' ) . '</p>';
            return;
        }

        $limit = 25;
        $count = 0;

        echo '<table class="widefat striped">';
        echo '<thead><tr><th>' . esc_html__( 'Rank', 'wealth-tax-calculator' ) . '</th><th>' . esc_html__( 'Sub-policy', 'wealth-tax-calculator' ) . '</th><th>' . esc_html__( 'Submitted sessions', 'wealth-tax-calculator' ) . '</th></tr></thead>';
        echo '<tbody>';

        foreach ( $rows as $row ) {
            if ( $count >= $limit || ! is_array( $row ) ) {
                break;
            }

            $label      = isset( $row['label'] ) ? sanitize_text_field( $row['label'] ) : '';
            $policy_key = isset( $row['policy_key'] ) ? sanitize_text_field( $row['policy_key'] ) : '';
            $cell_text  = $label !== '' ? $label : $policy_key;

            if ( $policy_key !== '' && $policy_key !== $cell_text ) {
                $cell_text .= ' (' . $policy_key . ')';
            }

            echo '<tr>';
            echo '<td>' . esc_html( '#' . (int) $row['rank'] ) . '</td>';
            echo '<td>' . esc_html( $cell_text ) . '</td>';
            echo '<td>' . esc_html( number_format_i18n( (int) $row['count'] ) ) . '</td>';
            echo '</tr>';
            $count++;
        }

        echo '</tbody>';
        echo '</table>';
    }

    private function render_recent_submissions_table( $rows ) {
        if ( empty( $rows ) ) {
            echo '<p>' . esc_html__( 'No data yet.', 'wealth-tax-calculator' ) . '</p>';
            return;
        }

        echo '<table class="widefat striped">';
        echo '<thead><tr><th>' . esc_html__( 'Submitted', 'wealth-tax-calculator' ) . '</th><th>' . esc_html__( 'Mode', 'wealth-tax-calculator' ) . '</th><th>' . esc_html__( 'Tax rate', 'wealth-tax-calculator' ) . '</th><th>' . esc_html__( 'Region', 'wealth-tax-calculator' ) . '</th><th>' . esc_html__( 'Michigan county', 'wealth-tax-calculator' ) . '</th><th>' . esc_html__( 'Prioritized selections', 'wealth-tax-calculator' ) . '</th></tr></thead>';
        echo '<tbody>';

        foreach ( $rows as $row ) {
            if ( ! is_array( $row ) ) {
                continue;
            }

            $submitted_at = isset( $row['submitted_at'] ) ? (int) $row['submitted_at'] : 0;
            $mode         = isset( $row['mode'] ) ? sanitize_key( $row['mode'] ) : '';
            $tax_rate     = isset( $row['tax_rate_bucket'] ) ? sanitize_text_field( $row['tax_rate_bucket'] ) : '';
            $region       = isset( $row['region_bucket'] ) ? sanitize_text_field( $row['region_bucket'] ) : '';
            $county       = isset( $row['county_bucket'] ) ? sanitize_text_field( $row['county_bucket'] ) : '';
            $items        = isset( $row['selected_items'] ) && is_array( $row['selected_items'] ) ? $row['selected_items'] : array();

            echo '<tr>';
            echo '<td>' . esc_html( $submitted_at > 0 ? gmdate( 'Y-m-d H:i:s', $submitted_at ) . ' UTC' : '—' ) . '</td>';
            echo '<td>' . esc_html( $mode !== '' ? $mode : '—' ) . '</td>';
            echo '<td>' . esc_html( $tax_rate !== '' ? $tax_rate . '%' : '—' ) . '</td>';
            echo '<td>' . esc_html( $region !== '' ? $region : '—' ) . '</td>';
            echo '<td>' . esc_html( $county !== '' ? $this->format_county_bucket_label( $county ) : '—' ) . '</td>';
            echo '<td>';

            if ( empty( $items ) ) {
                echo esc_html__( 'No policy details stored.', 'wealth-tax-calculator' );
            } else {
                echo '<ol style="margin:0; padding-left: 20px;">';
                foreach ( $items as $item ) {
                    if ( ! is_array( $item ) ) {
                        continue;
                    }

                    $policy_key = isset( $item['policy_key'] ) ? sanitize_text_field( $item['policy_key'] ) : '';
                    $label      = $this->format_policy_submission_label( $item, $policy_key );
                    echo '<li>' . esc_html( $label ) . '</li>';
                }
                echo '</ol>';
            }

            echo '</td>';
            echo '</tr>';
        }

        echo '</tbody>';
        echo '</table>';
    }

    private function render_cross_session_changes_table( $changes ) {
        if ( empty( $changes ) ) {
            echo '<p>' . esc_html__( 'No cross-session changes yet. A visitor must submit the calculator more than once for changes to appear here.', 'wealth-tax-calculator' ) . '</p>';
            return;
        }

        $transition_count = 0;
        foreach ( $changes as $change ) {
            if ( is_array( $change ) && isset( $change['transitions'] ) && is_array( $change['transitions'] ) ) {
                $transition_count += count( $change['transitions'] );
            }
        }

        echo '<p class="description">';
        printf(
            /* translators: 1: number of repeat visitors, 2: number of session transitions */
            esc_html__( '%1$s repeat visitors across %2$s session transitions.', 'wealth-tax-calculator' ),
            '<strong>' . esc_html( number_format_i18n( count( $changes ) ) ) . '</strong>',
            '<strong>' . esc_html( number_format_i18n( $transition_count ) ) . '</strong>'
        );
        echo '</p>';

        echo '<table class="widefat striped">';
        echo '<thead><tr>';
        echo '<th>' . esc_html__( 'Visitor', 'wealth-tax-calculator' ) . '</th>';
        echo '<th>' . esc_html__( 'Sessions', 'wealth-tax-calculator' ) . '</th>';
        echo '<th>' . esc_html__( 'From', 'wealth-tax-calculator' ) . '</th>';
        echo '<th>' . esc_html__( 'To', 'wealth-tax-calculator' ) . '</th>';
        echo '<th>' . esc_html__( 'Tax Rate', 'wealth-tax-calculator' ) . '</th>';
        echo '<th>' . esc_html__( 'Policies Added', 'wealth-tax-calculator' ) . '</th>';
        echo '<th>' . esc_html__( 'Policies Removed', 'wealth-tax-calculator' ) . '</th>';
        echo '<th>' . esc_html__( 'Order Changed', 'wealth-tax-calculator' ) . '</th>';
        echo '</tr></thead>';
        echo '<tbody>';

        $row_limit    = 50;
        $rows_written = 0;

        foreach ( $changes as $change ) {
            if ( $rows_written >= $row_limit || ! is_array( $change ) ) {
                break;
            }

            $fp_short      = isset( $change['fingerprint_short'] ) ? sanitize_text_field( $change['fingerprint_short'] ) : '—';
            $session_count = isset( $change['session_count'] ) ? (int) $change['session_count'] : 0;
            $transitions   = isset( $change['transitions'] ) && is_array( $change['transitions'] ) ? $change['transitions'] : array();

            if ( empty( $transitions ) ) {
                continue;
            }

            $first_row      = true;
            $rowspan        = count( $transitions );

            foreach ( $transitions as $t ) {
                if ( $rows_written >= $row_limit || ! is_array( $t ) ) {
                    break;
                }

                $from_at = isset( $t['from_at'] ) && $t['from_at'] > 0
                    ? gmdate( 'Y-m-d H:i', (int) $t['from_at'] ) . ' UTC'
                    : '—';
                $to_at   = isset( $t['to_at'] ) && $t['to_at'] > 0
                    ? gmdate( 'Y-m-d H:i', (int) $t['to_at'] ) . ' UTC'
                    : '—';

                $tax_from = isset( $t['tax_rate_from'] ) && $t['tax_rate_from'] !== ''
                    ? esc_html( $t['tax_rate_from'] ) . '%'
                    : '—';
                $tax_to   = isset( $t['tax_rate_to'] ) && $t['tax_rate_to'] !== ''
                    ? esc_html( $t['tax_rate_to'] ) . '%'
                    : '—';
                $tax_cell = ( isset( $t['tax_changed'] ) && $t['tax_changed'] )
                    ? $tax_from . ' → ' . $tax_to
                    : '—';

                $added_keys   = isset( $t['policies_added'] ) && is_array( $t['policies_added'] )
                    ? array_map( 'sanitize_text_field', $t['policies_added'] )
                    : array();
                $removed_keys = isset( $t['policies_removed'] ) && is_array( $t['policies_removed'] )
                    ? array_map( 'sanitize_text_field', $t['policies_removed'] )
                    : array();

                echo '<tr>';
                if ( $first_row ) {
                    echo '<td rowspan="' . esc_attr( $rowspan ) . '">' . esc_html( $fp_short ) . '</td>';
                    echo '<td rowspan="' . esc_attr( $rowspan ) . '">' . esc_html( number_format_i18n( $session_count ) ) . '</td>';
                    $first_row = false;
                }
                echo '<td>' . esc_html( $from_at ) . '</td>';
                echo '<td>' . esc_html( $to_at ) . '</td>';
                echo '<td>' . esc_html( $tax_cell ) . '</td>';
                echo '<td>' . esc_html( ! empty( $added_keys ) ? implode( ', ', $added_keys ) : '—' ) . '</td>';
                echo '<td>' . esc_html( ! empty( $removed_keys ) ? implode( ', ', $removed_keys ) : '—' ) . '</td>';
                echo '<td>' . esc_html( ( isset( $t['order_changed'] ) && $t['order_changed'] ) ? __( 'Yes', 'wealth-tax-calculator' ) : '—' ) . '</td>';
                echo '</tr>';
                $rows_written++;
            }
        }

        echo '</tbody>';
        echo '</table>';
    }

    private function format_policy_submission_label( $policy_item, $fallback_key = '' ) {
        $policy_label = '';
        $description  = '';

        if ( is_array( $policy_item ) ) {
            $policy_label = isset( $policy_item['policy_label'] ) ? sanitize_text_field( $policy_item['policy_label'] ) : '';
            $description  = isset( $policy_item['description'] ) ? sanitize_text_field( $policy_item['description'] ) : '';
        }

        if ( $policy_label !== '' && $description !== '' ) {
            return $policy_label . ': ' . $description;
        }

        if ( $description !== '' ) {
            return $description;
        }

        if ( $policy_label !== '' ) {
            return $policy_label;
        }

        $fallback_key = sanitize_text_field( $fallback_key );
        return $fallback_key !== '' ? $fallback_key : __( 'Unknown policy', 'wealth-tax-calculator' );
    }

    private function sanitize_selected_items_payload( $selected_items, $order ) {
        $items_by_key = array();

        if ( is_array( $selected_items ) ) {
            foreach ( $selected_items as $selected_item ) {
                if ( ! is_array( $selected_item ) ) {
                    continue;
                }

                $policy_key = isset( $selected_item['policy_key'] ) ? sanitize_text_field( $selected_item['policy_key'] ) : '';
                if ( ! preg_match( '/^[a-zA-Z]+:[0-9]+$/', $policy_key ) ) {
                    continue;
                }

                $items_by_key[ $policy_key ] = $selected_item;
            }
        }

        $normalized_items = array();
        foreach ( $order as $index => $policy_key ) {
            $source_item = isset( $items_by_key[ $policy_key ] ) && is_array( $items_by_key[ $policy_key ] )
                ? $items_by_key[ $policy_key ]
                : array();

            $policy_group = isset( $source_item['policy_group'] ) ? sanitize_key( $source_item['policy_group'] ) : '';
            if ( $policy_group === '' ) {
                $parts        = explode( ':', $policy_key );
                $policy_group = sanitize_key( $parts[0] );
            }

            $funding_status = isset( $source_item['funding_status'] ) ? sanitize_key( $source_item['funding_status'] ) : '';
            if ( ! in_array( $funding_status, array( 'full', 'partial', 'none' ), true ) ) {
                $funding_status = '';
            }

            $normalized_items[] = array(
                'policy_key'      => $policy_key,
                'policy_group'    => $policy_group,
                'policy_label'    => isset( $source_item['policy_label'] ) ? sanitize_text_field( $source_item['policy_label'] ) : '',
                'description'     => isset( $source_item['description'] ) ? sanitize_text_field( $source_item['description'] ) : '',
                'cost_label'      => isset( $source_item['cost_label'] ) ? sanitize_text_field( $source_item['cost_label'] ) : '',
                'selected_amount' => isset( $source_item['selected_amount'] ) && is_numeric( $source_item['selected_amount'] ) ? (int) round( (float) $source_item['selected_amount'] ) : 0,
                'funded_amount'   => isset( $source_item['funded_amount'] ) && is_numeric( $source_item['funded_amount'] ) ? (int) round( (float) $source_item['funded_amount'] ) : 0,
                'funded_percent'  => isset( $source_item['funded_percent'] ) && is_numeric( $source_item['funded_percent'] ) ? max( 0, min( 100, (int) round( (float) $source_item['funded_percent'] ) ) ) : 0,
                'funding_status'  => $funding_status,
                'rank'            => (int) $index + 1,
            );
        }

        return $normalized_items;
    }

    private function normalize_submission_selected_items( $submission ) {
        $order = isset( $submission['order'] ) && is_array( $submission['order'] )
            ? $submission['order']
            : array();

        $selected_items = isset( $submission['selected_items'] ) && is_array( $submission['selected_items'] )
            ? $submission['selected_items']
            : array();

        return $this->sanitize_selected_items_payload( $selected_items, $order );
    }

    private function build_summary( $analytics_data ) {
        $enabled_stats      = array();
        $top_rank_stats     = array();
        $rank_stats         = array();
        $policy_group_stats = array();
        $region_counts      = array();
        $county_counts      = array();
        $tax_rate_counts    = array();
        $recent_submissions = array();
        $unique_sessions    = 0;
        $total_events       = 0;
        $tax_rate_total     = 0.0;
        $tax_rate_samples   = 0;

        foreach ( $analytics_data as $day ) {
            if ( ! is_array( $day ) ) {
                continue;
            }

            if ( ! empty( $day['final_submissions'] ) && is_array( $day['final_submissions'] ) ) {
                $submissions = $day['final_submissions'];
                $total_events += count( $submissions );
                $unique_sessions += count( $submissions );

                foreach ( $submissions as $submission ) {
                    if ( ! is_array( $submission ) ) {
                        continue;
                    }

                    $order = isset( $submission['order'] ) && is_array( $submission['order'] )
                        ? $submission['order']
                        : array();
                    $selected_items = $this->normalize_submission_selected_items( $submission );

                    for ( $i = 0; $i < count( $selected_items ); $i++ ) {
                        $selected_item = $selected_items[ $i ];
                        $policy_key    = isset( $selected_item['policy_key'] ) ? sanitize_text_field( $selected_item['policy_key'] ) : '';
                        if ( $policy_key === '' || ! preg_match( '/^[a-zA-Z]+:[0-9]+$/', $policy_key ) ) {
                            continue;
                        }

                        $label = $this->format_policy_submission_label( $selected_item, $policy_key );

                        if ( ! isset( $enabled_stats[ $policy_key ] ) ) {
                            $enabled_stats[ $policy_key ] = array(
                                'policy_key' => $policy_key,
                                'label'      => $label,
                                'count'      => 0,
                            );
                        }
                        $enabled_stats[ $policy_key ]['count'] += 1;

                        $rank     = isset( $selected_item['rank'] ) ? max( 1, (int) $selected_item['rank'] ) : ( $i + 1 );
                        $rank_key = $rank . '|' . $policy_key;

                        if ( ! isset( $rank_stats[ $rank_key ] ) ) {
                            $rank_stats[ $rank_key ] = array(
                                'rank'       => $rank,
                                'policy_key' => $policy_key,
                                'label'      => $label,
                                'count'      => 0,
                            );
                        }
                        $rank_stats[ $rank_key ]['count'] += 1;

                        if ( $rank === 1 ) {
                            if ( ! isset( $top_rank_stats[ $policy_key ] ) ) {
                                $top_rank_stats[ $policy_key ] = array(
                                    'policy_key' => $policy_key,
                                    'label'      => $label,
                                    'count'      => 0,
                                );
                            }
                            $top_rank_stats[ $policy_key ]['count'] += 1;
                        }

                        $policy_group = isset( $selected_item['policy_group'] ) ? sanitize_key( $selected_item['policy_group'] ) : '';
                        if ( $policy_group === '' ) {
                            $parts        = explode( ':', $policy_key );
                            $policy_group = isset( $parts[0] ) ? sanitize_key( $parts[0] ) : 'other';
                        }
                        if ( $policy_group === '' ) {
                            $policy_group = 'other';
                        }

                        if ( ! isset( $policy_group_stats[ $policy_group ] ) ) {
                            $policy_group_stats[ $policy_group ] = array(
                                'key'             => $policy_group,
                                'label'           => $this->get_policy_group_label( $policy_group ),
                                'color'           => $this->get_policy_group_color( $policy_group ),
                                'count'           => 0,
                                'selected_amount' => 0,
                            );
                        }

                        $selected_amount = isset( $selected_item['selected_amount'] ) && is_numeric( $selected_item['selected_amount'] )
                            ? (int) round( (float) $selected_item['selected_amount'] )
                            : 0;

                        $policy_group_stats[ $policy_group ]['count'] += 1;
                        $policy_group_stats[ $policy_group ]['selected_amount'] += max( 0, $selected_amount );
                    }

                    $recent_submissions[] = array(
                        'submitted_at'    => isset( $submission['submitted_at'] ) ? (int) $submission['submitted_at'] : 0,
                        'mode'            => isset( $submission['mode'] ) ? sanitize_key( $submission['mode'] ) : '',
                        'tax_rate_value'  => isset( $submission['tax_rate_value'] ) ? (float) $submission['tax_rate_value'] : null,
                        'tax_rate_bucket' => isset( $submission['tax_rate_bucket'] ) ? sanitize_text_field( $submission['tax_rate_bucket'] ) : '',
                        'region_bucket'   => isset( $submission['region_bucket'] ) ? sanitize_text_field( $submission['region_bucket'] ) : '',
                        'county_bucket'   => isset( $submission['county_bucket'] ) ? sanitize_text_field( $submission['county_bucket'] ) : '',
                        'selected_items'  => $selected_items,
                    );

                    $bucket = isset( $submission['region_bucket'] ) ? sanitize_text_field( $submission['region_bucket'] ) : 'unknown';
                    if ( $bucket === '' ) {
                        $bucket = 'unknown';
                    }
                    if ( ! isset( $region_counts[ $bucket ] ) ) {
                        $region_counts[ $bucket ] = 0;
                    }
                    $region_counts[ $bucket ] += 1;

                    $county_bucket = isset( $submission['county_bucket'] ) ? sanitize_text_field( $submission['county_bucket'] ) : '';
                    if ( $county_bucket === '' ) {
                        $city_slug      = strncmp( $bucket, 'mi_', 3 ) === 0 ? substr( $bucket, 3 ) : '';
                        $county_bucket  = $this->normalize_michigan_county_bucket( $bucket, $city_slug );
                    }
                    if ( $county_bucket !== '' ) {
                        if ( ! isset( $county_counts[ $county_bucket ] ) ) {
                            $county_counts[ $county_bucket ] = 0;
                        }
                        $county_counts[ $county_bucket ] += 1;
                    }

                    $rate = isset( $submission['tax_rate_bucket'] ) ? sanitize_text_field( $submission['tax_rate_bucket'] ) : '';
                    if ( $rate !== '' ) {
                        if ( ! isset( $tax_rate_counts[ $rate ] ) ) {
                            $tax_rate_counts[ $rate ] = 0;
                        }
                        $tax_rate_counts[ $rate ] += 1;
                    }

                    $tax_rate_value = isset( $submission['tax_rate_value'] ) ? (float) $submission['tax_rate_value'] : null;
                    if ( null !== $tax_rate_value && $tax_rate_value >= WTC_TAX_RATE_MIN && $tax_rate_value <= WTC_TAX_RATE_MAX ) {
                        $tax_rate_total += $tax_rate_value;
                        $tax_rate_samples += 1;
                    }
                }
                continue;
            }

            // Legacy fallback for historical analytics records.
            $total_events += isset( $day['event_total'] ) ? (int) $day['event_total'] : 0;

            if ( ! empty( $day['policy_enabled'] ) && is_array( $day['policy_enabled'] ) ) {
                foreach ( $day['policy_enabled'] as $policy_key => $count ) {
                    $policy_key = sanitize_text_field( $policy_key );
                    if ( ! isset( $enabled_stats[ $policy_key ] ) ) {
                        $enabled_stats[ $policy_key ] = array(
                            'policy_key' => $policy_key,
                            'label'      => $this->format_policy_submission_label( array(), $policy_key ),
                            'count'      => 0,
                        );
                    }
                    $enabled_stats[ $policy_key ]['count'] += (int) $count;
                }
            }

            if ( ! empty( $day['priority_rank_counts']['1'] ) && is_array( $day['priority_rank_counts']['1'] ) ) {
                foreach ( $day['priority_rank_counts']['1'] as $policy_key => $count ) {
                    $policy_key = sanitize_text_field( $policy_key );

                    if ( ! isset( $top_rank_stats[ $policy_key ] ) ) {
                        $top_rank_stats[ $policy_key ] = array(
                            'policy_key' => $policy_key,
                            'label'      => $this->format_policy_submission_label( array(), $policy_key ),
                            'count'      => 0,
                        );
                    }
                    $top_rank_stats[ $policy_key ]['count'] += (int) $count;

                    $rank_key = '1|' . $policy_key;
                    if ( ! isset( $rank_stats[ $rank_key ] ) ) {
                        $rank_stats[ $rank_key ] = array(
                            'rank'       => 1,
                            'policy_key' => $policy_key,
                            'label'      => $this->format_policy_submission_label( array(), $policy_key ),
                            'count'      => 0,
                        );
                    }
                    $rank_stats[ $rank_key ]['count'] += (int) $count;
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

            if ( ! empty( $day['counties'] ) && is_array( $day['counties'] ) ) {
                foreach ( $day['counties'] as $bucket => $count ) {
                    $bucket = $this->normalize_michigan_county_bucket( $bucket );
                    if ( $bucket === '' ) {
                        continue;
                    }

                    if ( ! isset( $county_counts[ $bucket ] ) ) {
                        $county_counts[ $bucket ] = 0;
                    }
                    $county_counts[ $bucket ] += (int) $count;
                }
            }

            if ( ! empty( $day['tax_rate_counts'] ) && is_array( $day['tax_rate_counts'] ) ) {
                foreach ( $day['tax_rate_counts'] as $rate => $count ) {
                    if ( ! isset( $tax_rate_counts[ $rate ] ) ) {
                        $tax_rate_counts[ $rate ] = 0;
                    }
                    $tax_rate_counts[ $rate ] += (int) $count;

                    if ( is_numeric( $rate ) ) {
                        $tax_rate_total += (float) $rate * (int) $count;
                        $tax_rate_samples += (int) $count;
                    }
                }
            }

            if ( ! empty( $day['sessions'] ) && is_array( $day['sessions'] ) ) {
                $unique_sessions += count( $day['sessions'] );
            }
        }

        uasort(
            $enabled_stats,
            function ( $left, $right ) {
                if ( (int) $left['count'] === (int) $right['count'] ) {
                    return strcmp( (string) $left['label'], (string) $right['label'] );
                }

                return ( (int) $left['count'] > (int) $right['count'] ) ? -1 : 1;
            }
        );
        uasort(
            $top_rank_stats,
            function ( $left, $right ) {
                if ( (int) $left['count'] === (int) $right['count'] ) {
                    return strcmp( (string) $left['label'], (string) $right['label'] );
                }

                return ( (int) $left['count'] > (int) $right['count'] ) ? -1 : 1;
            }
        );
        uasort(
            $rank_stats,
            function ( $left, $right ) {
                if ( (int) $left['count'] === (int) $right['count'] ) {
                    if ( (int) $left['rank'] === (int) $right['rank'] ) {
                        return strcmp( (string) $left['label'], (string) $right['label'] );
                    }

                    return ( (int) $left['rank'] < (int) $right['rank'] ) ? -1 : 1;
                }

                return ( (int) $left['count'] > (int) $right['count'] ) ? -1 : 1;
            }
        );
        uasort(
            $policy_group_stats,
            function ( $left, $right ) {
                if ( (int) $left['selected_amount'] === (int) $right['selected_amount'] ) {
                    if ( (int) $left['count'] === (int) $right['count'] ) {
                        return strcmp( (string) $left['label'], (string) $right['label'] );
                    }

                    return ( (int) $left['count'] > (int) $right['count'] ) ? -1 : 1;
                }

                return ( (int) $left['selected_amount'] > (int) $right['selected_amount'] ) ? -1 : 1;
            }
        );
        arsort( $region_counts );
        arsort( $county_counts );
        ksort( $tax_rate_counts );

        usort(
            $recent_submissions,
            function ( $left, $right ) {
                return (int) $right['submitted_at'] <=> (int) $left['submitted_at'];
            }
        );
        if ( count( $recent_submissions ) > 20 ) {
            $recent_submissions = array_slice( $recent_submissions, 0, 20 );
        }

        $average_tax_rate = $tax_rate_samples > 0 ? round( $tax_rate_total / $tax_rate_samples, 1 ) : 0.0;

        return array(
            'enabled_rows'      => array_values( $enabled_stats ),
            'top_rank_rows'     => array_values( $top_rank_stats ),
            'rank_rows'         => array_values( $rank_stats ),
            'policy_group_rows' => array_values( $policy_group_stats ),
            'region_counts'     => $region_counts,
            'county_counts'     => $county_counts,
            'tax_rate_counts'   => $tax_rate_counts,
            'recent_submissions'=> $recent_submissions,
            'unique_sessions'   => $unique_sessions,
            'days_count'        => count( $analytics_data ),
            'average_tax_rate'  => $average_tax_rate,
            'total_events'      => $total_events,
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
        $order_raw  = isset( $_POST['order'] ) ? wp_unslash( $_POST['order'] ) : '[]';
        $selected_items_raw = isset( $_POST['selected_items'] ) ? wp_unslash( $_POST['selected_items'] ) : '[]';

        $tax_rate_raw    = isset( $_POST['tax_rate'] ) ? sanitize_text_field( wp_unslash( $_POST['tax_rate'] ) ) : '';
        $tax_rate_val    = strlen( $tax_rate_raw ) ? (float) $tax_rate_raw : null;
        $tax_rate_bucket = ( null !== $tax_rate_val && $tax_rate_val >= 1.0 && $tax_rate_val <= 10.0 )
            ? (string) (int) round( $tax_rate_val )
            : '';

        $session_raw  = isset( $_POST['session'] ) ? sanitize_text_field( wp_unslash( $_POST['session'] ) ) : '';
        $session_hash = ( strlen( $session_raw ) <= 64 && preg_match( '/^wtc_\d+_[a-zA-Z0-9]{6,16}$/', $session_raw ) )
            ? substr( md5( $session_raw ), 0, 12 )
            : '';

        if ( $event_type !== 'next_step_submit' ) {
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

        $selected_items = json_decode( $selected_items_raw, true );
        if ( ! is_array( $selected_items ) ) {
            $selected_items = array();
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
                'counties'              => array(),
                'tax_rate_counts'       => array(),
                'sessions'              => array(),
                'final_submissions'     => array(),
            );
        }

        $geo_context   = $this->get_geo_context();
        $region_bucket = $geo_context['bucket'];
        $county_bucket = isset( $geo_context['county_bucket'] ) ? sanitize_text_field( $geo_context['county_bucket'] ) : '';
        if ( $this->geo_enabled() && ! $geo_context['include'] ) {
            wp_send_json_success( array( 'ok' => true, 'excluded' => 'non-us' ) );
        }

        $day =& $data[ $today ];

        if ( ! isset( $day['final_submissions'] ) || ! is_array( $day['final_submissions'] ) ) {
            $day['final_submissions'] = array();
        }

        $day['event_total'] = isset( $day['event_total'] ) ? (int) $day['event_total'] + 1 : 1;

        if ( ! isset( $day['mode_counts'][ $mode ] ) ) {
            $day['mode_counts'][ $mode ] = 0;
        }
        $day['mode_counts'][ $mode ] += 1;

        $clean_order = array();
        for ( $i = 0; $i < count( $order ); $i++ ) {
            $item_key = sanitize_text_field( $order[ $i ] );
            if ( ! preg_match( '/^[a-zA-Z]+:[0-9]+$/', $item_key ) ) {
                continue;
            }
            if ( in_array( $item_key, $clean_order, true ) ) {
                continue;
            }
            $clean_order[] = $item_key;
        }

        if ( empty( $clean_order ) ) {
            wp_send_json_error( array( 'message' => 'invalid-order' ), 400 );
        }

        if ( $session_hash === '' ) {
            wp_send_json_error( array( 'message' => 'invalid-session' ), 400 );
        }

        $clean_selected_items = $this->sanitize_selected_items_payload( $selected_items, $clean_order );

        if ( $tax_rate_bucket !== '' ) {
            if ( ! isset( $day['tax_rate_counts'] ) ) {
                $day['tax_rate_counts'] = array();
            }
            if ( ! isset( $day['tax_rate_counts'][ $tax_rate_bucket ] ) ) {
                $day['tax_rate_counts'][ $tax_rate_bucket ] = 0;
            }
            $day['tax_rate_counts'][ $tax_rate_bucket ] += 1;
        }

        if ( ! isset( $day['sessions'] ) ) {
            $day['sessions'] = array();
        }
        if ( ! isset( $day['sessions'][ $session_hash ] ) && count( $day['sessions'] ) < 5000 ) {
            $day['sessions'][ $session_hash ] = 1;
        }

        if ( ! isset( $day['regions'][ $region_bucket ] ) ) {
            $day['regions'][ $region_bucket ] = 0;
        }
        $day['regions'][ $region_bucket ] += 1;

        $city_slug     = strncmp( $region_bucket, 'mi_', 3 ) === 0 ? substr( $region_bucket, 3 ) : '';
        $county_bucket = $this->normalize_michigan_county_bucket( $county_bucket, $city_slug );
        if ( $county_bucket !== '' ) {
            if ( ! isset( $day['counties'] ) || ! is_array( $day['counties'] ) ) {
                $day['counties'] = array();
            }
            if ( ! isset( $day['counties'][ $county_bucket ] ) ) {
                $day['counties'][ $county_bucket ] = 0;
            }
            $day['counties'][ $county_bucket ] += 1;
        }

        $visitor_fingerprint = $this->fingerprint_enabled() ? $this->get_visitor_fingerprint() : '';

        $day['final_submissions'][ $session_hash ] = array(
            'policy_key'       => sanitize_text_field( $policy_key ),
            'order'            => $clean_order,
            'selected_items'   => $clean_selected_items,
            'tax_rate_value'   => ( null !== $tax_rate_val && $tax_rate_val >= WTC_TAX_RATE_MIN && $tax_rate_val <= WTC_TAX_RATE_MAX ) ? round( $tax_rate_val, 1 ) : null,
            'tax_rate_bucket'  => $tax_rate_bucket,
            'mode'             => $mode,
            'region_bucket'    => sanitize_text_field( $region_bucket ),
            'submitted_at'     => time(),
        );

        update_option( WTC_ANALYTICS_OPTION_KEY, $data, false );
        wp_send_json_success( array( 'ok' => true ) );
    }

    private function get_visitor_fingerprint() {
        $ip = $this->get_client_ip();
        $ua = isset( $_SERVER['HTTP_USER_AGENT'] ) ? (string) $_SERVER['HTTP_USER_AGENT'] : '';
        $ua = strtolower( trim( $ua ) );
        return substr( hash_hmac( 'sha256', $ip . '|' . $ua, wp_salt( 'auth' ) ), 0, 16 );
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
                'county_bucket' => '',
            );
        }

        $cache_key = 'wtc_geo_bucket_v2_' . md5( $ip );
        $cached    = get_transient( $cache_key );
        if ( is_array( $cached ) && isset( $cached['include'], $cached['bucket'] ) ) {
            $bucket        = sanitize_text_field( $cached['bucket'] );
            $cached_county = isset( $cached['county_bucket'] ) ? sanitize_text_field( $cached['county_bucket'] ) : '';
            return array(
                'include' => (bool) $cached['include'],
                'bucket'  => $bucket,
                'county_bucket' => $this->normalize_michigan_county_bucket( $cached_county, strncmp( $bucket, 'mi_', 3 ) === 0 ? substr( $bucket, 3 ) : '' ),
            );
        }
        if ( false !== $cached && is_string( $cached ) ) {
            // Backward compatibility for string-only transient values.
            $bucket = sanitize_text_field( $cached );
            return array(
                'include' => $cached !== 'outside_michigan',
                'bucket'  => $bucket,
                'county_bucket' => $this->normalize_michigan_county_bucket( $bucket ),
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
                'county_bucket' => '',
            );
            set_transient( $cache_key, $unknown, 12 * HOUR_IN_SECONDS );
            return $unknown;
        }

        $body = json_decode( wp_remote_retrieve_body( $response ), true );
        if ( ! is_array( $body ) ) {
            $unknown = array(
                'include' => true,
                'bucket'  => 'unknown',
                'county_bucket' => '',
            );
            set_transient( $cache_key, $unknown, 12 * HOUR_IN_SECONDS );
            return $unknown;
        }

        $country = isset( $body['country_code'] ) ? strtoupper( sanitize_text_field( $body['country_code'] ) ) : '';
        $region  = isset( $body['region_code'] ) ? strtoupper( sanitize_text_field( $body['region_code'] ) ) : '';
        if ( $region !== '' && ! preg_match( '/^[A-Z]{2}$/', $region ) ) {
            $region = '';
        }
        $city    = isset( $body['city'] ) ? sanitize_title( sanitize_text_field( $body['city'] ) ) : '';
        $postal  = isset( $body['postal'] ) ? sanitize_text_field( $body['postal'] ) : '';

        $include = true;
        $bucket  = 'unknown';
        $county_bucket = '';

        if ( $country !== 'US' ) {
            $include = false;
            $bucket  = 'non_us';
        } elseif ( $region === 'MI' ) {
            $bucket = $city ? 'mi_' . $city : 'mi_unknown';

            $county_slug = '';
            foreach ( array( 'county', 'county_name', 'state_district', 'district' ) as $county_field ) {
                if ( isset( $body[ $county_field ] ) ) {
                    $county_slug = $this->normalize_county_slug( $body[ $county_field ] );
                    if ( $county_slug !== '' ) {
                        break;
                    }
                }
            }

            if ( $county_slug === '' ) {
                $county_slug = $this->infer_michigan_county_slug( $city, $postal );
            }

            $county_bucket = $county_slug ? 'mi_county_' . $county_slug : 'mi_county_unknown';
        } elseif ( $region ) {
            $bucket = 'us_' . strtolower( $region );
        } else {
            $bucket = 'us_unknown';
        }

        $result = array(
            'include' => $include,
            'bucket'  => $bucket,
            'county_bucket' => $county_bucket,
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
 * Activation hook - runs when plugin is activated
 */
function wtc_activate() {
    global $wpdb, $wtc_updater;
    $wpdb->query(
        "DELETE FROM {$wpdb->options} 
        WHERE option_name LIKE '_transient_wtc_comparisons_data_%' 
        OR option_name LIKE '_transient_timeout_wtc_comparisons_data_%'"
    );

    $wtc_updater->ensure_schedule();
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
        global $wtc_policy_analytics;

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
        $frontend_popularity = array(
            'enabled_rows'  => array(),
            'top_rank_rows' => array(),
        );

        if ( isset( $wtc_policy_analytics ) && is_object( $wtc_policy_analytics ) && method_exists( $wtc_policy_analytics, 'get_frontend_popularity_summary' ) ) {
            $frontend_popularity = $wtc_policy_analytics->get_frontend_popularity_summary();
        }

        wp_localize_script(
            'wealth-tax-calculator-script',
            'wealthTaxConfig',
            array(
                'billionaireWealth' => WTC_BILLIONAIRE_WEALTH,
                'comparisons'       => $this->get_comparisons_data(),
                'version'           => WTC_VERSION,
                'popularity'        => $frontend_popularity,
                'analytics'         => array(
                    'enabled'  => get_option( WTC_ANALYTICS_ENABLED_OPTION, '0' ) === '1',
                    'endpoint' => admin_url( 'admin-ajax.php' ),
                    'nonce'    => wp_create_nonce( 'wtc_track_policy_event' ),
                ),
            )
        );
    }

    private function render_share_bar( $position ) {
        ?>
        <div class="wtc-share-block wtc-share-block-<?php echo esc_attr( $position ); ?>">
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
        <?php
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
            <?php $this->render_share_bar( 'top' ); ?>

            <div class="calculator-content">
                <div class="calculator-inputs">
                    <div class="input-section">
                        <h3 class="wtc-step-heading">Step 1: Select Billionaire Taxation Rate</h3>
                        <div class="slider-container wtc-slider-shell">
                            <input type="hidden" id="wtc-taxRate" value="5" aria-label="Tax rate percentage">

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
                                                <span id="wtc-device-holder">5.0%</span>
                                            </div>
                                            <div class="wtc-innerbox">
                                                <div class="wtc-annual-label">10-YEAR REVENUE:</div>
                                                <div class="wtc-annual-price" id="wtc-annualPrice">$2.2 Trillion</div>
                                            </div>
                                        </div>

                                        <div
                                            class="wtc-square"
                                            id="wtc-sliderHandle"
                                            role="slider"
                                            tabindex="0"
                                            aria-valuemin="1"
                                            aria-valuemax="10"
                                            aria-valuenow="5"
                                            aria-valuetext="5.0%"
                                            aria-label="Tax rate percentage"
                                        >
                                            <span class="value" id="wtc-sliderValue">5.0%</span>
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

                        <h3 class="wtc-step-heading">Step 3: Prioritize your policies.</h3>
                        <p class="wtc-step-subheading">Drag and drop policies from top (highest priority) to bottom (lowest priority).</p>
                        <div id="wtc-selectedPoliciesBox" class="selected-policies-box">
                            <h4>Selected Policies</h4>
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

            <?php $this->render_share_bar( 'bottom' ); ?>

            <div id="wtc-finalSummary" class="wtc-final-summary" role="region" aria-label="Tax Plan Final Summary" aria-hidden="true">
                <div class="wtc-final-summary-inner">
                    <div class="wtc-final-summary-header">
                        <button type="button" id="wtc-finalSummaryBack" class="wtc-fs-back-button">
                            <span aria-hidden="true">&larr;</span> Back to Calculator
                        </button>
                        <h2 class="wtc-final-summary-title">Your Tax Plan Summary</h2>
                    </div>
                    <div class="wtc-fs-slider-block">
                        <h3 class="wtc-fs-slider-title">Adjust Tax Rate</h3>
                        <div class="wtc-fs-slider-shell">
                            <div class="wtc-money-stage" aria-hidden="true">
                                <div class="wtc-money-stage-glow"></div>
                                <div class="wtc-money-field" id="wtc-fs-moneyField"></div>
                            </div>

                            <div id="wtc-fs-pr-slider" class="wtc-dragdealer wtc-fs-dragdealer">
                                <div class="wtc-stripe">
                                    <div id="wtc-fs-highlight-fill" class="wtc-highlight-fill"></div>

                                    <div class="handle">
                                        <div class="wtc-infobox" id="wtc-fs-sliderInfobox">
                                            <div class="wtc-titlebar">
                                                <span id="wtc-fs-plan-holder">Tax Rate:</span>
                                                <span id="wtc-fs-device-holder">5.0%</span>
                                            </div>
                                            <div class="wtc-innerbox">
                                                <div class="wtc-annual-label">10-YEAR REVENUE:</div>
                                                <div class="wtc-annual-price" id="wtc-fs-annualPrice">$2.2 Trillion</div>
                                            </div>
                                        </div>

                                        <div
                                            class="wtc-square"
                                            id="wtc-fs-sliderHandle"
                                            role="slider"
                                            tabindex="0"
                                            aria-valuemin="1"
                                            aria-valuemax="10"
                                            aria-valuenow="5"
                                            aria-valuetext="5.0%"
                                            aria-label="Summary tax rate percentage"
                                        >
                                            <span class="value" id="wtc-fs-sliderValue">5.0%</span>
                                            <span class="menu-line"></span>
                                            <span class="menu-line"></span>
                                            <span class="menu-line"></span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="range-labels wtc-fs-range-labels" aria-hidden="true">
                            <span>1%</span>
                            <span>10%</span>
                        </div>
                    </div>
                    <div id="wtc-finalSummaryBody" class="wtc-final-summary-body"></div>
                </div>
            </div>
        </div>
        <?php
        return ob_get_clean();
    }
}

new Billionaire_Wealth_Tax_Calculator();
