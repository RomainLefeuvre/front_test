/**
 * Results Display Component
 * Displays vulnerability search results with branch grouping for origin queries
 * Requirements: 1.2, 1.3, 2.2, 2.4, 2.3, 2.5, 3.1, 3.4
 */

import { useState, useMemo } from 'react';
import type { VulnerabilityResult, OriginVulnerabilityResult, ResultFilters } from '../types';
import { groupByBranch } from '../lib/resultUtils';
import { applyFilters } from '../lib/filterUtils';
import { FilterControls } from './FilterControls';
import { SeverityBadge } from './SeverityBadge';

export interface ResultsDisplayProps {
  commitResults?: VulnerabilityResult[] | null;
  originResults?: OriginVulnerabilityResult[] | null;
  onCVEClick?: (vulnerabilityFilename: string) => void;
}

export function ResultsDisplay({ 
  commitResults, 
  originResults,
  onCVEClick 
}: ResultsDisplayProps) {
  // State for branch filtering
  const [showAllBranches, setShowAllBranches] = useState(false);
  
  // State for result filtering (Requirements: 13.1, 13.7)
  const [filters, setFilters] = useState<ResultFilters>({
    cveNameFilter: '',
    branchFilter: '',
    severityFilter: []
  });

  /**
   * Handles filter changes
   */
  const handleFilterChange = (newFilters: Partial<ResultFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  /**
   * Clears all filters (Requirement: 13.7)
   */
  const handleClearFilters = () => {
    setFilters({
      cveNameFilter: '',
      branchFilter: '',
      severityFilter: []
    });
  };

  // Apply filters to results (Requirements: 13.1, 13.6)
  // Must be called before any early returns to comply with Rules of Hooks
  const filteredCommitResults = useMemo(() => {
    if (!commitResults) return null;
    return applyFilters(commitResults, filters);
  }, [commitResults, filters]);

  const filteredOriginResults = useMemo(() => {
    if (!originResults) return null;
    return applyFilters(originResults, filters);
  }, [originResults, filters]);

  // Calculate total counts for filter display
  const totalCount = (commitResults?.length || 0) + (originResults?.length || 0);
  const filteredCount = (filteredCommitResults?.length || 0) + (filteredOriginResults?.length || 0);

  // Extract unique values for autocomplete
  const availableCVEs = useMemo(() => {
    const allResults = [...(commitResults || []), ...(originResults || [])];
    const cveSet = new Set(
      allResults.map(r => (r.vulnerability_filename.split('/').pop() || r.vulnerability_filename).replace(/\.json$/, ''))
    );
    return Array.from(cveSet).sort();
  }, [commitResults, originResults]);

  const availableBranches = useMemo(() => {
    if (!originResults) return [];
    const branchSet = new Set(originResults.map(r => r.branch_name));
    return Array.from(branchSet).sort();
  }, [originResults]);

  // Don't render if no results
  if (!commitResults && !originResults) {
    return null;
  }
  
  // Filter origin results by branch prefix if needed
  const branchFilteredOriginResults = filteredOriginResults && !showAllBranches
    ? filteredOriginResults.filter(result => result.branch_name.startsWith('refs/heads/'))
    : filteredOriginResults;

  // Handle empty results (no data at all)
  if ((commitResults && commitResults.length === 0) || (originResults && originResults.length === 0)) {
    return (
      <div className="mt-4 sm:mt-6 lg:mt-8 max-w-3xl mx-auto px-4 sm:px-0" role="region" aria-live="polite" aria-label="Search results">
        <div className="bg-white rounded-lg shadow p-4 sm:p-6 text-center">
          <svg
            className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <h3 className="mt-2 text-sm sm:text-base font-medium text-gray-900">No vulnerabilities found</h3>
          <p className="mt-1 text-xs sm:text-sm text-gray-500">
            The search did not return any vulnerability results.
          </p>
        </div>
      </div>
    );
  }

  /**
   * Handles CVE detail click
   */
  const handleCVEClick = (vulnerabilityFilename: string) => {
    if (onCVEClick) {
      onCVEClick(vulnerabilityFilename);
    }
  };

  /**
   * Gets the border color class based on severity level
   */
  const getBorderColorClass = (severity?: string): string => {
    if (!severity) return 'border-gray-400';
    
    switch (severity.toLowerCase()) {
      case 'critical':
        return 'border-purple-500';
      case 'high':
        return 'border-red-500';
      case 'medium':
        return 'border-orange-500';
      case 'low':
        return 'border-yellow-500';
      case 'none':
        return 'border-gray-400';
      default:
        return 'border-gray-400';
    }
  };

  /**
   * Renders commit ID search results
   */
  const renderCommitResults = () => {
    if (!filteredCommitResults || filteredCommitResults.length === 0) return null;

    // Count distinct vulnerabilities (by vulnerability_filename)
    const distinctVulnerabilities = new Set(
      filteredCommitResults.map(result => result.vulnerability_filename)
    );
    const distinctCount = distinctVulnerabilities.size;

    return (
      <section className="mt-6 sm:mt-8 lg:mt-10 max-w-4xl mx-auto px-4 sm:px-0" role="region" aria-live="polite" aria-label="Search results">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100">
          {/* Header */}
          <header className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
              Found {distinctCount} distinct {distinctCount === 1 ? 'vulnerability' : 'vulnerabilities'}
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-gray-500">
              Vulnerabilities associated with this commit
            </p>
          </header>

          {/* Results List */}
          <ul className="divide-y divide-gray-200" role="list">
            {filteredCommitResults.map((result, index) => (
              <li
                key={index}
                className="px-4 sm:px-6 py-3 sm:py-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    {/* Vulnerability Filename - Clickable */}
                    <button
                      onClick={() => handleCVEClick(result.vulnerability_filename)}
                      className="group flex items-center text-left w-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded px-2 py-1 -mx-2 -my-1"
                      aria-label={`View details for ${result.vulnerability_filename}`}
                    >
                      <span className="text-sm sm:text-base font-medium text-blue-600 group-hover:text-blue-800 group-hover:underline group-focus:underline break-all">
                        {(result.vulnerability_filename.split('/').pop() || result.vulnerability_filename).replace(/\.json$/, '')}
                      </span>
                      <svg
                        className="ml-2 h-3 w-3 sm:h-4 sm:w-4 text-blue-600 group-hover:text-blue-800 flex-shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </button>

                    {/* Severity Badge and Category */}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {result.severity && (
                        <SeverityBadge 
                          severity={result.severity} 
                          cvssScore={result.cvssScore}
                          size="sm"
                        />
                      )}
                      {result.category && (
                        <span className="px-2 py-0.5 sm:py-1 bg-purple-100 text-purple-800 rounded-md text-xs font-medium">
                          {result.category}
                        </span>
                      )}
                    </div>

                    {/* Revision ID */}
                    <div className="mt-2 text-xs sm:text-sm text-gray-600">
                      <span className="font-medium">Revision ID:</span>
                      <code className="ml-2 px-1.5 sm:px-2 py-0.5 sm:py-1 bg-gray-100 text-gray-800 rounded text-xs font-mono break-all">
                        {result.revision_id}
                      </code>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>
    );
  };

  /**
   * Renders origin URL search results with branch grouping
   */
  const renderOriginResults = () => {
    if (!branchFilteredOriginResults || branchFilteredOriginResults.length === 0) {
      // Show message if results were filtered out
      if (filteredOriginResults && filteredOriginResults.length > 0 && !showAllBranches) {
        return (
          <section className="mt-4 sm:mt-6 lg:mt-8 max-w-3xl mx-auto px-4 sm:px-0" role="region" aria-live="polite" aria-label="Search results">
            <div className="bg-white rounded-lg shadow overflow-hidden p-6 text-center">
              <p className="text-sm text-gray-600">
                No vulnerabilities found in refs/heads/ branches.
              </p>
              <button
                onClick={() => setShowAllBranches(true)}
                className="mt-3 text-sm text-blue-600 hover:text-blue-800 underline"
              >
                Show all branches
              </button>
            </div>
          </section>
        );
      }
      return null;
    }

    // Group results by branch
    const branchGroups = groupByBranch(branchFilteredOriginResults);
    
    // Sort branches with main/master first, then alphabetically
    const sortedBranches = Array.from(branchGroups.keys()).sort((a, b) => {
      const aIsMain = a.toLowerCase().includes('main') || a.toLowerCase().includes('master');
      const bIsMain = b.toLowerCase().includes('main') || b.toLowerCase().includes('master');
      
      // If one is main/master and the other isn't, prioritize main/master
      if (aIsMain && !bIsMain) return -1;
      if (!aIsMain && bIsMain) return 1;
      
      // Otherwise, sort alphabetically
      return a.localeCompare(b);
    });
    
    // Count distinct vulnerabilities (by vulnerability_filename)
    const distinctVulnerabilities = new Set(
      branchFilteredOriginResults.map(result => result.vulnerability_filename)
    );
    const distinctCount = distinctVulnerabilities.size;
    
    // Count filtered results
    const branchFilteredCount = filteredOriginResults ? filteredOriginResults.length - branchFilteredOriginResults.length : 0;

    return (
      <section className="mt-6 sm:mt-8 lg:mt-10 max-w-4xl mx-auto px-4 sm:px-0" role="region" aria-live="polite" aria-label="Search results">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100">
          {/* Header */}
          <header className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
                  Found {distinctCount} distinct {distinctCount === 1 ? 'vulnerability' : 'vulnerabilities'}
                </h2>
                <p className="mt-1 text-xs sm:text-sm text-gray-500">
                  Across {branchGroups.size} {branchGroups.size === 1 ? 'branch' : 'branches'}
                  {branchFilteredCount > 0 && ` (${branchFilteredCount} results filtered)`}
                </p>
              </div>
              
              {/* Branch filter checkbox */}
              <label className="flex items-center gap-2 text-xs sm:text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showAllBranches}
                  onChange={(e) => setShowAllBranches(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Show all branches</span>
              </label>
            </div>
          </header>

          {/* Branch Groups - Scrollable on small screens */}
          <div className="divide-y divide-gray-200 overflow-x-auto" role="list">
            {sortedBranches.map((branchName) => {
              const branchResults = branchGroups.get(branchName)!;
              
              return (
                <article key={branchName} className="px-4 sm:px-6 py-3 sm:py-4" role="listitem">
                  {/* Branch Header */}
                  <header className="flex flex-wrap items-center gap-2 mb-3 sm:mb-4">
                    <svg
                      className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400 flex-shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"
                      />
                    </svg>
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 break-all">
                      {branchName}
                    </h3>
                    <span className="px-2 py-0.5 sm:py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium" aria-label={`${branchResults.length} vulnerabilities in this branch`}>
                      {branchResults.length} {branchResults.length === 1 ? 'vuln' : 'vulns'}
                    </span>
                  </header>

                  {/* Vulnerabilities in this branch */}
                  <ul className="ml-0 sm:ml-7 space-y-3 sm:space-y-4" role="list">
                    {branchResults.map((result, index) => (
                      <li
                        key={index}
                        className={`border-l-4 ${getBorderColorClass(result.severity)} pl-3 sm:pl-4 py-2 hover:bg-gray-50 transition-colors rounded-r`}
                      >
                        {/* Vulnerability Filename - Clickable */}
                        <button
                          onClick={() => handleCVEClick(result.vulnerability_filename)}
                          className="group flex items-center text-left w-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded px-2 py-1 -mx-2 -my-1"
                          aria-label={`View details for ${result.vulnerability_filename}`}
                        >
                          <span className="text-sm sm:text-base font-medium text-blue-600 group-hover:text-blue-800 group-hover:underline group-focus:underline break-all">
                            {(result.vulnerability_filename.split('/').pop() || result.vulnerability_filename).replace(/\.json$/, '')}
                          </span>
                          <svg
                            className="ml-2 h-3 w-3 sm:h-4 sm:w-4 text-blue-600 group-hover:text-blue-800 flex-shrink-0"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            aria-hidden="true"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                        </button>

                        {/* Severity Badge */}
                        {result.severity && (
                          <div className="mt-2">
                            <SeverityBadge 
                              severity={result.severity} 
                              cvssScore={result.cvssScore}
                              size="sm"
                            />
                          </div>
                        )}

                        {/* Revision ID */}
                        <div className="mt-2 text-xs sm:text-sm text-gray-600">
                          <span className="font-medium">Revision ID:</span>
                          <code className="ml-2 px-1.5 sm:px-2 py-0.5 sm:py-1 bg-gray-100 text-gray-800 rounded text-xs font-mono break-all">
                            {result.revision_id}
                          </code>
                        </div>

                        {/* Origin (shown for context) - Scrollable on overflow */}
                        <div className="mt-1 text-xs text-gray-500 overflow-x-auto">
                          <span className="font-medium">Origin:</span>
                          <span className="ml-2 break-all">{result.origin}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>
        </div>
      </section>
    );
  };

  // Render appropriate results based on what's provided
  return (
    <>
      {/* Filter Controls (Requirement: 13.1) */}
      {(commitResults || originResults) && totalCount > 0 && (
        <div className="mt-6 sm:mt-8 lg:mt-10 max-w-4xl mx-auto px-4 sm:px-0">
          <FilterControls
            filters={filters}
            onFilterChange={handleFilterChange}
            onClearFilters={handleClearFilters}
            filteredCount={filteredCount}
            totalCount={totalCount}
            availableCVEs={availableCVEs}
            availableBranches={availableBranches}
          />
        </div>
      )}
      
      {/* Handle empty filtered results (Requirement: 13.6) */}
      {filteredCount === 0 && totalCount > 0 && (
        <div className="mt-4 max-w-3xl mx-auto px-4 sm:px-0" role="region" aria-live="polite" aria-label="Search results">
          <div className="bg-white rounded-lg shadow p-4 sm:p-6 text-center">
            <svg
              className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
              />
            </svg>
            <h3 className="mt-2 text-sm sm:text-base font-medium text-gray-900">No matching results</h3>
            <p className="mt-1 text-xs sm:text-sm text-gray-500">
              Try adjusting your filters to see more results.
            </p>
          </div>
        </div>
      )}
      
      {commitResults && renderCommitResults()}
      {originResults && renderOriginResults()}
    </>
  );
}
