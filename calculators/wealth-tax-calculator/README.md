# Billionaire Wealth Tax Calculator

A calculator that shows potential tax revenue from billionaires at different tax rates (1%-8%), based on the 2026 estimate of **$15.3 trillion** in billionaire wealth from the Institute for Policy Studies.

## Overview

This tool is designed for political campaigns and educational websites to help citizens understand the potential revenue from taxing billionaire wealth at various rates. It provides:

- **Interactive calculator** with tax rates from 1% to 8%
- **Real-world comparisons** showing what the revenue could fund
- **Sourced data** with footnotes to official government documents
- **WordPress plugin** with shortcode integration

## Features

- 📊 **Interactive slider** for selecting tax rates
- 💰 **Live calculations** showing potential annual revenue
- 📚 **Contextual comparisons** to federal programs (Education, Veterans Affairs, Medicare, etc.)
- 🔗 **Source citations** with links to official government data
- 📱 **Mobile-responsive** design for all devices
- 🔌 **WordPress integration** via shortcode with auto-updates
- ⚡ **Optimized performance** with server-side data injection and caching
- 🔒 **Security-hardened** with XSS prevention

## Installation

See the [WordPress plugin README](wordpress/README.md) for complete installation, configuration, and build instructions.

**Quick start:**
1. Download or build `wealth-tax-calculator.zip`
2. Upload via **WordPress Admin → Plugins → Add New → Upload Plugin**
3. Activate and use shortcode: `[billionaire_wealth_tax]`

**For developers:** The plugin includes an npm build system for minification and automated releases. See [wordpress/README.md](wordpress/README.md) for details.

## How It Works

### The Calculation

The calculator uses a simple formula:

```
Annual Revenue = Billionaire Wealth × (Tax Rate / 100)
Annual Revenue = $15.3 trillion × (Tax Rate / 100)
```

**Example:** A 2% tax on $15.3 trillion = $306 billion in annual revenue

### Data Sources

1. **Billionaire Wealth Estimate ($15.3 trillion)**
   - Source: [Distribution of Income by Source, U.S. Department of the Treasury (2024)](https://home.treasury.gov/system/files/131/Distribution-of-Income-by-Source-2024.pdf)

2. **Spending Comparisons**
   - Department of Education Budget: [ED.gov FY 2024 Budget](https://www2.ed.gov/about/overview/budget/budget24/index.html)
   - Department of Veterans Affairs: [VA.gov Budget Products](https://www.va.gov/budget/products.asp)
   - Medicare Spending: [CMS National Health Expenditure Data](https://www.cms.gov/data-research/statistics-trends-and-reports/national-health-expenditure-data)
   - Medicaid and CHIP: [Medicaid.gov Financial Management](https://www.medicaid.gov/medicaid/financial-management/index.html)
   - Federal Discretionary Budget: [Congressional Budget Office](https://www.cbo.gov/topics/budget)

### Comparison Logic

The calculator automatically selects relevant spending comparisons based on the calculated revenue:

| Revenue Range | Comparison |
|---------------|------------|
| $0 - $200B | Department of Education budget |
| $200B - $400B | Department of Veterans Affairs budget |
| $400B - $700B | Medicare spending |
| $700B - $1T | Medicaid and CHIP programs |
| $1T+ | Federal discretionary budget |

## File Structure

```
calculators/wealth-tax-calculator/
├── README.md                           # This file
└── wordpress/
    └── wealth-tax-calculator/         # ← upload this folder via SFTP
        ├── wealth-tax-calculator.php  # WordPress plugin entry point
        ├── css/
        │   └── styles.css             # WP-safe styles (no body overrides)
        ├── js/
        │   └── calculator.js          # WP-aware JS (uses localized data URL)
        └── data/
            └── comparisons.json       # Spending comparison data
```

## Customization

See [wordpress/README.md](wordpress/README.md) for customization instructions including updating comparison data, changing the tax rate range, and styling.


## License

GPL v2 or later - See [WordPress License](https://www.gnu.org/licenses/gpl-2.0.html)

## Contributing

This is part of the [Molotools](https://github.com/hexa-decim8/Molotools) suite of political campaign tools. Contributions are welcome!

## Support

For issues or questions:
1. Check the [Molotools repository](https://github.com/hexa-decim8/Molotools/issues)
2. Review the source citations for data accuracy
3. Test in your environment before deploying to production

## Version History

- **1.1.0** (February 2026)
  - Rebuilt WordPress plugin as a proper self-contained folder (`wordpress/wealth-tax-calculator/`)
  - Fixed asset URL resolution in the plugin (was broken in 1.0.0)
  - Fixed JS to use WordPress-localized data URL instead of a relative path
  - Scoped all CSS to `.calculator-container` to prevent theme conflicts
  - Prefixed all DOM element IDs with `wtc-` to prevent page collisions
  - Added SFTP deployment instructions

- **1.0.0** (January 2026)
  - Initial release
  - WordPress plugin integration
  - Sourced comparison data
  - Mobile-responsive design

---

**Built with ❤️ for political campaigns committed to economic justice**
