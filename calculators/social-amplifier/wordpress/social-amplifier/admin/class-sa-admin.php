<?php

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/**
 * Admin settings and management UI for the Social Amplifier plugin.
 */
class SA_Admin {

    private SA_Campaigns $campaigns;
    private SA_Analytics $analytics;

    public function __construct( SA_Campaigns $campaigns, SA_Analytics $analytics ) {
        $this->campaigns = $campaigns;
        $this->analytics = $analytics;

        add_action( 'admin_menu',              [ $this, 'register_menu' ] );
        add_action( 'admin_enqueue_scripts',   [ $this, 'enqueue_assets' ] );
        add_action( 'admin_post_sa_save_credentials', [ $this, 'handle_save_credentials' ] );
        add_action( 'admin_notices',           [ $this, 'maybe_show_notices' ] );
    }

    // ── Menu ───────────────────────────────────────────────────────────────

    public function register_menu(): void {
        add_options_page(
            __( 'Social Amplifier', 'social-amplifier' ),
            __( 'Social Amplifier', 'social-amplifier' ),
            'manage_options',
            'social-amplifier',
            [ $this, 'render_settings_page' ]
        );
    }

    // ── Assets ─────────────────────────────────────────────────────────────

    public function enqueue_assets( string $hook ): void {
        if ( 'settings_page_social-amplifier' !== $hook ) return;

        wp_enqueue_style(
            'sa-admin',
            SA_PLUGIN_URL . 'assets/css/admin.css',
            [],
            SA_VERSION
        );

        wp_enqueue_script(
            'sa-admin',
            SA_PLUGIN_URL . 'assets/js/admin.js',
            [ 'jquery' ],
            SA_VERSION,
            true
        );

        wp_localize_script( 'sa-admin', 'saAdmin', [
            'apiBase'  => rest_url( SA_REST_NAMESPACE ),
            'nonce'    => wp_create_nonce( 'wp_rest' ),
            'pluginUrl' => SA_PLUGIN_URL,
        ] );
    }

    // ── Settings page renderer ─────────────────────────────────────────────

    public function render_settings_page(): void {
        if ( ! current_user_can( 'manage_options' ) ) {
            wp_die( esc_html__( 'You do not have permission to access this page.', 'social-amplifier' ) );
        }

        $tab = sanitize_key( $_GET['tab'] ?? 'overview' ); // phpcs:ignore WordPress.Security.NonceVerification
        ?>
        <div class="wrap sa-admin">
            <h1><?php esc_html_e( 'Social Amplifier', 'social-amplifier' ); ?></h1>

            <nav class="nav-tab-wrapper">
                <?php
                $tabs = [
                    'overview'      => __( 'Overview', 'social-amplifier' ),
                    'organizations' => __( 'Organizations', 'social-amplifier' ),
                    'credentials'   => __( 'Platform Credentials', 'social-amplifier' ),
                ];
                foreach ( $tabs as $slug => $label ) {
                    $class = $tab === $slug ? 'nav-tab nav-tab-active' : 'nav-tab';
                    $url   = add_query_arg( [ 'page' => 'social-amplifier', 'tab' => $slug ], admin_url( 'options-general.php' ) );
                    printf(
                        '<a href="%s" class="%s">%s</a>',
                        esc_url( $url ),
                        esc_attr( $class ),
                        esc_html( $label )
                    );
                }
                ?>
            </nav>

            <div class="sa-tab-content">
                <?php
                switch ( $tab ) {
                    case 'organizations':
                        $this->render_organizations_tab();
                        break;
                    case 'credentials':
                        $this->render_credentials_tab();
                        break;
                    default:
                        $this->render_overview_tab();
                        break;
                }
                ?>
            </div>
        </div>
        <?php
    }

    // ── Overview tab ───────────────────────────────────────────────────────

