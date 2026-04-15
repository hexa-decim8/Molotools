# SVG Generation Implementation Guide

## Overview

This guide documents the data pipeline for converting US Census TIGER/Line county boundaries into optimized SVG assets for the wealth tax calculator map visualizations.

**Goals**:
- Convert geographic county boundaries to SVG with contract compliance
- Optimize for web delivery (aggressive simplification for mobile)
- Maintain deterministic build (same input → same output)
- Validate parity between county data and generated SVG IDs


## Data Source: US Census TIGER/Line

### Source URL
- **Primary**: https://www.census.gov/cgi-bin/geo/shapefiles/index.php
- **Fallback**: https://www.naturalearthdata.com/ (simplified, less detailed)

### File Selection
1. Go to Census website
2. Select **Year**: 2024 (or latest)
3. Select **Layer**: "Counties and Equivalent"
4. Download complete shapefiles for all 50 states

### Format Conversion

TIGER delivers data in **Shapefile** format (.shp, .shx, .dbf). Convert to GeoJSON:

```bash
# Install conversion tool (if needed)
brew install gdal  # macOS
# or: apt-get install gdal-bin  # Linux
# or: download from https://trac.osgeo.org/gdal/wiki/DownloadingGdalBinaries

# Convert a single shapefile
ogr2ogr -f GeoJSON county.geojson tl_2024_06_county.shp

# Batch convert all states
for file in tl_2024_*_county.shp; do
  STATE_FIPS="${file:8:2}"
  STATE_NAME=$(node -e "const m = {01:'AL', 02:'AK', ...}; console.log(m.$STATE_FIPS)")
  ogr2ogr -f GeoJSON "scripts/tiger-geojson/${STATE_NAME}.geojson" "$file"
done
```

### GeoJSON Structure

Resulting GeoJSON has the format:
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "STATEFP": "06",        // State FIPS code
        "COUNTYFP": "001",      // County FIPS code (relative to state)
        "NAME": "Alameda",      // County name (as used by Census)
        "ALAND": 2391818,
        "AWATER": 206213
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[...lon, lat...], ...]]  // Ring of coordinates (lon, lat pairs)
      }
    },
    // ... more counties ...
  ]
}
```

**Key fields**:
- `properties.NAME`: County name (must be normalized to slug using `generateCountySlug()`)
- `properties.COUNTYFP`: County FIPS code (used for validation)
- `geometry.coordinates`: Raw polygon data (requires simplification + scaling)


## Geometry Simplification

### Why Simplify?

Raw TIGER county boundaries can have 100k+ coordinate points per county. Example:
- Los Angeles County: 45,000 points → 1.2 MB uncompressed
- Optimized: 2,000 points → 40 KB (33x compression)

### Strategy: Douglas-Peucker Algorithm

Preserves shape while reducing point density:

```javascript
// Pseudocode
simplify(path, tolerance) {
  if path.length <= 2: return path
  
  dMax = 0
  for each point p in path[1..length-2]:
    d = distance(p, lineSegment(path[0], path[-1]))
    if d > dMax:
      dMax = d
      index = p's index
  
  if dMax > tolerance:
    return simplify(path[0..index], tolerance) + 
           simplify(path[index..end], tolerance)
  else:
    return [path[0], path[-1]]
}
```

### Recommended Libraries

**Option 1: mapshaper** (CLI + Node.js API)
```bash
npm install --save mapshaper

# Usage
mapshaper input.geojson -simplify 98% -o output.geojson
```

**Option 2: turf.js**
```javascript
const turf = require('@turf/turf');

const simplified = turf.simplify(polygon, {
  tolerance: 0.01,   // degrees (~1 km at equator)
  highQuality: false // faster, lower quality acceptable for county maps
});
```

### Simplification Rates

Production targets:
- **Target**: 95-98% reduction in coordinate count
- **Tolerance**: 0.005–0.01 degrees (500m–1km at equator)
- **Mobile-first**: Prioritize file size over detail

Example results:
- California: 237k → 8k points (97% reduction)
- Texas: 412k → 15k points (96% reduction)
- New York: 89k → 4k points (96% reduction)


## SVG Generation Pipeline

### Step 1: Load Manifest

```javascript
const manifest = loadManifest(); // from generate-county-manifest.js
// Returns: { "ca": { stateFips: "06", counties: [{name, fips, slug}, ...] }, ... }
```

### Step 2: Load GeoJSON

```javascript
const geojson = JSON.parse(fs.readFileSync('tiger-geojson/CA.geojson'));
// Features: one per county
```

### Step 3: Calculate Bounding Box

Find min/max lon/lat across all features:
```javascript
let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity];
geojson.features.forEach(feature => {
  feature.geometry.coordinates.forEach(ring => {
    ring.forEach(([lon, lat]) => {
      minX = Math.min(minX, lon);
      maxX = Math.max(maxX, lon);
      minY = Math.min(minY, lat);
      maxY = Math.max(maxY, lat);
    });
  });
});
```

### Step 4: Scale to SVG ViewBox

Fitting strategy (preserves aspect ratio + padding):
```javascript
const targetSize = 500; // pixels
const range = Math.max(maxX - minX, maxY - minY);
const scale = targetSize / range;
const padding = 50;

