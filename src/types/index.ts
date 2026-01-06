/**
 * Core type definitions for the Vulnerability Fork Lookup System
 * Based on design document specifications
 */

/**
 * Result from querying vulnerable_commits_using_cherrypicks_swhid Parquet files
 * Represents a vulnerability associated with a specific commit
 */
export interface VulnerabilityResult {
  revision_swhid: string;        // Commit SHA (40 or 64 hex characters)
  category: string;           // Vulnerability category
  vulnerability_filename: string;  // Reference to CVE JSON file
  cveData?: CVEEntry;         // Optional CVE data loaded on demand
  severity?: string;          // Calculated severity level (Critical, High, Medium, Low, None)
  cvssScore?: number;         // Calculated CVSS score
}

/**
 * Result from querying vulnerable_origins Parquet files
 * Represents a vulnerability in a specific repository origin
 */
export interface OriginVulnerabilityResult {
  origin: string;             // Repository URL
  revision_swhid: string;        // Commit SHA
  branch_name: string;        // Affected branch
  vulnerability_filename: string;  // Reference to CVE JSON file
  cveData?: CVEEntry;         // Optional CVE data loaded on demand
  severity?: string;          // Calculated severity level (Critical, High, Medium, Low, None)
  cvssScore?: number;         // Calculated CVSS score
}

/**
 * CVE Entry in OSV (Open Source Vulnerability) format
 * Represents detailed vulnerability information
 */
export interface CVEEntry {
  id: string;                 // CVE identifier (e.g., "CVE-2024-1234")
  summary: string;            // Brief description
  details: string;            // Detailed description
  severity?: Severity[];      // Severity ratings (optional)
  affected?: Affected[];      // Affected packages/versions (optional)
  references?: Reference[];   // External references (optional)
  published?: string;         // Publication date (optional)
  modified?: string;          // Last modified date (optional)
}

/**
 * Severity rating for a CVE entry
 */
export interface Severity {
  type: string;               // e.g., "CVSS_V3"
  score: string;              // Severity score
}

/**
 * Information about affected packages and versions
 */
export interface Affected {
  package?: Package;
  ranges?: Range[];
  versions?: string[];
}

/**
 * Package information
 */
export interface Package {
  ecosystem?: string;         // Package ecosystem (e.g., "npm", "PyPI")
  name?: string;              // Package name
  purl?: string;              // Package URL
}

/**
 * Version range information
 */
export interface Range {
  type?: string;              // Range type (e.g., "SEMVER", "GIT")
  events?: RangeEvent[];      // Range events
  repo?: string;              // Repository URL
}

/**
 * Range event (introduced/fixed versions)
 */
export interface RangeEvent {
  introduced?: string;        // Version where vulnerability was introduced
  fixed?: string;             // Version where vulnerability was fixed
  last_affected?: string;     // Last affected version
  limit?: string;             // Upper limit
}

/**
 * External reference for a CVE entry
 */
export interface Reference {
  type: string;               // e.g., "WEB", "ADVISORY", "ARTICLE"
  url: string;                // Reference URL
}

/**
 * S3 configuration for data storage
 */
export interface S3Config {
  endpoint: string;           // S3 endpoint URL
  bucket: string;             // S3 bucket name
  region?: string;            // AWS region (optional)
}

/**
 * Application configuration
 */
export interface AppConfig {
  apiBaseUrl: string;             // Base URL for the vulnerability API
  environment: 'development' | 'production';
  // Legacy fields kept for backward compatibility (no longer used)
  s3: S3Config;
  parquetPaths: {
    vulnerableCommits: string;    // Path to vulnerable commits Parquet files
    vulnerableOrigins: string;    // Path to vulnerable origins Parquet files
  };
  cvePath: string;                // Path to CVE JSON files
}

/**
 * Filter state for vulnerability results
 * Requirements: 13.1, 13.7
 */
export interface ResultFilters {
  cveNameFilter: string;          // Filter by CVE identifier (case-insensitive substring)
  branchFilter: string;           // Filter by branch name (case-insensitive substring)
  severityFilter: string[];       // Filter by severity levels (exact match, multiple selection)
}
