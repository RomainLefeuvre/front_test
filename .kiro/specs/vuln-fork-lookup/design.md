# Design Document

## Overview

The Vulnerability Fork Lookup System is a static web application that enables security researchers and developers to identify one-day vulnerabilities in forked repositories. The system leverages pre-computed vulnerability data from Software Heritage archive analysis, serving it through a client-side application that queries Parquet files directly in the browser using DuckDB WebAssembly.

The architecture follows a JAMstack approach: static HTML/CSS/JavaScript frontend, with all data queries executed client-side against Parquet files hosted on S3-compatible storage. This eliminates the need for backend servers while maintaining fast query performance across a dataset of 2.2M analyzed forks.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │           Static Web Application (SPA)                 │ │
│  │  ┌──────────────┐  ┌─────────────┐  ┌──────────────┐  │ │
│  │  │ Search UI    │  │ Results     │  │ CVE Detail   │  │ │
│  │  │ Component    │  │ Display     │  │ Viewer       │  │ │
│  │  └──────────────┘  └─────────────┘  └──────────────┘  │ │
│  │         │                  │                 │          │ │
│  │         └──────────────────┴─────────────────┘          │ │
│  │                          │                               │ │
│  │                ┌─────────▼──────────┐                   │ │
│  │                │  Query Engine      │                   │ │
│  │                │  (DuckDB WASM)     │                   │ │
│  │                └─────────┬──────────┘                   │ │
│  └──────────────────────────┼────────────────────────────┘ │
└─────────────────────────────┼──────────────────────────────┘
                              │ HTTP Requests
                              │
         ┌────────────────────┴────────────────────┐
         │                                          │
    ┌────▼─────┐                            ┌──────▼──────┐
    │ S3/CDN   │                            │  S3/CDN     │
    │ Parquet  │                            │  CVE JSON   │
    │ Files    │                            │  Files      │
    └──────────┘                            └─────────────┘
```

### Technology Stack

- **Frontend Framework**: React with TypeScript
- **Query Engine**: DuckDB-WASM for client-side Parquet querying
- **Build Tool**: Vite for bundling and optimization
- **Storage**: S3-compatible object storage (AWS S3, MinIO for local dev)
- **Data Format**: Apache Parquet for tabular data, JSON for CVE details
- **Styling**: Tailwind CSS utility-first framework


## Components and Interfaces

### 1. Search Interface Component

**Responsibilities:**
- Render dual-mode search UI (commit ID vs origin URL)
- Validate user input
- Trigger appropriate query based on search mode
- Display loading states

**Interface:**
```typescript
interface SearchComponent {
  onSearch(query: string, mode: 'commit' | 'origin'): void;
  setLoading(loading: boolean): void;
  setError(error: string | null): void;
}
```

### 2. Query Engine Module

**Responsibilities:**
- Initialize DuckDB WASM instance
- Configure S3 endpoint (production or local)
- Execute SQL queries against Parquet files
- Cache database connections and metadata
- Handle query errors and timeouts

**Interface:**
```typescript
interface QueryEngine {
  initialize(s3Config: S3Config): Promise<void>;
  queryByCommitId(revisionId: string): Promise<VulnerabilityResult[]>;
  queryByOrigin(originUrl: string): Promise<OriginVulnerabilityResult[]>;
  loadCVEData(filename: string): Promise<CVEEntry>;
}

interface S3Config {
  endpoint: string;
  bucket: string;
  region?: string;
}
```

### 3. Results Display Component

**Responsibilities:**
- Render vulnerability search results
- Group results by branch (for origin queries)
- Display severity badges with color coding
- Provide filtering controls (CVE name, branch, severity)
- Apply filters and update displayed results
- Show filtered vs total result counts
- Provide expandable CVE details
- Handle empty results gracefully

**Interface:**
```typescript
interface ResultsComponent {
  displayCommitResults(results: VulnerabilityResult[]): void;
  displayOriginResults(results: OriginVulnerabilityResult[]): void;
  applyFilters(filters: ResultFilters): void;
  clearFilters(): void;
  clear(): void;
}

