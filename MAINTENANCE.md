# County SVG Maintenance & Update Runbook

This document provides step-by-step instructions for updating county SVG maps.

**Typical use case**: Annual Census TIGER/Line vintage release (usually January)

---

## Quick Reference

| Task | Time | Frequency |
|------|------|-----------|
| Full update (download + generate + validate) | 2 hours | Annual (January) |
| Quick regenerate (existing data) | 30 min | As needed |
| Validation only | 5 min | After any changes |

---

## Annual Update Process

### Prerequisites (one-time setup)
```bash
cd /path/to/Molotools

# Install GDAL (required for shapefile conversion)
brew install gdal

# Optional: mapshaper (for geometry simplification)
npm install -g mapshaper

# Verify installation
which ogr2ogr
mapshaper --version
```

### Step 1: Download New Census Data (1-2 hours)

**When**: Usually available January 15 each year at Census Bureau

**Command**:
```bash
cd scripts
rm -rf tiger-geojson tiger-shapefiles  # Clean previous data
node prepare-tiger-data.js
```

**What happens**:
1. Downloads TIGER/Line county shapefiles for all 50 states
2. Converts .shp files to GeoJSON format
3. Simplifies geometry by 97% (Douglas-Peucker algorithm)
4. Saves to `scripts/tiger-geojson/{STATE}.geojson`

**Troubleshooting if download fails**:
```bash
# Try single state first
node prepare-tiger-data.js --state CA

# Or skip simplification if mapshaper issues
node prepare-tiger-data.js --skip-simplify

# Check Census server status
curl -I https://www2.census.gov/geo/tiger/TIGER2024/COUNTY/ | head -5
```

### Step 2: Generate SVG Files (5-15 minutes)

**Command**:
```bash
node generate-county-svgs.js
```

**Expected output**:
```
✅ Generated al: xyz counties
✅ Generated ca: xyz counties
...
✅ All states generated successfully!
```

**What it does**:
1. Loads county manifest (expected counties + slugs)
2. For each state:
   - Reads GeoJSON from `tiger-geojson/{STATE}.geojson`
   - Calculates bounding box (min/max lon/lat)
   - Scales to SVG coordinate system
   - Converts polygon geometry to SVG `<path>` elements
   - Assigns proper IDs: `wtc-county-{slug}`
   - Writes to `data/states/{state}/{state}-counties.svg`

### Step 3: Validate All SVGs (2-5 minutes)

**Command**:
```bash
node validate-county-svgs-simple.js
```

**Expected output** (all states pass):
```
✅ ALABAMA: 67 counties
✅ ALASKA: 29 counties
...
📊 Summary:
   ✅ Passed: 50 states
   ❌ Failed: 0 states
   📈 Total counties: 3,141
   ✅ All validation checks: PASS
```

**If validation fails**:
- Check county name variants in state (see [COUNTY_SVG_CONTRACT.md](scripts/COUNTY_SVG_CONTRACT.md) for common issues)
- Update manifest if needed: `node generate-county-manifest.js > county-manifest.csv`
- Re-run `generate-country-svgs.js` and validation

### Step 4: Commit & Deploy

**Create commit**:
```bash
git add calculators/wealth-tax-calculator/wordpress/wealth-tax-calculator/data/states/

git commit -m "Update county SVGs to TIGER/Line 2025 vintage

- Data source: US Census TIGER/Line 2025
- Simplification: 97% (Douglas-Peucker)
- Validation: 100% pass rate (50/50 states, 3,141 counties)
- Total size: ~350 KB
- Backwards compatible (no code changes)

See PHASE2_COMPLETION_REPORT.md for generation details"
```

**Create release tag**:
```bash
git tag -a "tiger-2025-v1" -m "County SVG update: TIGER/Line 2025 vintage
- Release date: $(date +%Y-%m-%d)
- Commit: $(git rev-parse --short HEAD)
- Counties included: 3,141
- States: 50 + DC"

# View tags
git tag --list | grep tiger
```

**Push to repository**:
```bash
git push origin main
git push origin tiger-2025-v1
```

### Step 5: Smoke Tests (15-30 minutes)

Load admin-map in browser with sample states:

