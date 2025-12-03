/**
 * Test setup file for vitest
 * Configures testing-library and other test utilities
 */

import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock cveLoader globally to avoid async issues in tests
// The mock returns enriched results immediately without actual HTTP requests
vi.mock('./lib/cveLoader', () => ({
  enrichWithCVEData: vi.fn((results) => Promise.resolve(results))
}));
