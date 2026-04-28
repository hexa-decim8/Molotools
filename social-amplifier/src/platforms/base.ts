/**
 * Base interface for all social platform integrations.
 * Each platform implements this contract to provide a uniform API
 * for authentication, posting, and analytics retrieval.
 */
export interface PlatformAuth {
  /** Build the OAuth authorization URL to redirect users to */
  getAuthUrl(state: string): string;

  /** Exchange an authorization code for access/refresh tokens */
  exchangeCode(code: string): Promise<PlatformTokens>;

  /** Refresh an expired access token */
  refreshToken(refreshToken: string): Promise<PlatformTokens>;
}

export interface PlatformTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  platformUserId?: string;
  username?: string;
}

export interface PlatformPost {
  /** Platform-specific post ID */
  postId: string;
  /** URL to the published post */
  url: string;
}

export interface PlatformMetrics {
  impressions?: number;
  engagements?: number;
  likes?: number;
  shares?: number;
  comments?: number;
  clicks?: number;
}

export interface PlatformProfile {
  id: string;
  username: string;
  displayName: string;
  followerCount: number;
  profileUrl: string;
  avatarUrl?: string;
}

export interface SocialPlatform extends PlatformAuth {
  /** Platform identifier */
  readonly name: 'facebook' | 'instagram' | 'x' | 'tiktok';

  /** Human-readable label */
  readonly label: string;

  /** Whether this platform's API credentials are configured */
  readonly isConfigured: boolean;

  /** Character limit for post text on this platform */
  readonly charLimit: number;

  /** Publish a text/link post on behalf of a user */
  publishPost(
    accessToken: string,
    text: string,
    options?: {
      mediaUrl?: string;
      linkUrl?: string;
    }
  ): Promise<PlatformPost>;

  /** Get engagement metrics for a published post */
  getPostMetrics(accessToken: string, postId: string): Promise<PlatformMetrics>;

  /** Get the authenticated user's profile */
  getProfile(accessToken: string): Promise<PlatformProfile>;

  /** Generate a share URL that opens the platform's native share flow */
  getShareUrl(text: string, url?: string): string;
}

export type PlatformName = SocialPlatform['name'];
