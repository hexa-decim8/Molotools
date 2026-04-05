# Changelog

All notable changes to the Billionaire Wealth Tax Calculator WordPress plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.2.13] - 2026-04-05


## [1.2.12] - 2026-04-05


## [1.2.11] - 2026-04-05


## [1.2.10] - 2026-04-05


## [1.2.9] - 2026-04-05


## [1.2.8] - 2026-04-05


## [1.2.7] - 2026-04-05


## [1.2.6] - 2026-04-05


## [1.2.5] - 2026-04-05


### Changed
- Improved mobile responsiveness across the calculator interface with refined breakpoints for typography, spacing, slider panel sizing, toggle controls, and advanced policy rows.
- Added equivalent responsive overrides to the production minified stylesheet so mobile behavior matches development builds.

## [1.2.4] - 2026-04-04


## [1.2.3] - 2026-04-04

### Changed
- Reverted the calculator layout to a fully vertical single-column flow across all screen sizes.

## [1.2.2] - 2026-04-04

### Changed
- Widened the calculator layout on large screens so the plugin makes better use of available desktop space.

### Fixed
- Unblocked release automation after `v1.2.1` had already been created on a different commit by bumping the plugin version for a fresh semantic tag.

## [1.2.1] - 2026-04-04

### Changed
- Rebuilt the GitHub Actions release workflow for deterministic WordPress packaging.
- The workflow now rebuilds `wealth-tax-calculator.zip` from plugin source and commits it back to `main`.
- Release tags now follow semantic format (`vX.Y.Z`) and are created automatically from the plugin version.

### Fixed
- Eliminated release drift where repository zip artifacts could become stale or missing.

### Added
- **Admin Settings Page**: New settings page under Settings > Wealth Tax Updates
  - View current version and latest available version
  - Manual "Check for Updates Now" button
  - Enable/disable automatic updates toggle
  - Repository link and update status information
  - Detailed explanation of how updates work
- **Auto-Update Control**: Option to enable automatic updates from GitHub
  - Integrates with WordPress's native auto-update system
  - Updates install automatically when enabled
  - Can be toggled on/off in the settings page
- **Manual Update Check**: Force update check without waiting for scheduled check
  - Clears update cache and forces fresh GitHub API call
  - Shows success notification after check completes
- **Admin Notifications**: Clear visual indicators for update availability
  - Green checkmark when up to date
  - Red warning when update is available
  - Direct link to Plugins page for updating

## [1.2.0] - 2026-04-03

### Added
- **Build system**: Automated npm build process with minification
  - `npm run build` creates production-ready minified files and zip
  - `npm run minify` minifies JavaScript and CSS
  - `npm run zip` creates `wealth-tax-calculator.zip` for GitHub releases
- **Plugin constants**: Centralized configuration with PHP constants
  - `WTC_VERSION` for version management (no more triple-hardcoding)
  - `WTC_BILLIONAIRE_WEALTH` for wealth amount
  - `WTC_TAX_RATE_MIN` and `WTC_TAX_RATE_MAX` for rate ranges
  - `WTC_CACHE_TTL` for cache duration
- **Performance optimizations**:
  - Server-side data injection via `wp_localize_script()` eliminates JSON fetch
  - WordPress transient caching for comparison data (30-day cache)
  - Minified CSS and JavaScript files for production use
  - Debug mode support (uses source files when `WP_DEBUG` is enabled)
- **WordPress standards compliance**:
  - `uninstall.php` for proper cleanup on plugin deletion
  - Activation hook to clear old caches
  - Enhanced plugin metadata (Requires, Requires PHP, Tested up to)
- **Security improvements**:
  - URL sanitization in JavaScript to prevent XSS attacks
  - Replaced `innerHTML` concatenation with DOM element creation
  - Proper HTML escaping for dynamic content
- **Developer experience**:
  - Comprehensive inline documentation
  - Error logging for JSON parsing failures
  - `.gitignore` for build artifacts

### Changed
- **Data update**: Updated billionaire wealth from $8.1 trillion to $15.3 trillion
  - Based on 2026 Institute for Policy Studies estimate
  - All calculations and display text updated accordingly
- **JavaScript architecture**: Removed AJAX request for comparisons.json
  - Data now injected directly from PHP (zero additional HTTP requests)
  - Cleaner, more maintainable code structure
- **Asset loading**: Conditional loading of minified vs source files
  - Production sites use `.min.js` and `.min.css`
  - Development sites (with `WP_DEBUG` enabled) use source files

### Fixed
- Version number consistency across plugin files
- Cache invalidation on plugin updates
- Memory leaks from duplicate event listeners
- Potential XSS vulnerabilities in dynamic HTML generation

### Performance
- **Before**: ~30KB JSON fetch on every page load with shortcode
- **After**: Zero additional HTTP requests, data bundled with script
- **File sizes**: 30-40% reduction with minification

## [1.1.0] - Previous Release

### Added
- GitHub auto-updater integration
- Mode toggle (Basic/Advanced)
- Policy allocation feature
- Responsive design improvements

### Changed
- Updated styling and branding
- Improved mobile experience

## [1.0.0] - Initial Release

### Added
- Initial release of Billionaire Wealth Tax Calculator
- Interactive tax rate slider (1%-8%)
- Real-time revenue calculations
- Contextual comparisons to federal programs
- Source citations with links
- WordPress shortcode `[billionaire_wealth_tax]`
- Customizable title and subtitle via shortcode attributes

---

## Upgrade Notice

### 1.2.3
Restores the calculator to a fully vertical single-column layout across all screen sizes.

### 1.2.2
Widens the calculator on large screens and bumps the release version so GitHub Actions can publish a fresh semantic tag.

### 1.2.1
Rebuilds release automation to always publish an up-to-date `wealth-tax-calculator.zip` in the repository and create standard semantic release tags.

### 1.2.0
**Major performance and security update.** Updates billionaire wealth data to $15.3 trillion (2026 estimate). Eliminates external data loading for faster page loads. Adds build system for developers. Requires WordPress 5.0+ and PHP 7.4+.

### 1.1.0
Adds GitHub auto-updates and policy allocation features. No breaking changes.

### 1.0.0
Initial release.
