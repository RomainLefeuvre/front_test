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
    expect(config.apiBaseUrl).toBeDefined();
    expect(config.environment).toMatch(/^(development|production)$/);
    // Legacy fields should exist but be empty
    expect(config.s3).toBeDefined();
    expect(config.parquetPaths).toBeDefined();
    expect(config.cvePath).toBe('cve');
  });

  it('should read API base URL from environment variable', () => {
    // Set a custom API URL
    import.meta.env.VITE_API_BASE_URL = 'https://custom-api.example.com';
    
    const config = loadConfig();
    
    expect(config.apiBaseUrl).toBe('https://custom-api.example.com');
  });

  it('should use default API URL when environment variable is not set', () => {
    // Remove the API URL
    delete import.meta.env.VITE_API_BASE_URL;
    
    const config = loadConfig();
    
    // Should use default based on environment
    const expectedDefault = config.environment === 'production' 
      ? 'https://api.example.com' 
      : 'http://localhost:8080';
    
    expect(config.apiBaseUrl).toBe(expectedDefault);
  });

  it('should detect development environment correctly', () => {
    // In test mode, MODE is typically 'test', but we can check the logic
    const config = loadConfig();
    
    // Should be 'development' when MODE is not 'production'
    expect(['development', 'production']).toContain(config.environment);
  });

  it('should use production API URL in production mode', () => {
    // Set production mode
    import.meta.env.MODE = 'production';
    // Remove custom API URL to test default
    delete import.meta.env.VITE_API_BASE_URL;
    
    const config = loadConfig();
    
    expect(config.environment).toBe('production');
    expect(config.apiBaseUrl).toBe('https://api.example.com');
  });

  // Feature: vuln-fork-lookup, Property 9: Configuration-based endpoint selection
  // Validates: Requirements 7.2, 7.4
  it('should use the API endpoint specified in environment configuration for all data requests', () => {
    fc.assert(
      fc.property(
        // Generate arbitrary API endpoints (valid URLs)
        fc.webUrl({ validSchemes: ['http', 'https'] }),
        // Generate environment mode
        fc.constantFrom('development', 'production', 'test'),
        (apiUrl, mode) => {
          // Save original environment values
          const savedApiUrl = import.meta.env.VITE_API_BASE_URL;
          const savedMode = import.meta.env.MODE;

          try {
            // Set environment variables to generated values
            import.meta.env.VITE_API_BASE_URL = apiUrl;
            import.meta.env.MODE = mode;

            // Load configuration
            const config = loadConfig();

            // Property: The configuration should use the exact API URL specified in the environment
            expect(config.apiBaseUrl).toBe(apiUrl);
            
            // Verify environment is correctly detected
            const expectedEnv = mode === 'production' ? 'production' : 'development';
            expect(config.environment).toBe(expectedEnv);
          } finally {
            // Restore original environment values
            if (savedApiUrl === undefined) {
              delete import.meta.env.VITE_API_BASE_URL;
            } else {
              import.meta.env.VITE_API_BASE_URL = savedApiUrl;
            }
            import.meta.env.MODE = savedMode;
          }
        }
      ),
      { numRuns: 100 } // Run 100 iterations as specified in design document
    );
  });
});
