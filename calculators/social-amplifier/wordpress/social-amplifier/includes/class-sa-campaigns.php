<?php

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/**
 * CRUD operations for organizations, campaigns, content, and toolkits.
 */
class SA_Campaigns {

    private SA_Database $db;

    public function __construct( SA_Database $db ) {
        $this->db = $db;
    }

    // ── Organizations ──────────────────────────────────────────────────────

    public function create_organization( array $data ): array {
        global $wpdb;
        $id  = Social_Amplifier::generate_id();
        $now = current_time( 'mysql', true );

        $wpdb->insert(
            $this->db->organizations_table(),
            [
                'id'          => $id,
                'name'        => sanitize_text_field( $data['name'] ),
                'slug'        => sanitize_title( $data['slug'] ),
                'description' => isset( $data['description'] ) ? sanitize_textarea_field( $data['description'] ) : null,
                'logo_url'    => isset( $data['logo_url'] ) ? esc_url_raw( $data['logo_url'] ) : null,
                'created_at'  => $now,
                'updated_at'  => $now,
            ]
        );

        return $this->get_organization( $id );
    }

    public function get_organization( string $id ): ?array {
        global $wpdb;
        $row = $wpdb->get_row(
            $wpdb->prepare( "SELECT * FROM {$this->db->organizations_table()} WHERE id = %s", $id ),
            ARRAY_A
        );
        return $row ?: null;
    }

    public function get_organization_by_slug( string $slug ): ?array {
        global $wpdb;
        $row = $wpdb->get_row(
            $wpdb->prepare( "SELECT * FROM {$this->db->organizations_table()} WHERE slug = %s", $slug ),
            ARRAY_A
        );
        return $row ?: null;
    }

    public function list_organizations(): array {
        global $wpdb;
        return $wpdb->get_results(
            "SELECT * FROM {$this->db->organizations_table()} ORDER BY created_at DESC",
            ARRAY_A
        ) ?: [];
    }

    // ── Campaigns ──────────────────────────────────────────────────────────

    public function create_campaign( array $data ): array {
        global $wpdb;
        $id  = Social_Amplifier::generate_id();
        $now = current_time( 'mysql', true );

        $wpdb->insert(
            $this->db->campaigns_table(),
            [
                'id'          => $id,
                'org_id'      => $data['org_id'],
                'name'        => sanitize_text_field( $data['name'] ),
                'slug'        => sanitize_title( $data['slug'] ),
                'description' => isset( $data['description'] ) ? sanitize_textarea_field( $data['description'] ) : null,
                'status'      => $data['status'] ?? 'draft',
                'starts_at'   => $data['starts_at'] ?? null,
                'ends_at'     => $data['ends_at'] ?? null,
                'created_at'  => $now,
                'updated_at'  => $now,
            ]
        );

        return $this->get_campaign( $id );
    }

    public function get_campaign( string $id ): ?array {
        global $wpdb;
        $row = $wpdb->get_row(
            $wpdb->prepare( "SELECT * FROM {$this->db->campaigns_table()} WHERE id = %s", $id ),
            ARRAY_A
        );
        return $row ?: null;
    }

    public function list_campaigns( string $org_id ): array {
        global $wpdb;
        return $wpdb->get_results(
            $wpdb->prepare(
                "SELECT * FROM {$this->db->campaigns_table()} WHERE org_id = %s ORDER BY created_at DESC",
                $org_id
            ),
            ARRAY_A
        ) ?: [];
    }

    public function update_campaign_status( string $id, string $status ): bool {
        global $wpdb;
        return (bool) $wpdb->update(
            $this->db->campaigns_table(),
            [ 'status' => $status, 'updated_at' => current_time( 'mysql', true ) ],
            [ 'id'     => $id ]
        );
    }

    // ── Content ────────────────────────────────────────────────────────────

