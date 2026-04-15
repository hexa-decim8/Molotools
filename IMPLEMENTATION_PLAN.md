# County Map Modernization: Complete Implementation Plan

## Executive Summary

Converting all 50 US state county maps from placeholder rectangles (current) to real geographic boundaries (TIGER/Line) in a single coordinated batch.

**Total effort**: ~4–6 hours of execution time (mostly automated)
**Cost**: $0 (data is public domain)
**Risk**: Low (validation gates prevent silent failures)
**Target completion**: This week

---

## Phase Overview

| Phase | Name | Status | Time | Blockers |
|-------|------|--------|------|----------|
| 1 | Contract freeze & baseline | ✅ Done | 2 hrs | None |
| 2 | TIGER data + SVG generation | ✅ Ready | 2–3 hrs | GDAL install |
| 3 | Optional diagnostics | ⏳ Pending | 0–2 hrs | Phase 2 |
| 4a | Contract documentation review | ✅ Done | Included | None |
| 4b | Pre-deployment checklist | ⏳ Pending | 30 min | Phase 2 |
| 5 | Optional backend logging | ⏳ Pending | 1–2 hrs | Phase 2 |
| 6 | Optional frontend debug | ⏳ Pending | 1–2 hrs | Phase 2 |
| 7 | Deploy all 50 SVGs (one commit) | ⏳ Pending | 10 min | Phase 2 |
| 8 | QA acceptance testing | ⏳ Pending | 1–2 hrs | Phase 7 |
| 9 | Documentation update | ⏳ Pending | 30 min | Phase 8 |

---

## Phase 1: Contract Freeze & Baseline ✅

### Completed
- ✅ `COUNTY_SVG_CONTRACT.md` — SVG format specification with 13 sections
- ✅ `generate-county-manifest.js` — County manifest generator (PHP slug logic)
- ✅ `michigan-counties.json` — Reference data for all 83 MI counties
- ✅ `validate-county-svgs.js` — Validation automation (10 checks)

### Artifacts
- Manifest CSV format: `state_code,state_fips,county_name,county_fips,expected_slug,display_label,validation_notes`
- SVG contract: ID format `wtc-county-{slug}`, root attrs (xmlns, viewBox, id), element structure

### Key Decision
- **No code changes required** — JS and PHP rendering logic unchanged; only assets replaced

---

## Phase 2: TIGER Data Acquisition & SVG Generation ⏳

### Your Next Steps (Execute in Order)

#### Step 2a: Install Prerequisites (5–10 minutes)
**On macOS**:
```bash
brew install gdal       # Required for shapefile conversion
brew list gdal          # Verify installation
which ogr2ogr           # Confirm ogr2ogr binary exists
```

**On Linux**:
```bash
sudo apt-get install gdal-bin
```

**Optional enhancement** (for geometry simplification):
```bash
npm install -g mapshaper
```

#### Step 2b: Download & Convert TIGER Data (1–2 hours)
```bash
cd /Users/emily.crose/Documents/GitHub/Molotools

# Run the TIGER data acquisition script
node scripts/prepare-tiger-data.js

# This will:
# 1. Download all 50 TIGER/Line county shapefiles (~50 MB)
# 2. Extract zips to temporary directory
# 3. Convert .shp → GeoJSON via ogr2ogr
# 4. Simplify geometry by 97% using mapshaper
# 5. Save cleaned GeoJSON to scripts/tiger-geojson/
# 6. Clean up temporary files

# Output: scripts/tiger-geojson/{STATE}.geojson (50 files, ~500 MB total)
```

**If you want to test single state first**:
```bash
# Download only California (faster test)
node scripts/prepare-tiger-data.js --state CA
```

