#!/usr/bin/env node
/**
 * S3 Upload Script for Local Development
 * 
 * Uploads Parquet files and CVE JSON files to MinIO (or any S3-compatible storage)
 * Maintains directory structure in S3 to match expected paths
 * 
 * Requirements: 7.2
 * 
 * Usage:
 *   node scripts/uploadToS3.js [options]
 * 
 * Options:
 *   --endpoint <url>     S3 endpoint URL (default: http://localhost:9000)
 *   --bucket <name>      S3 bucket name (default: vuln-data-dev)
 *   --region <region>    S3 region (default: us-east-1)
 *   --access-key <key>   AWS access key (default: minioadmin)
 *   --secret-key <key>   AWS secret key (default: minioadmin)
 *   --parquet-dir <dir>  Parquet files directory (default: input_data)
 *   --cve-dir <dir>      CVE JSON files directory (default: public/cve)
 *   --dry-run            Show what would be uploaded without uploading
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, relative, sep } from 'path';
import { spawn } from 'child_process';

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    endpoint: 'http://localhost:9000',
    bucket: 'vuln-data-dev',
    region: 'us-east-1',
    accessKey: 'minioadmin',
    secretKey: 'minioadmin',
    parquetDir: 'input_data',
    cveDir: 'public/cve',
    dryRun: false
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--endpoint':
        config.endpoint = args[++i];
        break;
      case '--bucket':
        config.bucket = args[++i];
        break;
      case '--region':
        config.region = args[++i];
        break;
      case '--access-key':
        config.accessKey = args[++i];
        break;
      case '--secret-key':
        config.secretKey = args[++i];
        break;
      case '--parquet-dir':
        config.parquetDir = args[++i];
        break;
      case '--cve-dir':
        config.cveDir = args[++i];
        break;
      case '--dry-run':
        config.dryRun = true;
        break;
      case '--help':
        console.log(`
S3 Upload Script for Local Development

Usage:
  node scripts/uploadToS3.js [options]

Options:
  --endpoint <url>     S3 endpoint URL (default: http://localhost:9000)
  --bucket <name>      S3 bucket name (default: vuln-data-dev)
  --region <region>    S3 region (default: us-east-1)
  --access-key <key>   AWS access key (default: minioadmin)
  --secret-key <key>   AWS secret key (default: minioadmin)
  --parquet-dir <dir>  Parquet files directory (default: input_data)
  --cve-dir <dir>      CVE JSON files directory (default: public/cve)
  --dry-run            Show what would be uploaded without uploading
  --help               Show this help message
        `);
        process.exit(0);
    }
  }

  return config;
}

// Statistics tracking
const stats = {
  totalFiles: 0,
  uploadedFiles: 0,
  failedFiles: 0,
  totalBytes: 0,
  errors: []
};

/**
 * Execute AWS CLI command
 */
function executeAwsCommand(args, config) {
  return new Promise((resolve, reject) => {
    const env = {
      ...process.env,
      AWS_ACCESS_KEY_ID: config.accessKey,
      AWS_SECRET_ACCESS_KEY: config.secretKey,
      AWS_DEFAULT_REGION: config.region
    };

    const aws = spawn('aws', args, { env });
    
    let stdout = '';
    let stderr = '';
    
    aws.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    aws.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    aws.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`AWS CLI failed with code ${code}: ${stderr}`));
      }
    });
    
    aws.on('error', (err) => {
      reject(new Error(`Failed to execute AWS CLI: ${err.message}`));
    });
  });
}

/**
 * Check if AWS CLI is installed
 */
async function checkAwsCli() {
  try {
    await new Promise((resolve, reject) => {
      const aws = spawn('aws', ['--version']);
      aws.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error('AWS CLI not found'));
      });
      aws.on('error', () => reject(new Error('AWS CLI not found')));
    });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Create bucket if it doesn't exist
 */
async function ensureBucket(config) {
  console.log(`Checking if bucket '${config.bucket}' exists...`);
  
  try {
    // Try to head bucket
    await executeAwsCommand([
      '--endpoint-url', config.endpoint,
      's3api', 'head-bucket',
      '--bucket', config.bucket
    ], config);
    
    console.log(`✓ Bucket '${config.bucket}' exists`);
  } catch (error) {
    console.log(`Bucket '${config.bucket}' does not exist, creating...`);
    
    try {
      await executeAwsCommand([
        '--endpoint-url', config.endpoint,
        's3api', 'create-bucket',
        '--bucket', config.bucket
      ], config);
      
      console.log(`✓ Created bucket '${config.bucket}'`);
    } catch (createError) {
      throw new Error(`Failed to create bucket: ${createError.message}`);
    }
  }
}

/**
 * Get all files recursively from a directory
 */
function getFilesRecursively(dir, fileList = []) {
  if (!existsSync(dir)) {
    return fileList;
  }

  const files = readdirSync(dir);

  for (const file of files) {
    const filePath = join(dir, file);
    const stat = statSync(filePath);

    if (stat.isDirectory()) {
      getFilesRecursively(filePath, fileList);
    } else {
      fileList.push({
        path: filePath,
        size: stat.size
      });
    }
  }

  return fileList;
}

/**
 * Upload a single file to S3
 */
