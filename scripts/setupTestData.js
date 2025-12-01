#!/usr/bin/env node
/**
 * Setup test data in MinIO for end-to-end integration tests
 * Creates sample Parquet files and CVE JSON files for testing
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const MINIO_ENDPOINT = process.env.VITE_S3_ENDPOINT || 'http://localhost:9093';
const MINIO_BUCKET = process.env.VITE_S3_BUCKET || 'vuln-data-dev';

console.log('🔧 Setting up test data for end-to-end tests...\n');

// Create test data directory
const testDataDir = join(process.cwd(), 'test-data');
if (!existsSync(testDataDir)) {
  mkdirSync(testDataDir, { recursive: true });
}

// Create sample CVE JSON files
const sampleCVEs = [
  {
    filename: 'CVE-2024-0001.json',
    data: {
      id: 'CVE-2024-0001',
      summary: 'Test vulnerability for integration testing',
      details: 'This is a test CVE entry used for end-to-end integration tests. It validates that the system can properly load and parse CVE data from MinIO.',
      severity: [
        {
          type: 'CVSS_V3',
          score: '7.5'
        }
      ],
      affected: [
        {
          package: {
            name: 'test-package',
            ecosystem: 'npm'
          },
          ranges: [
            {
              type: 'SEMVER',
              events: [
                { introduced: '0' },
                { fixed: '1.2.3' }
              ]
            }
          ]
        }
      ],
      references: [
        {
          type: 'WEB',
          url: 'https://example.com/cve-2024-0001'
        }
      ],
      published: '2024-01-01T00:00:00Z',
      modified: '2024-01-02T00:00:00Z'
    }
  },
  {
    filename: 'nvd_cve/CVE-2024-1000.json',
    data: {
      id: 'CVE-2024-1000',
      summary: 'Test vulnerability from nvd_cve directory',
      details: 'This CVE is stored in the nvd_cve subdirectory to test path resolution.',
      severity: [
        {
          type: 'CVSS_V3',
          score: '9.8'
        }
      ],
      references: [
        {
          type: 'ADVISORY',
          url: 'https://nvd.nist.gov/vuln/detail/CVE-2024-1000'
        }
      ],
      published: '2024-02-01T00:00:00Z',
      modified: '2024-02-02T00:00:00Z'
    }
  }
];

// Write CVE files
const cveDir = join(testDataDir, 'cve');
const nvdCveDir = join(cveDir, 'nvd_cve');

if (!existsSync(cveDir)) {
  mkdirSync(cveDir, { recursive: true });
}
if (!existsSync(nvdCveDir)) {
  mkdirSync(nvdCveDir, { recursive: true });
}

for (const cve of sampleCVEs) {
  const filePath = join(cveDir, cve.filename);
  const dir = join(cveDir, cve.filename.split('/')[0]);
  
  if (cve.filename.includes('/')) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }
  
  writeFileSync(filePath, JSON.stringify(cve.data, null, 2));
  console.log(`✅ Created ${cve.filename}`);
}

console.log('\n📋 Test data created in:', testDataDir);
console.log('\n📝 Next steps:');
console.log('1. Make sure MinIO is running: docker-compose up -d');
console.log('2. Upload test data to MinIO: npm run upload-s3');
console.log('3. Run integration tests: npm run test:integration');
console.log('\n💡 Note: You need to create sample Parquet files manually or use existing data');
console.log('   The test will work with empty results if no Parquet data exists.');
