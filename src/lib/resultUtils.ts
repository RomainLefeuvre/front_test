/**
 * Result Utilities Module
 * Provides utility functions for processing and organizing vulnerability results
 * Requirements: 2.3, 2.5
 */

import type { OriginVulnerabilityResult } from '../types';

/**
 * Groups origin vulnerability results by branch name
 * 
 * @param results - Array of origin vulnerability results
 * @returns Map of branch names to their associated vulnerabilities
 */
export function groupByBranch(
  results: OriginVulnerabilityResult[]
): Map<string, OriginVulnerabilityResult[]> {
  const groups = new Map<string, OriginVulnerabilityResult[]>();
  
  for (const result of results) {
    const branch = result.branch_name;
    if (!groups.has(branch)) {
      groups.set(branch, []);
    }
    groups.get(branch)!.push(result);
  }
  
  return groups;
}
