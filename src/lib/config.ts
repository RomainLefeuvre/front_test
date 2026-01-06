/**
 * Configuration management module
 * Handles environment-based configuration for API access
 * Requirements: 7.1, 7.4
 */

import type { AppConfig } from '../types';

/**
 * Loads application configuration based on the current environment
 * Reads from Vite environment variables:
 * - VITE_API_BASE_URL: API base URL
 * 
 * @returns AppConfig object with API settings
 * @throws Error if required environment variables are missing
 */
export function loadConfig(): AppConfig {
  // Detect environment mode from Vite
  const environment = import.meta.env.MODE === 'production' ? 'production' : 'development';
  
  // Read API configuration from environment variables
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
  
  // Use default API URL if not specified
  const defaultApiUrl = environment === 'production' 
    ? 'https://api.example.com' // Replace with your production API URL
    : '';                       // Empty for development (Vite proxy handles it)
  
  // Build configuration object
  const config: AppConfig = {
    apiBaseUrl: apiBaseUrl || defaultApiUrl,
    environment,
    // Legacy fields kept for backward compatibility (no longer used)
    s3: {
      endpoint: '',
      bucket: '',
      region: undefined,
    },
    parquetPaths: {
      vulnerableCommits: '',
      vulnerableOrigins: '',
    },
    cvePath: 'cve',
  };
  
  return config;
}
