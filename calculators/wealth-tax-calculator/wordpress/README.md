# WordPress Plugin - Wealth Tax Calculator

## Installation

### Option 1: Upload ZIP via WordPress Admin

1. Download `wealth-tax-calculator.zip` from the latest GitHub Release.
2. Go to WordPress Admin -> Plugins -> Add New -> Upload Plugin.
3. Upload the zip file and click Install Now.
4. Activate the plugin.
5. Add the shortcode to a page or post:

```text
[billionaire_wealth_tax]
```

Optional shortcode attributes:

```text
[billionaire_wealth_tax title="Wealth Tax Calculator" subtitle="See what taxing the ultra-rich could fund"]
```

### Option 2: Deploy via SFTP

Upload the entire `wealth-tax-calculator/` folder to your server's plugins directory:

```bash
cd /var/www/html/wp-content/plugins
# Upload folder so final path includes:
# wp-content/plugins/wealth-tax-calculator/wealth-tax-calculator.php
```

Then activate via WordPress Admin -> Plugins.

## Admin Settings and Auto-Updates

The plugin includes a settings page at WordPress Admin -> Settings -> Wealth Tax Updates.

Features:
- Current installed version and latest available version
- Optional auto-update toggle
- Manual "Check for Updates Now" action
- Last successful check, next scheduled check, and last updater error

Update behavior:
- Checks GitHub releases on a best-effort schedule
- Expects a release asset named `wealth-tax-calculator.zip`
- Supports one-click updates from the Plugins page

## Build and Release Model

This project no longer uses a local npm build system.

Builds are produced by GitHub Actions using the workflow in `.github/workflows/build-plugin.yml`.

What the workflow does:
- Resolves version from the release tag (or plugin header when needed)
- Validates version consistency between plugin header `Version` and `WTC_VERSION`
- Validates changelog entry for the release version
- Builds `wealth-tax-calculator.zip` directly in CI
- Uploads the zip as both a workflow artifact and GitHub Release asset

## Releasing Updates

1. Update plugin version values in `wealth-tax-calculator/wealth-tax-calculator.php`:

```php
* Version: 1.2.0
define( 'WTC_VERSION', '1.2.0' );
```

2. Update `wealth-tax-calculator/CHANGELOG.md` with a matching section header.

3. Commit and push to `main`.

4. Create and push a release tag:

```bash
git tag v1.2.0
git push origin v1.2.0
```

5. Let GitHub Actions publish/update the release and upload `wealth-tax-calculator.zip`.

## File Structure

```text
wordpress/
|- README.md
|- .gitignore
`- wealth-tax-calculator/
   |- wealth-tax-calculator.php
   |- uninstall.php
   |- CHANGELOG.md
   |- css/
   |  |- styles.css
   |  `- styles.min.css
   |- js/
   |  |- calculator.js
   |  |- calculator.min.js
   |  `- dragdealer.js
   `- data/
      `- comparisons.json
```

## Troubleshooting

### Update not appearing

1. Verify release tag format is `vX.Y.Z`.
2. Verify release asset is named `wealth-tax-calculator.zip`.
3. Check Settings -> Wealth Tax Updates for last updater error.
4. Use manual "Check for Updates Now".

### Calculator not displaying

1. Verify shortcode placement: `[billionaire_wealth_tax]`.
2. Check browser console for JavaScript errors.
3. Clear site and browser caches.
4. Verify `data/comparisons.json` is present.
