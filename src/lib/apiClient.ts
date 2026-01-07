/**
 * API Client for SWH OSV Vulnerability API
 * Replaces DuckDB WASM with REST API calls
 */

// API Response Types (matching OpenAPI schema)
export interface OriginVulnerabilityRecord {
  revision_id: string;
  branch_name: string;
  vulnerability_filename: string;
}

export interface OriginVulnerabilityResponse {
  origin: string;
  vulnerable_commits: OriginVulnerabilityRecord[];
}

export interface VulnerabilityResponse {
  swhid: string;
  vulnerabilities: string[];
}

// JSON endpoint response types
export interface VulnerabilityJsonRecord {
  filename: string;
  json_content: any;
}

export interface OriginCommitEntry {
  origin: string;
  revision_id: string;
  branch_name: string;
  vulnerability_filenames: string[];
}

export interface OriginVulnerabilityWithJsonResponse {
  entries: OriginCommitEntry[];
  associated_set_of_vuln: VulnerabilityJsonRecord[];
}

export interface SwhidEntry {
  swhid: string;
}

export interface VulnerabilityWithJsonResponse {
  entry: SwhidEntry;
  associated_set_of_vuln: VulnerabilityJsonRecord[];
}

// Legacy types for backward compatibility
export interface VulnerabilityResult {
  revision_swhid: string;
  category: string;
  vulnerability_filename: string;
}

export interface OriginVulnerabilityResult {
  origin: string;
  revision_swhid: string;
  branch_name: string;
  vulnerability_filename: string;
}

export interface CVEEntry {
  id: string;
  summary: string;
  details: string;
  severity?: any[];
  [key: string]: any;
}

/**
 * Configuration for the API client
 */
export interface ApiConfig {
  baseUrl: string;
}

/**
 * API Client class
 */
export class ApiClient {
  private baseUrl: string;

  constructor(config: ApiConfig) {
    this.baseUrl = config.baseUrl ? config.baseUrl.replace(/\/$/, '') : ''; // Remove trailing slash, allow empty
  }