#### Step 2c: Generate SVG Files (5–15 minutes)
```bash
# Generate all 50 county SVG files
node scripts/generate-county-svgs.js

# This will:
# 1. Load county manifest (expected counties + slugs)
# 2. For each state:
#    - Load GeoJSON from scripts/tiger-geojson/
#    - Calculate bounding box (min/max lon/lat)
#    - Scale to SVG coordinate system
#    - Convert polygons to SVG path elements
#    - Write to data/states/{state}/{state}-counties.svg
# 3. Report progress

# Output: data/states/{STATE}/{STATE}-counties.svg (50 files, ~200 KB total)
```

**Check progress**:
```bash
ls -lh data/states/*/      # Verify all 50 directories have SVG files
du -sh data/states/        # Check total size (~200 KB expected)
```

#### Step 2d: Validate All SVGs (2–5 minutes)
```bash
# Run validation against manifest
node scripts/validate-county-svgs.js data/states

# Expected output:
# ✅ alabama: 67 counties
# ✅ california: 58 counties
# ✅ michigan: 83 counties
# ... (10 more states)
# ✅ 50 states validated, 0 errors
```

**If validation fails**:
- Check if TIGER GeoJSON files downloaded (should be in `scripts/tiger-geojson/`)
- Check file sizes: `ls -lh scripts/tiger-geojson/` (should be 1–50 MB each)
- Run troubleshooting script: See section below

### Expected Results (Phase 2 Complete)
```
✅ All 50 state SVGs generated
✅ All 50 SVGs pass contract validation
✅ Total file size: ~200 KB (gzipped: ~50 KB)
✅ Ready for deployment
```

### Troubleshooting (Phase 2)

<details>
<summary><b>Issue: "ogr2ogr: command not found"</b></summary>

**Cause**: GDAL not installed
**Fix**:
```bash
# macOS
brew install gdal

# Verify
which ogr2ogr
```
</details>

<details>
<summary><b>Issue: "mapshaper is not installed"</b></summary>

**Cause**: mapshaper not in global npm (optional)
**Fix**: Script will warn but continue (files will be larger, still valid)
```bash
npm install -g mapshaper  # Optional
```
</details>

<details>
<summary><b>Issue: Download hangs or times out</b></summary>

**Cause**: Census server throttling or network interruption
**Fix**:
```bash
# Resume with single state
node scripts/prepare-tiger-data.js --state CA

# Or re-run full script (will skip already-downloaded states)
```
</details>

<details>
<summary><b>Issue: Validation reports county mismatch</b></summary>

**Cause**: County name variant (e.g., "Saint Louis" vs "St. Louis")
**Fix**:
```bash
# Check GeoJSON names
grep "Saint" scripts/tiger-geojson/MO.geojson

# Update manifest script or create manual mapping
# Rerun: node scripts/generate-county-svgs.js
```
</details>

---

## Phase 3: Optional Diagnostics ⏳

### Purpose
Add build-time or runtime visibility if validation reveals mismatches (expected: none)

### Phase 3a: Build-Time Diagnostics
If initial validation finds slug mismatches, add logging to `generate-county-svgs.js`:
```javascript
// Line ~150: Add diagnostic reporting
if (!foundInManifest) {
  console.warn(`⚠️ ${stateCode}: County "${countyName}" has no manifest entry`);
}
```

**Skip unless validation reveals issues** (Phase 2 validation should catch all)

### Phase 3b: Runtime Diagnostics (Optional)
Add debug logging to WordPress PHP if needed:
```php
// In wealth-tax-calculator.php, line ~3969
if (DEVELOPMENT_MODE) {
  error_log("GeoIP: {$county_name} → bucket {$bucket}");
}
```

**Skip unless production issues occur** (not needed for initial rollout)

---

## Phase 4: Pre-Deployment Validation

### Phase 4a: Contract Review ✅
Read `scripts/COUNTY_SVG_CONTRACT.md` to understand output requirements.

