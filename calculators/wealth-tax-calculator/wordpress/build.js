#!/usr/bin/env node

/**
 * Build script for Wealth Tax Calculator WordPress Plugin
 * 
 * Creates a production-ready zip file for deployment:
 * - Includes only necessary files
 * - Excludes development files
 * - Creates wealth-tax-calculator.zip for GitHub releases
 */

const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const PLUGIN_DIR = 'wealth-tax-calculator';
const OUTPUT_FILE = 'wealth-tax-calculator.zip';

// Files and directories to include in the zip
const INCLUDE_PATTERNS = [
    'wealth-tax-calculator.php',
    'css/**',
    'js/**',
    'data/**'
];

// Files and directories to explicitly exclude
const EXCLUDE_PATTERNS = [
    '**/*.map',
    '**/node_modules/**',
    '**/.DS_Store',
    '**/Thumbs.db',
    '**/.git/**',
    '**/src/**',
    '**/*.log'
];

console.log('🔨 Building WordPress plugin zip...\n');

// Remove existing zip if present
if (fs.existsSync(OUTPUT_FILE)) {
    fs.unlinkSync(OUTPUT_FILE);
    console.log('  ✓ Removed existing zip file');
}

// Create archive
const output = fs.createWriteStream(OUTPUT_FILE);
const archive = archiver('zip', {
    zlib: { level: 9 } // Maximum compression
});

output.on('close', function() {
    const sizeInKB = (archive.pointer() / 1024).toFixed(2);
    console.log(`\n✅ Success! Created ${OUTPUT_FILE} (${sizeInKB} KB)`);
    console.log(`   Total files: ${archive.pointer()} bytes`);
    console.log('\n📦 Ready for deployment!');
    console.log('   Upload this file as a GitHub release asset named: wealth-tax-calculator.zip');
});

archive.on('error', function(err) {
    console.error('❌ Error creating zip:', err);
    process.exit(1);
});

archive.on('warning', function(err) {
    if (err.code === 'ENOENT') {
        console.warn('⚠️  Warning:', err);
    } else {
        throw err;
    }
});

archive.pipe(output);

// Add the entire plugin directory
console.log(`  📁 Adding files from ${PLUGIN_DIR}/`);

archive.directory(PLUGIN_DIR, PLUGIN_DIR, (entry) => {
    // Exclude unwanted files
    for (const pattern of EXCLUDE_PATTERNS) {
        const regex = new RegExp(pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'));
        if (regex.test(entry.name)) {
            return false;
        }
    }
    return entry;
});

console.log('  ⚙️  Compressing files...');
archive.finalize();
