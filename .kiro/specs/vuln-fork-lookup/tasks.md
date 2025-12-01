# Implementation Plan

- [x] 1. Set up project structure and dependencies
- [x] 1.1 Initialize project with Vite and TypeScript
  - Create project with `npm create vite@latest` using React + TypeScript template
  - Configure tsconfig.json for strict type checking
  - Set up directory structure: src/, public/, scripts/
  - _Requirements: 4.1, 4.5_

- [x] 1.2 Install core dependencies
  - Install @duckdb/duckdb-wasm for client-side querying
  - Install fast-check for property-based testing
  - Install vitest for unit testing
  - Install tailwindcss for styling
  - _Requirements: 4.3, 5.1_

- [x] 1.3 Configure build and development environment
  - Set up Vite config with environment variables
  - Configure development and production modes
  - Set up path aliases for clean imports
  - _Requirements: 7.1, 7.4_

- [x] 2. Define core type definitions
- [x] 2.1 Create TypeScript interfaces for data models
  - Define VulnerabilityResult interface (revision_id, category, vulnerability_filename)
  - Define OriginVulnerabilityResult interface (origin, revision_id, branch_name, vulnerability_filename)
  - Define CVEEntry interface for OSV format
  - Define S3Config and AppConfig interfaces
  - Create types file at src/types/index.ts
  - _Requirements: 1.2, 2.2, 3.2, 7.1_

- [x] 14. Implement data preprocessing pipeline
- [x] 14.1 Create CVE extraction script
  - Write Node.js script to extract all.zip
  - Write script to extract tar.zst files from nvd_cve/
  - Implement path resolution logic for vulnerability_filename
  - Organize output maintaining directory structure (root vs nvd_cve/)
  - Create script at scripts/extractCVE.ts
  - _Requirements: 8.1, 8.4, 8.5_

- [x] 3. Implement configuration management
- [x] 3.1 Create configuration module
  - Implement loadConfig() function with environment detection
  - Read from VITE_S3_ENDPOINT, VITE_S3_BUCKET, VITE_S3_REGION
  - Return AppConfig with S3 settings and data paths
  - Create config file at src/lib/config.ts
  - _Requirements: 7.1, 7.4_

- [x] 3.2 Write property test for configuration
  - **Property 9: Configuration-based endpoint selection**
  - **Validates: Requirements 7.2, 7.4**

- [x] 4. Implement DuckDB query engine
- [x] 4.1 Create query engine module
  - Implement initializeDuckDB() function
  - Configure DuckDB WASM with S3 access
  - Set up connection pooling/caching
  - Handle initialization errors
  - Create query engine file at src/lib/queryEngine.ts
  - _Requirements: 4.3, 5.1, 5.4, 5.5_

- [x] 4.2 Implement commit ID query function
  - Write queryByCommitId() using parameterized SQL
  - Query vulnerable_commits_using_cherrypicks_swhid Parquet files
  - Return VulnerabilityResult array
  - Handle query errors and timeouts
  - _Requirements: 1.1, 5.1, 8.2_

- [x] 4.3 Write property test for commit query
  - **Property 1: Commit query result matching**
  - **Validates: Requirements 1.1**

- [x] 4.4 Implement origin URL query function
  - Write queryByOrigin() using parameterized SQL
  - Query vulnerable_origins Parquet files
  - Return OriginVulnerabilityResult array
  - Handle query errors and timeouts
  - _Requirements: 2.1, 5.1, 8.3_

- [x] 4.5 Write property test for origin query
  - **Property 2: Origin query result matching**
  - **Validates: Requirements 2.1**

- [x] 4.6 Implement CVE data loading function
  - Write loadCVEData() to fetch JSON from S3
  - Resolve CVE path based on vulnerability_filename format
  - Parse OSV format JSON
  - Handle missing files and parse errors
  - _Requirements: 3.4, 8.1_

