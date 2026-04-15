# County SVG Generation Pipeline

Complete automation for upgrading all 50 US state county maps from placeholder rectangles to real geographic boundaries.

**Status**: Phase 2 implementation complete (ready to run)

## Quick Start

```bash
# Step 1: Download TIGER/Line data from US Census Bureau (1–2 hours)
node scripts/prepare-tiger-data.js

# Step 2: Generate SVG files from GeoJSON (5–15 minutes)
node scripts/generate-county-svgs.js

# Step 3: Validate all 50 SVGs against contract (2–5 minutes)
node scripts/validate-county-svgs.js data/states

# Success: All 50 states processed and validated! ✅
```

## Scripts Overview

### 1. `prepare-tiger-data.js` — TIGER Data Acquisition

Downloads US Census county data and converts to GeoJSON format.

**Input**: Nothing (downloads from Census Bureau)
**Output**: `scripts/tiger-geojson/{STATE}.geojson` (50 files)

**Usage**:
```bash
# Download and convert all 50 states
node scripts/prepare-tiger-data.js

# Single state for testing
node scripts/prepare-tiger-data.js --state CA

# Download only (skip GeoJSON conversion)
node scripts/prepare-tiger-data.js --download-only

# Show help
node scripts/prepare-tiger-data.js --help
```

**Prerequisites**:
- GDAL + ogr2ogr (required)
  - macOS: `brew install gdal`
  - Linux: `apt-get install gdal-bin`
- curl (required)
- mapshaper (optional, for geometry simplification)
  - `npm install -g mapshaper`

**What it does**:
1. Validates prerequisites (GDAL, curl, Node.js)
2. Downloads TIGER/Line county shapefile ZIP for each state
3. Unzips shapefile to temporary directory
4. Converts `.shp` → GeoJSON using ogr2ogr
5. Simplifies geometry by 97% using mapshaper (optional)
6. Cleans up temporary files

**Time**: 1–2 hours (includes Census Bureau download throttling)

---

### 2. `generate-county-manifest.js` — County Manifest Generation

Generates canonical list of all US counties with expected SVG ID slugs.

**Input**: Hardcoded state + county data (AL, CA, MI samples; extensible to full TIGER)
**Output**: `scripts/county-manifest.csv` (CSV format)

**Usage**:
```bash
node scripts/generate-county-manifest.js > scripts/county-manifest.csv
```

**CSV format**:
```
state_code,state_fips,county_name,county_fips,expected_slug,display_label,validation_notes
al,01,Autauga County,001,autauga,Autauga County AL,
al,01,Baldwin County,003,baldwin,Baldwin County AL,
...
```

**Key functions**:
- `sanitizeTitle()` — Implements WordPress `sanitize_title()` logic
- `generateCountySlug()` — Strips trailing county/parish descriptors, normalizes to slug

---

### 3. `generate-county-svgs.js` — SVG File Generation

Converts GeoJSON county boundaries to SVG files matching contract.

**Input**: `scripts/tiger-geojson/{STATE}.geojson` (from prepare-tiger-data.js)
**Output**: `data/states/{state}/{state}-counties.svg` (50 files)

**Usage**:
```bash
node scripts/generate-county-svgs.js

# Show help
node scripts/generate-county-svgs.js --help
```

**What it does**:
1. Loads manifest CSV (expected county list)
2. For each state:
   - Loads GeoJSON file (if available)
   - Calculates bounding box (min/max lon/lat)
   - Scales to SVG viewBox (preserves aspect ratio + padding)
   - Converts each county polygon → SVG `<path>` element
   - Assigns ID: `wtc-county-{slug}` (matches manifest + contract)
   - Writes SVG with proper XML structure

**Output SVG structure**:
```xml
<svg xmlns="http://www.w3.org/2000/svg" 
     viewBox="0 0 1000 600" 
     id="wtc-state-map-CA">
  <g class="wtc-counties">
    <path id="wtc-county-los-angeles" 
          class="wtc-county" 
          data-county="Los Angeles County" 
          d="M..."/>
    <!-- ... more counties ... -->
  </g>
</svg>
```

**File size**: 3–180 KB per state (depending on county complexity)

---

### 4. `validate-county-svgs.js` — SVG Validation

Enforces contract compliance for all generated SVGs.

**Input**: `data/states/` directory + `scripts/county-manifest.csv`
**Output**: Validation report (stdout)

**Usage**:
```bash
node scripts/validate-county-svgs.js data/states
```

**Validation checks**:
1. ✅ File existence (all expected SVG files present)
2. ✅ Valid XML/SVG parsing
3. ✅ Root element attributes (xmlns, viewBox, id format)
4. ✅ County container group present
5. ✅ ID format validation (`wtc-county-{slug}`)
6. ✅ No duplicate IDs across state
7. ✅ Slug format validation (lowercase, alphanumeric, hyphens only)
8. ✅ Element type validation (path or rect)
9. ✅ Required attributes per element type
10. ✅ County count parity (manifest → SVG IDs)

**Output**:
```
📊 Validation Report
==================================================
✅ alabama: 67 counties validated
❌ california: County "kings" missing from SVG
✅ michigan: 83 counties validated
  ...
✅ 49 states passed, 1 state failed
```

