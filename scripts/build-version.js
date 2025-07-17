#!/usr/bin/env node

/**
 * Build Version Generator
 * Creates a version.json file with current version and timestamp for cache busting
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get project root
const projectRoot = path.resolve(__dirname, '..');
const packageJsonPath = path.join(projectRoot, 'package.json');
const distPath = path.join(projectRoot, 'dist');
const versionFilePath = path.join(distPath, 'version.json');

/**
 * Get version from package.json
 */
function getPackageVersion() {
  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    return packageJson.version;
  } catch (error) {
    console.error('Failed to read package.json:', error);
    return '0.0.0';
  }
}

/**
 * Get git commit hash if available
 */
function getGitCommit() {
  try {
    const { execSync } = require('child_process');
    const commit = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
    return commit;
  } catch (error) {
    console.warn('Could not get git commit hash:', error.message);
    return null;
  }
}

/**
 * Generate version information
 */
function generateVersionInfo() {
  const version = getPackageVersion();
  const commit = getGitCommit();
  const timestamp = Date.now();
  const buildDate = new Date().toISOString();
  
  return {
    version,
    commit,
    timestamp,
    buildDate,
    // Add build metadata
    buildId: `${version}-${commit || 'unknown'}-${timestamp}`,
    // Cache busting query params
    cacheBuster: `v=${version}&t=${timestamp}`
  };
}

/**
 * Ensure dist directory exists
 */
function ensureDistDirectory() {
  if (!fs.existsSync(distPath)) {
    fs.mkdirSync(distPath, { recursive: true });
  }
}

/**
 * Write version file
 */
function writeVersionFile(versionInfo) {
  ensureDistDirectory();
  
  const versionJson = JSON.stringify(versionInfo, null, 2);
  fs.writeFileSync(versionFilePath, versionJson, 'utf8');
  
  console.log('Version file generated:', versionFilePath);
  console.log('Version info:', versionInfo);
}

/**
 * Main function
 */
function main() {
  try {
    const versionInfo = generateVersionInfo();
    writeVersionFile(versionInfo);
    
    console.log('✅ Version file created successfully');
  } catch (error) {
    console.error('❌ Failed to generate version file:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { generateVersionInfo, writeVersionFile };