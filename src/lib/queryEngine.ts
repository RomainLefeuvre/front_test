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
  private registeredFiles: Set<string> = new Set(); // Track registered files

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
      
      // DuckDB WASM: S3/HTTP access is built-in, no extensions needed
      // Just store the S3 config for use in queries
      // We'll use direct HTTP URLs to access Parquet files instead of s3:// protocol
      
      console.log('DuckDB: S3 configuration stored for HTTP access');
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
      // Use HTTP URL instead of s3:// protocol for DuckDB WASM
      const httpUrl = `${this.s3Config!.endpoint}/${this.s3Config!.bucket}/${parquetPath}/0.parquet`;
      
      console.log('DuckDB: Querying commit', { revisionId, httpUrl });
      
      // Fetch the Parquet file and register it with DuckDB WASM
      const fileName = `${parquetPath.replace(/\//g, '_')}.parquet`;
      
      // Only fetch and register if not already registered
      if (!this.registeredFiles.has(fileName)) {
        console.log(`DuckDB: Fetching and registering ${fileName}`);
        
        // Fetch the file
        const response = await fetch(httpUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch Parquet file: HTTP ${response.status}`);
        }
        const fileData = await response.arrayBuffer();
        
        // Register the file in DuckDB's virtual filesystem
        await this.db!.registerFileBuffer(fileName, new Uint8Array(fileData));
        this.registeredFiles.add(fileName);
        
        console.log(`DuckDB: Registered ${fileName} (${fileData.byteLength} bytes)`);
      } else {
        console.log(`DuckDB: Using cached ${fileName}`);
      }
      
      // Escape single quotes in revisionId to prevent SQL injection
      const escapedRevisionId = revisionId.replace(/'/g, "''");
      
      const result = await this.conn!.query(`
        SELECT revision_id, vulnerability_filename
        FROM read_parquet('${fileName}')
        WHERE revision_id = '${escapedRevisionId}'
      `);
      
      // Convert result to array of objects
      const rows = result.toArray();
      console.log(`DuckDB: Found ${rows.length} results`);
      
      return rows.map(row => ({
        revision_id: row.revision_id as string,
        category: '', // Category not available in Parquet files
        vulnerability_filename: row.vulnerability_filename as string,
      }));
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
      // Use HTTP URL instead of s3:// protocol for DuckDB WASM
      const httpUrl = `${this.s3Config!.endpoint}/${this.s3Config!.bucket}/${parquetPath}/0.parquet`;
      
      console.log('DuckDB: Querying origin', { originUrl, httpUrl });
      
      // Fetch the Parquet file and register it with DuckDB WASM
      const fileName = `${parquetPath.replace(/\//g, '_')}.parquet`;
      
      // Only fetch and register if not already registered
      if (!this.registeredFiles.has(fileName)) {
        console.log(`DuckDB: Fetching and registering ${fileName}`);
        
        // Fetch the file
        const response = await fetch(httpUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch Parquet file: HTTP ${response.status}`);
        }
        const fileData = await response.arrayBuffer();
        
        // Register the file in DuckDB's virtual filesystem
        await this.db!.registerFileBuffer(fileName, new Uint8Array(fileData));
        this.registeredFiles.add(fileName);
        
        console.log(`DuckDB: Registered ${fileName} (${fileData.byteLength} bytes)`);
      } else {
        console.log(`DuckDB: Using cached ${fileName}`);
      }
      
      // Escape single quotes in originUrl to prevent SQL injection
      const escapedOriginUrl = originUrl.replace(/'/g, "''");
      
      const result = await this.conn!.query(`
        SELECT origin, revision_id, branch_name, vulnerability_filename
        FROM read_parquet('${fileName}')
        WHERE origin = '${escapedOriginUrl}'
      `);
      
      // Convert result to array of objects
      const rows = result.toArray();
      console.log(`DuckDB: Found ${rows.length} results`);
      
      return rows.map(row => ({
        origin: row.origin as string,
        revision_id: row.revision_id as string,
        branch_name: row.branch_name as string,
        vulnerability_filename: row.vulnerability_filename as string,
      }));
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
    cvePath: string,
    s3Config: S3Config
  ): Promise<CVEEntry> {
    await this.ensureInitialized(s3Config);
    
    try {
      // Construct full S3 URL
      const s3Url = `${this.s3Config!.endpoint}/${this.s3Config!.bucket}/${cvePath}/${vulnerabilityFilename}`;
      
      // Fetch JSON from S3
      const response = await fetch(s3Url);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      // Parse JSON
      const cveData = await response.json() as CVEEntry;
      
      // Validate required fields
      if (!cveData.id || !cveData.summary || !cveData.details) {
        throw new Error('Invalid CVE format: missing required fields (id, summary, or details)');
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
