import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

import { loadConfig } from './config/index.js';
import { getDatabase, closeDatabase } from './database/index.js';
import { runMigrations } from './database/migrations.js';
import { PlatformRegistry } from './platforms/index.js';
import { createApiRouter } from './api/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const config = loadConfig();
  const app = express();

  // ── Security middleware ──
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"], // embed widget needs inline
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'", config.baseUrl],
        },
      },
      crossOriginEmbedderPolicy: false, // Allow embedding
    })
  );

  // ── CORS — allow embeds from any origin ──
  app.use(
    cors({
      origin: true, // Reflect the request origin
      credentials: true,
    })
  );

  app.use(express.json({ limit: '1mb' }));

  // ── Database ──
  const db = getDatabase(config.databasePath);
  console.log('Running database migrations...');
  runMigrations(db);

  // ── Platform registry ──
  const platforms = new PlatformRegistry(config);
  const configured = platforms.getConfigured();
  console.log(
    `Platforms configured: ${configured.length > 0 ? configured.map((p) => p.label).join(', ') : 'none (share URLs still work)'}`
  );

  // ── API routes ──
  app.use('/api', createApiRouter(db, platforms));

  // ── Serve the embed widget JS ──
  app.use('/embed', express.static(resolve(__dirname, 'embed')));

  // ── Health check ──
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', version: '0.1.0' });
  });

  // ── Start server ──
  const server = app.listen(config.port, config.host, () => {
    console.log(`\n🚀 Social Amplifier running at ${config.baseUrl}`);
    console.log(`   API:    ${config.baseUrl}/api`);
    console.log(`   Health: ${config.baseUrl}/health`);
    console.log(`   Embed:  ${config.baseUrl}/embed/toolkit.js\n`);
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log('\nShutting down...');
    server.close();
    closeDatabase();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
