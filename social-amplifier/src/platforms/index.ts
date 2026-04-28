import type { Config } from '../config/index.js';
import type { SocialPlatform, PlatformName } from './base.js';
import { FacebookPlatform } from './facebook.js';
import { InstagramPlatform } from './instagram.js';
import { XPlatform } from './x.js';
import { TikTokPlatform } from './tiktok.js';

export type { SocialPlatform, PlatformName } from './base.js';

/**
 * Registry of all social platform integrations.
 * Provides a uniform interface to access any configured platform.
 */
export class PlatformRegistry {
  private platforms: Map<PlatformName, SocialPlatform>;

  constructor(config: Config) {
    this.platforms = new Map();

    this.platforms.set('facebook', new FacebookPlatform(config.facebook));
    this.platforms.set('instagram', new InstagramPlatform(config.instagram));
    this.platforms.set('x', new XPlatform(config.x));
    this.platforms.set('tiktok', new TikTokPlatform(config.tiktok));
  }

  get(name: PlatformName): SocialPlatform | undefined {
    return this.platforms.get(name);
  }

  getConfigured(): SocialPlatform[] {
    return [...this.platforms.values()].filter((p) => p.isConfigured);
  }

  getAll(): SocialPlatform[] {
    return [...this.platforms.values()];
  }

  /** Get share URLs for all active platforms */
  getShareUrls(
    text: string,
    url?: string,
    platforms?: PlatformName[]
  ): Record<PlatformName, string> {
    const result: Partial<Record<PlatformName, string>> = {};
    const targets = platforms ?? (['facebook', 'x', 'tiktok'] as PlatformName[]);

    for (const name of targets) {
      const platform = this.platforms.get(name);
      if (platform) {
        result[name] = platform.getShareUrl(text, url);
      }
    }

    return result as Record<PlatformName, string>;
  }
}
