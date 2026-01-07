/**
 * CVE Detail Viewer Component
 * Displays detailed CVE information in OSV format
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */

import { useEffect, useState } from 'react';
import type { CVEEntry } from '../types';
import { interpretCVSSScore, isCVSSVector, calculateCVSSv3Score } from '../lib/cvssUtils';

export interface CVEViewerProps {
  vulnerabilityFilename: string | null;
  onClose: () => void;
  onLoadCVE: (filename: string) => Promise<CVEEntry>;
}

export function CVEViewer({ vulnerabilityFilename, onClose, onLoadCVE }: CVEViewerProps) {
  const [cveData, setCveData] = useState<CVEEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load CVE data when vulnerabilityFilename changes
   */
  useEffect(() => {
    if (!vulnerabilityFilename) {
      setCveData(null);
      setError(null);
      return;
    }

    const loadCVE = async () => {
      setLoading(true);
      setError(null);
      setCveData(null);

      try {
        const data = await onLoadCVE(vulnerabilityFilename);
        setCveData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    };

    loadCVE();
  }, [vulnerabilityFilename, onLoadCVE]);

  /**
   * Handle retry button click
   */
  const handleRetry = () => {
    if (vulnerabilityFilename) {
      const loadCVE = async () => {
        setLoading(true);
        setError(null);
        setCveData(null);

        try {
          const data = await onLoadCVE(vulnerabilityFilename);
          setCveData(data);
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        } finally {
          setLoading(false);
        }
      };

      loadCVE();
    }
  };

  /**
   * Handle escape key to close modal
   */
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && vulnerabilityFilename) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [vulnerabilityFilename, onClose]);

  // Don't render if no vulnerability selected
  if (!vulnerabilityFilename) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
    >
      {/* Background overlay */}
      <div
        className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal panel */}
      <div className="flex min-h-full items-center justify-center p-2 sm:p-4">
        <div className="relative transform overflow-hidden rounded-lg bg-white shadow-xl transition-all w-full max-w-4xl mx-2 sm:mx-4">
          {/* Header */}
          <div className="bg-white px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h3
                  className="text-base sm:text-lg font-semibold text-gray-900 break-all"
                  id="modal-title"
                >
                  {cveData?.id || vulnerabilityFilename}
                </h3>
                <p className="mt-1 text-xs sm:text-sm text-gray-500 break-all">
                  {vulnerabilityFilename}
                </p>
              </div>
              <button
                type="button"
                className="flex-shrink-0 rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 p-1"
                onClick={onClose}
                aria-label="Close CVE details"
              >
                <span className="sr-only">Close</span>
                <svg
                  className="h-5 w-5 sm:h-6 sm:w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="bg-white px-4 sm:px-6 py-3 sm:py-4 max-h-[60vh] sm:max-h-[70vh] overflow-y-auto">
            {/* Loading State */}
            {loading && (
              <div className="flex flex-col sm:flex-row items-center justify-center py-8 sm:py-12 gap-3">
                <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-blue-600" />
                <span className="text-sm sm:text-base text-gray-600">Loading CVE details...</span>
              </div>
            )}

            {/* Error State */}
            {error && !loading && (
              <div className="rounded-md bg-red-50 p-3 sm:p-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-5 w-5 text-red-400"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xs sm:text-sm font-medium text-red-800">
                      Failed to load CVE details
                    </h3>
                    <div className="mt-2 text-xs sm:text-sm text-red-700">
                      <p className="break-words">{error}</p>
                      <p className="mt-2 break-all">
                        <strong>Vulnerability file:</strong> {vulnerabilityFilename.split('/').pop() || vulnerabilityFilename}
                      </p>
                    </div>
                    <div className="mt-3 sm:mt-4">
                      <button
                        type="button"
                        onClick={handleRetry}
                        className="rounded-md bg-red-50 px-3 py-2 text-xs sm:text-sm font-semibold text-red-800 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2"
                        aria-label="Retry loading CVE details"
                      >
                        Retry
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* CVE Data Display */}
            {cveData && !loading && !error && (
              <div className="space-y-4 sm:space-y-6">
                {/* Summary */}
                <div>
                  <h4 className="text-xs sm:text-sm font-semibold text-gray-900 mb-2">Summary</h4>
                  <p className="text-xs sm:text-sm text-gray-700 break-words">{cveData.summary}</p>
                </div>

                {/* Details */}
                <div>
                  <h4 className="text-xs sm:text-sm font-semibold text-gray-900 mb-2">Details</h4>
                  <p className="text-xs sm:text-sm text-gray-700 whitespace-pre-wrap break-words">{cveData.details}</p>
                </div>

                {/* Severity */}
                {cveData.severity && cveData.severity.length > 0 && (
                  <div>
                    <h4 className="text-xs sm:text-sm font-semibold text-gray-900 mb-2">Severity</h4>
                    <div className="space-y-2">
                      {cveData.severity.map((sev, index) => {
                        // Check if the score is a CVSS vector or a numeric score
                        const isVector = isCVSSVector(sev.score);
                        
                        // Calculate score from vector or parse numeric score
                        let numericScore: number | null = null;
                        if (isVector) {
                          numericScore = calculateCVSSv3Score(sev.score);
                        } else {
                          const parsed = parseFloat(sev.score);
                          numericScore = !isNaN(parsed) ? parsed : null;
                        }
                        
                        const interpretation = numericScore !== null ? interpretCVSSScore(numericScore) : null;
                        
                        return (
                          <div
                            key={index}
                            className="flex flex-col gap-2 bg-gray-50 rounded-md p-2 sm:p-3"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                              <span className="text-xs sm:text-sm font-medium text-gray-700">{sev.type}:</span>
                              {interpretation && (
                                <div className="flex items-center gap-2 flex-wrap">
                                  {numericScore !== null && (
                                    <span className={`px-2 sm:px-3 py-1 ${interpretation.bgColor} ${interpretation.textColor} rounded-md text-xs sm:text-sm font-semibold inline-block w-fit`}>
                                      {numericScore.toFixed(2)}
                                    </span>
                                  )}
                                  <span className={`px-2 sm:px-3 py-1 ${interpretation.bgColor} ${interpretation.textColor} rounded-md text-xs sm:text-sm font-bold inline-block w-fit border-2 border-current`}>
                                    {interpretation.label}
                                  </span>
                                </div>
                              )}
                            </div>
                            {isVector && (
                              <details className="text-xs">
                                <summary className="cursor-pointer text-gray-600 hover:text-gray-800 font-medium">
                                  Show CVSS Vector
                                </summary>
                                <div className="mt-1 font-mono text-gray-600 break-all bg-white rounded px-2 py-1">
                                  {sev.score}
                                </div>
                              </details>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Affected Packages */}
                {cveData.affected && cveData.affected.length > 0 && (
                  <div>
                    <h4 className="text-xs sm:text-sm font-semibold text-gray-900 mb-2">Affected Packages</h4>
                    <div className="space-y-3 sm:space-y-4">
                      {cveData.affected.map((affected, index) => (
                        <div key={index} className="bg-gray-50 rounded-md p-3 sm:p-4">
                          {/* Package Info */}
                          {affected.package && (
                            <div className="mb-2 sm:mb-3">
                              <div className="text-xs sm:text-sm flex flex-wrap items-center gap-2">
                                {affected.package.ecosystem && (
                                  <span className="inline-flex items-center px-2 py-0.5 sm:py-1 rounded-md bg-blue-100 text-blue-800 text-xs font-medium">
                                    {affected.package.ecosystem}
                                  </span>
                                )}
                                {affected.package.name && (
                                  <span className="font-medium text-gray-900 break-all">
                                    {affected.package.name}
                                  </span>
                                )}
                              </div>
                              {affected.package.purl && (
                                <div className="mt-1 text-xs text-gray-600 font-mono break-all">
                                  {affected.package.purl}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Version Ranges */}
                          {affected.ranges && affected.ranges.length > 0 && (
                            <div className="mb-2">
                              <div className="text-xs font-semibold text-gray-700 mb-1">
                                Version Ranges:
                              </div>
                              {affected.ranges.map((range, rangeIndex) => (
                                <div key={rangeIndex} className="ml-2 mb-2">
                                  {range.type && (
                                    <div className="text-xs text-gray-600">
                                      Type: {range.type}
                                    </div>
                                  )}
                                  {range.repo && (
                                    <div className="text-xs text-gray-600">
                                      Repo: {range.repo}
                                    </div>
                                  )}
                                  {range.events && range.events.length > 0 && (
                                    <div className="mt-1 space-y-1">
                                      {range.events.map((event, eventIndex) => (
                                        <div
                                          key={eventIndex}
                                          className="text-xs bg-white rounded px-2 py-1"
                                        >
                                          {event.introduced && (
                                            <div>
                                              <span className="font-medium">Introduced:</span>{' '}
                                              {range.type === 'GIT' && event.introduced !== '0' ? (
                                                <a
                                                  href={`https://archive.softwareheritage.org/browse/revision/${event.introduced}/#swh-revision-changes`}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="text-blue-600 hover:text-blue-800 underline break-all"
                                                >
                                                  {event.introduced}
                                                </a>
                                              ) : (
                                                <span>{event.introduced}</span>
                                              )}
                                            </div>
                                          )}
                                          {event.fixed && (
                                            <div>
                                              <span className="font-medium">Fixed:</span>{' '}
                                              {range.type === 'GIT' && event.fixed !== '0' ? (
                                                <a
                                                  href={`https://archive.softwareheritage.org/browse/revision/${event.fixed}/#swh-revision-changes`}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="text-blue-600 hover:text-blue-800 underline break-all"
                                                >
                                                  {event.fixed}
                                                </a>
                                              ) : (
                                                <span>{event.fixed}</span>
                                              )}
                                            </div>
                                          )}
                                          {event.last_affected && (
                                            <div>
                                              <span className="font-medium">Last Affected:</span>{' '}
                                              {range.type === 'GIT' && event.last_affected !== '0' ? (
                                                <a
                                                  href={`https://archive.softwareheritage.org/browse/revision/${event.last_affected}/#swh-revision-changes`}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="text-blue-600 hover:text-blue-800 underline break-all"
                                                >
                                                  {event.last_affected}
                                                </a>
                                              ) : (
                                                <span>{event.last_affected}</span>
                                              )}
                                            </div>
                                          )}
                                          {event.limit && (
                                            <div>
                                              <span className="font-medium">Limit:</span>{' '}
                                              {range.type === 'GIT' && event.limit !== '0' ? (
                                                <a
                                                  href={`https://archive.softwareheritage.org/browse/revision/${event.limit}/#swh-revision-changes`}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="text-blue-600 hover:text-blue-800 underline break-all"
                                                >
                                                  {event.limit}
                                                </a>
                                              ) : (
                                                <span>{event.limit}</span>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Specific Versions - Hidden per user request */}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* References */}
                {cveData.references && cveData.references.length > 0 && (
                  <div>
                    <h4 className="text-xs sm:text-sm font-semibold text-gray-900 mb-2">References</h4>
                    <div className="space-y-2">
                      {cveData.references.map((ref, index) => (
                        <div key={index} className="flex flex-col sm:flex-row sm:items-start gap-2">
                          <span className="inline-flex items-center px-2 py-0.5 sm:py-1 rounded-md bg-gray-100 text-gray-700 text-xs font-medium w-fit">
                            {ref.type}
                          </span>
                          <a
                            href={ref.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs sm:text-sm text-blue-600 hover:text-blue-800 hover:underline break-all"
                          >
                            {ref.url}
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Dates */}
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-6 text-xs text-gray-600 pt-3 sm:pt-4 border-t border-gray-200">
                  {cveData.published && (
                    <div>
                      <span className="font-medium">Published:</span>{' '}
                      {new Date(cveData.published).toLocaleDateString()}
                    </div>
                  )}
                  {cveData.modified && (
                    <div>
                      <span className="font-medium">Modified:</span>{' '}
                      {new Date(cveData.modified).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-4 sm:px-6 py-3 sm:py-4 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md bg-white px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              aria-label="Close CVE details modal"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
