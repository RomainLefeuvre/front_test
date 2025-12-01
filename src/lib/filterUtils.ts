/**
 * Filter Utility Functions
 * Provides filtering logic for vulnerability results
 * Requirements: 13.2, 13.3, 13.4, 13.5
 */

import type { VulnerabilityResult, OriginVulnerabilityResult, ResultFilters } from '../types';

/**
 * Applies filters to vulnerability results
 * Uses AND logic for multiple active filters (Requirement: 13.5)
 * 
 * @param results - Array of vulnerability results to filter
 * @param filters - Filter criteria to apply
 * @returns Filtered array of results
 */
export function applyFilters<T extends VulnerabilityResult | OriginVulnerabilityResult>(
  results: T[],
  filters: ResultFilters
): T[] {
  return results.filter(result => {
    // CVE name filter (Requirement: 13.2)
    // Case-insensitive substring match on vulnerability_filename
    if (filters.cveNameFilter) {
      const cveMatch = result.vulnerability_filename
        .toLowerCase()
        .includes(filters.cveNameFilter.toLowerCase());
      if (!cveMatch) return false;
    }

    // Branch name filter (Requirement: 13.3)
    // Only applies to OriginVulnerabilityResult
    // Case-insensitive substring match on branch_name
    if (filters.branchFilter && 'branch_name' in result) {
      const branchMatch = result.branch_name
        .toLowerCase()
        .includes(filters.branchFilter.toLowerCase());
      if (!branchMatch) return false;
    }

    // Severity level filter (Requirement: 13.4)
    // Exact match, multiple selection (OR logic within severity filter)
    if (filters.severityFilter.length > 0) {
      const severity = result.severity || 'None';
      if (!filters.severityFilter.includes(severity)) {
        return false;
      }
    }

    // All filters passed (AND logic)
    return true;
  });
}

/**
 * Checks if any filters are active
 * 
 * @param filters - Filter criteria to check
 * @returns True if any filter is active
 */
export function hasActiveFilters(filters: ResultFilters): boolean {
  return (
    filters.cveNameFilter !== '' ||
    filters.branchFilter !== '' ||
    filters.severityFilter.length > 0
  );
}

/**
 * Creates an empty filter state
 * 
 * @returns Empty ResultFilters object
 */
export function createEmptyFilters(): ResultFilters {
  return {
    cveNameFilter: '',
    branchFilter: '',
    severityFilter: []
  };
}
