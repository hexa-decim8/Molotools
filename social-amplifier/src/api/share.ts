import { Router } from 'express';
import type Database from 'better-sqlite3';
import type { PlatformRegistry } from '../platforms/index.js';
import { CampaignManager } from '../campaigns/index.js';

/**
 * Public share routes — these power the embeddable share toolkit.
 * No authentication required; these are accessed by supporters.
 */
export function createShareRoutes(
  db: Database.Database,
  platforms: PlatformRegistry
): Router {
  const router = Router();
  const manager = new CampaignManager(db);

  /**
   * GET /share/toolkit/:id
   * Returns the toolkit data needed to render the embed widget.
   * This is the public-facing endpoint that the embed JS calls.
   */
  router.get('/toolkit/:id', (req, res) => {
    const toolkit = manager.getToolkit(req.params.id);
    if (!toolkit || !toolkit.is_active) {
      return res.status(404).json({ error: 'Toolkit not found or inactive' });
    }

    const content = manager.getToolkitContent(req.params.id);

    // Generate share URLs for each content item × platform
    const contentWithUrls = content.map((item) => {
      const shareText = item.body ?? item.title;
      const shareUrls = platforms.getShareUrls(
        shareText,
        item.link_url ?? undefined,
        toolkit.platforms
      );

      return {
        id: item.id,
        type: item.type,
        title: item.title,
        body: item.body,
        media_url: item.media_url,
        link_url: item.link_url,
        platform_variants: item.platform_variants,
        share_urls: shareUrls,
      };
    });

    res.json({
      id: toolkit.id,
      name: toolkit.name,
      description: toolkit.description,
      theme_color: toolkit.theme_color,
      header_text: toolkit.header_text,
      cta_text: toolkit.cta_text,
      platforms: toolkit.platforms,
      content: contentWithUrls,
    });
  });

  /**
   * GET /share/toolkit/:id/embed
   * Returns the HTML embed snippet for this toolkit.
   */
  router.get('/toolkit/:id/embed', (req, res) => {
    const toolkit = manager.getToolkit(req.params.id);
    if (!toolkit) return res.status(404).json({ error: 'Toolkit not found' });

    const baseUrl = req.protocol + '://' + req.get('host');
    const embedCode = `<!-- Social Amplifier Toolkit: ${toolkit.name} -->
<div id="sa-toolkit-${toolkit.id}"></div>
<script src="${baseUrl}/embed/toolkit.js" data-toolkit-id="${toolkit.id}" data-api="${baseUrl}" async></script>`;

    res.json({ embed_code: embedCode });
  });

  /**
   * GET /share/r/:shareId
   * Click-tracking redirect. When someone clicks a shared link,
   * this records the click then redirects to the destination.
   */
  router.get('/r/:shareId', (req, res) => {
    // The shareId encodes toolkit + content info for tracking
    // Format: {toolkitId}_{contentId}
    const parts = req.params.shareId.split('_');
    if (parts.length < 2) {
      return res.status(400).json({ error: 'Invalid share link' });
    }

    const [toolkitId, contentId] = parts;
    const content = manager.getContent(contentId);

    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    // Record the click asynchronously (don't block the redirect)
    const { AnalyticsEngine } = require('../analytics/index.js');
    const analytics = new AnalyticsEngine(db);
    analytics.recordClick({
      toolkit_id: toolkitId,
      content_id: contentId,
      referrer: req.get('referer'),
      user_agent: req.get('user-agent'),
      ip: req.ip,
    });

    // Redirect to the content's link URL or a default
    const destination = content.link_url ?? '/';
    res.redirect(302, destination);
  });

  return router;
}