    public function create_content( array $data ): array {
        global $wpdb;
        $id  = Social_Amplifier::generate_id();
        $now = current_time( 'mysql', true );

        $wpdb->insert(
            $this->db->content_table(),
            [
                'id'               => $id,
                'campaign_id'      => $data['campaign_id'],
                'type'             => $data['type'] ?? 'text',
                'title'            => sanitize_text_field( $data['title'] ),
                'body'             => isset( $data['body'] ) ? sanitize_textarea_field( $data['body'] ) : null,
                'media_url'        => isset( $data['media_url'] ) ? esc_url_raw( $data['media_url'] ) : null,
                'link_url'         => isset( $data['link_url'] ) ? esc_url_raw( $data['link_url'] ) : null,
                'platform_variants' => isset( $data['platform_variants'] ) ? wp_json_encode( $data['platform_variants'] ) : null,
                'sort_order'       => (int) ( $data['sort_order'] ?? 0 ),
                'created_at'       => $now,
                'updated_at'       => $now,
            ]
        );

        return $this->get_content( $id );
    }

    public function get_content( string $id ): ?array {
        global $wpdb;
        $row = $wpdb->get_row(
            $wpdb->prepare( "SELECT * FROM {$this->db->content_table()} WHERE id = %s", $id ),
            ARRAY_A
        );
        if ( $row && $row['platform_variants'] ) {
            $row['platform_variants'] = json_decode( $row['platform_variants'], true );
        }
        return $row ?: null;
    }

