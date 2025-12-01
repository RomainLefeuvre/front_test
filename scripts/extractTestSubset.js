#!/usr/bin/env node
/**
 * Extract Test Subset Script
 * 
 * Extracts a subset of 300 vulnerabilities from the full Parquet dataset
 * for end-to-end testing. Ensures diverse examples with multiple commits,
 * origins, and branches.
 * 
 * Requirements: 11.1
 * 
 * Usage:
 *   node scripts/extractTestSubset.js [options]
 * 
 * Options:
 *   --limit <number>         Number of vulnerabilities to extract (default: 300)
 *   --input-dir <dir>        Input Parquet directory (default: input_data)
 *   --output-dir <dir>       Output directory for test data (default: test-data)
 *   --cve-input <dir>        CVE JSON input directory (default: public/cve)
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync, copyFileSync } from 'fs';
import { join, dirname } from 'path';
import { spawn } from 'child_process';

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    limit: 300,
    inputDir: 'input_data',
    outputDir: 'test-data',
    cveInput: 'public/cve'
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--limit':
        config.limit = parseInt(args[++i], 10);
        break;
      case '--input-dir':
        config.inputDir = args[++i];
        break;
      case '--output-dir':
        config.outputDir = args[++i];
        break;
      case '--cve-input':
        config.cveInput = args[++i];
        break;
      case '--help':
        console.log(`
Extract Test Subset Script

Usage:
  node scripts/extractTestSubset.js [options]

Options:
  --limit <number>         Number of vulnerabilities to extract (default: 300)
  --input-dir <dir>        Input Parquet directory (default: input_data)
  --output-dir <dir>       Output directory for test data (default: test-data)
  --cve-input <dir>        CVE JSON input directory (default: public/cve)
  --help                   Show this help message
        `);
        process.exit(0);
    }
  }

  return config;
}

/**
 * Execute DuckDB query using Docker
 */
async function executeDuckDBQuery(query, outputFile) {
  return new Promise((resolve, reject) => {
    // Use docker run with DuckDB image
    const docker = spawn('docker', [
      'run',
      '--rm',
      '-v', `${process.cwd()}:/data`,
      '-w', '/data',
      'davidgasquez/duckdb:latest',
      'duckdb',
      '-c', query
    ]);
    
    let stdout = '';
    let stderr = '';
    
    docker.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    docker.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    docker.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`DuckDB query failed with code ${code}: ${stderr}`));
      }
    });
    
    docker.on('error', (err) => {
      reject(new Error(`Failed to execute Docker: ${err.message}`));
    });
  });
}

/**
 * Extract subset of vulnerable commits
 */
async function extractVulnerableCommits(config) {
  console.log('\n📊 Extracting vulnerable commits subset...');
  
  const inputPath = join(config.inputDir, 'vulnerable_commits_using_cherrypicks_swhid', '*.parquet');
  const outputPath = join(config.outputDir, 'vulnerable_commits_using_cherrypicks_swhid', '0.parquet');
  
  // Create output directory
  mkdirSync(dirname(outputPath), { recursive: true });
  
  // Query to get diverse sample - process only first file to reduce memory usage
  const firstFile = join(config.inputDir, 'vulnerable_commits_using_cherrypicks_swhid', '0.parquet');
  const query = `
    COPY (
      SELECT DISTINCT ON (revision_id) 
        revision_id, 
        vulnerability_filename
      FROM read_parquet('${firstFile}')
      ORDER BY revision_id, random()
      LIMIT ${Math.floor(config.limit / 2)}
    ) TO '${outputPath}' (FORMAT PARQUET);
  `;
  
  try {
    await executeDuckDBQuery(query);
    console.log(`✅ Extracted vulnerable commits to ${outputPath}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to extract vulnerable commits: ${error.message}`);
    return false;
  }
}

/**
 * Extract subset of vulnerable origins
 */