    private function render_overview_tab(): void {
        $orgs = $this->campaigns->list_organizations();
        ?>
        <div class="sa-section">
            <h2><?php esc_html_e( 'Getting Started', 'social-amplifier' ); ?></h2>
            <ol class="sa-steps">
                <li><?php esc_html_e( '1. Add your social platform credentials on the Platform Credentials tab.', 'social-amplifier' ); ?></li>
                <li><?php esc_html_e( '2. Create an Organization (represents your campaign account).', 'social-amplifier' ); ?></li>
                <li><?php esc_html_e( '3. Create a Campaign inside your organization.', 'social-amplifier' ); ?></li>
                <li><?php esc_html_e( '4. Add Content items to the campaign.', 'social-amplifier' ); ?></li>
                <li><?php esc_html_e( '5. Create a Toolkit to bundle content into a shareable widget.', 'social-amplifier' ); ?></li>
                <li><?php printf( esc_html__( '6. Embed the toolkit with the shortcode: %s', 'social-amplifier' ), '<code>[social_amplifier_toolkit id="TOOLKIT_ID"]</code>' ); ?></li>
            </ol>
        </div>

        <div class="sa-section">
            <h2><?php esc_html_e( 'REST API Base URL', 'social-amplifier' ); ?></h2>
            <code><?php echo esc_url( rest_url( SA_REST_NAMESPACE ) ); ?></code>
        </div>

        <?php if ( ! empty( $orgs ) ) : ?>
        <div class="sa-section">
            <h2><?php esc_html_e( 'Organizations', 'social-amplifier' ); ?></h2>
            <table class="widefat striped">
                <thead>
                    <tr>
                        <th><?php esc_html_e( 'Name', 'social-amplifier' ); ?></th>
                        <th><?php esc_html_e( 'Slug', 'social-amplifier' ); ?></th>
                        <th><?php esc_html_e( 'Total Shares', 'social-amplifier' ); ?></th>
                        <th><?php esc_html_e( 'Total Clicks', 'social-amplifier' ); ?></th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ( $orgs as $org ) :
                        $totals = $this->analytics->get_org_totals( $org['id'] );
                    ?>
                    <tr>
                        <td><?php echo esc_html( $org['name'] ); ?></td>
                        <td><code><?php echo esc_html( $org['slug'] ); ?></code></td>
                        <td><?php echo (int) $totals['total_shares']; ?></td>
                        <td><?php echo (int) $totals['total_clicks']; ?></td>
                    </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        </div>
        <?php endif; ?>
        <?php
    }

    // ── Organizations tab ──────────────────────────────────────────────────

