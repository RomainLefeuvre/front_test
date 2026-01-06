# Migration from DuckDB WASM to REST API

This document describes the migration from DuckDB WASM client-side querying to a REST API backend.

## Overview

The application has been migrated from:
- **Before**: DuckDB WASM + Parquet files in S3/MinIO
- **After**: REST API backend with endpoints for vulnerability queries

## API Endpoints

The new API follows the OpenAPI specification in `openapi.json`:

### Health Check
```
GET /health
```
Returns 200 if the service is healthy.

### Query by Origin
```
GET /api/origin/vulnerabilities?url={origin_url}
```
Returns vulnerabilities for a given repository origin URL.

**Response:**
```json
{
  "origin": "https://github.com/example/repo",
  "vulnerable_commits": [
    {
      "revision_id": "swh:1:rev:abc123...",
      "branch_name": "main",
      "vulnerability_filename": "CVE-2024-1234.json"
    }
  ]
}
```

### Query by SWHID
```
GET /api/swhid/{swhid}/vulnerabilities
```
Returns vulnerabilities for a given Software Heritage Identifier.

**Response:**
```json
{
  "swhid": "swh:1:rev:abc123...",
  "vulnerabilities": [
    "CVE-2024-1234.json",
    "CVE-2024-5678.json"
  ]
}
```

## Configuration

### Environment Variables

The application now uses a single environment variable:

```bash
# Development (default)
VITE_API_BASE_URL=http://localhost:8080

# Production
VITE_API_BASE_URL=https://your-api-domain.com
```

### Removed Configuration

The following S3/MinIO configuration is no longer needed:
- `VITE_S3_ENDPOINT`
- `VITE_S3_BUCKET`
- `VITE_S3_REGION`

## Code Changes

### New Files
- `src/lib/apiClient.ts` - New API client replacing DuckDB query engine
- `src/lib/apiClient.test.ts` - Tests for the API client

### Modified Files
- `src/App.tsx` - Updated to use API client instead of DuckDB
- `src/lib/config.ts` - Updated configuration for API base URL
- `src/lib/cveLoader.ts` - Updated to use new API client
- `src/types/index.ts` - Updated AppConfig interface
- `package.json` - Removed DuckDB WASM dependency

### Removed Files
- `src/lib/queryEngine.ts` - Old DuckDB query engine
- `src/lib/queryEngine.*.test.ts` - DuckDB-related tests
- `scripts/setupDuckDB.js` - DuckDB setup script

## Backward Compatibility

The `apiClient.ts` exports a `queryEngine` object with the same interface as the old DuckDB query engine, ensuring existing components continue to work without changes.

## Benefits of Migration

1. **Performance**: No more 487MB downloads for simple queries
2. **Reliability**: Server-side querying with proper bloom filter support
3. **Scalability**: Backend can handle multiple concurrent users efficiently
4. **Maintainability**: Simpler client-side code, complex querying moved to backend
5. **Security**: No need to expose raw data files to clients

## Development Setup

1. Update environment variables:
   ```bash
   cp .env.example .env.development
   # Edit VITE_API_BASE_URL if needed
   ```

2. Install dependencies (DuckDB WASM removed):
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Ensure your API backend is running on the configured URL (default: http://localhost:8080)

## Testing

Run the test suite to verify the migration:

```bash
npm test
```

The tests now mock the API client instead of DuckDB WASM.

## Deployment

1. Set the production API URL:
   ```bash
   VITE_API_BASE_URL=https://your-api-domain.com
   ```

2. Build the application:
   ```bash
   npm run build
   ```

3. Deploy the built files to your web server.

The application will now make API calls to your backend instead of querying Parquet files directly.