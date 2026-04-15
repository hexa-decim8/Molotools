#!/usr/bin/env node

/**
 * Generate US ZIP-to-county lookup PHP data file.
 *
 * Source: US Census Bureau 2020 ZCTA-to-County Relationship File
 * URL:    https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/tab20_zcta520_county20_natl.txt
 *
 * For ZIPs that span multiple counties, the county with the largest land-area
 * intersection is chosen as the primary county (Census standard approach).
 *
 * Slugs are resolved by cross-referencing scripts/county-manifest.csv, which
 * maps state FIPS + county FIPS → expected_slug. ZIPs with no manifest match
 * are omitted (they fall through to {state}_county_unknown at runtime).
 *
 * Output: calculators/wealth-tax-calculator/wordpress/wealth-tax-calculator/data/us-zip-county-lookup.php
 *
 * Usage:
 *   node scripts/generate-zip-county-lookup.js
 *   npm run generate-zip-lookup
 */

'use strict';

const fs           = require('fs');
const path         = require('path');
const https        = require('https');
const { execSync } = require('child_process');
const os           = require('os');

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const WORKSPACE_ROOT   = path.join(__dirname, '..');
const MANIFEST_PATH    = path.join(__dirname, 'county-manifest.csv');
const OUTPUT_PATH      = path.join(
    WORKSPACE_ROOT,
    'calculators', 'wealth-tax-calculator', 'wordpress',
    'wealth-tax-calculator', 'data', 'us-zip-county-lookup.php'
);

const CENSUS_URL =
    'https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/tab20_zcta520_county20_natl.txt';

// ---------------------------------------------------------------------------
// FIPS state code → lowercase two-letter state abbreviation
// ---------------------------------------------------------------------------

const FIPS_TO_STATE = {
    '01': 'al', '02': 'ak', '04': 'az', '05': 'ar', '06': 'ca',
    '08': 'co', '09': 'ct', '10': 'de', '12': 'fl', '13': 'ga',
    '15': 'hi', '16': 'id', '17': 'il', '18': 'in', '19': 'ia',
    '20': 'ks', '21': 'ky', '22': 'la', '23': 'me', '24': 'md',
    '25': 'ma', '26': 'mi', '27': 'mn', '28': 'ms', '29': 'mo',
    '30': 'mt', '31': 'ne', '32': 'nv', '33': 'nh', '34': 'nj',
    '35': 'nm', '36': 'ny', '37': 'nc', '38': 'nd', '39': 'oh',
    '40': 'ok', '41': 'or', '42': 'pa', '44': 'ri', '45': 'sc',
    '46': 'sd', '47': 'tn', '48': 'tx', '49': 'ut', '50': 'vt',
    '51': 'va', '53': 'wa', '54': 'wv', '55': 'wi', '56': 'wy',
};

// ---------------------------------------------------------------------------
// Step 1 — Load county-manifest.csv and build FIPS → slug map
// ---------------------------------------------------------------------------

function loadManifest() {
    console.log('Loading county manifest…');
    const raw  = fs.readFileSync(MANIFEST_PATH, 'utf8');
    const rows = raw.trim().split('\n').slice(1); // skip header

    const map = {};
    for (const row of rows) {
        const cols = row.split(',');
        if (cols.length < 5) continue;

        const stateFips  = cols[1].trim().padStart(2, '0');
        const countyFips = cols[3].trim().padStart(3, '0');
        const slug       = cols[4].trim();

        if (!slug || !stateFips || !countyFips) continue;

        const fips5 = stateFips + countyFips;
        map[fips5]  = slug;
    }

    console.log(`  Loaded ${Object.keys(map).length} county FIPS entries.`);
    return map;
}

// ---------------------------------------------------------------------------
// Step 2 — Download Census relationship file
// ---------------------------------------------------------------------------

function downloadCensusFile() {
    const tmpFile = path.join(os.tmpdir(), 'tab20_zcta520_county20_natl.txt');

    if (fs.existsSync(tmpFile) && fs.statSync(tmpFile).size > 1000000) {
        console.log(`  Using cached file: ${tmpFile}`);
        return tmpFile;
    }

    console.log('Downloading Census ZCTA-to-County relationship file…');
    console.log(`  URL: ${CENSUS_URL}`);

    try {
        execSync(`curl -fsSL --retry 3 -o "${tmpFile}" "${CENSUS_URL}"`, {
            stdio: 'inherit',
            timeout: 120000,
        });
    } catch (err) {
        // curl may not be available — fall back to Node https
        console.log('  curl failed, trying Node https…');
        downloadWithHttps(CENSUS_URL, tmpFile);
    }

    const size = fs.statSync(tmpFile).size;
    console.log(`  Downloaded: ${(size / 1024 / 1024).toFixed(1)} MB`);
    return tmpFile;
}

function downloadWithHttps(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (res) => {
            if (res.statusCode === 302 || res.statusCode === 301) {
                file.close();
                downloadWithHttps(res.headers.location, dest).then(resolve).catch(reject);
                return;
            }
            if (res.statusCode !== 200) {
                reject(new Error(`HTTP ${res.statusCode}`));
                return;
            }
            res.pipe(file);
            file.on('finish', () => { file.close(); resolve(); });
        }).on('error', reject);
    });
}

// ---------------------------------------------------------------------------
// Step 3 — Parse the relationship file and build the ZIP→county map
// ---------------------------------------------------------------------------

