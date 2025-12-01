# Requirements Document

## Introduction

This document specifies the requirements for a static vulnerability lookup website that enables developers to identify one-day vulnerabilities in forked repositories. The system leverages data from Software Heritage archive analysis to track vulnerable commits across 2.2M forks, helping maintainers discover unpatched vulnerabilities that propagated through forking rather than dependency chains.

The website provides two primary lookup capabilities: finding all vulnerabilities associated with a specific commit ID, and discovering all vulnerabilities affecting a particular fork (origin URL) including impacted branches and commits.

## Glossary

- **VulnLookupSystem**: The static website application that provides vulnerability lookup functionality
- **OSV Format**: Open Source Vulnerability format used for CVE entries
- **Origin**: A repository URL in Software Heritage terminology (e.g., a GitHub repository)
- **Revision ID**: A commit identifier (SHA) in Software Heritage
- **One-Day Vulnerability**: A vulnerability that exists in a fork after being patched in the original project
- **DuckDB**: An embedded analytical database used for querying Parquet files
- **S3 Server**: Object storage server hosting the Parquet data files
- **Static Site**: A website with no server-side processing, serving pre-generated content

## Requirements

### Requirement 1

**User Story:** As a security researcher, I want to search for vulnerabilities by commit ID, so that I can identify all known vulnerabilities associated with a specific commit.

#### Acceptance Criteria

1. WHEN a user enters a valid commit ID (revision_id) in the search interface THEN the VulnLookupSystem SHALL retrieve and display all associated vulnerabilities from the dataset
2. WHEN vulnerability results are displayed THEN the VulnLookupSystem SHALL show the vulnerability filename, category, and CVE details in OSV format
3. WHEN a user enters an invalid or non-existent commit ID THEN the VulnLookupSystem SHALL display a clear message indicating no vulnerabilities were found
4. WHEN the search query executes THEN the VulnLookupSystem SHALL complete the lookup within 3 seconds for typical queries
5. WHEN multiple vulnerabilities are associated with a commit THEN the VulnLookupSystem SHALL display all results in a structured list format

### Requirement 2

**User Story:** As a fork maintainer, I want to search by repository URL (origin), so that I can discover all vulnerabilities affecting my fork and the specific branches/commits impacted.

#### Acceptance Criteria

1. WHEN a user enters a valid origin URL in the search interface THEN the VulnLookupSystem SHALL retrieve all vulnerabilities affecting that repository
2. WHEN vulnerability results for an origin are displayed THEN the VulnLookupSystem SHALL show the revision_id, branch_name, vulnerability_filename, and category for each vulnerability
3. WHEN displaying origin results THEN the VulnLookupSystem SHALL group vulnerabilities by branch name for easier navigation
4. WHEN a user enters an origin URL not present in the dataset THEN the VulnLookupSystem SHALL display a message indicating the repository has no known vulnerabilities
5. WHEN the origin has vulnerabilities in multiple branches THEN the VulnLookupSystem SHALL clearly distinguish which commits and branches are affected

### Requirement 3

**User Story:** As a developer, I want to view detailed CVE information, so that I can understand the severity and nature of each vulnerability.

#### Acceptance Criteria

1. WHEN a vulnerability is displayed THEN the VulnLookupSystem SHALL provide a link or expandable section to view the full OSV-format CVE entry
2. WHEN CVE details are shown THEN the VulnLookupSystem SHALL parse and display key fields including severity, description, affected versions, and references
3. WHEN the CVE data is in OSV format THEN the VulnLookupSystem SHALL render it in a human-readable structured format
4. WHEN a user clicks on a vulnerability filename THEN the VulnLookupSystem SHALL load and display the corresponding CVE JSON data
5. WHEN CVE data fails to load THEN the VulnLookupSystem SHALL display an error message and provide the vulnerability filename for reference

### Requirement 4

**User Story:** As a system architect, I want the website to be entirely static, so that it can be deployed without server-side infrastructure and scale efficiently.

