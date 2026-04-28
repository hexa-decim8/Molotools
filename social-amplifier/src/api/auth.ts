import { Router } from 'express';
import type Database from 'better-sqlite3';
import type { PlatformRegistry, PlatformName } from '../platforms/index.js';
import { nanoid } from 'nanoid';

/**
 * OAuth callback routes for connecting supporter social accounts.
 */
export function createAuthRoutes(
  db: Database.Database,
  platforms: PlatformRegistry
): Router {
  const router = Router();

  // Store pending OAuth states in memory (short-lived)
  const pendingStates = new Map<string, { platform: PlatformName; returnUrl: string }>();

  /**
   * GET /auth/:platform/connect
   * Initiates OAuth flow for a supporter to connect their account.
   */
  router.get('/:platform/connect', (req, res) => {
    const platformName = req.params.platform as PlatformName;
    const platform = platforms.get(platformName);

    if (!platform || !platform.isConfigured) {
      return res.status(400).json({ error: `Platform "${platformName}" is not configured` });
    }

    const state = nanoid(32);
    const returnUrl = (req.query.return_url as string) ?? '/';

    pendingStates.set(state, { platform: platformName, returnUrl });

    // Auto-expire states after 10 minutes
    setTimeout(() => pendingStates.delete(state), 600_000);

    const authUrl = platform.getAuthUrl(state);
    res.redirect(authUrl);
  });

  /**
   * GET /auth/:platform/callback
   * OAuth callback handler — exchanges code for tokens.
   */
  router.get('/:platform/callback', async (req, res) => {
    const { code, state, error } = req.query;

    if (error) {
      return res.status(400).json({ error: `OAuth error: ${error}` });
    }

    if (!state || !pendingStates.has(state as string)) {
      return res.status(400).json({ error: 'Invalid or expired OAuth state' });
    }

    const { platform: platformName, returnUrl } = pendingStates.get(state as string)!;
    pendingStates.delete(state as string);

    const platform = platforms.get(platformName);
    if (!platform) {
      return res.status(400).json({ error: 'Platform not found' });
    }

    try {
      const tokens = await platform.exchangeCode(code as string);

      // Store the connected account
      const accountId = nanoid();
      db.prepare(
        `INSERT INTO supporter_accounts (id, supporter_id, platform, platform_user_id, access_token, refresh_token, token_expires_at, username)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        accountId,
        'anonymous', // Will be linked to a supporter later
        platformName,
        tokens.platformUserId ?? null,
        tokens.accessToken,
        tokens.refreshToken ?? null,
        tokens.expiresAt?.toISOString() ?? null,
        tokens.username ?? null
      );

      // Redirect back with success
      const returnWithToken = new URL(returnUrl, `${req.protocol}://${req.get('host')}`);
      returnWithToken.searchParams.set('connected', platformName);
      returnWithToken.searchParams.set('account_id', accountId);
      res.redirect(returnWithToken.toString());
    } catch (err: any) {
      console.error(`OAuth callback error for ${platformName}:`, err.message);
      res.status(500).json({ error: 'Failed to complete authentication' });
    }
  });

  /**
   * GET /auth/status
   * Returns which platforms are configured and available.
   */
  router.get('/status', (_req, res) => {
    const status = platforms.getAll().map((p) => ({
      name: p.name,
      label: p.label,
      configured: p.isConfigured,
    }));
    res.json(status);
  });

  return router;
}
