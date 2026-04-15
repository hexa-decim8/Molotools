#!/usr/bin/env node

/**
 * Validate all county SVG files against the rendering contract
 * 
 * Usage: node scripts/validate-county-svgs.js
 * 
 * Checks:
 *   - File existence for all expected states
 *   - Valid XML/SVG structure
 *   - Required element IDs and attributes
 *   - No duplicate county IDs within a state
 *   - County count parity with manifest
 *   - Slug format compliance
 */

const fs = require('fs');
const path = require('path');
const { DOMParser, XMLSerializer } = require('xmldom');

const BASE_PATH = path.join(__dirname, '..', 'calculators', 'wealth-tax-calculator', 'wordpress', 'wealth-tax-calculator');
const DATA_PATH = path.join(BASE_PATH, 'data', 'states');
const MANIFEST_PATH = path.join(__dirname, 'county-manifest.csv');

/**
 * Parse CSV manifest to get expected county counts per state
 */
function parseManifest(csvPath) {
  if (!fs.existsSync(csvPath)) {
    console.warn(`⚠️  Manifest not found at ${csvPath}`);
    return {};
  }
  
  const content = fs.readFileSync(csvPath, 'utf8');
  const lines = content.trim().split('\n');
  const manifest = {};
  
  lines.slice(1).forEach(line => {
    const parts = line.split(',');
    if (parts.length < 5) return;
    
    const stateCode = parts[0].toLowerCase();
    if (!manifest[stateCode]) {
      manifest[stateCode] = {
        counties: [],
        expectedSlugs: new Set()
      };
    }
    
    // Extract slug from CSV (it's the 5th column, 0-indexed)
    const slug = parts[4].trim();
    manifest[stateCode].expectedSlugs.add(slug);
    manifest[stateCode].counties.push({
      name: parts[2].replace(/^"|"$/g, ''),
      slug
    });
  });
  
  return manifest;
}

/**
 * Validate a single SVG file
 */
function validateSVG(filePath, stateCode, expectedSlugs, expectedCount) {
  const results = {
    file: filePath,
    state: stateCode,
    valid: true,
    errors: [],
    warnings: [],
    stats: {
      totalCounties: 0,
      validCounties: 0,
      duplicateIds: [],
      missingSlugs: [],
      extraSlugs: []
    }
  };
  
  // Check file existence
  if (!fs.existsSync(filePath)) {
    results.valid = false;
    results.errors.push(`File not found: ${filePath}`);
    return results;
  }
  
  // Read and parse SVG
  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    results.valid = false;
    results.errors.push(`Failed to read file: ${err.message}`);
    return results;
  }
  
  let svg;
  try {
    const parser = new DOMParser();
    svg = parser.parseFromString(content, 'text/xml');
  } catch (err) {
    results.valid = false;
    results.errors.push(`Invalid XML/SVG: ${err.message}`);
    return results;
  }
  
  // Check root element attributes
  const root = svg.documentElement;
  if (root.tagName !== 'svg') {
    results.errors.push('Root element is not <svg>');
    results.valid = false;
  }
  
  if (!root.getAttribute('xmlns')) {
    results.warnings.push('Missing xmlns attribute on SVG root');
  }
  
  if (!root.getAttribute('viewBox')) {
    results.errors.push('Missing viewBox attribute');
    results.valid = false;
  }
  
  const expectedId = `wtc-state-map-${stateCode.toUpperCase()}`;
  const actualId = root.getAttribute('id');
  if (actualId !== expectedId) {
    results.warnings.push(`ID mismatch: expected "${expectedId}", got "${actualId}"`);
  }
  
  // Check for county container group
  const countyGroup = svg.getElementsByClassName('wtc-counties')[0];
  if (!countyGroup) {
    results.errors.push('Missing <g class="wtc-counties"> container');
    results.valid = false;
    return results;
  }
  
  // Analyze county elements
  const countyElements = svg.querySelectorAll('.wtc-county');
  const seenIds = new Set();
  const foundSlugs = new Set();
  
  countyElements.forEach(element => {
    results.stats.totalCounties++;
    
    const id = element.getAttribute('id');
    const dataCounty = element.getAttribute('data-county');
    
    // Validate ID format
    if (!id) {
      results.errors.push('County element missing id attribute');
      results.valid = false;
      return;
    }
    
    if (!id.startsWith('wtc-county-')) {
      results.errors.push(`Invalid ID format: "${id}" (must start with "wtc-county-")`);
      results.valid = false;
      return;
    }
    
    const slug = id.substring('wtc-county-'.length);
    
    // Check for duplicate IDs
    if (seenIds.has(id)) {
      results.stats.duplicateIds.push(id);
      results.errors.push(`Duplicate county ID: "${id}"`);
      results.valid = false;
    } else {
      seenIds.add(id);
    }
    
    // Validate slug format (lowercase, hyphens, alphanumeric)
    if (!/^[a-z0-9\-]+$/.test(slug)) {
      results.errors.push(`Invalid slug format: "${slug}" (must be lowercase alphanumeric and hyphens)`);
      results.valid = false;
    }
    
    // Check if data-county attribute exists
    if (!dataCounty) {
      results.warnings.push(`Element ${id} missing data-county attribute`);
    }
    
    // Check for path or rect elements
    const tagName = element.tagName;
    if (tagName !== 'path' && tagName !== 'rect') {
      results.errors.push(`Invalid element type: ${tagName} (expected path or rect)`);
      results.valid = false;
    }
    
    if (tagName === 'path' && !element.getAttribute('d')) {
      results.errors.push(`Path element ${id} missing 'd' attribute`);
      results.valid = false;
    }
    
    if (tagName === 'rect') {
      const x = element.getAttribute('x');
      const y = element.getAttribute('y');
      const w = element.getAttribute('width');
      const h = element.getAttribute('height');
      if (!x || !y || !w || !h) {
        results.errors.push(`Rect element ${id} missing required attributes`);
        results.valid = false;
      }
    }
    
    foundSlugs.add(slug);
    results.stats.validCounties++;
  });
  
  // Compare found slugs with expected slugs
  if (expectedSlugs && expectedSlugs.size > 0) {
    expectedSlugs.forEach(slug => {
      if (!foundSlugs.has(slug)) {
        results.stats.missingSlugs.push(slug);
        results.errors.push(`Missing expected county: ${slug}`);
        results.valid = false;
      }
    });
    
    foundSlugs.forEach(slug => {
      if (!expectedSlugs.has(slug)) {
        results.stats.extraSlugs.push(slug);
        results.warnings.push(`Unexpected county slug: ${slug}`);
      }
    });
  }
  
  // Check county count parity
  if (expectedCount && foundSlugs.size !== expectedCount) {
    results.warnings.push(
      `County count mismatch: expected ${expectedCount}, found ${foundSlugs.size}`
    );
  }
  
  return results;
}

