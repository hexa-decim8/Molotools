import { Router } from 'express';
import type Database from 'better-sqlite3';
import type { PlatformRegistry } from '../platforms/index.js';
import { CampaignManager } from '../campaigns/index.js';
import { z } from 'zod';
import { AnalyticsEngine } from '../analytics/index.js';
import { FacebookApiError, FacebookPlatform } from '../platforms/facebook.js';

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
  const analytics = new AnalyticsEngine(db);

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

  /**
   * POST /share/toolkit/:id/profile-picture
   * Uploads the selected toolkit image to Facebook as an unpublished photo,
   * then returns a review URL where the supporter can set it as profile picture.
   */
  router.post('/toolkit/:id/profile-picture', async (req, res) => {
    const parsed = z
      .object({
        content_id: z.string(),
        account_id: z.string().optional(),
        return_url: z.string().url().optional(),
      })
      .safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.errors });
    }

    const { content_id, account_id, return_url } = parsed.data;
    const toolkitId = req.params.id;

    const toolkit = manager.getToolkit(toolkitId);
    if (!toolkit || !toolkit.is_active) {
      return res.status(404).json({ error: 'Toolkit not found or inactive' });
    }

    const content = manager.getToolkitContent(toolkitId).find((item) => item.id === content_id);
    if (!content) {
      return res.status(404).json({ error: 'Content item not found in toolkit' });
    }

    if (!content.media_url) {
      return res.status(400).json({ error: 'Selected content has no image to upload' });
    }

    const fbPlatform = platforms.get('facebook');
    if (!(fbPlatform instanceof FacebookPlatform)) {
      return res.status(503).json({ error: 'Facebook platform is unavailable' });
    }

    if (!fbPlatform.isConfigured) {
      return res.status(503).json({ error: 'Facebook platform is not configured' });
    }

    const connectUrl = new URL('/api/auth/facebook/connect', `${req.protocol}://${req.get('host')}`);
    connectUrl.searchParams.set('return_url', return_url ?? req.get('referer') ?? '/');

    if (!account_id) {
      return res.status(401).json({
        error: 'facebook_connect_required',
        message: 'Connect Facebook to continue.',
        reconnect_url: connectUrl.toString(),
      });
    }

    const account = db
      .prepare(
        `SELECT id, access_token, refresh_token, token_expires_at
         FROM supporter_accounts
         WHERE id = ? AND platform = 'facebook'`
      )
      .get(account_id) as
      | {
          id: string;
          access_token: string | null;
          refresh_token: string | null;
          token_expires_at: string | null;
        }
      | undefined;

    if (!account?.access_token) {
      return res.status(401).json({
        error: 'facebook_connect_required',
        message: 'Facebook account not found. Reconnect to continue.',
        reconnect_url: connectUrl.toString(),
      });
    }

    let accessToken = account.access_token;
    const isExpired =
      !!account.token_expires_at && new Date(account.token_expires_at).getTime() <= Date.now();

    if (isExpired && account.refresh_token) {
      try {
        const refreshed = await fbPlatform.refreshToken(account.refresh_token);
        accessToken = refreshed.accessToken;
        db.prepare(
          `UPDATE supporter_accounts
           SET access_token = ?, token_expires_at = ?, refresh_token = COALESCE(?, refresh_token)
           WHERE id = ?`
        ).run(
          refreshed.accessToken,
          refreshed.expiresAt?.toISOString() ?? null,
          refreshed.refreshToken ?? null,
          account.id
        );
      } catch {
        return res.status(401).json({
          error: 'facebook_reconnect_required',
          message: 'Your Facebook session expired. Reconnect to continue.',
          reconnect_url: connectUrl.toString(),
        });
      }
    }

    if (isExpired && !account.refresh_token) {
      return res.status(401).json({
        error: 'facebook_reconnect_required',
        message: 'Your Facebook session expired. Reconnect to continue.',
        reconnect_url: connectUrl.toString(),
      });
    }

    let imageRes: Response;
    try {
      imageRes = await fetch(content.media_url);
    } catch {
      return res.status(502).json({ error: 'Failed to fetch image from media URL' });
    }

    if (!imageRes.ok) {
      return res.status(502).json({ error: 'Media URL returned an invalid response' });
    }

    const contentTypeHeader = imageRes.headers.get('content-type') ?? '';
    const mimeType = contentTypeHeader.split(';')[0].trim().toLowerCase();
    if (mimeType !== 'image/jpeg' && mimeType !== 'image/png') {
      return res.status(400).json({
        error: 'Unsupported image type. Facebook profile uploads require JPEG or PNG.',
      });
    }

    const imageBuffer = Buffer.from(await imageRes.arrayBuffer());
    if (imageBuffer.length > 4 * 1024 * 1024) {
      return res.status(400).json({ error: 'Image is too large. Maximum supported size is 4MB.' });
    }

    try {
      const result = await fbPlatform.uploadPhotoForProfileReview(
        accessToken,
        imageBuffer,
        mimeType as 'image/jpeg' | 'image/png'
      );

      analytics.recordShare({
        toolkit_id: toolkitId,
        content_id,
        platform: 'facebook',
        share_method: 'native',
      });

      return res.json({
        review_url: result.reviewUrl,
        profile_url: result.profileUrl,
        photo_id: result.photoId,
      });
    } catch (error: any) {
      if (error instanceof FacebookApiError) {
        const message = error.message.toLowerCase();
        if (
          error.status === 401 ||
          message.includes('permission') ||
          message.includes('user_photos') ||
          message.includes('oauth')
        ) {
          return res.status(401).json({
            error: 'facebook_reconnect_required',
            message: 'Facebook permission is missing or expired. Reconnect to continue.',
            reconnect_url: connectUrl.toString(),
          });
        }
      }

      console.error('Facebook profile-picture preparation failed:', error);
      return res.status(502).json({
        error: 'Unable to prepare Facebook profile picture flow right now.',
      });
    }
  });

  return router;
}
