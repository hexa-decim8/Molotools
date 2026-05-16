<?php
/**
 * Fired when the plugin is uninstalled.
 *
 * @package AbdulifyMe
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
    exit;
}

delete_option( 'abdulify_me_settings' );