  /**
   * Health check endpoint
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.fetch('/health');
      return response.ok;
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  }

  /**
   * Query vulnerabilities by origin URL with JSON content
   * Uses the /json endpoint to get vulnerability data without manual loading
   */
  async queryByOrigin(originUrl: string): Promise<OriginVulnerabilityResult[]> {
    console.log('API: Querying origin with JSON', { originUrl });
    
    try {
      const startTime = performance.now();
      
      const url = `/api/origin/vulnerabilities/json?${new URLSearchParams({ url: originUrl })}`;
      const response = await this.fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data: OriginVulnerabilityWithJsonResponse = await response.json();
      const queryTime = performance.now() - startTime;
      
      // Count total vulnerabilities across all commits
      const totalVulns = data.entries.reduce((sum, entry) => sum + entry.vulnerability_filenames.length, 0);
      console.log(`API: Found ${totalVulns} vulnerabilities across ${data.entries.length} commits in ${queryTime.toFixed(2)}ms`);
      
      // Convert API response to legacy format for backward compatibility
      const results: OriginVulnerabilityResult[] = [];
      const allVulnFilenames = new Set<string>();
      
      for (const entry of data.entries) {
        for (const filename of entry.vulnerability_filenames) {
          allVulnFilenames.add(filename);
          results.push({
            origin: entry.origin,
            revision_swhid: entry.revision_id,
            branch_name: entry.branch_name,
            vulnerability_filename: filename,
          });
        }
      }
      
      // Store vulnerability JSON data for later use (avoid manual loading)
      this.cacheVulnerabilityData(data.associated_set_of_vuln);
      
      // Log info about missing vulnerabilities if any
      const cachedFilenames = new Set(data.associated_set_of_vuln.map(v => v.filename));
      const missingFromCache = Array.from(allVulnFilenames).filter(f => {
        const filename = f.split('/').pop() || f;
        return !cachedFilenames.has(filename);
      });
      
      if (missingFromCache.length > 0) {
        console.info(`API: ${missingFromCache.length} vulnerabilities will not have detailed CVE data (not in associated_set_of_vuln)`);
      }
      
      return results;
    } catch (error) {
      console.error('API: Query by origin failed', error);
      throw new Error(
        `Failed to query by origin: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Query vulnerabilities by commit ID (SWHID) with JSON content
   * Uses the /json endpoint to get vulnerability data without manual loading
   */
  async queryByCommitId(revisionId: string): Promise<VulnerabilityResult[]> {
    console.log('API: Querying commit with JSON', { revisionId });
    
    try {
      const startTime = performance.now();
      
      // Ensure SWHID format (add prefix if missing)
      const swhid = revisionId.startsWith('swh:1:rev:') ? revisionId : `swh:1:rev:${revisionId}`;
      
      const url = `/api/swhid/${encodeURIComponent(swhid)}/vulnerabilities/json`;
      const response = await this.fetch(url);
      
      if (!response.ok) {
        if (response.status === 404) {
          console.log(`API: SWHID not found: ${swhid}`);
          return [];
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data: VulnerabilityWithJsonResponse = await response.json();
      const queryTime = performance.now() - startTime;
      
      console.log(`API: Found ${data.associated_set_of_vuln.length} vulnerabilities in ${queryTime.toFixed(2)}ms`);
      
      // Store vulnerability JSON data for later use (avoid manual loading)
      this.cacheVulnerabilityData(data.associated_set_of_vuln);
      
      // Convert API response to legacy format for backward compatibility
      const results: VulnerabilityResult[] = data.associated_set_of_vuln.map(vuln => ({
        revision_swhid: data.entry.swhid,
        category: '', // Not provided by API
        vulnerability_filename: vuln.filename,
      }));
      
      return results;
    } catch (error) {
      console.error('API: Query by commit ID failed', error);
      throw new Error(
        `Failed to query by commit ID: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // Cache for vulnerability JSON data to avoid manual loading
  private vulnerabilityCache = new Map<string, any>();

  /**
   * Cache vulnerability JSON data from API responses
   */
  private cacheVulnerabilityData(vulnerabilities: VulnerabilityJsonRecord[]): void {
    for (const vuln of vulnerabilities) {
      // Normalize filename to just the basename for consistent lookup
      const normalizedFilename = vuln.filename.split('/').pop() || vuln.filename;
      this.vulnerabilityCache.set(normalizedFilename, vuln.json_content);
    }
    console.log(`API: Cached ${vulnerabilities.length} vulnerability JSON records`);
  }

  /**
   * Load CVE data - uses only cached data from JSON endpoints
   * Returns null if data is not available instead of throwing an error
   */
  async loadCVEData(vulnerabilityFilename: string): Promise<CVEEntry | null> {
    // Extract just the filename from paths like "osv-output/CVE-2021-21394.json"
    const filename = vulnerabilityFilename.split('/').pop() || vulnerabilityFilename;
    
    // Get from cache (populated by JSON endpoints)
    if (this.vulnerabilityCache.has(filename)) {
      const cachedData = this.vulnerabilityCache.get(filename);
      console.log(`API: Using cached CVE data for ${filename}`);
      
      // Create a copy to avoid modifying the cached data
      const cveData = { ...cachedData };
      
      // Validate and fix required fields, but don't reject the data
      if (!cveData.id) {
        console.warn(`API: Missing 'id' field for ${filename}, using filename as fallback`);
        cveData.id = filename.replace('.json', '');
      }
      
      if (!cveData.details) {
        console.warn(`API: Missing 'details' field for ${filename}, using empty string as fallback`);
        cveData.details = '';
      }
      
      // Ensure summary field exists (use details as fallback, or id if details is empty)
      if (!cveData.summary) {
        cveData.summary = cveData.details || cveData.id || 'No summary available';
      }
      
      return cveData as CVEEntry;
    }
    
    // Data not found in cache - return null instead of throwing error
    console.warn(`API: CVE data not found in cache for ${filename} - skipping enrichment`);
    return null;
  }

  /**
   * Internal fetch wrapper with error handling (no timeout)
   */
  private async fetch(path: string): Promise<Response> {
    const url = `${this.baseUrl}${path}`;
    
    try {
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });
      
      return response;
    } catch (error) {
      throw error;
    }
  }
}

// Export singleton instance (will be configured in main app)
export let apiClient: ApiClient;

/**
 * Initialize the API client with configuration
 */
export function initializeApiClient(config: ApiConfig): void {
  apiClient = new ApiClient(config);
  console.log(`API Client initialized with base URL: ${config.baseUrl}`);
}

// Legacy compatibility - export the same interface as queryEngine
export const queryEngine = {
  async queryByOrigin(
    originUrl: string,
    _parquetPath: string, // Ignored - no longer needed
    _s3Config: any // Ignored - no longer needed
  ): Promise<OriginVulnerabilityResult[]> {
    if (!apiClient) {
      throw new Error('API client not initialized. Call initializeApiClient() first.');
    }
    return apiClient.queryByOrigin(originUrl);
  },

  async queryByCommitId(
    revisionId: string,
    _parquetPath: string, // Ignored - no longer needed
    _s3Config: any // Ignored - no longer needed
  ): Promise<VulnerabilityResult[]> {
    if (!apiClient) {
      throw new Error('API client not initialized. Call initializeApiClient() first.');
    }
    return apiClient.queryByCommitId(revisionId);
  },

  async loadCVEData(
    vulnerabilityFilename: string,
    _cvePath: string, // Ignored - no longer needed
    _s3Config: any // Ignored - no longer needed
  ): Promise<CVEEntry | null> {
    if (!apiClient) {
      throw new Error('API client not initialized. Call initializeApiClient() first.');
    }
    return apiClient.loadCVEData(vulnerabilityFilename);
  },

  // Legacy methods that are no longer needed
  async initialize(_s3Config: any): Promise<void> {
    // No-op - initialization is now done via initializeApiClient()
  },

  async close(): Promise<void> {
    // No-op - no resources to clean up
  },

  isInitialized(): boolean {
    return !!apiClient;
  },

  setProgressCallback(_callback: any): void {
    // No-op - no initialization progress with API
  },
};