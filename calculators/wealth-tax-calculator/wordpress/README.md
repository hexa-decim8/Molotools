# WordPress Plugin — Wealth Tax Calculator

## Installation

### Option 1: Upload ZIP via WordPress Admin (Recommended for Users)

1. Download or build `wealth-tax-calculator.zip` (see [Releasing Updates](#releasing-updates) below)
2. Go to **WordPress Admin → Plugins → Add New → Upload Plugin**
3. Upload the zip file and click **Install Now**
4. Activate the plugin
5. Add the shortcode to any page or post:
   ```
   [billionaire_wealth_tax]
   ```
   
**Optional shortcode attributes:**
```
[billionaire_wealth_tax title="Wealth Tax Calculator" subtitle="See what taxing the ultra-rich could fund"]
```

### Option 2: Deploy via SFTP

Upload the **entire `wealth-tax-calculator/` folder** to your server's plugins directory:

```bash
# On your server
cd /var/www/html/wp-content/plugins

# Upload the folder via SFTP
# Ensure the structure is:
# wp-content/plugins/wealth-tax-calculator/wealth-tax-calculator.php
```

Then activate via **WordPress Admin → Plugins**.

---

## Admin Settings & Auto-Updates

The plugin includes a dedicated settings page for managing updates.

### Accessing Settings

Go to **WordPress Admin → Settings → Wealth Tax Updates**

### Features

#### Version Information
- View current installed version
- See if updates are available
- Check latest version from GitHub
- Visual indicators:
  - ✓ Green checkmark when up to date
  - ⚠️ Red warning when update available

#### Automatic Updates
- **Enable/Disable Auto-Updates**: Toggle automatic updates on or off
- When enabled, the plugin checks GitHub roughly every 5 minutes and installs a newer release during the next scheduled run
- Integrates with WordPress's native update APIs while using its own plugin-specific schedule
- Exact timing depends on WP-Cron unless the host runs a real server cron

#### Manual Update Check
- **"Check for Updates Now"** button forces an immediate check
- Clears cached update data and queries GitHub API
- Useful when you know a new release is available but WordPress hasn't checked yet
- Shows success notification after check completes

#### Update Process
- Updates are fetched from GitHub releases on a best-effort 5-minute schedule
- Release must include `wealth-tax-calculator.zip` as an asset
- One-click update from WordPress Plugins page when available
- Direct link from settings page to Plugins page when update is ready
- The settings page shows the last successful check, next scheduled check, and last updater error

### Configuring Auto-Updates

1. Navigate to **Settings → Wealth Tax Updates**
2. Check the box "Enable automatic updates for this plugin"
3. Click **Save Settings**
4. Plugin will now update automatically when new versions are released

**Note**: If auto-updates are disabled (default), scheduled checks still discover new releases, but you'll need to update from the Plugins page manually.

---

## Development & Build System

### Prerequisites

- Node.js 14+ and npm
- WordPress 5.0+ (for testing)
- PHP 7.4+

### Initial Setup

```bash
cd calculators/wealth-tax-calculator/wordpress
npm install
```

This installs the build dependencies:
- `terser` — JavaScript minification
- `clean-css-cli` — CSS minification
- `archiver` — Zip file creation

### Available Commands

| Command | Description |
|---------|-------------|
| `npm run minify` | Minify JS and CSS files |
| `npm run minify:js` | Minify JavaScript only |
| `npm run minify:css` | Minify CSS only |
| `npm run zip` | Create `wealth-tax-calculator.zip` |
| `npm run build` | Minify + create zip (full build) |
| `npm run release` | Build and show the tag-driven release checklist |

### Development Workflow

1. **Make changes** to source files in `wealth-tax-calculator/`
   - `js/calculator.js` — JavaScript (not the .min.js file)
   - `css/styles.css` — CSS (not the .min.css file)
   - `wealth-tax-calculator.php` — PHP plugin code

2. **Test locally** with `WP_DEBUG` enabled (uses source files automatically)

3. **Build for production**:
   ```bash
   npm run build
   ```
   This creates minified files and `wealth-tax-calculator.zip`

4. **Test the production build** in a staging environment

---

## Releasing Updates

The plugin includes a self-contained GitHub update checker. When you publish a tagged GitHub Release with a valid zip asset, installed sites will pick it up on the next scheduled check.

### Release Process

1. **Update all version sources** so they match the release you are about to tag:
   
   ```php
   * Version: 1.2.0  // Line 6 in plugin header
   
   define( 'WTC_VERSION', '1.2.0' ); // Line ~26
   ```

   Also update `package.json` to the same version.

2. **Update `CHANGELOG.md`** with new version details

3. **Build the release**:
   ```bash
   npm run build
   ```
   
   This creates `wealth-tax-calculator.zip` ready for upload

4. **Commit and push** all versioned changes to `main`:
   ```bash
   git add .
   git commit -m "Release v1.2.0"
   git push origin main
   ```

5. **Create and push the release tag**:
   ```bash
   git tag v1.2.0
   git push origin v1.2.0
   ```

6. **Let GitHub Actions publish the release**:
   - The workflow in `.github/workflows/build-plugin.yml` runs on the pushed tag
   - It validates `package.json`, the plugin header, `WTC_VERSION`, and `CHANGELOG.md`
   - It runs `npm ci` and `npm run build`
   - It creates or updates the GitHub Release and uploads `wealth-tax-calculator.zip`

7. **Verify auto-update**:
   - WordPress sites with the plugin installed should detect the release on the next scheduled check
   - On regular hosting, this is best-effort and depends on WP-Cron traffic
   - Admins can still use "Check for Updates Now" for an immediate refresh

### Version Management

The release workflow expects these version sources to stay in sync:

```php
define( 'WTC_VERSION', '1.2.0' );
```

This constant is referenced throughout the plugin for:
- Asset versioning (cache busting)
- GitHub updater version checking
- Transient cache keys

Keep these in sync before tagging a release:
- `wealth-tax-calculator/wealth-tax-calculator.php` plugin header `Version`
- `wealth-tax-calculator/wealth-tax-calculator.php` `WTC_VERSION`
- `package.json` `version`
- `wealth-tax-calculator/CHANGELOG.md` section heading

---

## Configuration Constants

Plugin behavior can be customized by editing constants in `wealth-tax-calculator.php`:

```php
// Plugin version
define( 'WTC_VERSION', '1.2.0' );

// Billionaire wealth amount (in dollars)
define( 'WTC_BILLIONAIRE_WEALTH', 15.3e12 ); // $15.3 trillion

// Tax rate range
define( 'WTC_TAX_RATE_MIN', 1 );  // 1%
define( 'WTC_TAX_RATE_MAX', 8 );  // 8%

// GitHub release metadata cache duration
define( 'WTC_CACHE_TTL', 5 * MINUTE_IN_SECONDS );
```

**Note**: After changing `WTC_BILLIONAIRE_WEALTH` or tax rates, update the HTML in `render_calculator()` to match.

---

## File Structure

```
wordpress/
├── README.md                           ← This file
├── package.json                        ← npm build configuration
├── build.js                            ← Zip creation script
├── .gitignore                          ← Excludes node_modules, zips
└── wealth-tax-calculator/              ← Plugin source (deploy this folder)
    ├── wealth-tax-calculator.php       ← Main plugin file
    ├── uninstall.php                   ← Cleanup on uninstall
    ├── CHANGELOG.md                    ← Version history
    ├── css/
    │   ├── styles.css                  ← Source CSS
    │   └── styles.min.css              ← Minified CSS (auto-generated)
    ├── js/
    │   ├── calculator.js               ← Source JavaScript
    │   └── calculator.min.js           ← Minified JS (auto-generated)
    └── data/
        └── comparisons.json            ← Comparison data
```

---

## Features

### Admin Settings Page
- Dedicated settings page under **Settings → Wealth Tax Updates**
- View current and latest available versions
- Enable/disable automatic updates
- Manual "Check for Updates Now" button
- Visual update status indicators
- Direct links to GitHub repository

### Auto-Updates via GitHub
- Checks for new releases on a best-effort 5-minute schedule
- One-click updates from WordPress admin
- Optional automatic installation of updates
- Integrates with WordPress native update system
- No external plugins required

### Performance Optimizations
- Server-side data injection (no AJAX requests)
- WordPress transient caching (30-day cache)
- Minified assets for production
- Debug mode support (uses source files when `WP_DEBUG` enabled)

### Security
- URL sanitization to prevent XSS
- Proper HTML escaping
- ABSPATH checks
- Safe uninstall with cleanup

### WordPress Standards
- Activation/deactivation hooks
- Proper uninstall cleanup
- Shortcode API integration
- Conditional asset loading

---

## Troubleshooting

### "Update Available" not showing

1. **Verify release tag** matches plugin version exactly (`v1.2.0`)
2. **Check release asset** is named `wealth-tax-calculator.zip`
3. **Wait for the next scheduled run** or clear transient cache:
   ```php
   delete_transient('wtc_github_update_...');
   ```
4. **Check Settings → Wealth Tax Updates** for the last updater error and next scheduled check
5. **Deactivate and reactivate** plugin to reschedule checks if needed

### Minified files not updating

1. **Rebuild**: `npm run minify`
2. **Clear browser cache** (Ctrl+Shift+R / Cmd+Shift+R)
3. **Disable caching plugins** temporarily
4. **Check WP_DEBUG**: If enabled, source files are used instead

### Calculator not displaying

1. **Check shortcode**: Ensure `[billionaire_wealth_tax]` is on the page
2. **View console**: Check browser console for JavaScript errors
3. **Clear caches**: Clear WordPress cache and browser cache
4. **Verify data**: Ensure `data/comparisons.json` exists and is valid

---

## Support

For issues, feature requests, or contributions:
- **GitHub Issues**: [github.com/hexa-decim8/Molotools/issues](https://github.com/hexa-decim8/Molotools/issues)
- **Repository**: [github.com/hexa-decim8/Molotools](https://github.com/hexa-decim8/Molotools)

---

## License

GPL v2 or later. See LICENSE file in repository root.
