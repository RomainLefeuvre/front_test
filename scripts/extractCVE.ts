#!/usr/bin/env node
/**
 * CVE Extraction Script
 * 
 * Extracts CVE JSON files from:
 * 1. all.zip - contains CVE files for root level
 * 2. tar.zst files in nvd_cve/ - contains CVE files for nvd_cve/ subdirectory
 * 
 * Maintains directory structure: root vs nvd_cve/
 * Requirements: 8.1, 8.4, 8.5
 */

import AdmZip from 'adm-zip';
import { createReadStream, createWriteStream, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname, basename } from 'path';
import { pipeline } from 'stream/promises';
import { createGunzip } from 'zlib';
import tar from 'tar';
import { spawn } from 'child_process';

interface ExtractionStats {
  totalFiles: number;
  successfulExtractions: number;
  failedExtractions: number;
  malformedFiles: string[];
  extractionErrors: Array<{ file: string; error: string }>;
}

const stats: ExtractionStats = {
  totalFiles: 0,
  successfulExtractions: 0,
  failedExtractions: 0,
  malformedFiles: [],
  extractionErrors: []
};

/**
 * Extract all.zip to output directory using unzip command
 */
async function extractAllZip(zipPath: string, outputDir: string): Promise<void> {
  console.log(`Extracting ${zipPath}...`);
  
  if (!existsSync(zipPath)) {
    throw new Error(`File not found: ${zipPath}`);
  }

  try {
    // Use unzip command for better memory efficiency with large files
    await new Promise<void>((resolve, reject) => {
      const unzip = spawn('unzip', ['-q', '-o', zipPath, '*.json', '-d', outputDir]);
      
      let errorOutput = '';
      
      unzip.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      unzip.on('close', (code) => {
        if (code === 0 || code === 1) { // 1 means some files were skipped, which is ok
          resolve();
        } else {
          reject(new Error(`unzip failed with code ${code}: ${errorOutput}`));
        }
      });
      
      unzip.on('error', (err) => {
        reject(new Error(`unzip process error: ${err.message}`));
      });
    });
    
    // Count extracted files
    const extractedCount = countJsonFiles(outputDir);
    stats.totalFiles += extractedCount;
    stats.successfulExtractions += extractedCount;
    
    console.log(`✓ Extracted ${extractedCount} files from all.zip`);
  } catch (error) {
    throw new Error(`Failed to extract all.zip: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Extract a single tar.zst file using external zstd command
 */
async function extractTarZst(tarZstPath: string, outputDir: string): Promise<void> {
  const fileName = basename(tarZstPath);
  
  if (!existsSync(tarZstPath)) {
    throw new Error(`File not found: ${tarZstPath}`);
  }

  try {
    // Use zstd command to decompress and tar to extract
    await new Promise<void>((resolve, reject) => {
      const zstd = spawn('zstd', ['-d', '-c', tarZstPath]);
      const tarExtract = spawn('tar', ['-x', '-C', outputDir]);
      
      zstd.stdout.pipe(tarExtract.stdin);
      
      let errorOutput = '';
      
      zstd.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      tarExtract.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      tarExtract.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`tar extraction failed with code ${code}: ${errorOutput}`));
        }
      });
      
      zstd.on('error', (err) => {
        reject(new Error(`zstd process error: ${err.message}`));
      });
      
      tarExtract.on('error', (err) => {
        reject(new Error(`tar process error: ${err.message}`));
      });
    });
    
  } catch (error) {
    throw new Error(`Failed to extract ${fileName}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Extract all tar.zst files from nvd_cve directory
 */
async function extractNvdCveArchives(nvdCveDir: string, outputDir: string): Promise<void> {
  console.log(`\nExtracting tar.zst files from ${nvdCveDir}...`);
  
  if (!existsSync(nvdCveDir)) {
    throw new Error(`Directory not found: ${nvdCveDir}`);
  }

  // Create nvd_cve output directory
  const nvdCveOutputDir = join(outputDir, 'nvd_cve');
  await mkdir(nvdCveOutputDir, { recursive: true });

  const files = readdirSync(nvdCveDir);
  const tarZstFiles = files.filter(f => f.endsWith('.tar.zst'));
  
  console.log(`Found ${tarZstFiles.length} tar.zst files`);
  
  let processedCount = 0;
  
  for (const file of tarZstFiles) {
    const filePath = join(nvdCveDir, file);
    
    try {
      await extractTarZst(filePath, nvdCveOutputDir);
      processedCount++;
      
      // Count extracted JSON files
      const extractedFiles = countJsonFiles(nvdCveOutputDir);
      stats.totalFiles = extractedFiles;
      stats.successfulExtractions = extractedFiles;
      
      if (processedCount % 10 === 0) {
        console.log(`  Processed ${processedCount}/${tarZstFiles.length} archives...`);
      }
    } catch (error) {
      stats.failedExtractions++;
      stats.extractionErrors.push({
        file,
        error: error instanceof Error ? error.message : String(error)
      });
      console.error(`  ✗ Failed to extract ${file}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  console.log(`✓ Extracted ${processedCount} tar.zst archives`);
}

/**
 * Count JSON files in a directory recursively
 */
function countJsonFiles(dir: string): number {
  let count = 0;
  
  if (!existsSync(dir)) {
    return 0;
  }
  
  const items = readdirSync(dir);
  
  for (const item of items) {
    const fullPath = join(dir, item);
    const stat = statSync(fullPath);
    
    if (stat.isDirectory()) {
      count += countJsonFiles(fullPath);
    } else if (item.endsWith('.json')) {
      count++;
    }
  }
  
  return count;
}

/**
 * Validate that a file contains valid OSV-format JSON
 */
async function validateOSVFormat(filePath: string): Promise<boolean> {
  try {
    const content = await readFile(filePath, 'utf-8');
    const json = JSON.parse(content);
    
    // Basic OSV format validation - must have an id field
    if (!json.id) {
      return false;
    }
    
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Validate all extracted JSON files
 */
async function validateExtractedFiles(outputDir: string): Promise<void> {
  console.log(`\nValidating extracted JSON files...`);
  
  const validateDirectory = async (dir: string): Promise<void> => {
    if (!existsSync(dir)) {
      return;
    }
    
    const items = readdirSync(dir);
    
    for (const item of items) {
      const fullPath = join(dir, item);
      const stat = statSync(fullPath);
      
      if (stat.isDirectory()) {
        await validateDirectory(fullPath);
      } else if (item.endsWith('.json')) {
        const isValid = await validateOSVFormat(fullPath);
        
        if (!isValid) {
          stats.malformedFiles.push(fullPath);
        }
      }
    }
  };
  
  await validateDirectory(outputDir);
  
  if (stats.malformedFiles.length > 0) {
    console.log(`⚠ Found ${stats.malformedFiles.length} malformed files`);
  } else {
    console.log(`✓ All files are valid OSV format`);
  }
}

/**
 * Generate extraction report
 */
function generateReport(): string {
  const report = `
CVE Extraction Report
=====================
Generated: ${new Date().toISOString()}

Summary:
--------
Total files processed: ${stats.totalFiles}
Successful extractions: ${stats.successfulExtractions}
Failed extractions: ${stats.failedExtractions}
Malformed JSON files: ${stats.malformedFiles.length}

${stats.malformedFiles.length > 0 ? `
Malformed Files:
----------------
${stats.malformedFiles.map(f => `  - ${f}`).join('\n')}
` : ''}

${stats.extractionErrors.length > 0 ? `
Extraction Errors:
------------------
${stats.extractionErrors.map(e => `  - ${e.file}: ${e.error}`).join('\n')}
` : ''}

Status: ${stats.failedExtractions === 0 && stats.malformedFiles.length === 0 ? '✓ SUCCESS' : '⚠ COMPLETED WITH WARNINGS'}
`;
  
  return report;
}

/**
 * Main extraction function
 */
async function main() {
  const inputDir = process.argv[2] || 'input_data';
  const outputDir = process.argv[3] || 'public/cve';
  const skipValidation = process.argv.includes('--skip-validation');
  
  console.log('CVE Extraction Script');
  console.log('====================');
  console.log(`Input directory: ${inputDir}`);
  console.log(`Output directory: ${outputDir}`);
  console.log(`Validation: ${skipValidation ? 'SKIPPED' : 'ENABLED'}`);
  console.log('');
  
  try {
    // Create output directory
    await mkdir(outputDir, { recursive: true });
    
    // Extract all.zip
    const allZipPath = join(inputDir, 'CVE', 'all.zip');
    await extractAllZip(allZipPath, outputDir);
    
    // Extract tar.zst files from nvd_cve/
    const nvdCveDir = join(inputDir, 'CVE', 'nvd_cve');
    await extractNvdCveArchives(nvdCveDir, outputDir);
    
    // Validate extracted files (optional, can be slow for large datasets)
    if (!skipValidation) {
      await validateExtractedFiles(outputDir);
    } else {
      console.log('\n⚠ Validation skipped (use without --skip-validation to enable)');
    }
    
    // Generate and save report
    const report = generateReport();
    console.log(report);
    
    const reportPath = join(outputDir, 'extraction-report.txt');
    await writeFile(reportPath, report);
    console.log(`\nReport saved to: ${reportPath}`);
    
    // Exit with appropriate code
    process.exit(stats.failedExtractions > 0 || stats.malformedFiles.length > 0 ? 1 : 0);
    
  } catch (error) {
    console.error('Fatal error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { extractAllZip, extractTarZst, extractNvdCveArchives, validateOSVFormat, validateExtractedFiles };