interface ResultFilters {
  cveNameFilter: string;
  branchFilter: string;
  severityFilter: SeverityLevel[];
}
```

### 4. CVE Detail Viewer Component

**Responsibilities:**
- Fetch and parse OSV-format CVE JSON
- Render structured CVE information
- Display severity, description, references
- Handle missing or malformed data

**Interface:**
```typescript
interface CVEViewerComponent {
  loadCVE(filename: string): Promise<void>;
  renderCVE(cve: CVEEntry): void;
  close(): void;
}
```

### 5. Data Preprocessing Module (Build-time)

**Responsibilities:**
- Extract CVE JSON files from tar.zst archives
- Organize CVE files for static serving
- Generate index/manifest files if needed
- Validate data integrity

**Interface:**
```typescript
interface DataPreprocessor {
  extractCVEArchives(inputDir: string, outputDir: string): Promise<void>;
  generateCVEIndex(cveDir: string): Promise<CVEIndex>;
  validateParquetFiles(parquetDir: string): Promise<ValidationResult>;
}
```

## Data Models

### VulnerabilityResult (from vulnerable_commits)

```typescript
interface VulnerabilityResult {
  revision_id: string;        // Commit SHA
  category: string;           // Vulnerability category
  vulnerability_filename: string;  // Reference to CVE JSON file
  severity?: SeverityInfo;    // Parsed severity information (loaded from CVE)
}
```

### OriginVulnerabilityResult (from vulnerable_origins)

```typescript
interface OriginVulnerabilityResult {
  origin: string;             // Repository URL
  revision_id: string;        // Commit SHA
  branch_name: string;        // Affected branch
  vulnerability_filename: string;  // Reference to CVE JSON file
  severity?: SeverityInfo;    // Parsed severity information (loaded from CVE)
}
```

### SeverityInfo

```typescript
interface SeverityInfo {
  level: SeverityLevel;       // Severity classification
  score?: number;             // CVSS numeric score (0.0-10.0)
  vector?: string;            // CVSS vector string
}

type SeverityLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE' | 'UNKNOWN';
```

### CVEEntry (OSV Format)

```typescript
interface CVEEntry {
  id: string;                 // CVE identifier
  summary: string;            // Brief description
  details: string;            // Detailed description
  severity?: Severity[];      // Severity ratings
  affected?: Affected[];      // Affected packages/versions
  references?: Reference[];   // External references
  published?: string;         // Publication date
  modified?: string;          // Last modified date
}

interface Severity {
  type: string;               // e.g., "CVSS_V3"
  score: string;              // Severity score
}

interface Affected {
  package?: Package;
  ranges?: Range[];
  versions?: string[];
}

interface Reference {
  type: string;               // e.g., "WEB", "ADVISORY"
  url: string;
}
```

### Configuration Model

```typescript
interface AppConfig {
  s3: S3Config;
  parquetPaths: {
    vulnerableCommits: string;
    vulnerableOrigins: string;
  };
  cvePath: string;
  environment: 'development' | 'production';
}
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Commit query result matching
*For any* valid commit ID in the dataset, when querying by that commit ID, all returned vulnerability results should have a revision_id field that matches the queried commit ID.
**Validates: Requirements 1.1**

### Property 2: Origin query result matching
*For any* valid origin URL in the dataset, when querying by that origin, all returned vulnerability results should have an origin field that matches the queried origin URL.
**Validates: Requirements 2.1**

### Property 3: Required fields presence in vulnerability display
*For any* vulnerability result (from either commit or origin queries), the rendered output should contain all required fields: vulnerability_filename and category, and for origin queries additionally revision_id and branch_name.
**Validates: Requirements 1.2, 2.2**

### Property 4: Result completeness
*For any* query that returns multiple vulnerabilities, the number of displayed results should equal the number of results returned from the query engine.
**Validates: Requirements 1.5**

### Property 5: Branch grouping consistency
*For any* origin query result set, all vulnerabilities with the same branch_name should appear in the same display group, and vulnerabilities with different branch_names should appear in different groups.
**Validates: Requirements 2.3, 2.5**

### Property 6: CVE detail interactivity
*For any* displayed vulnerability, the rendered output should contain an interactive element (link or button) that triggers CVE detail loading.
**Validates: Requirements 3.1**

### Property 7: CVE detail field completeness
*For any* CVE entry in OSV format, the rendered CVE detail view should display all available key fields including id, summary, details, severity (if present), affected packages (if present), and references (if present).
**Validates: Requirements 3.2**

### Property 8: Search mode feedback
*For any* user input in the search field, the system should detect and indicate the appropriate search mode (commit vs origin) based on the input pattern.
**Validates: Requirements 6.3**

### Property 9: Configuration-based endpoint selection
*For any* environment configuration (development or production), the query engine should use the S3 endpoint specified in that environment's configuration for all data requests.
**Validates: Requirements 7.2, 7.4**

