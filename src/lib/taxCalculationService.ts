import { supabase } from './supabase';

export interface FiscalYear {
  id: string;
  year: number;
  administration_id: string;
  hours_criterion_met: boolean;
  is_starter: boolean;
  private_use_car_amount: number;
  manual_corrections: number;
  status: 'Open' | 'Finalized';
  current_step?: number;
  draft_data?: any;
  last_updated_at?: string;
}

export interface WizardState {
  currentStep: number;
  year: number;
  hoursCriterion: boolean;
  isStarter: boolean;
  privateUseCar: number;
  manualCorrection: number;
}

export interface TaxCalculation {
  year: number;
  revenue: number;
  expenses: number;
  commercialProfit: number;
  privateUseCar: number;
  manualCorrections: number;
  adjustedProfit: number;
  zelfstandigenaftrek: number;
  startersaftrek: number;
  totalDeductions: number;
  profitAfterDeductions: number;
  mkbWinstvrijstelling: number;
  taxableIncome: number;
  kiaInvestments: number;
  kiaDeduction: number;
}

export interface BalanceSheetCategory {
  category: string;
  amount: number;
  accounts: Array<{
    code: string;
    name: string;
    balance: number;
  }>;
}

export interface TaxBalanceSheet {
  assets: BalanceSheetCategory[];
  liabilities: BalanceSheetCategory[];
  totalAssets: number;
  totalLiabilities: number;
  isBalanced: boolean;
}

const TAX_RATES_2024 = {
  zelfstandigenaftrek: 3750,
  startersaftrek: 2123,
  mkbWinstvrijstellingPercentage: 0.1331,
  kiaPercentage: 0.28,
  kiaMinimum: 2800,
};

export async function calculateFiscalIncome(
  year: number,
  administrationId: string = 'default'
): Promise<TaxCalculation> {
  try {
    const fiscalYear = await supabase
      .from('fiscal_years')
      .select('*')
      .eq('year', year)
      .eq('administration_id', administrationId)
      .maybeSingle();

    const fyData = fiscalYear?.data || {
      hours_criterion_met: false,
      is_starter: false,
      private_use_car_amount: 0,
      manual_corrections: 0,
    };

    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    const revenueAccounts = await supabase
      .from('accounts')
      .select('id')
      .eq('type', 'Revenue')
      .eq('is_active', true);

    const expenseAccounts = await supabase
      .from('accounts')
      .select('id')
      .eq('type', 'Expense')
      .eq('is_active', true);

    let revenue = 0;
    if (revenueAccounts?.data && Array.isArray(revenueAccounts.data)) {
      for (const account of revenueAccounts.data) {
        const { data: entries } = await supabase
          .from('journal_entries')
          .select('credit_amount, debit_amount')
          .eq('account_id', account.id)
          .gte('entry_date', startDate)
          .lte('entry_date', endDate);

        if (entries && Array.isArray(entries)) {
          revenue += entries.reduce(
            (sum, entry) => sum + ((entry?.credit_amount || 0) - (entry?.debit_amount || 0)),
            0
          );
        }
      }
    }

    let expenses = 0;
    if (expenseAccounts?.data && Array.isArray(expenseAccounts.data)) {
      for (const account of expenseAccounts.data) {
        const { data: entries } = await supabase
          .from('journal_entries')
          .select('credit_amount, debit_amount')
          .eq('account_id', account.id)
          .gte('entry_date', startDate)
          .lte('entry_date', endDate);

        if (entries && Array.isArray(entries)) {
          expenses += entries.reduce(
            (sum, entry) => sum + ((entry?.debit_amount || 0) - (entry?.credit_amount || 0)),
            0
          );
        }
      }
    }

    const commercialProfit = revenue - expenses;

    const privateUseCar = fyData?.private_use_car_amount || 0;
    const manualCorrections = fyData?.manual_corrections || 0;
    const adjustedProfit = commercialProfit + privateUseCar + manualCorrections;

    const zelfstandigenaftrek = fyData?.hours_criterion_met
      ? TAX_RATES_2024.zelfstandigenaftrek
      : 0;

    const startersaftrek = fyData?.is_starter ? TAX_RATES_2024.startersaftrek : 0;

    const totalDeductions = zelfstandigenaftrek + startersaftrek;
    const profitAfterDeductions = Math.max(0, adjustedProfit - totalDeductions);

    const mkbWinstvrijstelling =
      profitAfterDeductions * TAX_RATES_2024.mkbWinstvrijstellingPercentage;

    const taxableIncome = profitAfterDeductions - mkbWinstvrijstelling;

    const { data: investments } = await supabase
      .from('fixed_assets')
      .select('purchase_price')
      .gte('purchase_date', startDate)
      .lte('purchase_date', endDate);

    const kiaInvestments = investments && Array.isArray(investments)
      ? investments.reduce((sum, inv) => sum + (inv?.purchase_price || 0), 0)
      : 0;

    const kiaDeduction =
      kiaInvestments > TAX_RATES_2024.kiaMinimum
        ? kiaInvestments * TAX_RATES_2024.kiaPercentage
        : 0;

    return {
      year,
      revenue,
      expenses,
      commercialProfit,
      privateUseCar,
      manualCorrections,
      adjustedProfit,
      zelfstandigenaftrek,
      startersaftrek,
      totalDeductions,
      profitAfterDeductions,
      mkbWinstvrijstelling,
      taxableIncome,
      kiaInvestments,
      kiaDeduction,
    };
  } catch (error) {
    console.error('Error calculating fiscal income:', error);
    return {
      year,
      revenue: 0,
      expenses: 0,
      commercialProfit: 0,
      privateUseCar: 0,
      manualCorrections: 0,
      adjustedProfit: 0,
      zelfstandigenaftrek: 0,
      startersaftrek: 0,
      totalDeductions: 0,
      profitAfterDeductions: 0,
      mkbWinstvrijstelling: 0,
      taxableIncome: 0,
      kiaInvestments: 0,
      kiaDeduction: 0,
    };
  }
}