#### Acceptance Criteria

1. THE VulnLookupSystem SHALL generate all HTML, CSS, and JavaScript as static files that require no server-side processing
2. WHEN the website is deployed THEN the VulnLookupSystem SHALL function entirely through client-side JavaScript execution
3. WHEN data queries are performed THEN the VulnLookupSystem SHALL use DuckDB WebAssembly to query Parquet files directly in the browser
4. THE VulnLookupSystem SHALL load Parquet data files from S3-compatible object storage via HTTP requests
5. WHEN the static site is built THEN the VulnLookupSystem SHALL include all necessary dependencies bundled or referenced via CDN

### Requirement 5

**User Story:** As a developer, I want the system to efficiently query large Parquet datasets, so that searches remain fast despite the 2.2M fork dataset size.

#### Acceptance Criteria

1. WHEN querying Parquet files THEN the VulnLookupSystem SHALL use DuckDB to execute SQL queries against the vulnerable_commits and vulnerable_origins datasets
2. WHEN loading data THEN the VulnLookupSystem SHALL leverage Parquet columnar format to read only necessary columns for each query
3. WHEN a search is initiated THEN the VulnLookupSystem SHALL use appropriate indexes or partitioning strategies to minimize data transfer
4. WHEN Parquet files are stored in S3 THEN the VulnLookupSystem SHALL configure DuckDB to read directly from S3 URLs without downloading entire files
5. WHEN multiple searches are performed THEN the VulnLookupSystem SHALL cache DuckDB connections and metadata to improve subsequent query performance

### Requirement 6

**User Story:** As a user, I want an intuitive search interface similar to osv.dev, so that I can easily look up vulnerabilities without technical expertise.

#### Acceptance Criteria

1. WHEN a user visits the website THEN the VulnLookupSystem SHALL display a prominent search interface with clear input fields
2. WHEN the search interface loads THEN the VulnLookupSystem SHALL provide two distinct search modes: by commit ID and by origin URL
3. WHEN a user types in the search field THEN the VulnLookupSystem SHALL provide visual feedback indicating which search mode is active
4. WHEN displaying results THEN the VulnLookupSystem SHALL use a clean, readable layout inspired by osv.dev design patterns
5. WHEN the page loads THEN the VulnLookupSystem SHALL include example searches or placeholder text to guide users

### Requirement 7

**User Story:** As a developer, I want to test the system locally with a mock S3 server, so that I can develop and validate functionality before deploying to production.

#### Acceptance Criteria

1. WHEN running in development mode THEN the VulnLookupSystem SHALL support configuration to point to a local S3-compatible server
2. WHEN a local S3 server is configured THEN the VulnLookupSystem SHALL load Parquet files from the local endpoint instead of production S3
3. WHEN setting up the development environment THEN the VulnLookupSystem SHALL provide documentation for running a local S3 server (e.g., MinIO or LocalStack)
4. WHEN switching between development and production THEN the VulnLookupSystem SHALL use environment-based configuration to determine the S3 endpoint
5. WHEN the local S3 server is running THEN the VulnLookupSystem SHALL successfully query Parquet data with the same functionality as production

### Requirement 8

**User Story:** As a maintainer, I want the system to handle the existing data formats correctly, so that all vulnerability information is accurately represented.

#### Acceptance Criteria

1. WHEN loading CVE data THEN the VulnLookupSystem SHALL parse OSV-format JSON files from the CVE directory structure
2. WHEN reading vulnerable_commits_using_cherrypicks_swhid Parquet files THEN the VulnLookupSystem SHALL correctly interpret columns: revision_id, category, vulnerability_filename
3. WHEN reading vulnerable_origins Parquet files THEN the VulnLookupSystem SHALL correctly interpret columns: origin, revision_id, branch_name, vulnerability_filename
4. WHEN CVE entries are stored in tar.zst archives THEN the VulnLookupSystem SHALL provide a mechanism to extract and serve them as static JSON files during build time
5. WHEN the all.zip file contains CVE entries THEN the VulnLookupSystem SHALL support using this as an alternative source for CVE data

