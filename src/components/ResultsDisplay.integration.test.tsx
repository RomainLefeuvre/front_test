/**
 * Integration test for ResultsDisplay using real Django data
 * This test reproduces the issue where vulnerabilities aren't displayed
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResultsDisplay } from './ResultsDisplay';
import type { OriginVulnerabilityResult } from '../types';
import djangoData from '../../test-data/django.json';

// Mock the API client
vi.mock('../lib/apiClient', () => ({
  queryEngine: {
    loadCVEData: vi.fn().mockImplementation(async (filename: string) => {
      // Simulate the caching behavior - return data for files that have JSON content
      const vulnWithJson = djangoData.associated_set_of_vuln.find(v => v.filename === filename);
      if (vulnWithJson) {
        return {
          ...vulnWithJson.json_content,
          summary: vulnWithJson.json_content.details, // Add summary field
        };
      }
      return null; // Return null for files without JSON content
    }),
  },
}));

// Mock the config
vi.mock('../lib/config', () => ({
  loadConfig: () => ({
    apiBaseUrl: 'http://localhost:8080',
    environment: 'development',
    s3: { endpoint: '', bucket: '', region: '' },
    parquetPaths: { vulnerableCommits: '', vulnerableOrigins: '' },
    cvePath: '',
  }),
}));

describe('ResultsDisplay Integration Test with Django Data', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should display Django vulnerabilities from real API data', async () => {
    // Convert Django API response to OriginVulnerabilityResult format
    const originResults: OriginVulnerabilityResult[] = [];
    
    for (const entry of djangoData.entries) {
      for (const filename of entry.vulnerability_filenames) {
        originResults.push({
          origin: entry.origin,
          revision_swhid: entry.revision_id,
          branch_name: entry.branch_name,
          vulnerability_filename: filename,
        });
      }
    }

    console.log('Test: Created origin results', {
      count: originResults.length,
      sampleBranches: originResults.slice(0, 3).map(r => r.branch_name),
      sampleFilenames: originResults.slice(0, 3).map(r => r.vulnerability_filename),
    });

    // Render the component
    render(
      <ResultsDisplay
        originResults={originResults}
        onCVEClick={(filename) => console.log('CVE clicked:', filename)}
      />
    );

    // Wait for the component to process the results
    await new Promise(resolve => setTimeout(resolve, 100));

    // Check if vulnerabilities are displayed
    const vulnerabilityElements = screen.queryAllByText(/CVE-|PYSEC-/);
    console.log('Test: Found vulnerability elements', vulnerabilityElements.length);

    // Check if the main container is rendered
    const resultsContainer = screen.queryByRole('region', { name: /search results/i });
    console.log('Test: Results container found:', !!resultsContainer);

    // Check if branch headers are displayed
    const branchHeaders = screen.queryAllByText(/refs\/heads\/main/);
    console.log('Test: Branch headers found:', branchHeaders.length);

    // Assertions
    expect(originResults).toHaveLength(24);
    expect(resultsContainer).toBeTruthy();
    expect(vulnerabilityElements.length).toBeGreaterThan(0);
  });
});