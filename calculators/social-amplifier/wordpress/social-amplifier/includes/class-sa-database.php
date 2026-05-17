<?php

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/**
 * Manages custom database tables and migrations.
 * All tables mirror the SQLite schema from the Node.js Social Amplifier.
 */
class SA_Database {

    const SCHEMA_VERSION        = 1;
    const SCHEMA_VERSION_OPTION = 'sa_schema_version';

    public function __construct() {
        // Migrations also run on activation, but this guard handles updates.
        add_action( 'plugins_loaded', [ $this, 'maybe_run_migrations' ] );
    }

    // ── Table name helpers ─────────────────────────────────────────────────

    public function organizations_table(): string   { global $wpdb; return $wpdb->prefix . 'sa_organizations'; }
    public function campaigns_table(): string        { global $wpdb; return $wpdb->prefix . 'sa_campaigns'; }
    public function content_table(): string          { global $wpdb; return $wpdb->prefix . 'sa_content'; }
    public function toolkits_table(): string         { global $wpdb; return $wpdb->prefix . 'sa_toolkits'; }
    public function toolkit_content_table(): string  { global $wpdb; return $wpdb->prefix . 'sa_toolkit_content'; }
    public function supporters_table(): string       { global $wpdb; return $wpdb->prefix . 'sa_supporters'; }
    public function supporter_accounts_table(): string { global $wpdb; return $wpdb->prefix . 'sa_supporter_accounts'; }
    public function share_events_table(): string     { global $wpdb; return $wpdb->prefix . 'sa_share_events'; }
    public function click_events_table(): string     { global $wpdb; return $wpdb->prefix . 'sa_click_events'; }
    public function analytics_daily_table(): string  { global $wpdb; return $wpdb->prefix . 'sa_analytics_daily'; }

    // ── Migration runner ───────────────────────────────────────────────────

    public function maybe_run_migrations(): void {
        $current = (int) get_option( self::SCHEMA_VERSION_OPTION, 0 );
        if ( $current >= self::SCHEMA_VERSION ) {
            return;
        }

        if ( $current < 1 ) {
            $this->migration_001_initial_schema();
        }

        update_option( self::SCHEMA_VERSION_OPTION, self::SCHEMA_VERSION, false );
    }

    // ── Migration 001: initial schema ─────────────────────────────────────

