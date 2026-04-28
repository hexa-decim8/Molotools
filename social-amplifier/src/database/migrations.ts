import type Database from 'better-sqlite3';

/**
 * Run all migrations against the database.
 * Migrations are idempotent — safe to run multiple times.
 */
export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const applied = new Set(
    db.prepare('SELECT name FROM migrations').all().map((r: any) => r.name)
  );

  for (const migration of migrations) {
    if (applied.has(migration.name)) continue;
    db.transaction(() => {
      db.exec(migration.sql);
      db.prepare('INSERT INTO migrations (name) VALUES (?)').run(migration.name);
    })();
    console.log(`  ✓ Applied migration: ${migration.name}`);
  }
}

const migrations = [
  {
    name: '001_initial_schema',
    sql: `
      -- Organizations / campaign accounts
      CREATE TABLE organizations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        description TEXT,
        logo_url TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      -- Users (campaign staff)
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        email TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      -- Campaigns (a themed push — e.g. "GOTV October", "Fundraising Q4")
      CREATE TABLE campaigns (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        slug TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'ended')),
        starts_at TEXT,
        ends_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(org_id, slug)
      );

      -- Content items within a campaign
      CREATE TABLE content (
        id TEXT PRIMARY KEY,
        campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
        type TEXT NOT NULL DEFAULT 'text' CHECK (type IN ('text', 'image', 'video', 'link')),
        title TEXT NOT NULL,
        body TEXT,
        media_url TEXT,
        link_url TEXT,
        link_preview_title TEXT,
        link_preview_description TEXT,
        link_preview_image TEXT,
        platform_variants TEXT, -- JSON: per-platform copy overrides
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      -- Share toolkits (embeddable bundles of content for supporters)
      CREATE TABLE toolkits (
        id TEXT PRIMARY KEY,
        campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        slug TEXT NOT NULL,
        description TEXT,
        theme_color TEXT DEFAULT '#1a73e8',
        header_text TEXT,
        cta_text TEXT DEFAULT 'Share Now',
        platforms TEXT NOT NULL DEFAULT '["facebook","instagram","x","tiktok"]', -- JSON array
        is_active INTEGER NOT NULL DEFAULT 1,
        embed_code TEXT, -- generated embed snippet
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(campaign_id, slug)
      );

      -- Junction: which content items appear in which toolkits
      CREATE TABLE toolkit_content (
        toolkit_id TEXT NOT NULL REFERENCES toolkits(id) ON DELETE CASCADE,
        content_id TEXT NOT NULL REFERENCES content(id) ON DELETE CASCADE,
        sort_order INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (toolkit_id, content_id)
      );

      -- Supporters (people who share content)
      CREATE TABLE supporters (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        email TEXT,
        name TEXT,
        external_id TEXT, -- for CRM integrations
        first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
        last_active_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      -- Connected social accounts for supporters
      CREATE TABLE supporter_accounts (
        id TEXT PRIMARY KEY,
        supporter_id TEXT NOT NULL REFERENCES supporters(id) ON DELETE CASCADE,
        platform TEXT NOT NULL CHECK (platform IN ('facebook', 'instagram', 'x', 'tiktok')),
        platform_user_id TEXT,
        access_token TEXT,
        refresh_token TEXT,
        token_expires_at TEXT,
        username TEXT,
        follower_count INTEGER,
        connected_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      -- Share events (when a supporter shares content)
      CREATE TABLE share_events (
        id TEXT PRIMARY KEY,
        toolkit_id TEXT NOT NULL REFERENCES toolkits(id) ON DELETE CASCADE,
        content_id TEXT NOT NULL REFERENCES content(id) ON DELETE CASCADE,
        supporter_id TEXT REFERENCES supporters(id),
        platform TEXT NOT NULL CHECK (platform IN ('facebook', 'instagram', 'x', 'tiktok')),
        share_method TEXT NOT NULL DEFAULT 'direct' CHECK (share_method IN ('direct', 'copy', 'native')),
        platform_post_id TEXT, -- ID of the resulting post on the platform
        shared_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      -- Click/engagement tracking
      CREATE TABLE click_events (
        id TEXT PRIMARY KEY,
        share_event_id TEXT REFERENCES share_events(id),
        toolkit_id TEXT NOT NULL REFERENCES toolkits(id) ON DELETE CASCADE,
        content_id TEXT REFERENCES content(id),
        referrer TEXT,
        user_agent TEXT,
        ip_hash TEXT, -- hashed for privacy
        country TEXT,
        region TEXT,
        clicked_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      -- Aggregated analytics (materialized daily)
      CREATE TABLE analytics_daily (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        campaign_id TEXT REFERENCES campaigns(id) ON DELETE CASCADE,
        toolkit_id TEXT REFERENCES toolkits(id) ON DELETE CASCADE,
        platform TEXT,
        shares INTEGER NOT NULL DEFAULT 0,
        clicks INTEGER NOT NULL DEFAULT 0,
        impressions INTEGER NOT NULL DEFAULT 0,
        unique_sharers INTEGER NOT NULL DEFAULT 0,
        UNIQUE(date, org_id, campaign_id, toolkit_id, platform)
      );

      -- Indexes for common queries
      CREATE INDEX idx_campaigns_org ON campaigns(org_id);
      CREATE INDEX idx_content_campaign ON content(campaign_id);
      CREATE INDEX idx_toolkits_campaign ON toolkits(campaign_id);
      CREATE INDEX idx_share_events_toolkit ON share_events(toolkit_id);
      CREATE INDEX idx_share_events_platform ON share_events(platform);
      CREATE INDEX idx_share_events_shared_at ON share_events(shared_at);
      CREATE INDEX idx_click_events_toolkit ON click_events(toolkit_id);
      CREATE INDEX idx_click_events_clicked_at ON click_events(clicked_at);
      CREATE INDEX idx_analytics_daily_date ON analytics_daily(date);
      CREATE INDEX idx_supporters_org ON supporters(org_id);
    `,
  },
];
