<?php
/**
 * Plugin Name: Abdulify Me
 * Plugin URI:  https://github.com/hexa-decim8/Molotools
 * Description: Upload a photo, add lightweight Abdul El-Sayed support overlays, and download the result directly in the browser. Embed with [abdulify_me].
 * Version:     0.1.5
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

define( 'ABDULIFY_ME_VERSION', '0.1.5' );
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
    global $abdulify_me_updater, $wpdb;

    if ( $abdulify_me_updater instanceof AM_GitHub_Updater ) {
        $abdulify_me_updater->ensure_schedule();
    }

    // Create avatar events tracking table
    $charset_collate = $wpdb->get_charset_collate();
    $table_name      = $wpdb->prefix . 'abdulify_me_avatar_events';

    $sql = "CREATE TABLE IF NOT EXISTS $table_name (
        id bigint(20) NOT NULL AUTO_INCREMENT,
        user_id bigint(20),
        session_id varchar(64),
        facebook_page_id varchar(20),
        effects_used longtext,
        success tinyint(1) NOT NULL DEFAULT 0,
        error_message text,
        created_at datetime DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY user_id (user_id),
        KEY success (success),
        KEY created_at (created_at)
    ) $charset_collate;";

    require_once ABSPATH . 'wp-admin/includes/upgrade.php';
    dbDelta( $sql );
}
register_activation_hook( __FILE__, 'abdulify_me_activate' );

function abdulify_me_deactivate() {
    wp_clear_scheduled_hook( ABDULIFY_ME_UPDATE_CRON_HOOK );
    delete_transient( 'am_updater_install_lock' );
}
register_deactivation_hook( __FILE__, 'abdulify_me_deactivate' );

final class Abdulify_Me_Plugin {
    const SHORTCODE = 'abdulify_me';
    const SETTINGS_GROUP = 'abdulify_me_settings';
    const OPTION_FACEBOOK_APP_ID = 'abdulify_me_facebook_app_id';
    const FACEBOOK_GRAPH_VERSION = 'v25.0';
    const FACEBOOK_PERMISSIONS = 'pages_show_list,pages_read_engagement,pages_manage_metadata';
    const AJAX_ACTION_SET_FACEBOOK_AVATAR = 'abdulify_me_set_facebook_avatar';
    const SESSION_ID_TRANSIENT = 'abdulify_me_session_';
    const OVERLAY_DIR = 'overlays';
    const OVERLAY_PREFIX = 'AFS-Social';

    public function __construct() {
        add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_assets' ) );
        add_shortcode( self::SHORTCODE, array( $this, 'render_shortcode' ) );
        add_action( 'admin_menu', array( $this, 'register_settings_page' ) );
        add_action( 'admin_init', array( $this, 'register_settings' ) );
        add_action( 'wp_ajax_' . self::AJAX_ACTION_SET_FACEBOOK_AVATAR, array( $this, 'ajax_set_facebook_avatar' ) );
        add_action( 'wp_ajax_nopriv_' . self::AJAX_ACTION_SET_FACEBOOK_AVATAR, array( $this, 'ajax_set_facebook_avatar' ) );
    }

    public function register_settings_page() {
        add_options_page(
            __( 'Abdulify Me', 'abdulify-me' ),
            __( 'Abdulify Me', 'abdulify-me' ),
            'manage_options',
            'abdulify-me-settings',
            array( $this, 'render_settings_page' )
        );
    }

    public function register_settings() {
        register_setting(
            self::SETTINGS_GROUP,
            self::OPTION_FACEBOOK_APP_ID,
            array(
                'type' => 'string',
                'sanitize_callback' => 'sanitize_text_field',
                'default' => '',
            )
        );

        add_settings_section(
            'abdulify_me_facebook_section',
            __( 'Facebook Page Avatar', 'abdulify-me' ),
            array( $this, 'render_facebook_settings_description' ),
            self::SETTINGS_GROUP
        );

        add_settings_field(
            self::OPTION_FACEBOOK_APP_ID,
            __( 'Facebook App ID', 'abdulify-me' ),
            array( $this, 'render_facebook_app_id_field' ),
            self::SETTINGS_GROUP,
            'abdulify_me_facebook_section'
        );
    }

    public function render_facebook_settings_description() {
        echo '<p>' . esc_html__( 'Enable one-click Page avatar updates by entering a Meta App ID configured for Facebook Login. The widget requests only Page permissions and does not store long-lived tokens server-side.', 'abdulify-me' ) . '</p>';
        echo '<p><strong>' . esc_html__( 'Permissions requested:', 'abdulify-me' ) . '</strong> <code>' . esc_html( self::FACEBOOK_PERMISSIONS ) . '</code></p>';
    }

    public function render_facebook_app_id_field() {
        $value = get_option( self::OPTION_FACEBOOK_APP_ID, '' );
        ?>
        <input
            type="text"
            class="regular-text"
            id="<?php echo esc_attr( self::OPTION_FACEBOOK_APP_ID ); ?>"
            name="<?php echo esc_attr( self::OPTION_FACEBOOK_APP_ID ); ?>"
            value="<?php echo esc_attr( $value ); ?>"
            autocomplete="off"
            spellcheck="false"
        />
        <p class="description">
            <?php esc_html_e( 'Set your Meta app ID. Keep your app secret out of WordPress frontend code. The plugin uses the Facebook implicit login flow and uploads the generated image to a selected Facebook Page.', 'abdulify-me' ); ?>
        </p>
        <?php
    }

    public function render_settings_page() {
        if ( ! current_user_can( 'manage_options' ) ) {
            return;
        }

        $stats = $this->get_statistics();

        ?>
        <div class="wrap">
            <h1><?php esc_html_e( 'Abdulify Me Settings', 'abdulify-me' ); ?></h1>
            <form method="post" action="options.php">
                <?php
                settings_fields( self::SETTINGS_GROUP );
                do_settings_sections( self::SETTINGS_GROUP );
                submit_button();
                ?>
            </form>

            <?php if ( $stats['total_attempts'] > 0 ) : ?>
                <div class="card" style="margin-top: 20px;">
                    <h2><?php esc_html_e( 'Facebook Avatar Statistics', 'abdulify-me' ); ?></h2>
                    <table class="widefat" style="margin-top: 15px;">
                        <tbody>
                            <tr>
                                <td><?php esc_html_e( 'Total Avatar Updates Attempted', 'abdulify-me' ); ?></td>
                                <td><strong><?php echo esc_html( $stats['total_attempts'] ); ?></strong></td>
                            </tr>
                            <tr>
                                <td><?php esc_html_e( 'Successful Updates', 'abdulify-me' ); ?></td>
                                <td><strong><?php echo esc_html( $stats['successful'] ); ?></strong></td>
                            </tr>
                            <tr>
                                <td><?php esc_html_e( 'Failed Updates', 'abdulify-me' ); ?></td>
                                <td><strong><?php echo esc_html( $stats['failed'] ); ?></strong></td>
                            </tr>
                            <tr>
                                <td><?php esc_html_e( 'Success Rate', 'abdulify-me' ); ?></td>
                                <td><strong><?php echo esc_html( $stats['success_rate'] ); ?>%</strong></td>
                            </tr>
                            <tr>
                                <td><?php esc_html_e( 'Unique Logged-in Users', 'abdulify-me' ); ?></td>
                                <td><strong><?php echo esc_html( $stats['unique_users'] ); ?></strong></td>
                            </tr>
                            <tr>
                                <td><?php esc_html_e( 'Unique Anonymous Sessions', 'abdulify-me' ); ?></td>
                                <td><strong><?php echo esc_html( $stats['unique_sessions'] ); ?></strong></td>
                            </tr>
                        </tbody>
                    </table>

                    <?php if ( ! empty( $stats['effects_breakdown'] ) ) : ?>
                        <h3 style="margin-top: 20px;"><?php esc_html_e( 'Borders Used in Successful Updates', 'abdulify-me' ); ?></h3>
                        <table class="widefat">
                            <tbody>
                                <?php foreach ( $stats['effects_breakdown'] as $effect => $count ) : ?>
                                    <tr>
                                        <td>
                                            <?php
                                            echo esc_html( $this->format_overlay_label( (string) $effect ) );
                                            ?>
                                        </td>
                                        <td><strong><?php echo esc_html( $count ); ?></strong></td>
                                    </tr>
                                <?php endforeach; ?>
                            </tbody>
                        </table>
                    <?php endif; ?>
                </div>
            <?php endif; ?>
        </div>
        <?php
    }

    private function get_facebook_app_id() {
        return (string) get_option( self::OPTION_FACEBOOK_APP_ID, '' );
    }

    private function get_overlay_dir_path() {
        return trailingslashit( plugin_dir_path( __FILE__ ) ) . self::OVERLAY_DIR . '/';
    }

    private function get_overlay_dir_url() {
        return trailingslashit( plugin_dir_url( __FILE__ ) ) . self::OVERLAY_DIR . '/';
    }

    private function normalize_overlay_id( $name ) {
        $normalized = strtolower( (string) $name );
        $normalized = preg_replace( '/[^a-z0-9._-]+/', '-', $normalized );
        $normalized = trim( (string) $normalized, '-._' );

        return $normalized ?: strtolower( self::OVERLAY_PREFIX );
    }

    private function format_overlay_label( $value ) {
        $label = str_replace( array( '-', '_' ), ' ', (string) $value );
        $label = preg_replace( '/\s+/', ' ', (string) $label );
        $label = trim( (string) $label );

        if ( '' === $label ) {
            return self::OVERLAY_PREFIX;
        }

        if ( function_exists( 'mb_convert_case' ) ) {
            return mb_convert_case( $label, MB_CASE_TITLE, 'UTF-8' );
        }

        return ucwords( strtolower( $label ) );
    }

    private function get_available_overlays() {
        $overlay_dir = $this->get_overlay_dir_path();
        if ( ! is_dir( $overlay_dir ) ) {
            return array();
        }

        $files = scandir( $overlay_dir );
        if ( false === $files ) {
            return array();
        }

        $allowed_extensions = array( 'png', 'jpg', 'jpeg', 'webp', 'svg' );
        $overlay_url_base   = $this->get_overlay_dir_url();
        $overlays           = array();

        foreach ( $files as $file_name ) {
            if ( ! is_string( $file_name ) || '.' === $file_name || '..' === $file_name ) {
                continue;
            }

            $source_path = $overlay_dir . $file_name;
            if ( ! is_file( $source_path ) ) {
                continue;
            }

            if ( 0 !== stripos( $file_name, self::OVERLAY_PREFIX ) ) {
                continue;
            }

            $extension = strtolower( (string) pathinfo( $file_name, PATHINFO_EXTENSION ) );
            if ( ! in_array( $extension, $allowed_extensions, true ) ) {
                continue;
            }

            $base_name = (string) pathinfo( $file_name, PATHINFO_FILENAME );
            $overlay_id = $this->normalize_overlay_id( $base_name );

            $overlays[ $overlay_id ] = array(
                'id'    => $overlay_id,
                'label' => $this->format_overlay_label( $base_name ),
                'url'   => $overlay_url_base . rawurlencode( $file_name ),
                'file'  => $file_name,
            );
        }

        if ( empty( $overlays ) ) {
            return array();
        }

        uasort(
            $overlays,
            static function ( $a, $b ) {
                return strcasecmp( (string) $a['label'], (string) $b['label'] );
            }
        );

        return array_values( $overlays );
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
                'tintColor'   => $tint_color,
                'colors'      => $colors,
                'maxBytes'    => 8 * 1024 * 1024,
                'overlays'    => $this->get_available_overlays(),
                'nonce'       => wp_create_nonce( 'abdulify_me_client' ),
                'ajaxUrl'     => admin_url( 'admin-ajax.php' ),
                'actions'     => array(
                    'setFacebookAvatar' => self::AJAX_ACTION_SET_FACEBOOK_AVATAR,
                ),
                'facebookAvatarNonce' => wp_create_nonce( 'abdulify_me_facebook_avatar' ),
                'facebook' => array(
                    'enabled'      => '' !== $this->get_facebook_app_id(),
                    'appId'        => $this->get_facebook_app_id(),
                    'graphVersion' => self::FACEBOOK_GRAPH_VERSION,
                    'permissions'  => self::FACEBOOK_PERMISSIONS,
                ),
            )
        );
    }

    public function render_shortcode( $atts = array() ) {
        $atts = shortcode_atts(
            array(
                'title'    => __( 'Abdulify Me', 'abdulify-me' ),
                'subtitle' => __( 'Upload a photo, apply an AFS-Social border, and download your image.', 'abdulify-me' ),
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

                    <fieldset class="am-controls" aria-label="<?php esc_attr_e( 'Photo border', 'abdulify-me' ); ?>">
                        <legend><?php esc_html_e( 'Border', 'abdulify-me' ); ?></legend>

                        <label class="am-control-row">
                            <span><?php esc_html_e( 'AFS-Social border', 'abdulify-me' ); ?></span>
                        </label>
                        <select class="am-select" data-am-overlay-select>
                            <option value=""><?php esc_html_e( 'Select a border', 'abdulify-me' ); ?></option>
                        </select>
                    </fieldset>

                    <div class="am-actions">
                        <button class="am-button am-apply" type="button" data-am-apply disabled>
                            <?php esc_html_e( 'Apply Border', 'abdulify-me' ); ?>
                        </button>
                        <button class="am-button am-download" type="button" data-am-download disabled>
                            <?php esc_html_e( 'Download Image', 'abdulify-me' ); ?>
                        </button>
                    </div>

                    <div class="am-facebook" data-am-facebook>
                        <button class="am-button am-facebook-avatar" type="button" data-am-fb-avatar disabled aria-label="<?php esc_attr_e( 'Share to Facebook', 'abdulify-me' ); ?>">
                            <span class="am-facebook-icon">f</span>
                            <span class="screen-reader-text"><?php esc_html_e( 'Upload image as Facebook Page avatar', 'abdulify-me' ); ?></span>
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

    public function ajax_set_facebook_avatar() {
        $nonce = isset( $_POST['nonce'] ) ? sanitize_text_field( wp_unslash( $_POST['nonce'] ) ) : '';
        if ( ! wp_verify_nonce( $nonce, 'abdulify_me_facebook_avatar' ) ) {
            wp_send_json_error(
                array(
                    'message' => __( 'Security check failed. Refresh and try again.', 'abdulify-me' ),
                ),
                403
            );
        }

        $page_id           = isset( $_POST['pageId'] ) ? sanitize_text_field( wp_unslash( $_POST['pageId'] ) ) : '';
        $page_access_token = isset( $_POST['pageAccessToken'] ) ? sanitize_text_field( wp_unslash( $_POST['pageAccessToken'] ) ) : '';
        $image_data        = isset( $_POST['imageData'] ) ? wp_unslash( $_POST['imageData'] ) : '';
        $effects_used      = isset( $_POST['effectsUsed'] ) ? wp_unslash( $_POST['effectsUsed'] ) : '{}';

        // Parse effects JSON
        $effects_array = json_decode( $effects_used, true );
        if ( ! is_array( $effects_array ) ) {
            $effects_array = array();
        }

        if ( ! preg_match( '/^[0-9]+$/', $page_id ) ) {
            $this->log_avatar_event( 'invalid', $effects_array, false, 'Invalid Facebook Page ID' );
            wp_send_json_error(
                array(
                    'message' => __( 'Invalid Facebook Page selected.', 'abdulify-me' ),
                ),
                400
            );
        }

        if ( strlen( $page_access_token ) < 20 ) {
            $this->log_avatar_event( $page_id, $effects_array, false, 'Missing Facebook authorization token' );
            wp_send_json_error(
                array(
                    'message' => __( 'Missing Facebook authorization token.', 'abdulify-me' ),
                ),
                400
            );
        }

        if ( ! is_string( $image_data ) || 0 !== strpos( $image_data, 'data:image/png;base64,' ) ) {
            $this->log_avatar_event( $page_id, $effects_array, false, 'Invalid image payload format' );
            wp_send_json_error(
                array(
                    'message' => __( 'Invalid image payload. Please apply effects again and retry.', 'abdulify-me' ),
                ),
                400
            );
        }

        $raw_payload = substr( $image_data, strlen( 'data:image/png;base64,' ) );
        $binary      = base64_decode( $raw_payload, true );

        if ( false === $binary || '' === $binary ) {
            $this->log_avatar_event( $page_id, $effects_array, false, 'Could not decode image data' );
            wp_send_json_error(
                array(
                    'message' => __( 'Could not decode image data.', 'abdulify-me' ),
                ),
                400
            );
        }

        if ( strlen( $binary ) > ( 10 * 1024 * 1024 ) ) {
            $this->log_avatar_event( $page_id, $effects_array, false, 'Image too large for upload' );
            wp_send_json_error(
                array(
                    'message' => __( 'Image is too large for Facebook upload.', 'abdulify-me' ),
                ),
                413
            );
        }

        $temp_file = wp_tempnam( 'abdulify-facebook-avatar' );
        if ( ! $temp_file ) {
            $this->log_avatar_event( $page_id, $effects_array, false, 'Server could not prepare image upload' );
            wp_send_json_error(
                array(
                    'message' => __( 'Server could not prepare image upload.', 'abdulify-me' ),
                ),
                500
            );
        }

        $bytes_written = file_put_contents( $temp_file, $binary );
        if ( false === $bytes_written || 0 === $bytes_written ) {
            @unlink( $temp_file );
            $this->log_avatar_event( $page_id, $effects_array, false, 'Could not write image to temporary file' );
            wp_send_json_error(
                array(
                    'message' => __( 'Server could not prepare image upload.', 'abdulify-me' ),
                ),
                500
            );
        }

        $upload_result = $this->upload_facebook_page_avatar( $page_id, $page_access_token, $temp_file );
        @unlink( $temp_file );

        if ( is_wp_error( $upload_result ) ) {
            $this->log_avatar_event( $page_id, $effects_array, false, $upload_result->get_error_message() );
            wp_send_json_error(
                array(
                    'message' => $upload_result->get_error_message(),
                ),
                500
            );
        }

        $this->log_avatar_event( $page_id, $effects_array, true );
        wp_send_json_success(
            array(
                'message' => __( 'Facebook Page avatar updated.', 'abdulify-me' ),
            )
        );
    }

    private function get_or_create_session_id() {
        $session_id = isset( $_COOKIE['abdulify_me_session'] ) ? sanitize_text_field( wp_unslash( $_COOKIE['abdulify_me_session'] ) ) : '';

        if ( empty( $session_id ) || strlen( $session_id ) !== 64 ) {
            $session_id = bin2hex( random_bytes( 32 ) );
            setcookie( 'abdulify_me_session', $session_id, time() + ( 30 * DAY_IN_SECONDS ), '/' );
        }

        return $session_id;
    }

    private function log_avatar_event( $page_id, $effects_used, $success, $error_message = '' ) {
        global $wpdb;

        $user_id   = get_current_user_id();
        $session_id = $this->get_or_create_session_id();
        $table_name = $wpdb->prefix . 'abdulify_me_avatar_events';

        $wpdb->insert(
            $table_name,
            array(
                'user_id'           => $user_id > 0 ? $user_id : null,
                'session_id'        => $session_id,
                'facebook_page_id'  => $page_id,
                'effects_used'      => wp_json_encode( $effects_used ),
                'success'           => $success ? 1 : 0,
                'error_message'     => $error_message,
            ),
            array( '%d', '%s', '%s', '%s', '%d', '%s' )
        );
    }

    public function get_statistics() {
        global $wpdb;
        $table_name = $wpdb->prefix . 'abdulify_me_avatar_events';

        // Check if table exists
        $table_exists = $wpdb->get_var( $wpdb->prepare( "SHOW TABLES LIKE %s", $table_name ) ) === $table_name;
        if ( ! $table_exists ) {
            return array(
                'total_attempts'  => 0,
                'successful'      => 0,
                'failed'          => 0,
                'success_rate'    => 0,
                'unique_users'    => 0,
                'unique_sessions' => 0,
                'effects_breakdown' => array(),
            );
        }

        $total_attempts = (int) $wpdb->get_var( "SELECT COUNT(*) FROM $table_name" );
        $successful     = (int) $wpdb->get_var( "SELECT COUNT(*) FROM $table_name WHERE success = 1" );
        $failed         = $total_attempts - $successful;
        $success_rate   = $total_attempts > 0 ? round( ( $successful / $total_attempts ) * 100, 1 ) : 0;

        $unique_users = (int) $wpdb->get_var(
            "SELECT COUNT(DISTINCT user_id) FROM $table_name WHERE user_id IS NOT NULL"
        );
        $unique_sessions = (int) $wpdb->get_var(
            "SELECT COUNT(DISTINCT session_id) FROM $table_name WHERE session_id IS NOT NULL"
        );

        // Calculate effects breakdown
        $effects_breakdown = array();

        $events = $wpdb->get_results( "SELECT effects_used FROM $table_name WHERE success = 1 AND effects_used IS NOT NULL" );
        foreach ( $events as $event ) {
            $effects = json_decode( $event->effects_used, true );
            if ( is_array( $effects ) ) {
                if ( isset( $effects['overlay'] ) && is_string( $effects['overlay'] ) && '' !== trim( $effects['overlay'] ) ) {
                    $overlay_key = trim( $effects['overlay'] );
                    if ( ! isset( $effects_breakdown[ $overlay_key ] ) ) {
                        $effects_breakdown[ $overlay_key ] = 0;
                    }
                    $effects_breakdown[ $overlay_key ]++;
                    continue;
                }

                foreach ( $effects as $effect => $enabled ) {
                    if ( ! $enabled ) {
                        continue;
                    }

                    $legacy_effect = (string) $effect;
                    if ( ! isset( $effects_breakdown[ $legacy_effect ] ) ) {
                        $effects_breakdown[ $legacy_effect ] = 0;
                    }
                    $effects_breakdown[ $legacy_effect ]++;
                }
            }
        }

        arsort( $effects_breakdown );

        return array(
            'total_attempts'  => $total_attempts,
            'successful'      => $successful,
            'failed'          => $failed,
            'success_rate'    => $success_rate,
            'unique_users'    => $unique_users,
            'unique_sessions' => $unique_sessions,
            'effects_breakdown' => $effects_breakdown,
        );
    }

    private function upload_facebook_page_avatar( $page_id, $page_access_token, $temp_file ) {
        if ( ! function_exists( 'curl_init' ) ) {
            return new WP_Error( 'am_curl_missing', __( 'Server is missing cURL support for Facebook upload.', 'abdulify-me' ) );
        }

        if ( ! function_exists( 'curl_file_create' ) ) {
            return new WP_Error( 'am_curl_file_missing', __( 'Server is missing curl_file_create required for image upload.', 'abdulify-me' ) );
        }

        $endpoint = sprintf(
            'https://graph.facebook.com/%s/%s/picture',
            self::FACEBOOK_GRAPH_VERSION,
            rawurlencode( $page_id )
        );

        $file = curl_file_create( $temp_file, 'image/png', 'abdulified-photo.png' );

        $ch = curl_init( $endpoint );
        if ( false === $ch ) {
            return new WP_Error( 'am_curl_init_failed', __( 'Could not initialize Facebook upload request.', 'abdulify-me' ) );
        }

        curl_setopt(
            $ch,
            CURLOPT_POSTFIELDS,
            array(
                'access_token' => $page_access_token,
                'source'       => $file,
            )
        );
        curl_setopt( $ch, CURLOPT_RETURNTRANSFER, true );
        curl_setopt( $ch, CURLOPT_TIMEOUT, 25 );
        curl_setopt( $ch, CURLOPT_HTTPHEADER, array( 'Expect:' ) );

        $response_body = curl_exec( $ch );
        $curl_error    = curl_error( $ch );
        $status_code   = (int) curl_getinfo( $ch, CURLINFO_RESPONSE_CODE );

        curl_close( $ch );

        if ( '' !== $curl_error ) {
            return new WP_Error( 'am_facebook_curl_error', sprintf( __( 'Facebook request failed: %s', 'abdulify-me' ), $curl_error ) );
        }

        $decoded = json_decode( (string) $response_body, true );
        if ( ! is_array( $decoded ) ) {
            return new WP_Error( 'am_facebook_invalid_response', __( 'Facebook returned an invalid response.', 'abdulify-me' ) );
        }

        if ( $status_code >= 400 || empty( $decoded['success'] ) ) {
            $error_message = __( 'Facebook rejected the avatar update request.', 'abdulify-me' );
            if ( isset( $decoded['error']['message'] ) && is_string( $decoded['error']['message'] ) ) {
                $error_message = $decoded['error']['message'];
            }

            return new WP_Error( 'am_facebook_upload_failed', $error_message );
        }

        return $decoded;
    }
}

new Abdulify_Me_Plugin();
