import { ChevronLeft, Save, CheckCircle, Calculator, TrendingDown, Coins } from 'lucide-react';

interface Step6SummaryProps {
  year: number;
  revenue: number;
  costs: number;
  profit: number;
  hoursCriterion: boolean;
  isStarter: boolean;
  wozValue: number;
  mortgageInterest: number;
  aovPremium: number;
  hasFiscalPartner: boolean;
  onBack: () => void;
  onSave: () => void;
  isSaving: boolean;
}

export function Step6Summary({
  year,
  revenue,
  costs,
  profit,
  hoursCriterion,
  isStarter,
  wozValue,
  mortgageInterest,
  aovPremium,
  hasFiscalPartner,
  onBack,
  onSave,
  isSaving,
}: Step6SummaryProps) {
  const selfEmployedDeduction = hoursCriterion ? 6670 : 0;
  const starterDeduction = isStarter ? 2123 : 0;
  const totalDeductions = aovPremium + selfEmployedDeduction + starterDeduction;
  const taxableIncome = Math.max(0, profit - totalDeductions);

  const estimatedTax = calculateEstimatedTax(taxableIncome);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Resultaat {year}</h2>
        <p className="text-gray-600">
          Overzicht van je belastingaangifte Inkomstenbelasting (IB).
        </p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-gray-200">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Calculator className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Winst uit Onderneming</h3>
            <p className="text-sm text-gray-600">Box 1 - Belastbaar inkomen</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-center py-2">
            <span className="text-gray-700">Omzet</span>
            <span className="font-semibold text-gray-900">
              €{revenue.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-gray-700">Kosten</span>
            <span className="font-semibold text-red-600">
              -€{costs.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex justify-between items-center py-3 border-t border-gray-200">
            <span className="font-semibold text-gray-900">Winst</span>
            <span className={`font-bold text-lg ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              €{profit.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <div className="pt-4 border-t border-gray-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-green-100 rounded-lg">
              <TrendingDown className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Aftrekposten</h3>
          </div>

          <div className="space-y-3">
            {hoursCriterion && (
              <div className="flex justify-between items-center py-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-gray-700">Zelfstandigenaftrek</span>
                </div>
                <span className="font-semibold text-green-600">
                  -€{selfEmployedDeduction.toLocaleString('nl-NL')}
                </span>
              </div>
            )}
            {isStarter && (
              <div className="flex justify-between items-center py-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-gray-700">Startersaftrek</span>
                </div>
                <span className="font-semibold text-green-600">
                  -€{starterDeduction.toLocaleString('nl-NL')}
                </span>
              </div>
            )}
            {aovPremium > 0 && (
              <div className="flex justify-between items-center py-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-gray-700">AOV Premie</span>
                </div>
                <span className="font-semibold text-green-600">
                  -€{aovPremium.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}
            {totalDeductions === 0 && (
              <p className="text-sm text-gray-500 italic">Geen aftrekposten</p>
            )}
          </div>
        </div>

        <div className="pt-4 border-t-2 border-gray-300">
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border-2 border-blue-300">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600 rounded-lg">
                <Coins className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-gray-600 font-medium">Belastbaar Inkomen</p>
                <p className="text-xs text-gray-500">Na aftrek</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-blue-600">
                €{taxableIncome.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Geschat: ~€{estimatedTax.toLocaleString('nl-NL')} belasting
              </p>
            </div>
          </div>
        </div>

        {hasFiscalPartner && (
          <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
            <p className="text-sm text-purple-900">
              <strong>Let op:</strong> Je hebt aangegeven een fiscaal partner te hebben.
              Overleg met je accountant over de optimale verdeling van inkomen en aftrekposten.
            </p>
          </div>
        )}

        {wozValue > 0 && (
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-900 font-medium mb-2">Eigen Woning</p>
            <div className="space-y-1 text-sm text-blue-800">
              <div className="flex justify-between">
                <span>WOZ-waarde:</span>
                <span>€{wozValue.toLocaleString('nl-NL')}</span>
              </div>
              {mortgageInterest > 0 && (
                <div className="flex justify-between">
                  <span>Hypotheekrente:</span>
                  <span>€{mortgageInterest.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-between">
        <button
          onClick={onBack}
          disabled={isSaving}
          className="flex items-center gap-2 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-5 h-5" />
          Vorige
        </button>
        <button
          onClick={onSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Opslaan...
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              Opslaan & Afronden
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function calculateEstimatedTax(income: number): number {
  if (income <= 0) return 0;
  if (income <= 37149) return income * 0.3693;
  if (income <= 73031) return 13723 + (income - 37149) * 0.3693;
  return 27000 + (income - 73031) * 0.495;
}
