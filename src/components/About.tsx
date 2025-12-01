/**
 * About Component
 * Provides information about the Vulnerability Lookup tool
 */

export function About() {
  return (
    <section className="mt-12 max-w-4xl mx-auto px-4 sm:px-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">About</h2>
        
        <div className="prose prose-sm sm:prose max-w-none text-gray-700 space-y-4">
          <p>
            This tool implements a novel <strong>global history analysis approach</strong> to help developers identify 
            <strong> one-day vulnerabilities</strong> in forked repositories.
          </p>
          
          <p>
            Leveraging the <strong>Software Heritage</strong> universal source code archive, our approach propagates 
            vulnerability information at the commit level across <strong>2.2 million forks</strong>, enabling automatic 
            detection of forked projects that have not incorporated security fixes.
          </p>
          
          <div className="bg-orange-50 border-l-4 border-orange-500 p-4 my-4">
            <p className="text-sm font-semibold text-orange-900 mb-2">What are one-day vulnerabilities?</p>
            <p className="text-sm text-orange-800">
              A repository forked after the introduction of a vulnerability, but before it is patched, may remain 
              vulnerable in the fork well after being fixed in the initial project. These are known as 
              <strong> one-day vulnerabilities</strong>: known, but unpatched vulnerabilities.
            </p>
          </div>
          
          <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Research Paper</h3>
          <p className="text-sm">
            <strong>Did you forket it? Global history analysis to detect one-day vulnerabilities in open source forks</strong>
            <br />
            <span className="text-gray-600">
              Romain Lefeuvre, Charly Reux, Stefano Zacchiroli, Olivier Barais, and Benoit Combemale
            </span>
          </p>
          
          <div className="flex flex-wrap gap-3 mt-6 pt-6 border-t border-gray-200">
            <a
              href="https://www.softwareheritage.org"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-4 py-2 bg-orange-600 text-white text-sm font-semibold rounded-lg hover:bg-orange-700 transition-colors"
            >
              Learn more about Software Heritage
              <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