- [x] 4.7 Write property test for OSV parsing
  - **Property 11: OSV JSON parsing round-trip**
  - **Validates: Requirements 8.1**

- [x] 4.8 Write property test for environment equivalence
  - **Property 10: Environment functional equivalence**
  - **Validates: Requirements 7.5**

- [x] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement search interface component
- [x] 6.1 Create search UI component
  - Build search form with input field and submit button
  - Implement dual-mode toggle or auto-detection UI
  - Add loading state indicator
  - Add error message display
  - Style with Tailwind CSS
  - Create component at src/components/SearchInterface.tsx
  - _Requirements: 6.1, 6.2, 6.5_

- [x] 6.2 Implement search mode detection
  - Write detectSearchMode() function
  - Use regex to identify commit ID pattern (40 or 64 hex chars)
  - Use regex to identify origin URL pattern
  - Provide visual feedback for detected mode
  - Add to src/lib/searchUtils.ts
  - _Requirements: 6.3_

- [x] 6.3 Write property test for mode detection
  - **Property 8: Search mode feedback**
  - **Validates: Requirements 6.3**

- [x] 6.4 Implement input validation
  - Validate commit ID format before querying
  - Validate origin URL format before querying
  - Display validation errors to user
  - Sanitize inputs for security
  - _Requirements: 1.3, 2.4_

- [x] 6.5 Wire search component to query engine
  - Connect form submission to appropriate query function
  - Handle loading states during query execution
  - Handle query errors and display to user
  - Pass results to display component
  - _Requirements: 1.1, 2.1_

- [x] 7. Implement results display component
- [x] 7.1 Create results display component
  - Build result list UI structure
  - Display vulnerability_filename and category for all results
  - Display revision_id and branch_name for origin results
  - Handle empty results with clear messaging
  - Style results with Tailwind CSS
  - Create component at src/components/ResultsDisplay.tsx
  - _Requirements: 1.2, 1.3, 2.2, 2.4_

- [x] 7.2 Write property test for field completeness
  - **Property 3: Required fields presence in vulnerability display**
  - **Validates: Requirements 1.2, 2.2**

- [x] 7.3 Write property test for result completeness
  - **Property 4: Result completeness**
  - **Validates: Requirements 1.5**

- [x] 7.4 Implement branch grouping for origin results
  - Write groupByBranch() function
  - Display results grouped by branch_name
  - Show branch headers with vulnerability counts
  - Clearly distinguish commits within each branch
  - Add to src/lib/resultUtils.ts
  - _Requirements: 2.3, 2.5_

- [ ] 7.5 Write property test for branch grouping
  - **Property 5: Branch grouping consistency**
  - **Validates: Requirements 2.3, 2.5**

- [x] 7.6 Add CVE detail interaction
  - Make each vulnerability clickable/expandable
  - Add visual indicator for interactivity (icon, hover state)
  - Trigger CVE detail loading on click
  - _Requirements: 3.1, 3.4_

- [ ] 7.7 Write property test for CVE interactivity
  - **Property 6: CVE detail interactivity**
  - **Validates: Requirements 3.1**

- [x] 8. Implement CVE detail viewer component
- [x] 8.1 Create CVE viewer component
  - Build modal or expandable section for CVE details
  - Display CVE id, summary, and details
  - Display severity ratings if present
  - Display affected packages/versions if present
  - Display references with clickable links
  - Add close/collapse functionality
  - Create component at src/components/CVEViewer.tsx
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 8.2 Write property test for CVE field completeness
  - **Property 7: CVE detail field completeness**
  - **Validates: Requirements 3.2**

- [x] 8.3 Handle CVE loading errors
  - Display error message if CVE file not found
  - Show vulnerability_filename even when details unavailable
  - Provide retry option
  - _Requirements: 3.5_

- [x] 8.4 Wire CVE viewer to query engine
  - Connect click events to loadCVEData()
  - Handle loading states
  - Render loaded CVE data
  - _Requirements: 3.4_

