<?php

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/**
 * Handles the [social_amplifier_toolkit id="..."] shortcode.
 */
class SA_Shortcode {

    const SHORTCODE = 'social_amplifier_toolkit';

    public function __construct() {
        add_shortcode( self::SHORTCODE, [ $this, 'render' ] );
    }

    /**
     * Conditionally enqueue the embed widget script on pages that use the shortcode.
     */
    public function maybe_enqueue_assets(): void {
        global $post;
        if ( ! is_singular() ) return;
        if ( ! is_a( $post, 'WP_Post' ) ) return;
        if ( ! has_shortcode( $post->post_content, self::SHORTCODE ) ) return;

        $this->enqueue_toolkit_script();
    }

    /**
     * Render the shortcode.  The actual widget rendering is done by toolkit.js;
     * this just emits the container div and the config script tag.
     *
     * Usage: [social_amplifier_toolkit id="abc123"]
     */
    public function render( $atts ): string {
        $atts = shortcode_atts( [ 'id' => '' ], $atts, self::SHORTCODE );
        $id   = sanitize_text_field( $atts['id'] );

        if ( ! $id ) {
            return '<!-- social_amplifier_toolkit: missing id attribute -->';
        }

        $this->enqueue_toolkit_script();

        $api_base  = rest_url( SA_REST_NAMESPACE );
        $asset_url = SA_PLUGIN_URL . 'assets/js/toolkit.js';

        return sprintf(
            '<div id="sa-toolkit-%1$s"></div>' . "\n" .
            '<script src="%2$s" data-toolkit-id="%1$s" data-api="%3$s" async></script>',
            esc_attr( $id ),
            esc_url( $asset_url ),
            esc_url( $api_base )
        );
    }

    private function enqueue_toolkit_script(): void {
        // The widget is self-loading via its data attributes; we register it so
        // WordPress is aware of the asset for cache-busting, but the shortcode
        // renders the <script> tag itself with the required data attributes.
        wp_register_script(
            'sa-toolkit',
            SA_PLUGIN_URL . 'assets/js/toolkit.js',
            [],
            SA_VERSION,
            true
        );
    }
}
