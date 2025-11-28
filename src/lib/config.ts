/**
 * Configuration management module
 * Handles environment-based configuration for S3 access and data paths
 * Requirements: 7.1, 7.4
 */

import type { AppConfig } from '../types';

/**
 * Loads application configuration based on the current environment
 * Reads from Vite environment variables:
 * - VITE_S3_ENDPOINT: S3 endpoint URL
 * - VITE_S3_BUCKET: S3 bucket name
 * - VITE_S3_REGION: S3 region (optional)
 * 
 * @returns AppConfig object with S3 settings and data paths
 * @throws Error if required environment variables are missing
 */
export function loadConfig(): AppConfig {
  // Detect environment mode from Vite
  const environment = import.meta.env.MODE === 'production' ? 'production' : 'development';
  
  // Read S3 configuration from environment variables
  const s3Endpoint = import.meta.env.VITE_S3_ENDPOINT;
  const s3Bucket = import.meta.env.VITE_S3_BUCKET;
  const s3Region = import.meta.env.VITE_S3_REGION;
  
  // Validate required configuration
  if (!s3Endpoint) {
    throw new Error('VITE_S3_ENDPOINT environment variable is required');
  }
  
  if (!s3Bucket) {
    throw new Error('VITE_S3_BUCKET environment variable is required');
  }
  
  // Build configuration object
  const config: AppConfig = {
    s3: {
      endpoint: s3Endpoint,
      bucket: s3Bucket,
      region: s3Region, // Optional, can be undefined
    },
    parquetPaths: {
      vulnerableCommits: 'vulnerable_commits_using_cherrypicks_swhid',
      vulnerableOrigins: 'vulnerable_origins',
    },
    cvePath: 'cve',
    environment,
  };
  
  return config;
}