### Property 10: Environment functional equivalence
*For any* query executed against both development and production endpoints (with identical data), the results should be equivalent in structure and content.
**Validates: Requirements 7.5**

### Property 11: OSV JSON parsing round-trip
*For any* valid OSV-format CVE JSON file, parsing the JSON and then serializing it back should produce a structurally equivalent object.
**Validates: Requirements 8.1**

### Property 12: Archive extraction validity
*For any* CVE archive (tar.zst or zip), the extraction process should produce valid JSON files that can be successfully parsed as OSV-format CVE entries.
**Validates: Requirements 8.4, 8.5**

### Property 13: Keyboard navigation completeness
*For any* interactive element in the application, it should be reachable and activatable using only keyboard navigation (tab, enter, arrow keys).
**Validates: Requirements 10.3**

### Property 14: Accessibility label presence
*For any* interactive element in the application, it should have either an aria-label attribute, aria-labelledby reference, or semantic HTML that provides context for screen readers.
**Validates: Requirements 10.4**

### Property 15: End-to-end commit search flow
*For any* valid commit ID in the test dataset, executing the complete search flow (input → query → display) should successfully retrieve and render vulnerability results with all required fields.
**Validates: Requirements 11.2, 11.3**

### Property 16: End-to-end origin search flow
*For any* valid origin URL in the test dataset, executing the complete search flow (input → query → display) should successfully retrieve and render vulnerability results grouped by branch.
**Validates: Requirements 11.2, 11.4**

### Property 17: End-to-end CVE detail loading
*For any* vulnerability result displayed, clicking to view CVE details should successfully fetch and render the CVE JSON data from MinIO.
**Validates: Requirements 11.5**

### Property 18: End-to-end error handling
*For any* error condition (invalid query, network failure, missing data), the system should display appropriate error messages without crashing.
**Validates: Requirements 11.6**

### Property 19: Severity information fetching
*For any* displayed vulnerability result, the system should fetch and parse CVSS severity information from the corresponding CVE data and attach it to the result.
**Validates: Requirements 12.1**

### Property 20: Severity badge color coding
*For any* vulnerability result with a severity level, the rendered output should contain a color-coded badge matching the standard severity colors (CRITICAL: red, HIGH: orange, MEDIUM: yellow, LOW: blue, NONE/UNKNOWN: gray).
**Validates: Requirements 12.2**

### Property 21: Severity text display
*For any* vulnerability with available CVSS data, the rendered severity badge should display the severity level text (CRITICAL, HIGH, MEDIUM, LOW).
**Validates: Requirements 12.3**

### Property 22: Severity score display
*For any* vulnerability with a numeric CVSS score, the rendered severity badge should display the score value in the range 0.0-10.0.
**Validates: Requirements 12.4**

### Property 23: CVE name filter matching
*For any* result set and CVE name filter string, all displayed results after filtering should have CVE identifiers that contain the filter string (case-insensitive).
**Validates: Requirements 13.2**

### Property 24: Branch name filter matching
*For any* result set and branch name filter string, all displayed results after filtering should have branch names that contain the filter string (case-insensitive).
**Validates: Requirements 13.3**

### Property 25: Severity level filter matching
*For any* result set and selected severity levels, all displayed results after filtering should have severity levels that match one of the selected levels.
**Validates: Requirements 13.4**

### Property 26: Multiple filter AND logic
*For any* result set with multiple active filters (CVE name, branch, severity), all displayed results should match ALL active filters simultaneously.
**Validates: Requirements 13.5**

### Property 27: Filter count accuracy
*For any* result set with applied filters, the displayed filtered count should equal the number of results matching the filters, and the total count should equal the original unfiltered result count.
**Validates: Requirements 13.6**

### Property 28: Clear filters restoration
*For any* result set with applied filters, clearing all filters should restore the complete result set with count equal to the original total.
**Validates: Requirements 13.7**


## Error Handling

### Query Errors

**Scenario**: DuckDB query fails or times out
- **Handling**: Catch query exceptions, log error details, display user-friendly error message
- **Recovery**: Allow user to retry query, suggest checking network connection
- **Logging**: Log query text, error message, and timestamp for debugging

**Scenario**: Invalid commit ID or origin URL format
- **Handling**: Validate input format before querying, show validation error
- **Recovery**: Highlight invalid input, provide format examples
- **Logging**: Log validation failures for analytics

**Scenario**: No results found for valid query
- **Handling**: Display clear "no vulnerabilities found" message
- **Recovery**: Suggest alternative searches, provide examples
- **Logging**: Log zero-result queries for dataset coverage analysis