### Phase 4b: Pre-Deployment Checklist
Once Phase 2 complete, verify:
- [ ] All 50 *.svg files exist in `data/states/*/`
- [ ] `validate-county-svgs.js` reports 0 errors
- [ ] File sizes reasonable: 3 KB (RI) to 200 KB (TX)
- [ ] Total size ~200 KB (acceptable addition to repo)
- [ ] `.gitignore` excludes TIGER temp files
- [ ] GeoJSON files NOT committed (should be in .gitignore)

---

## Phase 5 & 6: Optional Backend/Frontend Logging

### Skip These Unless Phase 8 (QA) Reveals Missing Bubbles

If QA testing shows bubbles not rendering in specific counties:
- **Phase 5**: Add server-side logging to track bucket → SVG lookup failures
- **Phase 6**: Add browser console warnings for missing elements

**Current behavior**: Silently skips missing elements (acceptable)

---

## Phase 7: Deploy All 50 SVGs (One Batch) ⏳

**Prerequisite**: Phase 2 complete + validation clean

### Deployment Command
```bash
cd /Users/emily.crose/Documents/GitHub/Molotools

# Verify everything is ready
git status  # Should show only new files in data/states/

# Stage all 50 new SVG files
git add data/states/

# Commit with version tag
git commit -m "feat: replace all 50 county SVGs with TIGER/Line geometry

- US Census TIGER/Line 2024 county boundaries
- 97% simplified for web performance (~200 KB total)
- ValidateD against county slug contract (50/50 pass)
- Maintains backwards compatibility (analytics schema unchanged)
- Rendering: all 50 states now use real county paths instead of placeholders"

# Tag release
git tag -a "tiger-2024-v1" -m "TIGER/Line 2024 county boundaries with contract validation"

# Push
git push origin main
git push origin tiger-2024-v1
```

### What Gets Deployed
- 50 new/updated SVG files (~200 KB total)
- No code changes
- No analytics schema changes
- No rendering logic changes

### Rollback Strategy
If issues arise in production:
```bash
git revert <commit-hash>
git push origin main
# Reverts to previous rect-based maps (working state)
```

---

## Phase 8: QA Acceptance Testing ⏳

**Prerequisite**: Phase 7 deployed to production

### Test Matrix
Test bubble rendering on diverse state samples:

| State | Counties | Focus | Notes |
|-------|----------|-------|-------|
| Michigan | 83 | Already works | Baseline |
| California | 58 | High volume | Los Angeles metro |
| Texas | 254 | Largest | Urban/rural split |
| New York | 62 | Mid-size | NYC + rural |
| Louisiana | 64 | Parish test | Non-county entity names |
| Illinois | 102 | Dupage/DeKalb variants | Edge case names |
| Georgia | 159 | Major tourist | Atlanta metro |
| Alaska | 29 | Geographic extremes | Fill & scale test |
| Hawaii | 5 | Island territories | Tiny geographies |
| Massachusetts | 14 | Smallest | Edge case small |

### Acceptance Criteria
- [ ] All 10 sample states load map without JS errors
- [ ] County bubbles render for all top 5-10 volume counties per state
- [ ] Bubbles position correctly over county centroids (visual inspection)
- [ ] No console errors or warnings
- [ ] Edge cases pass:
  - [ ] St. Clair County, MI
  - [ ] DeKalb County, GA
  - [ ] DuPage County, IL
  - [ ] St. Louis City, MO (independent city)
  - [ ] New York County, NY (Manhattan)

### If Issues Found
**Scenario 1**: Specific county bubble missing
- Check if county name normalized correctly
- Verify SVG ID matches expected slug: `#wtc-county-{slug}`
- Update manifest or variant mapping

**Scenario 2**: Multiple counties in a state don't render
- Check file download (validate-county-svgs)
- Check coordinate scaling (open SVG in browser, inspect viewBox)

**Scenario 3**: All bubbles missing
- Check JavaScript console for errors
- Verify SVG file loads (network tab)
- Ensure SVG IDs haven't changed

