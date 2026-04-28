import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const configSchema = z.object({
  port: z.coerce.number().default(3000),
  host: z.string().default('localhost'),
  baseUrl: z.string().default('http://localhost:3000'),
  databasePath: z.string().default('./data/amplifier.db'),
  sessionSecret: z.string().min(16),

  facebook: z.object({
    appId: z.string().optional(),
    appSecret: z.string().optional(),
    redirectUri: z.string().optional(),
  }),

  instagram: z.object({
    appId: z.string().optional(),
    appSecret: z.string().optional(),
    redirectUri: z.string().optional(),
  }),

  x: z.object({
    clientId: z.string().optional(),
    clientSecret: z.string().optional(),
    redirectUri: z.string().optional(),
  }),

  tiktok: z.object({
    clientKey: z.string().optional(),
    clientSecret: z.string().optional(),
    redirectUri: z.string().optional(),
  }),
});

export type Config = z.infer<typeof configSchema>;

export function loadConfig(): Config {
  return configSchema.parse({
    port: process.env.PORT,
    host: process.env.HOST,
    baseUrl: process.env.BASE_URL,
    databasePath: process.env.DATABASE_PATH,
    sessionSecret: process.env.SESSION_SECRET ?? 'dev-secret-change-me!!',

    facebook: {
      appId: process.env.FACEBOOK_APP_ID || undefined,
      appSecret: process.env.FACEBOOK_APP_SECRET || undefined,
      redirectUri: process.env.FACEBOOK_REDIRECT_URI || undefined,
    },

    instagram: {
      appId: process.env.INSTAGRAM_APP_ID || undefined,
      appSecret: process.env.INSTAGRAM_APP_SECRET || undefined,
      redirectUri: process.env.INSTAGRAM_REDIRECT_URI || undefined,
    },

    x: {
      clientId: process.env.X_CLIENT_ID || undefined,
      clientSecret: process.env.X_CLIENT_SECRET || undefined,
      redirectUri: process.env.X_REDIRECT_URI || undefined,
    },

    tiktok: {
      clientKey: process.env.TIKTOK_CLIENT_KEY || undefined,
      clientSecret: process.env.TIKTOK_CLIENT_SECRET || undefined,
      redirectUri: process.env.TIKTOK_REDIRECT_URI || undefined,
    },
  });
}
