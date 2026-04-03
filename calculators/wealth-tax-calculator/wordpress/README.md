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
| `npm run release` | Build and show release instructions |

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

The plugin includes a self-contained GitHub update checker. When you publish a new GitHub Release, WordPress will automatically detect it and show an "Update Available" notice.

### Release Process

1. **Update version number** in `wealth-tax-calculator/wealth-tax-calculator.php`:
   
   ```php
   * Version: 1.2.0  // Line 6 in plugin header
   
   define( 'WTC_VERSION', '1.2.0' ); // Line ~26
   ```

2. **Update `CHANGELOG.md`** with new version details

3. **Build the release**:
   ```bash
   npm run build
   ```
   
   This creates `wealth-tax-calculator.zip` ready for upload

4. **Commit and push** all changes to `main`:
   ```bash
   git add .
   git commit -m "Release v1.2.0"
   git push origin main
   ```

5. **Create a GitHub Release**:
   - Go to [github.com/hexa-decim8/Molotools/releases/new](https://github.com/hexa-decim8/Molotools/releases/new)
   - **Tag**: `v1.2.0` (must match version in plugin file)
   - **Title**: `Wealth Tax Calculator v1.2.0`
   - **Description**: Copy relevant section from CHANGELOG.md
   - **Attach**: Upload `wealth-tax-calculator.zip` as a release asset
     - ⚠️ **Important**: File must be named **exactly** `wealth-tax-calculator.zip`
   - Click **Publish release**

6. **Verify auto-update**:
   - WordPress sites with the plugin installed will see "Update Available" within 12 hours
   - Or immediately after deactivating/reactivating the plugin
   - Admin can click "Update Now" for one-click update

### Version Management

The plugin version is defined in **one place** using PHP constants:

```php
define( 'WTC_VERSION', '1.2.0' );
```

This constant is referenced throughout the plugin for:
- Asset versioning (cache busting)
- GitHub updater version checking
- Transient cache keys

**Manual sync required**: The plugin header comment (line 6) must still be updated manually to match `WTC_VERSION`.

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

// Cache duration for comparison data
define( 'WTC_CACHE_TTL', 12 * HOUR_IN_SECONDS ); // 12 hours
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

### Auto-Updates via GitHub
- Checks for new releases every 12 hours
- One-click updates from WordPress admin
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
3. **Wait 12 hours** or clear transient cache:
   ```php
   delete_transient('wtc_github_update_...');
   ```
4. **Deactivate and reactivate** plugin to force check

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
