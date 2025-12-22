import { useState, useEffect } from 'react';
import { Sparkles, TrendingDown, ArrowLeftRight, Lightbulb } from 'lucide-react';
import {
  optimizeTaxDistribution,
  findOptimalDistribution,
  type TaxOptimizationResult,
} from '../../lib/dutchTaxCalculation';
import { calculateEigenwoningforfait } from '../../lib/dutchTaxCalculation';

interface OptimizationStepProps {
  businessProfit: number;
  wageIncome: number;
  otherIncome: number;
  savings: number;
  investments: number;
  debts: number;
  partnerWageIncome: number;
  partnerOtherIncome: number;
  partnerSavings: number;
  partnerInvestments: number;
  partnerDebts: number;
  wozValue: number;
  mortgageInterest: number;
  splitPercentage: number;
  onSplitPercentageChange: (value: number) => void;
}

export function OptimizationStep({
  businessProfit,
  wageIncome,
  otherIncome,
  savings,
  investments,
  debts,
  partnerWageIncome,
  partnerOtherIncome,
  partnerSavings,
  partnerInvestments,
  partnerDebts,
  wozValue,
  mortgageInterest,
  splitPercentage,
  onSplitPercentageChange,
}: OptimizationStepProps) {
  const [result, setResult] = useState<TaxOptimizationResult | null>(null);
  const [optimalSplit, setOptimalSplit] = useState<number | null>(null);

  const eigenwoningforfait = calculateEigenwoningforfait(wozValue);

  useEffect(() => {
    const userData = {
      wageIncome,
      otherIncome,
      savings,
      investments,
      debts,
    };

    const partnerData = {
      wageIncome: partnerWageIncome,
      otherIncome: partnerOtherIncome,
      savings: partnerSavings,
      investments: partnerInvestments,
      debts: partnerDebts,
    };

    const optimizationResult = optimizeTaxDistribution(
      businessProfit,
      userData,
      partnerData,
      mortgageInterest,
      eigenwoningforfait,
      splitPercentage
    );

    setResult(optimizationResult);

    const optimal = findOptimalDistribution(
      businessProfit,
      userData,
      partnerData,
      mortgageInterest,
      eigenwoningforfait
    );

    setOptimalSplit(optimal.optimalSplit);
  }, [
    businessProfit,
    wageIncome,
    otherIncome,
    savings,
    investments,
    debts,
    partnerWageIncome,
    partnerOtherIncome,
    partnerSavings,
    partnerInvestments,
    partnerDebts,
    wozValue,
    mortgageInterest,
    eigenwoningforfait,
    splitPercentage,
  ]);

  if (!result) {
    return <div>Berekenen...</div>;
  }

  const potentialSavings =
    optimalSplit !== null
      ? Math.abs(
          result.combinedTax -
            optimizeTaxDistribution(
              businessProfit,
              { wageIncome, otherIncome, savings, investments, debts },
              {
                wageIncome: partnerWageIncome,
                otherIncome: partnerOtherIncome,
                savings: partnerSavings,
                investments: partnerInvestments,
                debts: partnerDebts,
              },
              mortgageInterest,
              eigenwoningforfait,
              optimalSplit
            ).combinedTax
        )
      : 0;

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-6 text-white">
        <div className="flex items-center gap-3 mb-4">
          <Sparkles className="w-8 h-8" />
          <h3 className="text-2xl font-bold">Optimalisatie & Verdeling</h3>
        </div>
        <p className="text-blue-100">
          Optimaliseer je belastingaanslag door slim te verdelen tussen jou en je partner.
        </p>
      </div>

      <div className="bg-white border-2 border-blue-200 rounded-xl p-6">
        <div className="text-center mb-6">
          <div className="text-sm font-medium text-slate-600 mb-2">
            Totale Belasting (Gezamenlijk)
          </div>
          <div className="text-4xl font-bold text-slate-900">
            €{result.combinedTax.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
          </div>
        </div>

        {optimalSplit !== null && Math.abs(optimalSplit - splitPercentage) > 1 && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Lightbulb className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-semibold text-amber-900 mb-1">
                  Optimalisatie mogelijk!
                </div>
                <div className="text-sm text-amber-800">
                  Door de verdeling te wijzigen naar <strong>{optimalSplit}%</strong> kun je tot{' '}
                  <strong>
                    €{potentialSavings.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                  </strong>{' '}
                  besparen.
                  <button
                    onClick={() => onSplitPercentageChange(optimalSplit)}
                    className="ml-2 text-amber-900 underline font-semibold hover:text-amber-700"
                  >
                    Toepassen
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-slate-700">Verdeling Aftrekposten</div>
            <div className="text-lg font-bold text-blue-600">{splitPercentage}% / {100 - splitPercentage}%</div>
          </div>

          <div className="relative">
            <input
              type="range"
              min="0"
              max="100"
              value={splitPercentage}
              onChange={(e) => onSplitPercentageChange(parseInt(e.target.value))}
              className="w-full h-3 bg-gradient-to-r from-blue-400 via-slate-300 to-green-400 rounded-lg appearance-none cursor-pointer slider"
              style={{
                background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${splitPercentage}%, #10b981 ${splitPercentage}%, #10b981 100%)`,
              }}
            />
            <div className="flex justify-between text-xs text-slate-600 mt-2">
              <span>Meer naar Partner</span>
              <span>Meer naar Jij</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <ArrowLeftRight className="w-5 h-5 text-blue-600" />
            <h4 className="text-lg font-bold text-slate-900">Jij</h4>
          </div>

          <div className="space-y-3 text-sm">
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase mb-2">
                Box 1 (Werk & Woning)
              </div>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-600">Inkomen</span>
                  <span className="font-medium">
                    €{result.userTax.box1Income.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">- Aftrekposten</span>
                  <span className="font-medium text-green-600">
                    €
                    {result.userTax.box1Deductions.toLocaleString('nl-NL', {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-200">
                  <span className="font-semibold">Belastbaar Inkomen</span>
                  <span className="font-bold">
                    €
                    {result.userTax.box1TaxableIncome.toLocaleString('nl-NL', {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">Belasting Box 1</span>
                  <span className="font-bold text-red-600">
                    €{result.userTax.box1Tax.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-300">
              <div className="text-xs font-semibold text-slate-500 uppercase mb-2">
                Box 3 (Vermogen)
              </div>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-600">Belastbare Grondslag</span>
                  <span className="font-medium">
                    €
                    {result.userTax.box3TaxableBase.toLocaleString('nl-NL', {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">Belasting Box 3</span>
                  <span className="font-bold text-red-600">
                    €{result.userTax.box3Tax.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t-2 border-blue-400">
              <div className="flex justify-between items-center">
                <span className="text-base font-bold text-slate-900">Totale Belasting</span>
                <span className="text-2xl font-bold text-blue-600">
                  €{result.userTax.totalTax.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <ArrowLeftRight className="w-5 h-5 text-green-600" />
            <h4 className="text-lg font-bold text-slate-900">Partner</h4>
          </div>

          <div className="space-y-3 text-sm">
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase mb-2">
                Box 1 (Werk & Woning)
              </div>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-600">Inkomen</span>
                  <span className="font-medium">
                    €
                    {result.partnerTax.box1Income.toLocaleString('nl-NL', {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">- Aftrekposten</span>
                  <span className="font-medium text-green-600">
                    €
                    {result.partnerTax.box1Deductions.toLocaleString('nl-NL', {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-200">
                  <span className="font-semibold">Belastbaar Inkomen</span>
                  <span className="font-bold">
                    €
                    {result.partnerTax.box1TaxableIncome.toLocaleString('nl-NL', {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">Belasting Box 1</span>
                  <span className="font-bold text-red-600">
                    €
                    {result.partnerTax.box1Tax.toLocaleString('nl-NL', {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-300">
              <div className="text-xs font-semibold text-slate-500 uppercase mb-2">
                Box 3 (Vermogen)
              </div>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-600">Belastbare Grondslag</span>
                  <span className="font-medium">
                    €
                    {result.partnerTax.box3TaxableBase.toLocaleString('nl-NL', {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">Belasting Box 3</span>
                  <span className="font-bold text-red-600">
                    €
                    {result.partnerTax.box3Tax.toLocaleString('nl-NL', {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t-2 border-green-400">
              <div className="flex justify-between items-center">
                <span className="text-base font-bold text-slate-900">Totale Belasting</span>
                <span className="text-2xl font-bold text-green-600">
                  €
                  {result.partnerTax.totalTax.toLocaleString('nl-NL', {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {potentialSavings === 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <TrendingDown className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-green-800">
              <strong>Perfect geoptimaliseerd!</strong> De huidige verdeling is al optimaal voor
              jullie situatie.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
