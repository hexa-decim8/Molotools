# Changelog

All notable changes to the Billionaire Wealth Tax Calculator WordPress plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

### 1.2.0
**Major performance and security update.** Updates billionaire wealth data to $15.3 trillion (2026 estimate). Eliminates external data loading for faster page loads. Adds build system for developers. Requires WordPress 5.0+ and PHP 7.4+.

### 1.1.0
Adds GitHub auto-updates and policy allocation features. No breaking changes.

### 1.0.0
Initial release.
