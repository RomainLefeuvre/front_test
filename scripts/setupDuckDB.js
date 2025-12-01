/**
 * Setup script to copy DuckDB WASM files to public directory
 * This avoids CORS and mixed content issues when loading from CDN
 */

import { copyFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Create public/duckdb directory if it doesn't exist
const duckdbDir = join(projectRoot, 'public', 'duckdb');
if (!existsSync(duckdbDir)) {
  mkdirSync(duckdbDir, { recursive: true });
  console.log('✓ Created public/duckdb directory');
}

// Copy DuckDB WASM files - all variants for automatic selection
const files = [
  // Exception handling variant
  'duckdb-browser-eh.worker.js',
  'duckdb-eh.wasm',
  // MVP (most compatible) variant
  'duckdb-browser-mvp.worker.js',
  'duckdb-mvp.wasm',
  // COI (Cross-Origin Isolated) variant
  'duckdb-browser-coi.worker.js',
  'duckdb-coi.wasm',
];

const sourceDir = join(projectRoot, 'node_modules', '@duckdb', 'duckdb-wasm', 'dist');

for (const file of files) {
  const source = join(sourceDir, file);
  const dest = join(duckdbDir, file);
  
  try {
    copyFileSync(source, dest);
    console.log(`✓ Copied ${file}`);
  } catch (error) {
    console.error(`✗ Failed to copy ${file}:`, error.message);
    process.exit(1);
  }
}

console.log('✓ DuckDB WASM files setup complete');