### Data Loading Errors

**Scenario**: Parquet file fails to load from S3
- **Handling**: Catch HTTP/network errors, display connection error message
- **Recovery**: Implement retry logic with exponential backoff (max 3 attempts)
- **Logging**: Log S3 URL, HTTP status code, error message

**Scenario**: CVE JSON file not found or malformed
- **Handling**: Catch parse errors, display partial data with error indicator
- **Recovery**: Show vulnerability_filename even if CVE details unavailable
- **Logging**: Log missing/malformed CVE filenames for data quality monitoring

**Scenario**: DuckDB WASM initialization fails
- **Handling**: Catch initialization errors, display browser compatibility message
- **Recovery**: Suggest using modern browser (Chrome, Firefox, Safari latest versions)
- **Logging**: Log browser user agent and error details

### Configuration Errors

**Scenario**: Invalid S3 configuration
- **Handling**: Validate configuration at startup, fail fast with clear error
- **Recovery**: Display configuration error with required fields
- **Logging**: Log configuration validation errors

**Scenario**: Missing environment variables
- **Handling**: Use sensible defaults for optional config, require critical config
- **Recovery**: Document required vs optional configuration
- **Logging**: Log missing configuration keys

### User Input Errors

**Scenario**: Malformed search query
- **Handling**: Sanitize input, validate format, reject dangerous patterns
- **Recovery**: Show validation message, provide format guidance
- **Logging**: Log rejected inputs for security monitoring

**Scenario**: Query too broad (potential performance issue)
- **Handling**: Implement query complexity limits, warn user
- **Recovery**: Suggest more specific search terms
- **Logging**: Log query complexity metrics

## Testing Strategy

### Unit Testing

The system will use unit tests to verify specific functionality of individual components:

**Query Engine Module:**
- Test DuckDB initialization with various configurations
- Test SQL query generation for commit and origin searches
- Test error handling for malformed queries
- Test S3 configuration parsing and validation

**Data Preprocessing Module:**
- Test tar.zst extraction produces valid files
- Test zip extraction produces valid files
- Test CVE JSON validation logic
- Test handling of corrupted archives

**Search Component:**
- Test input validation for commit IDs (SHA format)
- Test input validation for origin URLs
- Test search mode detection logic
- Test loading state management

**Results Display Component:**
- Test branch grouping logic with various datasets
- Test empty results handling
- Test result rendering with missing fields

**CVE Viewer Component:**
- Test OSV format parsing with complete data
- Test OSV format parsing with missing optional fields
- Test error handling for malformed JSON

### Property-Based Testing

The system will use property-based testing to verify universal correctness properties across many randomly generated inputs. We will use **fast-check** (for JavaScript/TypeScript) as the property-based testing library.

Each property-based test will:
- Run a minimum of 100 iterations with randomly generated inputs
- Be tagged with a comment referencing the specific correctness property from this design document
- Use the format: `// Feature: vuln-fork-lookup, Property {number}: {property_text}`

**Property Test Coverage:**

1. **Query Result Matching** (Properties 1-2): Generate random commit IDs and origin URLs from test dataset, verify all results match query
2. **Field Completeness** (Properties 3, 7): Generate random vulnerability and CVE objects, verify all required fields present in rendered output
3. **Result Completeness** (Property 4): Generate random result sets of varying sizes, verify display count matches query count
4. **Grouping Logic** (Property 5): Generate random origin results with various branch distributions, verify grouping correctness
5. **UI Interactivity** (Property 6): Generate random vulnerability results, verify interactive elements present
6. **Mode Detection** (Property 8): Generate random strings matching commit/origin patterns, verify correct mode detection
7. **Configuration** (Properties 9-10): Generate random configurations, verify endpoint selection and functional equivalence
8. **Data Parsing** (Properties 11-12): Generate random valid OSV JSON and archives, verify round-trip and extraction correctness
9. **Accessibility** (Properties 13-14): Generate random UI components, verify keyboard navigation and ARIA labels
10. **Severity Display** (Properties 19-22): Generate random vulnerabilities with various CVSS data, verify severity parsing, color coding, and display
11. **Filtering Logic** (Properties 23-28): Generate random result sets and filter combinations, verify filter matching, AND logic, count accuracy, and clear functionality

### Integration Testing

**End-to-End Search Flow:**
- Test complete flow from search input to results display
- Test CVE detail loading and display
- Test error scenarios with mocked failures

