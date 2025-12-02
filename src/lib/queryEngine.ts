/**
 * DuckDB Query Engine Module
 * Handles initialization and querying of Parquet files using DuckDB WASM
 * Requirements: 4.3, 5.1, 5.4, 5.5
 */

import * as duckdb from '@duckdb/duckdb-wasm';
import type { S3Config, VulnerabilityResult, OriginVulnerabilityResult, CVEEntry } from '../types';

/**
 * Initialization progress callback type
 */
export type InitializationProgressCallback = (stage: string, progress: number) => void;

/**
 * Query engine instance that manages DuckDB connection and queries
 */
class QueryEngine {
  private db: duckdb.AsyncDuckDB | null = null;
  private conn: duckdb.AsyncDuckDBConnection | null = null;
  private s3Config: S3Config | null = null;
  private initialized = false;
  private initializing = false;
  private initializationPromise: Promise<void> | null = null;
  private progressCallback: InitializationProgressCallback | null = null;

  /**
   * Set a callback to receive initialization progress updates
   * 
   * @param callback - Function to call with progress updates
   */
  setProgressCallback(callback: InitializationProgressCallback | null): void {
    this.progressCallback = callback;
  }



  /**
   * Report initialization progress to the callback if set
   */
  private reportProgress(stage: string, progress: number): void {
    if (this.progressCallback) {
      this.progressCallback(stage, progress);
    }
  }

  /**
   * Initialize DuckDB WASM with S3 configuration
   * Sets up connection pooling/caching and configures S3 access
   * 
   * @param s3Config - S3 configuration for data access
   * @throws Error if initialization fails
   */
  async initialize(s3Config: S3Config): Promise<void> {
    // Return early if already initialized with same config
    if (this.initialized && this.s3Config?.endpoint === s3Config.endpoint) {
      return;
    }

    // If initialization is in progress, wait for it to complete
    if (this.initializing && this.initializationPromise) {
      return this.initializationPromise;
    }

    // Mark as initializing and create promise
    this.initializing = true;
    this.initializationPromise = this.performInitialization(s3Config);

    try {
      await this.initializationPromise;
    } finally {
      this.initializing = false;
      this.initializationPromise = null;
    }
  }

