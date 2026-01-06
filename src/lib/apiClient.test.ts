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
      timeout: 5000,
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
    it('should query vulnerabilities by origin URL', async () => {
      const mockResponse = {
        origin: 'https://github.com/test/repo',
        vulnerable_commits: [
          {
            revision_id: 'swh:1:rev:abc123',
            branch_name: 'main',
            vulnerability_filename: 'CVE-2024-1234.json',
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
        'http://localhost:8080/api/origin/vulnerabilities?url=https%3A%2F%2Fgithub.com%2Ftest%2Frepo',
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
    it('should query vulnerabilities by SWHID', async () => {
      const mockResponse = {
        swhid: 'swh:1:rev:abc123',
        vulnerabilities: ['CVE-2024-1234.json', 'CVE-2024-5678.json'],
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
        swhid: 'swh:1:rev:abc123',
        vulnerabilities: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      });

      await apiClient.queryByCommitId('abc123');
      
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/swhid/swh%3A1%3Arev%3Aabc123/vulnerabilities',
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
    it('should load CVE data from public directory', async () => {
      const mockCVE = {
        id: 'CVE-2024-1234',
        details: 'Test vulnerability',
      };

      // Mock the fetch for CVE data (different from API fetch)
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCVE),
      });

      const result = await apiClient.loadCVEData('osv-output/CVE-2024-1234.json');
      
      expect(result).toEqual(mockCVE);
      expect(global.fetch).toHaveBeenCalledWith('/cve/CVE-2024-1234.json');

      // Restore original fetch
      global.fetch = originalFetch;
    });

    it('should handle CVE loading errors', async () => {
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      await expect(apiClient.loadCVEData('CVE-2024-1234.json'))
        .rejects.toThrow('Failed to load CVE data for CVE-2024-1234.json: HTTP 404: Not Found');

      global.fetch = originalFetch;
    });
  });
});