**Data Pipeline:**
- Test complete flow from raw archives to queryable Parquet files
- Test data integrity through preprocessing pipeline

**Browser Compatibility:**
- Test DuckDB WASM functionality across browsers
- Test responsive layout on various screen sizes

### End-to-End Testing

The system will use end-to-end tests with real data to validate the complete application flow and catch integration issues, particularly with DuckDB WASM and MinIO.

**Test Environment Setup:**
- Use MinIO running locally (via Docker) as the S3-compatible storage
- Load actual Parquet files (limited to 300 vulnerabilities for test performance)
- Load actual CVE JSON files extracted from archives
- Configure test environment to point to MinIO endpoint

**Test Data Preparation:**
- Extract a subset of 300 vulnerabilities from the full dataset
- Include diverse examples: multiple commits, multiple origins, various branches
- Ensure CVE files for all 300 vulnerabilities are available
- Upload test data to MinIO before running tests

**End-to-End Test Coverage:**

1. **Complete Commit Search Flow** (Property 15):
   - Input a known commit ID from test dataset
   - Verify DuckDB successfully queries Parquet files from MinIO
   - Verify results are displayed with all required fields
   - Verify no errors occur during the flow

2. **Complete Origin Search Flow** (Property 16):
   - Input a known origin URL from test dataset
   - Verify DuckDB successfully queries Parquet files from MinIO
   - Verify results are grouped by branch correctly
   - Verify all required fields are displayed

3. **CVE Detail Loading** (Property 17):
   - Click on a vulnerability result
   - Verify CVE JSON is fetched from MinIO
   - Verify CVE data is parsed and displayed correctly
   - Verify all CVE fields render properly

4. **Error Handling** (Property 18):
   - Test with invalid commit ID (should show "no results")
   - Test with invalid origin URL (should show "no results")
   - Test with network disconnected (should show connection error)
   - Test with missing CVE file (should show error but not crash)

**Testing Framework:**
- Use Playwright or Cypress for browser automation
- Run tests in headless mode for CI/CD
- Configure test timeout to account for DuckDB initialization
- Each test should run a minimum of 100 iterations to catch intermittent issues

**DuckDB WASM Validation:**
- Verify DuckDB WASM initializes correctly with MinIO endpoint
- Verify httpfs extension loads and configures S3 access
- Verify Parquet files are read correctly from MinIO
- Monitor for memory leaks or performance degradation
- Catch any WASM-specific errors or compatibility issues

### Performance Testing

**Query Performance:**
- Benchmark query execution time for various query types
- Verify queries complete within 3-second target
- Test with realistic dataset sizes

**Load Performance:**
- Measure initial page load time
- Measure DuckDB WASM initialization time
- Measure Parquet file loading time

**Memory Usage:**
- Monitor browser memory consumption during queries
- Test with large result sets
- Verify no memory leaks during repeated searches


## Implementation Details

### DuckDB WASM Integration

**Initialization:**
```typescript
import * as duckdb from '@duckdb/duckdb-wasm';

async function initializeDuckDB(s3Config: S3Config) {
  const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
  const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);
  const worker = new Worker(bundle.mainWorker!);
  const logger = new duckdb.ConsoleLogger();
  const db = new duckdb.AsyncDuckDB(logger, worker);
  await db.instantiate(bundle.mainModule);
  
  // Configure S3 access
  const conn = await db.connect();
  await conn.query(`
    INSTALL httpfs;
    LOAD httpfs;
    SET s3_endpoint='${s3Config.endpoint}';
    SET s3_url_style='path';
  `);
  
  return { db, conn };
}
```

**Query Execution:**
```typescript
async function queryByCommitId(conn: duckdb.AsyncDuckDBConnection, revisionId: string) {
  const result = await conn.query(`
    SELECT revision_id, category, vulnerability_filename
    FROM read_parquet('${s3Config.bucket}/vulnerable_commits/*.parquet')
    WHERE revision_id = ?
  `, [revisionId]);
  
  return result.toArray();
}
```

### Data Preprocessing Pipeline

**CVE File Path Resolution:**

The `vulnerability_filename` field in the Parquet data uses two formats:
1. **Simple filename** (e.g., `CVE-2024-1234.json`): Source is `all.zip`
2. **Path with nvd_cve prefix** (e.g., `nvd_cve/CVE-2024-1234.json`): Source is corresponding `.tar.zst` file in `nvd_cve/` directory

