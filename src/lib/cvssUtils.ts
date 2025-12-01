/**
 * CVSS Utility Functions
 * Provides utilities for interpreting CVSS severity scores
 */

export interface CVSSSeverityLevel {
  label: string;
  color: string;
  bgColor: string;
  textColor: string;
}

/**
 * Interprets a CVSS score and returns the severity level
 * Based on CVSS v3.x specification:
 * - None: 0.0
 * - Low: 0.1-3.9
 * - Medium: 4.0-6.9
 * - High: 7.0-8.9
 * - Critical: 9.0-10.0
 * 
 * @param score - CVSS score as a string or number
 * @returns Severity level with label and styling information
 */
export function interpretCVSSScore(score: string | number): CVSSSeverityLevel {
  const numericScore = typeof score === 'string' ? parseFloat(score) : score;

  if (isNaN(numericScore)) {
    return {
      label: 'Unknown',
      color: 'gray',
      bgColor: 'bg-gray-100',
      textColor: 'text-gray-800',
    };
  }

  if (numericScore === 0.0) {
    return {
      label: 'None',
      color: 'gray',
      bgColor: 'bg-gray-100',
      textColor: 'text-gray-800',
    };
  }

  if (numericScore >= 0.1 && numericScore <= 3.9) {
    return {
      label: 'Low',
      color: 'yellow',
      bgColor: 'bg-yellow-100',
      textColor: 'text-yellow-800',
    };
  }

  if (numericScore >= 4.0 && numericScore <= 6.9) {
    return {
      label: 'Medium',
      color: 'orange',
      bgColor: 'bg-orange-100',
      textColor: 'text-orange-800',
    };
  }

  if (numericScore >= 7.0 && numericScore <= 8.9) {
    return {
      label: 'High',
      color: 'red',
      bgColor: 'bg-red-100',
      textColor: 'text-red-800',
    };
  }

  if (numericScore >= 9.0 && numericScore <= 10.0) {
    return {
      label: 'Critical',
      color: 'purple',
      bgColor: 'bg-purple-100',
      textColor: 'text-purple-800',
    };
  }

  // Fallback for out-of-range scores
  return {
    label: 'Unknown',
    color: 'gray',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-800',
  };
}

/**
 * Extracts the numeric score from a CVSS score string
 * Handles various formats like "7.5", "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H"
 * 
 * @param scoreString - CVSS score string
 * @returns Numeric score or null if not found
 */
export function extractCVSSScore(scoreString: string): number | null {
  // Try to parse as a direct number first
  const directScore = parseFloat(scoreString);
  if (!isNaN(directScore) && directScore >= 0 && directScore <= 10) {
    return directScore;
  }

  // Try to extract from CVSS vector string (e.g., "CVSS:3.1/AV:N/...")
  // This is less common in the score field, but handle it just in case
  const vectorMatch = scoreString.match(/CVSS:[\d.]+\/.*$/);
  if (vectorMatch) {
    // For vector strings, we'd need to calculate the score
    // For now, return null as we don't have the full calculation logic
    return null;
  }

  return null;
}

/**
 * Checks if a score string is a CVSS vector (not a numeric score)
 * 
 * @param scoreString - Score string to check
 * @returns True if the string is a CVSS vector
 */
export function isCVSSVector(scoreString: string): boolean {
  return /^CVSS:[\d.]+\//.test(scoreString);
}

/**
 * Calculates the CVSS v3.x score from a CVSS vector string
 * Based on CVSS v3.1 specification
 * 
 * @param vector - CVSS vector string (e.g., "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H")
 * @returns Numeric CVSS score (0.0-10.0) or null if invalid
 */
export function calculateCVSSv3Score(vector: string): number | null {
  // Parse the vector string
  const match = vector.match(/^CVSS:3\.[01]\/(.*)/);
  if (!match) return null;

  const metrics: Record<string, string> = {};
  const parts = match[1].split('/');
  
  for (const part of parts) {
    const [key, value] = part.split(':');
    if (key && value) {
      metrics[key] = value;
    }
  }

  // Required base metrics
  const AV = metrics['AV']; // Attack Vector
  const AC = metrics['AC']; // Attack Complexity
  const PR = metrics['PR']; // Privileges Required
  const UI = metrics['UI']; // User Interaction
  const S = metrics['S'];   // Scope
  const C = metrics['C'];   // Confidentiality Impact
  const I = metrics['I'];   // Integrity Impact
  const A = metrics['A'];   // Availability Impact

  if (!AV || !AC || !PR || !UI || !S || !C || !I || !A) {
    return null; // Missing required metrics
  }

  // CVSS v3.x metric values
  const attackVector: Record<string, number> = { N: 0.85, A: 0.62, L: 0.55, P: 0.2 };
  const attackComplexity: Record<string, number> = { L: 0.77, H: 0.44 };
  const privilegesRequired: Record<string, Record<string, number>> = {
    U: { N: 0.85, L: 0.62, H: 0.27 },
    C: { N: 0.85, L: 0.68, H: 0.5 }
  };
  const userInteraction: Record<string, number> = { N: 0.85, R: 0.62 };
  const impact: Record<string, number> = { N: 0, L: 0.22, H: 0.56 };

  // Get metric values
  const avValue = attackVector[AV];
  const acValue = attackComplexity[AC];
  const prValue = privilegesRequired[S][PR];
  const uiValue = userInteraction[UI];
  const cValue = impact[C];
  const iValue = impact[I];
  const aValue = impact[A];

  if (avValue === undefined || acValue === undefined || prValue === undefined || 
      uiValue === undefined || cValue === undefined || iValue === undefined || aValue === undefined) {
    return null; // Invalid metric value
  }

  // Calculate Impact Sub Score (ISS)
  const iss = 1 - ((1 - cValue) * (1 - iValue) * (1 - aValue));

  // Calculate Impact
  let impact_score: number;
  if (S === 'U') {
    // Unchanged scope
    impact_score = 6.42 * iss;
  } else {
    // Changed scope
    impact_score = 7.52 * (iss - 0.029) - 3.25 * Math.pow(iss - 0.02, 15);
  }

  // Calculate Exploitability
  const exploitability = 8.22 * avValue * acValue * prValue * uiValue;

  // Calculate Base Score
  let baseScore: number;
  if (impact_score <= 0) {
    baseScore = 0;
  } else {
    if (S === 'U') {
      baseScore = Math.min(impact_score + exploitability, 10);
    } else {
      baseScore = Math.min(1.08 * (impact_score + exploitability), 10);
    }
  }

  // Round up to one decimal place
  return Math.ceil(baseScore * 10) / 10;
}
