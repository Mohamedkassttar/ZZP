import { ChevronLeft, ChevronRight, TrendingUp } from 'lucide-react';

interface Step2ProfitProps {
  revenue: number;
  onRevenueChange: (value: number) => void;
  costs: number;
  onCostsChange: (value: number) => void;
  onBack: () => void;
  onNext: () => void;
}

export function Step2Profit({
  revenue,
  onRevenueChange,
  costs,
  onCostsChange,
  onBack,
  onNext,
}: Step2ProfitProps) {
  const profit = revenue - costs;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Winst uit Onderneming</h2>
        <p className="text-gray-600">
          Deze bedragen zijn automatisch berekend vanuit je grootboek. Je kunt ze handmatig aanpassen indien nodig.
        </p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Omzet (Inkomsten)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">€</span>
            <input
              type="number"
              value={revenue}
              onChange={(e) => onRevenueChange(Number(e.target.value))}
              className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              step="0.01"
              min="0"
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Totale omzet uit je onderneming (rekeningen 8xxx)
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Kosten (Uitgaven)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">€</span>
            <input
              type="number"
              value={costs}
              onChange={(e) => onCostsChange(Number(e.target.value))}
              className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              step="0.01"
              min="0"
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Totale kosten van je onderneming (rekeningen 4xxx)
          </p>
        </div>

        <div className="pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-green-50 rounded-lg border-2 border-blue-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600 rounded-lg">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-gray-600 font-medium">Winst uit Onderneming</p>
                <p className="text-xs text-gray-500">Omzet - Kosten</p>
              </div>
            </div>
            <div className={`text-2xl font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              €{profit.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
        >
          <ChevronLeft className="w-5 h-5" />
          Vorige
        </button>
        <button
          onClick={onNext}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          Volgende
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
