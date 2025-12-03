/**
 * Property-based tests for Search Utilities
 * Tests correctness properties for search mode detection and input validation
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { 
  detectSearchMode, 
  isValidCommitId, 
  isValidOriginUrl,
  sanitizeInput,
  getValidationErrorMessage,
  type SearchMode 
} from './searchUtils';

describe('Search Utils - Property-Based Tests', () => {
  // Feature: vuln-fork-lookup, Property 8: Search mode feedback
  // Validates: Requirements 6.3
  it('should detect and indicate the appropriate search mode based on input pattern', () => {
    fc.assert(
      fc.property(
        // Generate various input patterns
        fc.oneof(
          // Valid commit IDs (40-character SHA-1)
          fc.stringMatching(/^[a-f0-9]{40}$/),
          // Valid commit IDs (64-character SHA-256)
          fc.stringMatching(/^[a-f0-9]{64}$/),
          // Valid HTTPS URLs
          fc.stringMatching(/^https:\/\/github\.com\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/),
          fc.stringMatching(/^https:\/\/gitlab\.com\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/),
          fc.stringMatching(/^http:\/\/github\.com\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/),
          // Valid git@ URLs
          fc.stringMatching(/^git@github\.com:[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+\.git$/),
          fc.stringMatching(/^git@gitlab\.com:[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+\.git$/),
          // Ambiguous inputs (should default to origin)
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => 
            // Filter out strings that match commit or origin patterns
            !/^[a-f0-9]{40}([a-f0-9]{24})?$/i.test(s.trim()) &&
            !/^(https?:\/\/|git@)/i.test(s.trim())
          )
        ),
        (input) => {
          // Property 8: The system should detect and indicate the appropriate search mode
          
          const detectedMode = detectSearchMode(input);
          
          // Verify the mode is one of the valid values
          expect(['commit', 'origin']).toContain(detectedMode);
          
          const trimmedInput = input.trim();
          
          // Verify commit ID detection
          if (/^[a-f0-9]{40}([a-f0-9]{24})?$/i.test(trimmedInput)) {
            // Input matches commit ID pattern (40 or 64 hex chars)
            expect(detectedMode).toBe('commit');
          }
          
          // Verify origin URL detection
          if (/^(https?:\/\/|git@)/i.test(trimmedInput)) {
            // Input matches origin URL pattern (starts with http(s):// or git@)
            expect(detectedMode).toBe('origin');
          }
          
          // Verify ambiguous inputs default to origin
          if (!/^[a-f0-9]{40}([a-f0-9]{24})?$/i.test(trimmedInput) &&
              !/^(https?:\/\/|git@)/i.test(trimmedInput)) {
            // Input doesn't match either pattern, should default to origin
            expect(detectedMode).toBe('origin');
          }
          
          // Verify the detected mode is consistent with validation functions
          if (detectedMode === 'commit') {
            // If detected as commit, it should match the commit pattern
            expect(trimmedInput).toMatch(/^[a-f0-9]{40}([a-f0-9]{24})?$/i);
          }
          
          if (detectedMode === 'origin' && /^(https?:\/\/|git@)/i.test(trimmedInput)) {
            // If detected as origin and starts with URL prefix, it should match origin pattern
            expect(trimmedInput).toMatch(/^(https?:\/\/|git@)/i);
          }
        }
      ),
      { numRuns: 100 } // Run 100 iterations as specified in design document
    );
  });

  // Additional property test: Mode detection should be whitespace-insensitive
  it('should detect the same mode regardless of leading/trailing whitespace', () => {
    fc.assert(
      fc.property(
        // Generate valid inputs
        fc.oneof(
          fc.stringMatching(/^[a-f0-9]{40}$/),
          fc.stringMatching(/^[a-f0-9]{64}$/),
          fc.stringMatching(/^https:\/\/github\.com\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/),
          fc.stringMatching(/^git@github\.com:[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+\.git$/),
        ),
        // Generate whitespace to add
        fc.record({
          leading: fc.array(fc.constantFrom(' ', '\t', '\n'), { maxLength: 5 }).map(arr => arr.join('')),
          trailing: fc.array(fc.constantFrom(' ', '\t', '\n'), { maxLength: 5 }).map(arr => arr.join('')),
        }),
        (input, whitespace) => {
          // Create input with whitespace
          const inputWithWhitespace = whitespace.leading + input + whitespace.trailing;
          
          // Property: Mode detection should be consistent regardless of whitespace
          const modeWithoutWhitespace = detectSearchMode(input);
          const modeWithWhitespace = detectSearchMode(inputWithWhitespace);
          
          expect(modeWithWhitespace).toBe(modeWithoutWhitespace);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Additional property test: Mode detection should be case-insensitive for hex strings
  it('should detect commit mode regardless of hex character case', () => {
    fc.assert(
      fc.property(
        // Generate valid commit IDs with mixed case
        fc.oneof(
          fc.stringMatching(/^[a-f0-9]{40}$/),
          fc.stringMatching(/^[A-F0-9]{40}$/),
          fc.stringMatching(/^[a-f0-9]{64}$/),
          fc.stringMatching(/^[A-F0-9]{64}$/),
        ),
        (commitId) => {
          // Property: Commit detection should be case-insensitive
          const mode = detectSearchMode(commitId);
          expect(mode).toBe('commit');
          
          // Test with opposite case
          const oppositeCase = commitId.split('').map(char => {
            if (char >= 'a' && char <= 'f') {
              return char.toUpperCase();
            } else if (char >= 'A' && char <= 'F') {
              return char.toLowerCase();
            }
            return char;
          }).join('');
          
          const modeOpposite = detectSearchMode(oppositeCase);
          expect(modeOpposite).toBe('commit');
        }
      ),
      { numRuns: 100 }
    );
  });

  // Unit tests for specific edge cases
  describe('Edge Cases', () => {
    it('should detect commit mode for valid 40-character SHA-1', () => {
      const sha1 = 'a1b2c3d4e5f6789012345678901234567890abcd';
      expect(detectSearchMode(sha1)).toBe('commit');
    });

    it('should detect commit mode for valid 64-character SHA-256', () => {
      const sha256 = 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456';
      expect(detectSearchMode(sha256)).toBe('commit');
    });

    it('should detect origin mode for HTTPS GitHub URL', () => {
      const url = 'https://github.com/user/repo';
      expect(detectSearchMode(url)).toBe('origin');
    });

    it('should detect origin mode for git@ URL', () => {
      const url = 'git@github.com:user/repo.git';
      expect(detectSearchMode(url)).toBe('origin');
    });

    it('should default to origin for ambiguous input', () => {
      const ambiguous = 'some random text';
      expect(detectSearchMode(ambiguous)).toBe('origin');
    });

    it('should default to origin for empty string', () => {
      expect(detectSearchMode('')).toBe('origin');
    });

    it('should handle whitespace-only input', () => {
      expect(detectSearchMode('   ')).toBe('origin');
    });

    it('should detect commit mode for SHA-1 with leading/trailing whitespace', () => {
      const sha1 = '  a1b2c3d4e5f6789012345678901234567890abcd  ';
      expect(detectSearchMode(sha1)).toBe('commit');
    });

    it('should detect origin mode for URL with leading/trailing whitespace', () => {
      const url = '  https://github.com/user/repo  ';
      expect(detectSearchMode(url)).toBe('origin');
    });

    it('should not detect commit mode for 39-character hex string', () => {
      const notCommit = 'a1b2c3d4e5f678901234567890123456789abc';
      expect(detectSearchMode(notCommit)).toBe('origin');
    });

    it('should not detect commit mode for 41-character hex string', () => {
      const notCommit = 'a1b2c3d4e5f6789012345678901234567890abcde';
      expect(detectSearchMode(notCommit)).toBe('origin');
    });

    it('should not detect commit mode for hex string with non-hex characters', () => {
      const notCommit = 'g1b2c3d4e5f6789012345678901234567890abcd';
      expect(detectSearchMode(notCommit)).toBe('origin');
    });
  });

  // Unit tests for validation functions
  describe('Validation Functions', () => {
    it('should validate correct commit IDs', () => {
      expect(isValidCommitId('a1b2c3d4e5f6789012345678901234567890abcd')).toBe(true);
      expect(isValidCommitId('a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456')).toBe(true);
    });

    it('should reject invalid commit IDs', () => {
      expect(isValidCommitId('not-a-commit')).toBe(false);
      expect(isValidCommitId('a1b2c3d4')).toBe(false);
      expect(isValidCommitId('')).toBe(false);
    });

    it('should validate correct origin URLs', () => {
      expect(isValidOriginUrl('https://github.com/user/repo')).toBe(true);
      expect(isValidOriginUrl('http://github.com/user/repo')).toBe(true);
      expect(isValidOriginUrl('git@github.com:user/repo.git')).toBe(true);
    });

    it('should reject invalid origin URLs', () => {
      expect(isValidOriginUrl('not-a-url')).toBe(false);
      expect(isValidOriginUrl('ftp://github.com/user/repo')).toBe(false);
      expect(isValidOriginUrl('')).toBe(false);
    });
  });

  // Unit tests for sanitization
  describe('Input Sanitization', () => {
    it('should remove leading and trailing whitespace', () => {
      expect(sanitizeInput('  test  ')).toBe('test');
    });

    it('should remove null bytes', () => {
      expect(sanitizeInput('test\0test')).toBe('testtest');
    });

    it('should remove control characters', () => {
      expect(sanitizeInput('test\x01test')).toBe('testtest');
    });

    it('should handle empty string', () => {
      expect(sanitizeInput('')).toBe('');
    });
  });

  // Unit tests for error messages
  describe('Validation Error Messages', () => {
    it('should provide appropriate error message for empty input', () => {
      const message = getValidationErrorMessage('', 'commit');
      expect(message).toContain('Please enter');
    });

    it('should provide appropriate error message for invalid commit', () => {
      const message = getValidationErrorMessage('invalid', 'commit');
      expect(message).toContain('commit ID');
      expect(message).toContain('40 hexadecimal');
    });

    it('should provide appropriate error message for invalid origin', () => {
      const message = getValidationErrorMessage('invalid', 'origin');
      expect(message).toContain('repository URL');
      expect(message).toContain('https://');
    });
  });
});