    public function list_content( string $campaign_id ): array {
        global $wpdb;
        $rows = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT * FROM {$this->db->content_table()} WHERE campaign_id = %s ORDER BY sort_order ASC, created_at ASC",
                $campaign_id
            ),
            ARRAY_A
        ) ?: [];
        foreach ( $rows as &$row ) {
            if ( $row['platform_variants'] ) {
                $row['platform_variants'] = json_decode( $row['platform_variants'], true );
            }
        }
        return $rows;
    }

    public function update_content( string $id, array $data ): bool {
        global $wpdb;
        $fields = [ 'updated_at' => current_time( 'mysql', true ) ];
        $allowed = [ 'title', 'body', 'media_url', 'link_url', 'sort_order', 'platform_variants', 'type' ];

        foreach ( $allowed as $key ) {
            if ( ! array_key_exists( $key, $data ) ) continue;
            if ( $key === 'platform_variants' ) {
                $fields[ $key ] = wp_json_encode( $data[ $key ] );
            } elseif ( in_array( $key, [ 'media_url', 'link_url' ], true ) ) {
                $fields[ $key ] = $data[ $key ] ? esc_url_raw( $data[ $key ] ) : null;
            } else {
                $fields[ $key ] = $data[ $key ];
            }
        }

        return (bool) $wpdb->update( $this->db->content_table(), $fields, [ 'id' => $id ] );
    }

    public function delete_content( string $id ): bool {
        global $wpdb;
        return (bool) $wpdb->delete( $this->db->content_table(), [ 'id' => $id ] );
    }

    // ── Toolkits ───────────────────────────────────────────────────────────

    public function create_toolkit( array $data ): array {
        global $wpdb;
        $id  = Social_Amplifier::generate_id();
        $now = current_time( 'mysql', true );

        $platforms   = $data['platforms'] ?? [ 'facebook', 'instagram', 'x', 'tiktok' ];
        $embed_code  = $this->generate_embed_code( $id );

        $wpdb->insert(
            $this->db->toolkits_table(),
            [
                'id'          => $id,
                'campaign_id' => $data['campaign_id'],
                'name'        => sanitize_text_field( $data['name'] ),
                'slug'        => sanitize_title( $data['slug'] ),
                'description' => isset( $data['description'] ) ? sanitize_textarea_field( $data['description'] ) : null,
                'theme_color' => preg_match( '/^#[0-9a-fA-F]{6}$/', $data['theme_color'] ?? '' )
                    ? $data['theme_color'] : '#1a73e8',
                'header_text' => isset( $data['header_text'] ) ? sanitize_text_field( $data['header_text'] ) : null,
                'cta_text'    => sanitize_text_field( $data['cta_text'] ?? 'Share Now' ),
                'platforms'   => wp_json_encode( $platforms ),
                'is_active'   => 1,
                'embed_code'  => $embed_code,
                'created_at'  => $now,
                'updated_at'  => $now,
            ]
        );

        // Associate content items if provided.
        if ( ! empty( $data['content_ids'] ) ) {
            foreach ( array_values( $data['content_ids'] ) as $order => $content_id ) {
                $wpdb->insert(
                    $this->db->toolkit_content_table(),
                    [
                        'toolkit_id' => $id,
                        'content_id' => $content_id,
                        'sort_order' => $order,
                    ]
                );
            }
        }

        return $this->get_toolkit( $id );
    }

    public function get_toolkit( string $id ): ?array {
        global $wpdb;
        $row = $wpdb->get_row(
            $wpdb->prepare( "SELECT * FROM {$this->db->toolkits_table()} WHERE id = %s", $id ),
            ARRAY_A
        );
        if ( ! $row ) return null;
        $row['platforms'] = json_decode( $row['platforms'], true );
        return $row;
    }

    public function list_toolkits( string $campaign_id ): array {
        global $wpdb;
        $rows = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT * FROM {$this->db->toolkits_table()} WHERE campaign_id = %s ORDER BY created_at DESC",
                $campaign_id
            ),
            ARRAY_A
        ) ?: [];
        foreach ( $rows as &$row ) {
            $row['platforms'] = json_decode( $row['platforms'], true );
        }
        return $rows;
    }

    /**
     * Return a toolkit with its associated content and precomputed share URLs.
     * This is the payload consumed by the embed widget.
     */
    public function get_toolkit_for_embed( string $toolkit_id ): ?array {
        global $wpdb;

        $toolkit = $this->get_toolkit( $toolkit_id );
        if ( ! $toolkit || ! $toolkit['is_active'] ) {
            return null;
        }

        // Fetch associated content ordered by sort_order.
        $content_rows = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT c.* FROM {$this->db->content_table()} c
                 INNER JOIN {$this->db->toolkit_content_table()} tc ON tc.content_id = c.id
                 WHERE tc.toolkit_id = %s
                 ORDER BY tc.sort_order ASC, c.sort_order ASC",
                $toolkit_id
            ),
            ARRAY_A
        ) ?: [];

        // Build share URLs per content item per platform.
        foreach ( $content_rows as &$item ) {
            if ( $item['platform_variants'] ) {
                $item['platform_variants'] = json_decode( $item['platform_variants'], true );
            }
            $item['share_urls'] = [];
            foreach ( $toolkit['platforms'] as $platform ) {
                $item['share_urls'][ $platform ] = $this->get_platform_share_url(
                    $platform,
                    $item,
                    $toolkit
                );
            }
        }

        $toolkit['content'] = $content_rows;
        return $toolkit;
    }

    /**
     * Build a native web share URL for a given platform and content item.
     * Respects per-platform copy variants.
     */
    private function get_platform_share_url( string $platform, array $item, array $toolkit ): string {
        $variants = $item['platform_variants'] ?? [];
        $body     = $variants[ $platform ]['body'] ?? $item['body'] ?? $item['title'];
        $url      = $item['link_url'] ?? '';

        switch ( $platform ) {
            case 'facebook':
                $params = [];
                if ( $url )  $params['u']     = $url;
                if ( $body ) $params['quote']  = $body;
                return 'https://www.facebook.com/sharer/sharer.php?' . http_build_query( $params );
            case 'x':
                $full = $url ? "{$body} {$url}" : $body;
                return 'https://twitter.com/intent/tweet?text=' . rawurlencode( $full );
            case 'tiktok':
                return $url
                    ? 'https://www.tiktok.com/share?url=' . rawurlencode( $url ) . '&text=' . rawurlencode( $body )
                    : '';
            case 'instagram':
                // No web share dialog for Instagram — widget copies text.
                return '';
            default:
                return '';
        }
    }

    /**
     * Generate the HTML embed snippet for a toolkit.
     */
    public function generate_embed_code( string $toolkit_id ): string {
        $api_base  = rest_url( SA_REST_NAMESPACE );
        $asset_url = SA_PLUGIN_URL . 'assets/js/toolkit.js';
        return sprintf(
            '<div id="sa-toolkit-%1$s"></div>' . "\n" .
            '<script src="%2$s" data-toolkit-id="%1$s" data-api="%3$s" async></script>',
            esc_attr( $toolkit_id ),
            esc_url( $asset_url ),
            esc_url( $api_base )
        );
    }
}