- [x] 9. Integrate components in main App
- [x] 9.1 Update App.tsx with main layout
  - Remove boilerplate code
  - Add SearchInterface component
  - Add ResultsDisplay component
  - Add CVEViewer component
  - Implement state management for search flow
  - Add header with title and navigation
  - _Requirements: 6.1, 6.2_

- [x] 10. Implement accessibility features
- [x] 10.1 Add keyboard navigation support
  - Ensure all interactive elements are focusable (tabindex)
  - Implement Enter key activation for custom clickable elements
  - Add visible focus indicators
  - Test tab order is logical
  - _Requirements: 10.3_

- [x] 10.2 Write property test for keyboard navigation
  - **Property 13: Keyboard navigation completeness**
  - **Validates: Requirements 10.3**

- [x] 10.3 Add ARIA labels and semantic HTML
  - Add aria-label to search input
  - Add aria-label to buttons
  - Add role="button" to clickable divs
  - Use semantic HTML (button, nav, main, etc.)
  - Add aria-live regions for dynamic content
  - _Requirements: 10.4_

- [x] 10.4 Write property test for accessibility labels
  - **Property 14: Accessibility label presence**
  - **Validates: Requirements 10.4**

- [x] 11. Create About/Context section
- [x] 11.1 Create About page component
  - Write content explaining research methodology
  - Reference "Chasing One-Day Vulnerabilities" paper
  - Explain commit-level vulnerability tracking
  - Describe fork-based vulnerability propagation
  - Include statistics (7162 repos, 2.2M forks, 135 vulnerable, 9 confirmed)
  - Style with Tailwind CSS
  - Create component at src/components/About.tsx
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [x] 11.2 Add navigation to About section
  - Add About link in header/navigation
  - Implement routing or modal for About content
  - _Requirements: 9.1_

- [x] 12. Implement responsive design
- [x] 12.1 Add responsive layout
  - Use Tailwind responsive utilities
  - Test on mobile viewport (320px+)
  - Test on tablet viewport (768px+)
  - Test on desktop viewport (1024px+)
  - Make tables scrollable on small screens
  - _Requirements: 10.1, 10.2, 10.5_

- [ ] 13. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Implement data preprocessing pipeline
- [x] 14.1 Create CVE extraction script
  - Write Node.js script to extract all.zip
  - Write script to extract tar.zst files from nvd_cve/
  - Implement path resolution logic for vulnerability_filename
  - Organize output maintaining directory structure (root vs nvd_cve/)
  - Validate extracted JSON files for OSV format
  - Generate extraction report
  - Create script at scripts/extractCVE.ts
  - _Requirements: 8.1, 8.4, 8.5_

- [ ]* 14.2 Write property test for CVE extraction
  - **Property 12: Archive extraction validity**
  - **Validates: Requirements 8.4, 8.5**

- [x] 15. Set up local development with MinIO
- [x] 15.1 Create local S3 setup documentation
  - Document MinIO installation (Docker recommended)
  - Provide docker-compose.yml for MinIO
  - Document bucket creation and data upload
  - Document CORS configuration for local development
  - Create docs/LOCAL_SETUP.md
  - _Requirements: 7.1, 7.3_

- [x] 15.2 Create data upload script for local S3
  - Write script to upload Parquet files to MinIO
  - Write script to upload extracted CVE JSON files
  - Maintain directory structure in S3
  - Create script at scripts/uploadToS3.js
  - _Requirements: 7.2_

- [ ] 16. Optimize performance
- [x] 16.1 Implement lazy loading for DuckDB
  - Only initialize DuckDB on first query
  - Show initialization progress to user
  - Cache initialized instance
  - _Requirements: 5.5_

- [x] 16.2 Add code splitting
  - Verify DuckDB WASM is in separate chunk (already configured in vite.config.ts)
  - Split CVE viewer into separate chunk using dynamic imports
  - Use dynamic imports for lazy loading
  - _Requirements: 4.5_

