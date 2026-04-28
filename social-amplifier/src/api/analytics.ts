import { Router } from 'express';
import type Database from 'better-sqlite3';
import { z } from 'zod';
import { AnalyticsEngine } from '../analytics/index.js';
import type { PlatformName } from '../platforms/index.js';

export function createAnalyticsRoutes(db: Database.Database): Router {
  const router = Router();
  const engine = new AnalyticsEngine(db);

  // ── Record a share event (called by the embed widget) ──

  router.post('/share', (req, res) => {
    try {
      const data = z
        .object({
          toolkit_id: z.string(),
          content_id: z.string(),
          platform: z.enum(['facebook', 'instagram', 'x', 'tiktok']),
          share_method: z.enum(['direct', 'copy', 'native']).optional(),
          supporter_id: z.string().optional(),
        })
        .parse(req.body);

      const event = engine.recordShare({
        ...data,
        platform: data.platform as PlatformName,
      });
      res.status(201).json(event);
    } catch (err: any) {
      if (err.name === 'ZodError') {
        res.status(400).json({ error: 'Validation failed', details: err.errors });
      } else {
        res.status(500).json({ error: 'Failed to record share' });
      }
    }
  });

  // ── Record a click event (redirect tracking) ──

  router.post('/click', (req, res) => {
    try {
      const data = z
        .object({
          toolkit_id: z.string(),
          share_event_id: z.string().optional(),
          content_id: z.string().optional(),
        })
        .parse(req.body);

      const event = engine.recordClick({
        ...data,
        referrer: req.get('referer'),
        user_agent: req.get('user-agent'),
        ip: req.ip,
      });
      res.status(201).json(event);
    } catch (err: any) {
      if (err.name === 'ZodError') {
        res.status(400).json({ error: 'Validation failed', details: err.errors });
      } else {
        res.status(500).json({ error: 'Failed to record click' });
      }
    }
  });

  // ── Campaign analytics ──

  router.get('/campaigns/:campaignId/summary', (req, res) => {
    const days = parseInt(req.query.days as string) || 30;
    const summary = engine.getCampaignSummary(req.params.campaignId, days);
    res.json(summary);
  });

  // ── Toolkit analytics ──

  router.get('/toolkits/:toolkitId/summary', (req, res) => {
    const days = parseInt(req.query.days as string) || 30;
    const summary = engine.getToolkitSummary(req.params.toolkitId, days);
    res.json(summary);
  });

  return router;
}
