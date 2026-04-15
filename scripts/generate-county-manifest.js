#!/usr/bin/env node

/**
 * Generate canonical county manifest from local state GeoJSON files.
 *
 * Usage:
 *   node scripts/generate-county-manifest.js > scripts/county-manifest.csv
 */

const fs = require('fs');
const path = require('path');

const TIGER_DIR = path.join(__dirname, 'tiger-geojson');

const STATES = [
  { code: 'AL', fips: '01' }, { code: 'AK', fips: '02' }, { code: 'AZ', fips: '04' }, { code: 'AR', fips: '05' },
  { code: 'CA', fips: '06' }, { code: 'CO', fips: '08' }, { code: 'CT', fips: '09' }, { code: 'DE', fips: '10' },
  { code: 'FL', fips: '12' }, { code: 'GA', fips: '13' }, { code: 'HI', fips: '15' }, { code: 'ID', fips: '16' },
  { code: 'IL', fips: '17' }, { code: 'IN', fips: '18' }, { code: 'IA', fips: '19' }, { code: 'KS', fips: '20' },
  { code: 'KY', fips: '21' }, { code: 'LA', fips: '22' }, { code: 'ME', fips: '23' }, { code: 'MD', fips: '24' },
  { code: 'MA', fips: '25' }, { code: 'MI', fips: '26' }, { code: 'MN', fips: '27' }, { code: 'MS', fips: '28' },
  { code: 'MO', fips: '29' }, { code: 'MT', fips: '30' }, { code: 'NE', fips: '31' }, { code: 'NV', fips: '32' },
  { code: 'NH', fips: '33' }, { code: 'NJ', fips: '34' }, { code: 'NM', fips: '35' }, { code: 'NY', fips: '36' },
  { code: 'NC', fips: '37' }, { code: 'ND', fips: '38' }, { code: 'OH', fips: '39' }, { code: 'OK', fips: '40' },
  { code: 'OR', fips: '41' }, { code: 'PA', fips: '42' }, { code: 'RI', fips: '44' }, { code: 'SC', fips: '45' },
  { code: 'SD', fips: '46' }, { code: 'TN', fips: '47' }, { code: 'TX', fips: '48' }, { code: 'UT', fips: '49' },
  { code: 'VT', fips: '50' }, { code: 'VA', fips: '51' }, { code: 'WA', fips: '53' }, { code: 'WV', fips: '54' },
  { code: 'WI', fips: '55' }, { code: 'WY', fips: '56' }
];

function sanitizeTitle(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]/g, '')
    .replace(/\-+/g, '-')
    .replace(/^\-+|\-+$/g, '');
}

function generateCountySlug(countyName) {
  if (!countyName) return '';
  const base = countyName
    .replace(/\s+(county|parish|borough|municipality|census-area|city-and-borough)$/i, '')
    .trim();
  return sanitizeTitle(base);
}

function loadStateFeatures(stateCode) {
  const filePath = path.join(TIGER_DIR, `${stateCode}.geojson`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing GeoJSON for ${stateCode}: ${filePath}`);
  }

  const geojson = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return Array.isArray(geojson.features) ? geojson.features : [];
}

function toCountyRow(stateCode, stateFips, feature) {
  const props = feature && feature.properties ? feature.properties : {};
  const countyName = String(props.NAME || props.name || '').trim();
  const countyFips = String(props.COUNTYFP || '').padStart(3, '0');

  if (!countyName || !countyFips) {
    return null;
  }

  const slug = generateCountySlug(countyName);
  const notes = [];
  if (/[^\x00-\x7F]/.test(countyName)) notes.push('non_ascii_name');
  if (/[.'’]/.test(countyName)) notes.push('has_special_chars');

  return {
    stateCode: stateCode.toLowerCase(),
    stateFips,
    countyName,
    countyFips,
    slug,
    displayLabel: countyName,
    notes: notes.join(';')
  };
}

function csvEscape(value) {
  const str = String(value == null ? '' : value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function generateManifest() {
  const rows = [];
  rows.push('state_code,state_fips,county_name,county_fips,expected_slug,display_label,validation_notes');

  STATES.forEach(({ code, fips }) => {
    const features = loadStateFeatures(code);
    const counties = features
      .map((feature) => toCountyRow(code, fips, feature))
      .filter(Boolean)
      .sort((a, b) => {
        if (a.countyFips !== b.countyFips) {
          return a.countyFips.localeCompare(b.countyFips);
        }
        return a.countyName.localeCompare(b.countyName);
      });

    counties.forEach((county) => {
      rows.push([
        county.stateCode,
        county.stateFips,
        csvEscape(county.countyName),
        county.countyFips,
        county.slug,
        csvEscape(county.displayLabel),
        csvEscape(county.notes)
      ].join(','));
    });
  });

  return rows.join('\n');
}

try {
  process.stdout.write(generateManifest() + '\n');
} catch (err) {
  console.error(`Failed to generate manifest: ${err.message}`);
  process.exit(1);
}
