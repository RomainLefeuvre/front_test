/**
 * Integration tests for App component
 * Tests consecutive searches and state management
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { queryEngine } from './lib/apiClient';

// Mock the API client
vi.mock('./lib/apiClient', () => ({
  queryEngine: {
    queryByCommitId: vi.fn(),
    queryByOrigin: vi.fn(),
    loadCVEData: vi.fn(),
    setProgressCallback: vi.fn(),
  },
  initializeApiClient: vi.fn(),
}));

// Mock CVE loader to prevent async loading in tests
vi.mock('./lib/cveLoader', () => ({
  enrichWithCVEData: vi.fn((results) => Promise.resolve(results)),
  loadCVEFromS3: vi.fn(),
}));

// Mock lazy loaded CVEViewer
vi.mock('./components/CVEViewer', () => ({
  CVEViewer: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="cve-viewer">
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

describe('App - Consecutive Search Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should clear previous results when performing a new search', async () => {
    const user = userEvent.setup();
    
    // Mock first search results
    const firstResults = [
      {
        revision_swhid: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        category: 'VULN_1',
        vulnerability_filename: 'CVE-2021-1234.json',
        severity: 'HIGH',
        cvssScore: 7.5,
      },
    ];
    
    // Mock second search results
    const secondResults = [
      {
        revision_swhid: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        category: 'VULN_2',
        vulnerability_filename: 'CVE-2022-5678.json',
        severity: 'CRITICAL',
        cvssScore: 9.8,
      },
    ];
    
    vi.mocked(queryEngine.queryByCommitId)
      .mockResolvedValueOnce(firstResults)
      .mockResolvedValueOnce(secondResults);
    
    render(<App />);
    
    // First search
    const searchInput = screen.getByLabelText(/search by commit id or repository url/i);
    const searchButton = screen.getByRole('button', { name: /execute vulnerability search/i });
    
    await user.type(searchInput, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    await user.click(searchButton);
    
    // Wait for first results to appear
    await waitFor(() => {
      expect(screen.getByText(/CVE-2021-1234/i)).toBeInTheDocument();
    });
    
    // Verify first results are displayed
    expect(screen.queryByText(/CVE-2021-1234/i)).toBeInTheDocument();
    expect(screen.queryByText(/CVE-2022-5678/i)).not.toBeInTheDocument();
    
    // Clear input and perform second search
    await user.clear(searchInput);
    await user.type(searchInput, 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
    await user.click(searchButton);
    
    // Wait for second results to appear
    await waitFor(() => {
      expect(screen.getByText(/CVE-2022-5678/i)).toBeInTheDocument();
    });
    
    // Verify only second results are displayed (first results should be cleared)
    expect(screen.queryByText(/CVE-2021-1234/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/CVE-2022-5678/i)).toBeInTheDocument();
  });

  it('should handle switching between commit and origin searches', async () => {
    const user = userEvent.setup();
    
    // Mock commit search results
    const commitResults = [
      {
        revision_swhid: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        category: 'VULN_COMMIT',
        vulnerability_filename: 'CVE-2021-1111.json',
        severity: 'MEDIUM',
        cvssScore: 5.5,
      },
    ];
    
    // Mock origin search results
    const originResults = [
      {
        origin: 'https://github.com/test/repo',
        revision_swhid: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        branch_name: 'refs/heads/main',
        vulnerability_filename: 'CVE-2022-2222.json',
        severity: 'HIGH',
        cvssScore: 7.5,
      },
    ];
    
    vi.mocked(queryEngine.queryByCommitId).mockResolvedValue(commitResults);
    vi.mocked(queryEngine.queryByOrigin).mockResolvedValue(originResults);
    
    render(<App />);
    
    const searchInput = screen.getByLabelText(/search by commit id or repository url/i);
    const searchButton = screen.getByRole('button', { name: /execute vulnerability search/i });
    
    // First search: commit ID
    await user.type(searchInput, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    await user.click(searchButton);
    
    // Wait for commit results
    await waitFor(() => {
      expect(screen.getByText(/CVE-2021-1111/i)).toBeInTheDocument();
    });
    
    expect(queryEngine.queryByCommitId).toHaveBeenCalledTimes(1);
    expect(queryEngine.queryByOrigin).not.toHaveBeenCalled();
    
    // Second search: origin URL
    await user.clear(searchInput);
    await user.type(searchInput, 'https://github.com/test/repo');
    await user.click(searchButton);
    
    // Wait for origin results
    await waitFor(() => {
      expect(screen.getByText(/CVE-2022-2222/i)).toBeInTheDocument();
    });
    
    // Verify commit results are cleared and origin results are shown
    expect(screen.queryByText(/CVE-2021-1111/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/CVE-2022-2222/i)).toBeInTheDocument();
    
    expect(queryEngine.queryByCommitId).toHaveBeenCalledTimes(1);
    expect(queryEngine.queryByOrigin).toHaveBeenCalledTimes(1);
  });

  it('should clear error messages when performing a new search', async () => {
    const user = userEvent.setup();
    
    // Mock first search to fail
    vi.mocked(queryEngine.queryByCommitId).mockRejectedValueOnce(
      new Error('Database connection failed')
    );
    
    // Mock second search to succeed
    const successResults = [
      {
        revision_swhid: 'cccccccccccccccccccccccccccccccccccccccc',
        category: 'VULN_SUCCESS',
        vulnerability_filename: 'CVE-2023-9999.json',
        severity: 'CRITICAL',
        cvssScore: 9.5,
      },
    ];
    vi.mocked(queryEngine.queryByCommitId).mockResolvedValueOnce(successResults);
    
    render(<App />);
    
    const searchInput = screen.getByLabelText(/search by commit id or repository url/i);
    const searchButton = screen.getByRole('button', { name: /execute vulnerability search/i });
    
    // First search (fails)
    await user.type(searchInput, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    await user.click(searchButton);
    
    // Wait for error message
    await waitFor(() => {
      expect(screen.getByText(/database connection failed/i)).toBeInTheDocument();
    });
    
    // Second search (succeeds)
    await user.clear(searchInput);
    await user.type(searchInput, 'cccccccccccccccccccccccccccccccccccccccc');
    await user.click(searchButton);
    
    // Wait for results
    await waitFor(() => {
      expect(screen.getByText(/CVE-2023-9999/i)).toBeInTheDocument();
    });
    
    // Verify error message is cleared
    expect(screen.queryByText(/database connection failed/i)).not.toBeInTheDocument();
    expect(screen.getByText(/CVE-2023-9999/i)).toBeInTheDocument();
  });

  it.skip('should handle consecutive searches with different results', async () => {
    const user = userEvent.setup();
    
    // Mock multiple search results
    const results1 = [{ revision_swhid: 'a'.repeat(40), category: 'V1', vulnerability_filename: 'CVE-2021-1111.json', severity: 'LOW', cvssScore: 3.0 }];
    const results2 = [{ revision_swhid: 'b'.repeat(40), category: 'V2', vulnerability_filename: 'CVE-2022-2222.json', severity: 'MEDIUM', cvssScore: 5.0 }];
    
    vi.mocked(queryEngine.queryByCommitId)
      .mockResolvedValueOnce(results1)
      .mockResolvedValueOnce(results2);
    
    render(<App />);
    
    const searchInput = screen.getByLabelText(/search by commit id or repository url/i);
    const searchButton = screen.getByRole('button', { name: /execute vulnerability search/i });
    
    // First search
    await user.type(searchInput, 'a'.repeat(40));
    await user.click(searchButton);
    
    // Wait for first results
    await waitFor(() => {
      expect(screen.getByText(/CVE-2021-1111/i)).toBeInTheDocument();
    });
    
    // Verify queryEngine was called once
    expect(queryEngine.queryByCommitId).toHaveBeenCalledTimes(1);
    
    // Second search
    fireEvent.change(searchInput, { target: { value: '' } });
    await user.type(searchInput, 'b'.repeat(40));
    await user.click(searchButton);
    
    // Wait for second results
    await waitFor(() => {
      expect(screen.getByText(/CVE-2022-2222/i)).toBeInTheDocument();
    }, { timeout: 5000 });
    
    // Verify queryEngine was called twice
    expect(queryEngine.queryByCommitId).toHaveBeenCalledTimes(2);
    
    // Verify only second results are shown
    expect(screen.queryByText(/CVE-2021-1111/i)).not.toBeInTheDocument();
    expect(screen.getByText(/CVE-2022-2222/i)).toBeInTheDocument();
  });

  it('should maintain search input value between searches', async () => {
    const user = userEvent.setup();
    
    const results = [
      {
        revision_swhid: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        category: 'VULN',
        vulnerability_filename: 'CVE-2021-1234.json',
        severity: 'HIGH',
        cvssScore: 7.5,
      },
    ];
    
    vi.mocked(queryEngine.queryByCommitId).mockResolvedValue(results);
    
    render(<App />);
    
    const searchInput = screen.getByLabelText(/search by commit id or repository url/i) as HTMLInputElement;
    const searchButton = screen.getByRole('button', { name: /execute vulnerability search/i });
    
    // Perform search
    const searchQuery = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    await user.type(searchInput, searchQuery);
    await user.click(searchButton);
    
    // Wait for results - check for "Found" text which appears immediately
    await waitFor(() => {
      expect(screen.getByText(/found.*vulnerabilit/i)).toBeInTheDocument();
    });
    
    // Verify input still contains the search query
    expect(searchInput.value).toBe(searchQuery);
  });

  it('should show loading state during search and clear it after', async () => {
    const user = userEvent.setup();
    
    // Mock search with delay
    vi.mocked(queryEngine.queryByCommitId).mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve([]), 100))
    );
    
    render(<App />);
    
    const searchInput = screen.getByLabelText(/search by commit id or repository url/i);
    const searchButton = screen.getByRole('button', { name: /execute vulnerability search/i });
    
    await user.type(searchInput, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    await user.click(searchButton);
    
    // Verify loading state is shown
    expect(screen.getByText(/searching/i)).toBeInTheDocument();
    
    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText(/searching/i)).not.toBeInTheDocument();
    });
    
    // Verify loading state is cleared
    expect(screen.queryByText(/searching/i)).not.toBeInTheDocument();
  });
});
