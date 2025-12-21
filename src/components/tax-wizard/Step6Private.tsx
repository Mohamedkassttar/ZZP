import { ChevronLeft, ChevronRight, Home, Users } from 'lucide-react';

interface Step5PrivateProps {
  wozValue: number;
  onWozValueChange: (value: number) => void;
  mortgageInterest: number;
  onMortgageInterestChange: (value: number) => void;
  aovPremium: number;
  onAovPremiumChange: (value: number) => void;
  hasFiscalPartner: boolean;
  onHasFiscalPartnerChange: (value: boolean) => void;
  onBack: () => void;
  onNext: () => void;
}

export function Step5Private({
  wozValue,
  onWozValueChange,
  mortgageInterest,
  onMortgageInterestChange,
  aovPremium,
  onAovPremiumChange,
  hasFiscalPartner,
  onHasFiscalPartnerChange,
  onBack,
  onNext,
}: Step5PrivateProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Privé & Aftrek</h2>
        <p className="text-gray-600">
          Vul je persoonlijke gegevens in voor eigen woning en verzekeringen.
        </p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
        <div className="flex items-start gap-3 p-4 bg-purple-50 rounded-lg border border-purple-200">
          <input
            type="checkbox"
            id="hasFiscalPartner"
            checked={hasFiscalPartner}
            onChange={(e) => onHasFiscalPartnerChange(e.target.checked)}
            className="mt-1 w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
          />
          <div className="flex-1">
            <label htmlFor="hasFiscalPartner" className="flex items-center gap-2 text-sm font-medium text-gray-900 cursor-pointer">
              <Users className="w-4 h-4" />
              Fiscale Partner
            </label>
            <p className="text-xs text-gray-600 mt-1">
              Vink aan als je een fiscaal partner hebt waarmee je gezamenlijk aangifte doet.
            </p>
          </div>
        </div>

        <div className="pt-4 border-t border-gray-200">
          <div className="flex items-center gap-2 mb-4">
            <Home className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Eigen Woning</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                WOZ-waarde
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">€</span>
                <input
                  type="number"
                  value={wozValue}
                  onChange={(e) => onWozValueChange(Number(e.target.value))}
                  className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  step="1000"
                  min="0"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                De WOZ-waarde van je eigen woning
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Hypotheekrente
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">€</span>
                <input
                  type="number"
                  value={mortgageInterest}
                  onChange={(e) => onMortgageInterestChange(Number(e.target.value))}
                  className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  step="100"
                  min="0"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Betaalde hypotheekrente dit jaar
              </p>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Verzekeringen & Aftrek</h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              AOV Premie (Arbeidsongeschiktheidsverzekering)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">€</span>
              <input
                type="number"
                value={aovPremium}
                onChange={(e) => onAovPremiumChange(Number(e.target.value))}
                className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                step="50"
                min="0"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Betaalde premie voor arbeidsongeschiktheidsverzekering (aftrekbaar)
            </p>
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
