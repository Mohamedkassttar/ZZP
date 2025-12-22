import { ChevronLeft, ChevronRight, Scale, TrendingUp, TrendingDown } from 'lucide-react';

interface Step3BalanceProps {
  totalAssets: number;
  onTotalAssetsChange: (value: number) => void;
  totalLiabilities: number;
  onTotalLiabilitiesChange: (value: number) => void;
  startEquity: number;
  onStartEquityChange: (value: number) => void;
  onBack: () => void;
  onNext: () => void;
}

export function Step3Balance({
  totalAssets,
  onTotalAssetsChange,
  totalLiabilities,
  onTotalLiabilitiesChange,
  startEquity,
  onStartEquityChange,
  onBack,
  onNext,
}: Step3BalanceProps) {
  const endEquity = totalAssets - totalLiabilities;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Balans & Vermogen</h2>
        <p className="text-gray-600">
          Deze bedragen zijn berekend vanuit je grootboek. Controleer en pas aan indien nodig.
        </p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
        <div className="flex items-center gap-2 mb-4 pb-4 border-b border-gray-200">
          <Scale className="w-6 h-6 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Balans per 31 December</h3>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-600" />
              Activa (Bezittingen)
            </div>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">€</span>
            <input
              type="number"
              value={totalAssets}
              onChange={(e) => onTotalAssetsChange(Number(e.target.value))}
              className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              step="0.01"
              min="0"
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Totale waarde van alle bezittingen (kas, bank, debiteuren, voorraden, etc.)
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <div className="flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-red-600" />
              Passiva (Schulden)
            </div>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">€</span>
            <input
              type="number"
              value={totalLiabilities}
              onChange={(e) => onTotalLiabilitiesChange(Number(e.target.value))}
              className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              step="0.01"
              min="0"
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Totale waarde van alle schulden (crediteuren, leningen, etc.)
          </p>
        </div>

        <div className="pt-4 border-t border-gray-200">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Begin Eigen Vermogen (1 januari)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">€</span>
              <input
                type="number"
                value={startEquity}
                onChange={(e) => onStartEquityChange(Number(e.target.value))}
                className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                step="0.01"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Het eigen vermogen aan het begin van het jaar (eindvermogen vorig jaar)
            </p>
          </div>
        </div>

        <div className="pt-4 border-t-2 border-gray-300">
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border-2 border-purple-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-600 rounded-lg">
                <Scale className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-gray-600 font-medium">Eind Eigen Vermogen volgens Balans</p>
                <p className="text-xs text-gray-500">Activa - Passiva</p>
              </div>
            </div>
            <div className={`text-2xl font-bold ${endEquity >= 0 ? 'text-purple-600' : 'text-red-600'}`}>
              €{endEquity.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm text-blue-900">
            <strong>Let op:</strong> In de volgende stap vergelijken we dit eindvermogen met de berekening vanuit je winst.
            Dit heet de "Vermogensvergelijking" en controleert of je boekhouding klopt.
          </p>
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
