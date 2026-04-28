import { Router } from 'express';
import type Database from 'better-sqlite3';
import type { PlatformRegistry } from '../platforms/index.js';
import { createCampaignRoutes } from './campaigns.js';
import { createAnalyticsRoutes } from './analytics.js';
import { createShareRoutes } from './share.js';
import { createAuthRoutes } from './auth.js';

export function createApiRouter(
  db: Database.Database,
  platforms: PlatformRegistry
): Router {
  const router = Router();

  // Campaign management (organizations, campaigns, content, toolkits)
  router.use('/', createCampaignRoutes(db));

  // Analytics (share/click tracking and summaries)
  router.use('/analytics', createAnalyticsRoutes(db));

  // Public share endpoints (toolkit data, embed code, click redirect)
  router.use('/share', createShareRoutes(db, platforms));

  // OAuth flows for platform connections
  router.use('/auth', createAuthRoutes(db, platforms));

  return router;
}
