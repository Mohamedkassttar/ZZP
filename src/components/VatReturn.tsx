import { useState } from 'react';
import { Calculator, ChevronDown, FileText, TrendingUp, TrendingDown, AlertCircle, RefreshCw } from 'lucide-react';
import { useBtwData } from '../lib/useBtwData';

export function VatReturn() {
  const currentYear = new Date().getFullYear();
  const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3);

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedQuarter, setSelectedQuarter] = useState(currentQuarter);

  const { data, loading, error, refetch } = useBtwData(selectedYear, selectedQuarter);

  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
  const quarters = [
    { value: 1, label: 'Q1 (Jan - Mrt)', period: 'januari t/m maart' },
    { value: 2, label: 'Q2 (Apr - Jun)', period: 'april t/m juni' },
    { value: 3, label: 'Q3 (Jul - Sep)', period: 'juli t/m september' },
    { value: 4, label: 'Q4 (Okt - Dec)', period: 'oktober t/m december' },
  ];

  const selectedQuarterInfo = quarters.find(q => q.value === selectedQuarter);

  if (error) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-start gap-4">
          <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
          <div>
            <h3 className="text-lg font-semibold text-red-900 mb-1">Fout bij laden</h3>
            <p className="text-red-700">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-xl">
              <Calculator className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">BTW Aangifte</h1>
              <p className="text-sm text-slate-600">
                Omzetbelasting overzicht voor aangifte bij de Belastingdienst
              </p>
            </div>
          </div>
          <button
            onClick={() => refetch()}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Ververs
          </button>
        </div>

        <div className="flex gap-4 items-center">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Jaar
            </label>
            <div className="relative">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="appearance-none bg-white border border-slate-300 rounded-lg px-4 py-3 pr-10 text-slate-900 font-semibold focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer min-w-[140px]"
              >
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Kwartaal
            </label>
            <div className="relative">
              <select
                value={selectedQuarter}
                onChange={(e) => setSelectedQuarter(Number(e.target.value))}
                className="appearance-none bg-white border border-slate-300 rounded-lg px-4 py-3 pr-10 text-slate-900 font-semibold focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer min-w-[200px]"
              >
                {quarters.map((quarter) => (
                  <option key={quarter.value} value={quarter.value}>
                    {quarter.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>

        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <div className="flex items-center gap-2 text-blue-900">
            <FileText className="w-5 h-5" />
            <span className="font-semibold">
              Periode: {selectedQuarterInfo?.period} {selectedYear}
            </span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-slate-600">Gegevens laden...</p>
          </div>
        </div>
      ) : (
        <>
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl shadow-xl overflow-hidden mb-6">
            <div className="p-8">
              <h2 className="text-2xl font-bold text-white mb-6">
                Aangifte Omzetbelasting
              </h2>

              <div className="space-y-4">
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
                  <h3 className="text-lg font-bold text-white mb-4">
                    1. Prestaties binnenland
                  </h3>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-white">
                      <div>
                        <span className="font-semibold">1a. Leveringen/diensten belast met hoog tarief (21%)</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 pl-6">
                      <div className="bg-white/10 rounded-lg p-4">
                        <p className="text-sm text-blue-100 mb-1">Omzet</p>
                        <p className="text-2xl font-bold text-white">
                          €{data.omzetHoog.grondslag.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div className="bg-white/10 rounded-lg p-4">
                        <p className="text-sm text-blue-100 mb-1">BTW</p>
                        <p className="text-2xl font-bold text-white">
                          €{data.omzetHoog.btw.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-white pt-3">
                      <div>
                        <span className="font-semibold">1b. Leveringen/diensten belast met laag tarief (9%)</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 pl-6">
                      <div className="bg-white/10 rounded-lg p-4">
                        <p className="text-sm text-blue-100 mb-1">Omzet</p>
                        <p className="text-2xl font-bold text-white">
                          €{data.omzetLaag.grondslag.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div className="bg-white/10 rounded-lg p-4">
                        <p className="text-sm text-blue-100 mb-1">BTW</p>
                        <p className="text-2xl font-bold text-white">
                          €{data.omzetLaag.btw.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>

                    {data.omzetNul.grondslag > 0 && (
                      <>
                        <div className="flex items-center justify-between text-white pt-3">
                          <div>
                            <span className="font-semibold">1c. Leveringen/diensten belast met 0% of niet bij u belast</span>
                          </div>
                        </div>
                        <div className="pl-6">
                          <div className="bg-white/10 rounded-lg p-4">
                            <p className="text-sm text-blue-100 mb-1">Omzet</p>
                            <p className="text-2xl font-bold text-white">
                              €{data.omzetNul.grondslag.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
                  <h3 className="text-lg font-bold text-white mb-4">
                    5. Berekening totaalbedrag
                  </h3>

                  <div className="space-y-3">
                    <div className="bg-white/10 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-white">5a. Verschuldigde omzetbelasting</span>
                        <span className="text-2xl font-bold text-white">
                          €{data.verschuldigd.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    <div className="bg-white/10 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-white">5b. Voorbelasting</span>
                        <span className="text-2xl font-bold text-white">
                          €{data.voorbelasting.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    <div className={`rounded-xl p-6 ${
                      data.totaal > 0
                        ? 'bg-red-500/20 border-2 border-red-300'
                        : 'bg-green-500/20 border-2 border-green-300'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {data.totaal > 0 ? (
                            <TrendingUp className="w-8 h-8 text-white" />
                          ) : (
                            <TrendingDown className="w-8 h-8 text-white" />
                          )}
                          <span className="text-xl font-bold text-white">5c. Totaal</span>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-blue-100 mb-1">
                            {data.totaal > 0 ? 'Te betalen' : 'Terug te vragen'}
                          </p>
                          <p className="text-4xl font-black text-white">
                            €{Math.abs(data.totaal).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="font-semibold text-slate-900">Omzet BTW</h3>
              </div>
              <p className="text-3xl font-bold text-slate-900">
                €{data.verschuldigd.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-sm text-slate-600 mt-1">Verschuldigde BTW uit verkopen</p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <TrendingDown className="w-5 h-5 text-green-600" />
                </div>
                <h3 className="font-semibold text-slate-900">Voorbelasting</h3>
              </div>
              <p className="text-3xl font-bold text-slate-900">
                €{data.voorbelasting.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-sm text-slate-600 mt-1">BTW uit inkopen/kosten</p>
            </div>

            <div className={`rounded-xl shadow-sm p-6 ${
              data.totaal > 0
                ? 'bg-red-50 border border-red-200'
                : 'bg-green-50 border border-green-200'
            }`}>
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 rounded-lg ${
                  data.totaal > 0 ? 'bg-red-100' : 'bg-green-100'
                }`}>
                  <Calculator className={`w-5 h-5 ${
                    data.totaal > 0 ? 'text-red-600' : 'text-green-600'
                  }`} />
                </div>
                <h3 className={`font-semibold ${
                  data.totaal > 0 ? 'text-red-900' : 'text-green-900'
                }`}>
                  {data.totaal > 0 ? 'Te Betalen' : 'Terug te Vragen'}
                </h3>
              </div>
              <p className={`text-3xl font-bold ${
                data.totaal > 0 ? 'text-red-900' : 'text-green-900'
              }`}>
                €{Math.abs(data.totaal).toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
              </p>
              <p className={`text-sm mt-1 ${
                data.totaal > 0 ? 'text-red-700' : 'text-green-700'
              }`}>
                Eindtotaal voor aangifte
              </p>
            </div>
          </div>

          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-900">
                <p className="font-semibold mb-2">Hoe te gebruiken:</p>
                <ol className="list-decimal list-inside space-y-1 text-blue-800">
                  <li>Log in op de website van de Belastingdienst</li>
                  <li>Start je BTW-aangifte voor {selectedQuarterInfo?.period} {selectedYear}</li>
                  <li>Vul de bovenstaande bedragen in op de aangifteformulier</li>
                  <li>Controleer het totaalbedrag (5c) voordat je de aangifte verstuurt</li>
                </ol>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
