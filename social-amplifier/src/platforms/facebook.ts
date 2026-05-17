import type {
  SocialPlatform,
  PlatformTokens,
  PlatformPost,
  PlatformMetrics,
  PlatformProfile,
} from './base.js';

export class FacebookApiError extends Error {
  readonly status: number;
  readonly code?: number;

  constructor(message: string, status: number, code?: number) {
    super(message);
    this.name = 'FacebookApiError';
    this.status = status;
    this.code = code;
  }
}

/**
 * Facebook integration using the Graph API v19.0
 * https://developers.facebook.com/docs/graph-api/
 */
export class FacebookPlatform implements SocialPlatform {
  readonly name = 'facebook' as const;
  readonly label = 'Facebook';
  readonly charLimit = 63206;

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
      scope: 'pages_manage_posts,pages_read_engagement,public_profile,user_photos',
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
    });

    const res = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?${params}`
    );

    if (!res.ok) {
      const err = await res.json();
      throw new Error(`Facebook token exchange failed: ${err.error?.message ?? res.statusText}`);
    }

    const data = await res.json();

    // Get user profile to extract ID
    const profile = await this.getProfile(data.access_token);

    return {
      accessToken: data.access_token,
      expiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : undefined,
      platformUserId: profile.id,
      username: profile.username,
    };
  }

  async refreshToken(refreshToken: string): Promise<PlatformTokens> {
    // Facebook uses long-lived tokens; exchange short-lived for long-lived
    const params = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: this.appId!,
      client_secret: this.appSecret!,
      fb_exchange_token: refreshToken,
    });

    const res = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?${params}`
    );

    if (!res.ok) {
      throw new Error('Facebook token refresh failed');
    }

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
    // Post to user's feed (or page feed if using page token)
    const body: Record<string, string> = { message: text };
    if (options?.linkUrl) body.link = options.linkUrl;

    const res = await fetch('https://graph.facebook.com/v19.0/me/feed', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(`Facebook post failed: ${err.error?.message ?? res.statusText}`);
    }

    const data = await res.json();
    return {
      postId: data.id,
      url: `https://www.facebook.com/${data.id}`,
    };
  }

  async getPostMetrics(accessToken: string, postId: string): Promise<PlatformMetrics> {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${postId}?fields=insights.metric(post_impressions,post_engagements,post_clicks)&access_token=${accessToken}`
    );

    if (!res.ok) return {};

    const data = await res.json();
    const metrics: PlatformMetrics = {};

    for (const insight of data.insights?.data ?? []) {
      switch (insight.name) {
        case 'post_impressions':
          metrics.impressions = insight.values?.[0]?.value;
          break;
        case 'post_engagements':
          metrics.engagements = insight.values?.[0]?.value;
          break;
        case 'post_clicks':
          metrics.clicks = insight.values?.[0]?.value;
          break;
      }
    }

    return metrics;
  }

  async getProfile(accessToken: string): Promise<PlatformProfile> {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/me?fields=id,name,picture&access_token=${accessToken}`
    );

    if (!res.ok) {
      throw new Error('Failed to fetch Facebook profile');
    }

    const data = await res.json();
    return {
      id: data.id,
      username: data.name,
      displayName: data.name,
      followerCount: 0, // Requires additional permissions
      profileUrl: `https://facebook.com/${data.id}`,
      avatarUrl: data.picture?.data?.url,
    };
  }

  getShareUrl(text: string, url?: string): string {
    const params = new URLSearchParams();
    if (url) params.set('u', url);
    if (text) params.set('quote', text);
    return `https://www.facebook.com/sharer/sharer.php?${params}`;
  }

  async uploadPhotoForProfileReview(
    accessToken: string,
    imageBuffer: Buffer,
    mimeType: 'image/jpeg' | 'image/png'
  ): Promise<{ reviewUrl: string; profileUrl: string; photoId: string }> {
    const formData = new FormData();
    formData.append('published', 'false');
    formData.append(
      'source',
      new Blob([new Uint8Array(imageBuffer)], { type: mimeType }),
      mimeType === 'image/png' ? 'profile-picture.png' : 'profile-picture.jpg'
    );

    const uploadRes = await fetch('https://graph.facebook.com/v19.0/me/photos', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: formData,
    });

    const uploadData = await uploadRes.json().catch(() => ({}));

    if (!uploadRes.ok) {
      const message = uploadData?.error?.message ?? uploadRes.statusText;
      throw new FacebookApiError(
        `Facebook photo upload failed: ${message}`,
        uploadRes.status,
        uploadData?.error?.code
      );
    }

    const photoId = uploadData?.id as string | undefined;
    if (!photoId) {
      throw new FacebookApiError('Facebook photo upload returned no photo ID', 502);
    }

    const profile = await this.getProfile(accessToken);
    return {
      photoId,
      reviewUrl: `https://www.facebook.com/photo/?fbid=${encodeURIComponent(photoId)}`,
      profileUrl: profile.profileUrl,
    };
  }
}
