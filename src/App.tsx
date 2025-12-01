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
    <div className="min-h-screen bg-white">
      {/* Header with title and navigation */}
      <header className="bg-white border-b-2 border-gray-100">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="flex flex-col gap-4">
            {/* Logo row */}
            <div className="flex items-center justify-between flex-wrap gap-4">
              {/* Software Heritage Logo */}
              <a 
                href="https://www.softwareheritage.org" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center hover:opacity-80 transition-opacity"
                aria-label="Software Heritage"
              >
                <img 
                  src="/logos/software-heritage.svg" 
                  alt="Software Heritage" 
                  className="h-12 sm:h-14 w-auto"
                />
              </a>
              
              {/* Partner logos */}
              <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
                {/* DiverSE Logo */}
                <a 
                  href="https://www.diverse-team.fr" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="hover:opacity-80 transition-opacity"
                  aria-label="DiverSE Team"
                >
                  <img 
                    src="/logos/diverse.svg" 
                    alt="DiverSE" 
                    className="h-8 sm:h-9 w-auto"
                  />
                </a>
                
                {/* Inria Logo */}
                <a 
                  href="https://www.inria.fr" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="hover:opacity-80 transition-opacity"
                  aria-label="Inria"
                >
                  <img 
                    src="/logos/inria.svg" 
                    alt="Inria" 
                    className="h-6 sm:h-7 w-auto"
                  />
                </a>
                
                {/* IRISA Logo */}
                <a 
                  href="https://www.irisa.fr" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="hover:opacity-80 transition-opacity"
                  aria-label="IRISA"
                >
                  <img 
                    src="/logos/irisa.svg" 
                    alt="IRISA" 
                    className="h-8 sm:h-9 w-auto"
                  />
                </a>
                
                {/* Institut Polytechnique de Paris Logo */}
                <a 
                  href="https://www.ip-paris.fr" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="hover:opacity-80 transition-opacity"
                  aria-label="Institut Polytechnique de Paris"
                >
                  <img 
                    src="/logos/Institut_polytechnique_de_Paris_logo.png" 
                    alt="Institut Polytechnique de Paris" 
                    className="h-8 sm:h-9 w-auto"
                  />
                </a>
              </div>
            </div>
            
            {/* Title row */}
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 leading-tight">
                Did you forket it?
                <br />
                Global history analysis to detect one-day vulnerabilities in open source forks
              </h1>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12" role="main">
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

      {/* Footer */}
      <footer className="bg-gray-50 border-t-2 border-gray-100 mt-auto">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-center sm:text-left">
              <p className="text-sm text-gray-700">
                Powered by{' '}
                <a 
                  href="https://www.softwareheritage.org" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-orange-600 hover:text-orange-700 font-bold hover:underline transition-colors"
                >
                  Software Heritage
                </a>
              </p>
              <p className="text-xs text-gray-600 mt-1">
                Universal source code archive
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap justify-center sm:justify-end">
              <a 
                href="https://www.diverse-team.fr" 
                target="_blank" 
                rel="noopener noreferrer"
                className="hover:text-gray-700 transition-colors"
              >
                DiverSE
              </a>
              <span>•</span>
              <a 
                href="https://www.inria.fr" 
                target="_blank" 
                rel="noopener noreferrer"
                className="hover:text-gray-700 transition-colors"
              >
                Inria
              </a>
              <span>•</span>
              <a 
                href="https://www.irisa.fr" 
                target="_blank" 
                rel="noopener noreferrer"
                className="hover:text-gray-700 transition-colors"
              >
                IRISA
              </a>
              <span>•</span>
              <a 
                href="https://www.ip-paris.fr" 
                target="_blank" 
                rel="noopener noreferrer"
                className="hover:text-gray-700 transition-colors"
              >
                IP Paris
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