export async function getTaxBalanceSheet(year: number): Promise<TaxBalanceSheet> {
  try {
    const endDate = `${year}-12-31`;

    const { data: accounts } = await supabase
      .from('accounts')
      .select('*')
      .eq('is_active', true);

    if (!accounts || !Array.isArray(accounts)) {
      return {
        assets: [],
        liabilities: [],
        totalAssets: 0,
        totalLiabilities: 0,
        isBalanced: true,
      };
    }

    const accountBalances = await Promise.all(
      accounts.map(async (account) => {
        const { data: entries } = await supabase
          .from('journal_entries')
          .select('debit_amount, credit_amount')
          .eq('account_id', account.id)
          .lte('entry_date', endDate);

        const balance = entries && Array.isArray(entries)
          ? entries.reduce((sum, entry) => {
              if (account?.type === 'Asset' || account?.type === 'Expense') {
                return sum + ((entry?.debit_amount || 0) - (entry?.credit_amount || 0));
              } else {
                return sum + ((entry?.credit_amount || 0) - (entry?.debit_amount || 0));
              }
            }, 0)
          : 0;

        return {
          ...account,
          balance,
        };
      })
    );

  const categoryMapping: { [key: string]: string[] } = {
    'Materiële Vaste Activa': [],
    'Financiële Vaste Activa': [],
    Voorraden: [],
    Vorderingen: [],
    'Liquide Middelen': [],
    Ondernemingsvermogen: [],
    'Langlopende Schulden': [],
    'Kortlopende Schulden': [],
  };

  const assetCategories = [
    'Materiële Vaste Activa',
    'Financiële Vaste Activa',
    'Voorraden',
    'Vorderingen',
    'Liquide Middelen',
  ];

  const liabilityCategories = [
    'Ondernemingsvermogen',
    'Langlopende Schulden',
    'Kortlopende Schulden',
  ];

    const assets: BalanceSheetCategory[] = assetCategories.map((category) => {
      const categoryAccounts = accountBalances.filter(
        (acc) => acc?.tax_category === category && acc?.balance !== 0
      );

      const amount = categoryAccounts.reduce((sum, acc) => sum + (acc?.balance || 0), 0);

      return {
        category,
        amount,
        accounts: categoryAccounts.map((acc) => ({
          code: acc?.code || '',
          name: acc?.name || '',
          balance: acc?.balance || 0,
        })),
      };
    });

    const liabilities: BalanceSheetCategory[] = liabilityCategories.map((category) => {
      const categoryAccounts = accountBalances.filter(
        (acc) => acc?.tax_category === category && acc?.balance !== 0
      );

      const amount = categoryAccounts.reduce((sum, acc) => sum + (acc?.balance || 0), 0);

      return {
        category,
        amount,
        accounts: categoryAccounts.map((acc) => ({
          code: acc?.code || '',
          name: acc?.name || '',
          balance: acc?.balance || 0,
        })),
      };
    });

    const totalAssets = assets.reduce((sum, cat) => sum + (cat?.amount || 0), 0);
    const totalLiabilities = liabilities.reduce((sum, cat) => sum + (cat?.amount || 0), 0);

    return {
      assets,
      liabilities,
      totalAssets,
      totalLiabilities,
      isBalanced: Math.abs(totalAssets - totalLiabilities) < 0.01,
    };
  } catch (error) {
    console.error('Error getting tax balance sheet:', error);
    return {
      assets: [],
      liabilities: [],
      totalAssets: 0,
      totalLiabilities: 0,
      isBalanced: true,
    };
  }
}

