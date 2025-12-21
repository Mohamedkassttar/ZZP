import { Wallet, TrendingUp, AlertCircle } from 'lucide-react';

interface AssetsBox3StepProps {
  hasFiscalPartner: boolean;
  savings: number;
  onSavingsChange: (value: number) => void;
  investments: number;
  onInvestmentsChange: (value: number) => void;
  debts: number;
  onDebtsChange: (value: number) => void;
  partnerSavings: number;
  onPartnerSavingsChange: (value: number) => void;
  partnerInvestments: number;
  onPartnerInvestmentsChange: (value: number) => void;
  partnerDebts: number;
  onPartnerDebtsChange: (value: number) => void;
}

const TAX_FREE_AMOUNT = 57000;

export function AssetsBox3Step({
  hasFiscalPartner,
  savings,
  onSavingsChange,
  investments,
  onInvestmentsChange,
  debts,
  onDebtsChange,
  partnerSavings,
  onPartnerSavingsChange,
  partnerInvestments,
  onPartnerInvestmentsChange,
  partnerDebts,
  onPartnerDebtsChange,
}: AssetsBox3StepProps) {
  const totalAssets = savings + investments;
  const netAssets = totalAssets - debts;
  const taxableAssets = Math.max(0, netAssets - TAX_FREE_AMOUNT);

  const partnerTotalAssets = partnerSavings + partnerInvestments;
  const partnerNetAssets = partnerTotalAssets - partnerDebts;
  const partnerTaxableAssets = Math.max(0, partnerNetAssets - TAX_FREE_AMOUNT);

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <Wallet className="w-6 h-6 text-blue-600" />
          <h3 className="text-xl font-bold text-slate-900">Vermogen (Box 3)</h3>
        </div>

        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              Vul hier je vermogen in op <strong>1 januari</strong> van het belastingjaar. Het
              heffingsvrij vermogen is <strong>€{TAX_FREE_AMOUNT.toLocaleString('nl-NL')}</strong>{' '}
              per persoon.
            </div>
          </div>
        </div>

        <div className={hasFiscalPartner ? 'grid grid-cols-2 gap-6' : ''}>
          <div className="space-y-4">
            {hasFiscalPartner && (
              <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wide border-b border-slate-200 pb-2">
                Jij
              </h4>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Spaargeld
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">€</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={savings}
                  onChange={(e) => onSavingsChange(parseFloat(e.target.value) || 0)}
                  className="w-full pl-8 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Saldo op spaarrekeningen en betaalrekeningen
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Beleggingen
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">€</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={investments}
                  onChange={(e) => onInvestmentsChange(parseFloat(e.target.value) || 0)}
                  className="w-full pl-8 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Aandelen, obligaties, crypto, tweede woning, etc.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Schulden</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">€</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={debts}
                  onChange={(e) => onDebtsChange(parseFloat(e.target.value) || 0)}
                  className="w-full pl-8 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Leningen, creditcard schulden (excl. hypotheek)
              </p>
            </div>

            <div className="bg-slate-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Totaal Vermogen</span>
                <span className="font-medium text-slate-900">
                  €{totalAssets.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">- Schulden</span>
                <span className="font-medium text-red-600">
                  €{debts.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">= Netto Vermogen</span>
                <span className="font-medium text-slate-900">
                  €{netAssets.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">- Heffingsvrij</span>
                <span className="font-medium text-green-600">
                  €{TAX_FREE_AMOUNT.toLocaleString('nl-NL')}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-300 flex justify-between">
                <span className="font-semibold text-slate-900">Belastbaar</span>
                <span className="text-lg font-bold text-blue-600">
                  €{taxableAssets.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {hasFiscalPartner && (
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wide border-b border-slate-200 pb-2">
                Partner
              </h4>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Spaargeld
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                    €
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={partnerSavings}
                    onChange={(e) => onPartnerSavingsChange(parseFloat(e.target.value) || 0)}
                    className="w-full pl-8 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Saldo op spaarrekeningen en betaalrekeningen
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Beleggingen
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                    €
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={partnerInvestments}
                    onChange={(e) =>
                      onPartnerInvestmentsChange(parseFloat(e.target.value) || 0)
                    }
                    className="w-full pl-8 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Aandelen, obligaties, crypto, tweede woning, etc.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Schulden</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                    €
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={partnerDebts}
                    onChange={(e) => onPartnerDebtsChange(parseFloat(e.target.value) || 0)}
                    className="w-full pl-8 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Leningen, creditcard schulden (excl. hypotheek)
                </p>
              </div>

              <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Totaal Vermogen</span>
                  <span className="font-medium text-slate-900">
                    €{partnerTotalAssets.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">- Schulden</span>
                  <span className="font-medium text-red-600">
                    €{partnerDebts.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">= Netto Vermogen</span>
                  <span className="font-medium text-slate-900">
                    €{partnerNetAssets.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">- Heffingsvrij</span>
                  <span className="font-medium text-green-600">
                    €{TAX_FREE_AMOUNT.toLocaleString('nl-NL')}
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-300 flex justify-between">
                  <span className="font-semibold text-slate-900">Belastbaar</span>
                  <span className="text-lg font-bold text-blue-600">
                    €
                    {partnerTaxableAssets.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
