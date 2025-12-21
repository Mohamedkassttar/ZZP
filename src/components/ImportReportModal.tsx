import React from 'react';
import { X, CheckCircle2, AlertCircle, TrendingUp, Zap } from 'lucide-react';
import { ImportAnalysisReport } from '../lib/bankAutomationService';

interface ImportReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: ImportAnalysisReport;
}

export default function ImportReportModal({
  isOpen,
  onClose,
  report,
}: ImportReportModalProps) {
  if (!isOpen) return null;

  const autoBookRate = report.totalProcessed > 0
    ? Math.round((report.autoBooked / report.totalProcessed) * 100)
    : 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">
                Import Analyse Voltooid
              </h2>
              <p className="text-blue-100 text-sm">
                High-Intelligence Automation Engine
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {/* Total Processed */}
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-600">
                  Totaal Verwerkt
                </span>
                <TrendingUp className="w-4 h-4 text-gray-400" />
              </div>
              <div className="text-3xl font-bold text-gray-900">
                {report.totalProcessed}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Transacties geanalyseerd
              </div>
            </div>

            {/* Auto Booked */}
            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-green-700">
                  Automatisch Geboekt
                </span>
                <CheckCircle2 className="w-4 h-4 text-green-500" />
              </div>
              <div className="text-3xl font-bold text-green-900">
                {report.autoBooked}
              </div>
              <div className="text-xs text-green-600 mt-1">
                {autoBookRate}% automatisering
              </div>
            </div>

            {/* Needs Review */}
            <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-amber-700">
                  Controle Vereist
                </span>
                <AlertCircle className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-3xl font-bold text-amber-900">
                {report.needsReview}
              </div>
              <div className="text-xs text-amber-600 mt-1">
                Handmatige beoordeling
              </div>
            </div>
          </div>

          {/* Detailed Breakdown */}
          {report.autoBooked > 0 && (
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200 mb-6">
              <h3 className="text-sm font-semibold text-blue-900 mb-3">
                Automatische Boekingen - Details
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded p-3 border border-blue-100">
                  <div className="text-2xl font-bold text-blue-900">
                    {report.autoBookedDirect}
                  </div>
                  <div className="text-xs text-blue-600 mt-1">
                    Via Directe Route
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Direct naar grootboek
                  </div>
                </div>
                <div className="bg-white rounded p-3 border border-blue-100">
                  <div className="text-2xl font-bold text-blue-900">
                    {report.autoBookedRelation}
                  </div>
                  <div className="text-xs text-blue-600 mt-1">
                    Via Factuur/Relatie Route
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Met relatie & tussenrekening
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Confidence Distribution */}
          {report.details.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Betrouwbaarheid Analyse
              </h3>
              <div className="space-y-2">
                {getConfidenceDistribution(report).map((bucket) => (
                  <div key={bucket.label} className="flex items-center gap-3">
                    <div className="w-32 text-xs text-gray-600">
                      {bucket.label}
                    </div>
                    <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                      <div
                        className={`h-full ${bucket.color} flex items-center justify-end px-2 transition-all`}
                        style={{ width: `${bucket.percentage}%` }}
                      >
                        {bucket.count > 0 && (
                          <span className="text-xs font-medium text-white">
                            {bucket.count}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="w-12 text-xs text-gray-500 text-right">
                      {bucket.percentage}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Errors */}
          {report.errors > 0 && (
            <div className="bg-red-50 rounded-lg p-4 border border-red-200">
              <div className="flex items-center gap-2 text-red-800 mb-2">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm font-semibold">
                  Fouten tijdens verwerking
                </span>
              </div>
              <p className="text-sm text-red-700">
                {report.errors} transactie{report.errors !== 1 ? 's' : ''} kon
                {report.errors === 1 ? '' : 'den'} niet worden verwerkt. Controleer de
                transacties handmatig.
              </p>
            </div>
          )}

          {/* Next Steps */}
          <div className="mt-6 bg-gray-50 rounded-lg p-4 border border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">
              Volgende Stappen
            </h3>
            <ul className="space-y-2 text-sm text-gray-700">
              {report.autoBooked > 0 && (
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>
                    {report.autoBooked} transactie{report.autoBooked !== 1 ? 's' : ''} zijn
                    automatisch geboekt en klaar voor gebruik.
                  </span>
                </li>
              )}
              {report.needsReview > 0 && (
                <li className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  <span>
                    Controleer de {report.needsReview} overgebleven transactie
                    {report.needsReview !== 1 ? 's' : ''} met AI-suggesties.
                  </span>
                </li>
              )}
              <li className="flex items-start gap-2">
                <Zap className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                <span>
                  Het systeem leert van jouw keuzes en wordt automatisch steeds slimmer.
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 flex justify-end border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Sluiten
          </button>
        </div>
      </div>
    </div>
  );
}

function getConfidenceDistribution(report: ImportAnalysisReport) {
  const buckets = [
    {
      label: '90-100% (Excellent)',
      range: [90, 100],
      color: 'bg-green-500',
      count: 0,
    },
    {
      label: '80-89% (Hoog)',
      range: [80, 89],
      color: 'bg-blue-500',
      count: 0,
    },
    {
      label: '60-79% (Matig)',
      range: [60, 79],
      color: 'bg-amber-500',
      count: 0,
    },
    {
      label: '0-59% (Laag)',
      range: [0, 59],
      color: 'bg-red-500',
      count: 0,
    },
  ];

  // Count transactions in each bucket
  report.details.forEach((detail) => {
    const score = detail.confidence.score;
    for (const bucket of buckets) {
      if (score >= bucket.range[0] && score <= bucket.range[1]) {
        bucket.count++;
        break;
      }
    }
  });

  // Calculate percentages
  const total = report.totalProcessed || 1;
  return buckets.map((bucket) => ({
    ...bucket,
    percentage: Math.round((bucket.count / total) * 100),
  }));
}