export async function saveFiscalYear(data: Partial<FiscalYear>): Promise<{ success: boolean; error?: string; id?: string }> {
  try {
    const existing = await supabase
      .from('fiscal_years')
      .select('id')
      .eq('year', data.year!)
      .eq('administration_id', data.administration_id || 'default')
      .maybeSingle();

    if (existing.data) {
      const { error } = await supabase
        .from('fiscal_years')
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.data.id);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, id: existing.data.id };
    } else {
      const { data: newData, error } = await supabase
        .from('fiscal_years')
        .insert({
          ...data,
          administration_id: data.administration_id || 'default',
        })
        .select('id')
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, id: newData.id };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function clearAllData(): Promise<{ success: boolean; error?: string }> {
  try {
    await Promise.all([
      supabase.from('journal_entries').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
      supabase.from('bank_transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
      supabase.from('invoices').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
      supabase.from('contacts').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
      supabase.from('fixed_assets').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
      supabase.from('mileage_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
      supabase.from('fiscal_years').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
      supabase.from('bank_rules').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
    ]);

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function loadWizardState(
  year: number,
  administrationId: string = 'default'
): Promise<{ state: WizardState | null; lastUpdated?: string }> {
  try {
    const { data, error } = await supabase
      .from('fiscal_years')
      .select('*')
      .eq('year', year)
      .eq('administration_id', administrationId)
      .maybeSingle();

    if (error || !data) {
      return { state: null };
    }

    const state: WizardState = {
      currentStep: data.current_step || 1,
      year: data.year,
      hoursCriterion: data.hours_criterion_met || false,
      isStarter: data.is_starter || false,
      privateUseCar: data.private_use_car_amount || 0,
      manualCorrection: data.manual_corrections || 0,
    };

    return {
      state,
      lastUpdated: data.last_updated_at,
    };
  } catch (error) {
    return { state: null };
  }
}

export async function saveWizardProgress(
  state: WizardState,
  administrationId: string = 'default'
): Promise<{ success: boolean; error?: string }> {
  try {
    const existing = await supabase
      .from('fiscal_years')
      .select('id')
      .eq('year', state.year)
      .eq('administration_id', administrationId)
      .maybeSingle();

    const dataToSave = {
      year: state.year,
      administration_id: administrationId,
      hours_criterion_met: state.hoursCriterion,
      is_starter: state.isStarter,
      private_use_car_amount: state.privateUseCar,
      manual_corrections: state.manualCorrection,
      current_step: state.currentStep,
      draft_data: state,
      last_updated_at: new Date().toISOString(),
      status: 'Open',
    };

    if (existing.data) {
      const { error } = await supabase
        .from('fiscal_years')
        .update(dataToSave)
        .eq('id', existing.data.id);

      if (error) {
        return { success: false, error: error.message };
      }
    } else {
      const { error } = await supabase
        .from('fiscal_years')
        .insert(dataToSave);

      if (error) {
        return { success: false, error: error.message };
      }
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function resetWizardProgress(
  year: number,
  administrationId: string = 'default'
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('fiscal_years')
      .delete()
      .eq('year', year)
      .eq('administration_id', administrationId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
