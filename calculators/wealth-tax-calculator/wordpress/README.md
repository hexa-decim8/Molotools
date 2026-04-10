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

This project uses deterministic npm tooling for minified asset generation.

Builds are produced by GitHub Actions using the workflow in `.github/workflows/build-plugin.yml`.

What the workflow does:
- Resolves version from the plugin header (or optional manual dispatch input)
- Validates version consistency between plugin header `Version` and `WTC_VERSION`
- Validates changelog entry for the release version
- Regenerates `js/calculator.min.js` and `css/styles.min.css` from source assets
- Builds `wealth-tax-calculator.zip` directly in CI
- Commits the rebuilt zip into the repository, replacing the previous zip build
- Commits refreshed minified assets when they changed
- Creates a semantic release tag in `vX.Y.Z` format
- Creates or updates the matching GitHub Release and uploads `wealth-tax-calculator.zip` as the release asset

Browser validation is handled by `.github/workflows/browser-validation.yml` and runs smoke tests against the approved matrix:
- Desktop Chromium
- Desktop Firefox
- Desktop WebKit (Safari engine)
- Mobile Chromium (Pixel 7 emulation)
- Mobile WebKit (iPhone 13 emulation)

The browser workflow validates calculator load, slider keyboard interaction, mode toggling behavior, and narrow-screen responsive layout before changes are merged.

It also runs a minified-asset parity check to ensure committed `.min.js` and `.min.css` files match generated output.

### Minified Asset Commands

From the repository root:

```bash
npm ci
npm run minify
```

To verify parity without keeping changes:

```bash
npm run minify:check
```

## Releasing Updates

1. Update plugin version values in `wealth-tax-calculator/wealth-tax-calculator.php`:

```php
* Version: 1.2.3
define( 'WTC_VERSION', '1.2.3' );
```

2. Update `wealth-tax-calculator/CHANGELOG.md` with a matching section header.

3. Regenerate minified assets:

```bash
npm ci
npm run minify
```

4. Commit and push to `main`.

5. Let GitHub Actions rebuild and commit `wealth-tax-calculator.zip`.

6. The workflow automatically creates the semantic release tag (`v1.2.0`, `v1.2.1`, `v1.2.2`, `v1.2.3`, etc.) for the new version.

   - If the target tag already exists on a different commit, the workflow now auto-increments the patch version (for example `1.2.3` -> `1.2.4`) and updates both plugin version fields plus changelog heading before publishing.

7. The workflow then creates or updates the GitHub Release and uploads `wealth-tax-calculator.zip` for updater compatibility.

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
