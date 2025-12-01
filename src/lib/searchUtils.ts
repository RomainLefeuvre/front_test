/**
 * Search utility functions
 * Handles search mode detection and input validation
 * Requirements: 6.3, 1.3, 2.4
 */

export type SearchMode = 'commit' | 'origin';

/**
 * Detects the search mode based on input pattern
 * Uses regex to identify commit ID (40 or 64 hex chars) vs origin URL patterns
 * Supports SWHIDs (Software Heritage Identifiers) like swh:1:rev:HASH
 * 
 * @param input - User input string
 * @returns 'commit' for commit IDs, 'origin' for repository URLs
 */
export function detectSearchMode(input: string): SearchMode {
  const trimmedInput = input.trim();
  
  // SWHID pattern: swh:1:rev:HASH
  const swhidPattern = /^swh:1:rev:[a-f0-9]{40}$/i;
  
  // Commit ID: 40-character hex string (SHA-1) or 64-character (SHA-256)
  const commitPattern = /^[a-f0-9]{40}([a-f0-9]{24})?$/i;
  
  // Origin URL: http(s)://... or git@...
  const originPattern = /^(https?:\/\/|git@)/i;
  
  if (swhidPattern.test(trimmedInput) || commitPattern.test(trimmedInput)) {
    return 'commit';
  } else if (originPattern.test(trimmedInput)) {
    return 'origin';
  }
  
  // Default to origin for ambiguous cases
  return 'origin';
}

/**
 * Validates commit ID format
 * Accepts both plain SHA hashes and SWHIDs
 * 
 * @param commitId - Commit ID to validate
 * @returns true if valid, false otherwise
 */
export function isValidCommitId(commitId: string): boolean {
  const trimmedInput = commitId.trim();
  
  // SWHID pattern: swh:1:rev:HASH
  const swhidPattern = /^swh:1:rev:[a-f0-9]{40}$/i;
  
  // Plain commit hash: 40 or 64 hex characters
  const commitPattern = /^[a-f0-9]{40}([a-f0-9]{24})?$/i;
  
  return swhidPattern.test(trimmedInput) || commitPattern.test(trimmedInput);
}

/**
 * Converts a commit SHA to a SWHID if it's not already one
 * 
 * @param commitId - Commit ID (SHA or SWHID)
 * @returns SWHID format (swh:1:rev:HASH)
 */
export function toSWHID(commitId: string): string {
  const trimmedInput = commitId.trim();
  
  // If already a SWHID, return as-is
  if (trimmedInput.startsWith('swh:1:rev:')) {
    return trimmedInput;
  }
  
  // Otherwise, add the SWHID prefix
  return `swh:1:rev:${trimmedInput}`;
}

/**
 * Validates origin URL format
 * 
 * @param originUrl - Origin URL to validate
 * @returns true if valid, false otherwise
 */
export function isValidOriginUrl(originUrl: string): boolean {
  const trimmedInput = originUrl.trim();
  
  // Check for http(s):// or git@ prefix
  const originPattern = /^(https?:\/\/|git@)/i;
  if (!originPattern.test(trimmedInput)) {
    return false;
  }
  
  // Additional validation: should contain domain-like structure
  // For http(s)://, check for domain after protocol
  if (trimmedInput.startsWith('http')) {
    const urlPattern = /^https?:\/\/[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}/i;
    return urlPattern.test(trimmedInput);
  }
  
  // For git@, check for domain after @
  if (trimmedInput.startsWith('git@')) {
    const gitPattern = /^git@[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}/i;
    return gitPattern.test(trimmedInput);
  }
  
  return false;
}

/**
 * Sanitizes user input for security
 * Removes potentially dangerous characters and patterns
 * 
 * @param input - User input to sanitize
 * @returns Sanitized input string
 */
export function sanitizeInput(input: string): string {
  // Trim whitespace
  let sanitized = input.trim();
  
  // Remove any null bytes
  sanitized = sanitized.replace(/\0/g, '');
  
  // Remove any control characters except newlines/tabs (though we don't expect them)
  sanitized = sanitized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
  
  return sanitized;
}

/**
 * Extracts just the filename from a vulnerability path
 * Removes directory prefixes like "osv-output/" or "nvd_cve/"
 * 
 * @param vulnerabilityFilename - Full path like "osv-output/CVE-2021-21394.json"
 * @returns Just the filename like "CVE-2021-21394.json"
 */
export function getDisplayFilename(vulnerabilityFilename: string): string {
  // Extract just the filename from paths like "osv-output/CVE-2021-21394.json"
  return vulnerabilityFilename.split('/').pop() || vulnerabilityFilename;
}

/**
 * Gets a user-friendly error message for invalid input
 * 
 * @param input - User input
 * @param mode - Detected search mode
 * @returns Error message string
 */
export function getValidationErrorMessage(input: string, mode: SearchMode): string {
  if (!input || input.trim().length === 0) {
    return 'Please enter a commit ID or repository URL';
  }
  
  if (mode === 'commit') {
    return 'Invalid commit ID format. Expected 40 hexadecimal characters or SWHID format (e.g., swh:1:rev:a1b2c3d4...)';
  } else {
    return 'Invalid repository URL format. Expected format: https://github.com/user/repo or git@github.com:user/repo.git';
  }
}
