import type {
  SocialPlatform,
  PlatformTokens,
  PlatformPost,
  PlatformMetrics,
  PlatformProfile,
} from './base.js';

/**
 * Instagram integration using the Instagram Graph API (via Meta)
 * https://developers.facebook.com/docs/instagram-api/
 *
 * Instagram posting requires a Business or Creator account connected
 * to a Facebook Page. Content is published as "media containers".
 */
export class InstagramPlatform implements SocialPlatform {
  readonly name = 'instagram' as const;
  readonly label = 'Instagram';
  readonly charLimit = 2200;

  private appId?: string;
  private appSecret?: string;
  private redirectUri?: string;

  constructor(config: { appId?: string; appSecret?: string; redirectUri?: string }) {
    this.appId = config.appId;
    this.appSecret = config.appSecret;
    this.redirectUri = config.redirectUri;
  }

  get isConfigured(): boolean {
    return !!(this.appId && this.appSecret);
  }

  getAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.appId!,
      redirect_uri: this.redirectUri!,
      state,
      scope: 'instagram_basic,instagram_content_publish,pages_show_list',
      response_type: 'code',
    });
    return `https://www.facebook.com/v19.0/dialog/oauth?${params}`;
  }

  async exchangeCode(code: string): Promise<PlatformTokens> {
    const params = new URLSearchParams({
      client_id: this.appId!,
      client_secret: this.appSecret!,
      redirect_uri: this.redirectUri!,
      code,
      grant_type: 'authorization_code',
    });

    const res = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?${params}`
    );

    if (!res.ok) {
      const err = await res.json();
      throw new Error(`Instagram token exchange failed: ${err.error?.message ?? res.statusText}`);
    }

    const data = await res.json();
    return {
      accessToken: data.access_token,
      expiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : undefined,
    };
  }

  async refreshToken(refreshToken: string): Promise<PlatformTokens> {
    const params = new URLSearchParams({
      grant_type: 'ig_refresh_token',
      access_token: refreshToken,
    });

    const res = await fetch(
      `https://graph.instagram.com/refresh_access_token?${params}`
    );

    if (!res.ok) throw new Error('Instagram token refresh failed');

    const data = await res.json();
    return {
      accessToken: data.access_token,
      expiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : undefined,
    };
  }

  async publishPost(
    accessToken: string,
    text: string,
    options?: { mediaUrl?: string; linkUrl?: string }
  ): Promise<PlatformPost> {
    // Instagram requires media — get the IG Business Account ID first
    const accountRes = await fetch(
      `https://graph.facebook.com/v19.0/me/accounts?access_token=${accessToken}`
    );
    const accountData = await accountRes.json();
    const pageId = accountData.data?.[0]?.id;
    if (!pageId) throw new Error('No Facebook Page found for Instagram publishing');

    const igRes = await fetch(
      `https://graph.facebook.com/v19.0/${pageId}?fields=instagram_business_account&access_token=${accessToken}`
    );
    const igData = await igRes.json();
    const igAccountId = igData.instagram_business_account?.id;
    if (!igAccountId) throw new Error('No Instagram Business account linked');

    // Create media container
    const containerBody: Record<string, string> = {
      caption: text,
      access_token: accessToken,
    };

    if (options?.mediaUrl) {
      containerBody.image_url = options.mediaUrl;
    } else {
      throw new Error('Instagram requires an image or video URL to publish');
    }

    const containerRes = await fetch(
      `https://graph.facebook.com/v19.0/${igAccountId}/media`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(containerBody),
      }
    );
    const containerData = await containerRes.json();

    // Publish the container
    const publishRes = await fetch(
      `https://graph.facebook.com/v19.0/${igAccountId}/media_publish`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creation_id: containerData.id,
          access_token: accessToken,
        }),
      }
    );
    const publishData = await publishRes.json();

    return {
      postId: publishData.id,
      url: `https://www.instagram.com/p/${publishData.id}/`,
    };
  }

  async getPostMetrics(accessToken: string, postId: string): Promise<PlatformMetrics> {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${postId}/insights?metric=impressions,reach,engagement&access_token=${accessToken}`
    );

    if (!res.ok) return {};
    const data = await res.json();
    const metrics: PlatformMetrics = {};

    for (const insight of data.data ?? []) {
      switch (insight.name) {
        case 'impressions':
          metrics.impressions = insight.values?.[0]?.value;
          break;
        case 'engagement':
          metrics.engagements = insight.values?.[0]?.value;
          break;
      }
    }

    return metrics;
  }

  async getProfile(accessToken: string): Promise<PlatformProfile> {
    // Get IG account through FB Pages
    const accountRes = await fetch(
      `https://graph.facebook.com/v19.0/me/accounts?access_token=${accessToken}`
    );
    const accountData = await accountRes.json();
    const pageId = accountData.data?.[0]?.id;

    if (pageId) {
      const igRes = await fetch(
        `https://graph.facebook.com/v19.0/${pageId}?fields=instagram_business_account{id,username,name,followers_count,profile_picture_url}&access_token=${accessToken}`
      );
      const igData = await igRes.json();
      const ig = igData.instagram_business_account;
      if (ig) {
        return {
          id: ig.id,
          username: ig.username,
          displayName: ig.name ?? ig.username,
          followerCount: ig.followers_count ?? 0,
          profileUrl: `https://www.instagram.com/${ig.username}/`,
          avatarUrl: ig.profile_picture_url,
        };
      }
    }

    throw new Error('Could not find Instagram Business account');
  }

  getShareUrl(text: string, _url?: string): string {
    // Instagram doesn't have a web share URL — use clipboard copy flow
    // Return a deep link that opens the Instagram app
    return `instagram://library?AssetPath=${encodeURIComponent(text)}`;
  }
}
