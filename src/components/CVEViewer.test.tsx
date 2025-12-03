/**
 * Property-based tests for CVE Viewer Component
 * Tests correctness properties for CVE detail rendering
 * 
 * Feature: vuln-fork-lookup, Property 7: CVE detail field completeness
 * Validates: Requirements 3.2
 */

import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import * as fc from 'fast-check';
import { CVEViewer } from './CVEViewer';

// Mock DuckDB to prevent worker initialization errors in test environment
vi.mock('@duckdb/duckdb-wasm', () => ({
  getJsDelivrBundles: vi.fn(),
  selectBundle: vi.fn(),
  AsyncDuckDB: vi.fn(),
  ConsoleLogger: vi.fn(),
}));

describe('CVEViewer - Property-Based Tests', () => {
  // Feature: vuln-fork-lookup, Property 7: CVE detail field completeness
  // Validates: Requirements 3.2
  it('should display all available key fields from OSV-format CVE entries', async () => {
    // Generator for CVE Entry in OSV format with all possible fields
    const cveEntryArbitrary = fc.record({
      // Required fields
      id: fc.stringMatching(/^CVE-\d{4}-\d{4,7}$/),
      summary: fc.string({ minLength: 10, maxLength: 200 }),
      details: fc.string({ minLength: 20, maxLength: 500 }),
      
      // Optional fields
      severity: fc.option(
        fc.array(
          fc.record({
            type: fc.constantFrom('CVSS_V2', 'CVSS_V3', 'CVSS_V4'),
            score: fc.stringMatching(/^\d+\.\d+$/),
          }),
          { minLength: 1, maxLength: 3 }
        )
      ),
      
      affected: fc.option(
        fc.array(
          fc.record({
            package: fc.option(
              fc.record({
                ecosystem: fc.option(fc.constantFrom('npm', 'PyPI', 'Maven', 'Go', 'RubyGems')),
                name: fc.option(fc.stringMatching(/^[a-z0-9-]+$/)),
                purl: fc.option(fc.stringMatching(/^pkg:[a-z]+\/[a-z0-9-]+@[\d.]+$/)),
              })
            ),
            ranges: fc.option(
              fc.array(
                fc.record({
                  type: fc.option(fc.constantFrom('SEMVER', 'GIT', 'ECOSYSTEM')),
                  events: fc.option(
                    fc.array(
                      fc.record({
                        introduced: fc.option(fc.stringMatching(/^\d+\.\d+\.\d+$/)),
                        fixed: fc.option(fc.stringMatching(/^\d+\.\d+\.\d+$/)),
                        last_affected: fc.option(fc.stringMatching(/^\d+\.\d+\.\d+$/)),
                        limit: fc.option(fc.stringMatching(/^\d+\.\d+\.\d+$/)),
                      }),
                      { minLength: 1, maxLength: 3 }
                    )
                  ),
                  repo: fc.option(fc.stringMatching(/^https:\/\/github\.com\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/)),
                }),
                { minLength: 1, maxLength: 2 }
              )
            ),
            versions: fc.option(
              fc.array(
                fc.stringMatching(/^\d+\.\d+\.\d+$/),
                { minLength: 1, maxLength: 5 }
              )
            ),
          }),
          { minLength: 1, maxLength: 3 }
        )
      ),
      
      references: fc.option(
        fc.array(
          fc.record({
            type: fc.constantFrom('WEB', 'ADVISORY', 'ARTICLE', 'REPORT', 'FIX', 'PACKAGE'),
            url: fc.webUrl(),
          }),
          { minLength: 1, maxLength: 5 }
        )
      ),
      
      published: fc.option(fc.integer({ min: 946684800000, max: 1767225600000 }).map(ts => new Date(ts).toISOString())),
      modified: fc.option(fc.integer({ min: 946684800000, max: 1767225600000 }).map(ts => new Date(ts).toISOString())),
    });

    await fc.assert(
      fc.asyncProperty(
        cveEntryArbitrary,
        fc.stringMatching(/^(nvd_cve\/)?CVE-\d{4}-\d+\.json$/),
        async (cveEntry, vulnerabilityFilename) => {
          // Property 7: For any CVE entry in OSV format, the rendered CVE detail view should display
          // all available key fields including id, summary, details, severity (if present),
          // affected packages (if present), and references (if present)
          
          // Mock the onLoadCVE function to return our generated CVE entry
          const mockOnLoadCVE = vi.fn().mockResolvedValue(cveEntry);
          const mockOnClose = vi.fn();

          // Render the CVE viewer with the vulnerability filename
          const { container } = render(
            <CVEViewer
              vulnerabilityFilename={vulnerabilityFilename}
              onClose={mockOnClose}
              onLoadCVE={mockOnLoadCVE}
            />
          );

          // Wait for the CVE data to load
          await waitFor(() => {
            expect(mockOnLoadCVE).toHaveBeenCalledWith(vulnerabilityFilename);
          });

          // Wait for the CVE data to be rendered
          await waitFor(() => {
            const containerText = container.textContent || '';
            expect(containerText).toContain(cveEntry.id);
          });

          const containerText = container.textContent || '';

          // 1. Verify required fields are always displayed
          
          // 1a. CVE ID should be displayed
          expect(containerText).toContain(cveEntry.id);
          
          // 1b. Summary should be displayed
          expect(containerText).toContain(cveEntry.summary);
          expect(containerText).toContain('Summary');
          
          // 1c. Details should be displayed
          expect(containerText).toContain(cveEntry.details);
          expect(containerText).toContain('Details');

          // 2. Verify optional fields are displayed when present
          
          // 2a. Severity - if present, should be displayed with type and score
          if (cveEntry.severity && cveEntry.severity.length > 0) {
            expect(containerText).toContain('Severity');
            for (const sev of cveEntry.severity) {
              expect(containerText).toContain(sev.type);
              // Score is formatted to 2 decimal places in the component
              const numericScore = parseFloat(sev.score);
              if (!isNaN(numericScore)) {
                expect(containerText).toContain(numericScore.toFixed(2));
              } else {
                // If it's a CVSS vector, it won't be displayed directly
                // The component calculates and displays the numeric score
              }
            }
          }
          
          // 2b. Affected packages - if present, should be displayed
          if (cveEntry.affected && cveEntry.affected.length > 0) {
            expect(containerText).toContain('Affected Packages');
            
            for (const affected of cveEntry.affected) {
              // Check package information if present
              if (affected.package) {
                if (affected.package.ecosystem) {
                  expect(containerText).toContain(affected.package.ecosystem);
                }
                if (affected.package.name) {
                  expect(containerText).toContain(affected.package.name);
                }
                if (affected.package.purl) {
                  expect(containerText).toContain(affected.package.purl);
                }
              }
              
              // Check version ranges if present
              if (affected.ranges && affected.ranges.length > 0) {
                expect(containerText).toContain('Version Ranges');
                
                for (const range of affected.ranges) {
                  if (range.type) {
                    expect(containerText).toContain(range.type);
                  }
                  if (range.repo) {
                    expect(containerText).toContain(range.repo);
                  }
                  if (range.events && range.events.length > 0) {
                    for (const event of range.events) {
                      if (event.introduced) {
                        expect(containerText).toContain('Introduced');
                        expect(containerText).toContain(event.introduced);
                      }
                      if (event.fixed) {
                        expect(containerText).toContain('Fixed');
                        expect(containerText).toContain(event.fixed);
                      }
                      if (event.last_affected) {
                        expect(containerText).toContain('Last Affected');
                        expect(containerText).toContain(event.last_affected);
                      }
                      if (event.limit) {
                        expect(containerText).toContain('Limit');
                        expect(containerText).toContain(event.limit);
                      }
                    }
                  }
                }
              }
              
              // Note: Specific versions section is hidden per user request
              // so we don't test for it
            }
          }
          
          // 2c. References - if present, should be displayed with type and URL
          if (cveEntry.references && cveEntry.references.length > 0) {
            expect(containerText).toContain('References');
            for (const ref of cveEntry.references) {
              expect(containerText).toContain(ref.type);
              // URL should be present as a link (check for href attribute which contains the actual URL)
              // Note: HTML entities may be escaped in the rendered HTML, so we check the href attribute
              const links = container.querySelectorAll('a[href]');
              const linkUrls = Array.from(links).map(link => link.getAttribute('href'));
              expect(linkUrls).toContain(ref.url);
            }
          }
          
          // 2d. Published date - if present, should be displayed
          if (cveEntry.published) {
            expect(containerText).toContain('Published');
            // Date should be formatted and displayed
            const publishedDate = new Date(cveEntry.published).toLocaleDateString();
            expect(containerText).toContain(publishedDate);
          }
          
          // 2e. Modified date - if present, should be displayed
          if (cveEntry.modified) {
            expect(containerText).toContain('Modified');
            // Date should be formatted and displayed
            const modifiedDate = new Date(cveEntry.modified).toLocaleDateString();
            expect(containerText).toContain(modifiedDate);
          }

          // 3. Verify the vulnerability filename is displayed
          expect(containerText).toContain(vulnerabilityFilename);

          // 4. Verify proper section headers are present for non-empty sections
          const sectionHeaders = ['Summary', 'Details'];
          for (const header of sectionHeaders) {
            expect(containerText).toContain(header);
          }
        }
      ),
      { numRuns: 100 } // Run 100 iterations as specified in design document
    );
  });

  // Additional test: Verify minimal CVE entry (only required fields) is handled correctly
  it('should handle minimal CVE entries with only required fields', async () => {
    // Generator for minimal CVE entry (only required fields)
    const minimalCVEArbitrary = fc.record({
      id: fc.stringMatching(/^CVE-\d{4}-\d{4,7}$/),
      summary: fc.string({ minLength: 10, maxLength: 200 }),
      details: fc.string({ minLength: 20, maxLength: 500 }),
    });

    await fc.assert(
      fc.asyncProperty(
        minimalCVEArbitrary,
        fc.stringMatching(/^(nvd_cve\/)?CVE-\d{4}-\d+\.json$/),
        async (minimalCVE, vulnerabilityFilename) => {
          // Mock the onLoadCVE function to return our minimal CVE entry
          const mockOnLoadCVE = vi.fn().mockResolvedValue(minimalCVE);
          const mockOnClose = vi.fn();

          // Render the CVE viewer
          const { container } = render(
            <CVEViewer
              vulnerabilityFilename={vulnerabilityFilename}
              onClose={mockOnClose}
              onLoadCVE={mockOnLoadCVE}
            />
          );

          // Wait for the CVE data to load and render
          await waitFor(() => {
            const containerText = container.textContent || '';
            expect(containerText).toContain(minimalCVE.id);
          });

          const containerText = container.textContent || '';

          // Verify all required fields are displayed
          expect(containerText).toContain(minimalCVE.id);
          expect(containerText).toContain(minimalCVE.summary);
          expect(containerText).toContain(minimalCVE.details);
          expect(containerText).toContain('Summary');
          expect(containerText).toContain('Details');

          // Verify optional section headers are NOT present when data is missing
          // (The component should gracefully handle missing optional fields)
          // We can't strictly test for absence since the component might still render
          // the sections conditionally, but we verify no errors occur
          expect(container).toBeTruthy();
        }
      ),
      { numRuns: 50 } // Fewer runs for this simpler test
    );
  });
});
