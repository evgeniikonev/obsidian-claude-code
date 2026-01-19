#!/usr/bin/env node
/**
 * Version bump script for Obsidian plugin
 * Usage: node version.mjs <major|minor|patch>
 *
 * Updates version in:
 * - package.json
 * - manifest.json
 *
 * Runs lint and typecheck before bumping.
 * Then run: git tag <version> && git push --tags
 */

import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

const bumpType = process.argv[2];

if (!['major', 'minor', 'patch'].includes(bumpType)) {
  console.log('Usage: node version.mjs <major|minor|patch>');
  console.log('');
  console.log('Example:');
  console.log('  node version.mjs patch   # 0.1.0 -> 0.1.1');
  console.log('  node version.mjs minor   # 0.1.0 -> 0.2.0');
  console.log('  node version.mjs major   # 0.1.0 -> 1.0.0');
  process.exit(1);
}

// Run lint and typecheck before bumping
console.log('Running pre-release checks...');
console.log('');

try {
  console.log('→ Running lint...');
  execSync('npm run lint', { stdio: 'inherit' });
  console.log('✓ Lint passed');
  console.log('');

  console.log('→ Running typecheck...');
  execSync('npm run typecheck', { stdio: 'inherit' });
  console.log('✓ Typecheck passed');
  console.log('');
} catch (error) {
  console.error('');
  console.error('❌ Pre-release checks failed. Fix the issues before releasing.');
  process.exit(1);
}

// Read current versions
const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const manifestJson = JSON.parse(readFileSync('manifest.json', 'utf8'));

const currentVersion = packageJson.version;
const [major, minor, patch] = currentVersion.split('.').map(Number);

let newVersion;
switch (bumpType) {
  case 'major':
    newVersion = `${major + 1}.0.0`;
    break;
  case 'minor':
    newVersion = `${major}.${minor + 1}.0`;
    break;
  case 'patch':
    newVersion = `${major}.${minor}.${patch + 1}`;
    break;
}

console.log(`Bumping version: ${currentVersion} -> ${newVersion}`);

// Update package.json
packageJson.version = newVersion;
writeFileSync('package.json', JSON.stringify(packageJson, null, 2) + '\n');
console.log('✓ Updated package.json');

// Update manifest.json
manifestJson.version = newVersion;
writeFileSync('manifest.json', JSON.stringify(manifestJson, null, 2) + '\n');
console.log('✓ Updated manifest.json');

console.log('');
console.log('Next steps:');
console.log(`  git add package.json manifest.json`);
console.log(`  git commit -m "Bump version to ${newVersion}"`);
console.log(`  git tag ${newVersion}`);
console.log(`  git push && git push --tags`);
console.log('');
console.log('GitHub Actions will automatically create the release.');
