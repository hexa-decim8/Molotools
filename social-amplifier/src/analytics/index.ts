import type Database from 'better-sqlite3';
import { nanoid } from 'nanoid';
import { createHash } from 'crypto';
import type { PlatformName } from '../platforms/index.js';

// ── Types ────────────────────────────────────────────────────────────

export interface ShareEvent {
  id: string;
  toolkit_id: string;
  content_id: string;
  supporter_id?: string;
  platform: PlatformName;
  share_method: 'direct' | 'copy' | 'native';
  platform_post_id?: string;
  shared_at: string;
}

export interface ClickEvent {
  id: string;
  share_event_id?: string;
  toolkit_id: string;
  content_id?: string;
  referrer?: string;
  user_agent?: string;
  ip_hash?: string;
  country?: string;
  region?: string;
  clicked_at: string;
}

export interface AnalyticsSummary {
  total_shares: number;
  total_clicks: number;
  unique_sharers: number;
  by_platform: Record<string, { shares: number; clicks: number }>;
  by_day: Array<{ date: string; shares: number; clicks: number }>;
  top_content: Array<{ content_id: string; title: string; shares: number; clicks: number }>;
}

// ── Analytics Engine ─────────────────────────────────────────────────

export class AnalyticsEngine {
  constructor(private db: Database.Database) {}

