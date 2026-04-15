# Changelog

All notable changes to the Billionaire Wealth Tax Calculator WordPress plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.4.6] - 2026-04-15


## [1.4.5] - 2026-04-14


## [1.4.4] - 2026-04-14


## [1.4.3] - 2026-04-14


## [1.4.2] - 2026-04-14


## [1.4.1] - 2026-04-14


## [1.4.0] - 2026-04-14

## [1.3.31] - 2026-04-14


## [1.3.30] - 2026-04-14


## [1.3.29] - 2026-04-14


## [1.3.28] - 2026-04-14


## [1.3.27] - 2026-04-14


## [1.3.26] - 2026-04-14


## [1.3.25] - 2026-04-14


## [1.3.24] - 2026-04-14


## [1.3.23] - 2026-04-14


## [1.3.22] - 2026-04-14


## [1.3.21] - 2026-04-14


## [1.3.20] - 2026-04-14


### Changed
- Expanded policy prioritization analytics to store each submitted sub-policy with its exact rank, human-readable label, description, and funding snapshot instead of only a raw ordered key list.
- Expanded the WordPress analytics report with full rank breakdowns and recent submission detail so final policy prioritization can be reviewed session by session.

## [1.3.19] - 2026-04-14


## [1.3.18] - 2026-04-14


## [1.3.17] - 2026-04-14


## [1.3.16] - 2026-04-14


## [1.3.15] - 2026-04-14


## [1.3.14] - 2026-04-14


## [1.3.13] - 2026-04-14


## [1.3.12] - 2026-04-14


## [1.3.11] - 2026-04-13


## [1.3.10] - 2026-04-13


## [1.3.9] - 2026-04-13


## [1.3.8] - 2026-04-13


## [1.3.7] - 2026-04-13


## [1.3.6] - 2026-04-12


## [1.3.5] - 2026-04-10


## [1.3.4] - 2026-04-10


## [1.3.3] - 2026-04-10


## [1.3.2] - 2026-04-10


## [1.3.1] - 2026-04-10


## [1.3.0] - 2026-04-08

## [1.2.36] - 2026-04-09


## [1.2.35] - 2026-04-09


## [1.2.34] - 2026-04-09


## [1.2.33] - 2026-04-09


## [1.2.32] - 2026-04-09


## [1.2.31] - 2026-04-09


## [1.2.30] - 2026-04-09


## [1.2.29] - 2026-04-09


## [1.2.28] - 2026-04-09


## [1.2.27] - 2026-04-09


## [1.2.26] - 2026-04-09


## [1.2.25] - 2026-04-09


## [1.2.24] - 2026-04-09


## [1.2.23] - 2026-04-09


## [1.2.22] - 2026-04-08


## [1.2.21] - 2026-04-08


### Changed
- Updated the "What could this fund?" list to show a single best-fit bundle of policies whose combined cost is as close as possible to the selected tax revenue without exceeding it.
- Policy bundle matching now uses each policy's minimum cost (for ranged items) and shows an explicit unallocated remainder when exact matching is not possible.
- Sources in this section are now scoped to only the policies included in the displayed bundle.
- Advanced mode no longer displays per-policy-group total assigned revenue values on the same line as each policy group/dropdown.
- Advanced mode sub-policy controls now use animated plus/minus checkbox buttons and no longer show bottom-edge range sliders.
- Added share actions at both the top and bottom of the calculator for Copy Link, Email, LinkedIn, X, Facebook, and Bluesky using the live shortcode page URL.

## [1.2.20] - 2026-04-06


## [1.2.19] - 2026-04-05

### Changed
- Advanced mode sub-policy rows: replaced rocker toggle with click-to-enable interaction. Single click (or tap) anywhere in a row enables it; clicking again disables it.
- Each enabled sub-policy row now displays a range input along the bottom edge. Dragging the range adjusts funding from $0 to the policy's full cost; initial value is set to the policy's minimum amount.
- Enabled rows fill left-to-right with a per-category accent color as the range increases, using the fill animation approach from the reference design.
- Budget summary updates live as the range is dragged without requiring a full re-render.
- Removed `margin-left` offset on `.policy-option-meta` that previously compensated for the rocker switch width.

## [1.2.18] - 2026-04-05


## [1.2.17] - 2026-04-05


## [1.2.16] - 2026-04-05


## [1.2.15] - 2026-04-05


## [1.2.14] - 2026-04-05


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
