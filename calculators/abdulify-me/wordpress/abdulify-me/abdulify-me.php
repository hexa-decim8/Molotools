<?php
/**
 * Plugin Name: Abdulify Me
 * Plugin URI:  https://github.com/hexa-decim8/Molotools
 * Description: Upload a photo, add lightweight Abdul El-Sayed support overlays, and download the result directly in the browser. Embed with [abdulify_me].
 * Version:     0.1.1
 * Author:      Molotools
 * License:     GPL v2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: abdulify-me
 * Requires:    5.0
 * Requires PHP: 7.4
 * Tested up to: 6.6
 * GitHub Plugin URI: hexa-decim8/Molotools
 * GitHub Branch:     main
 * Primary Branch:    main
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

define( 'ABDULIFY_ME_VERSION', '0.1.1' );
define( 'ABDULIFY_ME_PLUGIN_BASENAME', 'abdulify-me/abdulify-me.php' );
define( 'ABDULIFY_ME_GITHUB_REPO', 'hexa-decim8/Molotools' );
define( 'ABDULIFY_ME_RELEASE_ASSET', 'abdulify-me.zip' );
define( 'ABDULIFY_ME_CACHE_TTL', 5 * MINUTE_IN_SECONDS );
define( 'ABDULIFY_ME_UPDATE_ERROR_TTL', 5 * MINUTE_IN_SECONDS );
define( 'ABDULIFY_ME_UPDATE_CRON_HOOK', 'am_run_scheduled_update_check' );
define( 'ABDULIFY_ME_UPDATE_CRON_SCHEDULE', 'am_every_five_minutes' );
define( 'ABDULIFY_ME_AUTO_INSTALL_LOCK_TTL', 5 * MINUTE_IN_SECONDS );

class AM_GitHub_Updater {

    private $slug;
    private $repo;
    private $version;
    private $cache_key;
    private $cache_ttl = ABDULIFY_ME_CACHE_TTL;

    public function __construct( $slug, $repo, $version ) {
        $this->slug      = $slug;
        $this->repo      = $repo;
        $this->version   = $version;
        $this->cache_key = 'am_github_update_' . md5( $slug );

        add_filter( 'pre_set_site_transient_update_plugins', array( $this, 'check_for_update' ) );
        add_filter( 'plugins_api', array( $this, 'plugin_info' ), 10, 3 );
        add_filter( 'upgrader_source_selection', array( $this, 'fix_folder_name' ), 10, 4 );
        add_filter( 'auto_update_plugin', array( $this, 'enable_auto_updates' ), 10, 2 );
        add_action( ABDULIFY_ME_UPDATE_CRON_HOOK, array( $this, 'run_scheduled_update' ) );
        add_action( 'init', array( $this, 'ensure_schedule' ) );
    }

    private function log_error( $message ) {
        update_option( 'am_updater_last_error', $message, false );
        error_log( '[Abdulify Me Updater] ' . $message );
    }

    private function clear_last_error() {
        delete_option( 'am_updater_last_error' );
    }

    private function record_successful_check() {
        update_option( 'am_updater_last_check', time(), false );
        $this->clear_last_error();
    }

    public function ensure_schedule() {
        if ( ! wp_next_scheduled( ABDULIFY_ME_UPDATE_CRON_HOOK ) ) {
            if ( ! wp_schedule_event( time() + ABDULIFY_ME_CACHE_TTL, ABDULIFY_ME_UPDATE_CRON_SCHEDULE, ABDULIFY_ME_UPDATE_CRON_HOOK ) ) {
                $this->log_error( 'Unable to schedule the recurring 5-minute update check.' );
            }
        }
    }

    public function clear_cached_release() {
        delete_transient( $this->cache_key );
    }

    private function normalize_version_from_tag( $tag_name ) {
        if ( ! is_string( $tag_name ) ) {
            return null;
        }

        $tag_name = trim( $tag_name );

        if ( preg_match( '/^(?:am-)?v?(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)$/', $tag_name, $matches ) ) {
            return $matches[1];
        }

        if ( preg_match( '/^(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)$/', $tag_name, $matches ) ) {
            return $matches[1];
        }

        return null;
    }

    private function get_release( $force = false ) {
        $cached = $force ? false : get_transient( $this->cache_key );
        if ( $cached !== false ) {
            return $cached;
        }

        $url      = 'https://api.github.com/repos/' . $this->repo . '/releases/latest';
        $response = wp_remote_get(
            $url,
            array(
                'headers' => array(
                    'Accept' => 'application/vnd.github.v3+json',
                    'User-Agent' => 'WordPress/' . get_bloginfo( 'version' ),
                ),
                'timeout' => 10,
            )
        );

        if ( is_wp_error( $response ) || wp_remote_retrieve_response_code( $response ) !== 200 ) {
            $message = is_wp_error( $response )
                ? $response->get_error_message()
                : 'GitHub API returned HTTP ' . wp_remote_retrieve_response_code( $response );

            $this->log_error( 'Release check failed: ' . $message );
            set_transient( $this->cache_key, null, ABDULIFY_ME_UPDATE_ERROR_TTL );
            return null;
        }

        $release = json_decode( wp_remote_retrieve_body( $response ) );
        if ( ! is_object( $release ) || empty( $release->tag_name ) ) {
            $this->log_error( 'GitHub release payload was invalid or missing tag_name.' );
            set_transient( $this->cache_key, null, ABDULIFY_ME_UPDATE_ERROR_TTL );
            return null;
        }

        if ( ! $this->normalize_version_from_tag( $release->tag_name ) ) {
            $this->log_error( 'Latest GitHub release tag is not a recognized version: ' . $release->tag_name );
            set_transient( $this->cache_key, null, ABDULIFY_ME_UPDATE_ERROR_TTL );
            return null;
        }

        set_transient( $this->cache_key, $release, $this->cache_ttl );
        $this->record_successful_check();
        return $release;
    }

    private function get_remote_version( $release ) {
        if ( ! is_object( $release ) || empty( $release->tag_name ) ) {
            return null;
        }

        return $this->normalize_version_from_tag( $release->tag_name );
    }

    private function build_plugin_update_item( $remote_version, $asset_url ) {
        return (object) array(
            'slug' => dirname( $this->slug ),
            'plugin' => $this->slug,
            'new_version' => $remote_version,
            'url' => 'https://github.com/' . $this->repo,
            'package' => $asset_url,
            'tested' => '',
            'requires_php' => '7.4',
            'icons' => array(),
            'banners' => array(),
        );
    }

    private function get_asset_url( $release ) {
        if ( empty( $release->assets ) ) {
            $this->log_error( 'Latest GitHub release is missing assets.' );
            return null;
        }

        foreach ( $release->assets as $asset ) {
            if ( $asset->name === ABDULIFY_ME_RELEASE_ASSET ) {
                return $asset->browser_download_url;
            }
        }

        $this->log_error( 'Latest GitHub release is missing the required ' . ABDULIFY_ME_RELEASE_ASSET . ' asset.' );
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

    private function maybe_install_update( $transient ) {
        if ( ! isset( $transient->response[ $this->slug ] ) ) {
            return;
        }

        $lock_key = 'am_updater_install_lock';
        if ( get_transient( $lock_key ) ) {
            return;
        }

        if ( ! function_exists( 'wp_clean_plugins_cache' ) ) {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
        }
        require_once ABSPATH . 'wp-admin/includes/file.php';
        require_once ABSPATH . 'wp-admin/includes/misc.php';
        require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';

        set_transient( $lock_key, 1, ABDULIFY_ME_AUTO_INSTALL_LOCK_TTL );

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

    public function check_for_update( $transient ) {
        if ( empty( $transient->checked ) ) {
            return $transient;
        }

        $release = $this->get_release();
        if ( ! $release ) {
            return $transient;
        }

        $remote_version = $this->get_remote_version( $release );
        $asset_url      = $this->get_asset_url( $release );

        if ( ! $remote_version || ! $asset_url ) {
            return $transient;
        }

        if ( ! isset( $transient->response ) || ! is_array( $transient->response ) ) {
            $transient->response = array();
        }
        if ( ! isset( $transient->no_update ) || ! is_array( $transient->no_update ) ) {
            $transient->no_update = array();
        }

        if ( version_compare( $this->version, $remote_version, '<' ) ) {
            $transient->response[ $this->slug ] = $this->build_plugin_update_item( $remote_version, $asset_url );
            unset( $transient->no_update[ $this->slug ] );
        } else {
            $transient->no_update[ $this->slug ] = $this->build_plugin_update_item( $remote_version, $asset_url );
            unset( $transient->response[ $this->slug ] );
        }

        return $transient;
    }

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

        $remote_version = $this->get_remote_version( $release );
        $asset_url      = $this->get_asset_url( $release );

        if ( ! $remote_version || ! $asset_url ) {
            return $result;
        }

        return (object) array(
            'name' => 'Abdulify Me',
            'slug' => dirname( $this->slug ),
            'version' => $remote_version,
            'author' => '<a href="https://github.com/hexa-decim8">Molotools</a>',
            'homepage' => 'https://github.com/' . $this->repo,
            'download_link' => $asset_url,
            'sections' => array(
                'description' => isset( $release->body ) ? nl2br( esc_html( $release->body ) ) : 'See GitHub for full changelog.',
            ),
        );
    }

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

    public function enable_auto_updates( $update, $item ) {
        if ( isset( $item->slug ) && $item->slug === dirname( $this->slug ) ) {
            return true;
        }

        return $update;
    }
}

$abdulify_me_updater = new AM_GitHub_Updater(
    ABDULIFY_ME_PLUGIN_BASENAME,
    ABDULIFY_ME_GITHUB_REPO,
    ABDULIFY_ME_VERSION
);

function abdulify_me_register_cron_schedule( $schedules ) {
    $schedules[ ABDULIFY_ME_UPDATE_CRON_SCHEDULE ] = array(
        'interval' => ABDULIFY_ME_CACHE_TTL,
        'display' => __( 'Every 5 Minutes (Abdulify Me)', 'abdulify-me' ),
    );

    return $schedules;
}
add_filter( 'cron_schedules', 'abdulify_me_register_cron_schedule' );

function abdulify_me_activate() {
    global $abdulify_me_updater;

    if ( $abdulify_me_updater instanceof AM_GitHub_Updater ) {
        $abdulify_me_updater->ensure_schedule();
    }
}
register_activation_hook( __FILE__, 'abdulify_me_activate' );

function abdulify_me_deactivate() {
    wp_clear_scheduled_hook( ABDULIFY_ME_UPDATE_CRON_HOOK );
    delete_transient( 'am_updater_install_lock' );
}
register_deactivation_hook( __FILE__, 'abdulify_me_deactivate' );

final class Abdulify_Me_Plugin {
    const SHORTCODE = 'abdulify_me';

    public function __construct() {
        add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_assets' ) );
        add_shortcode( self::SHORTCODE, array( $this, 'render_shortcode' ) );
    }

    public function enqueue_assets() {
        if ( is_admin() || ! is_singular() ) {
            return;
        }

        global $post;
        if ( ! ( $post instanceof WP_Post ) || ! has_shortcode( $post->post_content, self::SHORTCODE ) ) {
            return;
        }

        $asset_suffix = ( defined( 'WP_DEBUG' ) && WP_DEBUG ) ? '' : '.min';

        wp_enqueue_style(
            'abdulify-me',
            plugin_dir_url( __FILE__ ) . 'css/abdulify-me' . $asset_suffix . '.css',
            array(),
            ABDULIFY_ME_VERSION
        );

        wp_enqueue_script(
            'abdulify-me',
            plugin_dir_url( __FILE__ ) . 'js/abdulify-me' . $asset_suffix . '.js',
            array(),
            ABDULIFY_ME_VERSION,
            true
        );

        $tint_color = apply_filters( 'abdulify_me_tint_color', '#175f8c' );
        $colors     = array(
            'bg'              => apply_filters( 'abdulify_me_color_bg', '#f6f1e5' ),
            'surface'         => apply_filters( 'abdulify_me_color_surface', '#ffffff' ),
            'primary'         => apply_filters( 'abdulify_me_color_primary', '#0f4f78' ),
            'primaryStrong'   => apply_filters( 'abdulify_me_color_primary_strong', '#0b3957' ),
            'accent'          => apply_filters( 'abdulify_me_color_accent', '#f0a33b' ),
            'ink'             => apply_filters( 'abdulify_me_color_ink', '#1f2530' ),
            'muted'           => apply_filters( 'abdulify_me_color_muted', '#5f6877' ),
            'border'          => apply_filters( 'abdulify_me_color_border', '#dbe3ec' ),
            'statusInfo'      => apply_filters( 'abdulify_me_color_status_info', '#5f6877' ),
            'statusError'     => apply_filters( 'abdulify_me_color_status_error', '#b3212f' ),
            'placeholderBg'   => apply_filters( 'abdulify_me_color_placeholder_bg', '#f2f6fb' ),
            'placeholderText' => apply_filters( 'abdulify_me_color_placeholder_text', '#335f88' ),
            'ribbon'          => apply_filters( 'abdulify_me_color_ribbon', '' ),
            'ribbonText'      => apply_filters( 'abdulify_me_color_ribbon_text', '#ffffff' ),
            'badgeStroke'     => apply_filters( 'abdulify_me_color_badge_stroke', '#0b3957' ),
            'badgeText'       => apply_filters( 'abdulify_me_color_badge_text', '#0b3957' ),
            'tint'            => apply_filters( 'abdulify_me_color_tint', $tint_color ),
        );

        wp_localize_script(
            'abdulify-me',
            'abdulifyMeConfig',
            array(
                'overlayText' => __( 'I Support Abdul El-Sayed', 'abdulify-me' ),
                'badgeText'   => __( 'Abdul 2026', 'abdulify-me' ),
                'tintColor'   => $tint_color,
                'colors'      => $colors,
                'maxBytes'    => 8 * 1024 * 1024,
                'nonce'       => wp_create_nonce( 'abdulify_me_client' ),
            )
        );
    }

    public function render_shortcode( $atts = array() ) {
        $atts = shortcode_atts(
            array(
                'title'    => __( 'Abdulify Me', 'abdulify-me' ),
                'subtitle' => __( 'Upload a photo, add campaign-style effects, and download your image.', 'abdulify-me' ),
            ),
            $atts,
            self::SHORTCODE
        );

        $title    = esc_html( $atts['title'] );
        $subtitle = esc_html( $atts['subtitle'] );

        ob_start();
        ?>
        <section class="am-widget" data-am-widget>
            <header class="am-header">
                <h2 class="am-title"><?php echo $title; ?></h2>
                <p class="am-subtitle"><?php echo $subtitle; ?></p>
            </header>

            <div class="am-grid">
                <div class="am-panel">
                    <label class="am-upload">
                        <span class="am-upload-title"><?php esc_html_e( 'Upload Photo', 'abdulify-me' ); ?></span>
                        <span class="am-upload-help"><?php esc_html_e( 'PNG or JPG up to 8 MB', 'abdulify-me' ); ?></span>
                        <input class="am-photo-input" type="file" accept="image/png,image/jpeg,image/webp">
                    </label>

                    <fieldset class="am-controls" aria-label="<?php esc_attr_e( 'Photo effects', 'abdulify-me' ); ?>">
                        <legend><?php esc_html_e( 'Effects', 'abdulify-me' ); ?></legend>

                        <label class="am-toggle">
                            <input type="checkbox" data-am-effect="frame" checked>
                            <span><?php esc_html_e( 'Campaign frame', 'abdulify-me' ); ?></span>
                        </label>

                        <label class="am-toggle">
                            <input type="checkbox" data-am-effect="text" checked>
                            <span><?php esc_html_e( 'Support text ribbon', 'abdulify-me' ); ?></span>
                        </label>

                        <label class="am-toggle">
                            <input type="checkbox" data-am-effect="tint" checked>
                            <span><?php esc_html_e( 'Color treatment', 'abdulify-me' ); ?></span>
                        </label>

                        <label class="am-toggle">
                            <input type="checkbox" data-am-effect="badge" checked>
                            <span><?php esc_html_e( 'Badge sticker', 'abdulify-me' ); ?></span>
                        </label>
                    </fieldset>

                    <div class="am-actions">
                        <button class="am-button am-apply" type="button" data-am-apply disabled>
                            <?php esc_html_e( 'Apply Effects', 'abdulify-me' ); ?>
                        </button>
                        <button class="am-button am-download" type="button" data-am-download disabled>
                            <?php esc_html_e( 'Download Image', 'abdulify-me' ); ?>
                        </button>
                    </div>

                    <p class="am-status" data-am-status><?php esc_html_e( 'Choose a photo to begin.', 'abdulify-me' ); ?></p>
                </div>

                <div class="am-preview-panel">
                    <canvas class="am-canvas" data-am-canvas width="1200" height="1200" aria-label="<?php esc_attr_e( 'Image preview', 'abdulify-me' ); ?>"></canvas>
                </div>
            </div>
        </section>
        <?php

        return (string) ob_get_clean();
    }
}

new Abdulify_Me_Plugin();