**Build Script (Node.js):**
```typescript
import { extract } from 'tar';
import { createReadStream } from 'fs';
import { pipeline } from 'stream/promises';
import AdmZip from 'adm-zip';

async function extractCVEArchives(inputDir: string, outputDir: string) {
  // Extract all.zip for simple filenames
  const allZipPath = `${inputDir}/CVE/all.zip`;
  const zip = new AdmZip(allZipPath);
  zip.extractAllTo(`${outputDir}/cve`, true);
  
  // Extract tar.zst files for nvd_cve paths
  const archives = await glob(`${inputDir}/CVE/nvd_cve/*.tar.zst`);
  
  for (const archive of archives) {
    await pipeline(
      createReadStream(archive),
      zstd.decompress(),
      extract({ cwd: `${outputDir}/cve/nvd_cve` })
    );
  }
  
  // Validate extracted JSON files
  const jsonFiles = await glob(`${outputDir}/cve/**/*.json`);
  for (const file of jsonFiles) {
    const content = await readFile(file, 'utf-8');
    JSON.parse(content); // Validate JSON
  }
}

// Helper function to resolve CVE file path
function resolveCVEPath(vulnerabilityFilename: string, cveBasePath: string): string {
  // If filename contains nvd_cve/, it's from tar.zst archives
  // Otherwise, it's from all.zip
  return `${cveBasePath}/${vulnerabilityFilename}`;
}
```

### Search Mode Detection

**Pattern Matching:**
```typescript
function detectSearchMode(input: string): 'commit' | 'origin' {
  // Commit ID: 40-character hex string (SHA-1) or 64-character (SHA-256)
  const commitPattern = /^[a-f0-9]{40}([a-f0-9]{24})?$/i;
  
  // Origin URL: http(s)://... or git@...
  const originPattern = /^(https?:\/\/|git@)/i;
  
  if (commitPattern.test(input.trim())) {
    return 'commit';
  } else if (originPattern.test(input.trim())) {
    return 'origin';
  }
  
  // Default to origin for ambiguous cases
  return 'origin';
}
```

### Result Grouping

**Branch Grouping Algorithm:**
```typescript
function groupByBranch(results: OriginVulnerabilityResult[]): Map<string, OriginVulnerabilityResult[]> {
  const groups = new Map<string, OriginVulnerabilityResult[]>();
  
  for (const result of results) {
    const branch = result.branch_name;
    if (!groups.has(branch)) {
      groups.set(branch, []);
    }
    groups.get(branch)!.push(result);
  }
  
  return groups;
}
```

### Severity Parsing and Display

**CVSS Severity Extraction:**
```typescript
function parseSeverity(cve: CVEEntry): SeverityInfo {
  // Try to find CVSS v3 severity first, fall back to v2
  const cvssV3 = cve.severity?.find(s => s.type === 'CVSS_V3');
  const cvssV2 = cve.severity?.find(s => s.type === 'CVSS_V2');
  const cvss = cvssV3 || cvssV2;
  
  if (!cvss || !cvss.score) {
    return { level: 'UNKNOWN' };
  }
  
  // Parse numeric score from string (e.g., "7.5" or "CVSS:3.1/AV:N/AC:L...")
  let score: number | undefined;
  const numericMatch = cvss.score.match(/^(\d+\.?\d*)/);
  if (numericMatch) {
    score = parseFloat(numericMatch[1]);
  }
  
  // Determine severity level from score
  let level: SeverityLevel;
  if (score === undefined) {
    level = 'UNKNOWN';
  } else if (score >= 9.0) {
    level = 'CRITICAL';
  } else if (score >= 7.0) {
    level = 'HIGH';
  } else if (score >= 4.0) {
    level = 'MEDIUM';
  } else if (score > 0.0) {
    level = 'LOW';
  } else {
    level = 'NONE';
  }
  
  return {
    level,
    score,
    vector: cvss.score
  };
}

function getSeverityColor(level: SeverityLevel): string {
  const colors = {
    CRITICAL: '#dc2626', // red-600
    HIGH: '#ea580c',     // orange-600
    MEDIUM: '#ca8a04',   // yellow-600
    LOW: '#2563eb',      // blue-600
    NONE: '#6b7280',     // gray-500
    UNKNOWN: '#6b7280'   // gray-500
  };
  return colors[level];
}
```

