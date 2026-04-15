#!/usr/bin/env node

/**
 * Generate county SVG files from TIGER/Line county geometry
 * 
 * Pipeline:
 * 1. Download or reference TIGER/Line GeoJSON county boundaries
 * 2. Simplify geometries for performance (Douglas-Peucker algorithm)
 * 3. Generate SVG per state with proper ID/class/attribute structure
 * 4. Validate output against contract
 * 
 * Usage:
 *   node scripts/generate-county-svgs.js [--tiger-dir /path/to/tiger] [--simplify-tolerance 0.01]
 * 
 * Prerequisites:
 *   npm install --save turf mapshaper
 *   
 * Data sources:
 *   - TIGER/Line (Census Bureau): https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html
 *   - Natural Earth (simpler): https://www.naturalearthdata.com/
 */

const fs = require('fs');
const path = require('path');

const BASE_PATH = path.join(__dirname, '..', 'calculators', 'wealth-tax-calculator', 'wordpress', 'wealth-tax-calculator');
const DATA_PATH = path.join(BASE_PATH, 'data', 'states');
const MANIFEST_PATH = path.join(__dirname, 'county-manifest.csv');

// Parse manifest to get expected county metadata
function loadManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error(`❌ Manifest not found: ${MANIFEST_PATH}`);
    console.error('   Run: node scripts/generate-county-manifest.js > scripts/county-manifest.csv');
    process.exit(1);
  }
  
  const content = fs.readFileSync(MANIFEST_PATH, 'utf8');
  const lines = content.trim().split('\n');
  const manifest = {};
  
  lines.slice(1).forEach(line => {
    const parts = line.split(',');
    if (parts.length < 5) return;
    
    const stateCode = parts[0].toLowerCase();
    const stateFips = parts[1];
    const countyName = parts[2].replace(/^"|"$/g, '');
    const countyFips = parts[3];
    const slug = parts[4].trim();
    
    if (!manifest[stateCode]) {
      manifest[stateCode] = {
        stateFips,
        counties: []
      };
    }
    
    manifest[stateCode].counties.push({
      name: countyName,
      fips: countyFips,
      slug
    });
  });
  
  return manifest;
}

/**
 * Convert a GeoJSON feature (county polygon) to SVG path data
 */
function geojsonPolygonToSVGPath(coordinates, simplifyTolerance = 0.01) {
  // This is a simplified implementation
  // In production, use turf.simplify() or mapshaper to reduce complexity
  
  const parts = [];
  
  // Coordinates in GeoJSON are [lon, lat]; SVG uses x,y
  // Assuming you have pre-scaled coordinates to fit SVG viewBox
  
  coordinates.forEach((ring, ringIndex) => {
    if (ringIndex > 0) {
      // Holes (inner rings) require proper SVG path syntax with fill-rule
      // For simplicity, main rings typically don't have holes in county data
    }
    
    ring.forEach((coord, idx) => {
      const x = Math.round(coord[0] * 1000) / 1000; // Round to 3 decimals
      const y = Math.round(coord[1] * 1000) / 1000;
      
      if (idx === 0) {
        parts.push(`M${x},${y}`);
      } else {
        parts.push(`L${x},${y}`);
      }
    });
    
    // Close the ring
    parts.push('Z');
  });
  
  return parts.join('');
}

/**
 * Generate SVG for a state from GeoJSON features
 */
function generateStateSVG(stateCode, counties, geojsonFeatures, options = {}) {
  const tolerance = options.simplifyTolerance || 0.01;
  const padding = options.padding || 50;
  
  // Calculate bounding box from all features
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  
  geojsonFeatures.forEach(feature => {
    if (feature.geometry && feature.geometry.coordinates) {
      const coords = feature.geometry.type === 'Polygon' 
        ? feature.geometry.coordinates[0]
        : feature.geometry.coordinates[0][0]; // MultiPolygon
      
      coords.forEach(([lon, lat]) => {
        minX = Math.min(minX, lon);
        maxX = Math.max(maxX, lon);
        minY = Math.min(minY, lat);
        maxY = Math.max(maxY, lat);
      });
    }
  });
  
  // Scale to SVG viewBox
  const scale = 500 / Math.max(maxX - minX, maxY - minY);
  const offsetX = -minX * scale + padding;
  const offsetY = -minY * scale + padding;
  const width = (maxX - minX) * scale + padding * 2;
  const height = (maxY - minY) * scale + padding * 2;
  
  // Build SVG
  const svgLines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Math.round(width)} ${Math.round(height)}" id="wtc-state-map-${stateCode.toUpperCase()}" role="img" aria-label="${stateCode} county map">`,
    `  <title>${stateCode} Counties</title>`,
    '  <g class="wtc-counties">'
  ];
  
  // Add county paths
  counties.forEach(county => {
    const feature = geojsonFeatures.find(f => 
      f.properties && (f.properties.NAME === county.name || f.properties.COUNTYFP === county.fips)
    );
    
    if (!feature || !feature.geometry) {
      console.warn(`⚠️  No geometry found for ${county.name} (${county.slug})`);
      return;
    }
    
    let pathData = '';
    const coords = feature.geometry.type === 'Polygon'
      ? [feature.geometry.coordinates[0]]
      : feature.geometry.coordinates[0]; // MultiPolygon
    
    coords.forEach((ring, ringIdx) => {
      ring.forEach((coord, idx) => {
        const x = coord[0] * scale + offsetX;
        const y = coord[1] * scale + offsetY;
        
        if (idx === 0) {
          pathData += `M${x.toFixed(1)},${y.toFixed(1)}`;
        } else {
          pathData += `L${x.toFixed(1)},${y.toFixed(1)}`;
        }
      });
      pathData += 'Z';
    });
    
    svgLines.push(
      `    <path class="wtc-county" id="wtc-county-${county.slug}" data-county="${county.name}" d="${pathData}"/>`
    );
  });
  
  svgLines.push(
    '  </g>',
    '</svg>'
  );
  
  return svgLines.join('\n');
}

