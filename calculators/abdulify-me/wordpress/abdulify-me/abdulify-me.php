<?php
/**
 * Plugin Name: Abdulify Me
 * Plugin URI:  https://github.com/hexa-decim8/Molotools
 * Description: Upload a photo, add lightweight Abdul El-Sayed support overlays, and download the result directly in the browser. Embed with [abdulify_me].
 * Version:     0.1.0
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

define( 'ABDULIFY_ME_VERSION', '0.1.0' );
define( 'ABDULIFY_ME_PLUGIN_BASENAME', 'abdulify-me/abdulify-me.php' );
define( 'ABDULIFY_ME_GITHUB_REPO', 'hexa-decim8/Molotools' );
define( 'ABDULIFY_ME_RELEASE_ASSET', 'abdulify-me.zip' );

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

        wp_localize_script(
            'abdulify-me',
            'abdulifyMeConfig',
            array(
                'overlayText' => __( 'I Support Abdul El-Sayed', 'abdulify-me' ),
                'badgeText'   => __( 'Abdul 2026', 'abdulify-me' ),
                'tintColor'   => '#175f8c',
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
