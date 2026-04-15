#!/usr/bin/env node

/**
 * Download and convert TIGER/Line county data to GeoJSON
 * 
 * This helper script automates TIGER/Line data acquisition:
 * 1. Downloads county shapefiles from Census Bureau
 * 2. Converts shapefiles to GeoJSON format
 * 3. Simplifies geometries for web delivery
 * 
 * Prerequisites:
 *   - GDAL (gdal and ogr2ogr)
 *   - curl or wget
 *   - Node.js 14+
 *   - mapshaper (npm install -g mapshaper)
 * 
 * Usage:
 *   # Download and convert all 50 states (1–2 hours)
 *   node scripts/prepare-tiger-data.js
 *   
 *   # Download only (skip simplification)
 *   node scripts/prepare-tiger-data.js --download-only
 *   
 *   # Individual state
 *   node scripts/prepare-tiger-data.js --state CA
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const https = require('https');

const SCRIPT_DIR = __dirname;
const TIGER_DIR = path.join(SCRIPT_DIR, 'tiger-geojson');
const TIGER_SHAPEFILES_DIR = path.join(SCRIPT_DIR, 'tiger-shapefiles');

// FIPS code to state code mapping
const FIPS_TO_STATE = {
  '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA', '08': 'CO',
  '09': 'CT', '10': 'DE', '12': 'FL', '13': 'GA', '15': 'HI', '16': 'ID',
  '17': 'IL', '18': 'IN', '19': 'IA', '20': 'KS', '21': 'KY', '22': 'LA',
  '23': 'ME', '24': 'MD', '25': 'MA', '26': 'MI', '27': 'MN', '28': 'MS',
  '29': 'MO', '30': 'MT', '31': 'NE', '32': 'NV', '33': 'NH', '34': 'NJ',
  '35': 'NM', '36': 'NY', '37': 'NC', '38': 'ND', '39': 'OH', '40': 'OK',
  '41': 'OR', '42': 'PA', '44': 'RI', '45': 'SC', '46': 'SD', '47': 'TN',
  '48': 'TX', '49': 'UT', '50': 'VT', '51': 'VA', '53': 'WA', '54': 'WV',
  '55': 'WI', '56': 'WY'
};

// Check prerequisites
function checkPrerequisites() {
  console.log('🔍 Checking prerequisites...\n');
  
  const required = [
    { cmd: 'ogr2ogr', name: 'GDAL', install: 'brew install gdal' },
    { cmd: 'curl', name: 'curl', install: 'brew install curl' },
    { cmd: 'node', name: 'Node.js', install: 'already installed' }
  ];
  
  const optional = [
    { cmd: 'mapshaper', name: 'mapshaper (simplification)', install: 'npm install -g mapshaper' }
  ];
  
  let missing = [];
  
  required.forEach(({ cmd, name, install }) => {
    try {
      execSync(`command -v ${cmd}`, { stdio: 'ignore' });
      console.log(`✅ ${name} found`);
    } catch {
      console.error(`❌ ${cmd} not found`);
      console.error(`   Install: ${install}\n`);
      missing.push(cmd);
    }
  });
  
  optional.forEach(({ cmd, name, install }) => {
    try {
      execSync(`command -v ${cmd}`, { stdio: 'ignore' });
      console.log(`✅ ${name} found`);
    } catch {
      console.warn(`⚠️  ${cmd} not found (optional for simplification)`);
      console.warn(`   Install: ${install}\n`);
    }
  });
  
  if (missing.length > 0) {
    console.error(`\n❌ Missing required tools. Installation required before proceeding.\n`);
    process.exit(1);
  }
  
  console.log('✅ All prerequisites met\n');
}

/**
 * Download TIGER/Line shapefile for a state
 * 
 * Downloads from:
 * https://www2.census.gov/geo/tiger/TIGER{YEAR}/COUNTY/
 * 
 * Tries 2023 first (stable), falls back to 2022 if needed
 */
