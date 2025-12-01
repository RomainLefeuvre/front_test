# CVSS Severity Interpretation

This document describes how CVSS (Common Vulnerability Scoring System) scores are interpreted and displayed in the Vulnerability Fork Lookup application.

## Overview

The application automatically interprets CVSS severity scores and displays them with color-coded labels to help users quickly understand the severity level of vulnerabilities.

## CVSS Score Ranges

The interpretation follows the CVSS v3.x specification:

| Score Range | Severity Level | Color | Description |
|-------------|---------------|-------|-------------|
| 0.0 | None | Gray | No vulnerability |
| 0.1 - 3.9 | Low | Yellow | Low severity vulnerability |
| 4.0 - 6.9 | Medium | Orange | Medium severity vulnerability |
| 7.0 - 8.9 | High | Red | High severity vulnerability |
| 9.0 - 10.0 | Critical | Purple | Critical severity vulnerability |

## Display Format

### Numeric Scores

When a CVE entry contains a numeric CVSS score (e.g., "7.5"), the application displays:
- The numeric score in a colored badge
- The severity level label (e.g., "High") in a bordered badge with the same color

Example:
```
CVSS_V3: [7.5] [High]
```

### CVSS Vector Strings

Some CVE entries contain CVSS vector strings instead of numeric scores (e.g., "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H"). The application automatically:
- Calculates the numeric score from the CVSS v3.x vector
- Displays the calculated score and severity level
- Provides the full vector string in an expandable "Show CVSS Vector" section

Example:
```
CVSS_V3: [9.8] [Critical]
         ^^^^   ^^^^^^^^^
    (calculated) (interpreted)

▼ Show CVSS Vector
  CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H
```

## Color Coding

The severity levels use the following color schemes:

- **None/Unknown**: Gray background with gray text
- **Low**: Yellow background with yellow text
- **Medium**: Orange background with orange text
- **High**: Red background with red text
- **Critical**: Purple background with purple text

## Implementation

The CVSS interpretation is implemented in `src/lib/cvssUtils.ts` and includes:

- `interpretCVSSScore(score)`: Interprets a numeric CVSS score and returns severity level with styling
- `calculateCVSSv3Score(vector)`: Calculates numeric score from CVSS v3.x vector strings
- `isCVSSVector(scoreString)`: Checks if a score string is a CVSS vector
- `extractCVSSScore(scoreString)`: Extracts numeric score from various formats

### CVSS v3.x Calculation

The calculator implements the official CVSS v3.x specification, including:
- Base metric scoring (Attack Vector, Attack Complexity, Privileges Required, User Interaction)
- Impact metrics (Confidentiality, Integrity, Availability)
- Scope changes (Unchanged vs Changed)
- Proper rounding (ceiling to one decimal place)

## Usage in CVE Viewer

The CVE Viewer component (`src/components/CVEViewer.tsx`) automatically applies CVSS interpretation when displaying vulnerability details. No additional configuration is required.

## References

- [CVSS v3.1 Specification](https://www.first.org/cvss/v3.1/specification-document)
- [CVSS Calculator](https://www.first.org/cvss/calculator/3.1)
