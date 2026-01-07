/**
 * CVE Loader Utilities
 * Batch loading and enrichment of vulnerability results with CVE data
 */

import type { VulnerabilityResult, OriginVulnerabilityResult, CVEEntry } from '../types';
import { calculateCVSSv3Score, interpretCVSSScore } from './cvssUtils';
import { queryEngine } from './apiClient';
import type { S3Config } from '../types';

/**
 * Enriches vulnerability results with CVE data and severity information
 * 
 * @param results - Array of vulnerability results
 * @param cvePath - Path to CVE files
 * @param s3Config - S3 configuration
 * @returns Enriched results with CVE data and severity
 */
export async function enrichWithCVEData<T extends VulnerabilityResult | OriginVulnerabilityResult>(
  results: T[],
  cvePath: string,
  s3Config: S3Config
): Promise<T[]> {
  // Get unique vulnerability filenames
  const uniqueFilenames = [...new Set(results.map(r => r.vulnerability_filename))];
  
  // Load CVE data for all unique filenames
  const cveDataMap = new Map<string, { cveData: CVEEntry; severity: string; cvssScore: number | null }>();
  
  await Promise.all(
    uniqueFilenames.map(async (filename) => {
      try {
        const cveData = await queryEngine.loadCVEData(
          filename,
          '', // No longer needed
          {} // No longer needed
        );
        
        // Skip if no CVE data is available
        if (!cveData) {
          console.warn(`No CVE data available for ${filename} - skipping enrichment`);
          return;
        }
        
        // Calculate severity from CVE data
        let cvssScore: number | null = null;
        let severity = 'Unknown';
        
        if (cveData.severity && cveData.severity.length > 0) {
          const firstSeverity = cveData.severity[0];
          
          // Try to parse or calculate CVSS score
          const parsed = parseFloat(firstSeverity.score);
          if (!isNaN(parsed)) {
            cvssScore = parsed;
          } else {
            // Try to calculate from vector
            cvssScore = calculateCVSSv3Score(firstSeverity.score);
          }
          
          if (cvssScore !== null) {
            const interpretation = interpretCVSSScore(cvssScore);
            severity = interpretation.label;
          }
        }
        
        cveDataMap.set(filename, { cveData, severity, cvssScore });
      } catch (error) {
        // If loading fails, skip this CVE
        console.warn(`Failed to load CVE data for ${filename}:`, error);
      }
    })
  );
  
  // Enrich results with CVE data
  return results.map(result => {
    const enrichment = cveDataMap.get(result.vulnerability_filename);
    if (enrichment) {
      return {
        ...result,
        cveData: enrichment.cveData,
        severity: enrichment.severity,
        cvssScore: enrichment.cvssScore ?? undefined,
      };
    }
    return result;
  });
}
