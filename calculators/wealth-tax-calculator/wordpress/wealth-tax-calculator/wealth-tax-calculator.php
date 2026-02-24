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
 */

// Prevent direct access.
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

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
