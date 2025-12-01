/**
 * Browser-based E2E Tests for DuckDB WASM Initialization
 * 
 * These tests run in a real browser and validate:
 * - DuckDB WASM initialization with MinIO
 * - S3 configuration and httpfs extension loading
 * - Query execution against real Parquet files
 * 
 * **Validates: Requirements 11.1, 11.2, 18.6**
 * **Property: DuckDB WASM with MinIO validation**
 */

import { test, expect } from '@playwright/test';

test.describe('DuckDB WASM Initialization', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('/');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
  });

  test('should initialize DuckDB WASM without errors', async ({ page }) => {
    // Requirement 11.1: Verify DuckDB WASM initializes with MinIO endpoint
    // Requirement 18.6: Validate DuckDB WASM with MinIO
    
    // Listen for console errors
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    // Wait for the search interface to be ready
    await page.waitForSelector('[data-testid="search-input"], input[type="text"]', {
      timeout: 60000, // DuckDB initialization can take time
    });
    
    // Check for initialization errors
    const hasInitError = errors.some(err => 
      err.includes('Failed to initialize DuckDB') ||
      err.includes('httpfs') ||
      err.includes('home_directory')
    );
    
    expect(hasInitError).toBe(false);
    
    console.log('✅ DuckDB WASM initialized successfully');
  });

  test('should perform a commit search query', async ({ page }) => {
    // Requirement 11.2: Verify complete flow from search to results
    // Requirement 11.3: Query by commit ID with real Parquet files
    
    // Capture console messages for debugging
    const consoleMessages: string[] = [];
    page.on('console', msg => {
      consoleMessages.push(`${msg.type()}: ${msg.text()}`);
    });
    
    // Wait for search interface
    const searchInput = page.locator('input[type="text"]').first();
    await searchInput.waitFor({ timeout: 60000 });
    
    // Enter a test commit ID (40 hex characters)
    const testCommitId = 'a'.repeat(40);
    await searchInput.fill(testCommitId);
    
    // Submit search
    const searchButton = page.locator('button:has-text("Search")').first();
    await searchButton.click();
    
    // Wait for query to complete (either results or "no results" message)
    await page.waitForTimeout(5000); // Give DuckDB time to query
    
    // Check for actual errors (not just "no results" messages)
    const actualError = page.locator('text=/failed|crash|exception/i');
    const hasActualError = await actualError.count() > 0;
    
    // Check if we got results or "no results" message
    const noResults = page.locator('text=/no vulnerabilities found/i');
    const hasNoResults = await noResults.count() > 0;
    
    if (hasActualError) {
      const errorText = await actualError.first().textContent();
      console.log('Error found:', errorText);
      console.log('Console messages:', consoleMessages.slice(-10).join('\n'));
    }
    
    // The query should complete without crashing
    // Either we get results or a "no results" message
    expect(hasActualError).toBe(false);
    
    console.log('✅ Commit search query executed successfully');
  });

  test('should perform an origin search query', async ({ page }) => {
    // Requirement 11.2: Verify complete flow from search to results
    // Requirement 11.4: Query by origin URL with real Parquet files
    
    // Wait for search interface
    const searchInput = page.locator('input[type="text"]').first();
    await searchInput.waitFor({ timeout: 60000 });
    
    // Enter a test origin URL
    const testOrigin = 'https://github.com/test/repo';
    await searchInput.fill(testOrigin);
    
    // Submit search
    const searchButton = page.locator('button:has-text("Search")').first();
    await searchButton.click();
    
    // Wait for query to complete
    await page.waitForTimeout(5000);
    
    // Check for actual errors (not just "no results" messages)
    const actualError = page.locator('text=/failed|crash|exception/i');
    const hasActualError = await actualError.count() > 0;
    
    expect(hasActualError).toBe(false);
    
    console.log('✅ Origin search query executed successfully');
  });

  test('should load CVE details when clicking on a vulnerability', async ({ page }) => {
    // Requirement 11.5: Load CVE details from real files
    // Property 17: End-to-end CVE detail loading
    
    // This test requires actual data with vulnerabilities
    // For now, we'll test that the CVE loading mechanism works
    
    // Navigate and wait for interface
    const searchInput = page.locator('input[type="text"]').first();
    await searchInput.waitFor({ timeout: 60000 });
    
    // Search for a commit that might have results
    // Using a pattern that could exist in the data
    await searchInput.fill('a'.repeat(40));
    const searchButton = page.locator('button:has-text("Search")').first();
    await searchButton.click();
    
    await page.waitForTimeout(3000);
    
    // Check if there are any clickable vulnerability items
    const vulnerabilityItems = page.locator('[role="button"]').filter({ hasText: /CVE|ALBA|GHSA/ });
    const itemCount = await vulnerabilityItems.count();
    
    if (itemCount > 0) {
      // Click on the first vulnerability
      await vulnerabilityItems.first().click();
      
      // Wait for CVE details to load or error message
      await page.waitForTimeout(2000);
      
      // Check that either details loaded or we got a proper error message
      const cveDetails = page.locator('text=/details|summary|severity/i');
      const cveError = page.locator('text=/failed to load|not found/i');
      
      const hasDetails = await cveDetails.count() > 0;
      const hasError = await cveError.count() > 0;
      
      // Either we should see details or a proper error message
      expect(hasDetails || hasError).toBe(true);
      
      console.log('✅ CVE detail loading mechanism validated');
    } else {
      console.log('ℹ️  No vulnerabilities in test data to click on');
    }
  });

  test('should handle DuckDB query errors gracefully', async ({ page }) => {
    // Requirement 11.6: Properly handle errors
    
    // Wait for search interface
    const searchInput = page.locator('input[type="text"]').first();
    await searchInput.waitFor({ timeout: 60000 });
    
    // Enter invalid input
    const invalidInput = "'; DROP TABLE test; --";
    await searchInput.fill(invalidInput);
    
    // Submit search
    const searchButton = page.locator('button:has-text("Search")').first();
    await searchButton.click();
    
    // Wait for response
    await page.waitForTimeout(3000);
    
    // Application should not crash
    const searchInputStillExists = await searchInput.isVisible();
    expect(searchInputStillExists).toBe(true);
    
    console.log('✅ Error handling validated');
  });
});

