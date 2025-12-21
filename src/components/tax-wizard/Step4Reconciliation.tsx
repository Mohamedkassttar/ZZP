import { ChevronLeft, ChevronRight, CheckCircle, AlertTriangle, Calculator, Plus, Minus, Equal } from 'lucide-react';

interface Step4ReconciliationProps {
  startEquity: number;
  profit: number;
  privateWithdrawals: number;
  onPrivateWithdrawalsChange: (value: number) => void;
  privateDeposits: number;
  onPrivateDepositsChange: (value: number) => void;
  balanceEndEquity: number;
  onBack: () => void;
  onNext: () => void;
}

export function Step4Reconciliation({
  startEquity,
  profit,
  privateWithdrawals,
  onPrivateWithdrawalsChange,
  privateDeposits,
  onPrivateDepositsChange,
  balanceEndEquity,
  onBack,
  onNext,
}: Step4ReconciliationProps) {
  const calculatedEndEquity = startEquity + profit + privateDeposits - privateWithdrawals;
  const difference = calculatedEndEquity - balanceEndEquity;
  const isBalanced = Math.abs(difference) < 1;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Vermogensvergelijking</h2>
        <p className="text-gray-600">
          Controleer of je winst overeenkomt met de verandering in je eigen vermogen.
        </p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
        <div className="flex items-center gap-2 mb-4 pb-4 border-b border-gray-200">
          <Calculator className="w-6 h-6 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">De Rondrekening</h3>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Privé Onttrekkingen
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">€</span>
            <input
              type="number"
              value={privateWithdrawals}
              onChange={(e) => onPrivateWithdrawalsChange(Number(e.target.value))}
              className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              step="0.01"
              min="0"
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Bedragen die je voor privédoeleinden uit de zaak hebt gehaald
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Privé Stortingen
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">€</span>
            <input
              type="number"
              value={privateDeposits}
              onChange={(e) => onPrivateDepositsChange(Number(e.target.value))}
              className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              step="0.01"
              min="0"
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Bedragen die je vanuit privé in de zaak hebt gestort
          </p>
        </div>

        <div className="pt-4 border-t-2 border-gray-300">
          <h4 className="text-md font-semibold text-gray-900 mb-4">Berekening Eindvermogen</h4>

          <div className="space-y-3 bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Equal className="w-4 h-4 text-gray-500" />
                <span className="text-gray-700">Begin Eigen Vermogen</span>
              </div>
              <span className="font-semibold text-gray-900">
                €{startEquity.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-green-600" />
                <span className="text-gray-700">Winst</span>
              </div>
              <span className={`font-semibold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                €{profit.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-green-600" />
                <span className="text-gray-700">Privé Stortingen</span>
              </div>
              <span className="font-semibold text-green-600">
                €{privateDeposits.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Minus className="w-4 h-4 text-red-600" />
                <span className="text-gray-700">Privé Onttrekkingen</span>
              </div>
              <span className="font-semibold text-red-600">
                €{privateWithdrawals.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="pt-3 border-t-2 border-gray-300 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Equal className="w-5 h-5 text-blue-600" />
                <span className="text-gray-900 font-semibold">Berekend Eindvermogen</span>
              </div>
              <span className="font-bold text-xl text-blue-600">
                €{calculatedEndEquity.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-gray-200">
          <h4 className="text-md font-semibold text-gray-900 mb-4">Controle</h4>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
              <span className="text-gray-700">Eindvermogen volgens Balans</span>
              <span className="font-semibold text-purple-600">
                €{balanceEndEquity.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
              <span className="text-gray-700">Berekend Eindvermogen</span>
              <span className="font-semibold text-blue-600">
                €{calculatedEndEquity.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
              </span>
            </div>

            {isBalanced ? (
              <div className="p-4 bg-green-50 border-2 border-green-300 rounded-lg">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-8 h-8 text-green-600 flex-shrink-0" />
                  <div>
                    <p className="text-green-900 font-bold text-lg">Je boekhouding klopt!</p>
                    <p className="text-green-700 text-sm mt-1">
                      Het verschil is minder dan €1. De winst komt overeen met de vermogenswijziging.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-red-50 border-2 border-red-300 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-8 h-8 text-red-600 flex-shrink-0 mt-1" />
                  <div className="flex-1">
                    <p className="text-red-900 font-bold text-lg">Verschil geconstateerd</p>
                    <p className="text-red-700 text-sm mt-1">
                      Er is een verschil van €{Math.abs(difference).toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                    </p>
                    <div className="mt-3 p-3 bg-white rounded border border-red-200">
                      <p className="text-sm text-gray-800 font-medium mb-2">Mogelijke oorzaken:</p>
                      <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
                        <li>Privé onttrekkingen of stortingen zijn niet volledig geregistreerd</li>
                        <li>Winst is niet correct berekend (controleer omzet en kosten)</li>
                        <li>Begin eigen vermogen is niet juist ingevuld</li>
                        <li>Er zijn fouten in de balansposten</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}
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