async function extractVulnerableOrigins(config) {
  console.log('\n📊 Extracting vulnerable origins subset...');
  
  const inputPath = join(config.inputDir, 'vulnerable_origins', '*.parquet');
  const outputPath = join(config.outputDir, 'vulnerable_origins', '0.parquet');
  
  // Create output directory
  mkdirSync(dirname(outputPath), { recursive: true });
  
  // Query to get diverse sample with multiple branches - process only first file to reduce memory usage
  const firstFile = join(config.inputDir, 'vulnerable_origins', '0.parquet');
  const query = `
    COPY (
      WITH ranked_origins AS (
        SELECT 
          origin,
          revision_id,
          branch_name,
          vulnerability_filename,
          ROW_NUMBER() OVER (PARTITION BY origin ORDER BY random()) as rn
        FROM read_parquet('${firstFile}')
      )
      SELECT 
        origin,
        revision_id,
        branch_name,
        vulnerability_filename
      FROM ranked_origins
      WHERE rn <= 3
      LIMIT ${Math.floor(config.limit / 2)}
    ) TO '${outputPath}' (FORMAT PARQUET);
  `;
  
  try {
    await executeDuckDBQuery(query);
    console.log(`✅ Extracted vulnerable origins to ${outputPath}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to extract vulnerable origins: ${error.message}`);
    return false;
  }
}

/**
 * Get list of vulnerability filenames from extracted Parquet files
 */
async function getVulnerabilityFilenames(config) {
  console.log('\n📋 Getting list of vulnerability filenames...');
  
  const filenames = new Set();
  
  // Query commits
  const commitsPath = join(config.outputDir, 'vulnerable_commits_using_cherrypicks_swhid', '0.parquet');
  if (existsSync(commitsPath)) {
    const query = `
      SELECT DISTINCT vulnerability_filename 
      FROM read_parquet('${commitsPath}');
    `;
    
    try {
      const result = await executeDuckDBQuery(query);
      // Parse the output (DuckDB outputs in table format)
      const lines = result.split('\n').filter(line => line.trim() && !line.includes('─') && !line.includes('vulnerability_filename'));
      for (const line of lines) {
        const filename = line.trim().replace(/│/g, '').trim();
        if (filename) {
          filenames.add(filename);
        }
      }
    } catch (error) {
      console.error(`⚠️  Failed to query commits: ${error.message}`);
    }
  }
  
  // Query origins
  const originsPath = join(config.outputDir, 'vulnerable_origins', '0.parquet');
  if (existsSync(originsPath)) {
    const query = `
      SELECT DISTINCT vulnerability_filename 
      FROM read_parquet('${originsPath}');
    `;
    
    try {
      const result = await executeDuckDBQuery(query);
      const lines = result.split('\n').filter(line => line.trim() && !line.includes('─') && !line.includes('vulnerability_filename'));
      for (const line of lines) {
        const filename = line.trim().replace(/│/g, '').trim();
        if (filename) {
          filenames.add(filename);
        }
      }
    } catch (error) {
      console.error(`⚠️  Failed to query origins: ${error.message}`);
    }
  }
  
  console.log(`✅ Found ${filenames.size} unique vulnerability filenames`);
  return Array.from(filenames);
}

/**
 * Copy corresponding CVE JSON files
 */
async function copyCVEFiles(filenames, config) {
  console.log('\n📄 Copying CVE JSON files...');
  
  if (!existsSync(config.cveInput)) {
    console.error(`❌ CVE input directory not found: ${config.cveInput}`);
    console.log('   Run "npm run extract-cve" first to extract CVE data');
    return 0;
  }
  
  const cveOutputDir = join(config.outputDir, 'cve');
  mkdirSync(cveOutputDir, { recursive: true });
  
  let copiedCount = 0;
  let missingCount = 0;
  
  for (const filename of filenames) {
    const sourcePath = join(config.cveInput, filename);
    const destPath = join(cveOutputDir, filename);
    
    if (existsSync(sourcePath)) {
      // Create subdirectory if needed
      const destDir = dirname(destPath);
      if (!existsSync(destDir)) {
        mkdirSync(destDir, { recursive: true });
      }
      
      try {
        copyFileSync(sourcePath, destPath);
        copiedCount++;
        
        if (copiedCount % 50 === 0) {
          console.log(`  Copied ${copiedCount}/${filenames.length} files...`);
        }
      } catch (error) {
        console.error(`  ⚠️  Failed to copy ${filename}: ${error.message}`);
      }
    } else {
      missingCount++;
    }
  }
  
  console.log(`✅ Copied ${copiedCount} CVE files`);
  if (missingCount > 0) {
    console.log(`⚠️  ${missingCount} CVE files were not found in ${config.cveInput}`);
  }
  
  return copiedCount;
}

