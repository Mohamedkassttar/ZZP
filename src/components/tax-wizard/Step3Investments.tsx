import { useState, useEffect } from 'react';
import { TrendingUp, Info } from 'lucide-react';
import { calculateKIA, getKIAThresholds } from '../../lib/investmentCalculations';

interface Step3InvestmentsProps {
  investmentsTotal: number;
  onInvestmentsTotalChange: (value: number) => void;
  investmentDeductionKIA: number;
  onInvestmentDeductionKIAChange: (value: number) => void;
  year: number;
  onBack: () => void;
  onNext: () => void;
}

export function Step3Investments({
  investmentsTotal,
  onInvestmentsTotalChange,
  investmentDeductionKIA,
  onInvestmentDeductionKIAChange,
  year,
  onBack,
  onNext,
}: Step3InvestmentsProps) {
  const [localTotal, setLocalTotal] = useState(investmentsTotal.toString());
  const [localDeduction, setLocalDeduction] = useState(investmentDeductionKIA.toString());

  const thresholds = getKIAThresholds(year);

  useEffect(() => {
    const numericTotal = parseFloat(localTotal) || 0;
    const calculatedKIA = calculateKIA(numericTotal, year);
    setLocalDeduction(calculatedKIA.toFixed(2));
    onInvestmentDeductionKIAChange(calculatedKIA);
  }, [localTotal, year]);

  const handleTotalChange = (value: string) => {
    setLocalTotal(value);
    const numericValue = parseFloat(value) || 0;
    onInvestmentsTotalChange(numericValue);
  };

  const handleDeductionChange = (value: string) => {
    setLocalDeduction(value);
    const numericValue = parseFloat(value) || 0;
    onInvestmentDeductionKIAChange(numericValue);
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <TrendingUp className="w-8 h-8 text-blue-600" />
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Stap 3: Investeringen</h2>
          <p className="text-gray-600">Kleinschaligheidsinvesteringsaftrek (KIA)</p>
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-semibold mb-2">KIA Regels ({year})</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Alleen bedrijfsmiddelen duurder dan €450 (excl. BTW)</li>
                <li>Minimale investering: €{thresholds.minimumInvestment.toLocaleString('nl-NL')}</li>
                <li>
                  Investering tussen €{thresholds.minimumInvestment.toLocaleString('nl-NL')} en €
                  {thresholds.maximumForPercentage.toLocaleString('nl-NL')}: {thresholds.percentage * 100}% aftrek
                </li>
                <li>
                  Investering boven €{thresholds.maximumForPercentage.toLocaleString('nl-NL')}: maximaal €
                  {thresholds.maximumDeduction.toLocaleString('nl-NL')} aftrek
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Totaalbedrag Investeringen (excl. BTW)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">€</span>
            <input
              type="number"
              value={localTotal}
              onChange={(e) => handleTotalChange(e.target.value)}
              className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="0,00"
              step="0.01"
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Som van alle investeringen in bedrijfsmiddelen boven €450 (excl. BTW)
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Berekende KIA Aftrek
            <span className="ml-2 text-xs text-gray-500 font-normal">(automatisch berekend, handmatig aanpasbaar)</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">€</span>
            <input
              type="number"
              value={localDeduction}
              onChange={(e) => handleDeductionChange(e.target.value)}
              className="w-full pl-8 pr-3 py-2 border border-green-300 rounded-lg bg-green-50 focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="0,00"
              step="0.01"
            />
          </div>
          <p className="text-xs text-green-600 mt-1">
            Dit bedrag wordt afgetrokken van de fiscale winst
          </p>
        </div>

        {investmentsTotal > 0 && (
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-gray-900">Investeringsaftrek</span>
              <span className="text-2xl font-bold text-green-600">
                - €{parseFloat(localDeduction || '0').toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <p className="text-sm text-gray-600 mt-2">
              Dit bedrag verlaagt je belastbare winst uit onderneming
            </p>
          </div>
        )}
      </div>

      <div className="flex justify-between mt-8">
        <button
          onClick={onBack}
          className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Vorige
        </button>
        <button
          onClick={onNext}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Volgende
        </button>
      </div>
    </div>
  );
}
