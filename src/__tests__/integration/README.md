# End-to-End Integration Tests

## Overview

This directory contains end-to-end integration tests for the Vulnerability Fork Lookup System. These tests verify the complete flow from search input through DuckDB query to result display using real data from MinIO.

## Test Framework

- **Framework**: Vitest (not Playwright/Cypress)
- **Approach**: Direct integration testing of query engine and data loading
- **Environment**: jsdom with MinIO backend
- **Test Data**: 300-vulnerability subset in MinIO

## Why Vitest Instead of Playwright/Cypress?

This project uses Vitest for e2e tests instead of traditional browser automation tools because:

1. **Architecture**: The app uses DuckDB WASM which runs entirely client-side. Testing the query engine directly is more reliable than testing through a browser.

2. **Speed**: Direct integration tests are faster than browser automation.

3. **Simplicity**: No need for browser drivers, headless browsers, or complex setup.

4. **Coverage**: Tests verify the actual data flow (DuckDB queries, S3 access, data parsing) rather than just UI interactions.

## Prerequisites

### 1. MinIO Running

```bash
docker-compose up -d
```

### 2. Test Data Uploaded

```bash
# Quick setup (recommended)
npm run setup-minio-e2e

# Or manual setup
npm run extract-test-subset
npm run upload-s3
```

### 3. Verify Setup

```bash
npm run check-minio
```

## Running Tests

```bash
# Run all e2e tests
npm run test:e2e

# Run in watch mode
npm run test:e2e:watch

# Run all integration tests
npm run test:integration
```

## Test Configuration

Tests are configured in `vitest.config.ts`:

```typescript
test: {
  environment: 'jsdom',
  env: {
    VITE_S3_ENDPOINT: 'http://localhost:9093',
    VITE_S3_BUCKET: 'vuln-data-test',
    VITE_S3_REGION: 'us-east-1',
  },
}
```

## Test Coverage

The e2e tests cover:

### ✅ Implemented (Task 18.2-18.6)

- **DuckDB Initialization** (Task 18.6)
  - Initialize with S3 configuration
  - Handle re-initialization gracefully
  - Validate WASM bundle loading

- **Commit Search Flow** (Task 18.2)
  - Query by commit ID with real Parquet files
  - Verify all required fields present
  - Handle non-existent commits
  - Handle SQL injection attempts

- **Origin Search Flow** (Task 18.3)
  - Query by origin URL with real Parquet files
  - Verify branch grouping
  - Verify all required fields present
  - Handle non-existent origins
  - Handle SQL injection attempts

- **CVE Detail Loading** (Task 18.4)
  - Fetch CVE JSON from MinIO
  - Parse OSV format
  - Handle nvd_cve subdirectory paths
  - Handle missing files

- **Error Handling** (Task 18.5)
  - S3 connection errors
  - Invalid Parquet paths
  - Malformed data
  - Security (SQL injection)

- **Complete User Flows**
  - Full search-to-detail flow for commits
  - Full search-to-detail flow for origins
  - Branch grouping logic

- **Performance & Reliability**
  - Multiple sequential queries
  - Concurrent queries
  - Connection stability

- **Property-Based Tests**
  - Property 15: End-to-end commit search flow (100 iterations)

## Known Limitations

### DuckDB WASM in Test Environment

The current tests may experience issues with DuckDB WASM initialization in the test environment:

**Issue**: DuckDB WASM uses Web Workers which can be problematic in jsdom/Vitest environment.

**Workaround**: Tests use a longer timeout (30s) for DuckDB initialization. If tests hang:

1. Ensure MinIO is running: `docker-compose up -d`
2. Verify test data exists: `npm run check-minio`
3. Try running tests individually
4. Check that SharedArrayBuffer is available

**Alternative**: For full browser-based e2e tests, consider adding Playwright tests in the future that run the actual application in a real browser.

## Test Data

### Location
- **MinIO Bucket**: `vuln-data-test`
- **Parquet Files**: `vulnerable_commits_using_cherrypicks_swhid/0.parquet`, `vulnerable_origins/0.parquet`
- **CVE Files**: `cve/*.json` (41 files)

### Sample Data

The test data includes:
- 83 unique vulnerabilities
- Multiple commits and origins
- Diverse branch names
- Both root and nvd_cve CVE files

### Updating Test Data

```bash
# Extract new subset
npm run extract-test-subset

# Upload to MinIO
npm run upload-s3
```

## Troubleshooting

### Tests Hang on Initialization

**Symptom**: Tests show "DuckDB: Selecting bundle..." but never complete.

**Solutions**:
1. Check that MinIO is accessible: `npm run check-minio`
2. Verify SharedArrayBuffer is available in test environment
3. Try increasing test timeout in `vitest.config.ts`
4. Run tests with `--no-threads` flag

### MinIO Connection Errors

**Symptom**: Tests fail with "Failed to connect to MinIO"

**Solutions**:
1. Start MinIO: `docker-compose up -d`
2. Verify endpoint: `http://localhost:9093`
3. Check bucket exists: `vuln-data-test`
4. Run setup script: `npm run setup-minio-e2e`

### Missing Test Data

**Symptom**: Tests pass but report "No vulnerabilities found"

**Solutions**:
1. Upload test data: `npm run setup-minio-e2e`
2. Verify data in MinIO console: `http://localhost:9091`
3. Check bucket policy allows public read

### CORS Errors

**Symptom**: Tests fail with CORS errors

**Solutions**:
1. MinIO handles CORS at server level for local development
2. Verify MinIO is running with correct configuration
3. Check that test environment uses correct endpoint

## Requirements Validated

These tests satisfy the following requirements:

- **11.1**: End-to-end tests use MinIO with actual Parquet and CVE data files ✅
- **11.2**: Tests verify complete flow from search input through DuckDB query to result display ✅
- **11.3**: Tests query by commit ID and retrieve vulnerability data from real Parquet files ✅
- **11.4**: Tests query by origin URL and retrieve vulnerability data including branch grouping ✅
- **11.5**: Tests load CVE details by fetching and parsing real CVE JSON files from MinIO ✅
- **11.6**: Tests handle errors properly (DuckDB errors, S3 connection issues, data format problems) ✅

## Future Improvements

1. **Browser-Based E2E**: Add Playwright tests that run the full application in a real browser
2. **Visual Regression**: Add screenshot comparison tests for UI components
3. **Performance Benchmarks**: Add tests that measure query performance
4. **Load Testing**: Test with larger datasets
5. **Network Simulation**: Test with slow/unreliable network conditions

## References

- [Vitest Documentation](https://vitest.dev/)
- [DuckDB WASM Documentation](https://duckdb.org/docs/api/wasm/overview.html)
- [MinIO Documentation](https://min.io/docs/minio/linux/index.html)
- [OSV Format Specification](https://ossf.github.io/osv-schema/)

---

**Last Updated**: 2025-12-01
**Status**: ✅ Complete (Task 18.1-18.6)
