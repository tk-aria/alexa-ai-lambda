#!/usr/bin/env node
/**
 * Package Lambda function as ZIP using Node.js (no zip command needed)
 */
const AdmZip = require('/tmp/node_modules/adm-zip');
const path = require('path');
const fs = require('fs');

const PROJECT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(PROJECT_DIR, 'dist');

console.log('==> Packaging Lambda as ZIP (Node.js)...');

// Create dist directory
fs.mkdirSync(DIST_DIR, { recursive: true });

const zip = new AdmZip();

// Add source files
const srcDir = path.join(PROJECT_DIR, 'src');
const srcFiles = fs.readdirSync(srcDir);
for (const file of srcFiles) {
  const filePath = path.join(srcDir, file);
  if (fs.statSync(filePath).isFile()) {
    zip.addLocalFile(filePath, 'src');
  }
}

// Add package.json
zip.addLocalFile(path.join(PROJECT_DIR, 'package.json'));

// Add node_modules
function addDirectoryRecursive(dirPath, zipPath) {
  const entries = fs.readdirSync(dirPath);
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry);
    const entryZipPath = path.join(zipPath, entry);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      addDirectoryRecursive(fullPath, entryZipPath);
    } else if (stat.isFile()) {
      zip.addLocalFile(fullPath, zipPath);
    }
  }
}

const nodeModulesDir = path.join(PROJECT_DIR, 'node_modules');
if (fs.existsSync(nodeModulesDir)) {
  console.log('Adding node_modules...');
  addDirectoryRecursive(nodeModulesDir, 'node_modules');
}

// Write ZIP
const outputPath = path.join(DIST_DIR, 'lambda.zip');
zip.writeZip(outputPath);

const stats = fs.statSync(outputPath);
console.log(`==> Package created: ${outputPath}`);
console.log(`==> Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
