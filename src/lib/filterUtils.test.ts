/**
 * Filter Utils - Property-Based Tests
 * Tests filtering logic for vulnerability results
 * Requirements: 13.2, 13.3, 13.4, 13.5, 13.6, 13.7
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { applyFilters, hasActiveFilters, createEmptyFilters } from './filterUtils';
import type { VulnerabilityResult, OriginVulnerabilityResult, ResultFilters } from '../types';

// Arbitraries for generating test data
const vulnerabilityResultArbitrary = fc.record({
  revision_id: fc.stringMatching(/^[a-f0-9]{40}$/),
  category: fc.constantFrom('vulnerable', 'patched', 'unknown'),
  vulnerability_filename: fc.stringMatching(/^CVE-\d{4}-\d+\.json$/),
  severity: fc.option(fc.constantFrom('Critical', 'High', 'Medium', 'Low', 'None'), { nil: undefined })
}) as fc.Arbitrary<VulnerabilityResult>;

const originVulnerabilityResultArbitrary = fc.record({
  origin: fc.webUrl(),
  revision_id: fc.stringMatching(/^[a-f0-9]{40}$/),
  branch_name: fc.stringMatching(/^refs\/heads\/[a-z0-9-]+$/),
  vulnerability_filename: fc.stringMatching(/^CVE-\d{4}-\d+\.json$/),
  severity: fc.option(fc.constantFrom('Critical', 'High', 'Medium', 'Low', 'None'), { nil: undefined })
}) as fc.Arbitrary<OriginVulnerabilityResult>;

describe('Filter Utils - Property-Based Tests', () => {
  /**
   * Feature: vuln-fork-lookup, Property 23: CVE name filter matching
   * Validates: Requirements 13.2
   */
  describe('CVE name filtering', () => {
    it('should filter results by CVE name (case-insensitive substring match)', () => {
      fc.assert(
        fc.property(
          fc.array(vulnerabilityResultArbitrary, { minLength: 1, maxLength: 20 }),
          fc.string({ minLength: 1, maxLength: 10 }),
          (results, filterText) => {
            const filters: ResultFilters = {
              cveNameFilter: filterText,
              branchFilter: '',
              severityFilter: []
            };

            const filtered = applyFilters(results, filters);

            // All filtered results should contain the filter text (case-insensitive)
            filtered.forEach(result => {
              expect(
                result.vulnerability_filename.toLowerCase()
              ).toContain(filterText.toLowerCase());
            });

            // No unfiltered results should be missing
            const expectedCount = results.filter(r =>
              r.vulnerability_filename.toLowerCase().includes(filterText.toLowerCase())
            ).length;
            expect(filtered.length).toBe(expectedCount);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return all results when CVE filter is empty', () => {
      fc.assert(
        fc.property(
          fc.array(vulnerabilityResultArbitrary, { minLength: 1, maxLength: 20 }),
          (results) => {
            const filters: ResultFilters = {
              cveNameFilter: '',
              branchFilter: '',
              severityFilter: []
            };

            const filtered = applyFilters(results, filters);
            expect(filtered.length).toBe(results.length);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: vuln-fork-lookup, Property 24: Branch name filter matching
   * Validates: Requirements 13.3
   */
  describe('Branch name filtering', () => {
    it('should filter origin results by branch name (case-insensitive substring match)', () => {
      fc.assert(
        fc.property(
          fc.array(originVulnerabilityResultArbitrary, { minLength: 1, maxLength: 20 }),
          fc.string({ minLength: 1, maxLength: 10 }),
          (results, filterText) => {
            const filters: ResultFilters = {
              cveNameFilter: '',
              branchFilter: filterText,
              severityFilter: []
            };

            const filtered = applyFilters(results, filters);

            // All filtered results should contain the filter text in branch_name (case-insensitive)
            filtered.forEach(result => {
              expect(
                result.branch_name.toLowerCase()
              ).toContain(filterText.toLowerCase());
            });

            // No unfiltered results should be missing
            const expectedCount = results.filter(r =>
              r.branch_name.toLowerCase().includes(filterText.toLowerCase())
            ).length;
            expect(filtered.length).toBe(expectedCount);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not filter commit results by branch name', () => {
      fc.assert(
        fc.property(
          fc.array(vulnerabilityResultArbitrary, { minLength: 1, maxLength: 20 }),
          fc.string({ minLength: 1, maxLength: 10 }),
          (results, filterText) => {
            const filters: ResultFilters = {
              cveNameFilter: '',
              branchFilter: filterText,
              severityFilter: []
            };

            const filtered = applyFilters(results, filters);
            // Branch filter should not affect commit results (they don't have branch_name)
            expect(filtered.length).toBe(results.length);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: vuln-fork-lookup, Property 25: Severity level filter matching
   * Validates: Requirements 13.4
   */
  describe('Severity level filtering', () => {
    it('should filter results by severity level (exact match, multiple selection)', () => {
      fc.assert(
        fc.property(
          fc.array(vulnerabilityResultArbitrary, { minLength: 1, maxLength: 20 }),
          fc.array(fc.constantFrom('Critical', 'High', 'Medium', 'Low', 'None'), { minLength: 1, maxLength: 3 }),
          (results, severityLevels) => {
            const filters: ResultFilters = {
              cveNameFilter: '',
              branchFilter: '',
              severityFilter: severityLevels
            };

            const filtered = applyFilters(results, filters);

            // All filtered results should have severity in the selected levels
            filtered.forEach(result => {
              const severity = result.severity || 'None';
              expect(severityLevels).toContain(severity);
            });

            // No unfiltered results should be missing
            const expectedCount = results.filter(r => {
              const severity = r.severity || 'None';
              return severityLevels.includes(severity);
            }).length;
            expect(filtered.length).toBe(expectedCount);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return all results when severity filter is empty', () => {
      fc.assert(
        fc.property(
          fc.array(vulnerabilityResultArbitrary, { minLength: 1, maxLength: 20 }),
          (results) => {
            const filters: ResultFilters = {
              cveNameFilter: '',
              branchFilter: '',
              severityFilter: []
            };

            const filtered = applyFilters(results, filters);
            expect(filtered.length).toBe(results.length);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: vuln-fork-lookup, Property 26: Multiple filter AND logic
   * Validates: Requirements 13.5
   */
  describe('Multiple filter AND logic', () => {
    it('should apply all filters using AND logic', () => {
      fc.assert(
        fc.property(
          fc.array(originVulnerabilityResultArbitrary, { minLength: 1, maxLength: 20 }),
          fc.string({ minLength: 1, maxLength: 5 }),
          fc.string({ minLength: 1, maxLength: 5 }),
          fc.array(fc.constantFrom('Critical', 'High', 'Medium', 'Low', 'None'), { minLength: 1, maxLength: 2 }),
          (results, cveFilter, branchFilter, severityFilter) => {
            const filters: ResultFilters = {
              cveNameFilter: cveFilter,
              branchFilter: branchFilter,
              severityFilter: severityFilter
            };

            const filtered = applyFilters(results, filters);

            // All filtered results must match ALL filters
            filtered.forEach(result => {
              // CVE name filter
              expect(
                result.vulnerability_filename.toLowerCase()
              ).toContain(cveFilter.toLowerCase());

              // Branch name filter
              expect(
                result.branch_name.toLowerCase()
              ).toContain(branchFilter.toLowerCase());

              // Severity filter
              const severity = result.severity || 'None';
              expect(severityFilter).toContain(severity);
            });

            // Verify count matches manual filtering
            const expectedCount = results.filter(r => {
              const matchesCVE = r.vulnerability_filename.toLowerCase().includes(cveFilter.toLowerCase());
              const matchesBranch = r.branch_name.toLowerCase().includes(branchFilter.toLowerCase());
              const severity = r.severity || 'None';
              const matchesSeverity = severityFilter.includes(severity);
              return matchesCVE && matchesBranch && matchesSeverity;
            }).length;
            expect(filtered.length).toBe(expectedCount);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: vuln-fork-lookup, Property 27: Filter count accuracy
   * Validates: Requirements 13.6
   */
  describe('Filter count accuracy', () => {
    it('should return accurate filtered count', () => {
      fc.assert(
        fc.property(
          fc.array(vulnerabilityResultArbitrary, { minLength: 1, maxLength: 20 }),
          fc.string({ minLength: 1, maxLength: 10 }),
          (results, filterText) => {
            const filters: ResultFilters = {
              cveNameFilter: filterText,
              branchFilter: '',
              severityFilter: []
            };

            const filtered = applyFilters(results, filters);
            const totalCount = results.length;
            const filteredCount = filtered.length;

            // Filtered count should be <= total count
            expect(filteredCount).toBeLessThanOrEqual(totalCount);

            // Filtered count should match actual filtered results
            expect(filteredCount).toBe(filtered.length);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: vuln-fork-lookup, Property 28: Clear filters restoration
   * Validates: Requirements 13.7
   */
  describe('Clear filters restoration', () => {
    it('should restore complete unfiltered result set when filters are cleared', () => {
      fc.assert(
        fc.property(
          fc.array(vulnerabilityResultArbitrary, { minLength: 1, maxLength: 20 }),
          (results) => {
            // Apply some filters
            const activeFilters: ResultFilters = {
              cveNameFilter: 'test',
              branchFilter: 'main',
              severityFilter: ['Critical', 'High']
            };

            const filtered = applyFilters(results, activeFilters);

            // Clear filters
            const emptyFilters = createEmptyFilters();
            const restored = applyFilters(results, emptyFilters);

            // Should restore all results
            expect(restored.length).toBe(results.length);
            expect(restored).toEqual(results);

            // hasActiveFilters should return false
            expect(hasActiveFilters(emptyFilters)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should detect when filters are active', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.record({ cveNameFilter: fc.string({ minLength: 1 }), branchFilter: fc.constant(''), severityFilter: fc.constant([]) }),
            fc.record({ cveNameFilter: fc.constant(''), branchFilter: fc.string({ minLength: 1 }), severityFilter: fc.constant([]) }),
            fc.record({ cveNameFilter: fc.constant(''), branchFilter: fc.constant(''), severityFilter: fc.array(fc.string(), { minLength: 1 }) })
          ),
          (filters) => {
            expect(hasActiveFilters(filters as ResultFilters)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