**Severity Badge Component:**
```typescript
function SeverityBadge({ severity }: { severity: SeverityInfo }) {
  const color = getSeverityColor(severity.level);
  const displayText = severity.score 
    ? `${severity.level} (${severity.score.toFixed(1)})`
    : severity.level;
  
  return (
    <span 
      className="severity-badge"
      style={{ 
        backgroundColor: color,
        color: 'white',
        padding: '0.25rem 0.5rem',
        borderRadius: '0.25rem',
        fontSize: '0.875rem',
        fontWeight: '600'
      }}
    >
      {displayText}
    </span>
  );
}
```

### Result Filtering

**Filter Application:**
```typescript
interface ResultFilters {
  cveNameFilter: string;
  branchFilter: string;
  severityFilter: SeverityLevel[];
}

function applyFilters(
  results: OriginVulnerabilityResult[], 
  filters: ResultFilters
): OriginVulnerabilityResult[] {
  return results.filter(result => {
    // CVE name filter
    if (filters.cveNameFilter) {
      const cveId = extractCVEId(result.vulnerability_filename);
      if (!cveId.toLowerCase().includes(filters.cveNameFilter.toLowerCase())) {
        return false;
      }
    }
    
    // Branch filter
    if (filters.branchFilter) {
      if (!result.branch_name.toLowerCase().includes(filters.branchFilter.toLowerCase())) {
        return false;
      }
    }
    
    // Severity filter
    if (filters.severityFilter.length > 0) {
      if (!result.severity || !filters.severityFilter.includes(result.severity.level)) {
        return false;
      }
    }
    
    return true;
  });
}

function extractCVEId(filename: string): string {
  // Extract CVE-YYYY-NNNNN from filename like "CVE-2024-1234.json" or "nvd_cve/CVE-2024-1234.json"
  const match = filename.match(/(CVE-\d{4}-\d+)/i);
  return match ? match[1] : filename;
}
```

**Filter UI Component:**
```typescript
function FilterControls({ 
  filters, 
  onFilterChange, 
  onClearFilters,
  filteredCount,
  totalCount 
}: FilterControlsProps) {
  return (
    <div className="filter-controls">
      <div className="filter-inputs">
        <input
          type="text"
          placeholder="Filter by CVE name..."
          value={filters.cveNameFilter}
          onChange={(e) => onFilterChange({ ...filters, cveNameFilter: e.target.value })}
          aria-label="Filter by CVE name"
        />
        
        <input
          type="text"
          placeholder="Filter by branch..."
          value={filters.branchFilter}
          onChange={(e) => onFilterChange({ ...filters, branchFilter: e.target.value })}
          aria-label="Filter by branch name"
        />
        
        <select
          multiple
          value={filters.severityFilter}
          onChange={(e) => {
            const selected = Array.from(e.target.selectedOptions, opt => opt.value as SeverityLevel);
            onFilterChange({ ...filters, severityFilter: selected });
          }}
          aria-label="Filter by severity level"
        >
          <option value="CRITICAL">Critical</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
          <option value="NONE">None</option>
          <option value="UNKNOWN">Unknown</option>
        </select>
        
        <button onClick={onClearFilters} aria-label="Clear all filters">
          Clear Filters
        </button>
      </div>
      
      <div className="filter-stats">
        Showing {filteredCount} of {totalCount} vulnerabilities
      </div>
    </div>
  );
}
```

### Configuration Management

**Environment-based Config:**
```typescript
interface AppConfig {
  s3: {
    endpoint: string;
    bucket: string;
  };
  parquetPaths: {
    vulnerableCommits: string;
    vulnerableOrigins: string;
  };
  cvePath: string;
}

function loadConfig(): AppConfig {
  const env = import.meta.env.MODE; // Vite environment
  
  if (env === 'development') {
    return {
      s3: {
        endpoint: 'http://localhost:9000', // MinIO local
        bucket: 'vuln-data-dev'
      },
      parquetPaths: {
        vulnerableCommits: 'vulnerable_commits_using_cherrypicks_swhid',
        vulnerableOrigins: 'vulnerable_origins'
      },
      cvePath: 'cve'
    };
  } else {
    return {
      s3: {
        endpoint: 'https://s3.amazonaws.com',
        bucket: 'vuln-data-prod'
      },
      parquetPaths: {
        vulnerableCommits: 'vulnerable_commits_using_cherrypicks_swhid',
        vulnerableOrigins: 'vulnerable_origins'
      },
      cvePath: 'cve'
    };
  }
}
```

### Accessibility Implementation

**Keyboard Navigation:**
```typescript
// Ensure all interactive elements are keyboard accessible
function setupKeyboardNavigation() {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target instanceof HTMLElement) {
      if (e.target.hasAttribute('data-clickable')) {
        e.target.click();
      }
    }
  });
}
```

