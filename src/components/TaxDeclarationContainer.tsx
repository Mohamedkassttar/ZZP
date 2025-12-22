import { useState, useEffect, useCallback } from 'react';
import { FileText, Loader, CheckCircle, XCircle } from 'lucide-react';
import { useTaxData } from '../lib/useTaxData';
import { useDebouncedSave } from '../lib/useDebouncedSave';
import { supabase } from '../lib/supabase';
import { Step1General } from './tax-wizard/Step1General';
import { Step2Profit } from './tax-wizard/Step2Profit';
import { Step3Investments } from './tax-wizard/Step3Investments';
import { Step3Balance } from './tax-wizard/Step3Balance';
import { Step4Reconciliation } from './tax-wizard/Step4Reconciliation';
import { Step5Private } from './tax-wizard/Step5Private';
import { Step6Summary } from './tax-wizard/Step6Summary';

export function TaxDeclarationContainer() {
  const [currentStep, setCurrentStep] = useState(1);
  const [year, setYear] = useState(new Date().getFullYear() - 1);
  const [hoursCriterion, setHoursCriterion] = useState(false);
  const [isStarter, setIsStarter] = useState(false);
  const [revenue, setRevenue] = useState(0);
  const [costs, setCosts] = useState(0);
  const [totalAssets, setTotalAssets] = useState(0);
  const [totalLiabilities, setTotalLiabilities] = useState(0);
  const [startEquity, setStartEquity] = useState(0);
  const [privateWithdrawals, setPrivateWithdrawals] = useState(0);
  const [privateDeposits, setPrivateDeposits] = useState(0);
  const [investmentsTotal, setInvestmentsTotal] = useState(0);
  const [investmentDeductionKIA, setInvestmentDeductionKIA] = useState(0);
  const [wozValue, setWozValue] = useState(0);
  const [mortgageInterest, setMortgageInterest] = useState(0);
  const [aovPremium, setAovPremium] = useState(0);
  const [hasFiscalPartner, setHasFiscalPartner] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draftLoaded, setDraftLoaded] = useState(false);

  const { data, isLoading, error: fetchError, refetch } = useTaxData(year);

  useEffect(() => {
    async function loadDraftData() {
      try {
        const { data: fiscalYear } = await supabase
          .from('fiscal_years')
          .select('draft_data, current_step')
          .eq('year', year)
          .maybeSingle();

        if (fiscalYear?.draft_data && Object.keys(fiscalYear.draft_data).length > 0) {
          const draft = fiscalYear.draft_data as any;
          if (draft.revenue !== undefined) setRevenue(draft.revenue);
          if (draft.costs !== undefined) setCosts(draft.costs);
          if (draft.totalAssets !== undefined) setTotalAssets(draft.totalAssets);
          if (draft.totalLiabilities !== undefined) setTotalLiabilities(draft.totalLiabilities);
          if (draft.startEquity !== undefined) setStartEquity(draft.startEquity);
          if (draft.privateWithdrawals !== undefined) setPrivateWithdrawals(draft.privateWithdrawals);
          if (draft.privateDeposits !== undefined) setPrivateDeposits(draft.privateDeposits);
          if (draft.wozValue !== undefined) setWozValue(draft.wozValue);
          if (draft.mortgageInterest !== undefined) setMortgageInterest(draft.mortgageInterest);
          if (draft.aovPremium !== undefined) setAovPremium(draft.aovPremium);
          if (draft.investmentsTotal !== undefined) setInvestmentsTotal(draft.investmentsTotal);
          if (draft.investmentDeductionKIA !== undefined) setInvestmentDeductionKIA(draft.investmentDeductionKIA);
          if (draft.hasFiscalPartner !== undefined) setHasFiscalPartner(draft.hasFiscalPartner);
          if (draft.hoursCriterion !== undefined) setHoursCriterion(draft.hoursCriterion);
          if (draft.isStarter !== undefined) setIsStarter(draft.isStarter);
          if (fiscalYear.current_step) setCurrentStep(fiscalYear.current_step);
        }
      } catch (err) {
        console.error('Error loading draft data:', err);
      } finally {
        setDraftLoaded(true);
      }
    }

    loadDraftData();
  }, [year]);

  useEffect(() => {
    if (data && !isLoading && draftLoaded) {
      if (revenue === 0) setRevenue(data.revenue);
      if (costs === 0) setCosts(data.costs);
      if (totalAssets === 0) setTotalAssets(data.totalAssets);
      if (totalLiabilities === 0) setTotalLiabilities(data.totalLiabilities);
      if (startEquity === 0) setStartEquity(data.startEquity);
      if (privateWithdrawals === 0) setPrivateWithdrawals(data.privateWithdrawals);
      if (privateDeposits === 0) setPrivateDeposits(data.privateDeposits);
      if (wozValue === 0) setWozValue(data.wozValue);
      if (mortgageInterest === 0) setMortgageInterest(data.mortgageInterest);
      if (aovPremium === 0) setAovPremium(data.aovPremium);
    }
  }, [data, isLoading, draftLoaded]);

  const draftState = {
    revenue,
    costs,
    totalAssets,
    totalLiabilities,
    startEquity,
    privateWithdrawals,
    privateDeposits,
    investmentsTotal,
    investmentDeductionKIA,
    wozValue,
    mortgageInterest,
    aovPremium,
    hasFiscalPartner,
    hoursCriterion,
    isStarter,
  };

  const saveDraft = useCallback(async (draft: typeof draftState) => {
    if (!draftLoaded) return;

    try {
      const fiscalYearId = data.fiscalYearId;

      if (fiscalYearId) {
        await supabase
          .from('fiscal_years')
          .update({
            draft_data: draft,
            current_step: currentStep,
          })
          .eq('id', fiscalYearId);
      } else {
        await supabase
          .from('fiscal_years')
          .upsert({
            year,
            draft_data: draft,
            current_step: currentStep,
            hours_criterion: hoursCriterion,
            is_starter: isStarter,
          }, { onConflict: 'year' });
      }
    } catch (err) {
      console.error('Error saving draft:', err);
    }
  }, [data.fiscalYearId, year, currentStep, hoursCriterion, isStarter, draftLoaded]);

  useDebouncedSave(draftState, saveDraft, 1000);

  const handleYearChange = (newYear: number) => {
    setYear(newYear);
    setCurrentStep(1);
    setSuccess(null);
    setError(null);
    setDraftLoaded(false);
  };

  const handleNext = () => {
    setCurrentStep((prev) => Math.min(prev + 1, 7));
    setSuccess(null);
    setError(null);
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
    setSuccess(null);
    setError(null);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      let fiscalYearId = data.fiscalYearId;

      if (!fiscalYearId) {
        const { data: newFiscalYear, error: fiscalYearError } = await supabase
          .from('fiscal_years')
          .insert({
            year,
            hours_criterion: hoursCriterion,
            is_starter: isStarter,
            investments_total: investmentsTotal,
            investment_deduction_kia: investmentDeductionKIA,
            wizard_state: {
              currentStep: 7,
              completed: true,
            },
          })
          .select()
          .single();

        if (fiscalYearError) throw fiscalYearError;
        fiscalYearId = newFiscalYear.id;
      } else {
        const { error: updateError} = await supabase
          .from('fiscal_years')
          .update({
            hours_criterion: hoursCriterion,
            is_starter: isStarter,
            investments_total: investmentsTotal,
            investment_deduction_kia: investmentDeductionKIA,
            wizard_state: {
              currentStep: 7,
              completed: true,
            },
          })
          .eq('id', fiscalYearId);

        if (updateError) throw updateError;
      }

      const { data: existingPrivateData } = await supabase
        .from('tax_returns_private')
        .select('id')
        .eq('fiscal_year', year)
        .maybeSingle();

      if (existingPrivateData) {
        const { error: updatePrivateError } = await supabase
          .from('tax_returns_private')
          .update({
            woz_value: wozValue,
            mortgage_interest: mortgageInterest,
            aov_premium: aovPremium,
            has_fiscal_partner: hasFiscalPartner,
          })
          .eq('id', existingPrivateData.id);

        if (updatePrivateError) throw updatePrivateError;
      } else {
        const { error: insertPrivateError } = await supabase
          .from('tax_returns_private')
          .insert({
            fiscal_year: year,
            woz_value: wozValue,
            mortgage_interest: mortgageInterest,
            aov_premium: aovPremium,
            has_fiscal_partner: hasFiscalPartner,
          });

        if (insertPrivateError) throw insertPrivateError;
      }

      setSuccess('Belastingaangifte succesvol opgeslagen!');
      await refetch();
    } catch (err) {
      console.error('Error saving tax declaration:', err);
      setError(err instanceof Error ? err.message : 'Fout bij opslaan van gegevens');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Loader className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Gegevens laden...</p>
          </div>
        </div>
      </div>
    );
  }

  const profit = revenue - costs;
  const balanceEndEquity = totalAssets - totalLiabilities;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <FileText className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">Belastingaangifte IB</h1>
        </div>
        <p className="text-gray-600">Wizard voor Inkomstenbelasting</p>
      </div>

      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div className="text-green-800">{success}</div>
        </div>
      )}

      {(error || fetchError) && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="text-red-800">{error || fetchError}</div>
        </div>
      )}

      <div className="mb-8">
        <div className="flex items-center justify-between">
          {[1, 2, 3, 4, 5, 6, 7].map((step, idx) => (
            <div key={step} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-colors ${
                    currentStep === step
                      ? 'bg-blue-600 text-white'
                      : currentStep > step
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {currentStep > step ? <CheckCircle className="w-5 h-5" /> : step}
                </div>
                <span
                  className={`text-xs mt-2 text-center ${
                    currentStep >= step ? 'text-gray-900 font-medium' : 'text-gray-500'
                  }`}
                >
                  {step === 1 && 'Algemeen'}
                  {step === 2 && 'Winst'}
                  {step === 3 && 'KIA'}
                  {step === 4 && 'Balans'}
                  {step === 5 && 'Check'}
                  {step === 6 && 'Privé'}
                  {step === 7 && 'Resultaat'}
                </span>
              </div>
              {idx < 6 && (
                <div
                  className={`h-1 flex-1 transition-colors ${
                    currentStep > step ? 'bg-green-600' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg p-6">
        {currentStep === 1 && (
          <Step1General
            year={year}
            onYearChange={handleYearChange}
            hoursCriterion={hoursCriterion}
            onHoursCriterionChange={setHoursCriterion}
            isStarter={isStarter}
            onIsStarterChange={setIsStarter}
            onNext={handleNext}
          />
        )}

        {currentStep === 2 && (
          <Step2Profit
            revenue={revenue}
            onRevenueChange={setRevenue}
            costs={costs}
            onCostsChange={setCosts}
            onBack={handleBack}
            onNext={handleNext}
          />
        )}

        {currentStep === 3 && (
          <Step3Investments
            investmentsTotal={investmentsTotal}
            onInvestmentsTotalChange={setInvestmentsTotal}
            investmentDeductionKIA={investmentDeductionKIA}
            onInvestmentDeductionKIAChange={setInvestmentDeductionKIA}
            year={year}
            onBack={handleBack}
            onNext={handleNext}
          />
        )}

        {currentStep === 4 && (
          <Step3Balance
            totalAssets={totalAssets}
            onTotalAssetsChange={setTotalAssets}
            totalLiabilities={totalLiabilities}
            onTotalLiabilitiesChange={setTotalLiabilities}
            startEquity={startEquity}
            onStartEquityChange={setStartEquity}
            onBack={handleBack}
            onNext={handleNext}
          />
        )}

        {currentStep === 5 && (
          <Step4Reconciliation
            startEquity={startEquity}
            profit={profit}
            privateWithdrawals={privateWithdrawals}
            onPrivateWithdrawalsChange={setPrivateWithdrawals}
            privateDeposits={privateDeposits}
            onPrivateDepositsChange={setPrivateDeposits}
            balanceEndEquity={balanceEndEquity}
            onBack={handleBack}
            onNext={handleNext}
          />
        )}

        {currentStep === 6 && (
          <Step5Private
            wozValue={wozValue}
            onWozValueChange={setWozValue}
            mortgageInterest={mortgageInterest}
            onMortgageInterestChange={setMortgageInterest}
            aovPremium={aovPremium}
            onAovPremiumChange={setAovPremium}
            hasFiscalPartner={hasFiscalPartner}
            onHasFiscalPartnerChange={setHasFiscalPartner}
            onBack={handleBack}
            onNext={handleNext}
          />
        )}

        {currentStep === 7 && (
          <Step6Summary
            year={year}
            revenue={revenue}
            costs={costs}
            profit={profit}
            investmentDeductionKIA={investmentDeductionKIA}
            hoursCriterion={hoursCriterion}
            isStarter={isStarter}
            wozValue={wozValue}
            mortgageInterest={mortgageInterest}
            aovPremium={aovPremium}
            hasFiscalPartner={hasFiscalPartner}
            onBack={handleBack}
            onSave={handleSave}
            isSaving={isSaving}
          />
        )}
      </div>
    </div>
  );
}
