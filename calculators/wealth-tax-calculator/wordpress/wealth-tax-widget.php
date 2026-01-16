<?php
/**
 * Plugin Name: Billionaire Wealth Tax Calculator
 * Plugin URI: https://github.com/hexa-decim8/Molotools
 * Description: A calculator that shows potential tax revenue from billionaires at different tax rates (1%-8%), based on the 2024 Treasury estimate of $15.3 trillion in billionaire wealth.
 * Version: 1.0.0
 * Author: Molotools
 * License: GPL v2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

class Billionaire_Wealth_Tax_Calculator {
    
    /**
     * Constructor
     */
    public function __construct() {
        add_shortcode('billionaire_wealth_tax', array($this, 'render_calculator'));
        add_action('wp_enqueue_scripts', array($this, 'enqueue_assets'));
    }
    
    /**
     * Enqueue CSS and JavaScript files
     */
    public function enqueue_assets() {
        // Only enqueue if shortcode is present on the page
        global $post;
        if (is_a($post, 'WP_Post') && has_shortcode($post->post_content, 'billionaire_wealth_tax')) {
            
            // Get the plugin directory URL
            $plugin_url = plugin_dir_url(__FILE__);
            $base_url = trailingslashit(dirname($plugin_url));
            
            // Enqueue CSS
            wp_enqueue_style(
                'wealth-tax-calculator-styles',
                $base_url . 'css/styles.css',
                array(),
                '1.0.0'
            );
            
            // Enqueue JavaScript
            wp_enqueue_script(
                'wealth-tax-calculator-script',
                $base_url . 'js/calculator.js',
                array(),
                '1.0.0',
                true
            );
            
            // Pass data directory URL to JavaScript
            wp_localize_script(
                'wealth-tax-calculator-script',
                'wealthTaxConfig',
                array(
                    'dataUrl' => $base_url . 'data/'
                )
            );
        }
    }
    
    /**
     * Render the calculator HTML
     */
    public function render_calculator($atts) {
        // Parse shortcode attributes
        $atts = shortcode_atts(array(
            'title' => 'Billionaire Wealth Tax Calculator',
            'subtitle' => 'Calculate potential revenue from taxing billionaire wealth'
        ), $atts);
        
        ob_start();
        ?>
        <div class="calculator-container wealth-tax-widget">
            <header>
                <h1><?php echo esc_html($atts['title']); ?></h1>
                <p class="subtitle"><?php echo esc_html($atts['subtitle']); ?></p>
            </header>
            
            <div class="calculator-content">
                <div class="input-section">
                    <label for="taxRate">
                        <span class="label-text">Tax Rate on Billionaire Wealth:</span>
                        <span class="rate-display" id="rateDisplay">2%</span>
                    </label>
                    <input 
                        type="range" 
                        id="taxRate" 
                        min="1" 
                        max="8" 
                        value="2" 
                        step="0.1"
                        class="slider"
                    >
                    <div class="range-labels">
                        <span>1%</span>
                        <span>8%</span>
                    </div>
                </div>
                
                <div class="results-section">
                    <div class="revenue-box">
                        <h2>Annual Tax Revenue</h2>
                        <p class="revenue-amount" id="revenueAmount">$306,000,000,000</p>
                    </div>
                    
                    <div class="context-box">
                        <h3>What Could This Fund?</h3>
                        <p class="comparison-text" id="comparisonText">Loading...</p>
                    </div>
                    
                    <div class="sources-box">
                        <h4>Sources</h4>
                        <ol class="sources-list" id="sourcesList">
                            <li id="comparisonSource">Loading...</li>
                            <li>
                                <a href="https://home.treasury.gov/system/files/131/Distribution-of-Income-by-Source-2024.pdf" target="_blank" rel="noopener noreferrer">
                                    Distribution of Income by Source, U.S. Department of the Treasury (2024)
                                </a>
                                - Billionaire wealth estimate of $15.3 trillion
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

// Initialize the plugin
new Billionaire_Wealth_Tax_Calculator();
