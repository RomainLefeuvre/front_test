/**
 * Tests for filter utilities
 * Tests filtering logic for commit and origin results
 */

import { describe, it, expect } from 'vitest';
import { applyFilters, hasActiveFilters, createEmptyFilters } from './filterUtils';
import type { VulnerabilityResult, OriginVulnerabilityResult, ResultFilters } from '../types';

describe('filterUtils', () => {
  describe('applyFilters - Commit Results', () => {
    it('should filter commit results by severity', () => {
      const results: VulnerabilityResult[] = [
        {
          revision_id: 'a'.repeat(40),
          category: 'VULN_1',
          vulnerability_filename: 'CVE-2021-1234.json',
          severity: 'CRITICAL',
          cvssScore: 9.8,
        },
        {
          revision_id: 'b'.repeat(40),
          category: 'VULN_2',
          vulnerability_filename: 'CVE-2021-5678.json',
          severity: 'HIGH',
          cvssScore: 7.5,
        },
        {
          revision_id: 'c'.repeat(40),
          category: 'VULN_3',
          vulnerability_filename: 'CVE-2021-9999.json',
          severity: 'MEDIUM',
          cvssScore: 5.0,
        },
      ];

      const filters: ResultFilters = {
        cveNameFilter: '',
        branchFilter: '',
        severityFilter: ['CRITICAL', 'HIGH'],
      };

      const filtered = applyFilters(results, filters);

      expect(filtered).toHaveLength(2);
      expect(filtered[0].severity).toBe('CRITICAL');
      expect(filtered[1].severity).toBe('HIGH');
    });

    it('should filter commit results by CVE name', () => {
      const results: VulnerabilityResult[] = [
        {
          revision_id: 'a'.repeat(40),
          category: 'VULN_1',
          vulnerability_filename: 'CVE-2021-1234.json',
          severity: 'CRITICAL',
          cvssScore: 9.8,
        },
        {
          revision_id: 'b'.repeat(40),
          category: 'VULN_2',
          vulnerability_filename: 'CVE-2022-5678.json',
          severity: 'HIGH',
          cvssScore: 7.5,
        },
      ];

      const filters: ResultFilters = {
        cveNameFilter: '2021',
        branchFilter: '',
        severityFilter: [],
      };

      const filtered = applyFilters(results, filters);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].vulnerability_filename).toContain('2021');
    });

    it('should apply multiple filters with AND logic for commit results', () => {
      const results: VulnerabilityResult[] = [
        {
          revision_id: 'a'.repeat(40),
          category: 'VULN_1',
          vulnerability_filename: 'CVE-2021-1234.json',
          severity: 'CRITICAL',
          cvssScore: 9.8,
        },
        {
          revision_id: 'b'.repeat(40),
          category: 'VULN_2',
          vulnerability_filename: 'CVE-2021-5678.json',
          severity: 'HIGH',
          cvssScore: 7.5,
        },
        {
          revision_id: 'c'.repeat(40),
          category: 'VULN_3',
          vulnerability_filename: 'CVE-2022-9999.json',
          severity: 'CRITICAL',
          cvssScore: 9.5,
        },
      ];

      const filters: ResultFilters = {
        cveNameFilter: '2021',
        branchFilter: '',
        severityFilter: ['CRITICAL'],
      };

      const filtered = applyFilters(results, filters);

      // Should only return CVE-2021-1234 (matches both 2021 AND CRITICAL)
      expect(filtered).toHaveLength(1);
      expect(filtered[0].vulnerability_filename).toBe('CVE-2021-1234.json');
      expect(filtered[0].severity).toBe('CRITICAL');
    });

    it('should handle commit results without severity field', () => {
      const results: VulnerabilityResult[] = [
        {
          revision_id: 'a'.repeat(40),
          category: 'VULN_1',
          vulnerability_filename: 'CVE-2021-1234.json',
          // No severity field
        },
        {
          revision_id: 'b'.repeat(40),
          category: 'VULN_2',
          vulnerability_filename: 'CVE-2021-5678.json',
          severity: 'HIGH',
          cvssScore: 7.5,
        },
      ];

      const filters: ResultFilters = {
        cveNameFilter: '',
        branchFilter: '',
        severityFilter: ['HIGH'],
      };

      const filtered = applyFilters(results, filters);

      // Should only return the one with HIGH severity
      expect(filtered).toHaveLength(1);
      expect(filtered[0].severity).toBe('HIGH');
    });

    it('should treat missing severity as "None" when filtering', () => {
      const results: VulnerabilityResult[] = [
        {
          revision_id: 'a'.repeat(40),
          category: 'VULN_1',
          vulnerability_filename: 'CVE-2021-1234.json',
          // No severity field
        },
      ];

      const filters: ResultFilters = {
        cveNameFilter: '',
        branchFilter: '',
        severityFilter: ['None'],
      };

      const filtered = applyFilters(results, filters);

      // Should return the result with missing severity
      expect(filtered).toHaveLength(1);
    });
  });

  describe('applyFilters - Origin Results', () => {
    it('should filter origin results by severity', () => {
      const results: OriginVulnerabilityResult[] = [
        {
          origin: 'https://github.com/test/repo1',
          revision_id: 'a'.repeat(40),
          branch_name: 'refs/heads/main',
          vulnerability_filename: 'CVE-2021-1234.json',
          severity: 'CRITICAL',
          cvssScore: 9.8,
        },
        {
          origin: 'https://github.com/test/repo2',
          revision_id: 'b'.repeat(40),
          branch_name: 'refs/heads/develop',
          vulnerability_filename: 'CVE-2021-5678.json',
          severity: 'LOW',
          cvssScore: 3.0,
        },
      ];

      const filters: ResultFilters = {
        cveNameFilter: '',
        branchFilter: '',
        severityFilter: ['CRITICAL'],
      };

      const filtered = applyFilters(results, filters);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].severity).toBe('CRITICAL');
    });

    it('should filter origin results by branch name', () => {
      const results: OriginVulnerabilityResult[] = [
        {
          origin: 'https://github.com/test/repo1',
          revision_id: 'a'.repeat(40),
          branch_name: 'refs/heads/main',
          vulnerability_filename: 'CVE-2021-1234.json',
          severity: 'CRITICAL',
          cvssScore: 9.8,
        },
        {
          origin: 'https://github.com/test/repo2',
          revision_id: 'b'.repeat(40),
          branch_name: 'refs/heads/develop',
          vulnerability_filename: 'CVE-2021-5678.json',
          severity: 'HIGH',
          cvssScore: 7.5,
        },
      ];

      const filters: ResultFilters = {
        cveNameFilter: '',
        branchFilter: 'main',
        severityFilter: [],
      };

      const filtered = applyFilters(results, filters);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].branch_name).toContain('main');
    });

    it('should apply multiple filters with AND logic for origin results', () => {
      const results: OriginVulnerabilityResult[] = [
        {
          origin: 'https://github.com/test/repo1',
          revision_id: 'a'.repeat(40),
          branch_name: 'refs/heads/main',
          vulnerability_filename: 'CVE-2021-1234.json',
          severity: 'CRITICAL',
          cvssScore: 9.8,
        },
        {
          origin: 'https://github.com/test/repo2',
          revision_id: 'b'.repeat(40),
          branch_name: 'refs/heads/main',
          vulnerability_filename: 'CVE-2022-5678.json',
          severity: 'HIGH',
          cvssScore: 7.5,
        },
        {
          origin: 'https://github.com/test/repo3',
          revision_id: 'c'.repeat(40),
          branch_name: 'refs/heads/develop',
          vulnerability_filename: 'CVE-2021-9999.json',
          severity: 'CRITICAL',
          cvssScore: 9.5,
        },
      ];

      const filters: ResultFilters = {
        cveNameFilter: '2021',
        branchFilter: 'main',
        severityFilter: ['CRITICAL'],
      };

      const filtered = applyFilters(results, filters);

      // Should only return the first result (matches all three filters)
      expect(filtered).toHaveLength(1);
      expect(filtered[0].vulnerability_filename).toBe('CVE-2021-1234.json');
      expect(filtered[0].branch_name).toContain('main');
      expect(filtered[0].severity).toBe('CRITICAL');
    });
  });

  describe('hasActiveFilters', () => {
    it('should return false for empty filters', () => {
      const filters = createEmptyFilters();
      expect(hasActiveFilters(filters)).toBe(false);
    });

    it('should return true when CVE name filter is active', () => {
      const filters: ResultFilters = {
        cveNameFilter: 'CVE-2021',
        branchFilter: '',
        severityFilter: [],
      };
      expect(hasActiveFilters(filters)).toBe(true);
    });

    it('should return true when branch filter is active', () => {
      const filters: ResultFilters = {
        cveNameFilter: '',
        branchFilter: 'main',
        severityFilter: [],
      };
      expect(hasActiveFilters(filters)).toBe(true);
    });

    it('should return true when severity filter is active', () => {
      const filters: ResultFilters = {
        cveNameFilter: '',
        branchFilter: '',
        severityFilter: ['CRITICAL'],
      };
      expect(hasActiveFilters(filters)).toBe(true);
    });
  });

  describe('createEmptyFilters', () => {
    it('should create empty filter object', () => {
      const filters = createEmptyFilters();
      expect(filters.cveNameFilter).toBe('');
      expect(filters.branchFilter).toBe('');
      expect(filters.severityFilter).toHaveLength(0);
    });
  });
});