### Requirement 9

**User Story:** As a security researcher, I want to understand the research context, so that I can properly interpret the vulnerability data and cite the work.

#### Acceptance Criteria

1. WHEN a user visits the website THEN the VulnLookupSystem SHALL include an "About" section explaining the research methodology
2. WHEN the About section is displayed THEN the VulnLookupSystem SHALL reference the paper "Chasing One-Day Vulnerabilities" and its findings
3. WHEN explaining the data THEN the VulnLookupSystem SHALL clarify that vulnerabilities are tracked at the commit level across 2.2M forks
4. WHEN describing the approach THEN the VulnLookupSystem SHALL explain how vulnerabilities propagate through forking rather than dependencies
5. WHEN providing context THEN the VulnLookupSystem SHALL include statistics: 7162 source repositories, 2.2M forks analyzed, 135 potentially vulnerable forks identified, 9 confirmed high-severity one-day vulnerabilities

### Requirement 10

**User Story:** As a user, I want the website to be responsive and accessible, so that I can use it on different devices and with assistive technologies.

#### Acceptance Criteria

1. WHEN the website is accessed on mobile devices THEN the VulnLookupSystem SHALL display a responsive layout that adapts to smaller screens
2. WHEN the website is accessed on desktop browsers THEN the VulnLookupSystem SHALL utilize available screen space efficiently
3. WHEN users navigate with keyboard THEN the VulnLookupSystem SHALL support full keyboard navigation for all interactive elements
4. WHEN screen readers are used THEN the VulnLookupSystem SHALL provide appropriate ARIA labels and semantic HTML
5. WHEN displaying data tables THEN the VulnLookupSystem SHALL ensure tables are scrollable and readable on all screen sizes

### Requirement 11

**User Story:** As a developer, I want comprehensive end-to-end tests using real data, so that I can verify the entire system works correctly and catch integration issues early.

#### Acceptance Criteria

1. WHEN running end-to-end tests THEN the VulnLookupSystem SHALL use MinIO with actual Parquet and CVE data files
2. WHEN executing end-to-end tests THEN the VulnLookupSystem SHALL verify the complete flow from search input through DuckDB query to result display
3. WHEN end-to-end tests query by commit ID THEN the VulnLookupSystem SHALL successfully retrieve and validate vulnerability data from real Parquet files
4. WHEN end-to-end tests query by origin URL THEN the VulnLookupSystem SHALL successfully retrieve and validate vulnerability data including branch grouping
5. WHEN end-to-end tests load CVE details THEN the VulnLookupSystem SHALL successfully fetch and parse real CVE JSON files from MinIO
6. WHEN end-to-end tests encounter errors THEN the VulnLookupSystem SHALL properly handle and report DuckDB errors, S3 connection issues, and data format problems

### Requirement 11

**User Story:** As a developer, I want comprehensive end-to-end tests using real data, so that I can verify the entire system works correctly and catch integration issues early.

#### Acceptance Criteria

1. WHEN running end-to-end tests THEN the VulnLookupSystem SHALL use MinIO with actual Parquet and CVE data files
2. WHEN executing end-to-end tests THEN the VulnLookupSystem SHALL verify the complete flow from search input through DuckDB query to result display
3. WHEN end-to-end tests query by commit ID THEN the VulnLookupSystem SHALL successfully retrieve and validate vulnerability data from real Parquet files
4. WHEN end-to-end tests query by origin URL THEN the VulnLookupSystem SHALL successfully retrieve and validate vulnerability data including branch grouping
5. WHEN end-to-end tests load CVE details THEN the VulnLookupSystem SHALL successfully fetch and parse real CVE JSON files from MinIO
6. WHEN end-to-end tests encounter errors THEN the VulnLookupSystem SHALL properly handle and report DuckDB errors, S3 connection issues, and data format problems