- [ ] 16.3 Implement result caching
  - Cache query results in memory
  - Use query string as cache key
  - Clear cache on page refresh
  - Add to query engine module
  - _Requirements: 5.5_

- [x] 17. Prepare end-to-end test data
- [x] 17.1 Extract subset of 300 vulnerabilities
  - Modify extractCVE script to limit to 300 vulnerabilities
  - Ensure diverse examples (multiple commits, origins, branches)
  - Extract corresponding CVE JSON files
  - Create test data directory structure
  - _Requirements: 11.1_

- [x] 17.2 Set up MinIO for end-to-end tests
  - Ensure MinIO is running via docker-compose
  - Create test bucket for e2e data
  - Upload 300-vulnerability Parquet files to MinIO
  - Upload corresponding CVE JSON files to MinIO
  - Verify CORS configuration for test environment
  - _Requirements: 11.1_

- [-] 18. Implement end-to-end tests
- [x] 18.1 Set up end-to-end testing framework
  - Install Playwright or Cypress
  - Configure test environment to use MinIO endpoint
  - Set up test fixtures and helpers
  - Configure test timeouts for DuckDB initialization
  - Create e2e test directory at src/__tests__/e2e/
  - _Requirements: 11.2_

- [x] 18.2 Write end-to-end test for commit search flow
  - **Property 15: End-to-end commit search flow**
  - Test input of known commit ID
  - Verify DuckDB queries MinIO successfully
  - Verify results display with all required fields
  - Verify no errors occur
  - **Validates: Requirements 11.2, 11.3**

- [x] 18.3 Write end-to-end test for origin search flow
  - **Property 16: End-to-end origin search flow**
  - Test input of known origin URL
  - Verify DuckDB queries MinIO successfully
  - Verify results grouped by branch
  - Verify all required fields displayed
  - **Validates: Requirements 11.2, 11.4**

- [x] 18.4 Write end-to-end test for CVE detail loading
  - **Property 17: End-to-end CVE detail loading**
  - Click on vulnerability result
  - Verify CVE JSON fetched from MinIO
  - Verify CVE data parsed and displayed
  - Verify all CVE fields render
  - **Validates: Requirements 11.5**

- [x] 18.5 Write end-to-end test for error handling
  - **Property 18: End-to-end error handling**
  - Test invalid commit ID (expect "no results")
  - Test invalid origin URL (expect "no results")
  - Test missing CVE file (expect error message)
  - Verify system doesn't crash on errors
  - **Validates: Requirements 11.6**

- [x] 18.6 Validate DuckDB WASM with MinIO
  - Verify DuckDB WASM initializes with MinIO endpoint
  - Verify httpfs extension configures S3 access
  - Verify Parquet files read correctly from MinIO
  - Monitor for memory leaks or performance issues
  - Catch WASM-specific errors
  - _Requirements: 11.1, 11.2_

- [ ] 19. Implement severity display with color-coded badges
- [ ] 19.1 Create severity parsing utility
  - Write parseSeverity() function to extract CVSS data from CVE entries
  - Support CVSS v3 (preferred) and v2 (fallback)
  - Parse numeric scores and determine severity levels
  - Handle missing or malformed CVSS data
  - Create utility at src/lib/severityUtils.ts
  - _Requirements: 12.1, 12.5_

- [ ] 19.2 Write property test for severity parsing
  - **Property 19: Severity information fetching**
  - **Validates: Requirements 12.1**

- [ ] 19.3 Create severity badge component
  - Build SeverityBadge component with color coding
  - Map severity levels to standard colors (Critical: red, High: orange, Medium: yellow, Low: blue, Unknown: gray)
  - Display severity level text
  - Display numeric score when available
  - Style with Tailwind CSS
  - Create component at src/components/SeverityBadge.tsx
  - _Requirements: 12.2, 12.3, 12.4_