/**
 * Main generation pipeline
 */
function main() {
  console.log('🔧 Generating county SVG files from TIGER/Line data...\n');
  
  // Load manifest
  const manifest = loadManifest();
  console.log(`✅ Loaded manifest with ${Object.keys(manifest).length} states\n`);
  
  let generated = 0;
  let skipped = 0;
  
  // For each state, generate SVG
  Object.entries(manifest).forEach(([stateCode, data]) => {
    const stateDirPath = path.join(DATA_PATH, stateCode.toLowerCase());
    
    // Ensure directory exists
    if (!fs.existsSync(stateDirPath)) {
      fs.mkdirSync(stateDirPath, { recursive: true });
    }
    
    const svgPath = path.join(stateDirPath, `${stateCode.toLowerCase()}-counties.svg`);
    
    // Check if TIGER/Line GeoJSON exists
    const tigerPath = path.join(__dirname, 'tiger-geojson', `${stateCode.toUpperCase()}.geojson`);
    
    if (!fs.existsSync(tigerPath)) {
      console.warn(
        `⚠️  Skipping ${stateCode}: TIGER GeoJSON not found at ${tigerPath}\n` +
        `     Download from https://www.census.gov/cgi-bin/geo/shapefiles/index.php\n` +
        `     or use Natural Earth: https://www.naturalearthdata.com/\n`
      );
      skipped++;
      return;
    }
    
    try {
      // Load GeoJSON
      const geojsonContent = fs.readFileSync(tigerPath, 'utf8');
      const geojson = JSON.parse(geojsonContent);
      
      // Generate SVG
      const svg = generateStateSVG(
        stateCode,
        data.counties,
        geojson.features || [],
        {
          simplifyTolerance: 0.01,
          padding: 50
        }
      );
      
      // Write SVG
      fs.writeFileSync(svgPath, svg, 'utf8');
      console.log(`✅ Generated ${stateCode}: ${svgPath}`);
      generated++;
      
    } catch (err) {
      console.error(`❌ Failed to generate ${stateCode}: ${err.message}`);
      skipped++;
    }
  });
  
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📊 Summary: ${generated} generated, ${skipped} skipped`);
  console.log(`${'='.repeat(80)}\n`);
  
  if (skipped > 0) {
    console.log('📥 To complete generation, download TIGER/Line GeoJSON files:\n');
    console.log('   mkdir -p scripts/tiger-geojson');
    console.log('   # Download county shapefiles from Census Bureau');
    console.log('   # Convert to GeoJSON and save to scripts/tiger-geojson/{STATE}.geojson\n');
    console.log('   Then run: node scripts/generate-county-svgs.js\n');
  } else {
    console.log('✅ All states generated successfully!\n');
    console.log('Next step: node scripts/validate-county-svgs.js\n');
  }
}

// Show help if requested
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Usage: node scripts/generate-county-svgs.js [options]

Options:
  --tiger-dir PATH             Path to TIGER/Line GeoJSON directory
  --simplify-tolerance NUM     Geometry simplification tolerance (default: 0.01)
  --padding NUM                SVG padding in pixels (default: 50)
  --help, -h                   Show this help message

Data source setup:
  1. Download TIGER/Line county shapefiles from:
     https://www.census.gov/cgi-bin/geo/shapefiles/index.php
  
  2. Convert shapefiles to GeoJSON:
     ogr2ogr -f GeoJSON {STATE}.geojson tl_2024_*_county.shp
  
  3. Place GeoJSON files in scripts/tiger-geojson/{STATE}.geojson
  
  4. Run: node scripts/generate-county-svgs.js

Alternative: Use Natural Earth simplified county data:
  https://www.naturalearthdata.com/
  `);
  process.exit(0);
}

main();
