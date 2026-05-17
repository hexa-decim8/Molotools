<?php
/**
 * Uninstall routine for Social Amplifier.
 * Called automatically by WordPress when the plugin is deleted via the admin.
 * Removes all plugin data: custom tables and options.
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
    exit;
}

require_once plugin_dir_path( __FILE__ ) . 'includes/class-sa-database.php';

SA_Database::drop_all_tables();

// Remove all plugin options.
$options = [
    'sa_platform_credentials',
    'sa_schema_version',
];

foreach ( $options as $option ) {
    delete_option( $option );
}

// Remove any lingering transients (OAuth state tokens).
global $wpdb;
$wpdb->query( "DELETE FROM {$wpdb->options} WHERE option_name LIKE '_transient_sa_oauth_state_%'" );
$wpdb->query( "DELETE FROM {$wpdb->options} WHERE option_name LIKE '_transient_timeout_sa_oauth_state_%'" );
