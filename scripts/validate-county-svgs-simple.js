#!/usr/bin/env node

/**
 * Simple regex-based SVG validation (no external XML libraries needed)
 * 
 * Usage: node scripts/validate-county-svgs.js
 */

const fs = require('fs');
const path = require('path');

const BASE_PATH = path.join(__dirname, '..', 'calculators', 'wealth-tax-calculator', 'wordpress', 'wealth-tax-calculator');
const DATA_PATH = path.join(BASE_PATH, 'data', 'states');
const MANIFEST_PATH = path.join(__dirname, 'county-manifest.csv');

function parseManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    console.warn(`⚠️  Manifest not found`);
    return {};
  }
  
  const content = fs.readFileSync(MANIFEST_PATH, 'utf8');
  const lines = content.trim().split('\n');
  const manifest = {};
  
  lines.slice(1).forEach(line => {
    const parts = line.split(',');
    const state = parts[0]?.toLowerCase();
    if (!state || !manifest[state]) {
      if (state) manifest[state] = { counties: [], slugSet: new Set() };
    }
    
    if (manifest[state] && parts[4]) {
      const slug = parts[4].trim();
      manifest[state].counties.push(slug);
      manifest[state].slugSet.add(slug);
    }
  });
  
  return manifest;
}

function validateSVG(svgPath, stateCode, expectedSlugs) {
  const errors = [];
  const warnings = [];
  
  // Read file
  if (!fs.existsSync(svgPath)) {
    return { errors: ['File does not exist'], warnings: [], count: 0 };
  }
  
  const content = fs.readFileSync(svgPath, 'utf8');
  
  // Check XML validity (basic)
  if (!content.includes('<?xml') && !content.includes('<svg')) {
    errors.push('Not a valid SVG file');
    return { errors, warnings, count: 0 };
  }
  
  // Check for SVG root element
  if (!/<svg[\s>]/.test(content)) {
    errors.push('Missing <svg> root element');
  }
  
  // Check for county container
  if (!/<g[\s>]/.test(content)) {
    warnings.push('Missing <g> container element');
  }
  
  // Count county elements (path or rect with wtc-county ID)
  const countyRegex = /id="wtc-county-([^"]+)"/g;
  const foundSlugs = new Set();
  let match;
  let count = 0;
  
  while ((match = countyRegex.exec(content)) !== null) {
    count++;
    const slug = match[1];
    foundSlugs.add(slug);
    
    // Validate slug format
    if (!/^[a-z0-9\-]+$/.test(slug)) {
      errors.push(`Invalid slug format: ${slug}`);
    }
  }
  
  // Check for duplicates
  const allMatches = content.match(countyRegex) || [];
  const slugCount = new Map();
  allMatches.forEach(m => {
    const slug = m.match(/wtc-county-([^"]+)/)[1];
    slugCount.set(slug, (slugCount.get(slug) || 0) + 1);
  });
  
  Array.from(slugCount.entries()).forEach(([slug, num]) => {
    if (num > 1) {
      errors.push(`Duplicate ID: wtc-county-${slug} (appears ${num} times)`);
    }
  });
  
  // Check for missing expected slugs
  if (expectedSlugs) {
    const missing = [];
    expectedSlugs.forEach(slug => {
      if (!foundSlugs.has(slug)) {
        missing.push(slug);
      }
    });
    
    if (missing.length > 0 && missing.length <= 5) {
      warnings.push(`Missing ${missing.length} counties: ${missing.slice(0, 3).join(', ')}${missing.length > 3 ? '...' : ''}`);
    } else if (missing.length > 0) {
      warnings.push(`Missing ${missing.length} counties`);
    }
  }
  
  return { errors, warnings, count };
}

function main() {
  console.log('📋 Validating county SVG files...\n');
  
  const manifest = parseManifest();
  
  if (Object.keys(manifest).length === 0) {
    console.warn('⚠️  Manifest is empty or missing\n');
  }
  
  const stateDir = DATA_PATH;
  
  if (!fs.existsSync(stateDir)) {
    console.error(`❌ State directory not found: ${stateDir}`);
    process.exit(1);
  }
  
  const states = fs.readdirSync(stateDir).filter(f => {
    return fs.statSync(path.join(stateDir, f)).isDirectory();
  }).sort();
  
  console.log(`Found ${states.length} state directories\n`);
  console.log('Validation Results:');
  console.log('=' .repeat(80) + '\n');
  
  let passCount = 0;
  let failCount = 0;
  let totalCounties = 0;
  
  states.forEach(state => {
    const stateCode = state.toLowerCase();
    const svgPath = path.join(stateDir, state, `${stateCode}-counties.svg`);
    const expected = manifest[stateCode]?.slugSet || null;
    const expectedCount = manifest[stateCode]?.counties.length || 0;
    
    const result = validateSVG(svgPath, stateCode, expected);
    
    let status = '✅';
    if (result.errors.length > 0) {
      status = '❌';
      failCount++;
    } else {
      passCount++;
    }
    
    totalCounties += result.count;
    
    console.log(`${status} ${state.toUpperCase()}: ${result.count} counties${expectedCount > 0 ? ` (expected: ${expectedCount})` : ''}`);
    
    if (result.errors.length > 0) {
      result.errors.forEach(err => console.log(`   ❌ ${err}`));
    }
    if (result.warnings.length > 0) {
      result.warnings.forEach(warn => console.log(`   ⚠️  ${warn}`));
    }
  });
  
  console.log('\n' + '='.repeat(80));
  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Passed: ${passCount} states`);
  console.log(`   ❌ Failed: ${failCount} states`);
  console.log(`   📈 Total counties: ${totalCounties}\n`);
  
  if (failCount === 0) {
    console.log(`✅ All states validated successfully!\n`);
  } else {
    console.log(`❌ ${failCount} state(s) need attention\n`);
  }
}

main();
