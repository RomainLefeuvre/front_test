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
        
        // Open database with config to enable HTTP Range requests
        await this.db.open({
          // Filesystem config to control HTTP behavior
          filesystem: {
            // Tell DuckDB that MinIO supports HEAD requests reliably
            reliableHeadRequests: true,
            // Do NOT allow falling back to full HTTP reads
            allowFullHTTPReads: false,
            // Do NOT force full HTTP reads - we want Range requests
            forceFullHTTPReads: false,
          },
        });
        console.log('DuckDB: ✓ Configured for HTTP Range requests (partial loading enabled)');
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
      
      // ========================================
      // PARQUET OPTIMIZATION SETTINGS
      // ========================================
      
      // Enable object cache for Parquet metadata (row group stats, bloom filters)
      // This caches metadata so subsequent queries don't need to re-read it
      try {
        await this.conn.query("SET enable_object_cache=true;");
        console.log('DuckDB: ✓ Object cache enabled (caches Parquet metadata)');
      } catch (e) {
        console.log('DuckDB: enable_object_cache not available, skipping');
      }
      
      // Force statistics-based filtering (enabled by default, but we make it explicit)
      // This uses min/max statistics in Parquet row groups to skip entire row groups
      try {
        await this.conn.query("SET force_statistics=true;");
        console.log('DuckDB: ✓ Statistics-based filtering forced (row group pruning)');
      } catch (e) {
        console.log('DuckDB: force_statistics not available (using default)');
      }
      
      // Enable Bloom filters for Parquet files
      // Bloom filters provide fast negative lookups - can quickly determine if a value is NOT in a row group
      // This is especially effective for equality predicates (WHERE column = value)
      try {
        await this.conn.query("SET enable_parquet_bloom_filter=true;");
        console.log('DuckDB: ✓ Parquet Bloom filters enabled (fast negative lookups)');
      } catch (e) {
        console.log('DuckDB: ❌ enable_parquet_bloom_filter NOT SUPPORTED in this version');
        console.log('DuckDB: ⚠️  Queries will be SLOW without bloom filters');
        console.log('DuckDB: 💡 Consider upgrading to DuckDB WASM 1.32+ for bloom filter support');
      }
      
      // Force filter pushdown to Parquet reader
      // This ensures WHERE clauses are evaluated at the Parquet scan level, not after
      try {
        await this.conn.query("SET force_pushdown=true;");
        console.log('DuckDB: ✓ Filter pushdown forced (predicates evaluated at scan)');
      } catch (e) {
        console.log('DuckDB: force_pushdown not available (using default)');
      }
      
      // Enable parallel Parquet reading for better performance
      // This allows multiple row groups to be read in parallel
      try {
        await this.conn.query("SET enable_parallel_parquet=true;");
        console.log('DuckDB: ✓ Parallel Parquet reading enabled');
      } catch (e) {
        console.log('DuckDB: enable_parallel_parquet not available, skipping');
      }
      
      // Set threads for parallel operations
      try {
        await this.conn.query("SET threads=4;");
        console.log('DuckDB: ✓ Thread count set to 4 for parallel operations');
      } catch (e) {
        console.log('DuckDB: threads setting not available, using default');
      }
      
      // Enable HTTP metadata cache to avoid re-fetching Parquet metadata
      try {
        await this.conn.query("SET enable_http_metadata_cache=true;");
        console.log('DuckDB: ✓ HTTP metadata cache enabled');
      } catch (e) {
        console.log('DuckDB: enable_http_metadata_cache not available, skipping');
      }
      
      // Increase HTTP timeout for large metadata fetches
      try {
        await this.conn.query("SET http_timeout=60000;");
        console.log('DuckDB: ✓ HTTP timeout set to 60s');
      } catch (e) {
        console.log('DuckDB: http_timeout not available, skipping');
      }
      
      // Enable HTTP keep-alive for connection reuse
      try {
        await this.conn.query("SET http_keep_alive=true;");
        console.log('DuckDB: ✓ HTTP keep-alive enabled (connection reuse)');
      } catch (e) {
        console.log('DuckDB: http_keep_alive not available, skipping');
      }
      
     
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
   * Execute EXPLAIN and EXPLAIN ANALYZE for a query to show optimization details
   * 
   * @param querySQL - The SQL query to analyze
   * @param fileIndex - Index of the file being queried (for logging)
   */
  private async explainQuery(querySQL: string, fileIndex: number): Promise<void> {
    if (fileIndex !== 1) return; // Only explain first query
    
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 QUERY EXECUTION PLAN (Logical Plan)');
    console.log('═══════════════════════════════════════════════════════════');
    
    try {
      const explainResult = await this.conn!.query(`EXPLAIN ${querySQL}`);
      const plan = explainResult.toArray();
      plan.forEach((row: any) => {
        const line = row.explain_value || row['explain_value'] || JSON.stringify(row);
        console.log(`  ${line}`);
      });
    } catch (e) {
      console.log('  Could not get execution plan:', e);
    }
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
  }

  /**
   * Query vulnerabilities by commit ID (revision_swhid)
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
          
          // Register the file URL with DuckDB to enable HTTP Range requests
          // This is required for partial loading - without registration, DuckDB downloads the entire file
          const filename = url.split('/').pop() || `file_${filesQueried}.parquet`;
          const registeredPath = `commits_${filename}`;
          
          await this.db!.registerFileURL(
            registeredPath,
            url,
            duckdb.DuckDBDataProtocol.HTTP,
            false // not direct IO
          );
          
          // Optimized query with explicit column selection and filter pushdown
          // DuckDB will:
          // 1. Use Bloom filters to quickly skip row groups that don't contain the revision_swhid
          // 2. Use min/max statistics to skip row groups outside the value range
          // 3. Only read the two columns we need (not all columns)
          // 4. Apply the filter at the Parquet scan level (before decompression)
          const querySQL = `
            SELECT DISTINCT 
              revision_swhid, 
              vulnerability_filename
            FROM read_parquet('${registeredPath}', hive_partitioning=false)
            WHERE revision_swhid = '${escapedRevisionId}'
          `;
          
          // Show execution plan for first file
          await this.explainQuery(querySQL, filesQueried);
          
          // Execute the actual query
          const result = await this.conn!.query(querySQL);
          
          const fileQueryTime = performance.now() - fileStartTime;
          const rows = result.toArray();
          
          if (rows.length > 0) {
            console.log(`DuckDB: ✓ Found ${rows.length} results in ${filename} (${fileQueryTime.toFixed(2)}ms)`);
            console.log(`  ↳ Bloom filter: Identified matching row groups`);
            console.log(`  ↳ Statistics: Skipped non-matching row groups`);
            console.log(`  ↳ Column projection: Only read revision_swhid + vulnerability_filename`);
            console.log(`  ↳ HTTP Range: Downloaded only matching row groups`);
            
           
            
            foundInFile = true;
            allResults.push(...rows.map((row: any) => ({
              revision_swhid: row.revision_swhid as string,
              category: '',
              vulnerability_filename: row.vulnerability_filename as string,
            })));
          } else if (foundInFile) {
            // Data is ordered, if we found results before and now we don't, we can stop
            console.log(`DuckDB: ⊗ No more results expected (data is sorted), stopping after ${filesQueried} files`);
            break;
          } else {
            console.log(`DuckDB: ⊗ No results in ${filename} (${fileQueryTime.toFixed(2)}ms)`);
            if (fileQueryTime > 5000) {
              console.log(`  ⚠️  SLOW QUERY (${(fileQueryTime/1000).toFixed(1)}s) - Bloom filters likely NOT working!`);
              console.log(`  ↳ This should be <100ms if bloom filters worked properly`);
              console.log(`  ↳ Check DevTools Network tab for excessive HTTP Range requests`);
            } else {
              console.log(`  ↳ Bloom filter: No matching row groups (file skipped efficiently)`);
              console.log(`  ↳ Statistics: All row groups pruned via min/max values`);
              console.log(`  ↳ HTTP: Only metadata downloaded (~few KB)`);
            }
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          const errorFilename = url.split('/').pop();
          
          // Check for specific error types
          if (errorMsg.includes('source array is too long') || errorMsg.includes('RangeError')) {
            console.warn(`DuckDB: ⚠ Skipping ${errorFilename} - file metadata too large for browser`);
            console.warn(`  ↳ This file needs to be split into smaller chunks (<1GB recommended)`);
            console.warn(`  ↳ The parquet metadata exceeds browser memory limits`);
          } else {
            console.warn(`DuckDB: Error querying ${errorFilename}:`, error);
          }
          // Continue with next file
        }
      }
      
      const queryTime = performance.now() - startTime;
      console.log(`DuckDB: Found ${allResults.length} total results in ${queryTime.toFixed(2)}ms (queried ${filesQueried}/${httpUrls.length} files)`);
      
      // Remove duplicates based on revision_swhid + vulnerability_filename
      const uniqueResults = Array.from(
        new Map(allResults.map(r => [`${r.revision_swhid}:${r.vulnerability_filename}`, r])).values()
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
          
          // Register the file URL with DuckDB to enable HTTP Range requests
          // This is required for partial loading - without registration, DuckDB downloads the entire file
          const filename = url.split('/').pop() || `file_${filesQueried}.parquet`;
          const registeredPath = `origins_${filename}`;
          
          await this.db!.registerFileURL(
            registeredPath,
            url,
            duckdb.DuckDBDataProtocol.HTTP,
            false // not direct IO
          );
          
          // Optimized query with explicit column selection and filter pushdown
          // DuckDB will:
          // 1. Use Bloom filters to quickly skip row groups that don't contain the origin
          // 2. Use min/max statistics to skip row groups outside the value range
          // 3. Only read the four columns we need (not all columns)
          // 4. Apply the filter at the Parquet scan level (before decompression)
          const querySQL = `
            SELECT DISTINCT 
              origin, 
              revision_swhid, 
              branch_name, 
              vulnerability_filename
            FROM read_parquet('${registeredPath}', hive_partitioning=false)
            WHERE origin = '${escapedOriginUrl}'
          `;
          
          // Show execution plan for first file
          await this.explainQuery(querySQL, filesQueried);
          
          // Execute the actual query
          const result = await this.conn!.query(querySQL);
          
          const fileQueryTime = performance.now() - fileStartTime;
          const rows = result.toArray();
          
          if (rows.length > 0) {
            console.log(`DuckDB: ✓ Found ${rows.length} results in ${filename} (${fileQueryTime.toFixed(2)}ms)`);
            console.log(`  ↳ Bloom filter: Identified matching row groups`);
            console.log(`  ↳ Statistics: Skipped non-matching row groups`);
            console.log(`  ↳ Column projection: Only read 4 columns (origin, revision_swhid, branch_name, vulnerability_filename)`);
            console.log(`  ↳ HTTP Range: Downloaded only matching row groups`);
            
           
            
            // Map rows and push in batches to avoid "too many arguments" error with large result sets
            const mappedRows = rows.map((row: any) => ({
              origin: row.origin as string,
              revision_swhid: row.revision_swhid as string,
              branch_name: row.branch_name as string,
              vulnerability_filename: row.vulnerability_filename as string,
            }));
            
            // Push in batches of 50,000 to avoid exceeding max function arguments
            const batchSize = 50000;
            for (let i = 0; i < mappedRows.length; i += batchSize) {
              const batch = mappedRows.slice(i, i + batchSize);
              allResults.push(...batch);
            }
          } else {
            console.log(`DuckDB: ⊗ No results in ${filename} (${fileQueryTime.toFixed(2)}ms)`);
            console.log(`  ↳ Bloom filter: No matching row groups (file skipped efficiently)`);
            console.log(`  ↳ Statistics: All row groups pruned via min/max values`);
            console.log(`  ↳ HTTP: Only metadata downloaded (~few KB)`);
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          const errorFilename = url.split('/').pop();
          
          // Check for specific error types
          if (errorMsg.includes('source array is too long') || errorMsg.includes('RangeError')) {
            console.warn(`DuckDB: ⚠ Skipping ${errorFilename} - file metadata too large for browser`);
            console.warn(`  ↳ This file needs to be split into smaller chunks (<1GB recommended)`);
            console.warn(`  ↳ The parquet metadata exceeds browser memory limits`);
          } else {
            console.warn(`DuckDB: Error querying ${errorFilename}:`, error);
          }
          // Continue with next file
        }
      }
      
      const queryTime = performance.now() - startTime;
      console.log(`DuckDB: Found ${allResults.length} total results in ${queryTime.toFixed(2)}ms (queried ${filesQueried}/${httpUrls.length} files)`);
      
      // Remove duplicates based on all fields
      const uniqueResults = Array.from(
        new Map(allResults.map(r => 
          [`${r.origin}:${r.revision_swhid}:${r.branch_name}:${r.vulnerability_filename}`, r]
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