---

## Pipeline Diagrams

### Phase 2a: Data Acquisition
```
US Census Bureau
        ↓
  TIGER/Line Shapefiles (.shp + .dbf + .shx)
        ↓
  ogr2ogr (GDAL)
        ↓
  GeoJSON Format (lon,lat coordinates)
        ↓
  mapshaper (simplification)
        ↓
  scripts/tiger-geojson/{STATE}.geojson
```

### Phase 2b-c: SVG Generation & Validation
```
county-manifest.csv (expected counties + slugs)
  ↓
GeoJSON files (county geometries)
  ├→ generate-county-svgs.js
  │    ├ Load manifest
  │    ├ Bounding box calculation
  │    ├ Coordinate scaling
  │    └ SVG path generation
  ↓
SVG files (data/states/{state}/{state}-counties.svg)
  ├→ validate-county-svgs.js
  │    └ 10-point validation checklist
  ↓
✅ All 50 validated OR ❌ Errors reported (fail build)
```

---

## Configuration

### File Locations
```
scripts/
  ├ prepare-tiger-data.js       (executable)
  ├ generate-county-manifest.js (executable)
  ├ generate-county-svgs.js     (executable)
  ├ validate-county-svgs.js     (executable)
  ├ county-manifest.csv         (generated by manifest script)
  ├ tiger-geojson/              (generated by prepare-tiger-data.js)
  │  ├ AL.geojson
  │  ├ CA.geojson
  │  └ ... (50 state files)
  ├ tiger-shapefiles/           (temporary, auto-deleted)
  └ COUNTY_SVG_CONTRACT.md      (reference documentation)

data/
  └ states/
     ├ alabama/
     │  └ alabama-counties.svg
     ├ california/
     │  └ california-counties.svg
     └ ... (50 state directories)
```

### Node.js Module Dependencies

**Required**:
- `fs` (built-in)
- `path` (built-in)
- `child_process.execSync` (built-in)
- `https` (built-in)

**No npm packages required** (scripts use native Node.js APIs only)

**System dependencies**:
- GDAL toolkit (ogr2ogr)
- curl
- mapshaper (optional)

---

## Manual Troubleshooting

### Issue: GDAL/ogr2ogr not found

**Cause**: GDAL not installed
**Fix**:
```bash
# macOS
brew install gdal

# Ubuntu/Debian
sudo apt-get install gdal-bin

# Or download from:
# https://trac.osgeo.org/gdal/wiki/DownloadingGdalBinaries
```

### Issue: GeoJSON file is empty or has wrong properties

**Cause**: Shapefile didn't convert properly
**Fix**:
```bash
# Re-download TIGER data for that state
node scripts/prepare-tiger-data.js --state CA

# Or manually verify the extracted shapefile:
unsing-q scripts/tiger-shapefiles/tl_2024_06_county/tl_2024_06_county.shp
```

### Issue: SVG validation fails with "County not found"

**Cause**: County name variant (e.g., "Saint Louis" vs "St. Louis")
**Fix**:
1. Check GeoJSON: `grep "Saint Louis" scripts/tiger-geojson/MO.geojson`
2. Update manifest: Add variant to `generateCountySlug()` function
3. Re-run validation

### Issue: Generation very slow on large state (Texas, California)

**Cause**: Simplification processing 200k+ path points
**Fix**:
```bash
# Skip simplification (files will be larger but still valid)
node scripts/prepare-tiger-data.js --skip-simplify --state TX
```

---

## Success Indicators

✅ **Phase 2a complete**: All 50 states in `scripts/tiger-geojson/` (total ~500 MB uncompressed)

✅ **Phase 2b complete**: All 50 SVG files in `data/states/` (total ~200 KB)

✅ **Phase 2c complete**: Validation script reports 0 errors

**Total time**: ~2 hours (mostly Census download + simplification)

---

## Next: Phase 7 Deployment

Once Phase 2 completes:

```bash
# Commit all 50 new SVG files
git add data/states/
git commit -m "Replace all 50 county SVGs with TIGER/Line geometry (97% simplified)"

# Tag release with TIGER version
git tag -a "tiger-2024-v1" -m "TIGER/Line 2024 county boundaries"

# Push
git push origin main
git push origin tiger-2024-v1
```

---

## Reference Documentation

- [COUNTY_SVG_CONTRACT.md](./COUNTY_SVG_CONTRACT.md) — SVG format specification
- [SVG_GENERATION_GUIDE.md](./SVG_GENERATION_GUIDE.md) — Implementation details + troubleshooting
- [US Census TIGER/Line](https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html)
- [GDAL/ogr2ogr](https://gdal.org/programs/ogr2ogr.html)
- [mapshaper](https://mapshaper.org/)

---

## License & Attribution

**TIGER/Line data**: Public domain (US Census Bureau)
**SVG generation logic**: Internal (Molotools)
**mapshaper**: BSD-3-Clause (https://github.com/mbloch/mapshaper/blob/master/LICENSE)

All output SVGs are public domain (derived from TIGER/Line)
