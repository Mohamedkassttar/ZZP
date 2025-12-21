import { Home, TrendingDown, Calculator } from 'lucide-react';
import { calculateEigenwoningforfait } from '../../lib/dutchTaxCalculation';

interface HomeMortgageStepProps {
  wozValue: number;
  onWozValueChange: (value: number) => void;
  mortgageInterest: number;
  onMortgageInterestChange: (value: number) => void;
}

export function HomeMortgageStep({
  wozValue,
  onWozValueChange,
  mortgageInterest,
  onMortgageInterestChange,
}: HomeMortgageStepProps) {
  const eigenwoningforfait = calculateEigenwoningforfait(wozValue);
  const netDeduction = Math.max(0, mortgageInterest - eigenwoningforfait);

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <Home className="w-6 h-6 text-blue-600" />
          <h3 className="text-xl font-bold text-slate-900">Eigen Woning</h3>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              WOZ Waarde
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">€</span>
              <input
                type="number"
                min="0"
                step="1000"
                value={wozValue}
                onChange={(e) => onWozValueChange(parseFloat(e.target.value) || 0)}
                className="w-full pl-8 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <p className="mt-1 text-xs text-slate-500">
              De vastgestelde WOZ-waarde per 1 januari van het belastingjaar
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Betaalde Hypotheekrente
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">€</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={mortgageInterest}
                onChange={(e) => onMortgageInterestChange(parseFloat(e.target.value) || 0)}
                className="w-full pl-8 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Totaal betaalde hypotheekrente in het belastingjaar
            </p>
          </div>

          <div className="bg-slate-50 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2 mb-3">
              <Calculator className="w-5 h-5 text-slate-600" />
              <span className="text-sm font-semibold text-slate-700">Berekening</span>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Betaalde Hypotheekrente</span>
                <span className="font-medium text-slate-900">
                  €{mortgageInterest.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-slate-600">
                  - Eigenwoningforfait (0.35% van WOZ)
                </span>
                <span className="font-medium text-red-600">
                  €{eigenwoningforfait.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="pt-2 border-t border-slate-300 flex justify-between items-center">
                <span className="font-semibold text-slate-900">Netto Aftrek</span>
                <span className="text-lg font-bold text-green-600">
                  €{netDeduction.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {netDeduction > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <TrendingDown className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-green-800">
                  <strong>Goed nieuws!</strong> Je kunt{' '}
                  <strong>
                    €{netDeduction.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                  </strong>{' '}
                  aftrekken van je belastbaar inkomen. Bij fiscaal partnerschap kun je in de
                  volgende stap optimaliseren hoe je dit verdeelt.
                </div>
              </div>
            </div>
          )}

          {netDeduction <= 0 && mortgageInterest > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <TrendingDown className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800">
                  <strong>Let op:</strong> Je eigenwoningforfait is hoger dan je hypotheekrente.
                  Dit betekent dat je geen aftrek krijgt, maar een bijtel moet betalen.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
