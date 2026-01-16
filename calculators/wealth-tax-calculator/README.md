# Billionaire Wealth Tax Calculator

A calculator that shows potential tax revenue from billionaires at different tax rates (1%-8%), based on the 2024 estimate of **$15.3 trillion** in billionaire wealth from the U.S. Department of the Treasury.

## Overview

This tool is designed for political campaigns and educational websites to help citizens understand the potential revenue from taxing billionaire wealth at various rates. It provides:

- **Interactive calculator** with tax rates from 1% to 8%
- **Real-world comparisons** showing what the revenue could fund
- **Sourced data** with footnotes to official government documents
- **Multiple versions**: Web interface, WordPress plugin, and command-line tool

## Features

- 📊 **Interactive slider** for selecting tax rates
- 💰 **Live calculations** showing potential annual revenue
- 📚 **Contextual comparisons** to federal programs (Education, Veterans Affairs, Medicare, etc.)
- 🔗 **Source citations** with links to official government data
- 📱 **Mobile-responsive** design for all devices
- 🔌 **WordPress integration** via shortcode

## Installation

### Using the Web Interface

1. Open [index.html](index.html) in a web browser
2. Adjust the tax rate slider to see different revenue scenarios
3. The calculator works entirely in the browser - no server required

### WordPress Installation

#### Option 1: As a Plugin (Recommended)

1. Copy the entire `calculators/wealth-tax-calculator` directory to your WordPress plugins folder:
   ```
   wp-content/plugins/wealth-tax-calculator/
   ```

2. In your WordPress admin panel:
   - Go to **Plugins** → **Installed Plugins**
   - Find "Billionaire Wealth Tax Calculator"
   - Click **Activate**

3. Add the calculator to any page or post using the shortcode:
   ```
   [billionaire_wealth_tax]
   ```

4. Optional: Customize the shortcode with attributes:
   ```
   [billionaire_wealth_tax title="Tax the Rich" subtitle="See what we could fund"]
   ```

#### Option 2: Direct Embed

If you prefer not to install a plugin, you can embed the calculator directly:

1. Upload the calculator files to your WordPress site (via FTP or file manager)
2. Create a custom HTML block in your page/post
3. Use an iframe to embed the calculator:
   ```html
   <iframe src="/path/to/calculators/wealth-tax-calculator/index.html" 
           width="100%" 
           height="800px" 
           frameborder="0">
   </iframe>
   ```

### Command-Line Tool

To use the bash CLI version for testing:

1. Navigate to the calculator directory:
   ```bash
   cd calculators/wealth-tax-calculator
   ```

2. Make the script executable (if not already):
   ```bash
   chmod +x wealth-tax-cli.sh
   ```

3. Run the calculator:
   ```bash
   ./wealth-tax-cli.sh
   ```

4. Enter tax rates (1-8) to see calculations, or type 'q' to quit

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
├── index.html                      # Main web interface
├── wealth-tax-cli.sh              # Command-line version
├── README.md                       # This file
├── css/
│   └── styles.css                 # Stylesheet for web interface
├── js/
│   └── calculator.js              # JavaScript calculation logic
├── data/
│   └── comparisons.json           # Spending comparison data with sources
└── wordpress/
    └── wealth-tax-widget.php      # WordPress plugin file
```

## Customization

### Updating Comparison Data

To add or modify spending comparisons, edit [data/comparisons.json](data/comparisons.json):

```json
{
  "comparisons": [
    {
      "minRevenue": 0,
      "maxRevenue": 200000000000,
      "description": "Your comparison text here",
      "amount": 79600000000,
      "sourceText": "Source name",
      "sourceUrl": "https://source-url.gov"
    }
  ]
}
```

### Changing Tax Rate Range

To adjust the available tax rate range:

1. **Web version:** Edit the `min` and `max` attributes in [index.html](index.html):
   ```html
   <input type="range" id="taxRate" min="1" max="8" ... >
   ```

2. **CLI version:** Edit the validation logic in [wealth-tax-cli.sh](wealth-tax-cli.sh):
   ```bash
   if (( $(echo "$tax_rate < 1" | bc -l) )) || (( $(echo "$tax_rate > 8" | bc -l) )); then
   ```

### Styling

The web interface uses a purple gradient theme. To customize colors, edit [css/styles.css](css/styles.css):

```css
/* Main gradient */
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);

/* Primary color */
color: #667eea;
```

## Browser Compatibility

The web calculator works in all modern browsers:
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Opera 76+

For older browsers, the calculator will still function but may have reduced visual styling.

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

- **1.0.0** (January 2026)
  - Initial release
  - Web interface with interactive slider
  - WordPress plugin integration
  - Command-line bash tool
  - Sourced comparison data
  - Mobile-responsive design

---

**Built with ❤️ for political campaigns committed to economic justice**