/**
 * Generate summary report
 */
async function generateReport(config, stats) {
  const reportPath = join(config.outputDir, 'test-subset-report.txt');
  
  const report = `
Test Data Subset Extraction Report
===================================
Generated: ${new Date().toISOString()}

Configuration:
--------------
Target vulnerabilities: ${config.limit}
Input directory: ${config.inputDir}
Output directory: ${config.outputDir}
CVE input directory: ${config.cveInput}

Results:
--------
Vulnerable commits extracted: ${stats.commitsExtracted ? 'Yes' : 'No'}
Vulnerable origins extracted: ${stats.originsExtracted ? 'Yes' : 'No'}
Unique vulnerability filenames: ${stats.uniqueFilenames}
CVE files copied: ${stats.cveFilesCopied}

Output Structure:
-----------------
${config.outputDir}/
├── vulnerable_commits_using_cherrypicks_swhid/
│   └── 0.parquet
├── vulnerable_origins/
│   └── 0.parquet
└── cve/
    ├── *.json (root level CVEs)
    └── nvd_cve/
        └── *.json (nvd_cve CVEs)

Status: ${stats.commitsExtracted && stats.originsExtracted && stats.cveFilesCopied > 0 ? '✅ SUCCESS' : '⚠️  PARTIAL SUCCESS'}

Next Steps:
-----------
1. Ensure MinIO is running: docker-compose up -d
2. Upload test data to MinIO: npm run upload-s3 -- --parquet-dir ${config.outputDir} --cve-dir ${config.outputDir}/cve --bucket vuln-data-test
3. Run end-to-end tests: npm run test:e2e
`;
  
  writeFileSync(reportPath, report);
  console.log(report);
  console.log(`\n📄 Report saved to: ${reportPath}`);
}

/**
 * Main function
 */
async function main() {
  console.log('🔬 Test Data Subset Extraction');
  console.log('==============================\n');
  
  const config = parseArgs();
  
  console.log('Configuration:');
  console.log(`  Target vulnerabilities: ${config.limit}`);
  console.log(`  Input directory: ${config.inputDir}`);
  console.log(`  Output directory: ${config.outputDir}`);
  console.log(`  CVE input directory: ${config.cveInput}`);
  
  const stats = {
    commitsExtracted: false,
    originsExtracted: false,
    uniqueFilenames: 0,
    cveFilesCopied: 0
  };
  
  try {
    // Extract Parquet subsets
    stats.commitsExtracted = await extractVulnerableCommits(config);
    stats.originsExtracted = await extractVulnerableOrigins(config);
    
    // Get list of vulnerability filenames
    const filenames = await getVulnerabilityFilenames(config);
    stats.uniqueFilenames = filenames.length;
    
    // Copy corresponding CVE files
    stats.cveFilesCopied = await copyCVEFiles(filenames, config);
    
    // Generate report
    await generateReport(config, stats);
    
    // Exit with appropriate code
    if (stats.commitsExtracted && stats.originsExtracted && stats.cveFilesCopied > 0) {
      console.log('\n✅ Test data subset extraction completed successfully!');
      process.exit(0);
    } else {
      console.log('\n⚠️  Test data subset extraction completed with warnings');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { extractVulnerableCommits, extractVulnerableOrigins, copyCVEFiles };
