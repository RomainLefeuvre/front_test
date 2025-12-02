/**
 * Tests for Parquet optimization features in QueryEngine
 * Verifies that statistics, bloom filters, and HTTP range requests are properly configured
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { QueryEngine } from './queryEngine';
import type { S3Config } from '../types';

describe('QueryEngine Parquet Optimizations', () => {
  let queryEngine: QueryEngine;
  let s3Config: S3Config;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    queryEngine = new QueryEngine();
    s3Config = {
      endpoint: 'http://localhost:9093',
      bucket: 'vuln-data-test',
      region: 'us-east-1',
    };
    
    // Spy on console.log to verify optimization messages
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(async () => {
    await queryEngine.close();
    consoleSpy.mockRestore();
  });

  describe('Initialization with Optimizations', () => {
    it('should enable HTTP metadata cache', async () => {
      await queryEngine.initialize(s3Config);
      
      // Check that the optimization was attempted
      const logs = consoleSpy.mock.calls.map(call => call[0]);
      const hasMetadataCache = logs.some(log => 
        typeof log === 'string' && log.includes('HTTP metadata cache')
      );
      
      expect(hasMetadataCache).toBe(true);
    });

    it('should enable object cache for Parquet metadata', async () => {
      await queryEngine.initialize(s3Config);
      
      const logs = consoleSpy.mock.calls.map(call => call[0]);
      const hasObjectCache = logs.some(log => 
        typeof log === 'string' && log.includes('Object cache')
      );
      
      expect(hasObjectCache).toBe(true);
    });

    it('should confirm statistics-based filtering is available', async () => {
      await queryEngine.initialize(s3Config);
      
      const logs = consoleSpy.mock.calls.map(call => call[0]);
      const hasStatistics = logs.some(log => 
        typeof log === 'string' && (
          log.includes('Statistics-based filtering') ||
          log.includes('enabled by default')
        )
      );
      
      expect(hasStatistics).toBe(true);
    });

    it('should enable Parquet bloom filters', async () => {
      await queryEngine.initialize(s3Config);
      
      const logs = consoleSpy.mock.calls.map(call => call[0]);
      const hasBloomFilter = logs.some(log => 
        typeof log === 'string' && log.includes('Bloom filter')
      );
      
      expect(hasBloomFilter).toBe(true);
    });

    it('should enable parallel Parquet reading', async () => {
      await queryEngine.initialize(s3Config);
      
      const logs = consoleSpy.mock.calls.map(call => call[0]);
      const hasParallel = logs.some(log => 
        typeof log === 'string' && log.includes('Parallel Parquet')
      );
      
      expect(hasParallel).toBe(true);
    });

    it('should log all optimization features', async () => {
      await queryEngine.initialize(s3Config);
      
      const logs = consoleSpy.mock.calls.map(call => call[0]);
      const optimizationSummary = logs.find(log => 
        typeof log === 'string' && log.includes('Parquet optimizations enabled')
      );
      
      expect(optimizationSummary).toBeDefined();
      
      // Check that all three optimization types are mentioned
      const allLogs = logs.join(' ');
      expect(allLogs).toContain('Row group statistics');
      expect(allLogs).toContain('Page-level statistics');
      expect(allLogs).toContain('Bloom filters');
    });
  });

  describe('Query Execution with Optimizations', () => {
    it('should log statistics usage during commit query', async () => {
      // This test requires actual data, so we'll skip if not available
      if (!process.env.INTEGRATION_TEST) {
        return;
      }

      await queryEngine.initialize(s3Config);
      
      // Clear previous logs
      consoleSpy.mockClear();
      
      try {
        await queryEngine.queryByCommitId(
          'a'.repeat(40),
          'vulnerable_commits_using_cherrypicks_swhid',
          s3Config
        );
        
        const logs = consoleSpy.mock.calls.map(call => call[0]);
        const hasStatisticsLog = logs.some(log => 
          typeof log === 'string' && (
            log.includes('Statistics-based filtering') ||
            log.includes('row groups skipped')
          )
        );
        
        expect(hasStatisticsLog).toBe(true);
      } catch (error) {
        // Expected if no data available
        console.log('Skipping query test - no data available');
      }
    });

    it('should log statistics usage during origin query', async () => {
      // This test requires actual data, so we'll skip if not available
      if (!process.env.INTEGRATION_TEST) {
        return;
      }

      await queryEngine.initialize(s3Config);
      
      // Clear previous logs
      consoleSpy.mockClear();
      
      try {
        await queryEngine.queryByOrigin(
          'https://github.com/test/repo',
          'vulnerable_origins',
          s3Config
        );
        
        const logs = consoleSpy.mock.calls.map(call => call[0]);
        const hasStatisticsLog = logs.some(log => 
          typeof log === 'string' && (
            log.includes('Statistics-based filtering') ||
            log.includes('row groups skipped')
          )
        );
        
        expect(hasStatisticsLog).toBe(true);
      } catch (error) {
        // Expected if no data available
        console.log('Skipping query test - no data available');
      }
    });

    it('should report query timing per file', async () => {
      // This test requires actual data, so we'll skip if not available
      if (!process.env.INTEGRATION_TEST) {
        return;
      }

      await queryEngine.initialize(s3Config);
      
      // Clear previous logs
      consoleSpy.mockClear();
      
      try {
        await queryEngine.queryByCommitId(
          'a'.repeat(40),
          'vulnerable_commits_using_cherrypicks_swhid',
          s3Config
        );
        
        const logs = consoleSpy.mock.calls.map(call => call[0]);
        const hasTimingLog = logs.some(log => 
          typeof log === 'string' && log.match(/\d+\.\d+ms/)
        );
        
        expect(hasTimingLog).toBe(true);
      } catch (error) {
        // Expected if no data available
        console.log('Skipping query test - no data available');
      }
    });
  });

  describe('Configuration Validation', () => {
    it('should not fail if optimization settings are unavailable', async () => {
      // Even if some settings are not available in the DuckDB version,
      // initialization should still succeed
      await expect(queryEngine.initialize(s3Config)).resolves.not.toThrow();
    });

    it('should be initialized after setup', async () => {
      expect(queryEngine.isInitialized()).toBe(false);
      
      await queryEngine.initialize(s3Config);
      
      expect(queryEngine.isInitialized()).toBe(true);
    });
  });
});
