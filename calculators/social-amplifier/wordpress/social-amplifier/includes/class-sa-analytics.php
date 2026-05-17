<?php

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/**
 * Records share/click events and aggregates daily analytics.
 */
class SA_Analytics {

    private SA_Database $db;

    public function __construct( SA_Database $db ) {
        $this->db = $db;
    }

    // ── Share events ───────────────────────────────────────────────────────

    public function record_share( array $data ): string {
        global $wpdb;

        $id  = Social_Amplifier::generate_id();
        $now = current_time( 'mysql', true );

        $wpdb->insert(
            $this->db->share_events_table(),
            [
                'id'               => $id,
                'toolkit_id'       => sanitize_text_field( $data['toolkit_id'] ),
                'content_id'       => sanitize_text_field( $data['content_id'] ),
                'supporter_id'     => isset( $data['supporter_id'] ) ? sanitize_text_field( $data['supporter_id'] ) : null,
                'platform'         => sanitize_key( $data['platform'] ),
                'share_method'     => sanitize_key( $data['share_method'] ?? 'native' ),
                'platform_post_id' => isset( $data['platform_post_id'] ) ? sanitize_text_field( $data['platform_post_id'] ) : null,
                'shared_at'        => $now,
            ]
        );

        // Bump aggregated daily counter.
        $this->increment_daily(
            gmdate( 'Y-m-d' ),
            $data['org_id']      ?? '',
            $data['campaign_id'] ?? '',
            $data['toolkit_id'],
            $data['platform'],
            'shares'
        );

        return $id;
    }

    // ── Click events ───────────────────────────────────────────────────────

    public function record_click( array $data ): string {
        global $wpdb;

        $id  = Social_Amplifier::generate_id();
        $now = current_time( 'mysql', true );

        // Hash the IP immediately — never store raw.
        $ip_hash = isset( $data['ip'] )
            ? Social_Amplifier::hash_ip( $data['ip'] )
            : null;

        $wpdb->insert(
            $this->db->click_events_table(),
            [
                'id'             => $id,
                'share_event_id' => isset( $data['share_event_id'] ) ? sanitize_text_field( $data['share_event_id'] ) : null,
                'toolkit_id'     => sanitize_text_field( $data['toolkit_id'] ),
                'content_id'     => isset( $data['content_id'] ) ? sanitize_text_field( $data['content_id'] ) : null,
                'referrer'       => isset( $data['referrer'] ) ? esc_url_raw( $data['referrer'] ) : null,
                'user_agent'     => isset( $data['user_agent'] ) ? sanitize_text_field( substr( $data['user_agent'], 0, 512 ) ) : null,
                'ip_hash'        => $ip_hash,
                'clicked_at'     => $now,
            ]
        );

        $this->increment_daily(
            gmdate( 'Y-m-d' ),
            $data['org_id']      ?? '',
            $data['campaign_id'] ?? '',
            $data['toolkit_id'],
            null,
            'clicks'
        );

        return $id;
    }

    // ── Daily aggregation ──────────────────────────────────────────────────

    private function increment_daily(
        string $date,
        string $org_id,
        string $campaign_id,
        string $toolkit_id,
        ?string $platform,
        string $column
    ): void {
        global $wpdb;
        $table   = $this->db->analytics_daily_table();
        $allowed = [ 'shares', 'clicks', 'impressions', 'unique_sharers' ];

        if ( ! in_array( $column, $allowed, true ) ) return;

        // phpcs:disable WordPress.DB.PreparedSQL
        $wpdb->query(
            $wpdb->prepare(
                "INSERT INTO {$table}
                    (date, org_id, campaign_id, toolkit_id, platform, {$column})
                 VALUES (%s, %s, %s, %s, %s, 1)
                 ON DUPLICATE KEY UPDATE {$column} = {$column} + 1",
                $date,
                $org_id,
                $campaign_id ?: null,
                $toolkit_id  ?: null,
                $platform
            )
        );
        // phpcs:enable
    }

    // ── Query helpers ──────────────────────────────────────────────────────

    public function get_toolkit_summary( string $toolkit_id, string $period = '30' ): array {
        global $wpdb;
        $table = $this->db->analytics_daily_table();

        $rows = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT date, platform, SUM(shares) AS shares, SUM(clicks) AS clicks
                 FROM {$table}
                 WHERE toolkit_id = %s
                   AND date >= DATE_SUB(CURDATE(), INTERVAL %d DAY)
                 GROUP BY date, platform
                 ORDER BY date DESC",
                $toolkit_id,
                (int) $period
            ),
            ARRAY_A
        ) ?: [];

        return $rows;
    }

    public function get_campaign_summary( string $campaign_id, string $period = '30' ): array {
        global $wpdb;
        $table = $this->db->analytics_daily_table();

        return $wpdb->get_results(
            $wpdb->prepare(
                "SELECT date, platform, SUM(shares) AS shares, SUM(clicks) AS clicks
                 FROM {$table}
                 WHERE campaign_id = %s
                   AND date >= DATE_SUB(CURDATE(), INTERVAL %d DAY)
                 GROUP BY date, platform
                 ORDER BY date DESC",
                $campaign_id,
                (int) $period
            ),
            ARRAY_A
        ) ?: [];
    }

    public function get_org_totals( string $org_id ): array {
        global $wpdb;
        $table = $this->db->analytics_daily_table();

        $row = $wpdb->get_row(
            $wpdb->prepare(
                "SELECT SUM(shares) AS total_shares, SUM(clicks) AS total_clicks
                 FROM {$table}
                 WHERE org_id = %s",
                $org_id
            ),
            ARRAY_A
        );

        return $row ?: [ 'total_shares' => 0, 'total_clicks' => 0 ];
    }
}
