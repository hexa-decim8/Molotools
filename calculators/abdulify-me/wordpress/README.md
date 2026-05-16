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