**ARIA Labels:**
```html
<!-- Search input -->
<input 
  type="text" 
  aria-label="Search by commit ID or repository URL"
  placeholder="Enter commit ID or origin URL"
/>

<!-- Search button -->
<button 
  aria-label="Execute vulnerability search"
  type="submit"
>
  Search
</button>

<!-- Result item -->
<div 
  role="button"
  tabindex="0"
  aria-label="View details for CVE-2024-1234"
  data-clickable
>
  CVE-2024-1234
</div>
```

## Deployment Architecture

### Static Site Hosting

**Recommended Platforms:**
- **Netlify**: Automatic builds from Git, CDN distribution, custom domains
- **Vercel**: Similar to Netlify, excellent performance
- **GitHub Pages**: Free hosting for open source projects
- **AWS S3 + CloudFront**: Full control, scalable

### Data Storage

**S3 Bucket Structure:**
```
vuln-data-prod/
├── vulnerable_commits_using_cherrypicks_swhid/
│   ├── 0.parquet
│   ├── 1.parquet
│   └── ...
├── vulnerable_origins/
│   ├── 0.parquet
│   ├── 1.parquet
│   └── ...
└── cve/
    ├── CVE-2024-0001.json          # From all.zip
    ├── CVE-2024-0002.json          # From all.zip
    └── nvd_cve/                     # From tar.zst archives
        ├── CVE-2024-1000.json
        ├── CVE-2024-1001.json
        └── ...
```

**CORS Configuration:**
```json
{
  "CORSRules": [
    {
      "AllowedOrigins": ["https://vuln-lookup.example.com"],
      "AllowedMethods": ["GET", "HEAD"],
      "AllowedHeaders": ["*"],
      "MaxAgeSeconds": 3600
    }
  ]
}
```

### Build Process

**Build Steps:**
1. Extract all.zip to get CVE JSON files (simple filenames)
2. Extract all tar.zst archives from nvd_cve/ directory
3. Organize extracted files maintaining the path structure (root level vs nvd_cve/)
4. Validate all JSON files are valid OSV format
5. Generate CVE index/manifest for efficient lookup (optional)
6. Bundle frontend application (Vite build)
7. Upload Parquet files to S3
8. Upload CVE JSON files to S3 (preserving directory structure)
9. Deploy static site to hosting platform

**CI/CD Pipeline (GitHub Actions example):**
```yaml
name: Build and Deploy

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run preprocess-data
      - run: npm run build
      - run: aws s3 sync ./data s3://vuln-data-prod/
      - run: npm run deploy
```

## Security Considerations

### Input Validation

- Sanitize all user inputs before using in queries
- Use parameterized queries to prevent SQL injection
- Validate commit ID and origin URL formats
- Implement rate limiting for queries (client-side)

### Data Access

- Use read-only S3 credentials
- Implement CORS restrictions on S3 bucket
- Serve all content over HTTPS
- Use Subresource Integrity (SRI) for CDN resources

### Privacy

- No user tracking or analytics without consent
- No server-side logging of queries
- All processing happens client-side
- Optional: Implement privacy-preserving analytics

## Performance Optimization

### Initial Load

- Lazy load DuckDB WASM (only when first query is executed)
- Use code splitting to reduce initial bundle size
- Implement service worker for offline capability
- Cache static assets aggressively

### Query Performance

- Use Parquet file partitioning by date or category
- Implement query result caching (in-memory)
- Use DuckDB query optimization features
- Consider pre-computing common queries

### Data Transfer

- Enable compression for S3 responses (gzip/brotli)
- Use Parquet column pruning to read only needed columns
- Implement progressive loading for large result sets
- Consider using Parquet row group filtering

## Future Enhancements

### Potential Features

1. **Advanced Search**: Filter by severity, date range, affected packages
2. **Visualization**: Graph of vulnerability propagation through forks
3. **Export**: Download results as CSV/JSON
4. **Notifications**: Subscribe to alerts for specific repositories
5. **API**: Provide programmatic access to vulnerability data
6. **Batch Queries**: Check multiple repositories at once
7. **Historical View**: Track vulnerability fixes over time
8. **Integration**: Browser extension for GitHub/GitLab

### Scalability Considerations

- If dataset grows beyond browser capabilities, consider hybrid approach with backend API
- Implement data pagination for very large result sets
- Consider using DuckDB's remote table functionality for even larger datasets
- Monitor query performance and optimize Parquet file structure as needed
