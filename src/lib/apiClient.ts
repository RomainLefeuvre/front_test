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
  details: string;
  [key: string]: any;
}

/**
 * Configuration for the API client
 */
export interface ApiConfig {
  baseUrl: string;
  timeout?: number;
}

/**
 * API Client class
 */
export class ApiClient {
  private baseUrl: string;
  private timeout: number;

  constructor(config: ApiConfig) {
    this.baseUrl = config.baseUrl ? config.baseUrl.replace(/\/$/, '') : ''; // Remove trailing slash, allow empty
    this.timeout = config.timeout || 30000; // 30 second default timeout
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
   * Query vulnerabilities by origin URL
   * Replaces queryEngine.queryByOrigin()
   */
  async queryByOrigin(originUrl: string): Promise<OriginVulnerabilityResult[]> {
    console.log('API: Querying origin', { originUrl });
    
    try {
      const startTime = performance.now();
      
      const url = `/api/origin/vulnerabilities?${new URLSearchParams({ url: originUrl })}`;
      const response = await this.fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data: OriginVulnerabilityResponse = await response.json();
      const queryTime = performance.now() - startTime;
      
      console.log(`API: Found ${data.vulnerable_commits.length} results in ${queryTime.toFixed(2)}ms`);
      
      // Convert API response to legacy format for backward compatibility
      const results: OriginVulnerabilityResult[] = data.vulnerable_commits.map(commit => ({
        origin: data.origin,
        revision_swhid: commit.revision_id,
        branch_name: commit.branch_name,
        vulnerability_filename: commit.vulnerability_filename,
      }));
      
      return results;
    } catch (error) {
      console.error('API: Query by origin failed', error);
      throw new Error(
        `Failed to query by origin: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Query vulnerabilities by commit ID (SWHID)
   * Replaces queryEngine.queryByCommitId()
   */
  async queryByCommitId(revisionId: string): Promise<VulnerabilityResult[]> {
    console.log('API: Querying commit', { revisionId });
    
    try {
      const startTime = performance.now();
      
      // Ensure SWHID format (add prefix if missing)
      const swhid = revisionId.startsWith('swh:1:rev:') ? revisionId : `swh:1:rev:${revisionId}`;
      
      const url = `/api/swhid/${encodeURIComponent(swhid)}/vulnerabilities`;
      const response = await this.fetch(url);
      
      if (!response.ok) {
        if (response.status === 404) {
          console.log(`API: SWHID not found: ${swhid}`);
          return [];
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data: VulnerabilityResponse = await response.json();
      const queryTime = performance.now() - startTime;
      
      console.log(`API: Found ${data.vulnerabilities.length} results in ${queryTime.toFixed(2)}ms`);
      
      // Convert API response to legacy format for backward compatibility
      const results: VulnerabilityResult[] = data.vulnerabilities.map(filename => ({
        revision_swhid: data.swhid,
        category: '', // Not provided by API
        vulnerability_filename: filename,
      }));
      
      return results;
    } catch (error) {
      console.error('API: Query by commit ID failed', error);
      throw new Error(
        `Failed to query by commit ID: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Load CVE data from public directory
   * Keeps the same logic as before since CVE files are served statically
   */
  async loadCVEData(vulnerabilityFilename: string): Promise<CVEEntry> {
    try {
      // Extract just the filename from paths like "osv-output/CVE-2021-21394.json"
      const filename = vulnerabilityFilename.split('/').pop() || vulnerabilityFilename;
      
      // Load from application's public directory (served by Vite)
      const publicUrl = `/cve/${filename}`;
      
      const response = await fetch(publicUrl);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const cveData = await response.json() as CVEEntry;
      
      // Validate required fields
      if (!cveData.id || !cveData.details) {
        throw new Error('Invalid CVE format: missing required fields (id or details)');
      }
      
      return cveData;
    } catch (error) {
      throw new Error(
        `Failed to load CVE data for ${vulnerabilityFilename}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Internal fetch wrapper with timeout and error handling
   */
  private async fetch(path: string): Promise<Response> {
    const url = `${this.baseUrl}${path}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });
      
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${this.timeout}ms`);
      }
      
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
  ): Promise<CVEEntry> {
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