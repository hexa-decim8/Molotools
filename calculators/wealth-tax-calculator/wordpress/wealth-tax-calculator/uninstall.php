<?php
/**
 * Uninstall script for Billionaire Wealth Tax Calculator
 *
 * This file is automatically executed when the plugin is deleted via the WordPress admin.
 * It cleans up all plugin data from the database.
 *
 * @package WealthTaxCalculator
 */

// Exit if not called from WordPress
if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
    exit;
}

// Delete all transients used by the plugin
global $wpdb;

// Delete transients with our prefix pattern (wtc_comparisons_data_v*)
$wpdb->query(
    "DELETE FROM {$wpdb->options} 
    WHERE option_name LIKE '_transient_wtc_comparisons_data_%' 
    OR option_name LIKE '_transient_timeout_wtc_comparisons_data_%'"
);

// Delete any plugin options if we add them in the future
// delete_option( 'wtc_plugin_settings' );

// Clear any cached data
wp_cache_flush();