    private function render_organizations_tab(): void {
        $orgs = $this->campaigns->list_organizations();
        ?>
        <div class="sa-section">
            <h2><?php esc_html_e( 'Organizations', 'social-amplifier' ); ?></h2>
            <p class="description">
                <?php esc_html_e( 'Organizations represent campaign accounts. Manage campaigns, content, and toolkits via the REST API or the embed shortcode.', 'social-amplifier' ); ?>
            </p>

            <?php if ( ! empty( $orgs ) ) : ?>
            <table class="widefat striped sa-orgs-table">
                <thead>
                    <tr>
                        <th><?php esc_html_e( 'Name', 'social-amplifier' ); ?></th>
                        <th><?php esc_html_e( 'Slug', 'social-amplifier' ); ?></th>
                        <th><?php esc_html_e( 'Campaigns', 'social-amplifier' ); ?></th>
                        <th><?php esc_html_e( 'Created', 'social-amplifier' ); ?></th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ( $orgs as $org ) :
                        $campaigns = $this->campaigns->list_campaigns( $org['id'] );
                    ?>
                    <tr>
                        <td>
                            <strong><?php echo esc_html( $org['name'] ); ?></strong>
                            <?php if ( $org['description'] ) : ?>
                            <div class="sa-org-desc"><?php echo esc_html( $org['description'] ); ?></div>
                            <?php endif; ?>
                        </td>
                        <td><code><?php echo esc_html( $org['slug'] ); ?></code></td>
                        <td><?php echo count( $campaigns ); ?></td>
                        <td><?php echo esc_html( wp_date( get_option( 'date_format' ), strtotime( $org['created_at'] ) ) ); ?></td>
                    </tr>

                    <?php if ( ! empty( $campaigns ) ) : ?>
                    <tr class="sa-campaigns-row">
                        <td colspan="4">
                            <div class="sa-campaigns">
                                <strong><?php esc_html_e( 'Campaigns:', 'social-amplifier' ); ?></strong>
                                <?php foreach ( $campaigns as $campaign ) :
                                    $toolkits = $this->campaigns->list_toolkits( $campaign['id'] );
                                ?>
                                <div class="sa-campaign">
                                    <span class="sa-campaign-name"><?php echo esc_html( $campaign['name'] ); ?></span>
                                    <span class="sa-status sa-status-<?php echo esc_attr( $campaign['status'] ); ?>"><?php echo esc_html( $campaign['status'] ); ?></span>
                                    <?php if ( ! empty( $toolkits ) ) : ?>
                                    <div class="sa-toolkits">
                                        <?php foreach ( $toolkits as $toolkit ) : ?>
                                        <div class="sa-toolkit-item">
                                            <strong><?php echo esc_html( $toolkit['name'] ); ?></strong>
                                            &mdash;
                                            <?php esc_html_e( 'Shortcode:', 'social-amplifier' ); ?>
                                            <code>[social_amplifier_toolkit id="<?php echo esc_attr( $toolkit['id'] ); ?>"]</code>
                                            <button type="button"
                                                    class="button button-small sa-copy-shortcode"
                                                    data-shortcode="[social_amplifier_toolkit id=&quot;<?php echo esc_attr( $toolkit['id'] ); ?>&quot;]">
                                                <?php esc_html_e( 'Copy', 'social-amplifier' ); ?>
                                            </button>
                                        </div>
                                        <?php endforeach; ?>
                                    </div>
                                    <?php endif; ?>
                                </div>
                                <?php endforeach; ?>
                            </div>
                        </td>
                    </tr>
                    <?php endif; ?>

                    <?php endforeach; ?>
                </tbody>
            </table>
            <?php else : ?>
            <p><?php esc_html_e( 'No organizations yet. Use the REST API to create one.', 'social-amplifier' ); ?></p>
            <p><code>POST <?php echo esc_url( rest_url( SA_REST_NAMESPACE . '/organizations' ) ); ?></code></p>
            <?php endif; ?>
        </div>
        <?php
    }

    // ── Platform credentials tab ───────────────────────────────────────────

