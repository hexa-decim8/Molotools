# WordPress Plugin - Abdulify Me

## Overview

Abdulify Me is a standalone WordPress plugin that lets users upload a photo, apply lightweight campaign-style effects in-browser, and download the modified image.

All image processing is client-side and does not persist uploads on the server.

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

## Privacy Model

- Uploaded files are handled in the browser via Canvas APIs.
- The plugin does not upload image files to WordPress media storage.
- No server-side image processing is performed.

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
