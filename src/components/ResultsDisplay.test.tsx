/**
 * Property-based tests for Results Display Component
 * Tests correctness properties for vulnerability result rendering
 * 
 * Feature: vuln-fork-lookup, Property 3: Required fields presence in vulnerability display
 * Validates: Requirements 1.2, 2.2
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import * as fc from 'fast-check';
import { ResultsDisplay } from './ResultsDisplay';
import type { VulnerabilityResult, OriginVulnerabilityResult } from '../types';

describe('ResultsDisplay - Property-Based Tests', () => {
  // Feature: vuln-fork-lookup, Property 3: Required fields presence in vulnerability display
  // Validates: Requirements 1.2, 2.2
  it('should display all required fields for commit vulnerability results', () => {
    // Generator for VulnerabilityResult
    const vulnerabilityResultArbitrary = fc.record({
      revision_id: fc.oneof(
        fc.stringMatching(/^[a-f0-9]{40}$/),
        fc.stringMatching(/^[a-f0-9]{64}$/)
      ),
      category: fc.stringMatching(/^[A-Z_]+$/),
      vulnerability_filename: fc.stringMatching(/^(nvd_cve\/)?CVE-\d{4}-\d+\.json$/),
    });

    fc.assert(
      fc.property(
        // Generate an array of vulnerability results
        fc.array(vulnerabilityResultArbitrary, { minLength: 1, maxLength: 10 }),
        (commitResults) => {
          // Render the component with commit results
          const { container } = render(
            <ResultsDisplay commitResults={commitResults} />
          );

          // Property 3: For any vulnerability result, the rendered output should contain all required fields
          // Required fields for commit results: vulnerability_filename, category, revision_id
          
          const containerText = container.textContent || '';
          
          for (const result of commitResults) {
            // 1. Verify vulnerability_filename is present in the rendered output
            expect(containerText).toContain(result.vulnerability_filename);
            
            // 2. Verify category is present in the rendered output
            expect(containerText).toContain(result.category);
            
            // 3. Verify revision_id is present in the rendered output
            expect(containerText).toContain(result.revision_id);
          }
          
          // 4. Verify the count of results is displayed
          expect(containerText).toContain(`Found ${commitResults.length}`);
          
          // 5. Verify all required field labels are present
          expect(containerText).toContain('Category:');
          expect(containerText).toContain('Revision ID:');
        }
      ),
      { numRuns: 100 } // Run 100 iterations as specified in design document
    );
  });

  // Feature: vuln-fork-lookup, Property 3: Required fields presence in vulnerability display
  // Validates: Requirements 1.2, 2.2
  it('should display all required fields for origin vulnerability results', () => {
    // Generator for OriginVulnerabilityResult
    const originVulnerabilityResultArbitrary = fc.record({
      origin: fc.oneof(
        fc.stringMatching(/^https:\/\/github\.com\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/),
        fc.stringMatching(/^https:\/\/gitlab\.com\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/),
        fc.stringMatching(/^git@github\.com:[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+\.git$/),
      ),
      revision_id: fc.oneof(
        fc.stringMatching(/^[a-f0-9]{40}$/),
        fc.stringMatching(/^[a-f0-9]{64}$/)
      ),
      branch_name: fc.stringMatching(/^[a-zA-Z0-9_/-]+$/),
      vulnerability_filename: fc.stringMatching(/^(nvd_cve\/)?CVE-\d{4}-\d+\.json$/),
    });

    fc.assert(
      fc.property(
        // Generate an array of origin vulnerability results
        fc.array(originVulnerabilityResultArbitrary, { minLength: 1, maxLength: 10 }),
        (originResults) => {
          // Render the component with origin results
          const { container } = render(
            <ResultsDisplay originResults={originResults} />
          );

          // Property 3: For any vulnerability result, the rendered output should contain all required fields
          // Required fields for origin results: vulnerability_filename, revision_id, branch_name, origin
          
          const containerText = container.textContent || '';
          
          for (const result of originResults) {
            // 1. Verify vulnerability_filename is present in the rendered output
            expect(containerText).toContain(result.vulnerability_filename);
            
            // 2. Verify revision_id is present in the rendered output
            expect(containerText).toContain(result.revision_id);
            
            // 3. Verify branch_name is present in the rendered output
            expect(containerText).toContain(result.branch_name);
            
            // 4. Verify origin is present in the rendered output
            expect(containerText).toContain(result.origin);
          }
          
          // 5. Verify the count of results is displayed
          expect(containerText).toContain(`Found ${originResults.length}`);
          
          // 6. Verify all required field labels are present
          expect(containerText).toContain('Revision ID:');
          expect(containerText).toContain('Origin:');
        }
      ),
      { numRuns: 100 } // Run 100 iterations as specified in design document
    );
  });

  // Feature: vuln-fork-lookup, Property 4: Result completeness
  // Validates: Requirements 1.5
  it('should display the same number of results as returned from query engine for commit results', () => {
    // Generator for VulnerabilityResult
    const vulnerabilityResultArbitrary = fc.record({
      revision_id: fc.oneof(
        fc.stringMatching(/^[a-f0-9]{40}$/),
        fc.stringMatching(/^[a-f0-9]{64}$/)
      ),
      category: fc.stringMatching(/^[A-Z_]+$/),
      vulnerability_filename: fc.stringMatching(/^(nvd_cve\/)?CVE-\d{4}-\d+\.json$/),
    });

    fc.assert(
      fc.property(
        // Generate an array of vulnerability results with varying sizes
        fc.array(vulnerabilityResultArbitrary, { minLength: 1, maxLength: 20 }),
        (commitResults) => {
          // Render the component with commit results
          const { container } = render(
            <ResultsDisplay commitResults={commitResults} />
          );

          // Property 4: For any query that returns multiple vulnerabilities,
          // the number of displayed results should equal the number of results returned from the query engine
          
          // Count the number of vulnerability items rendered in the DOM
          // Each vulnerability is rendered as a list item with the vulnerability_filename
          const listItems = container.querySelectorAll('li');
          const displayedCount = listItems.length;
          
          // The number of displayed results should equal the number of results from the query
          expect(displayedCount).toBe(commitResults.length);
          
          // Additionally verify the count is shown in the header
          const containerText = container.textContent || '';
          expect(containerText).toContain(`Found ${commitResults.length}`);
        }
      ),
      { numRuns: 100 } // Run 100 iterations as specified in design document
    );
  });

  // Feature: vuln-fork-lookup, Property 4: Result completeness
  // Validates: Requirements 1.5
  it('should display the same number of results as returned from query engine for origin results', () => {
    // Generator for OriginVulnerabilityResult
    const originVulnerabilityResultArbitrary = fc.record({
      origin: fc.oneof(
        fc.stringMatching(/^https:\/\/github\.com\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/),
        fc.stringMatching(/^https:\/\/gitlab\.com\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/),
        fc.stringMatching(/^git@github\.com:[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+\.git$/),
      ),
      revision_id: fc.oneof(
        fc.stringMatching(/^[a-f0-9]{40}$/),
        fc.stringMatching(/^[a-f0-9]{64}$/)
      ),
      branch_name: fc.stringMatching(/^[a-zA-Z0-9_/-]+$/),
      vulnerability_filename: fc.stringMatching(/^(nvd_cve\/)?CVE-\d{4}-\d+\.json$/),
    });

    fc.assert(
      fc.property(
        // Generate an array of origin vulnerability results with varying sizes
        fc.array(originVulnerabilityResultArbitrary, { minLength: 1, maxLength: 20 }),
        (originResults) => {
          // Render the component with origin results
          const { container } = render(
            <ResultsDisplay originResults={originResults} />
          );

          // Property 4: For any query that returns multiple vulnerabilities,
          // the number of displayed results should equal the number of results returned from the query engine
          
          // Count the number of vulnerability items rendered in the DOM
          // For origin results, each vulnerability is rendered within branch groups
          // We need to count all vulnerability items across all branches
          const vulnerabilityItems = container.querySelectorAll('li[class*="border-l-4"]');
          const displayedCount = vulnerabilityItems.length;
          
          // The number of displayed results should equal the number of results from the query
          expect(displayedCount).toBe(originResults.length);
          
          // Additionally verify the count is shown in the header
          const containerText = container.textContent || '';
          expect(containerText).toContain(`Found ${originResults.length}`);
        }
      ),
      { numRuns: 100 } // Run 100 iterations as specified in design document
    );
  });

  // Additional test: Verify empty results are handled gracefully
  it('should handle empty results gracefully', () => {
    fc.assert(
      fc.property(
        fc.constantFrom([], null, undefined),
        (emptyResults) => {
          // Test with empty commit results
          const { container: commitContainer } = render(
            <ResultsDisplay commitResults={emptyResults as VulnerabilityResult[] | null} />
          );
          
          // Should either show nothing or show "no vulnerabilities found" message
          if (emptyResults !== null && emptyResults !== undefined && emptyResults.length === 0) {
            expect(commitContainer.textContent).toContain('No vulnerabilities found');
          }
          
          // Test with empty origin results
          const { container: originContainer } = render(
            <ResultsDisplay originResults={emptyResults as OriginVulnerabilityResult[] | null} />
          );
          
          // Should either show nothing or show "no vulnerabilities found" message
          if (emptyResults !== null && emptyResults !== undefined && emptyResults.length === 0) {
            expect(originContainer.textContent).toContain('No vulnerabilities found');
          }
        }
      ),
      { numRuns: 10 } // Fewer runs for this simpler test
    );
  });

  // Feature: vuln-fork-lookup, Property 6: CVE detail interactivity
  // Validates: Requirements 3.1
  it('should provide interactive elements for CVE detail loading on commit results', () => {
    // Generator for VulnerabilityResult
    const vulnerabilityResultArbitrary = fc.record({
      revision_id: fc.oneof(
        fc.stringMatching(/^[a-f0-9]{40}$/),
        fc.stringMatching(/^[a-f0-9]{64}$/)
      ),
      category: fc.stringMatching(/^[A-Z_]+$/),
      vulnerability_filename: fc.stringMatching(/^(nvd_cve\/)?CVE-\d{4}-\d+\.json$/),
    });

    fc.assert(
      fc.property(
        // Generate an array of vulnerability results
        fc.array(vulnerabilityResultArbitrary, { minLength: 1, maxLength: 10 }),
        (commitResults) => {
          // Mock callback to verify interactivity
          let clickedFilenames: string[] = [];
          const mockOnCVEClick = (filename: string) => {
            clickedFilenames.push(filename);
          };

          // Render the component with commit results and click handler
          const { container } = render(
            <ResultsDisplay 
              commitResults={commitResults} 
              onCVEClick={mockOnCVEClick}
            />
          );

          // Property 6: For any displayed vulnerability, the rendered output should contain 
          // an interactive element (link or button) that triggers CVE detail loading
          
          // Find all interactive elements (buttons) for CVE details
          const interactiveElements = container.querySelectorAll('button[aria-label*="View details"]');
          
          // 1. Verify that the number of interactive elements matches the number of vulnerabilities
          expect(interactiveElements.length).toBe(commitResults.length);
          
          // 2. Verify each vulnerability has an associated interactive element
          for (let i = 0; i < commitResults.length; i++) {
            const result = commitResults[i];
            const element = interactiveElements[i] as HTMLButtonElement;
            
            // 3. Verify the element is actually interactive (button or link)
            expect(element.tagName).toBe('BUTTON');
            
            // 4. Verify the element has proper accessibility attributes
            expect(element.getAttribute('aria-label')).toContain('View details');
            expect(element.getAttribute('aria-label')).toContain(result.vulnerability_filename);
            
            // 5. Verify the element contains the vulnerability filename
            expect(element.textContent).toContain(result.vulnerability_filename);
            
            // 6. Verify the element is clickable and triggers the callback
            element.click();
            expect(clickedFilenames).toContain(result.vulnerability_filename);
          }
          
          // 7. Verify all vulnerabilities were clickable
          expect(clickedFilenames.length).toBe(commitResults.length);
        }
      ),
      { numRuns: 100 } // Run 100 iterations as specified in design document
    );
  });

  // Feature: vuln-fork-lookup, Property 6: CVE detail interactivity
  // Validates: Requirements 3.1
  it('should provide interactive elements for CVE detail loading on origin results', () => {
    // Generator for OriginVulnerabilityResult
    const originVulnerabilityResultArbitrary = fc.record({
      origin: fc.oneof(
        fc.stringMatching(/^https:\/\/github\.com\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/),
        fc.stringMatching(/^https:\/\/gitlab\.com\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/),
        fc.stringMatching(/^git@github\.com:[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+\.git$/),
      ),
      revision_id: fc.oneof(
        fc.stringMatching(/^[a-f0-9]{40}$/),
        fc.stringMatching(/^[a-f0-9]{64}$/)
      ),
      branch_name: fc.stringMatching(/^[a-zA-Z0-9_/-]+$/),
      vulnerability_filename: fc.stringMatching(/^(nvd_cve\/)?CVE-\d{4}-\d+\.json$/),
    });

    fc.assert(
      fc.property(
        // Generate an array of origin vulnerability results
        fc.array(originVulnerabilityResultArbitrary, { minLength: 1, maxLength: 10 }),
        (originResults) => {
          // Mock callback to verify interactivity
          let clickedFilenames: string[] = [];
          const mockOnCVEClick = (filename: string) => {
            clickedFilenames.push(filename);
          };

          // Render the component with origin results and click handler
          const { container } = render(
            <ResultsDisplay 
              originResults={originResults} 
              onCVEClick={mockOnCVEClick}
            />
          );

          // Property 6: For any displayed vulnerability, the rendered output should contain 
          // an interactive element (link or button) that triggers CVE detail loading
          
          // Find all interactive elements (buttons) for CVE details
          const interactiveElements = container.querySelectorAll('button[aria-label*="View details"]');
          
          // 1. Verify that the number of interactive elements matches the number of vulnerabilities
          expect(interactiveElements.length).toBe(originResults.length);
          
          // 2. Create a set of all vulnerability filenames from the input
          const expectedFilenames = new Set(originResults.map(r => r.vulnerability_filename));
          
          // 3. Verify each interactive element corresponds to a vulnerability
          // Note: We can't check by index because branch grouping changes the order
          for (let i = 0; i < interactiveElements.length; i++) {
            const element = interactiveElements[i] as HTMLButtonElement;
            
            // 4. Verify the element is actually interactive (button or link)
            expect(element.tagName).toBe('BUTTON');
            
            // 5. Verify the element has proper accessibility attributes
            const ariaLabel = element.getAttribute('aria-label');
            expect(ariaLabel).toContain('View details');
            
            // 6. Extract the filename from the aria-label and verify it's one of our expected filenames
            const filenameMatch = ariaLabel?.match(/CVE-\d{4}-\d+\.json/);
            expect(filenameMatch).toBeTruthy();
            if (filenameMatch) {
              const filename = filenameMatch[0];
              expect(expectedFilenames.has(filename) || expectedFilenames.has(`nvd_cve/${filename}`)).toBe(true);
            }
            
            // 7. Verify the element is clickable and triggers the callback
            element.click();
          }
          
          // 8. Verify all vulnerabilities were clickable
          expect(clickedFilenames.length).toBe(originResults.length);
          
          // 9. Verify all expected filenames were clicked
          for (const result of originResults) {
            expect(clickedFilenames).toContain(result.vulnerability_filename);
          }
        }
      ),
      { numRuns: 100 } // Run 100 iterations as specified in design document
    );
  });
});
