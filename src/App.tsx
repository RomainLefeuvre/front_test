/**
 * Main Application Component
 * Integrates search interface with query engine
 * Requirements: 6.1, 6.2, 1.1, 2.1, 3.4, 4.5
 */

import { useState, useEffect, lazy, Suspense } from 'react';
import { SearchInterface } from './components/SearchInterface';
import { ResultsDisplay } from './components/ResultsDisplay';
import { About } from './components/About';
import { queryEngine } from './lib/queryEngine';
import { loadConfig } from './lib/config';
import type { SearchMode } from './lib/searchUtils';
import type { VulnerabilityResult, OriginVulnerabilityResult, CVEEntry } from './types';
import './App.css';

// Lazy load CVE viewer for code splitting (Requirement 4.5)
const CVEViewer = lazy(() => import('./components/CVEViewer').then(module => ({ default: module.CVEViewer })));

function App() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [commitResults, setCommitResults] = useState<VulnerabilityResult[] | null>(null);
  const [originResults, setOriginResults] = useState<OriginVulnerabilityResult[] | null>(null);
  const [selectedCVE, setSelectedCVE] = useState<string | null>(null);
  const [initializationProgress, setInitializationProgress] = useState<{
    stage: string;
    progress: number;
  } | null>(null);

  /**
   * Set up initialization progress callback on mount
   */
  useEffect(() => {
    queryEngine.setProgressCallback((stage, progress) => {
      setInitializationProgress({ stage, progress });
      
      // Clear progress indicator when complete
      if (progress === 100) {
        setTimeout(() => setInitializationProgress(null), 1000);
      }
    });

    return () => {
      queryEngine.setProgressCallback(null);
    };
  }, []);

  /**
   * Handles search submission
   * Executes appropriate query based on search mode
   * Performs lazy initialization on first query
   */
  const handleSearch = async (query: string, mode: SearchMode) => {
    // Clear previous results and errors
    setError(null);
    setCommitResults(null);
    setOriginResults(null);
    setLoading(true);

    try {
      const config = loadConfig();

      if (mode === 'commit') {
        // Convert SHA to SWHID if needed
        const { toSWHID } = await import('./lib/searchUtils');
        const swhid = toSWHID(query);
        
        // Query by commit ID (lazy initialization happens here)
        const results = await queryEngine.queryByCommitId(
          swhid,
          config.parquetPaths.vulnerableCommits,
          config.s3
        );
        setCommitResults(results);

        // Show message if no results found
        if (results.length === 0) {
          setError('No vulnerabilities found for this commit ID');
        }
      } else {
        // Query by origin URL (lazy initialization happens here)
        const results = await queryEngine.queryByOrigin(
          query,
          config.parquetPaths.vulnerableOrigins,
          config.s3
        );
        setOriginResults(results);

        // Show message if no results found
        if (results.length === 0) {
          setError('No vulnerabilities found for this repository');
        }
      }
    } catch (err) {
      setError(
        `Search failed: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handles CVE detail click
   * Opens the CVE viewer modal
   */
  const handleCVEClick = (vulnerabilityFilename: string) => {
    setSelectedCVE(vulnerabilityFilename);
  };

  /**
   * Handles closing the CVE viewer
   */
  const handleCloseCVE = () => {
    setSelectedCVE(null);
  };

  /**
   * Loads CVE data from the query engine
   * Performs lazy initialization if needed
   */
  const handleLoadCVE = async (vulnerabilityFilename: string): Promise<CVEEntry> => {
    const config = loadConfig();
    return await queryEngine.loadCVEData(
      vulnerabilityFilename,
      config.cvePath,
      config.s3
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with title and navigation */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 truncate">
                Vulnerability Fork Lookup
              </h1>
              <p className="text-xs sm:text-sm text-gray-600 mt-1">
                Track one-day vulnerabilities across 2.2M forked repositories
              </p>
            </div>
            <nav className="flex gap-3 sm:gap-4 flex-shrink-0">
              <a
                href="#search"
                className="text-sm sm:text-base text-gray-700 hover:text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded px-2 py-1"
                aria-label="Navigate to search"
              >
                Search
              </a>
              <a
                href="#about"
                className="text-sm sm:text-base text-gray-700 hover:text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded px-2 py-1"
                aria-label="Navigate to about section"
              >
                About
              </a>
            </nav>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8" role="main">
        {/* Search Section */}
        <div id="search">
          <SearchInterface
            onSearch={handleSearch}
            loading={loading}
            error={error}
          />

          {/* Initialization Progress Indicator */}
          {initializationProgress && (
            <div 
              className="max-w-3xl mx-auto px-4 sm:px-6 mt-4"
              role="status"
              aria-live="polite"
              aria-label="Database initialization progress"
            >
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-blue-900">
                    {initializationProgress.stage}
                  </span>
                  <span className="text-sm font-medium text-blue-700">
                    {initializationProgress.progress}%
                  </span>
                </div>
                <div className="w-full bg-blue-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${initializationProgress.progress}%` }}
                    aria-valuenow={initializationProgress.progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    role="progressbar"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Results Display */}
          <ResultsDisplay
            commitResults={commitResults}
            originResults={originResults}
            onCVEClick={handleCVEClick}
          />

          {/* CVE Detail Viewer - Lazy loaded for code splitting */}
          {selectedCVE && (
            <Suspense fallback={
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-500 bg-opacity-75">
                <div className="bg-white rounded-lg p-6 shadow-xl">
                  <div className="flex items-center gap-3">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                    <span className="text-gray-700">Loading CVE viewer...</span>
                  </div>
                </div>
              </div>
            }>
              <CVEViewer
                vulnerabilityFilename={selectedCVE}
                onClose={handleCloseCVE}
                onLoadCVE={handleLoadCVE}
              />
            </Suspense>
          )}
        </div>

        {/* About Section */}
        <About />
      </main>
    </div>
  );
}

export default App;