const svgWidth = (maxX - minX) * scale + padding * 2;
const svgHeight = (maxY - minY) * scale + padding * 2;
const offsetX = -minX * scale + padding;
const offsetY = -minY * scale + padding;
```

SVG viewBox becomes:
```jsx
<svg viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
```

### Step 5: Convert Polygons to SVG Paths

For each county feature:

```javascript
let pathData = '';

coordinates.forEach((ring, ringIdx) => {
  ring.forEach(([lon, lat], idx) => {
    // Transform: world coords → SVG coords
    const x = lon * scale + offsetX;
    const y = lat * scale + offsetY;
    
    if (idx === 0) pathData += `M${x.toFixed(1)},${y.toFixed(1)}`;
    else pathData += `L${x.toFixed(1)},${y.toFixed(1)}`;
  });
  
  // Close ring
  pathData += 'Z';
  
  // Note: holes (ringIdx > 0) handled via fill-rule="evenodd"
});
```

**SVG path abbreviations**:
- `M`: Move to (start new subpath)
- `L`: Line to
- `Z`: Close path (draw line back to start)

Example output:
```svg
<path id="wtc-county-los-angeles" d="M-120.5,34.2L-120.4,34.3L...Z"/>
```

### Step 6: Build SVG Element

Contract-compliant structure:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" 
     viewBox="0 0 1000 600" 
     id="wtc-state-map-CA"
     role="img"
     aria-label="California county map">
  <title>California Counties</title>
  <g class="wtc-counties">
    <!-- One path per county -->
    <path class="wtc-county" 
          id="wtc-county-los-angeles"
          data-county="Los Angeles County"
          d="M..."/>
    <!-- ... more counties ... -->
  </g>
</svg>
```

### Step 7: Validate Against Contract

Run `validate-county-svgs.js` after generation:

```bash
node scripts/validate-county-svgs.js data/states
```

Verifies:
- ✅ All expected counties present (slug parity)
- ✅ No duplicate IDs
- ✅ Valid SVG XML
- ✅ Attributes match contract


## Implementation Checklist

### Phase 2a: Data Acquisition (1–2 hours)
- [ ] Download TIGER/Line shapefiles for all 50 states
- [ ] Install GDAL/ogr2ogr
- [ ] Batch convert to GeoJSON (50 files to `scripts/tiger-geojson/`)
- [ ] Verify GeoJSON has `NAME` and `COUNTYFP` properties

### Phase 2b: Simplification (2–4 hours)
- [ ] `npm install mapshaper` or `turf`
- [ ] Test simplification on 3–5 sample states (CA, TX, MI)
- [ ] Measure file size before/after
- [ ] Target 97% reduction in points

### Phase 2c: SVG Generation (2–3 hours)
- [ ] Implement `geojsonPolygonToSVGPath()` with simplification
- [ ] Implement `generateStateSVG()` with bounding box + scaling
- [ ] Test on 3 states (AL, CA, MI)
- [ ] Visually verify shapes (no distortion, proper bounds)

### Phase 3a: Test Manifest Matching (1–2 hours)
- [ ] Generate partial manifest for CA (58 counties expected)
- [ ] Generate SVG for CA
- [ ] Validate: all 58 expected slugs present as SVG IDs
- [ ] Repeat for MI (83 counties) and TX (254 counties)

### Phase 3b: Full Build (1–2 hours)
- [ ] Run `generate-county-manifest.js` → full manifest CSV
- [ ] Run `generate-county-svgs.js` → all 50 SVGs
- [ ] Track generation time (target: < 5 min total)

