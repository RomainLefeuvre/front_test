/**
 * About Component
 * Explains research methodology and context for vulnerability tracking
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
 */

export function About() {
  return (
    <section
      id="about"
      className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 lg:p-8 mt-6 sm:mt-8"
      aria-labelledby="about-heading"
    >
      <h2 id="about-heading" className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4 sm:mb-6">
        About This Research
      </h2>

      {/* Research Context */}
      <div className="prose max-w-none">
        <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mt-4 sm:mt-6 mb-2 sm:mb-3">
          Research Methodology
        </h3>
        <p className="text-sm sm:text-base text-gray-700 leading-relaxed mb-3 sm:mb-4">
          This vulnerability lookup system is based on research from the paper{' '}
          <span className="font-semibold italic">
            "Chasing One-Day Vulnerabilities"
          </span>
          , which investigates how security vulnerabilities propagate through
          forked repositories rather than traditional dependency chains.
        </p>

        <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mt-4 sm:mt-6 mb-2 sm:mb-3">
          Commit-Level Vulnerability Tracking
        </h3>
        <p className="text-sm sm:text-base text-gray-700 leading-relaxed mb-3 sm:mb-4">
          Unlike traditional vulnerability databases that track vulnerabilities
          at the package or project level, this system tracks vulnerabilities at
          the commit level. Each vulnerability is associated with specific
          commits in the Software Heritage archive, enabling precise
          identification of when and where a vulnerability was introduced or
          fixed.
        </p>
        <p className="text-sm sm:text-base text-gray-700 leading-relaxed mb-3 sm:mb-4">
          This commit-level granularity allows us to trace vulnerabilities
          across the entire fork network, identifying repositories that may have
          inherited vulnerable code through forking but never received the
          corresponding security patches.
        </p>

        <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mt-4 sm:mt-6 mb-2 sm:mb-3">
          Fork-Based Vulnerability Propagation
        </h3>
        <p className="text-sm sm:text-base text-gray-700 leading-relaxed mb-3 sm:mb-4">
          When developers fork a repository, they create a snapshot of the code
          at that point in time. If the original repository later receives a
          security patch, that fix does not automatically propagate to forks.
          This creates "one-day vulnerabilities" - vulnerabilities that have been
          publicly disclosed and patched in the original project but remain
          unpatched in forks.
        </p>
        <p className="text-sm sm:text-base text-gray-700 leading-relaxed mb-3 sm:mb-4">
          Our research methodology involves:
        </p>
        <ul className="list-disc list-inside text-sm sm:text-base text-gray-700 space-y-1.5 sm:space-y-2 mb-3 sm:mb-4 ml-2 sm:ml-4">
          <li>
            Analyzing the Software Heritage archive to identify vulnerable
            commits
          </li>
          <li>
            Tracking these commits across fork networks to identify affected
            repositories
          </li>
          <li>
            Determining which branches in each fork contain the vulnerable code
          </li>
          <li>
            Verifying that the vulnerability remains unpatched in the fork
          </li>
        </ul>

        <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mt-4 sm:mt-6 mb-2 sm:mb-3">
          Dataset Statistics
        </h3>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 sm:p-6 mb-3 sm:mb-4">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <dt className="text-xs sm:text-sm font-medium text-gray-600">
                Source Repositories Analyzed
              </dt>
              <dd className="text-2xl sm:text-3xl font-bold text-blue-600 mt-1">7,162</dd>
            </div>
            <div>
              <dt className="text-xs sm:text-sm font-medium text-gray-600">
                Total Forks Analyzed
              </dt>
              <dd className="text-2xl sm:text-3xl font-bold text-blue-600 mt-1">2.2M</dd>
            </div>
            <div>
              <dt className="text-xs sm:text-sm font-medium text-gray-600">
                Potentially Vulnerable Forks Identified
              </dt>
              <dd className="text-2xl sm:text-3xl font-bold text-orange-600 mt-1">135</dd>
            </div>
            <div>
              <dt className="text-xs sm:text-sm font-medium text-gray-600">
                Confirmed High-Severity One-Day Vulnerabilities
              </dt>
              <dd className="text-2xl sm:text-3xl font-bold text-red-600 mt-1">9</dd>
            </div>
          </dl>
        </div>

        <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mt-4 sm:mt-6 mb-2 sm:mb-3">
          How to Use This Tool
        </h3>
        <p className="text-sm sm:text-base text-gray-700 leading-relaxed mb-3 sm:mb-4">
          This lookup system provides two primary search capabilities:
        </p>
        <ul className="list-disc list-inside text-sm sm:text-base text-gray-700 space-y-1.5 sm:space-y-2 mb-3 sm:mb-4 ml-2 sm:ml-4">
          <li>
            <span className="font-semibold">Search by Commit ID:</span> Enter a
            commit SHA (40 or 64 hex characters) to find all known
            vulnerabilities associated with that specific commit.
          </li>
          <li>
            <span className="font-semibold">Search by Repository URL:</span>{' '}
            Enter a repository URL (origin) to discover all vulnerabilities
            affecting that fork, including which branches and commits are
            impacted.
          </li>
        </ul>

        <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mt-4 sm:mt-6 mb-2 sm:mb-3">
          Data Sources
        </h3>
        <p className="text-sm sm:text-base text-gray-700 leading-relaxed mb-3 sm:mb-4">
          The vulnerability data is sourced from:
        </p>
        <ul className="list-disc list-inside text-sm sm:text-base text-gray-700 space-y-1.5 sm:space-y-2 mb-3 sm:mb-4 ml-2 sm:ml-4">
          <li>
            <span className="font-semibold">Software Heritage Archive:</span> A
            comprehensive archive of publicly available source code
          </li>
          <li>
            <span className="font-semibold">CVE Database:</span> Common
            Vulnerabilities and Exposures in OSV (Open Source Vulnerability)
            format
          </li>
          <li>
            <span className="font-semibold">Cherry-pick Analysis:</span> Commit
            tracking to identify security patches and their propagation
          </li>
        </ul>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 sm:p-4 mt-4 sm:mt-6">
          <p className="text-xs sm:text-sm text-gray-700">
            <span className="font-semibold">Note:</span> This is a research
            tool designed to help maintainers identify potential security issues
            in forked repositories. The presence of a vulnerability in this
            database indicates that a vulnerable commit exists in the fork's
            history, but does not necessarily mean the current version is
            vulnerable. Always verify findings and consult the detailed CVE
            information before taking action.
          </p>
        </div>
      </div>
    </section>
  );
}
