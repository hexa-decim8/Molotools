import type {
  SocialPlatform,
  PlatformTokens,
  PlatformPost,
  PlatformMetrics,
  PlatformProfile,
} from './base.js';

/**
 * X (Twitter) integration using API v2 with OAuth 2.0 PKCE
 * https://developer.x.com/en/docs/x-api
 */
export class XPlatform implements SocialPlatform {
  readonly name = 'x' as const;
  readonly label = 'X (Twitter)';
  readonly charLimit = 280;

  private clientId?: string;
  private clientSecret?: string;
  private redirectUri?: string;

  constructor(config: { clientId?: string; clientSecret?: string; redirectUri?: string }) {
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.redirectUri = config.redirectUri;
  }

  get isConfigured(): boolean {
    return !!(this.clientId && this.clientSecret);
  }

  getAuthUrl(state: string): string {
    // X OAuth 2.0 with PKCE
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId!,
      redirect_uri: this.redirectUri!,
      scope: 'tweet.read tweet.write users.read offline.access',
      state,
      code_challenge: state, // In production, use proper PKCE challenge
      code_challenge_method: 'plain',
    });
    return `https://twitter.com/i/oauth2/authorize?${params}`;
  }

  async exchangeCode(code: string): Promise<PlatformTokens> {
    const basicAuth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

    const res = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        redirect_uri: this.redirectUri!,
        code_verifier: 'challenge', // Must match the challenge from getAuthUrl
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(`X token exchange failed: ${err.error_description ?? res.statusText}`);
    }

    const data = await res.json();
    const profile = await this.getProfile(data.access_token);

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : undefined,
      platformUserId: profile.id,
      username: profile.username,
    };
  }

  async refreshToken(refreshToken: string): Promise<PlatformTokens> {
    const basicAuth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

    const res = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!res.ok) throw new Error('X token refresh failed');

    const data = await res.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : undefined,
    };
  }

  async publishPost(
    accessToken: string,
    text: string,
    _options?: { mediaUrl?: string; linkUrl?: string }
  ): Promise<PlatformPost> {
    const res = await fetch('https://api.twitter.com/2/tweets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ text }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(`X post failed: ${err.detail ?? res.statusText}`);
    }

    const data = await res.json();
    return {
      postId: data.data.id,
      url: `https://x.com/i/status/${data.data.id}`,
    };
  }

  async getPostMetrics(accessToken: string, postId: string): Promise<PlatformMetrics> {
    const res = await fetch(
      `https://api.twitter.com/2/tweets/${postId}?tweet.fields=public_metrics`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!res.ok) return {};

    const data = await res.json();
    const pm = data.data?.public_metrics;
    if (!pm) return {};

    return {
      impressions: pm.impression_count,
      likes: pm.like_count,
      shares: pm.retweet_count + (pm.quote_count ?? 0),
      comments: pm.reply_count,
    };
  }

  async getProfile(accessToken: string): Promise<PlatformProfile> {
    const res = await fetch(
      'https://api.twitter.com/2/users/me?user.fields=profile_image_url,public_metrics',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!res.ok) throw new Error('Failed to fetch X profile');

    const data = await res.json();
    return {
      id: data.data.id,
      username: data.data.username,
      displayName: data.data.name,
      followerCount: data.data.public_metrics?.followers_count ?? 0,
      profileUrl: `https://x.com/${data.data.username}`,
      avatarUrl: data.data.profile_image_url,
    };
  }

  getShareUrl(text: string, url?: string): string {
    const fullText = url ? `${text} ${url}` : text;
    return `https://twitter.com/intent/tweet?text=${encodeURIComponent(fullText)}`;
  }
}