    private function render_credentials_tab(): void {
        $creds = get_option( 'sa_platform_credentials', [] );
        $platforms_info = [
            'facebook'  => [
                'label'  => 'Facebook',
                'fields' => [
                    'facebook_app_id'     => 'App ID',
                    'facebook_app_secret' => 'App Secret',
                ],
                'docs' => 'https://developers.facebook.com/docs/facebook-login/',
            ],
            'instagram' => [
                'label'  => 'Instagram',
                'fields' => [
                    'instagram_app_id'     => 'App ID (same Meta app as Facebook)',
                    'instagram_app_secret' => 'App Secret',
                ],
                'docs' => 'https://developers.facebook.com/docs/instagram-api/',
            ],
            'x'         => [
                'label'  => 'X (Twitter)',
                'fields' => [
                    'x_client_id'     => 'OAuth 2.0 Client ID',
                    'x_client_secret' => 'Client Secret',
                ],
                'docs' => 'https://developer.x.com/en/docs/authentication/oauth-2-0',
            ],
            'tiktok'    => [
                'label'  => 'TikTok',
                'fields' => [
                    'tiktok_client_key'    => 'Client Key',
                    'tiktok_client_secret' => 'Client Secret',
                ],
                'docs' => 'https://developers.tiktok.com/doc/overview',
            ],
        ];
        ?>
        <div class="sa-section">
            <h2><?php esc_html_e( 'Platform Credentials', 'social-amplifier' ); ?></h2>
            <p class="description">
                <?php esc_html_e( 'Enter your developer app credentials for each social platform you want to enable. App secrets are stored encrypted in the WordPress database.', 'social-amplifier' ); ?>
            </p>

            <form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
                <?php wp_nonce_field( 'sa_save_credentials', 'sa_credentials_nonce' ); ?>
                <input type="hidden" name="action" value="sa_save_credentials">

                <?php foreach ( $platforms_info as $slug => $info ) : ?>
                <h3><?php echo esc_html( $info['label'] ); ?>
                    <a href="<?php echo esc_url( $info['docs'] ); ?>" target="_blank" rel="noopener noreferrer" class="sa-docs-link">
                        <?php esc_html_e( 'Docs ↗', 'social-amplifier' ); ?>
                    </a>
                </h3>

                <table class="form-table" role="presentation">
                    <?php foreach ( $info['fields'] as $field_key => $field_label ) : ?>
                    <tr>
                        <th scope="row">
                            <label for="sa_<?php echo esc_attr( $field_key ); ?>"><?php echo esc_html( $field_label ); ?></label>
                        </th>
                        <td>
                            <input type="<?php echo str_contains( $field_key, 'secret' ) ? 'password' : 'text'; ?>"
                                   id="sa_<?php echo esc_attr( $field_key ); ?>"
                                   name="sa_credentials[<?php echo esc_attr( $field_key ); ?>]"
                                   value="<?php echo esc_attr( $creds[ $field_key ] ?? '' ); ?>"
                                   class="regular-text"
                                   autocomplete="off">
                        </td>
                    </tr>
                    <?php endforeach; ?>
                    <tr>
                        <th><?php esc_html_e( 'OAuth Callback URL', 'social-amplifier' ); ?></th>
                        <td>
                            <code><?php echo esc_url( rest_url( SA_REST_NAMESPACE . '/auth/' . $slug . '/callback' ) ); ?></code>
                            <p class="description"><?php esc_html_e( 'Add this as an allowed redirect URI in your app settings.', 'social-amplifier' ); ?></p>
                        </td>
                    </tr>
                </table>
                <?php endforeach; ?>

                <?php submit_button( __( 'Save Credentials', 'social-amplifier' ) ); ?>
            </form>
        </div>
        <?php
    }

    // ── Form handlers ──────────────────────────────────────────────────────

    public function handle_save_credentials(): void {
        if ( ! current_user_can( 'manage_options' ) ) {
            wp_die( esc_html__( 'Permission denied.', 'social-amplifier' ) );
        }

        check_admin_referer( 'sa_save_credentials', 'sa_credentials_nonce' );

        $raw = $_POST['sa_credentials'] ?? []; // phpcs:ignore WordPress.Security.NonceVerification
        $clean = [];

        $allowed_keys = [
            'facebook_app_id', 'facebook_app_secret',
            'instagram_app_id', 'instagram_app_secret',
            'x_client_id', 'x_client_secret',
            'tiktok_client_key', 'tiktok_client_secret',
        ];

        foreach ( $allowed_keys as $key ) {
            if ( isset( $raw[ $key ] ) ) {
                $clean[ $key ] = sanitize_text_field( $raw[ $key ] );
            }
        }

        update_option( 'sa_platform_credentials', $clean, false );

        wp_safe_redirect( add_query_arg( [
            'page'    => 'social-amplifier',
            'tab'     => 'credentials',
            'updated' => '1',
        ], admin_url( 'options-general.php' ) ) );
        exit;
    }

    // ── Admin notices ──────────────────────────────────────────────────────

    public function maybe_show_notices(): void {
        $screen = get_current_screen();
        if ( ! $screen || 'settings_page_social-amplifier' !== $screen->id ) return;

        if ( ! empty( $_GET['updated'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification
            echo '<div class="notice notice-success is-dismissible"><p>'
                . esc_html__( 'Credentials saved.', 'social-amplifier' )
                . '</p></div>';
        }

        if ( ! empty( $_GET['connected'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification
            $platform = sanitize_key( $_GET['connected'] );
            echo '<div class="notice notice-success is-dismissible"><p>'
                . sprintf(
                    /* translators: %s: platform name */
                    esc_html__( 'Connected to %s successfully.', 'social-amplifier' ),
                    esc_html( ucfirst( $platform ) )
                )
                . '</p></div>';
        }
    }
}
