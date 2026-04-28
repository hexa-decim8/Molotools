import type Database from 'better-sqlite3';
import { nanoid } from 'nanoid';
import type { PlatformName } from '../platforms/index.js';

// ── Types ────────────────────────────────────────────────────────────

export interface Organization {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logo_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Campaign {
  id: string;
  org_id: string;
  name: string;
  slug: string;
  description?: string;
  status: 'draft' | 'active' | 'paused' | 'ended';
  starts_at?: string;
  ends_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ContentItem {
  id: string;
  campaign_id: string;
  type: 'text' | 'image' | 'video' | 'link';
  title: string;
  body?: string;
  media_url?: string;
  link_url?: string;
  link_preview_title?: string;
  link_preview_description?: string;
  link_preview_image?: string;
  platform_variants?: Record<PlatformName, { body?: string }>;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Toolkit {
  id: string;
  campaign_id: string;
  name: string;
  slug: string;
  description?: string;
  theme_color: string;
  header_text?: string;
  cta_text: string;
  platforms: PlatformName[];
  is_active: boolean;
  embed_code?: string;
  created_at: string;
  updated_at: string;
}

// ── Campaign Manager ─────────────────────────────────────────────────

export class CampaignManager {
  constructor(private db: Database.Database) {}

  // ── Organizations ──

  createOrganization(data: { name: string; slug: string; description?: string }): Organization {
    const id = nanoid();
    this.db
      .prepare(
        `INSERT INTO organizations (id, name, slug, description) VALUES (?, ?, ?, ?)`
      )
      .run(id, data.name, data.slug, data.description ?? null);
    return this.getOrganization(id)!;
  }

  getOrganization(id: string): Organization | undefined {
    return this.db.prepare('SELECT * FROM organizations WHERE id = ?').get(id) as
      | Organization
      | undefined;
  }

  getOrganizationBySlug(slug: string): Organization | undefined {
    return this.db.prepare('SELECT * FROM organizations WHERE slug = ?').get(slug) as
      | Organization
      | undefined;
  }

  // ── Campaigns ──

  createCampaign(data: {
    org_id: string;
    name: string;
    slug: string;
    description?: string;
    starts_at?: string;
    ends_at?: string;
  }): Campaign {
    const id = nanoid();
    this.db
      .prepare(
        `INSERT INTO campaigns (id, org_id, name, slug, description, starts_at, ends_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        data.org_id,
        data.name,
        data.slug,
        data.description ?? null,
        data.starts_at ?? null,
        data.ends_at ?? null
      );
    return this.getCampaign(id)!;
  }

  getCampaign(id: string): Campaign | undefined {
    return this.db.prepare('SELECT * FROM campaigns WHERE id = ?').get(id) as
      | Campaign
      | undefined;
  }

  listCampaigns(orgId: string): Campaign[] {
    return this.db
      .prepare('SELECT * FROM campaigns WHERE org_id = ? ORDER BY created_at DESC')
      .all(orgId) as Campaign[];
  }

  updateCampaignStatus(id: string, status: Campaign['status']): void {
    this.db
      .prepare(
        `UPDATE campaigns SET status = ?, updated_at = datetime('now') WHERE id = ?`
      )
      .run(status, id);
  }

  // ── Content ──

  createContent(data: {
    campaign_id: string;
    type?: ContentItem['type'];
    title: string;
    body?: string;
    media_url?: string;
    link_url?: string;
    platform_variants?: Record<string, { body?: string }>;
  }): ContentItem {
    const id = nanoid();
    const maxOrder = this.db
      .prepare('SELECT MAX(sort_order) as max_order FROM content WHERE campaign_id = ?')
      .get(data.campaign_id) as { max_order: number | null };

    this.db
      .prepare(
        `INSERT INTO content (id, campaign_id, type, title, body, media_url, link_url, platform_variants, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        data.campaign_id,
        data.type ?? 'text',
        data.title,
        data.body ?? null,
        data.media_url ?? null,
        data.link_url ?? null,
        data.platform_variants ? JSON.stringify(data.platform_variants) : null,
        (maxOrder.max_order ?? -1) + 1
      );
    return this.getContent(id)!;
  }

  getContent(id: string): ContentItem | undefined {
    const row = this.db.prepare('SELECT * FROM content WHERE id = ?').get(id) as any;
    if (!row) return undefined;
    return {
      ...row,
      platform_variants: row.platform_variants
        ? JSON.parse(row.platform_variants)
        : undefined,
    };
  }

  listContent(campaignId: string): ContentItem[] {
    const rows = this.db
      .prepare('SELECT * FROM content WHERE campaign_id = ? ORDER BY sort_order')
      .all(campaignId) as any[];
    return rows.map((r) => ({
      ...r,
      platform_variants: r.platform_variants
        ? JSON.parse(r.platform_variants)
        : undefined,
    }));
  }

  updateContent(
    id: string,
    data: Partial<Pick<ContentItem, 'title' | 'body' | 'media_url' | 'link_url' | 'platform_variants'>>
  ): void {
    const sets: string[] = [];
    const values: any[] = [];

    if (data.title !== undefined) { sets.push('title = ?'); values.push(data.title); }
    if (data.body !== undefined) { sets.push('body = ?'); values.push(data.body); }
    if (data.media_url !== undefined) { sets.push('media_url = ?'); values.push(data.media_url); }
    if (data.link_url !== undefined) { sets.push('link_url = ?'); values.push(data.link_url); }
    if (data.platform_variants !== undefined) {
      sets.push('platform_variants = ?');
      values.push(JSON.stringify(data.platform_variants));
    }

    if (sets.length === 0) return;

    sets.push("updated_at = datetime('now')");
    values.push(id);

    this.db.prepare(`UPDATE content SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  }

  deleteContent(id: string): void {
    this.db.prepare('DELETE FROM content WHERE id = ?').run(id);
  }

  // ── Toolkits ──

  createToolkit(data: {
    campaign_id: string;
    name: string;
    slug: string;
    description?: string;
    theme_color?: string;
    header_text?: string;
    cta_text?: string;
    platforms?: PlatformName[];
    content_ids?: string[];
  }): Toolkit {
    const id = nanoid();
    const platforms = data.platforms ?? ['facebook', 'instagram', 'x', 'tiktok'];

    this.db
      .prepare(
        `INSERT INTO toolkits (id, campaign_id, name, slug, description, theme_color, header_text, cta_text, platforms)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        data.campaign_id,
        data.name,
        data.slug,
        data.description ?? null,
        data.theme_color ?? '#1a73e8',
        data.header_text ?? null,
        data.cta_text ?? 'Share Now',
        JSON.stringify(platforms)
      );

    // Link content items
    if (data.content_ids?.length) {
      const insert = this.db.prepare(
        'INSERT INTO toolkit_content (toolkit_id, content_id, sort_order) VALUES (?, ?, ?)'
      );
      for (let i = 0; i < data.content_ids.length; i++) {
        insert.run(id, data.content_ids[i], i);
      }
    }

    return this.getToolkit(id)!;
  }

  getToolkit(id: string): Toolkit | undefined {
    const row = this.db.prepare('SELECT * FROM toolkits WHERE id = ?').get(id) as any;
    if (!row) return undefined;
    return {
      ...row,
      platforms: JSON.parse(row.platforms),
      is_active: !!row.is_active,
    };
  }

  getToolkitBySlug(campaignId: string, slug: string): Toolkit | undefined {
    const row = this.db
      .prepare('SELECT * FROM toolkits WHERE campaign_id = ? AND slug = ?')
      .get(campaignId, slug) as any;
    if (!row) return undefined;
    return {
      ...row,
      platforms: JSON.parse(row.platforms),
      is_active: !!row.is_active,
    };
  }

  getToolkitContent(toolkitId: string): ContentItem[] {
    const rows = this.db
      .prepare(
        `SELECT c.* FROM content c
         JOIN toolkit_content tc ON c.id = tc.content_id
         WHERE tc.toolkit_id = ?
         ORDER BY tc.sort_order`
      )
      .all(toolkitId) as any[];
    return rows.map((r) => ({
      ...r,
      platform_variants: r.platform_variants
        ? JSON.parse(r.platform_variants)
        : undefined,
    }));
  }

  listToolkits(campaignId: string): Toolkit[] {
    const rows = this.db
      .prepare('SELECT * FROM toolkits WHERE campaign_id = ? ORDER BY created_at DESC')
      .all(campaignId) as any[];
    return rows.map((r) => ({
      ...r,
      platforms: JSON.parse(r.platforms),
      is_active: !!r.is_active,
    }));
  }
}