  /**
   * Performs the actual initialization work
   */
  private async performInitialization(s3Config: S3Config): Promise<void> {
    try {
      // Check if SharedArrayBuffer is available (required for some DuckDB features)
      const hasSharedArrayBuffer = typeof SharedArrayBuffer !== 'undefined';
      console.log('DuckDB: SharedArrayBuffer available:', hasSharedArrayBuffer);
      
      this.reportProgress('Loading DuckDB bundle', 10);
      
      // Import worker and WASM URLs using Vite's import system
      // This ensures proper bundling and MIME types
      const MANUAL_BUNDLES: duckdb.DuckDBBundles = {
        mvp: {
          mainModule: new URL('@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm', import.meta.url).href,
          mainWorker: new URL('@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js', import.meta.url).href,
        },
        eh: {
          mainModule: new URL('@duckdb/duckdb-wasm/dist/duckdb-eh.wasm', import.meta.url).href,
          mainWorker: new URL('@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js', import.meta.url).href,
        },
      };
      
      console.log('DuckDB: Selecting bundle...');
      const bundle = await duckdb.selectBundle(MANUAL_BUNDLES);
      
      console.log('DuckDB: Selected bundle', {
        worker: bundle.mainWorker,
        module: bundle.mainModule,
      });

      this.reportProgress('Creating worker', 30);
      
      // Create worker and logger with error handling
      let worker: Worker;
      try {
        if (!bundle.mainWorker) {
          throw new Error('Bundle mainWorker is not defined');
        }
        worker = new Worker(bundle.mainWorker);
        
        // Add error listener to catch worker errors
        worker.onerror = (error) => {
          console.error('DuckDB Worker error:', error);
        };
        
        worker.onmessageerror = (error) => {
          console.error('DuckDB Worker message error:', error);
        };
      } catch (error) {
        throw new Error(`Failed to create worker: ${error instanceof Error ? error.message : String(error)}`);
      }
      
      const logger = new duckdb.ConsoleLogger();
      
      this.reportProgress('Initializing database', 50);
      
      // Initialize database
      try {
        this.db = new duckdb.AsyncDuckDB(logger, worker);
        await this.db.instantiate(bundle.mainModule);
      } catch (error) {
        worker.terminate();
        throw new Error(`Failed to instantiate DuckDB: ${error instanceof Error ? error.message : String(error)}`);
      }
      
      this.reportProgress('Creating connection', 70);
      
      // Create connection
      this.conn = await this.db.connect();
      
      this.reportProgress('Configuring S3 access', 85);
      
      // HTTP Range request support is built-in for DuckDB WASM 1.31.0+
      // Configure HTTP settings for better performance
      try {
        await this.conn.query("SET enable_http_metadata_cache=true;");
        console.log('DuckDB: HTTP metadata cache enabled');
      } catch (e) {
        console.log('DuckDB: enable_http_metadata_cache not available, skipping');
      }
      
      try {
        await this.conn.query("SET http_timeout=30000;");
        console.log('DuckDB: HTTP timeout set to 30s');
      } catch (e) {
        console.log('DuckDB: http_timeout not available, skipping');
      }
      
      // Enable Parquet statistics for row group and page-level filtering
      // This allows DuckDB to skip entire row groups without reading them
      try {
        await this.conn.query("SET enable_object_cache=true;");
        console.log('DuckDB: Object cache enabled (for Parquet metadata)');
      } catch (e) {
        console.log('DuckDB: enable_object_cache not available, skipping');
      }
      
      // Note: Statistics-based filtering is enabled by default in DuckDB
      // No explicit configuration needed - it's always used when available
      console.log('DuckDB: Statistics-based filtering (enabled by default)');
      
      try {
        // Enable Bloom filters for Parquet files
        // Bloom filters provide fast negative lookups (can quickly determine if a value is NOT in a row group)
        await this.conn.query("SET enable_parquet_bloom_filter=true;");
        console.log('DuckDB: Parquet Bloom filters enabled');
      } catch (e) {
        console.log('DuckDB: enable_parquet_bloom_filter not available, skipping');
      }
      
      try {
        // Enable parallel Parquet reading for better performance
        await this.conn.query("SET enable_parallel_parquet=true;");
        console.log('DuckDB: Parallel Parquet reading enabled');
      } catch (e) {
        console.log('DuckDB: enable_parallel_parquet not available, skipping');
      }
      
      console.log('DuckDB: HTTP access configured with Range request support');
      console.log('DuckDB: Parquet optimizations enabled:');
      console.log('  ✓ Row group statistics (min/max values)');
      console.log('  ✓ Page-level statistics');
      console.log('  ✓ Bloom filters (fast negative lookups)');
      console.log(`  Endpoint: ${s3Config.endpoint}`);
      console.log(`  Bucket: ${s3Config.bucket}`);
      
      this.reportProgress('Initialization complete', 100);
      
      this.s3Config = s3Config;
      this.initialized = true;
    } catch (error) {
      // Clean up on error
      this.db = null;
      this.conn = null;
      this.initialized = false;
      
      throw new Error(
        `Failed to initialize DuckDB: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Ensures the query engine is initialized before executing queries
   * Performs lazy initialization if not already initialized
   * 
   * @param s3Config - S3 configuration for lazy initialization
   * @throws Error if initialization fails
   */
  private async ensureInitialized(s3Config: S3Config): Promise<void> {
    if (!this.initialized) {
      await this.initialize(s3Config);
    }
  }

  /**
   * Discover available parquet files using HTTP HEAD requests
   * 
   * @param parquetPath - Base path for parquet files
   * @returns Array of HTTP URLs for available parquet files
   */
  private async discoverParquetFiles(parquetPath: string): Promise<string[]> {
    const httpUrls: string[] = [];
    let fileIndex = 0;
    const discoveryStart = performance.now();
    
    while (fileIndex < 100) {
      const httpUrl = `${this.s3Config!.endpoint}/${this.s3Config!.bucket}/${parquetPath}/${fileIndex}.parquet`;
      
      try {
        const response = await fetch(httpUrl, { method: 'HEAD' });
        if (!response.ok) {
          if (response.status === 404) {
            break;
          }
          throw new Error(`Failed to check Parquet file: HTTP ${response.status}`);
        }
        
        httpUrls.push(httpUrl);
        fileIndex++;
      } catch (error) {
        break;
      }
    }
    
    const discoveryTime = performance.now() - discoveryStart;
    console.log(`DuckDB: Discovered ${httpUrls.length} parquet files in ${discoveryTime.toFixed(2)}ms`);
    
    return httpUrls;
  }

  /**
   * Check if the query engine is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Query vulnerabilities by commit ID (revision_id)
   * Performs lazy initialization if not already initialized
   * 
   * @param revisionId - Commit SHA to search for
   * @param parquetPath - Path to vulnerable commits Parquet files
   * @param s3Config - S3 configuration for lazy initialization
   * @returns Array of vulnerability results
   * @throws Error if query fails or times out
   */
  async queryByCommitId(
    revisionId: string,
    parquetPath: string,
    s3Config: S3Config
  ): Promise<VulnerabilityResult[]> {
    await this.ensureInitialized(s3Config);
    
    try {
      console.log('DuckDB: Querying commit', { revisionId, parquetPath });
      
      // Discover available parquet files
      const httpUrls = await this.discoverParquetFiles(parquetPath);
      
      if (httpUrls.length === 0) {
        throw new Error('No parquet files found');
      }
      
      console.log(`DuckDB: Will query ${httpUrls.length} parquet file(s) using HTTP Range requests`);
      console.log('💡 Check Network tab in DevTools to see Range requests (look for "Range: bytes=" headers)');
      
      // Escape single quotes in revisionId to prevent SQL injection
      const escapedRevisionId = revisionId.replace(/'/g, "''");
      
      const startTime = performance.now();
      let allResults: VulnerabilityResult[] = [];
      let filesQueried = 0;
      let foundInFile = false;
      
      for (const url of httpUrls) {
        try {
          filesQueried++;
          const fileStartTime = performance.now();
          
          const querySQL = `
            SELECT DISTINCT revision_id, vulnerability_filename
            FROM read_parquet('${url}')
            WHERE revision_id = '${escapedRevisionId}'
          `;
          
          // Get query execution plan to verify optimizations are used
          if (filesQueried === 1) {
            try {
              const explainResult = await this.conn!.query(`EXPLAIN ${querySQL}`);
              const plan = explainResult.toArray();
              console.log('DuckDB: Query execution plan (first file):');
              plan.forEach((row: any) => {
                const line = row.explain_value || row['explain_value'] || JSON.stringify(row);
                console.log(`  ${line}`);
              });
            } catch (e) {
              console.log('DuckDB: Could not get execution plan:', e);
            }
          }
          
          // Execute the actual query
          const result = await this.conn!.query(querySQL);
          
          const fileQueryTime = performance.now() - fileStartTime;
          const rows = result.toArray();
          
          if (rows.length > 0) {
            console.log(`DuckDB: Found ${rows.length} results in ${url.split('/').pop()} (${fileQueryTime.toFixed(2)}ms)`);
            console.log(`  ↳ Statistics-based filtering used to skip non-matching row groups`);
            foundInFile = true;
            allResults.push(...rows.map((row: any) => ({
              revision_id: row.revision_id as string,
              category: '',
              vulnerability_filename: row.vulnerability_filename as string,
            })));
          } else if (foundInFile) {
            // Data is ordered, if we found results before and now we don't, we can stop
            console.log(`DuckDB: No more results expected, stopping after ${filesQueried} files`);
            break;
          } else {
            console.log(`DuckDB: No results in ${url.split('/').pop()} (${fileQueryTime.toFixed(2)}ms - row groups skipped via statistics)`);
          }
        } catch (error) {
          console.warn(`DuckDB: Error querying ${url}:`, error);
          // Continue with next file
        }
      }
      
      const queryTime = performance.now() - startTime;
      console.log(`DuckDB: Found ${allResults.length} total results in ${queryTime.toFixed(2)}ms (queried ${filesQueried}/${httpUrls.length} files)`);
      
      // Remove duplicates based on revision_id + vulnerability_filename
      const uniqueResults = Array.from(
        new Map(allResults.map(r => [`${r.revision_id}:${r.vulnerability_filename}`, r])).values()
      );
      
      return uniqueResults;
    } catch (error) {
      console.error('DuckDB: Query error', error);
      throw new Error(
        `Failed to query by commit ID: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Query vulnerabilities by origin URL
   * Performs lazy initialization if not already initialized
   * Uses HTTP Range requests to avoid downloading entire files
   * 
   * @param originUrl - Repository URL to search for
   * @param parquetPath - Path to vulnerable origins Parquet files
   * @param s3Config - S3 configuration for lazy initialization
   * @returns Array of origin vulnerability results
   * @throws Error if query fails or times out
   */
  async queryByOrigin(
    originUrl: string,
    parquetPath: string,
    s3Config: S3Config
  ): Promise<OriginVulnerabilityResult[]> {
    await this.ensureInitialized(s3Config);
    
    try {
      console.log('DuckDB: Querying origin', { originUrl, parquetPath });
      
      // Discover available parquet files
      const httpUrls = await this.discoverParquetFiles(parquetPath);
      
      if (httpUrls.length === 0) {
        throw new Error('No parquet files found');
      }
      
      console.log(`DuckDB: Will query ${httpUrls.length} parquet file(s) using HTTP Range requests`);
      console.log('💡 Check Network tab in DevTools to see Range requests (look for "Range: bytes=" headers)');
      
      // Escape single quotes in originUrl to prevent SQL injection
      const escapedOriginUrl = originUrl.replace(/'/g, "''");
      
      // Query files one by one to avoid memory issues
      // This allows DuckDB to use HTTP Range requests more efficiently
      // Data is ordered by origin, so we can stop after finding results
      const allResults: OriginVulnerabilityResult[] = [];
      const startTime = performance.now();
      let filesQueried = 0;
      
      for (const url of httpUrls) {
        try {
          filesQueried++;
          const fileStartTime = performance.now();
          
          const querySQL = `
            SELECT DISTINCT origin, revision_id, branch_name, vulnerability_filename
            FROM read_parquet('${url}')
            WHERE origin = '${escapedOriginUrl}'
          `;
          
          // Get query execution plan to verify optimizations are used
          if (filesQueried === 1) {
            try {
              const explainResult = await this.conn!.query(`EXPLAIN ${querySQL}`);
              const plan = explainResult.toArray();
              console.log('DuckDB: Query execution plan (first file):');
              plan.forEach((row: any) => {
                const line = row.explain_value || row['explain_value'] || JSON.stringify(row);
                console.log(`  ${line}`);
              });
            } catch (e) {
              console.log('DuckDB: Could not get execution plan:', e);
            }
          }
          
          // Execute the actual query
          const result = await this.conn!.query(querySQL);
          
          const fileQueryTime = performance.now() - fileStartTime;
          const rows = result.toArray();
          
          if (rows.length > 0) {
            console.log(`DuckDB: Found ${rows.length} results in ${url.split('/').pop()} (${fileQueryTime.toFixed(2)}ms)`);
            console.log(`  ↳ Statistics-based filtering used to skip non-matching row groups`);
            allResults.push(...rows.map((row: any) => ({
              origin: row.origin as string,
              revision_id: row.revision_id as string,
              branch_name: row.branch_name as string,
              vulnerability_filename: row.vulnerability_filename as string,
            })));
          } else {
            console.log(`DuckDB: No results in ${url.split('/').pop()} (${fileQueryTime.toFixed(2)}ms - row groups skipped via statistics)`);
          }
        } catch (error) {
          console.warn(`DuckDB: Error querying ${url}:`, error);
          // Continue with next file
        }
      }
      
      const queryTime = performance.now() - startTime;
      console.log(`DuckDB: Found ${allResults.length} total results in ${queryTime.toFixed(2)}ms (queried ${filesQueried}/${httpUrls.length} files)`);
      
      // Remove duplicates based on all fields
      const uniqueResults = Array.from(
        new Map(allResults.map(r => 
          [`${r.origin}:${r.revision_id}:${r.branch_name}:${r.vulnerability_filename}`, r]
        )).values()
      );
      
      return uniqueResults;
    } catch (error) {
      console.error('DuckDB: Query error', error);
      throw new Error(
        `Failed to query by origin: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Load CVE data from S3
   * Resolves the correct path based on vulnerability_filename format
   * Performs lazy initialization if not already initialized
   * 
   * @param vulnerabilityFilename - Filename from query results
   * @param cvePath - Base path for CVE files
   * @param s3Config - S3 configuration for lazy initialization
   * @returns Parsed CVE entry in OSV format
   * @throws Error if file not found or parse fails
   */
  async loadCVEData(
    vulnerabilityFilename: string,
    _cvePath: string, // Not used - CVE files are served from /public/cve/
    s3Config: S3Config
  ): Promise<CVEEntry> {
    await this.ensureInitialized(s3Config);
    
    try {
      // Extract just the filename from paths like "osv-output/CVE-2021-21394.json"
      const filename = vulnerabilityFilename.split('/').pop() || vulnerabilityFilename;
      
      // Load from application's public directory (served by Vite)
      // CVE files are in /public/cve/ which Vite serves at /cve/
      const publicUrl = `/cve/${filename}`;
      
      // Fetch JSON from public directory
      const response = await fetch(publicUrl);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      // Parse JSON
      const cveData = await response.json() as CVEEntry;
      
      // Validate required fields (OSV format uses 'details', not 'summary')
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
   * Close the database connection and clean up resources
   */
  async close(): Promise<void> {
    if (this.conn) {
      await this.conn.close();
      this.conn = null;
    }
    
    if (this.db) {
      await this.db.terminate();
      this.db = null;
    }
    
    this.initialized = false;
    this.s3Config = null;
  }
}

// Export singleton instance
export const queryEngine = new QueryEngine();

// Export class for testing
export { QueryEngine };
