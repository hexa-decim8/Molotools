# Social Amplifier

A social media amplification platform for political campaigns. Create shareable content, distribute it through supporter networks on Facebook, Instagram, X, and TikTok, and measure engagement in real time.

Inspired by platforms like [SoSha](https://sosha.ai) — built as a self-hosted, open-source alternative focused on political campaigns.

## Architecture

```
social-amplifier/
├── src/
│   ├── index.ts                 # Express server entry point
│   ├── config/                  # Environment config + validation
│   ├── platforms/               # Social platform API integrations
│   │   ├── base.ts              # SocialPlatform interface
│   │   ├── facebook.ts          # Facebook Graph API v19
│   │   ├── instagram.ts         # Instagram Graph API (via Meta)
│   │   ├── x.ts                 # X (Twitter) API v2
│   │   └── tiktok.ts            # TikTok Content Posting API
│   ├── campaigns/               # Campaign + content + toolkit management
│   ├── analytics/               # Share/click tracking + aggregation
│   ├── api/                     # Express route handlers
│   │   ├── campaigns.ts         # CRUD for orgs, campaigns, content, toolkits
│   │   ├── analytics.ts         # Share/click recording + summaries
│   │   ├── share.ts             # Public toolkit data + click redirect
│   │   └── auth.ts              # OAuth flows for platform connections
│   ├── database/                # SQLite via better-sqlite3
│   │   └── migrations.ts        # Schema migrations
│   └── embed/
│       └── toolkit.js           # Embeddable share widget (vanilla JS)
```

## Core Concepts

### Campaigns
A themed push with a start/end date — e.g., "GOTV October", "Fundraising Q4". Contains content items and toolkits.

### Content
Individual shareable items within a campaign: text posts, images, videos, or links. Each can have per-platform copy variants (e.g., shorter text for X, hashtags for Instagram).

### Toolkits
Embeddable bundles of content with share buttons for each platform. Drop the embed snippet into any website or email to let supporters share pre-drafted content to their own networks.

### Analytics
Every share and click is tracked. View breakdowns by platform, day, content item, and campaign. IP addresses are hashed for privacy.

## Quick Start

### 1. Install dependencies

```bash
cd social-amplifier
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your platform API credentials
```

### 3. Run database migrations

```bash
npm run db:migrate
```

### 4. Start the server

```bash
# Development (with hot reload)
npm run dev

# Production
npm run build && npm start
```

### 5. Create a campaign

```bash
# Create an organization
curl -X POST http://localhost:3000/api/organizations \
  -H 'Content-Type: application/json' \
  -d '{"name": "My Campaign", "slug": "my-campaign"}'

# Create a campaign
curl -X POST http://localhost:3000/api/organizations/{ORG_ID}/campaigns \
  -H 'Content-Type: application/json' \
  -d '{"name": "GOTV Push", "slug": "gotv-push", "description": "Get out the vote for November"}'

# Add content
curl -X POST http://localhost:3000/api/campaigns/{CAMPAIGN_ID}/content \
  -H 'Content-Type: application/json' \
  -d '{"title": "Register to vote!", "body": "Make your voice heard...", "type": "text", "link_url": "https://vote.org"}'

# Create a share toolkit
curl -X POST http://localhost:3000/api/campaigns/{CAMPAIGN_ID}/toolkits \
  -H 'Content-Type: application/json' \
  -d '{"name": "Voter Reg Toolkit", "slug": "voter-reg", "content_ids": ["{CONTENT_ID}"]}'

# Get the embed code
curl http://localhost:3000/api/share/toolkit/{TOOLKIT_ID}/embed
```

### 6. Embed in your website

```html
<div id="sa-toolkit-{TOOLKIT_ID}"></div>
<script src="http://localhost:3000/embed/toolkit.js"
        data-toolkit-id="{TOOLKIT_ID}"
        data-api="http://localhost:3000"
        async></script>
```

## Platform Setup

### Facebook & Instagram

1. Create a [Meta Developer App](https://developers.facebook.com/apps/)
2. Add "Facebook Login" product
3. Set redirect URI to `{BASE_URL}/api/auth/facebook/callback`
4. For Instagram: connect a Facebook Page with an Instagram Business account
5. Copy App ID and App Secret to `.env`

### X (Twitter)

1. Create a project at [X Developer Portal](https://developer.x.com/en/portal/dashboard)
2. Enable OAuth 2.0 with PKCE
3. Set callback URL to `{BASE_URL}/api/auth/x/callback`
4. Copy Client ID and Client Secret to `.env`

### TikTok

1. Register at [TikTok Developer Portal](https://developers.tiktok.com/)
2. Create an app with "Content Posting API" scope
3. Set redirect URI to `{BASE_URL}/api/auth/tiktok/callback`
4. Copy Client Key and Client Secret to `.env`

> **Note:** Platforms work in "share URL" mode even without API credentials configured. The OAuth integration enables direct posting on behalf of connected supporters.

## API Reference

### Organizations
- `POST /api/organizations` — Create organization
- `GET /api/organizations/:slug` — Get by slug

### Campaigns
- `GET /api/organizations/:orgId/campaigns` — List campaigns
- `POST /api/organizations/:orgId/campaigns` — Create campaign
- `GET /api/campaigns/:id` — Get campaign
- `PATCH /api/campaigns/:id/status` — Update status (draft/active/paused/ended)

### Content
- `GET /api/campaigns/:id/content` — List content
- `POST /api/campaigns/:id/content` — Create content item
- `PATCH /api/content/:id` — Update content
- `DELETE /api/content/:id` — Delete content

### Toolkits
- `GET /api/campaigns/:id/toolkits` — List toolkits
- `POST /api/campaigns/:id/toolkits` — Create toolkit
- `GET /api/toolkits/:id` — Get toolkit with content

### Analytics
- `POST /api/analytics/share` — Record share event
- `POST /api/analytics/click` — Record click event
- `GET /api/analytics/campaigns/:id/summary?days=30` — Campaign summary
- `GET /api/analytics/toolkits/:id/summary?days=30` — Toolkit summary

### Public / Embed
- `GET /api/share/toolkit/:id` — Toolkit data (for embed widget)
- `GET /api/share/toolkit/:id/embed` — Get embed HTML snippet
- `GET /api/share/r/:shareId` — Click-tracking redirect

### Auth
- `GET /api/auth/:platform/connect` — Start OAuth flow
- `GET /api/auth/:platform/callback` — OAuth callback
- `GET /api/auth/status` — Platform configuration status

## Tech Stack

- **Runtime:** Node.js + TypeScript
- **Framework:** Express
- **Database:** SQLite (via better-sqlite3) — zero-config, file-based
- **Validation:** Zod
- **Security:** Helmet, CORS, rate limiting, IP hashing
- **Embed:** Vanilla JS widget (no framework dependencies)
