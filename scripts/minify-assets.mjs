import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const pluginRoot = resolve(root, 'calculators/wealth-tax-calculator/wordpress/wealth-tax-calculator');

const targets = [
  {
    label: 'calculator JS',
    src: resolve(pluginRoot, 'js/calculator.js'),
    out: resolve(pluginRoot, 'js/calculator.min.js'),
    command: 'npx',
    args: [
      '--yes',
      'terser',
      'js/calculator.js',
      '--compress',
      '--mangle',
      '--comments',
      '/^!|@preserve|@license|@cc_on/i',
      '--output',
      'js/calculator.min.js'
    ]
  },
  {
    label: 'styles CSS',
    src: resolve(pluginRoot, 'css/styles.css'),
    out: resolve(pluginRoot, 'css/styles.min.css'),
    command: 'npx',
    args: [
      '--yes',
      'cleancss',
      '-O2',
      '-o',
      'css/styles.min.css',
      'css/styles.css'
    ]
  }
];

const checkMode = process.argv.includes('--check');

function runTarget(target) {
  const before = checkMode ? readFileSync(target.out, 'utf8') : null;

  const result = spawnSync(target.command, target.args, {
    cwd: pluginRoot,
    stdio: 'inherit',
    shell: false
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }

  if (!checkMode) {
    return;
  }

  const after = readFileSync(target.out, 'utf8');
  if (before !== after) {
    throw new Error(target.label + ' is out of sync. Run npm run minify and commit the updated minified files.');
  }
}

try {
  for (const target of targets) {
    runTarget(target);
  }
  if (checkMode) {
    process.stdout.write('Minified assets are in sync.\n');
  }
} catch (error) {
  process.stderr.write(String(error.message || error) + '\n');
  process.exit(1);
}
