<?php
/**
 * Plugin Name: Billionaire Wealth Tax Calculator
 * Plugin URI:  https://github.com/hexa-decim8/Molotools
 * Description: Interactive calculator showing potential annual tax revenue from billionaire wealth at rates of 1%–8%, based on the 2024 U.S. Treasury estimate of $15.3 trillion. Embed with [billionaire_wealth_tax].
 * Version:     1.1.0
 * Author:      Molotools
 * License:     GPL v2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: wealth-tax-calculator
 * GitHub Plugin URI: hexa-decim8/Molotools
 * GitHub Branch:     main
 * Primary Branch:    main
 * Release Asset:     true
 */

// Prevent direct access.
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

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
    private $cache_ttl = 43200; // 12 hours

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
new WTC_GitHub_Updater(
    'wealth-tax-calculator/wealth-tax-calculator.php',
    'hexa-decim8/Molotools',
    '1.1.0'
);

class Billionaire_Wealth_Tax_Calculator {

    private $plugin_url;

    public function __construct() {
        $this->plugin_url = plugin_dir_url( __FILE__ );

        add_shortcode( 'billionaire_wealth_tax', array( $this, 'render_calculator' ) );
        add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_assets' ) );
    }

    /**
     * Enqueue CSS and JavaScript only on pages that contain the shortcode.
     */
    public function enqueue_assets() {
        global $post;

        if ( ! is_a( $post, 'WP_Post' ) || ! has_shortcode( $post->post_content, 'billionaire_wealth_tax' ) ) {
            return;
        }

        wp_enqueue_style(
            'wealth-tax-calculator-styles',
            $this->plugin_url . 'css/styles.css',
            array(),
            '1.1.0'
        );

        wp_enqueue_script(
            'wealth-tax-calculator-script',
            $this->plugin_url . 'js/calculator.js',
            array(),
            '1.1.0',
            true // Load in footer.
        );

        // Pass the data directory URL so the JS can fetch comparisons.json.
        wp_localize_script(
            'wealth-tax-calculator-script',
            'wealthTaxConfig',
            array(
                'dataUrl' => $this->plugin_url . 'data/',
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
                <div class="input-section">
                    <label for="wtc-taxRate">
                        <span class="label-text">Tax Rate on Billionaire Wealth:</span>
                        <span class="rate-display" id="wtc-rateDisplay">2%</span>
                    </label>
                    <input
                        type="range"
                        id="wtc-taxRate"
                        min="1"
                        max="8"
                        value="2"
                        step="0.1"
                        class="slider"
                        aria-label="Tax rate percentage"
                    >
                    <div class="range-labels">
                        <span>1%</span>
                        <span>8%</span>
                    </div>
                </div>

                <div class="results-section">
                    <div class="revenue-box">
                        <h2>Annual Tax Revenue</h2>
                        <p class="tax-explanation" id="wtc-taxExplanation">2.0% of $15.3 trillion in billionaire wealth =</p>
                        <p class="revenue-amount" id="wtc-revenueAmount">$306,000,000,000</p>
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
                                <a href="https://home.treasury.gov/system/files/131/Distribution-of-Income-by-Source-2024.pdf"
                                   target="_blank" rel="noopener noreferrer">
                                    Distribution of Income by Source, U.S. Department of the Treasury (2024)
                                </a>
                                &mdash; Billionaire wealth estimate of $15.3 trillion
                            </li>
                        </ol>
                    </div>
                </div>

                <div class="info-box">
                    <p class="info-text">
                        This calculator is based on the 2024 estimate of <strong>$15.3 trillion</strong>
                        in billionaire wealth from U.S. Treasury data. Tax rates range from 1% to 8%
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