    private function migration_001_initial_schema(): void {
        global $wpdb;
        require_once ABSPATH . 'wp-admin/includes/upgrade.php';

        $charset = $wpdb->get_charset_collate();

        // Organizations / campaign accounts.
        dbDelta( "CREATE TABLE {$this->organizations_table()} (
            id          VARCHAR(40)  NOT NULL,
            name        VARCHAR(200) NOT NULL,
            slug        VARCHAR(100) NOT NULL,
            description TEXT         DEFAULT NULL,
            logo_url    TEXT         DEFAULT NULL,
            created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY slug (slug)
        ) $charset;" );

        // Campaigns.
        dbDelta( "CREATE TABLE {$this->campaigns_table()} (
            id          VARCHAR(40)  NOT NULL,
            org_id      VARCHAR(40)  NOT NULL,
            name        VARCHAR(200) NOT NULL,
            slug        VARCHAR(100) NOT NULL,
            description TEXT         DEFAULT NULL,
            status      ENUM('draft','active','paused','ended') NOT NULL DEFAULT 'draft',
            starts_at   DATETIME     DEFAULT NULL,
            ends_at     DATETIME     DEFAULT NULL,
            created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY org_slug (org_id, slug),
            KEY org_id (org_id)
        ) $charset;" );

        // Content items.
        dbDelta( "CREATE TABLE {$this->content_table()} (
            id                     VARCHAR(40)  NOT NULL,
            campaign_id            VARCHAR(40)  NOT NULL,
            type                   ENUM('text','image','video','link') NOT NULL DEFAULT 'text',
            title                  VARCHAR(300) NOT NULL,
            body                   TEXT         DEFAULT NULL,
            media_url              TEXT         DEFAULT NULL,
            link_url               TEXT         DEFAULT NULL,
            link_preview_title     VARCHAR(300) DEFAULT NULL,
            link_preview_desc      TEXT         DEFAULT NULL,
            link_preview_image     TEXT         DEFAULT NULL,
            platform_variants      LONGTEXT     DEFAULT NULL COMMENT 'JSON: per-platform copy overrides',
            sort_order             INT          NOT NULL DEFAULT 0,
            created_at             DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at             DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY campaign_id (campaign_id)
        ) $charset;" );

        // Share toolkits.
        dbDelta( "CREATE TABLE {$this->toolkits_table()} (
            id          VARCHAR(40)  NOT NULL,
            campaign_id VARCHAR(40)  NOT NULL,
            name        VARCHAR(200) NOT NULL,
            slug        VARCHAR(100) NOT NULL,
            description TEXT         DEFAULT NULL,
            theme_color VARCHAR(7)   NOT NULL DEFAULT '#1a73e8',
            header_text TEXT         DEFAULT NULL,
            cta_text    VARCHAR(100) NOT NULL DEFAULT 'Share Now',
            platforms   TEXT         NOT NULL DEFAULT '[\"facebook\",\"instagram\",\"x\",\"tiktok\"]' COMMENT 'JSON array',
            is_active   TINYINT(1)   NOT NULL DEFAULT 1,
            embed_code  TEXT         DEFAULT NULL,
            created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY campaign_slug (campaign_id, slug),
            KEY campaign_id (campaign_id)
        ) $charset;" );

        // Junction: toolkit → content.
        dbDelta( "CREATE TABLE {$this->toolkit_content_table()} (
            toolkit_id  VARCHAR(40) NOT NULL,
            content_id  VARCHAR(40) NOT NULL,
            sort_order  INT         NOT NULL DEFAULT 0,
            PRIMARY KEY (toolkit_id, content_id)
        ) $charset;" );

        // Supporters (people who share content).
        dbDelta( "CREATE TABLE {$this->supporters_table()} (
            id            VARCHAR(40)  NOT NULL,
            org_id        VARCHAR(40)  NOT NULL,
            email         VARCHAR(254) DEFAULT NULL,
            name          VARCHAR(200) DEFAULT NULL,
            external_id   VARCHAR(200) DEFAULT NULL COMMENT 'CRM integration ID',
            first_seen_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
            last_active_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY org_id (org_id)
        ) $charset;" );

        // Connected social accounts (tokens encrypted at rest).
        dbDelta( "CREATE TABLE {$this->supporter_accounts_table()} (
            id                VARCHAR(40) NOT NULL,
            supporter_id      VARCHAR(40) NOT NULL,
            platform          ENUM('facebook','instagram','x','tiktok') NOT NULL,
            platform_user_id  VARCHAR(200) DEFAULT NULL,
            access_token      TEXT         DEFAULT NULL COMMENT 'AES-256-CBC encrypted',
            refresh_token     TEXT         DEFAULT NULL COMMENT 'AES-256-CBC encrypted',
            token_expires_at  DATETIME     DEFAULT NULL,
            username          VARCHAR(200) DEFAULT NULL,
            follower_count    INT          DEFAULT NULL,
            connected_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY supporter_id (supporter_id),
            KEY platform (platform)
        ) $charset;" );

        // Share events.
        dbDelta( "CREATE TABLE {$this->share_events_table()} (
            id               VARCHAR(40) NOT NULL,
            toolkit_id       VARCHAR(40) NOT NULL,
            content_id       VARCHAR(40) NOT NULL,
            supporter_id     VARCHAR(40) DEFAULT NULL,
            platform         ENUM('facebook','instagram','x','tiktok') NOT NULL,
            share_method     ENUM('direct','copy','native') NOT NULL DEFAULT 'direct',
            platform_post_id VARCHAR(200) DEFAULT NULL,
            shared_at        DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY toolkit_id (toolkit_id),
            KEY platform (platform),
            KEY shared_at (shared_at)
        ) $charset;" );

        // Click/engagement tracking.
        dbDelta( "CREATE TABLE {$this->click_events_table()} (
            id             VARCHAR(40)  NOT NULL,
            share_event_id VARCHAR(40)  DEFAULT NULL,
            toolkit_id     VARCHAR(40)  NOT NULL,
            content_id     VARCHAR(40)  DEFAULT NULL,
            referrer       TEXT         DEFAULT NULL,
            user_agent     TEXT         DEFAULT NULL,
            ip_hash        VARCHAR(16)  DEFAULT NULL COMMENT 'SHA-256 truncated, never raw IP',
            country        VARCHAR(2)   DEFAULT NULL,
            region         VARCHAR(100) DEFAULT NULL,
            clicked_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY toolkit_id (toolkit_id),
            KEY clicked_at (clicked_at)
        ) $charset;" );

        // Aggregated daily analytics.
        dbDelta( "CREATE TABLE {$this->analytics_daily_table()} (
            id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            date           DATE        NOT NULL,
            org_id         VARCHAR(40) NOT NULL,
            campaign_id    VARCHAR(40) DEFAULT NULL,
            toolkit_id     VARCHAR(40) DEFAULT NULL,
            platform       VARCHAR(20) DEFAULT NULL,
            shares         INT         NOT NULL DEFAULT 0,
            clicks         INT         NOT NULL DEFAULT 0,
            impressions    INT         NOT NULL DEFAULT 0,
            unique_sharers INT         NOT NULL DEFAULT 0,
            PRIMARY KEY (id),
            UNIQUE KEY daily_summary (date, org_id, campaign_id, toolkit_id, platform),
            KEY date (date)
        ) $charset;" );
    }

    // ── Drop all tables (called from uninstall.php) ────────────────────────

    public static function drop_all_tables(): void {
        global $wpdb;
        $prefix = $wpdb->prefix . 'sa_';
        $tables = [
            'sa_analytics_daily',
            'sa_click_events',
            'sa_share_events',
            'sa_supporter_accounts',
            'sa_supporters',
            'sa_toolkit_content',
            'sa_toolkits',
            'sa_content',
            'sa_campaigns',
            'sa_organizations',
        ];
        foreach ( $tables as $table ) {
            $wpdb->query( "DROP TABLE IF EXISTS {$wpdb->prefix}{$table}" ); // phpcs:ignore WordPress.DB.PreparedSQL
        }
        delete_option( self::SCHEMA_VERSION_OPTION );
    }
}
