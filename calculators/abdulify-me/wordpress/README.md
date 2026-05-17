# WordPress Plugin - Abdulify Me

## Overview

Abdulify Me is a standalone WordPress plugin that lets users upload a photo, apply lightweight campaign-style effects in-browser, and download the modified image.

All image processing is client-side and does not persist uploads on the server.

The plugin also supports one-click updates to a Facebook Page profile picture after effects are applied.

## Installation

1. Download `abdulify-me.zip` from GitHub Releases.
2. Go to WordPress Admin -> Plugins -> Add New -> Upload Plugin.
3. Upload the zip file, install, and activate.
4. Add the shortcode to any page or post:

```text
[abdulify_me]
```

Optional attributes:

```text
[abdulify_me title="Abdulify Me" subtitle="Upload a photo and download a campaign-style version"]
```

## Facebook Page Avatar Setup

1. In WordPress Admin, open Settings -> Abdulify Me.
2. Enter a Facebook App ID (from your Meta app) and save.
3. Ensure your Meta app is configured for Facebook Login and allows this site domain/redirect URL.
4. In the widget, click Connect Facebook, sign in, choose a manageable Page, then click Set as Facebook Page Avatar.

Requested Facebook permissions:

- `pages_show_list`
- `pages_read_engagement`
- `pages_manage_metadata`

Notes:

- The one-click flow targets Facebook Pages. Personal profile avatar updates are not supported by Facebook Graph API create/update endpoints.
- The plugin does not store long-lived Facebook tokens server-side. Page access tokens are used during the active browser session.

## Color Inheritance and Overrides

By default, Abdulify Me inherits host page colors when matching CSS variables are present. This allows embeds to match the Abdul for Senate page palette without editing plugin source.

The plugin looks for these variables first, then uses built-in fallbacks:

- `--abdul-primary`, `--abdul-primary-strong`, `--abdul-accent`
- `--abdul-bg`, `--abdul-surface`, `--abdul-ink`, `--abdul-muted`, `--abdul-border`
- `--abdul-primary-contrast`, `--abdul-accent-contrast`
- `--abdul-status-info`, `--abdul-status-error`
- `--abdul-tint`, `--abdul-ribbon`, `--abdul-ribbon-contrast`
- `--abdul-badge-stroke`, `--abdul-badge-text`
- `--abdul-canvas-placeholder-bg`, `--abdul-canvas-placeholder-text`

Legacy/fallback aliases are also supported for primary theme tokens:

- `--afs-primary`, `--afs-primary-strong`, `--afs-accent`
- `--afs-bg`, `--afs-surface`, `--afs-ink`, `--afs-muted`, `--afs-border`

Example host override:

```css
:root {
   --abdul-primary: #233071;
   --abdul-primary-strong: #1b2559;
   --abdul-accent: #e1b682;
   --abdul-bg: #fbf0e4;
   --abdul-ink: #1e2433;
}
```

You can also override defaults in WordPress/PHP with filter hooks:

- `abdulify_me_tint_color`
- `abdulify_me_color_primary`
- `abdulify_me_color_primary_strong`
- `abdulify_me_color_accent`
- `abdulify_me_color_bg`
- `abdulify_me_color_surface`
- `abdulify_me_color_ink`
- `abdulify_me_color_muted`
- `abdulify_me_color_border`
- `abdulify_me_color_status_info`
- `abdulify_me_color_status_error`
- `abdulify_me_color_placeholder_bg`
- `abdulify_me_color_placeholder_text`
- `abdulify_me_color_ribbon`
- `abdulify_me_color_ribbon_text`
- `abdulify_me_color_badge_stroke`
- `abdulify_me_color_badge_text`
- `abdulify_me_color_tint`

## Privacy Model

- Uploaded files are handled in the browser via Canvas APIs.
- The plugin does not upload image files to WordPress media storage.
- No server-side image processing is performed.
- For Facebook Page avatar updates, an image payload is posted to WordPress AJAX and forwarded to Facebook. A temporary server file is created only for the upload request and then deleted.

## Updates

The plugin includes a built-in GitHub updater and does not require any extra update plugin.

Update behavior:
- Checks GitHub releases on a best-effort 5-minute WP-Cron schedule.
- Expects a release asset named `abdulify-me.zip`.
- Shows updates on the WordPress Plugins page when a newer release is available.
- Supports automatic installation through WordPress auto-update flow for this plugin.

Notes:
- Because update checks use WP-Cron, timing depends on site traffic unless server cron is configured.
- There is no dedicated Abdulify settings page for updates; updates are managed through the Plugins page.

## Minified Asset Commands

From repository root:

```bash
npm ci
npm run minify
npm run minify:check
```

## File Structure

```text
wordpress/
|- README.md
`- abdulify-me/
   |- abdulify-me.php
   |- uninstall.php
   |- CHANGELOG.md
   |- css/
   |  |- abdulify-me.css
   |  `- abdulify-me.min.css
   `- js/
      |- abdulify-me.js
      `- abdulify-me.min.js
```

## Troubleshooting

### Update not appearing

1. Verify release tag is a valid version format (`am-vX.Y.Z` or `vX.Y.Z`).
2. Verify the release contains an asset named `abdulify-me.zip`.
3. Confirm the plugin folder path is `wp-content/plugins/abdulify-me/abdulify-me.php`.
4. Clear site object cache/transients if your host aggressively caches update data.
