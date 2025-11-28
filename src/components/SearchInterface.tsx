/**
 * Search Interface Component
 * Provides dual-mode search UI for commit ID and origin URL queries
 * Requirements: 6.1, 6.2, 6.5
 */

import { useState, type FormEvent, type ChangeEvent } from 'react';
import { 
  detectSearchMode, 
  isValidCommitId, 
  isValidOriginUrl, 
  sanitizeInput,
  getValidationErrorMessage,
  type SearchMode 
} from '../lib/searchUtils';

export interface SearchInterfaceProps {
  onSearch: (query: string, mode: SearchMode) => void;
  loading?: boolean;
  error?: string | null;
}

export function SearchInterface({ onSearch, loading = false, error = null }: SearchInterfaceProps) {
  const [query, setQuery] = useState('');
  const [detectedMode, setDetectedMode] = useState<SearchMode>('origin');
  const [validationError, setValidationError] = useState<string | null>(null);

  /**
   * Handles input change and updates detected mode
   */
  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    
    // Clear validation error when user types
    setValidationError(null);
    
    // Detect and update search mode
    if (value.trim()) {
      const mode = detectSearchMode(value);
      setDetectedMode(mode);
    }
  };

  /**
   * Validates input based on detected mode
   */
  const validateInput = (input: string, mode: SearchMode): boolean => {
    const trimmedInput = input.trim();
    
    if (!trimmedInput) {
      setValidationError('Please enter a commit ID or repository URL');
      return false;
    }
    
    if (mode === 'commit') {
      if (!isValidCommitId(trimmedInput)) {
        setValidationError(getValidationErrorMessage(trimmedInput, mode));
        return false;
      }
    } else {
      if (!isValidOriginUrl(trimmedInput)) {
        setValidationError(getValidationErrorMessage(trimmedInput, mode));
        return false;
      }
    }
    
    return true;
  };

  /**
   * Handles form submission
   */
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // Sanitize input
    const sanitizedQuery = sanitizeInput(query);
    
    // Validate input
    if (!validateInput(sanitizedQuery, detectedMode)) {
      return;
    }
    
    // Clear errors and trigger search
    setValidationError(null);
    onSearch(sanitizedQuery, detectedMode);
  };

  return (
    <section className="w-full max-w-3xl mx-auto px-4 sm:px-6 py-4 sm:py-6" role="search" aria-label="Vulnerability search">
      <header className="mb-6 sm:mb-8 text-center">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-2">
          Vulnerability Fork Lookup
        </h1>
        <p className="text-sm sm:text-base text-gray-600">
          Search for one-day vulnerabilities in forked repositories
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4" role="search">
        {/* Search Input */}
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={handleInputChange}
            placeholder="Enter commit ID (SHA) or repository URL"
            aria-label="Search by commit ID or repository URL"
            disabled={loading}
            className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-base sm:text-lg border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
          
          {/* Mode Indicator */}
          {query.trim() && (
            <div className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2">
              <span 
                className={`px-2 sm:px-3 py-0.5 sm:py-1 text-xs sm:text-sm font-medium rounded-full ${
                  detectedMode === 'commit' 
                    ? 'bg-purple-100 text-purple-700' 
                    : 'bg-blue-100 text-blue-700'
                }`}
                aria-label={`Search mode: ${detectedMode}`}
              >
                <span className="hidden sm:inline">{detectedMode === 'commit' ? 'Commit ID' : 'Repository URL'}</span>
                <span className="sm:hidden">{detectedMode === 'commit' ? 'Commit' : 'Repo'}</span>
              </span>
            </div>
          )}
        </div>

        {/* Search Button */}
        <button
          type="submit"
          disabled={loading || !query.trim()}
          aria-label="Execute vulnerability search"
          className="w-full px-4 sm:px-6 py-2.5 sm:py-3 text-base sm:text-lg font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (
            <span className="flex items-center justify-center">
              <svg 
                className="animate-spin -ml-1 mr-2 sm:mr-3 h-4 w-4 sm:h-5 sm:w-5 text-white" 
                xmlns="http://www.w3.org/2000/svg" 
                fill="none" 
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle 
                  className="opacity-25" 
                  cx="12" 
                  cy="12" 
                  r="10" 
                  stroke="currentColor" 
                  strokeWidth="4"
                />
                <path 
                  className="opacity-75" 
                  fill="currentColor" 
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Searching...
            </span>
          ) : (
            'Search'
          )}
        </button>

        {/* Example Searches */}
        {!query.trim() && !loading && (
          <aside className="text-xs sm:text-sm text-gray-500 space-y-1" aria-label="Example searches">
            <p className="font-medium">Example searches:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li className="break-all">Commit ID: <code className="bg-gray-100 px-1.5 sm:px-2 py-0.5 rounded text-xs">a1b2c3d4e5f6...</code></li>
              <li className="break-all">Repository: <code className="bg-gray-100 px-1.5 sm:px-2 py-0.5 rounded text-xs">https://github.com/user/repo</code></li>
            </ul>
          </aside>
        )}
      </form>

      {/* Validation Error Display */}
      {validationError && (
        <div 
          className="mt-3 sm:mt-4 p-3 sm:p-4 bg-red-50 border border-red-200 rounded-lg"
          role="alert"
          aria-live="polite"
        >
          <div className="flex items-start">
            <svg 
              className="w-4 h-4 sm:w-5 sm:h-5 text-red-600 mt-0.5 mr-2 sm:mr-3 flex-shrink-0" 
              fill="currentColor" 
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <path 
                fillRule="evenodd" 
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" 
                clipRule="evenodd" 
              />
            </svg>
            <div className="flex-1 min-w-0">
              <h3 className="text-xs sm:text-sm font-medium text-red-800">Validation Error</h3>
              <p className="text-xs sm:text-sm text-red-700 mt-1 break-words">{validationError}</p>
            </div>
          </div>
        </div>
      )}

      {/* Query Error Display */}
      {error && (
        <div 
          className="mt-3 sm:mt-4 p-3 sm:p-4 bg-red-50 border border-red-200 rounded-lg"
          role="alert"
          aria-live="polite"
        >
          <div className="flex items-start">
            <svg 
              className="w-4 h-4 sm:w-5 sm:h-5 text-red-600 mt-0.5 mr-2 sm:mr-3 flex-shrink-0" 
              fill="currentColor" 
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <path 
                fillRule="evenodd" 
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" 
                clipRule="evenodd" 
              />
            </svg>
            <div className="flex-1 min-w-0">
              <h3 className="text-xs sm:text-sm font-medium text-red-800">Search Error</h3>
              <p className="text-xs sm:text-sm text-red-700 mt-1 break-words">{error}</p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
