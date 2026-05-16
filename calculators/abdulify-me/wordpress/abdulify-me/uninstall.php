<?php
/**
 * Fired when the plugin is uninstalled.
 *
 * @package AbdulifyMe
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
    exit;
}

global $wpdb;

$wpdb->query(
    "DELETE FROM {$wpdb->options}
    WHERE option_name LIKE '_transient_am_github_update_%'
    OR option_name LIKE '_transient_timeout_am_github_update_%'
    OR option_name = '_transient_am_updater_install_lock'
    OR option_name = '_transient_timeout_am_updater_install_lock'"
);

delete_option( 'abdulify_me_settings' );
delete_option( 'am_updater_last_error' );
delete_option( 'am_updater_last_check' );