### Smoke Test Script (Optional)
```javascript
// Run in browser console on admin-map page
const states = ['MI', 'CA', 'TX', 'NY'];
states.forEach(state => {
  const el = document.querySelector(`#wtc-state-map-${state}`);
  console.log(`${state}: ${el ? 'LOAD OK' : 'MISSING'}`);
  const counties = el?.querySelectorAll('.wtc-county');
  console.log(`  Counties: ${counties?.length || 0}`);
});
```

---

## Phase 9: Documentation Update ⏳

**Prerequisite**: Phase 8 (QA) passed

### Update Files

#### 1. Update `scripts/COUNTY_SVG_CONTRACT.md`
Add deployment information:
```markdown
## Deployment History

- **2024-01-XX**: Initial TIGER/Line 2024 deployment
  - Source: US Census TIGER/Line 2024
  - Simplification: 97% point reduction (Douglas-Peucker)
  - Total size: 200 KB (50 states)
  - Validation: All 50 states pass contract checklist
  - Release tag: tiger-2024-v1
```

#### 2. Update `README.md` (Project Root)
Add generation instructions:
```markdown
## County Map Files

All 50 US state county maps are generated from US Census TIGER/Line data.

### Regenerating County SVGs

If you need to update county boundaries (e.g., new Census vintage):

```bash
# 1. Install prerequisites
brew install gdal npm  # macOS

# 2. Prepare TIGER/Line data (1-2 hours, one-time)
cd scripts
node prepare-tiger-data.js

# 3. Generate SVGs (5-15 minutes)
node generate-county-svgs.js

# 4. Validate
node validate-county-svgs.js ../data/states

# 5. Commit and deploy
git add ../data/states/
git commit -m "Update county maps to TIGER vintage 2025"
```

See `scripts/README_COUNTY_SVG_PIPELINE.md` for detailed guide.
```

#### 3. Create Maintenance Runbook
Create `MAINTENANCE.md`:
```markdown
# County Map Maintenance

## Annual Updates

Every January, US Census releases updated TIGER/Line geometry.

To update:

1. Download new TIGER vintage
2. Re-run generate-county-svgs.js (manifests auto-updates)
3. Validate (should be auto-pass if county boundaries unchanged)
4. Deploy (one SVG commit per vintage year)
5. Tag release (e.g., tiger-2025-v1)
```

---

## Timeline & Effort Summary

| Phase | Task | Time | Cumulative | Ready to Start? |
|-------|------|------|-----------|-----------------|
| 1 | Contract + manifest baseline | 2 hrs | 2 hrs | ✅ Done |
| 2a | Install GDAL + download TIGER | 1–2 hrs | 3–4 hrs | ⏳ Next |
| 2b | SVG generation | 5–15 min | ~4 hrs | ⏳ After 2a |
| 2c | Validation | 2–5 min | ~4 hrs | ⏳ After 2b |
| 3 | Optional diagnostics | 0–2 hrs | ~4 hrs | Skip unless needed |
| 4 | Pre-deploy checklist | 30 min | 4.5 hrs | ⏳ After 2c |
| 5–6 | Optional logging | 0–2 hrs | ~5 hrs | Skip unless needed |
| 7 | Deploy (one commit) | 10 min | ~5 hrs | ⏳ After validation |
| 8 | QA testing | 1–2 hrs | 6–7 hrs | ⏳ After deploy |
| 9 | Documentation | 30 min | 6.5–7.5 hrs | ⏳ After QA |

**Total effort**: 6.5–7.5 hours (25–30% active work, 70% automated/waiting)

---

## Key Decisions & Trade-offs

<table>
<tr>
<th>Decision</th>
<th>Choice</th>
<th>Rationale</th>
</tr>
<tr>
<td>Data source</td>
<td>US Census TIGER/Line</td>
<td>Authoritative, free, complete (all 3,000+ US counties)</td>
</tr>
<tr>
<td>Simplification strategy</td>
<td>97% point reduction (Douglas-Peucker)</td>
<td>Mobile-first: ~2–5 KB per county, <50 KB gzipped total</td>
</tr>
<tr>
<td>Deployment model</td>
<td>One-batch (all 50 states at once)</td>
<td>Atomic deploy; no partial states; easier rollback</td>
</tr>
<tr>
<td>Validation timing</td>
<td>Build-time (pre-commit)</td>
<td>Prevent silent failures; deterministic checks; fail fast</td>
</tr>
<tr>
<td>Backwards compatibility</td>
<td>Full (no code changes)</td>
<td>JS/PHP logic unchanged; only assets replaced; zero risk</td>
</tr>
<tr>
<td>Optional diagnostics</td>
<td>Defer until QA reveals issues</td>
<td>YAGNI: validation likely sufficient; avoid premature instrumentation</td>
</tr>
</table>

---

## Risks & Mitigation

<table>
<tr>
<th>Risk</th>
<th>Likelihood</th>
<th>Impact</th>
<th>Mitigation</th>
</tr>
<tr>
<td>County name variant doesn't match manifest</td>
<td>Medium</td>
<td>Bubble doesn't render (silent)</td>
<td>Validation script catches before deploy; manual manifest update</td>
</tr>
<tr>
<td>GeoJSON simplification too aggressive (loss of detail)</td>
<td>Low</td>
<td>County shape distorted</td>
<td>Target 97%; can re-run with 95% if needed; visual QA in Phase 8</td>
</tr>
<tr>
<td>TIGER download fails mid-way</td>
<td>Low</td>
<td>Partial data (some states missing)</td>
<td>Script can resume; re-run prepare-tiger-data.js</td>
</tr>
<tr>
<td>GDAL installation broken on user system</td>
<td>Medium (system-dependent)</td>
<td>Script can't run</td>
<td>Clear install instructions; suggest brew; fallback to manual download</td>
</tr>
<tr>
<td>Analytics bucket schema mismatch</td>
<td>Very low</td>
<td>Historical data corruption</td>
<td>No code changes; schema unchanged; validation ensures slug parity</td>
</tr>
<tr>
<td>SVG rendering broken in old browsers</td>
<td>Very low</td>
<td>Map doesn't load</td>
<td>Same SVG tech as before; validated against existing contract</td>
</tr>
</table>

---

## Success Criteria (Full Project)

- [x] **Phase 1**: Contract + manifest complete
- [ ] **Phase 2**: All 50 SVGs generated + validated
- [ ] **Phase 7**: Deployed to production (one commit)
- [ ] **Phase 8**: QA passed (10 sample states + edge cases)
- [ ] **Phase 9**: Documentation updated
- [ ] **Overall**: Michigan-quality maps for all 50 states

---

## Next Steps (Immediate)

1. **Install GDAL** (5 min):
   ```bash
   brew install gdal
   ```

2. **Run Phase 2a** (1–2 hours):
   ```bash
   cd ~/Documents/GitHub/Molotools
   node scripts/prepare-tiger-data.js
   ```

3. **Run Phase 2b** (5–15 min):
   ```bash
   node scripts/generate-county-svgs.js
   ```

4. **Run Phase 2c** (2–5 min):
   ```bash
   node scripts/validate-county-svgs.js data/states
   ```

5. **Report back** when Phase 2 complete (or if issues encountered)

---

## Support & Questions

- **Contract questions**: See [COUNTY_SVG_CONTRACT.md](./scripts/COUNTY_SVG_CONTRACT.md)
- **Generation details**: See [SVG_GENERATION_GUIDE.md](./scripts/SVG_GENERATION_GUIDE.md)
- **Script usage**: See [README_COUNTY_SVG_PIPELINE.md](./scripts/README_COUNTY_SVG_PIPELINE.md)
- **Source code**: All scripts are commented and executable

---

## References

- [US Census TIGER/Line](https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html)
- [GDAL Documentation](https://gdal.org/)
- [mapshaper](https://mapshaper.org/)
- [SVG Specification](https://www.w3.org/TR/SVG2/)