- [ ] 19.4 Write property test for severity badge colors
  - **Property 20: Severity badge color coding**
  - **Validates: Requirements 12.2**

- [ ] 19.5 Write property test for severity text display
  - **Property 21: Severity text display**
  - **Validates: Requirements 12.3**

- [ ] 19.6 Write property test for severity score display
  - **Property 22: Severity score display**
  - **Validates: Requirements 12.4**

- [ ] 19.7 Integrate severity display in results
  - Fetch CVE data for each vulnerability result
  - Parse severity information and attach to results
  - Display SeverityBadge in result list items
  - Handle loading states for severity data
  - _Requirements: 12.1, 12.2_

- [x] 20. Implement result filtering functionality
- [x] 20.1 Create filter state management
  - Define ResultFilters interface (cveNameFilter, branchFilter, severityFilter)
  - Implement filter state in ResultsDisplay component
  - Add filter change handlers
  - Add clear filters handler
  - _Requirements: 13.1, 13.7_

- [x] 20.2 Create filter controls component
  - Build FilterControls component with input fields
  - Add CVE name text filter input
  - Add branch name text filter input
  - Add severity level multi-select
  - Add clear filters button
  - Display filtered count vs total count
  - Style with Tailwind CSS
  - Create component at src/components/FilterControls.tsx
  - _Requirements: 13.1, 13.6_

- [x] 20.3 Implement filter application logic
  - Write applyFilters() function
  - Implement CVE name filter (case-insensitive substring match)
  - Implement branch name filter (case-insensitive substring match)
  - Implement severity level filter (exact match, multiple selection)
  - Apply AND logic for multiple active filters
  - Add to src/lib/filterUtils.ts
  - _Requirements: 13.2, 13.3, 13.4, 13.5_

- [x] 20.4 Write property test for CVE name filtering
  - **Property 23: CVE name filter matching**
  - **Validates: Requirements 13.2**

- [x] 20.5 Write property test for branch name filtering
  - **Property 24: Branch name filter matching**
  - **Validates: Requirements 13.3**

- [x] 20.6 Write property test for severity filtering
  - **Property 25: Severity level filter matching**
  - **Validates: Requirements 13.4**

- [x] 20.7 Write property test for multiple filter AND logic
  - **Property 26: Multiple filter AND logic**
  - **Validates: Requirements 13.5**

- [x] 20.8 Write property test for filter count accuracy
  - **Property 27: Filter count accuracy**
  - **Validates: Requirements 13.6**

- [x] 20.9 Write property test for clear filters
  - **Property 28: Clear filters restoration**
  - **Validates: Requirements 13.7**

- [x] 20.10 Integrate filters in results display
  - Add FilterControls component above results list
  - Wire filter state to applyFilters() function
  - Update displayed results based on active filters
  - Show filtered count and total count
  - Handle empty filtered results
  - _Requirements: 13.1, 13.6_

- [ ] 21. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 22. Create deployment configuration
- [ ] 22.1 Set up S3 bucket for production
  - Create S3 bucket with appropriate name
  - Configure CORS for production domain
  - Set up bucket policy for public read access
  - Enable compression (gzip/brotli)
  - _Requirements: 4.4_

- [ ] 22.2 Create build and deploy scripts
  - Write script to run data preprocessing
  - Write script to upload data to production S3
  - Configure Vite build for production (already configured)
  - Write deployment script for static site (Netlify/Vercel/GitHub Pages)
  - Create scripts at scripts/build.sh and scripts/deploy.sh
  - _Requirements: 4.1, 4.5_

- [ ] 22.3 Set up CI/CD pipeline
  - Create GitHub Actions workflow (or similar)
  - Automate data preprocessing on data updates
  - Automate S3 upload
  - Automate static site deployment
  - Run tests in CI
  - Create .github/workflows/deploy.yml
  - _Requirements: 4.1_
