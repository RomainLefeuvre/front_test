/**
 * Severity Badge Component
 * Displays color-coded severity badges for vulnerabilities
 * Requirements: 12.2, 12.3, 12.4
 */

export interface SeverityBadgeProps {
  severity?: string;
  cvssScore?: number;
  size?: 'sm' | 'md' | 'lg';
}

export function SeverityBadge({ severity, cvssScore, size = 'md' }: SeverityBadgeProps) {
  // Determine severity level and styling
  const severityLevel = severity || 'Unknown';
  
  // Get color scheme based on severity
  const getColorClasses = () => {
    switch (severityLevel.toLowerCase()) {
      case 'critical':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'high':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'medium':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'low':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'none':
        return 'bg-gray-100 text-gray-800 border-gray-300';
      default:
        return 'bg-gray-100 text-gray-600 border-gray-300';
    }
  };

  // Size classes
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
    lg: 'px-3 py-1.5 text-base',
  };

  const colorClasses = getColorClasses();
  const sizeClass = sizeClasses[size];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border font-medium ${colorClasses} ${sizeClass}`}
      title={cvssScore !== undefined ? `CVSS Score: ${cvssScore.toFixed(1)}` : undefined}
    >
      <span className="font-semibold">{severityLevel.toUpperCase()}</span>
      {cvssScore !== undefined && (
        <span className="font-mono text-xs opacity-90">
          {cvssScore.toFixed(1)}
        </span>
      )}
    </span>
  );
}
