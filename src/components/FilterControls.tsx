/**
 * Filter Controls Component
 * Provides UI controls for filtering vulnerability results
 * Requirements: 13.1, 13.6
 */

import type { ResultFilters } from '../types';

export interface FilterControlsProps {
  filters: ResultFilters;
  onFilterChange: (filters: Partial<ResultFilters>) => void;
  onClearFilters: () => void;
  filteredCount: number;
  totalCount: number;
  availableCVEs?: string[];      // List of available CVE identifiers for autocomplete
  availableBranches?: string[];  // List of available branch names for autocomplete
  showAllBranches?: boolean;     // Whether to show branches that don't contain refs/heads
  onShowAllBranchesChange?: (show: boolean) => void;
  hasOriginResults?: boolean;    // Whether there are origin results (to show branch filter)
}

export function FilterControls({
  filters,
  onFilterChange,
  onClearFilters,
  filteredCount,
  totalCount,
  availableCVEs = [],
  availableBranches = [],
  showAllBranches = false,
  onShowAllBranchesChange,
  hasOriginResults = false
}: FilterControlsProps) {
  const hasActiveFilters = 
    filters.cveNameFilter !== '' || 
    filters.branchFilter !== '' || 
    filters.severityFilter.length > 0;

  /**
   * Handles severity level selection
   */
  const handleSeverityToggle = (severity: string) => {
    const newSeverityFilter = filters.severityFilter.includes(severity)
      ? filters.severityFilter.filter(s => s !== severity)
      : [...filters.severityFilter, severity];
    
    onFilterChange({ severityFilter: newSeverityFilter });
  };

  const severityLevels = ['Critical', 'High', 'Medium', 'Low', 'None'];

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
      <div className="flex flex-col gap-4">
        {/* Filter Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">
            Filter Results
          </h3>
          
          {/* Filtered Count Display (Requirement: 13.6) */}
          <div className="text-sm text-gray-600">
            Showing <span className="font-semibold">{filteredCount}</span> of{' '}
            <span className="font-semibold">{totalCount}</span> results
          </div>
        </div>

        {/* Filter Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* CVE Name Filter (Requirement: 13.2) */}
          <div>
            <label 
              htmlFor="cve-filter" 
              className="block text-xs font-medium text-gray-700 mb-1"
            >
              CVE Identifier
            </label>
            <input
              id="cve-filter"
              type="text"
              list="cve-list"
              value={filters.cveNameFilter}
              onChange={(e) => onFilterChange({ cveNameFilter: e.target.value })}
              placeholder="Filter by CVE..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              aria-label="Filter by CVE identifier"
            />
            {availableCVEs.length > 0 && (
              <datalist id="cve-list">
                {availableCVEs.map((cve) => (
                  <option key={cve} value={cve} />
                ))}
              </datalist>
            )}
          </div>

          {/* Branch Name Filter (Requirement: 13.3) */}
          <div>
            <label 
              htmlFor="branch-filter" 
              className="block text-xs font-medium text-gray-700 mb-1"
            >
              Branch Name
            </label>
            <input
              id="branch-filter"
              type="text"
              list="branch-list"
              value={filters.branchFilter}
              onChange={(e) => onFilterChange({ branchFilter: e.target.value })}
              placeholder="Filter by branch..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              aria-label="Filter by branch name"
            />
            {availableBranches.length > 0 && (
              <datalist id="branch-list">
                {availableBranches.map((branch) => (
                  <option key={branch} value={branch} />
                ))}
              </datalist>
            )}
          </div>

          {/* Clear Filters Button (Requirement: 13.7) */}
          <div className="flex items-end">
            <button
              onClick={onClearFilters}
              disabled={!hasActiveFilters}
              className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Clear all filters"
            >
              Clear Filters
            </button>
          </div>
        </div>

        {/* Severity Level Multi-Select (Requirement: 13.4) */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-2">
            Severity Level
          </label>
          <div className="flex flex-wrap gap-2">
            {severityLevels.map((severity) => {
              const isSelected = filters.severityFilter.includes(severity);
              return (
                <button
                  key={severity}
                  onClick={() => handleSeverityToggle(severity)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                  aria-label={`${isSelected ? 'Remove' : 'Add'} ${severity} severity filter`}
                  aria-pressed={isSelected}
                >
                  {severity}
                </button>
              );
            })}
          </div>
        </div>

        {/* Branch Filter Toggle (only for origin results) */}
        {hasOriginResults && onShowAllBranchesChange && (
          <div className="pt-2 border-t border-gray-200">
            <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={showAllBranches}
                onChange={(e) => onShowAllBranchesChange(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Show branches that do not contain refs/heads</span>
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
