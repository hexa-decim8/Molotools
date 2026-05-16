# Molotools
A suite of tools for political campaigns

## Projects

### [Social Amplifier](social-amplifier/)
A social media amplification platform for political campaigns. Create shareable content toolkits, distribute through supporter networks on Facebook, Instagram, X, and TikTok, and measure engagement in real time. Self-hosted alternative to platforms like SoSha.

### [Wealth Tax Calculator](calculators/wealth-tax-calculator/)
WordPress plugin with interactive wealth tax calculators and county-level data visualizations.

## Install Artifacts

Use the package that matches the runtime you are deploying:

| Project | Artifact | Install target | Installation method |
| --- | --- | --- | --- |
| Wealth Tax Calculator | `wealth-tax-calculator.zip` | WordPress | Upload in Plugins -> Add New -> Upload Plugin |
| Social Amplifier | `social-amplifier-server.zip` | Node.js host | Unzip on the server, run `npm install --omit=dev`, then start `node dist/index.js` |

Do not upload `social-amplifier-server.zip` through the WordPress plugin uploader. It is a Node.js application package, not a WordPress plugin.

---

## County Maps (Wealth Tax Calculator)

All 50 US state county maps are auto-generated from Census data and validated against a comprehensive contract specification.

### Rendering

County maps display in the wealth tax calculator admin dashboard, with proportional bubbles showing wealth distribution by county.

### Regenerating County SVGs

If you need to update county boundaries (e.g., new Census vintage or data source):

#### Prerequisites
```bash
# Install GDAL (required for shapefile→GeoJSON conversion)
brew install gdal

# Optional: Install mapshaper for geometry simplification
npm install -g mapshaper
```

#### Full Pipeline (1-2 hours)
```bash
cd scripts

# Step 1: Download Census TIGER/Line county data (1-2 hours)
node prepare-tiger-data.js
# Downloads shapefiles for all 50 states
# Converts to GeoJSON
# Simplifies geometry by 97% for web performance
# Saves to: tiger-geojson/{STATE}.geojson

# Step 2: Generate SVG files (5-15 minutes)
node generate-county-svgs.js
# Converts GeoJSON → SVGs
# Applies contract-compliant structure
# Outputs: ../calculators/wealth-tax-calculator/wordpress/wealth-tax-calculator/data/states/{state}/{state}-counties.svg

# Step 3: Validate (2-5 minutes)
node validate-county-svgs-simple.js
# 10-point contract compliance checks
# Should report: 0 errors, 100% pass rate
```

#### One-Batch Deployment
```bash
# After validation passes:
git add calculators/wealth-tax-calculator/wordpress/wealth-tax-calculator/data/states/
git commit -m "Update county SVGs: {reason, e.g., TIGER 2025 vintage}"
git tag -a "tiger-{YEAR}-v1" -m "County SVG update: {details}"
git push origin main
git push origin tiger-{YEAR}-v1
```

### Data Sources

- **TIGER/Line** (recommended): https://www.census.gov/geographies/mapping-files/
- **Natural Earth** (simplified): https://www.naturalearthdata.com/

### Contract Specification

See [scripts/COUNTY_SVG_CONTRACT.md](scripts/COUNTY_SVG_CONTRACT.md) for:
- Exact SVG schema requirements
- ID naming conventions
- Backwards compatibility guarantees
- Deployment history

### Documentation

- [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) — Full 9-phase roadmap
- [PHASE2_COMPLETION_REPORT.md](PHASE2_COMPLETION_REPORT.md) — Phase 2 execution details
- [scripts/SVG_GENERATION_GUIDE.md](scripts/SVG_GENERATION_GUIDE.md) — Technical implementation details
- [scripts/README_COUNTY_SVG_PIPELINE.md](scripts/README_COUNTY_SVG_PIPELINE.md) — Quick start guide

### Maintenance

County SVG generation is fully automated and deterministic:
- Same TIGER/Line vintage → identical output every time
- All validation is build-time (fails early if contract violated)
- No runtime surprises (all checks deterministic)

For annual updates: Run the full pipeline above, validate, and deploy.

---

## Development

### Prerequisites
- Node.js 14+
- GDAL (for shapefile conversion)
- npm

### Setup
```bash
npm install
```

### Scripts
```bash
# Generate county SVGs
node scripts/generate-county-svgs.js

# Validate SVGs
node scripts/validate-county-svgs-simple.js

# Generate county manifest
node scripts/generate-county-manifest.js > scripts/county-manifest.csv
```