/**
 * The Census pipe-delimited file has a header row. Relevant columns:
 *
 *   GEOID_ZCTA5_20  — 5-digit ZIP/ZCTA
 *   GEOID_COUNTY_20 — 5-digit county FIPS (state2 + county3)
 *   AREALAND_PART   — land area of the ZCTA∩county intersection (sq meters)
 *
 * We keep only the largest-area county per ZIP (the "primary" county).
 */
function parseCensusFile(filePath, countyFipsToSlug) {
    console.log('Parsing relationship file…');
    const raw   = fs.readFileSync(filePath, 'utf8');
    const lines = raw.split('\n');

    // Parse header to find column indices
    const header = lines[0].split('|').map(h => h.trim());
    const idxZip    = header.indexOf('GEOID_ZCTA5_20');
    const idxCounty = header.indexOf('GEOID_COUNTY_20');
    const idxArea   = header.indexOf('AREALAND_PART');

    if (idxZip === -1 || idxCounty === -1 || idxArea === -1) {
        // Try alternate column names used in some Census file editions
        const altZip    = header.findIndex(h => h.includes('ZCTA5') && h.includes('GEOID'));
        const altCounty = header.findIndex(h => h.includes('COUNTY') && h.includes('GEOID'));
        const altArea   = header.findIndex(h => h.includes('AREALAND') && h.includes('PART'));

        if (altZip === -1 || altCounty === -1 || altArea === -1) {
            console.error('  Header:', header);
            throw new Error('Unexpected column layout in Census file. Check the header above.');
        }
        return parseRows(lines, altZip, altCounty, altArea, countyFipsToSlug);
    }

    return parseRows(lines, idxZip, idxCounty, idxArea, countyFipsToSlug);
}

function parseRows(lines, idxZip, idxCounty, idxArea, countyFipsToSlug) {
    // best[zip] = { fips5, area, stateFips }
    const best = {};
    let total = 0;
    let matched = 0;

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const cols      = line.split('|');
        const zip       = (cols[idxZip]    || '').trim();
        const fips5     = (cols[idxCounty] || '').trim();
        const areaStr   = (cols[idxArea]   || '0').trim();

        if (zip.length !== 5 || fips5.length !== 5) continue;
        if (!/^\d{5}$/.test(zip))   continue;
        if (!/^\d{5}$/.test(fips5)) continue;

        const stateFips = fips5.slice(0, 2);
        if (!FIPS_TO_STATE[stateFips]) continue; // skip territories / DC

        const area = parseInt(areaStr, 10) || 0;
        total++;

        if (!best[zip] || area > best[zip].area) {
            best[zip] = { fips5, area, stateFips };
        }
    }

    // Resolve to slugs
    const lookup = {};
    for (const [zip, entry] of Object.entries(best)) {
        const slug = countyFipsToSlug[entry.fips5];
        if (!slug) continue; // no manifest entry — skip

        const stateCode = FIPS_TO_STATE[entry.stateFips];
        lookup[zip] = { state: stateCode, county: slug };
        matched++;
    }

    console.log(`  Processed ${total} relationship rows.`);
    console.log(`  Resolved ${matched} ZIPs to a named county slug.`);
    console.log(`  Distinct ZIPs in output: ${Object.keys(lookup).length}`);
    return lookup;
}

// ---------------------------------------------------------------------------
// Step 4 — Write PHP output
// ---------------------------------------------------------------------------

function writePHP(lookup) {
    console.log(`Writing PHP lookup file to:\n  ${OUTPUT_PATH}`);

    const sorted = Object.keys(lookup).sort();
    const date   = new Date().toISOString().slice(0, 10);

    const lines = [
        '<?php',
        '/**',
        ' * US ZIP-to-county lookup table.',
        ' *',
        ' * Auto-generated by scripts/generate-zip-county-lookup.js',
        ` * Source: US Census Bureau 2020 ZCTA-to-County Relationship File`,
        ` * Generated: ${date}`,
        ' *',
        ' * Do not edit manually. Regenerate with: npm run generate-zip-lookup',
        ' *',
        ` * Entries: ${sorted.length}`,
        ' * For ZIPs spanning multiple counties, the primary county is the one',
        ' * with the largest land-area intersection (Census standard).',
        ' */',
        '',
        '// Prevent direct access.',
        "if ( ! defined( 'ABSPATH' ) ) {",
        '    exit;',
        '}',
        '',
        'return array(',
    ];

    for (const zip of sorted) {
        const { state, county } = lookup[zip];
        lines.push(`    '${zip}' => array( 'state' => '${state}', 'county' => '${county}' ),`);
    }

    lines.push(');');
    lines.push('');

    fs.writeFileSync(OUTPUT_PATH, lines.join('\n'), 'utf8');

    const size = fs.statSync(OUTPUT_PATH).size;
    console.log(`  Done. File size: ${(size / 1024).toFixed(0)} KB`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

(function main() {
    console.log('=== generate-zip-county-lookup ===\n');

    const countyFipsToSlug = loadManifest();
    const censusFile       = downloadCensusFile();
    const lookup           = parseCensusFile(censusFile, countyFipsToSlug);
    writePHP(lookup);

    console.log('\nDone. Spot-check a few entries:');
    const checks = ['10001', '90210', '77001', '60601', '33101', '98101'];
    for (const zip of checks) {
        if (lookup[zip]) {
            console.log(`  ${zip} → ${lookup[zip].state} / ${lookup[zip].county}`);
        } else {
            console.log(`  ${zip} → (not found)`);
        }
    }
})();