async function uploadFile(localPath, s3Key, config) {
  const fileSize = statSync(localPath).size;
  const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(2);
  
  if (config.dryRun) {
    console.log(`  [DRY RUN] Would upload: ${localPath} -> s3://${config.bucket}/${s3Key} (${fileSizeMB} MB)`);
    stats.uploadedFiles++;
    stats.totalBytes += fileSize;
    return;
  }

  try {
    await executeAwsCommand([
      '--endpoint-url', config.endpoint,
      's3', 'cp',
      localPath,
      `s3://${config.bucket}/${s3Key}`,
      '--no-progress'
    ], config);
    
    stats.uploadedFiles++;
    stats.totalBytes += fileSize;
    console.log(`  ✓ Uploaded: ${s3Key} (${fileSizeMB} MB)`);
  } catch (error) {
    stats.failedFiles++;
    stats.errors.push({ file: localPath, error: error.message });
    console.error(`  ✗ Failed to upload ${localPath}: ${error.message}`);
  }
}

/**
 * Upload Parquet files
 */
async function uploadParquetFiles(config) {
  console.log('\nUploading Parquet files...');
  console.log('=========================');

  const parquetDirs = [
    'vulnerable_commits_using_cherrypicks_swhid',
    'vulnerable_origins'
  ];

  for (const dir of parquetDirs) {
    const localDir = join(config.parquetDir, dir);
    
    if (!existsSync(localDir)) {
      console.log(`⚠ Directory not found: ${localDir}, skipping...`);
      continue;
    }

    console.log(`\nProcessing ${dir}/...`);
    const files = getFilesRecursively(localDir);
    
    if (files.length === 0) {
      console.log(`  No files found in ${localDir}`);
      continue;
    }

    stats.totalFiles += files.length;

    for (const file of files) {
      // Maintain directory structure in S3
      const relativePath = relative(config.parquetDir, file.path);
      // Normalize path separators to forward slashes for S3
      const s3Key = relativePath.split(sep).join('/');
      
      await uploadFile(file.path, s3Key, config);
    }
  }
}

/**
 * Upload CVE JSON files
 */
async function uploadCveFiles(config) {
  console.log('\nUploading CVE JSON files...');
  console.log('==========================');

  if (!existsSync(config.cveDir)) {
    console.log(`⚠ CVE directory not found: ${config.cveDir}`);
    console.log('  Run "npm run extract-cve" first to extract CVE data');
    return;
  }

  const files = getFilesRecursively(config.cveDir);
  
  if (files.length === 0) {
    console.log(`  No files found in ${config.cveDir}`);
    console.log('  Run "npm run extract-cve" first to extract CVE data');
    return;
  }

  stats.totalFiles += files.length;

  // Upload files maintaining directory structure
  for (const file of files) {
    // Skip non-JSON files (like extraction reports)
    if (!file.path.endsWith('.json')) {
      continue;
    }

    // Get relative path from cve directory
    const relativePath = relative(config.cveDir, file.path);
    // Normalize path separators and prepend 'cve/' prefix
    const s3Key = 'cve/' + relativePath.split(sep).join('/');
    
    await uploadFile(file.path, s3Key, config);
  }
}

/**
 * Print upload summary
 */
function printSummary(config) {
  const totalSizeMB = (stats.totalBytes / (1024 * 1024)).toFixed(2);
  const totalSizeGB = (stats.totalBytes / (1024 * 1024 * 1024)).toFixed(2);
  
  console.log('\n');
  console.log('Upload Summary');
  console.log('==============');
  console.log(`Endpoint: ${config.endpoint}`);
  console.log(`Bucket: ${config.bucket}`);
  console.log(`Total files: ${stats.totalFiles}`);
  console.log(`Uploaded: ${stats.uploadedFiles}`);
  console.log(`Failed: ${stats.failedFiles}`);
  console.log(`Total size: ${totalSizeMB} MB (${totalSizeGB} GB)`);
  
  if (config.dryRun) {
    console.log('\n⚠ DRY RUN MODE - No files were actually uploaded');
  }

  if (stats.errors.length > 0) {
    console.log('\nErrors:');
    console.log('-------');
    for (const error of stats.errors) {
      console.log(`  ${error.file}: ${error.error}`);
    }
  }

  if (stats.failedFiles === 0) {
    console.log('\n✓ Upload completed successfully!');
  } else {
    console.log('\n⚠ Upload completed with errors');
  }
}

/**
 * Main function
 */
async function main() {
  console.log('S3 Upload Script');
  console.log('================\n');

  const config = parseArgs();

  // Check if AWS CLI is installed
  const hasAwsCli = await checkAwsCli();
  if (!hasAwsCli) {
    console.error('Error: AWS CLI is not installed or not in PATH');
    console.error('\nPlease install AWS CLI:');
    console.error('  macOS: brew install awscli');
    console.error('  Linux: sudo apt-get install awscli  (or equivalent)');
    console.error('  Windows: https://aws.amazon.com/cli/');
    process.exit(1);
  }

  console.log('Configuration:');
  console.log(`  Endpoint: ${config.endpoint}`);
  console.log(`  Bucket: ${config.bucket}`);
  console.log(`  Region: ${config.region}`);
  console.log(`  Parquet directory: ${config.parquetDir}`);
  console.log(`  CVE directory: ${config.cveDir}`);
  console.log(`  Dry run: ${config.dryRun}`);
  console.log('');

  try {
    // Ensure bucket exists
    if (!config.dryRun) {
      await ensureBucket(config);
    }

    // Upload Parquet files
    await uploadParquetFiles(config);

    // Upload CVE JSON files
    await uploadCveFiles(config);

    // Print summary
    printSummary(config);

    // Exit with appropriate code
    process.exit(stats.failedFiles > 0 ? 1 : 0);

  } catch (error) {
    console.error('\nFatal error:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { uploadFile, uploadParquetFiles, uploadCveFiles };