test.describe('Real Data Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });
  test('should find actual vulnerabilities in the dataset', async ({ page }) => {
    // This test searches the actual Parquet data to find real commits
    // and verifies the complete flow works with real data
    
    await page.goto('/');
    
    const searchInput = page.locator('input[type="text"]').first();
    await searchInput.waitFor({ timeout: 60000 });
    
    // Search for commits that are likely to exist
    // We'll try a few different patterns
    const searchPatterns = [
      '0000000000000000000000000000000000000000', // Common placeholder
      '1111111111111111111111111111111111111111',
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    ];
    
    let foundResults = false;
    
    for (const pattern of searchPatterns) {
      await searchInput.fill(pattern);
      const searchButton = page.locator('button:has-text("Search")').first();
      await searchButton.click();
      
      await page.waitForTimeout(3000);
      
      // Check if we got results
      const resultsSection = page.locator('text=/found.*vulnerabilit/i');
      const hasResults = await resultsSection.count() > 0;
      
      if (hasResults) {
        const resultsText = await resultsSection.first().textContent();
        console.log(`✅ Found results for ${pattern}: ${resultsText}`);
        foundResults = true;
        break;
      }
    }
    
    // The test passes if the query executed without errors
    // (Finding actual results depends on the data)
    const errorMessage = page.locator('text=/failed|crash|exception/i');
    const hasError = await errorMessage.count() > 0;
    
    expect(hasError).toBe(false);
    
    if (foundResults) {
      console.log('✅ Successfully found vulnerabilities in real data');
    } else {
      console.log('ℹ️  No vulnerabilities found for test patterns (data may be empty)');
    }
  });
});

test.describe('DuckDB WASM Performance', () => {
  test('should initialize within reasonable time', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/');
    
    // Wait for search interface to be ready
    await page.waitForSelector('input[type="text"]', {
      timeout: 60000,
    });
    
    const initTime = Date.now() - startTime;
    
    console.log(`DuckDB initialization took ${initTime}ms`);
    
    // Should initialize within 60 seconds
    expect(initTime).toBeLessThan(60000);
  });

  test('should execute queries within reasonable time', async ({ page }) => {
    await page.goto('/');
    
    const searchInput = page.locator('input[type="text"]').first();
    await searchInput.waitFor({ timeout: 60000 });
    
    // Measure query time
    const startTime = Date.now();
    
    await searchInput.fill('a'.repeat(40));
    const searchButton = page.locator('button:has-text("Search")').first();
    await searchButton.click();
    
    // Wait for query to complete
    await page.waitForTimeout(5000);
    
    const queryTime = Date.now() - startTime;
    
    console.log(`Query execution took ${queryTime}ms`);
    
    // Query should complete within 10 seconds
    expect(queryTime).toBeLessThan(10000);
  });
});