### Phase 4: Validation (1 hour)
- [ ] Run `validate-county-svgs.js`
- [ ] Verify 0 errors across all 50 states (pass/fail)
- [ ] Compare file sizes: old vs new
- [ ] Calculate total size increase (expect ~3–5x for real geometry)

### Phase 5–6: Optional Diagnostics (if needed)
- [ ] Use `validate-county-svgs.js` output to find any mismatched slugs
- [ ] Add backend logging (optional)

### Phase 7: One-Batch Deployment
- [ ] Commit all 50 SVGs in single commit
- [ ] Tag release with TIGER vintage (e.g., "tiger-2024-v1")

### Phase 8: QA Testing
- [ ] Load admin-map in browser with 10 sample states
- [ ] Verify bubbles render and align with county polygons
- [ ] Test edge cases: St. Clair, DeKalb, DuPage, etc.

### Phase 9: Documentation
- [ ] Update `scripts/COUNTY_SVG_CONTRACT.md` with TIGER version
- [ ] Write generation runbook in top-level `README.md`


## Expected File Sizes

**Current state** (mix of paths + rect placeholders):
- Michigan: 61 KB (real geometry)
- California: 7 KB (rect placeholders)
- Average: ~1.5 KB
- **Total**: ~75 KB

**Post-upgrade** (all real geometry, simplified 97%):
- Michigan: 75 KB (97% simplified geometry)
- California: 120 KB (58 counties, simplified)
- Texas: 180 KB (254 counties, simplified)
- Average: ~4 KB per state
- **Total**: ~200 KB

**Compression** (with gzip):
- Current: ~20 KB (gzipped)
- Post: ~50 KB (gzipped)
- Network cost: ~30 KB additional download (acceptable for visual quality gain)


## Troubleshooting

### Issue: "GeoJSON has no features"
**Cause**: Shapefile conversion failed or empty file
**Fix**: Re-download shapefiles, verify ogr2ogr command

### Issue: "County name doesn't exist in manifest"
**Cause**: GeoJSON has variant name (e.g., "Saint Louis" vs "St. Louis")
**Fix**: Check `COUNTY_SVG_CONTRACT.md` for normalization rules; add variant to manifest

### Issue: "Simplified polygon is too distorted"
**Cause**: Simplification tolerance too aggressive
**Fix**: Lower tolerance (e.g., 0.005 instead of 0.01); accept larger file

### Issue: "SVG validation fails with duplicate IDs"
**Cause**: Two counties mapped to same slug (collision)
**Fix**: Check manifest for duplicate slug entries; review normalization logic

### Issue: "Generated SVG is blank or invisible"
**Cause**: Coordinate scaling issue (viewBox mismatch)
**Fix**: Debug bounding box calculation; check scale factor math; verify no NaN values


## Output Artifacts

After running generation + validation, expect:
```
data/
  states/
    alabama/
      alabama-counties.svg          (3 KB, 67 counties)
    california/
      california-counties.svg       (120 KB, 58 counties)
    michigan/
      michigan-counties.svg         (75 KB, 83 counties)
    texas/
      texas-counties.svg            (180 KB, 254 counties)
    ... (50 total)

scripts/
  county-manifest.csv              (3,000+ lines, all counties)
  tiger-geojson/
    AL.geojson                     (original, not version-controlled)
    CA.geojson
    ... (50 total)
  COUNTY_SVG_CONTRACT.md           (updated with TIGER-2024)
```

**Total repository size increase**: ~200 KB (likely acceptable; do not gzip commit)


## Next Steps

1. ✅ Phase 1: Contract + manifest baseline (complete)
2. ⏳ Phase 2: Download TIGER data + generate manifest (this guide)
3. ⏳ Phase 3: Implement SVG generation + test on 3 states
4. ⏳ Phase 4: Full build + validation
5. ⏳ Phase 7: Deploy all 50 (one batch)
6. ⏳ Phase 8: QA acceptance testing
7. ⏳ Phase 9: Documentation update


## References

- [US Census TIGER/Line](https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html)
- [GDAL/ogr2ogr Docs](https://gdal.org/programs/ogr2ogr.html)
- [GeoJSON Spec](https://geojson.org/)
- [SVG Spec](https://www.w3.org/TR/SVG2/)
- [Douglas-Peucker Algorithm](https://en.wikipedia.org/wiki/Ramer%E2%80%93Douglas%E2%80%93Peucker_algorithm)
- [mapshaper](https://mapshaper.org/)
- [turf.js](https://turfjs.org/)
