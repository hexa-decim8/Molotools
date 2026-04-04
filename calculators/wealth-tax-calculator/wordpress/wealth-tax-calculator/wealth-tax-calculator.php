<?php
/**
 * Plugin Name: Billionaire Wealth Tax Calculator
 * Plugin URI:  https://github.com/hexa-decim8/Molotools
 * Description: Interactive calculator showing potential annual tax revenue from billionaire wealth at rates of 1%–8%, based on the 2026 Institute for Policy Studies estimate of $15.3 trillion. Embed with [billionaire_wealth_tax].
 * Version:     1.2.0
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
 * Release Asset:     true
 */

// Prevent direct access.
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

// Plugin version constant - update this when releasing new versions
define( 'WTC_VERSION', '1.2.0' );

// Plugin constants
define( 'WTC_BILLIONAIRE_WEALTH', 15.3e12 ); // $15.3 trillion
define( 'WTC_TAX_RATE_MIN', 1 );
define( 'WTC_TAX_RATE_MAX', 8 );
define( 'WTC_CACHE_TTL', 12 * HOUR_IN_SECONDS ); // 12 hours

// ---------------------------------------------------------------------------
// Self-contained GitHub update checker — no extra plugins required.
// Hooks into WordPress's native update system.
// Checks: https://api.github.com/repos/hexa-decim8/Molotools/releases/latest
// Expects a release asset named "wealth-tax-calculator.zip" on each release.
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
    }

    /**
     * Fetch the latest release from GitHub, cached for 12 hours.
     */
    private function get_release() {
        $cached = get_transient( $this->cache_key );
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
            set_transient( $this->cache_key, null, 300 );
            return null;
        }

        $release = json_decode( wp_remote_retrieve_body( $response ) );
        set_transient( $this->cache_key, $release, $this->cache_ttl );
        return $release;
    }

    /**
     * Find the plugin zip asset in the release.
     * Looks for an asset named "wealth-tax-calculator.zip".
     */
    private function get_asset_url( $release ) {
        if ( empty( $release->assets ) ) {
            return null;
        }
        foreach ( $release->assets as $asset ) {
            if ( $asset->name === 'wealth-tax-calculator.zip' ) {
                return $asset->browser_download_url;
            }
        }
        return null;
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

        if ( version_compare( $this->version, $remote_version, '<' ) && $asset_url ) {
            $transient->response[ $this->slug ] = (object) array(
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
    'wealth-tax-calculator/wealth-tax-calculator.php',
    'hexa-decim8/Molotools',
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
            $auto_update_enabled = get_option( 'wtc_auto_update_enabled', '0' );
            return $auto_update_enabled === '1';
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

        // Clear the cache to force a fresh check
        $cache_key = 'wtc_github_update_' . md5( 'wealth-tax-calculator/wealth-tax-calculator.php' );
        delete_transient( $cache_key );

        // Force WordPress to check for updates
        delete_site_transient( 'update_plugins' );
        wp_update_plugins();

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
        $release_info = null;

        // Check if there's an update available
        $update_plugins = get_site_transient( 'update_plugins' );
        if ( isset( $update_plugins->response['wealth-tax-calculator/wealth-tax-calculator.php'] ) ) {
            $update_available = true;
            $latest_version = $update_plugins->response['wealth-tax-calculator/wealth-tax-calculator.php']->new_version;
        }

        $auto_update_enabled = get_option( 'wtc_auto_update_enabled', '0' ) === '1';
        $update_check_done = isset( $_GET['update_check_done'] ) && $_GET['update_check_done'] === '1';

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
                                    <?php esc_html_e( 'When enabled, the plugin will automatically update when new versions are released on GitHub.', 'wealth-tax-calculator' ); ?>
                                </p>
                            </td>
                        </tr>
                    </table>
                    <?php submit_button( __( 'Save Settings', 'wealth-tax-calculator' ) ); ?>
                </form>
            </div>

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
                    <li><?php esc_html_e( 'The plugin checks for updates every 12 hours automatically', 'wealth-tax-calculator' ); ?></li>
                    <li><?php esc_html_e( 'You can manually check for updates using the button above', 'wealth-tax-calculator' ); ?></li>
                    <li><?php esc_html_e( 'Enable automatic updates to install new versions without manual intervention', 'wealth-tax-calculator' ); ?></li>
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
    
    // Initialize any default options here if needed in the future
    // add_option( 'wtc_plugin_settings', array() );
}
register_activation_hook( __FILE__, 'wtc_activate' );

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
            'wealth-tax-calculator-styles',
            $this->plugin_url . 'css/' . $css_file,
            array(),
            WTC_VERSION
        );

        wp_enqueue_script(
            'wealth-tax-calculator-script',
            $this->plugin_url . 'js/' . $js_file,
            array(),
            WTC_VERSION,
            true // Load in footer.
        );

        // Inject configuration and data into JavaScript
        wp_localize_script(
            'wealth-tax-calculator-script',
            'wealthTaxConfig',
            array(
                'billionaireWealth' => WTC_BILLIONAIRE_WEALTH,
                'taxRateMin'        => WTC_TAX_RATE_MIN,
                'taxRateMax'        => WTC_TAX_RATE_MAX,
                'comparisons'       => $this->get_comparisons_data(),
                'version'           => WTC_VERSION,
            )
        );
    }

    /**
     * Render the calculator HTML for the shortcode.
     *
     * Usage: [billionaire_wealth_tax]
     * Optional attrs: title="..." subtitle="..."
     */
    public function render_calculator( $atts ) {
        $atts = shortcode_atts(
            array(
                'title'    => 'Billionaire Wealth Tax Calculator',
                'subtitle' => 'Calculate potential revenue from taxing billionaire wealth',
            ),
            $atts,
            'billionaire_wealth_tax'
        );

        ob_start();
        ?>
        <div class="calculator-container wealth-tax-widget">
            <header>
                <h1><?php echo esc_html( $atts['title'] ); ?></h1>
                <p class="subtitle"><?php echo esc_html( $atts['subtitle'] ); ?></p>
            </header>

            <div class="calculator-content">
                <div class="mode-toggle-section">
                    <div class="mode-toggle">
                        <button class="mode-button active" data-mode="basic">Basic</button>
                        <button class="mode-button" data-mode="advanced">Advanced</button>
                    </div>
                </div>
                
                <div class="input-section">
                    <label for="wtc-taxRate">
                        <span class="label-text">Tax Rate on Billionaire Wealth:</span>
                        <span class="rate-display" id="wtc-rateDisplay">2%</span>
                    </label>
                    <div class="slider-container">
                        <input
                            type="range"
                            id="wtc-taxRate"
                            min="1"
                            max="8"
                            value="2"
                            step="1"
                            class="slider"
                            list="wtc-tickmarks"
                            aria-label="Tax rate percentage"
                        >
                        <datalist id="wtc-tickmarks">
                            <option value="1"></option>
                            <option value="2"></option>
                            <option value="3"></option>
                            <option value="4"></option>
                            <option value="5"></option>
                            <option value="6"></option>
                            <option value="7"></option>
                            <option value="8"></option>
                        </datalist>
                        <div class="policy-marker" data-value="5">
                            <div class="policy-marker-line"></div>
                            <div class="policy-marker-label">Abdul's plan</div>
                        </div>
                    </div>
                    <div class="range-labels">
                        <span>1%</span>
                        <span>8%</span>
                    </div>
                </div>
                
                <div class="policy-allocation-section hidden">
                    <h3 class="policy-header">Allocate Revenue to Policy Categories</h3>
                    <p class="policy-description">Select one or more categories to see how the tax revenue could be allocated:</p>
                    
                    <div class="policy-categories">
                        <label class="policy-checkbox">
                            <input type="checkbox" name="wtc-policy" value="healthcare" id="wtc-policyHealthcare">
                            <span class="checkbox-label">Healthcare</span>
                        </label>
                        
                        <label class="policy-checkbox">
                            <input type="checkbox" name="wtc-policy" value="education" id="wtc-policyEducation">
                            <span class="checkbox-label">Education</span>
                        </label>
                        
                        <label class="policy-checkbox">
                            <input type="checkbox" name="wtc-policy" value="business" id="wtc-policyBusiness">
                            <span class="checkbox-label">Business</span>
                        </label>
                        
                        <label class="policy-checkbox">
                            <input type="checkbox" name="wtc-policy" value="directRelief" id="wtc-policyDirectRelief">
                            <span class="checkbox-label">Direct Relief</span>
                        </label>
                        
                        <label class="policy-checkbox">
                            <input type="checkbox" name="wtc-policy" value="housing" id="wtc-policyHousing">
                            <span class="checkbox-label">Housing</span>
                        </label>
                        
                        <label class="policy-checkbox">
                            <input type="checkbox" name="wtc-policy" value="childcare" id="wtc-policyChildcare">
                            <span class="checkbox-label">Childcare &amp; Families</span>
                        </label>
                    </div>
                    
                    <div class="allocation-results" id="wtc-allocationResults">
                        <p class="allocation-prompt">Select categories above to see allocation</p>
                    </div>
                </div>

                <div class="results-section">
                    <div class="revenue-box">
                        <h2>Annual Tax Revenue</h2>
                        <p class="tax-explanation" id="wtc-taxExplanation">2.0% of $15.3 trillion in billionaire wealth =</p>
                        <p class="revenue-amount" id="wtc-revenueAmount">$306.0 Billion</p>
                    </div>

                    <div class="context-box">
                        <h3>What Could This Fund?</h3>
                        <p class="comparison-text" id="wtc-comparisonText">Loading&hellip;</p>
                    </div>

                    <div class="sources-box">
                        <h4>Sources</h4>
                        <ol class="sources-list" id="wtc-sourcesList">
                            <li id="wtc-comparisonSource">Loading&hellip;</li>
                            <li>
                                <a href="https://www.ips-dc.org/resource-richest-15-u-s-centi-billionaires-see-wealth-surge-33-percent-to-3-2-trillion/"
                                   target="_blank" rel="noopener noreferrer">
                                    Richest 15 U.S. Centi-Billionaires See Wealth Surge 33 Percent to $3.2 Trillion, Institute for Policy Studies (2026)
                                </a>
                                &mdash; Billionaire wealth estimate of $15.3 trillion
                            </li>
                        </ol>
                    </div>
                </div>

                <div class="info-box">
                    <p class="info-text">
                        This calculator is based on the 2026 estimate of <strong>$15.3 trillion</strong>
                        in billionaire wealth from Institute for Policy Studies data. Tax rates range from 1% to 8%
                        to show potential annual revenue at different taxation levels.
                    </p>
                </div>
            </div>
        </div>
        <?php
        return ob_get_clean();
    }
}

new Billionaire_Wealth_Tax_Calculator();