```javascript
// Open browser console and run:
const states = ['MI', 'CA', 'TX', 'NY', 'FL'];
states.forEach(state => {
  const svg = document.querySelector(`#wtc-state-map-${state}`);
  const counties = svg?.querySelectorAll('.wtc-county').length || 0;
  console.log(`${state}: ${counties} counties`);
});
```

**Expected**: Each state shows correct county count, no JavaScript errors.

---

## Quick Regenerate (Without Download)

If you only need to *regenerate* SVGs with existing GeoJSON:

```bash
cd scripts

# Regenerate SVGs (uses existing tiger-geojson/ files)
node generate-county-svgs.js

# Validate
node validate-county-svgs-simple.js
```

**Use case**: Testing normalization changes, fixing manifest issues

---

## Troubleshooting Guide

### Problem: "ogr2ogr: command not found"

**Solution**:
```bash
brew install gdal
```

### Problem: Download stalls or times out

**Solution**:
```bash
# Kill and retry single state
node prepare-tiger-data.js --state CA

# Or re-run (script resumes where it left off)
node prepare-tiger-data.js
```

### Problem: Validation reports county mismatch

**Cause**: County name variant (e.g., "Saint Louis" vs "St. Louis")

**Solution**:
```bash
# Check GeoJSON for variant spellings
grep "Saint" scripts/tiger-geojson/MO.geojson
grep "St\." scripts/tiger-geojson/MO.geojson

# Update normalization logic if needed
# Edit: scripts/generate-county-manifest.js, generateCountySlug()
# Then regenerate manifest and SVGs

node generate-county-manifest.js > county-manifest.csv
node generate-county-svgs.js
node validate-county-svgs-simple.js
```

### Problem: Generated SVGs are huge (>100 KB per state)

**Cause**: Simplification didn't run or was too conservative

**Solution**:
```bash
# Re-run with explicit simplification settings
npm install -g mapshaper
node prepare-tiger-data.js  # Re-prepares with simplification
node generate-county-svgs.js
```

### Problem: Some counties don't render as bubbles in admin-map

**Cause 1**: County name normalization mismatch (GeoIP returns variant name)

**Cause 2**: SVG ID doesn't match expected slug

**Solution**:
1. Check GeoIP response for that state
2. Verify normalization produces expected slug
3. Confirm SVG has matching ID
4. Add variant mapping if needed (see COUNTY_SVG_CONTRACT.md)

---

## Rollback Procedure

If issues discovered in production:

```bash
# Find previous working tag
git tag --list | grep tiger

# Checkout previous version
git checkout tiger-2024-v1

# Revert commit
git revert <commit-hash>
git push origin main
```

SVG files auto-revert to previous vintage; no code changes needed.

---

## File Locations Reference

```
scripts/
├── prepare-tiger-data.js             (Download/convert)
├── generate-county-manifest.js       (County manifest)
├── generate-county-svgs.js           (SVG generation)
├── validate-county-svgs-simple.js    (Validation)
├── tiger-geojson/                    (Downloaded GeoJSON, ~500 MB)
│  ├── AL.geojson
│  ├── CA.geojson
│  └── ... (50 states)
└── tiger-shapefiles/                 (Temporary, auto-deleted)

data/states/
├── alabama/
│  └── alabama-counties.svg
├── california/
│  └── california-counties.svg
└── ... (50 states)
```

---

## Schedule

| Month | Task |
|-------|------|
| January (15+) | Download new TIGER/Line data |
| January (15-17) | Generate + validate SVGs |
| January (17-18) | Deploy (commit + tag + push) |
| January (18-20) | QA smoke tests |

---

## Key Contacts & Resources

- **Census Bureau TIGER/Line**: https://www.census.gov/geographies/mapping-files/
- **mapshaper (simplification)**: https://mapshaper.org/
- **GDAL Documentation**: https://gdal.org/
- **Contract Specification**: [scripts/COUNTY_SVG_CONTRACT.md](scripts/COUNTY_SVG_CONTRACT.md)

---

## Notes

- **Deterministic**: Same input always produces identical output (good for reproducibility)
- **Validated**: All checks are deterministic; fail-fast approach prevents bad deploys
- **Backwards compatible**: No code changes required; only assets replaced
- **Archived**: Previous vintage tags remain in git history for reference/rollback

---

*Last updated: April 14, 2026*  
*Maintained by: Engineering Team*  
*Contact: [team email]*
