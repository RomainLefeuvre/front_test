/**
 * Unit tests for configuration module
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { loadConfig } from './config';

describe('Configuration Module', () => {
  // Store original env values
  const originalEnv = { ...import.meta.env };

  beforeEach(() => {
    // Reset environment to original state before each test
    Object.keys(import.meta.env).forEach(key => {
      if (key.startsWith('VITE_')) {
        delete import.meta.env[key];
      }
    });
    Object.assign(import.meta.env, originalEnv);
  });

  it('should load configuration with all required fields', () => {
    const config = loadConfig();
    
    expect(config).toBeDefined();
    expect(config.s3).toBeDefined();
    expect(config.s3.endpoint).toBeDefined();
    expect(config.s3.bucket).toBeDefined();
    expect(config.parquetPaths).toBeDefined();
    expect(config.parquetPaths.vulnerableCommits).toBe('vulnerable_commits_using_cherrypicks_swhid');
    expect(config.parquetPaths.vulnerableOrigins).toBe('vulnerable_origins');
    expect(config.cvePath).toBe('cve');
    expect(config.environment).toMatch(/^(development|production)$/);
  });

  it('should read S3 endpoint from environment variable', () => {
    const config = loadConfig();
    
    expect(config.s3.endpoint).toBe(import.meta.env.VITE_S3_ENDPOINT);
  });

  it('should read S3 bucket from environment variable', () => {
    const config = loadConfig();
    
    expect(config.s3.bucket).toBe(import.meta.env.VITE_S3_BUCKET);
  });

  it('should read S3 region from environment variable when provided', () => {
    const config = loadConfig();
    
    if (import.meta.env.VITE_S3_REGION) {
      expect(config.s3.region).toBe(import.meta.env.VITE_S3_REGION);
    }
  });

  it('should detect development environment correctly', () => {
    // In test mode, MODE is typically 'test', but we can check the logic
    const config = loadConfig();
    
    // Should be 'development' when MODE is not 'production'
    expect(['development', 'production']).toContain(config.environment);
  });

  it('should throw error when VITE_S3_ENDPOINT is missing', () => {
    // Save current value
    const savedEndpoint = import.meta.env.VITE_S3_ENDPOINT;
    
    // Remove the endpoint
    delete import.meta.env.VITE_S3_ENDPOINT;
    
    expect(() => loadConfig()).toThrow('VITE_S3_ENDPOINT environment variable is required');
    
    // Restore
    import.meta.env.VITE_S3_ENDPOINT = savedEndpoint;
  });

  it('should throw error when VITE_S3_BUCKET is missing', () => {
    // Save current value
    const savedBucket = import.meta.env.VITE_S3_BUCKET;
    
    // Remove the bucket
    delete import.meta.env.VITE_S3_BUCKET;
    
    expect(() => loadConfig()).toThrow('VITE_S3_BUCKET environment variable is required');
    
    // Restore
    import.meta.env.VITE_S3_BUCKET = savedBucket;
  });

  // Feature: vuln-fork-lookup, Property 9: Configuration-based endpoint selection
  // Validates: Requirements 7.2, 7.4
  it('should use the S3 endpoint specified in environment configuration for all data requests', () => {
    fc.assert(
      fc.property(
        // Generate arbitrary S3 endpoints (valid URLs)
        fc.webUrl({ validSchemes: ['http', 'https'] }),
        // Generate arbitrary bucket names (alphanumeric with hyphens)
        fc.stringMatching(/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/),
        // Generate optional region strings
        fc.option(fc.stringMatching(/^[a-z]{2}-[a-z]+-\d$/)),
        // Generate environment mode
        fc.constantFrom('development', 'production', 'test'),
        (endpoint, bucket, region, mode) => {
          // Save original environment values
          const savedEndpoint = import.meta.env.VITE_S3_ENDPOINT;
          const savedBucket = import.meta.env.VITE_S3_BUCKET;
          const savedRegion = import.meta.env.VITE_S3_REGION;
          const savedMode = import.meta.env.MODE;

          try {
            // Set environment variables to generated values
            import.meta.env.VITE_S3_ENDPOINT = endpoint;
            import.meta.env.VITE_S3_BUCKET = bucket;
            
            // Handle optional region - delete if null, set if present
            if (region === null) {
              delete import.meta.env.VITE_S3_REGION;
            } else {
              import.meta.env.VITE_S3_REGION = region;
            }
            
            import.meta.env.MODE = mode;

            // Load configuration
            const config = loadConfig();

            // Property: The configuration should use the exact endpoint specified in the environment
            expect(config.s3.endpoint).toBe(endpoint);
            expect(config.s3.bucket).toBe(bucket);
            
            // Region should match: undefined if not set, otherwise the value
            if (region === null) {
              expect(config.s3.region).toBeUndefined();
            } else {
              expect(config.s3.region).toBe(region);
            }
            
            // Verify environment is correctly detected
            const expectedEnv = mode === 'production' ? 'production' : 'development';
            expect(config.environment).toBe(expectedEnv);
          } finally {
            // Restore original environment values
            import.meta.env.VITE_S3_ENDPOINT = savedEndpoint;
            import.meta.env.VITE_S3_BUCKET = savedBucket;
            if (savedRegion === undefined) {
              delete import.meta.env.VITE_S3_REGION;
            } else {
              import.meta.env.VITE_S3_REGION = savedRegion;
            }
            import.meta.env.MODE = savedMode;
          }
        }
      ),
      { numRuns: 100 } // Run 100 iterations as specified in design document
    );
  });
});
