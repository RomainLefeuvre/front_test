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
      this.reportProgress('Loading DuckDB bundle', 10);
      
      // Select and load DuckDB bundle from jsDelivr CDN
      const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
      const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);
      
      if (!bundle.mainWorker || !bundle.mainModule) {
        throw new Error('Failed to load DuckDB bundle: missing worker or module');
      }

      this.reportProgress('Creating worker', 30);
      
      // Create worker and logger
      const worker = new Worker(bundle.mainWorker);
      const logger = new duckdb.ConsoleLogger();
      
      this.reportProgress('Initializing database', 50);
      
      // Initialize database
      this.db = new duckdb.AsyncDuckDB(logger, worker);
      await this.db.instantiate(bundle.mainModule);
      
      this.reportProgress('Creating connection', 70);
      
      // Create connection
      this.conn = await this.db.connect();
      
      this.reportProgress('Configuring S3 access', 85);
      
      // Configure S3 access
      await this.conn.query(`INSTALL httpfs;`);
      await this.conn.query(`LOAD httpfs;`);
      await this.conn.query(`SET s3_endpoint='${s3Config.endpoint}';`);
      await this.conn.query(`SET s3_url_style='path';`);
      
      // Set region if provided
      if (s3Config.region) {
        await this.conn.query(`SET s3_region='${s3Config.region}';`);
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
      const s3Path = `s3://${this.s3Config!.bucket}/${parquetPath}/*.parquet`;
      
      // Escape single quotes in revisionId to prevent SQL injection
      const escapedRevisionId = revisionId.replace(/'/g, "''");
      
      const result = await this.conn!.query(`
        SELECT revision_id, category, vulnerability_filename
        FROM read_parquet('${s3Path}')
        WHERE revision_id = '${escapedRevisionId}'
      `);
      
      // Convert result to array of objects
      const rows = result.toArray();
      return rows.map(row => ({
        revision_id: row.revision_id as string,
        category: row.category as string,
        vulnerability_filename: row.vulnerability_filename as string,
      }));
    } catch (error) {
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
      const s3Path = `s3://${this.s3Config!.bucket}/${parquetPath}/*.parquet`;
      
      // Escape single quotes in originUrl to prevent SQL injection
      const escapedOriginUrl = originUrl.replace(/'/g, "''");
      
      const result = await this.conn!.query(`
        SELECT origin, revision_id, branch_name, vulnerability_filename
        FROM read_parquet('${s3Path}')
        WHERE origin = '${escapedOriginUrl}'
      `);
      
      // Convert result to array of objects
      const rows = result.toArray();
      return rows.map(row => ({
        origin: row.origin as string,
        revision_id: row.revision_id as string,
        branch_name: row.branch_name as string,
        vulnerability_filename: row.vulnerability_filename as string,
      }));
    } catch (error) {
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
