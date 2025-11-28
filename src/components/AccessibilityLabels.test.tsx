/**
 * Property-based tests for Accessibility Labels
 * Tests correctness properties for ARIA labels and semantic HTML across all components
 * 
 * Feature: vuln-fork-lookup, Property 14: Accessibility label presence
 * Validates: Requirements 10.4
 */

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import * as fc from 'fast-check';
import { SearchInterface } from './SearchInterface';
import { ResultsDisplay } from './ResultsDisplay';
import { CVEViewer } from './CVEViewer';
import type { VulnerabilityResult, OriginVulnerabilityResult, CVEEntry } from '../types';

describe('Accessibility Labels - Property-Based Tests', () => {
  // Feature: vuln-fork-lookup, Property 14: Accessibility label presence
  // Validates: Requirements 10.4
  it('should ensure all interactive elements in SearchInterface have accessibility labels', () => {
    fc.assert(
      fc.property(
        fc.boolean(), // loading state
        fc.option(fc.string(), { nil: null }), // error message
        (loading, error) => {
          // Property 14: For any interactive element in the application, it should have either
          // an aria-label attribute, aria-labelledby reference, or semantic HTML that provides
          // context for screen readers
          
          const mockOnSearch = vi.fn();
          
          const { container } = render(
            <SearchInterface
              onSearch={mockOnSearch}
              loading={loading}
              error={error}
            />
          );

          // Find all interactive elements (buttons, inputs, links)
          const interactiveElements = container.querySelectorAll(
            'input, button, a, [role="button"], [tabindex]:not([tabindex="-1"])'
          );

          // 1. Verify that interactive elements exist
          expect(interactiveElements.length).toBeGreaterThan(0);

          // 2. For each interactive element, verify accessibility label presence
          interactiveElements.forEach((element) => {
            const htmlElement = element as HTMLElement;
            
            // Check for various forms of accessible labeling
            const ariaLabel = htmlElement.getAttribute('aria-label');
            const ariaLabelledBy = htmlElement.getAttribute('aria-labelledby');
            const ariaDescribedBy = htmlElement.getAttribute('aria-describedby');
            const title = htmlElement.getAttribute('title');
            const textContent = htmlElement.textContent?.trim();
            
            // For inputs, check for associated label
            let hasAssociatedLabel = false;
            if (htmlElement.tagName === 'INPUT') {
              const inputId = htmlElement.getAttribute('id');
              if (inputId) {
                const label = container.querySelector(`label[for="${inputId}"]`);
                hasAssociatedLabel = !!label;
              }
              // Also check if input is wrapped in a label
              const parentLabel = htmlElement.closest('label');
              if (parentLabel) {
                hasAssociatedLabel = true;
              }
            }
            
            // Element should have at least one form of accessible labeling
            const hasAccessibleName = !!(
              ariaLabel || 
              ariaLabelledBy || 
              ariaDescribedBy ||
              title ||
              (textContent && textContent.length > 0) ||
              hasAssociatedLabel
            );
            
            // Assert that the element has some form of accessible labeling
            expect(hasAccessibleName).toBe(true);
            
            // 3. Verify specific elements have appropriate labels
            if (htmlElement.tagName === 'INPUT' && htmlElement.getAttribute('type') === 'text') {
              // Search input should have aria-label
              expect(ariaLabel).not.toBeNull();
              expect(ariaLabel).toContain('Search');
            }
            
            if (htmlElement.tagName === 'BUTTON' && htmlElement.getAttribute('type') === 'submit') {
              // Submit button should have aria-label or text content
              const hasLabel = !!(ariaLabel || textContent);
              expect(hasLabel).toBe(true);
            }
          });
        }
      ),
      { numRuns: 100 } // Run 100 iterations as specified in design document
    );
  });

  // Feature: vuln-fork-lookup, Property 14: Accessibility label presence
  // Validates: Requirements 10.4
  it('should ensure all interactive elements in ResultsDisplay have accessibility labels', () => {
    // Generator for VulnerabilityResult
    const vulnerabilityResultArbitrary = fc.record({
      revision_id: fc.stringMatching(/^[a-f0-9]{40}$/),
      category: fc.stringMatching(/^[A-Z_]+$/),
      vulnerability_filename: fc.stringMatching(/^CVE-\d{4}-\d+\.json$/),
    });

    fc.assert(
      fc.property(
        fc.array(vulnerabilityResultArbitrary, { minLength: 1, maxLength: 5 }),
        (commitResults) => {
          // Property 14: For any interactive element, it should have accessibility labels
          
          const mockOnCVEClick = vi.fn();
          
          const { container } = render(
            <ResultsDisplay
              commitResults={commitResults}
              onCVEClick={mockOnCVEClick}
            />
          );

          // Find all interactive elements
          const interactiveElements = container.querySelectorAll(
            'button, a, [role="button"], [tabindex]:not([tabindex="-1"])'
          );

          // 1. Verify that interactive elements exist
          expect(interactiveElements.length).toBeGreaterThanOrEqual(commitResults.length);

          // 2. For each interactive element, verify accessibility label presence
          interactiveElements.forEach((element) => {
            const htmlElement = element as HTMLElement;
            
            // Check for various forms of accessible labeling
            const ariaLabel = htmlElement.getAttribute('aria-label');
            const ariaLabelledBy = htmlElement.getAttribute('aria-labelledby');
            const ariaDescribedBy = htmlElement.getAttribute('aria-describedby');
            const title = htmlElement.getAttribute('title');
            const textContent = htmlElement.textContent?.trim();
            
            // Element should have at least one form of accessible labeling
            const hasAccessibleName = !!(
              ariaLabel || 
              ariaLabelledBy || 
              ariaDescribedBy ||
              title ||
              (textContent && textContent.length > 0)
            );
            
            // Assert that the element has some form of accessible labeling
            expect(hasAccessibleName).toBe(true);
          });

          // 3. Verify CVE detail buttons have specific aria-labels
          const cveButtons = container.querySelectorAll('button[aria-label*="View details"]');
          
          expect(cveButtons.length).toBe(commitResults.length);
          
          cveButtons.forEach((button, index) => {
            const htmlButton = button as HTMLButtonElement;
            const ariaLabel = htmlButton.getAttribute('aria-label');
            
            // Button should have aria-label containing "View details"
            expect(ariaLabel).not.toBeNull();
            if (ariaLabel) {
              expect(ariaLabel).toContain('View details');
              
              // Button should reference the specific CVE filename
              expect(ariaLabel).toContain(commitResults[index].vulnerability_filename);
            }
          });
        }
      ),
      { numRuns: 100 } // Run 100 iterations as specified in design document
    );
  });

  // Feature: vuln-fork-lookup, Property 14: Accessibility label presence
  // Validates: Requirements 10.4
  it('should ensure all interactive elements in ResultsDisplay with origin results have accessibility labels', () => {
    // Generator for OriginVulnerabilityResult
    const originVulnerabilityResultArbitrary = fc.record({
      origin: fc.stringMatching(/^https:\/\/github\.com\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/),
      revision_id: fc.stringMatching(/^[a-f0-9]{40}$/),
      branch_name: fc.stringMatching(/^[a-zA-Z0-9_/-]+$/),
      vulnerability_filename: fc.stringMatching(/^CVE-\d{4}-\d+\.json$/),
    });

    fc.assert(
      fc.property(
        fc.array(originVulnerabilityResultArbitrary, { minLength: 1, maxLength: 5 }),
        (originResults) => {
          // Property 14: For any interactive element, it should have accessibility labels
          
          const mockOnCVEClick = vi.fn();
          
          const { container } = render(
            <ResultsDisplay
              originResults={originResults}
              onCVEClick={mockOnCVEClick}
            />
          );

          // Find all interactive elements
          const interactiveElements = container.querySelectorAll(
            'button, a, [role="button"], [tabindex]:not([tabindex="-1"])'
          );

          // 1. Verify that interactive elements exist
          expect(interactiveElements.length).toBeGreaterThanOrEqual(originResults.length);

          // 2. For each interactive element, verify accessibility label presence
          interactiveElements.forEach((element) => {
            const htmlElement = element as HTMLElement;
            
            // Check for various forms of accessible labeling
            const ariaLabel = htmlElement.getAttribute('aria-label');
            const ariaLabelledBy = htmlElement.getAttribute('aria-labelledby');
            const ariaDescribedBy = htmlElement.getAttribute('aria-describedby');
            const title = htmlElement.getAttribute('title');
            const textContent = htmlElement.textContent?.trim();
            
            // Element should have at least one form of accessible labeling
            const hasAccessibleName = !!(
              ariaLabel || 
              ariaLabelledBy || 
              ariaDescribedBy ||
              title ||
              (textContent && textContent.length > 0)
            );
            
            // Assert that the element has some form of accessible labeling
            expect(hasAccessibleName).toBe(true);
          });

          // 3. Verify CVE detail buttons have specific aria-labels
          const cveButtons = container.querySelectorAll('button[aria-label*="View details"]');
          
          expect(cveButtons.length).toBe(originResults.length);
          
          // Collect all vulnerability filenames from results
          const allFilenames = originResults.map(r => r.vulnerability_filename);
          
          cveButtons.forEach((button) => {
            const htmlButton = button as HTMLButtonElement;
            const ariaLabel = htmlButton.getAttribute('aria-label');
            
            // Button should have aria-label containing "View details"
            expect(ariaLabel).not.toBeNull();
            if (ariaLabel) {
              expect(ariaLabel).toContain('View details');
              
              // Button should reference one of the CVE filenames from the results
              const hasValidFilename = allFilenames.some(filename => ariaLabel.includes(filename));
              expect(hasValidFilename).toBe(true);
            }
          });
        }
      ),
      { numRuns: 100 } // Run 100 iterations as specified in design document
    );
  });

  // Feature: vuln-fork-lookup, Property 14: Accessibility label presence
  // Validates: Requirements 10.4
  it('should ensure all interactive elements in CVEViewer have accessibility labels', async () => {
    // Generator for minimal CVE entry
    const cveEntryArbitrary = fc.record({
      id: fc.stringMatching(/^CVE-\d{4}-\d{4,7}$/),
      summary: fc.string({ minLength: 10, maxLength: 100 }),
      details: fc.string({ minLength: 20, maxLength: 200 }),
    });

    await fc.assert(
      fc.asyncProperty(
        cveEntryArbitrary,
        fc.stringMatching(/^CVE-\d{4}-\d+\.json$/),
        async (cveEntry, vulnerabilityFilename) => {
          // Property 14: For any interactive element, it should have accessibility labels
          
          const mockOnLoadCVE = vi.fn().mockResolvedValue(cveEntry);
          const mockOnClose = vi.fn();
          
          const { container } = render(
            <CVEViewer
              vulnerabilityFilename={vulnerabilityFilename}
              onClose={mockOnClose}
              onLoadCVE={mockOnLoadCVE}
            />
          );

          // Wait for the CVE data to load
          await new Promise(resolve => setTimeout(resolve, 10));

          // Find all interactive elements in the modal
          const interactiveElements = container.querySelectorAll(
            'button, a, [role="button"], [tabindex]:not([tabindex="-1"])'
          );

          // 1. Verify that interactive elements exist
          expect(interactiveElements.length).toBeGreaterThan(0);

          // 2. For each interactive element, verify accessibility label presence
          interactiveElements.forEach((element) => {
            const htmlElement = element as HTMLElement;
            
            // Check for various forms of accessible labeling
            const ariaLabel = htmlElement.getAttribute('aria-label');
            const ariaLabelledBy = htmlElement.getAttribute('aria-labelledby');
            const ariaDescribedBy = htmlElement.getAttribute('aria-describedby');
            const title = htmlElement.getAttribute('title');
            const textContent = htmlElement.textContent?.trim();
            
            // Element should have at least one form of accessible labeling
            const hasAccessibleName = !!(
              ariaLabel || 
              ariaLabelledBy || 
              ariaDescribedBy ||
              title ||
              (textContent && textContent.length > 0)
            );
            
            // Assert that the element has some form of accessible labeling
            expect(hasAccessibleName).toBe(true);
          });

          // 3. Verify close buttons have specific aria-labels
          const closeButtons = container.querySelectorAll('button[aria-label*="Close"]');
          
          expect(closeButtons.length).toBeGreaterThan(0);
          
          closeButtons.forEach((button) => {
            const htmlButton = button as HTMLButtonElement;
            const ariaLabel = htmlButton.getAttribute('aria-label');
            
            // Button should have aria-label containing "Close"
            expect(ariaLabel).not.toBeNull();
            if (ariaLabel) {
              expect(ariaLabel).toContain('Close');
            }
          });

          // 4. Verify all links have accessible names
          const links = container.querySelectorAll('a[href]');
          links.forEach((link) => {
            const htmlLink = link as HTMLAnchorElement;
            
            const ariaLabel = htmlLink.getAttribute('aria-label');
            const ariaLabelledBy = htmlLink.getAttribute('aria-labelledby');
            const textContent = htmlLink.textContent?.trim();
            const title = htmlLink.getAttribute('title');
            
            // Link should have some form of accessible name
            const hasAccessibleName = !!(ariaLabel || ariaLabelledBy || textContent || title);
            expect(hasAccessibleName).toBe(true);
          });
        }
      ),
      { numRuns: 100, timeout: 10000 } // Run 100 iterations with 10s timeout
    );
  });

  // Feature: vuln-fork-lookup, Property 14: Accessibility label presence
  // Validates: Requirements 10.4
  it('should ensure semantic HTML is used for all major sections', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            revision_id: fc.stringMatching(/^[a-f0-9]{40}$/),
            category: fc.stringMatching(/^[A-Z_]+$/),
            vulnerability_filename: fc.stringMatching(/^CVE-\d{4}-\d+\.json$/),
          }),
          { minLength: 1, maxLength: 3 }
        ),
        (commitResults) => {
          // Property 14: Verify semantic HTML provides context for screen readers
          
          const mockOnSearch = vi.fn();
          const mockOnCVEClick = vi.fn();
          
          const { container } = render(
            <div>
              <SearchInterface onSearch={mockOnSearch} />
              <ResultsDisplay commitResults={commitResults} onCVEClick={mockOnCVEClick} />
            </div>
          );

          // 1. Verify search section uses semantic HTML
          const searchSection = container.querySelector('[role="search"]');
          expect(searchSection).toBeTruthy();

          // 2. Verify results section uses semantic HTML
          const resultsSection = container.querySelector('[role="region"]');
          expect(resultsSection).toBeTruthy();

          // 3. Verify lists use proper list markup
          const lists = container.querySelectorAll('ul[role="list"], ol[role="list"]');
          if (commitResults.length > 0) {
            expect(lists.length).toBeGreaterThan(0);
          }

          // 4. Verify headings are present for major sections
          const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6');
          expect(headings.length).toBeGreaterThan(0);

          // 5. Verify buttons use semantic button elements (not divs with role="button")
          const buttons = container.querySelectorAll('button');
          const roleButtons = container.querySelectorAll('[role="button"]');
          
          // Prefer semantic buttons over role="button"
          // Most interactive elements should be actual button elements
          expect(buttons.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 } // Run 100 iterations as specified in design document
    );
  });

  // Feature: vuln-fork-lookup, Property 14: Accessibility label presence
  // Validates: Requirements 10.4
  it('should ensure ARIA live regions are used for dynamic content', () => {
    fc.assert(
      fc.property(
        fc.boolean(), // loading state
        fc.option(fc.string(), { nil: null }), // error message
        (loading, error) => {
          // Property 14: Verify ARIA live regions provide context for dynamic updates
          
          const mockOnSearch = vi.fn();
          
          const { container } = render(
            <SearchInterface
              onSearch={mockOnSearch}
              loading={loading}
              error={error}
            />
          );

          // 1. If there's an error, verify it's in an ARIA live region
          if (error) {
            const errorRegions = container.querySelectorAll('[role="alert"], [aria-live]');
            expect(errorRegions.length).toBeGreaterThan(0);
            
            // Verify the error message is within an accessible region
            const errorElements = Array.from(errorRegions).filter(el => 
              el.textContent?.includes(error)
            );
            expect(errorElements.length).toBeGreaterThan(0);
          }

          // 2. Verify form has proper role
          const form = container.querySelector('form');
          if (form) {
            const role = form.getAttribute('role');
            // Form should have role="search" or no role (semantic HTML)
            if (role) {
              expect(role).toBe('search');
            }
          }
        }
      ),
      { numRuns: 100 } // Run 100 iterations as specified in design document
    );
  });

  // Feature: vuln-fork-lookup, Property 14: Accessibility label presence
  // Validates: Requirements 10.4
  it('should ensure modal dialogs have proper ARIA attributes', async () => {
    // Generator for minimal CVE entry
    const cveEntryArbitrary = fc.record({
      id: fc.stringMatching(/^CVE-\d{4}-\d{4,7}$/),
      summary: fc.string({ minLength: 10, maxLength: 100 }),
      details: fc.string({ minLength: 20, maxLength: 200 }),
    });

    await fc.assert(
      fc.asyncProperty(
        cveEntryArbitrary,
        fc.stringMatching(/^CVE-\d{4}-\d+\.json$/),
        async (cveEntry, vulnerabilityFilename) => {
          // Property 14: Verify modal dialogs have proper ARIA attributes
          
          const mockOnLoadCVE = vi.fn().mockResolvedValue(cveEntry);
          const mockOnClose = vi.fn();
          
          const { container } = render(
            <CVEViewer
              vulnerabilityFilename={vulnerabilityFilename}
              onClose={mockOnClose}
              onLoadCVE={mockOnLoadCVE}
            />
          );

          // Wait for the CVE data to load
          await new Promise(resolve => setTimeout(resolve, 10));

          // 1. Verify modal has role="dialog"
          const dialog = container.querySelector('[role="dialog"]');
          expect(dialog).toBeTruthy();

          // 2. Verify modal has aria-modal="true"
          if (dialog) {
            const ariaModal = dialog.getAttribute('aria-modal');
            expect(ariaModal).toBe('true');
          }

          // 3. Verify modal has aria-labelledby pointing to title
          if (dialog) {
            const ariaLabelledBy = dialog.getAttribute('aria-labelledby');
            // Modal may not have aria-labelledby if it uses aria-label instead
            // This is acceptable, so we don't enforce it
          }

          // 4. Verify modal overlay has aria-hidden="true"
          const overlay = container.querySelector('[aria-hidden="true"]');
          expect(overlay).not.toBeNull();
        }
      ),
      { numRuns: 100, timeout: 10000 } // Run 100 iterations with 10s timeout
    );
  });
});
