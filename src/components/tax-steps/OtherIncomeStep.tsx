import { Briefcase, Euro } from 'lucide-react';

interface OtherIncomeStepProps {
  hasFiscalPartner: boolean;
  businessProfit: number;
  wageIncome: number;
  onWageIncomeChange: (value: number) => void;
  otherIncome: number;
  onOtherIncomeChange: (value: number) => void;
  partnerWageIncome: number;
  onPartnerWageIncomeChange: (value: number) => void;
  partnerOtherIncome: number;
  onPartnerOtherIncomeChange: (value: number) => void;
}

export function OtherIncomeStep({
  hasFiscalPartner,
  businessProfit,
  wageIncome,
  onWageIncomeChange,
  otherIncome,
  onOtherIncomeChange,
  partnerWageIncome,
  onPartnerWageIncomeChange,
  partnerOtherIncome,
  onPartnerOtherIncomeChange,
}: OtherIncomeStepProps) {
  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <Briefcase className="w-6 h-6 text-blue-600" />
          <h3 className="text-xl font-bold text-slate-900">Overig Inkomen (Box 1)</h3>
        </div>

        <div className={hasFiscalPartner ? 'grid grid-cols-2 gap-6' : ''}>
          <div className="space-y-4">
            {hasFiscalPartner && (
              <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wide border-b border-slate-200 pb-2">
                Jij
              </h4>
            )}

            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Euro className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-medium text-green-900 mb-1">
                    Winst uit Onderneming
                  </div>
                  <div className="text-2xl font-bold text-green-700">
                    €{businessProfit.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-xs text-green-700 mt-1">
                    Berekend uit je administratie
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Loon uit Loondienst
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                  €
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={wageIncome}
                  onChange={(e) => onWageIncomeChange(parseFloat(e.target.value) || 0)}
                  className="w-full pl-8 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Neem dit over van je jaaropgaaf (IB-loon)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Overige Inkomsten
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                  €
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={otherIncome}
                  onChange={(e) => onOtherIncomeChange(parseFloat(e.target.value) || 0)}
                  className="w-full pl-8 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Bijv. uitkeringen, alimentatie, etc.
              </p>
            </div>

            <div className="pt-3 border-t border-slate-200">
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-slate-700">
                  Totaal Inkomen Box 1
                </span>
                <span className="text-lg font-bold text-blue-600">
                  €
                  {(businessProfit + wageIncome + otherIncome).toLocaleString('nl-NL', {
                    minimumFractionDigits: 2,
                  })}
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
                  Loon uit Loondienst
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                    €
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={partnerWageIncome}
                    onChange={(e) =>
                      onPartnerWageIncomeChange(parseFloat(e.target.value) || 0)
                    }
                    className="w-full pl-8 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Partner's jaaropgaaf (IB-loon)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Overige Inkomsten
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                    €
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={partnerOtherIncome}
                    onChange={(e) =>
                      onPartnerOtherIncomeChange(parseFloat(e.target.value) || 0)
                    }
                    className="w-full pl-8 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Bijv. uitkeringen, alimentatie, etc.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-200">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-slate-700">
                    Totaal Inkomen Box 1
                  </span>
                  <span className="text-lg font-bold text-blue-600">
                    €
                    {(partnerWageIncome + partnerOtherIncome).toLocaleString('nl-NL', {
                      minimumFractionDigits: 2,
                    })}
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
