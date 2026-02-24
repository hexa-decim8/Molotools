# WordPress Plugin — Wealth Tax Calculator

## Installation

1. Upload `wealth-tax-calculator.zip` via **WordPress Admin → Plugins → Add New → Upload Plugin**
2. Activate the plugin
3. Add the shortcode to any page or post:
   ```
   [billionaire_wealth_tax]
   ```
   Optional attributes:
   ```
   [billionaire_wealth_tax title="Wealth Tax Calculator" subtitle="See what taxing the ultra-rich could fund"]
   ```

---

## Releasing Updates

The plugin includes a self-contained GitHub update checker. When a new GitHub Release is published with a zip asset, WordPress will display an "Update Available" notice and allow one-click updating — no extra plugins required.

### Steps to publish an update

1. **Make your changes** to the plugin source files in `wealth-tax-calculator/`

2. **Bump the version number** in two places inside `wealth-tax-calculator/wealth-tax-calculator.php`:

   - The plugin header (near the top of the file):
     ```php
     * Version: 1.2.0
     ```
   - The updater constructor (near the bottom of the file):
     ```php
     new WTC_GitHub_Updater(
         'wealth-tax-calculator/wealth-tax-calculator.php',
         'hexa-decim8/Molotools',
         '1.2.0'   // ← update this to match
     );
     ```

3. **Rebuild the zip** from this directory (`wordpress/`):
   ```powershell
   Compress-Archive -Path "wealth-tax-calculator" -DestinationPath "wealth-tax-calculator.zip" -Force
   ```

4. **Commit and push** to `main`

5. **Create a GitHub Release**:
   - Go to [github.com/hexa-decim8/Molotools/releases/new](https://github.com/hexa-decim8/Molotools/releases/new)
   - Set the tag to match the version, e.g. `v1.2.0`
   - Attach `wealth-tax-calculator.zip` as a release asset — the updater looks for an asset with **exactly that filename**
   - Publish the release

WordPress sites with the plugin installed will show **"Update Available"** within 12 hours, or immediately after deactivating and reactivating the plugin.

---

## File Structure

```
wordpress/
├── README.md                          ← this file
├── wealth-tax-calculator.zip          ← upload this to WordPress
└── wealth-tax-calculator/             ← plugin source (SFTP to wp-content/plugins/)
    ├── wealth-tax-calculator.php      ← plugin entry point + update checker
    ├── css/
    │   └── styles.css
    ├── js/
    │   └── calculator.js
    └── data/
        └── comparisons.json
```
