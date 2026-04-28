import type {
  SocialPlatform,
  PlatformTokens,
  PlatformPost,
  PlatformMetrics,
  PlatformProfile,
} from './base.js';

/**
 * TikTok integration using the TikTok API for Business
 * https://developers.tiktok.com/doc/overview
 *
 * TikTok's API is more restrictive — content sharing is primarily
 * handled via their Share Kit (client-side SDK) or Content Posting API
 * (requires approved app with specific permissions).
 */
export class TikTokPlatform implements SocialPlatform {
  readonly name = 'tiktok' as const;
  readonly label = 'TikTok';
  readonly charLimit = 2200;

  private clientKey?: string;
  private clientSecret?: string;
  private redirectUri?: string;

  constructor(config: { clientKey?: string; clientSecret?: string; redirectUri?: string }) {
    this.clientKey = config.clientKey;
    this.clientSecret = config.clientSecret;
    this.redirectUri = config.redirectUri;
  }

  get isConfigured(): boolean {
    return !!(this.clientKey && this.clientSecret);
  }

  getAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_key: this.clientKey!,
      redirect_uri: this.redirectUri!,
      state,
      scope: 'user.info.basic,video.publish,video.list',
      response_type: 'code',
    });
    return `https://www.tiktok.com/v2/auth/authorize/?${params}`;
  }

  async exchangeCode(code: string): Promise<PlatformTokens> {
    const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key: this.clientKey!,
        client_secret: this.clientSecret!,
        code,
        grant_type: 'authorization_code',
        redirect_uri: this.redirectUri!,
      }),
    });

    if (!res.ok) {
      throw new Error(`TikTok token exchange failed: ${res.statusText}`);
    }

    const data = await res.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : undefined,
      platformUserId: data.open_id,
    };
  }

  async refreshToken(refreshToken: string): Promise<PlatformTokens> {
    const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key: this.clientKey!,
        client_secret: this.clientSecret!,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!res.ok) throw new Error('TikTok token refresh failed');

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
    options?: { mediaUrl?: string; linkUrl?: string }
  ): Promise<PlatformPost> {
    if (!options?.mediaUrl) {
      throw new Error('TikTok requires a video URL to publish content');
    }

    // Step 1: Initialize the upload
    const initRes = await fetch(
      'https://open.tiktokapis.com/v2/post/publish/inbox/video/init/',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          source_info: {
            source: 'PULL_FROM_URL',
            video_url: options.mediaUrl,
          },
          post_info: {
            title: text,
            privacy_level: 'PUBLIC_TO_EVERYONE',
            disable_duet: false,
            disable_stitch: false,
            disable_comment: false,
          },
        }),
      }
    );

    if (!initRes.ok) {
      const err = await initRes.json();
      throw new Error(
        `TikTok publish failed: ${err.error?.message ?? initRes.statusText}`
      );
    }

    const initData = await initRes.json();
    return {
      postId: initData.data?.publish_id ?? 'pending',
      url: 'https://www.tiktok.com/', // TikTok doesn't return direct URL immediately
    };
  }

  async getPostMetrics(accessToken: string, postId: string): Promise<PlatformMetrics> {
    const res = await fetch('https://open.tiktokapis.com/v2/video/query/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        filters: { video_ids: [postId] },
        fields: ['like_count', 'comment_count', 'share_count', 'view_count'],
      }),
    });

    if (!res.ok) return {};

    const data = await res.json();
    const video = data.data?.videos?.[0];
    if (!video) return {};

    return {
      impressions: video.view_count,
      likes: video.like_count,
      comments: video.comment_count,
      shares: video.share_count,
    };
  }

  async getProfile(accessToken: string): Promise<PlatformProfile> {
    const res = await fetch(
      'https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url,follower_count,username',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!res.ok) throw new Error('Failed to fetch TikTok profile');

    const data = await res.json();
    const user = data.data.user;
    return {
      id: user.open_id,
      username: user.username ?? user.display_name,
      displayName: user.display_name,
      followerCount: user.follower_count ?? 0,
      profileUrl: `https://www.tiktok.com/@${user.username}`,
      avatarUrl: user.avatar_url,
    };
  }

  getShareUrl(text: string, url?: string): string {
    // TikTok doesn't have a direct web share URL
    // Use their share intent or fallback to copy
    if (url) {
      return `https://www.tiktok.com/share?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
    }
    return `https://www.tiktok.com/`;
  }
}