  /** Record a share event when a supporter shares content */
  recordShare(data: {
    toolkit_id: string;
    content_id: string;
    supporter_id?: string;
    platform: PlatformName;
    share_method?: 'direct' | 'copy' | 'native';
    platform_post_id?: string;
  }): ShareEvent {
    const id = nanoid();
    this.db
      .prepare(
        `INSERT INTO share_events (id, toolkit_id, content_id, supporter_id, platform, share_method, platform_post_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        data.toolkit_id,
        data.content_id,
        data.supporter_id ?? null,
        data.platform,
        data.share_method ?? 'native',
        data.platform_post_id ?? null
      );
    return this.db.prepare('SELECT * FROM share_events WHERE id = ?').get(id) as ShareEvent;
  }

  /** Record a click/visit event from shared content */
  recordClick(data: {
    toolkit_id: string;
    share_event_id?: string;
    content_id?: string;
    referrer?: string;
    user_agent?: string;
    ip?: string;
  }): ClickEvent {
    const id = nanoid();
    // Hash IP for privacy — never store raw IPs
    const ipHash = data.ip
      ? createHash('sha256').update(data.ip).digest('hex').substring(0, 16)
      : null;

    this.db
      .prepare(
        `INSERT INTO click_events (id, share_event_id, toolkit_id, content_id, referrer, user_agent, ip_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        data.share_event_id ?? null,
        data.toolkit_id,
        data.content_id ?? null,
        data.referrer ?? null,
        data.user_agent ?? null,
        ipHash
      );
    return this.db.prepare('SELECT * FROM click_events WHERE id = ?').get(id) as ClickEvent;
  }

  /** Get analytics summary for a campaign */
  getCampaignSummary(campaignId: string, days = 30): AnalyticsSummary {
    const since = new Date(Date.now() - days * 86400000).toISOString();

    // Total shares
    const sharesRow = this.db
      .prepare(
        `SELECT COUNT(*) as total FROM share_events se
         JOIN toolkits t ON se.toolkit_id = t.id
         WHERE t.campaign_id = ? AND se.shared_at >= ?`
      )
      .get(campaignId, since) as { total: number };

    // Total clicks
    const clicksRow = this.db
      .prepare(
        `SELECT COUNT(*) as total FROM click_events ce
         JOIN toolkits t ON ce.toolkit_id = t.id
         WHERE t.campaign_id = ? AND ce.clicked_at >= ?`
      )
      .get(campaignId, since) as { total: number };

    // Unique sharers
    const sharersRow = this.db
      .prepare(
        `SELECT COUNT(DISTINCT supporter_id) as total FROM share_events se
         JOIN toolkits t ON se.toolkit_id = t.id
         WHERE t.campaign_id = ? AND se.shared_at >= ? AND se.supporter_id IS NOT NULL`
      )
      .get(campaignId, since) as { total: number };

    // By platform
    const platformRows = this.db
      .prepare(
        `SELECT se.platform, COUNT(*) as shares FROM share_events se
         JOIN toolkits t ON se.toolkit_id = t.id
         WHERE t.campaign_id = ? AND se.shared_at >= ?
         GROUP BY se.platform`
      )
      .all(campaignId, since) as Array<{ platform: string; shares: number }>;

    const platformClickRows = this.db
      .prepare(
        `SELECT 
           CASE 
             WHEN ce.referrer LIKE '%facebook%' THEN 'facebook'
             WHEN ce.referrer LIKE '%instagram%' THEN 'instagram'
             WHEN ce.referrer LIKE '%twitter%' OR ce.referrer LIKE '%x.com%' THEN 'x'
             WHEN ce.referrer LIKE '%tiktok%' THEN 'tiktok'
             ELSE 'other'
           END as platform,
           COUNT(*) as clicks
         FROM click_events ce
         JOIN toolkits t ON ce.toolkit_id = t.id
         WHERE t.campaign_id = ? AND ce.clicked_at >= ?
         GROUP BY platform`
      )
      .all(campaignId, since) as Array<{ platform: string; clicks: number }>;

    const byPlatform: Record<string, { shares: number; clicks: number }> = {};
    for (const row of platformRows) {
      byPlatform[row.platform] = { shares: row.shares, clicks: 0 };
    }
    for (const row of platformClickRows) {
      if (!byPlatform[row.platform]) byPlatform[row.platform] = { shares: 0, clicks: 0 };
      byPlatform[row.platform].clicks = row.clicks;
    }

    // By day
    const byDay = this.db
      .prepare(
        `SELECT date(se.shared_at) as date, COUNT(*) as shares, 0 as clicks
         FROM share_events se
         JOIN toolkits t ON se.toolkit_id = t.id
         WHERE t.campaign_id = ? AND se.shared_at >= ?
         GROUP BY date(se.shared_at)
         ORDER BY date`
      )
      .all(campaignId, since) as Array<{ date: string; shares: number; clicks: number }>;

    // Top content
    const topContent = this.db
      .prepare(
        `SELECT c.id as content_id, c.title,
                COUNT(se.id) as shares,
                (SELECT COUNT(*) FROM click_events ce WHERE ce.content_id = c.id AND ce.clicked_at >= ?) as clicks
         FROM content c
         JOIN share_events se ON se.content_id = c.id
         JOIN toolkits t ON se.toolkit_id = t.id
         WHERE t.campaign_id = ? AND se.shared_at >= ?
         GROUP BY c.id
         ORDER BY shares DESC
         LIMIT 10`
      )
      .all(since, campaignId, since) as Array<{
        content_id: string;
        title: string;
        shares: number;
        clicks: number;
      }>;

    return {
      total_shares: sharesRow.total,
      total_clicks: clicksRow.total,
      unique_sharers: sharersRow.total,
      by_platform: byPlatform,
      by_day: byDay,
      top_content: topContent,
    };
  }

  /** Get analytics for a specific toolkit */
  getToolkitSummary(toolkitId: string, days = 30): AnalyticsSummary {
    const since = new Date(Date.now() - days * 86400000).toISOString();

    const sharesRow = this.db
      .prepare(
        `SELECT COUNT(*) as total FROM share_events
         WHERE toolkit_id = ? AND shared_at >= ?`
      )
      .get(toolkitId, since) as { total: number };

    const clicksRow = this.db
      .prepare(
        `SELECT COUNT(*) as total FROM click_events
         WHERE toolkit_id = ? AND clicked_at >= ?`
      )
      .get(toolkitId, since) as { total: number };

    const sharersRow = this.db
      .prepare(
        `SELECT COUNT(DISTINCT supporter_id) as total FROM share_events
         WHERE toolkit_id = ? AND shared_at >= ? AND supporter_id IS NOT NULL`
      )
      .get(toolkitId, since) as { total: number };

    const platformRows = this.db
      .prepare(
        `SELECT platform, COUNT(*) as shares FROM share_events
         WHERE toolkit_id = ? AND shared_at >= ?
         GROUP BY platform`
      )
      .all(toolkitId, since) as Array<{ platform: string; shares: number }>;

    const byPlatform: Record<string, { shares: number; clicks: number }> = {};
    for (const row of platformRows) {
      byPlatform[row.platform] = { shares: row.shares, clicks: 0 };
    }

    const byDay = this.db
      .prepare(
        `SELECT date(shared_at) as date, COUNT(*) as shares, 0 as clicks
         FROM share_events
         WHERE toolkit_id = ? AND shared_at >= ?
         GROUP BY date(shared_at)
         ORDER BY date`
      )
      .all(toolkitId, since) as Array<{ date: string; shares: number; clicks: number }>;

    const topContent = this.db
      .prepare(
        `SELECT c.id as content_id, c.title, COUNT(se.id) as shares, 0 as clicks
         FROM content c
         JOIN share_events se ON se.content_id = c.id
         WHERE se.toolkit_id = ? AND se.shared_at >= ?
         GROUP BY c.id
         ORDER BY shares DESC
         LIMIT 10`
      )
      .all(toolkitId, since) as Array<{
        content_id: string;
        title: string;
        shares: number;
        clicks: number;
      }>;

    return {
      total_shares: sharesRow.total,
      total_clicks: clicksRow.total,
      unique_sharers: sharersRow.total,
      by_platform: byPlatform,
      by_day: byDay,
      top_content: topContent,
    };
  }
}