/**
 * Main validation runner
 */
function main() {
  console.log('📋 Validating county SVG files...\n');
  
  const manifest = parseManifest(MANIFEST_PATH);
  const states = {};
  
  // Group expected slugs by state
  Object.entries(manifest).forEach(([stateCode, data]) => {
    states[stateCode] = {
      expectedSlugs: data.expectedSlugs,
      expectedCount: data.counties.length
    };
  });
  
  // Validate each state SVG
  let totalErrors = 0;
  let totalWarnings = 0;
  const results = [];
  
  Object.entries(states).forEach(([stateCode, expectation]) => {
    const svgPath = path.join(DATA_PATH, stateCode.toLowerCase(), `${stateCode.toLowerCase()}-counties.svg`);
    const result = validateSVG(svgPath, stateCode, expectation.expectedSlugs, expectation.expectedCount);
    results.push(result);
    
    if (!result.valid) {
      totalErrors += result.errors.length;
    }
    totalWarnings += result.warnings.length;
  });
  
  // Report results
  console.log('📊 Validation Results\n');
  console.log('=' .repeat(80));
  
  const invalid = results.filter(r => !r.valid);
  const valid = results.filter(r => r.valid);
  
  console.log(`✅ Valid SVGs: ${valid.length}`);
  console.log(`❌ Invalid SVGs: ${invalid.length}`);
  console.log(`⚠️  Total warnings: ${totalWarnings}`);
  console.log(`🚫 Total errors: ${totalErrors}`);
  console.log('=' .repeat(80) + '\n');
  
  // Detail invalid results
  if (invalid.length > 0) {
    console.log('❌ INVALID SVGs:\n');
    invalid.forEach(result => {
      console.log(`\n${result.state}: ${result.file}`);
      result.errors.forEach(err => console.log(`  🚫 ${err}`));
      if (result.warnings.length > 0) {
        result.warnings.forEach(warn => console.log(`  ⚠️  ${warn}`));
      }
    });
  }
  
  // Summary by state
  console.log('\n✅ VALIDATION SUMMARY BY STATE:\n');
  console.log('State | Status | Counties | Issues');
  console.log('------|--------|----------|--------');
  
  results.forEach(result => {
    const status = result.valid ? '✅' : '❌';
    const issues = result.errors.length + result.warnings.length;
    console.log(
      `${result.state.padEnd(5)} | ${status.padEnd(6)} | ${String(result.stats.validCounties).padEnd(8)} | ${issues}`
    );
  });
  
  console.log('\n' + '=' .repeat(80));
  
  if (totalErrors > 0) {
    console.log(`\n❌ Validation FAILED with ${totalErrors} errors\n`);
    process.exit(1);
  } else if (totalWarnings > 0) {
    console.log(`\n⚠️  Validation passed with ${totalWarnings} warnings\n`);
    process.exit(0);
  } else {
    console.log(`\n✅ All SVGs validated successfully!\n`);
    process.exit(0);
  }
}

main();
