/**
 * API Client Tests
 * Tests for the new REST API client
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ApiClient } from './apiClient';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('ApiClient', () => {
  let apiClient: ApiClient;

  beforeEach(() => {
    apiClient = new ApiClient({
      baseUrl: 'http://localhost:8080',
    });
    mockFetch.mockClear();
  });

  describe('healthCheck', () => {
    it('should return true when API is healthy', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      const result = await apiClient.healthCheck();
      
      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/health',
        expect.objectContaining({
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
        })
      );
    });

    it('should return false when API is unhealthy', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await apiClient.healthCheck();
      
      expect(result).toBe(false);
    });

    it('should return false when fetch throws error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await apiClient.healthCheck();
      
      expect(result).toBe(false);
    });
  });

  describe('queryByOrigin', () => {
    it('should query vulnerabilities by origin URL using JSON endpoint', async () => {
      const mockResponse = {
        entries: [
          {
            origin: 'https://github.com/test/repo',
            revision_id: 'swh:1:rev:abc123',
            branch_name: 'main',
            vulnerability_filenames: ['CVE-2024-1234.json'],
          },
        ],
        associated_set_of_vuln: [
          {
            filename: 'CVE-2024-1234.json',
            json_content: {
              id: 'CVE-2024-1234',
              summary: 'Test vulnerability',
              details: 'Test vulnerability',
            },
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await apiClient.queryByOrigin('https://github.com/test/repo');
      
      expect(result).toEqual([
        {
          origin: 'https://github.com/test/repo',
          revision_swhid: 'swh:1:rev:abc123',
          branch_name: 'main',
          vulnerability_filename: 'CVE-2024-1234.json',
        },
      ]);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/origin/vulnerabilities/json?url=https%3A%2F%2Fgithub.com%2Ftest%2Frepo',
        expect.any(Object)
      );
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(apiClient.queryByOrigin('https://github.com/test/repo'))
        .rejects.toThrow('Failed to query by origin: HTTP 500: Internal Server Error');
    });
  });

  describe('queryByCommitId', () => {
    it('should query vulnerabilities by SWHID using JSON endpoint', async () => {
      const mockResponse = {
        entry: {
          swhid: 'swh:1:rev:abc123',
        },
        associated_set_of_vuln: [
          {
            filename: 'CVE-2024-1234.json',
            json_content: {
              id: 'CVE-2024-1234',
              summary: 'Test vulnerability',
              details: 'Test vulnerability',
            },
          },
          {
            filename: 'CVE-2024-5678.json',
            json_content: {
              id: 'CVE-2024-5678',
              summary: 'Another vulnerability',
              details: 'Another vulnerability',
            },
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await apiClient.queryByCommitId('swh:1:rev:abc123');
      
      expect(result).toEqual([
        {
          revision_swhid: 'swh:1:rev:abc123',
          category: '',
          vulnerability_filename: 'CVE-2024-1234.json',
        },
        {
          revision_swhid: 'swh:1:rev:abc123',
          category: '',
          vulnerability_filename: 'CVE-2024-5678.json',
        },
      ]);
    });

    it('should add SWHID prefix if missing', async () => {
      const mockResponse = {
        entry: {
          swhid: 'swh:1:rev:abc123',
        },
        associated_set_of_vuln: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      });

      await apiClient.queryByCommitId('abc123');
      
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/swhid/swh%3A1%3Arev%3Aabc123/vulnerabilities/json',
        expect.any(Object)
      );
    });

    it('should return empty array for 404 responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await apiClient.queryByCommitId('swh:1:rev:notfound');
      
      expect(result).toEqual([]);
    });
  });

  describe('loadCVEData', () => {
    it('should use cached CVE data from JSON endpoints', async () => {
      // First, populate the cache by calling queryByCommitId
      const mockResponse = {
        entry: {
          swhid: 'swh:1:rev:abc123',
        },
        associated_set_of_vuln: [
          {
            filename: 'CVE-2024-1234.json',
            json_content: {
              id: 'CVE-2024-1234',
              summary: 'Test vulnerability',
              details: 'Test vulnerability',
            },
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      });

      // Call queryByCommitId to populate cache
      await apiClient.queryByCommitId('swh:1:rev:abc123');

      // Now loadCVEData should use cached data
      const result = await apiClient.loadCVEData('CVE-2024-1234.json');
      
      expect(result).toEqual({
        id: 'CVE-2024-1234',
        summary: 'Test vulnerability',
        details: 'Test vulnerability',
      });

      // Should only have called fetch once (for the query, not for CVE loading)
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should return null when CVE data is not cached', async () => {
      // Try to load CVE data without calling query methods first
      const result = await apiClient.loadCVEData('CVE-2024-1234.json');
      expect(result).toBeNull();
    });

    it('should return null when CVE loading fails due to missing cache', async () => {
      const result = await apiClient.loadCVEData('osv-output/CVE-2024-1234.json');
      expect(result).toBeNull();
    });
  });
});