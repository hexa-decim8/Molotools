import { Router } from 'express';
import type Database from 'better-sqlite3';
import { z } from 'zod';
import { CampaignManager } from '../campaigns/index.js';

export function createCampaignRoutes(db: Database.Database): Router {
  const router = Router();
  const manager = new CampaignManager(db);

  // ── Organizations ──

  router.post('/organizations', (req, res) => {
    try {
      const data = z
        .object({
          name: z.string().min(1).max(200),
          slug: z
            .string()
            .min(1)
            .max(100)
            .regex(/^[a-z0-9-]+$/),
          description: z.string().max(1000).optional(),
        })
        .parse(req.body);

      const org = manager.createOrganization(data);
      res.status(201).json(org);
    } catch (err: any) {
      if (err.name === 'ZodError') {
        res.status(400).json({ error: 'Validation failed', details: err.errors });
      } else {
        res.status(500).json({ error: 'Failed to create organization' });
      }
    }
  });

  router.get('/organizations/:slug', (req, res) => {
    const org = manager.getOrganizationBySlug(req.params.slug);
    if (!org) return res.status(404).json({ error: 'Organization not found' });
    res.json(org);
  });

  // ── Campaigns ──

  router.get('/organizations/:orgId/campaigns', (req, res) => {
    const campaigns = manager.listCampaigns(req.params.orgId);
    res.json(campaigns);
  });

  router.post('/organizations/:orgId/campaigns', (req, res) => {
    try {
      const data = z
        .object({
          name: z.string().min(1).max(200),
          slug: z
            .string()
            .min(1)
            .max(100)
            .regex(/^[a-z0-9-]+$/),
          description: z.string().max(2000).optional(),
          starts_at: z.string().optional(),
          ends_at: z.string().optional(),
        })
        .parse(req.body);

      const campaign = manager.createCampaign({
        org_id: req.params.orgId,
        ...data,
      });
      res.status(201).json(campaign);
    } catch (err: any) {
      if (err.name === 'ZodError') {
        res.status(400).json({ error: 'Validation failed', details: err.errors });
      } else {
        res.status(500).json({ error: 'Failed to create campaign' });
      }
    }
  });

  router.get('/campaigns/:id', (req, res) => {
    const campaign = manager.getCampaign(req.params.id);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    res.json(campaign);
  });

  router.patch('/campaigns/:id/status', (req, res) => {
    try {
      const { status } = z
        .object({
          status: z.enum(['draft', 'active', 'paused', 'ended']),
        })
        .parse(req.body);

      manager.updateCampaignStatus(req.params.id, status);
      res.json({ ok: true });
    } catch (err: any) {
      if (err.name === 'ZodError') {
        res.status(400).json({ error: 'Validation failed', details: err.errors });
      } else {
        res.status(500).json({ error: 'Failed to update campaign status' });
      }
    }
  });

  // ── Content ──

  router.get('/campaigns/:campaignId/content', (req, res) => {
    const content = manager.listContent(req.params.campaignId);
    res.json(content);
  });

  router.post('/campaigns/:campaignId/content', (req, res) => {
    try {
      const data = z
        .object({
          type: z.enum(['text', 'image', 'video', 'link']).optional(),
          title: z.string().min(1).max(300),
          body: z.string().max(10000).optional(),
          media_url: z.string().url().optional(),
          link_url: z.string().url().optional(),
          platform_variants: z.record(z.object({ body: z.string().optional() })).optional(),
        })
        .parse(req.body);

      const content = manager.createContent({
        campaign_id: req.params.campaignId,
        ...data,
      });
      res.status(201).json(content);
    } catch (err: any) {
      if (err.name === 'ZodError') {
        res.status(400).json({ error: 'Validation failed', details: err.errors });
      } else {
        res.status(500).json({ error: 'Failed to create content' });
      }
    }
  });

  router.patch('/content/:id', (req, res) => {
    try {
      const data = z
        .object({
          title: z.string().min(1).max(300).optional(),
          body: z.string().max(10000).optional(),
          media_url: z.string().url().nullable().optional(),
          link_url: z.string().url().nullable().optional(),
          platform_variants: z.record(z.object({ body: z.string().optional() })).optional(),
        })
        .parse(req.body);

      manager.updateContent(req.params.id, data as any);
      const updated = manager.getContent(req.params.id);
      res.json(updated);
    } catch (err: any) {
      if (err.name === 'ZodError') {
        res.status(400).json({ error: 'Validation failed', details: err.errors });
      } else {
        res.status(500).json({ error: 'Failed to update content' });
      }
    }
  });

  router.delete('/content/:id', (req, res) => {
    manager.deleteContent(req.params.id);
    res.json({ ok: true });
  });

  // ── Toolkits ──

  router.get('/campaigns/:campaignId/toolkits', (req, res) => {
    const toolkits = manager.listToolkits(req.params.campaignId);
    res.json(toolkits);
  });

  router.post('/campaigns/:campaignId/toolkits', (req, res) => {
    try {
      const data = z
        .object({
          name: z.string().min(1).max(200),
          slug: z
            .string()
            .min(1)
            .max(100)
            .regex(/^[a-z0-9-]+$/),
          description: z.string().max(1000).optional(),
          theme_color: z
            .string()
            .regex(/^#[0-9a-fA-F]{6}$/)
            .optional(),
          header_text: z.string().max(500).optional(),
          cta_text: z.string().max(100).optional(),
          platforms: z.array(z.enum(['facebook', 'instagram', 'x', 'tiktok'])).optional(),
          content_ids: z.array(z.string()).optional(),
        })
        .parse(req.body);

      const toolkit = manager.createToolkit({
        campaign_id: req.params.campaignId,
        ...data,
      });
      res.status(201).json(toolkit);
    } catch (err: any) {
      if (err.name === 'ZodError') {
        res.status(400).json({ error: 'Validation failed', details: err.errors });
      } else {
        res.status(500).json({ error: 'Failed to create toolkit' });
      }
    }
  });

  router.get('/toolkits/:id', (req, res) => {
    const toolkit = manager.getToolkit(req.params.id);
    if (!toolkit) return res.status(404).json({ error: 'Toolkit not found' });

    const content = manager.getToolkitContent(req.params.id);
    res.json({ ...toolkit, content });
  });

  return router;
}