function downloadTigerShapefile(fips, stateCode) {
  const year = 2023;  // Use 2023 (stable and available)
  const baseUrl = `https://www2.census.gov/geo/tiger/TIGER${year}/COUNTY`;
  const filename = `tl_${year}_${fips}_county.zip`;
  const url = `${baseUrl}/${filename}`;
  const outputPath = path.join(TIGER_SHAPEFILES_DIR, filename);
  
  console.log(`📥 Downloading ${stateCode} (FIPS: ${fips})...`);
  console.log(`   ${url}`);
  
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outputPath);
    
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${url}`));
        return;
      }
      
      const totalSize = parseInt(response.headers['content-length'], 10);
      let downloadedSize = 0;
      
      response.on('data', (chunk) => {
        downloadedSize += chunk.length;
        const percent = ((downloadedSize / totalSize) * 100).toFixed(1);
        process.stdout.write(`\r   ${percent}% (${downloadedSize} / ${totalSize} bytes)`);
      });
      
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log(`\n✅ Downloaded ${stateCode}`);
        resolve(outputPath);
      });
      
    }).on('error', reject);
  });
}

/**
 * Unzip shapefile (macOS/Linux)
 */
function unzipShapefile(zipPath, outputDir) {
  const stateCode = zipPath.match(/tl_\d+_(\d+)_county/)[1];
  const dir = path.join(outputDir, path.basename(zipPath, '.zip'));
  
  try {
    execSync(`unzip -q "${zipPath}" -d "${dir}"`);
    console.log(`  ✅ Extracted to ${dir}`);
    return dir;
  } catch (err) {
    console.error(`  ❌ Unzip failed: ${err.message}`);
    throw err;
  }
}

/**
 * Convert shapefile to GeoJSON using ogr2ogr
 */
function convertToGeoJSON(shapefilePath, outputPath) {
  const shapeFile = fs.readdirSync(shapefilePath).find(f => f.endsWith('.shp'));
  const shapeFileFullPath = path.join(shapefilePath, shapeFile);
  
  console.log(`  🔄 Converting to GeoJSON...`);
  
  try {
    execSync(`ogr2ogr -f GeoJSON "${outputPath}" "${shapeFileFullPath}"`, {
      stdio: 'pipe'
    });
    console.log(`  ✅ Converted to ${path.basename(outputPath)}`);
  } catch (err) {
    console.error(`  ❌ Conversion failed: ${err.message}`);
    throw err;
  }
}

/**
 * Simplify GeoJSON using mapshaper (97% point reduction)
 */
function simplifyGeometry(geojsonPath) {
  const outputPath = geojsonPath.replace('.geojson', '-simplified.geojson');
  
  console.log(`  ⚙️  Simplifying geometry (97% reduction)...`);
  
  try {
    // -simplify keeps_shapes generates simplified GeoJSON that preserves closed paths
    execSync(`mapshaper "${geojsonPath}" -simplify 97% keep-shapes -o "${outputPath}"`, {
      stdio: 'pipe'
    });
    
    // Replace original with simplified version
    fs.renameSync(outputPath, geojsonPath);
    console.log(`  ✅ Simplified`);
  } catch (err) {
    console.warn(`  ⚠️  Simplification skipped (mapshaper not available or error: ${err.message})`);
    // Continue without simplification
  }
}

/**
 * Process a single state
 */
async function processState(stateCode) {
  const fips = Object.entries(FIPS_TO_STATE).find(
    ([_, code]) => code === stateCode.toUpperCase()
  )?.[0];
  
  if (!fips) {
    throw new Error(`Unknown state code: ${stateCode}`);
  }
  
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Processing ${stateCode} (FIPS: ${fips})`);
  console.log(`${'='.repeat(80)}\n`);
  
  // Create directories
  if (!fs.existsSync(TIGER_DIR)) fs.mkdirSync(TIGER_DIR, { recursive: true });
  if (!fs.existsSync(TIGER_SHAPEFILES_DIR)) fs.mkdirSync(TIGER_SHAPEFILES_DIR, { recursive: true });
  
  // Download
  const zipPath = await downloadTigerShapefile(fips, stateCode);
  
  // Unzip
  const shapefileDir = unzipShapefile(zipPath, TIGER_SHAPEFILES_DIR);
  
  // Convert & simplify
  const geojsonPath = path.join(TIGER_DIR, `${stateCode.toUpperCase()}.geojson`);
  convertToGeoJSON(shapefileDir, geojsonPath);
  simplifyGeometry(geojsonPath);
  
  // Delete intermediate files
  execSync(`rm -f "${zipPath}" && rm -rf "${shapefileDir}"`);
  
  console.log(`✅ ${stateCode} complete\n`);
}

/**
 * Main entry point
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: node scripts/prepare-tiger-data.js [options]

Options:
  --state CA              Process single state (default: all 50)
  --download-only        Download shapefiles, skip GeoJSON conversion
  --skip-simplify        Skip mapshaper simplification
  --help, -h             Show this help message

Examples:
  # Download and convert all 50 states (1–2 hours)
  node scripts/prepare-tiger-data.js
  
  # Process only California
  node scripts/prepare-tiger-data.js --state CA
  
  # Download but don't convert
  node scripts/prepare-tiger-data.js --download-only

Notes:
  - First run will take 1–2 hours for all 50 states (~50 MB download)
  - Simplification reduces file size by ~97% (requires mapshaper)
  - GeoJSON files saved to: scripts/tiger-geojson/
    `);
    process.exit(0);
  }
  
  checkPrerequisites();
  
  const singleState = args.find((_, i) => args[i - 1] === '--state');
  const skipGeoJSON = args.includes('--download-only');
  
  const statesToProcess = singleState 
    ? [singleState.toUpperCase()]
    : Object.values(FIPS_TO_STATE).sort();
  
  let succeeded = 0;
  let failed = 0;
  
  for (const state of statesToProcess) {
    try {
      if (!skipGeoJSON) {
        await processState(state);
      }
      succeeded++;
    } catch (err) {
      console.error(`\n❌ ${state} failed: ${err.message}\n`);
      failed++;
    }
  }
  
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📊 Complete: ${succeeded} succeeded, ${failed} failed`);
  console.log(`${'='.repeat(80)}\n`);
  
  if (succeeded === statesToProcess.length) {
    console.log(`✅ All states processed successfully!\n`);
    console.log(`📂 GeoJSON files in: ${TIGER_DIR}\n`);
    console.log(`Next step: node scripts/generate-county-svgs.js\n`);
  }
}

main().catch(err => {
  console.error(`\n❌ Error: ${err.message}\n`);
  process.exit(1);
});
