import { useState } from 'react';
import { Bug, ChevronDown, ChevronUp } from 'lucide-react';
import { useCompany } from '../lib/CompanyContext';

export function DebugCompanyStatus() {
  const { currentCompany, companies, userRole, loading, isExpert } = useCompany();
  const [isOpen, setIsOpen] = useState(false);

  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-gray-900 text-white px-3 py-2 rounded-lg shadow-lg flex items-center gap-2 hover:bg-gray-800 transition-colors"
        title="Debug Company Status"
      >
        <Bug className="w-4 h-4" />
        <span className="text-xs font-mono">Company Debug</span>
        {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
      </button>

      {isOpen && (
        <div className="absolute bottom-14 right-0 bg-white border border-gray-300 rounded-lg shadow-xl p-4 w-96 max-h-96 overflow-y-auto">
          <h3 className="font-bold text-sm mb-3 text-gray-900">Company Context Status</h3>

          <div className="space-y-3 text-xs">
            <div>
              <p className="font-semibold text-gray-700">Loading:</p>
              <p className="font-mono bg-gray-100 p-2 rounded">{loading ? '🔄 Yes' : '✅ No'}</p>
            </div>

            <div>
              <p className="font-semibold text-gray-700">User Role:</p>
              <p className="font-mono bg-gray-100 p-2 rounded">
                {userRole || '❌ None'}
                {isExpert && ' (Expert ✓)'}
              </p>
            </div>

            <div>
              <p className="font-semibold text-gray-700">Current Company:</p>
              <div className="font-mono bg-gray-100 p-2 rounded">
                {currentCompany ? (
                  <>
                    <p className="font-bold">{currentCompany.name}</p>
                    <p className="text-gray-600 text-xs">ID: {currentCompany.id}</p>
                    <p className="text-gray-600 text-xs">
                      Legal Form: {currentCompany.legal_form || 'N/A'}
                    </p>
                  </>
                ) : (
                  <p className="text-red-600">❌ No company selected</p>
                )}
              </div>
            </div>

            <div>
              <p className="font-semibold text-gray-700">Total Companies:</p>
              <p className="font-mono bg-gray-100 p-2 rounded">{companies.length}</p>
            </div>

            {companies.length > 0 && (
              <div>
                <p className="font-semibold text-gray-700 mb-1">All Companies:</p>
                <div className="space-y-1">
                  {companies.map((company) => (
                    <div
                      key={company.id}
                      className="font-mono bg-gray-50 p-2 rounded border border-gray-200"
                    >
                      <p className="font-bold text-xs">{company.name}</p>
                      <p className="text-gray-500 text-xs truncate">{company.id}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {companies.length === 0 && !loading && (
              <div className="bg-red-50 border border-red-200 rounded p-3">
                <p className="font-bold text-red-800 mb-1">⚠️ No Companies Found</p>
                <p className="text-red-700 text-xs">
                  You may need to run the manual SQL fix. Check MANUAL_USER_FIX.sql
                </p>
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded p-3 mt-3">
              <p className="font-bold text-blue-800 text-xs mb-1">LocalStorage:</p>
              <p className="font-mono text-xs text-blue-700">
                {localStorage.getItem('currentCompanyId') || '❌ Not set'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
