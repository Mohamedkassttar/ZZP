import { supabase } from './supabase';

export interface FinancialMetrics {
  revenue_ytd: number;
  expenses_ytd: number;
  gross_margin: number;
  net_profit: number;
  bank_balance: number;
  accounts_receivable: number;
  accounts_payable: number;
}

export interface FinancialComparison {
  revenue_growth_percent: number;
  expenses_growth_percent: number;
  margin_growth_percent: number;
}

export interface FinancialRatios {
  profit_margin_percent: number;
  runway_months: number;
  working_capital: number;
}

export interface FinancialContext {
  current_year: number;
  previous_year: number;
  status: FinancialMetrics;
  comparison_last_year: FinancialMetrics & FinancialComparison;
  ratios: FinancialRatios;
  insights: string[];
}

async function getAccountBalanceByType(accountType: 'Revenue' | 'Expense' | 'Asset' | 'Liability' | 'Equity', startDate: string, endDate: string): Promise<number> {
  const { data: accounts } = await supabase
    .from('accounts')
    .select('id')
    .eq('type', accountType)
    .eq('is_active', true);

  if (!accounts || accounts.length === 0) return 0;

  const accountIds = accounts.map(a => a.id);

  const { data: lines } = await supabase
    .from('journal_lines')
    .select('debit, credit, journal_entries!inner(entry_date, status)')
    .in('account_id', accountIds)
    .gte('journal_entries.entry_date', startDate)
    .lte('journal_entries.entry_date', endDate)
    .eq('journal_entries.status', 'Final');

  if (!lines || lines.length === 0) return 0;

  return lines.reduce((sum, line) => {
    const debit = parseFloat(line.debit as string);
    const credit = parseFloat(line.credit as string);

    if (accountType === 'Revenue' || accountType === 'Liability' || accountType === 'Equity') {
      return sum + (credit - debit);
    } else {
      return sum + (debit - credit);
    }
  }, 0);
}

async function getMetricsForPeriod(startDate: string, endDate: string): Promise<FinancialMetrics> {
  const revenue = await getAccountBalanceByType('Revenue', startDate, endDate);
  const totalExpenses = await getAccountBalanceByType('Expense', startDate, endDate);

  const grossMargin = revenue;
  const netProfit = revenue - totalExpenses;

  const { data: bankAccounts } = await supabase
    .from('accounts')
    .select('id')
    .eq('type', 'Asset')
    .ilike('name', '%bank%')
    .eq('is_active', true);

  const bankAccountIds = bankAccounts?.map(a => a.id) || [];

  let bankBalance = 0;
  if (bankAccountIds.length > 0) {
    const { data: bankLines } = await supabase
      .from('journal_lines')
      .select('debit, credit, journal_entries!inner(status)')
      .in('account_id', bankAccountIds)
      .eq('journal_entries.status', 'Final');

    if (bankLines) {
      bankBalance = bankLines.reduce((sum, line) => {
        return sum + (parseFloat(line.debit as string) - parseFloat(line.credit as string));
      }, 0);
    }
  }

  const { data: receivableAccounts } = await supabase
    .from('accounts')
    .select('id')
    .eq('type', 'Asset')
    .or('name.ilike.%debiteuren%,name.ilike.%receivable%')
    .eq('is_active', true);

  const receivableAccountIds = receivableAccounts?.map(a => a.id) || [];

  let accountsReceivable = 0;
  if (receivableAccountIds.length > 0) {
    const { data: receivableLines } = await supabase
      .from('journal_lines')
      .select('debit, credit, journal_entries!inner(status)')
      .in('account_id', receivableAccountIds)
      .eq('journal_entries.status', 'Final');

    if (receivableLines) {
      accountsReceivable = receivableLines.reduce((sum, line) => {
        return sum + (parseFloat(line.debit as string) - parseFloat(line.credit as string));
      }, 0);
    }
  }

  const { data: payableAccounts } = await supabase
    .from('accounts')
    .select('id')
    .eq('type', 'Liability')
    .or('name.ilike.%crediteuren%,name.ilike.%payable%')
    .eq('is_active', true);

  const payableAccountIds = payableAccounts?.map(a => a.id) || [];

  let accountsPayable = 0;
  if (payableAccountIds.length > 0) {
    const { data: payableLines } = await supabase
      .from('journal_lines')
      .select('debit, credit, journal_entries!inner(status)')
      .in('account_id', payableAccountIds)
      .eq('journal_entries.status', 'Final');

    if (payableLines) {
      accountsPayable = payableLines.reduce((sum, line) => {
        return sum + (parseFloat(line.credit as string) - parseFloat(line.debit as string));
      }, 0);
    }
  }

  return {
    revenue_ytd: revenue,
    expenses_ytd: totalExpenses,
    gross_margin: grossMargin,
    net_profit: netProfit,
    bank_balance: bankBalance,
    accounts_receivable: accountsReceivable,
    accounts_payable: accountsPayable,
  };
}

export async function getFinancialContext(): Promise<FinancialContext> {
  const currentYear = new Date().getFullYear();
  const previousYear = currentYear - 1;

  const currentYearStart = `${currentYear}-01-01`;
  const currentYearEnd = `${currentYear}-12-31`;
  const previousYearStart = `${previousYear}-01-01`;
  const previousYearEnd = `${previousYear}-12-31`;

  const currentMetrics = await getMetricsForPeriod(currentYearStart, currentYearEnd);
  const previousMetrics = await getMetricsForPeriod(previousYearStart, previousYearEnd);

  const revenueGrowth = previousMetrics.revenue_ytd > 0
    ? ((currentMetrics.revenue_ytd - previousMetrics.revenue_ytd) / previousMetrics.revenue_ytd) * 100
    : 0;

  const expensesGrowth = previousMetrics.expenses_ytd > 0
    ? ((currentMetrics.expenses_ytd - previousMetrics.expenses_ytd) / previousMetrics.expenses_ytd) * 100
    : 0;

  const marginGrowth = previousMetrics.gross_margin > 0
    ? ((currentMetrics.gross_margin - previousMetrics.gross_margin) / previousMetrics.gross_margin) * 100
    : 0;

  const profitMargin = currentMetrics.revenue_ytd > 0
    ? (currentMetrics.net_profit / currentMetrics.revenue_ytd) * 100
    : 0;

  const monthlyExpenses = currentMetrics.expenses_ytd / 12;
  const runway = monthlyExpenses > 0 ? currentMetrics.bank_balance / monthlyExpenses : 999;

  const workingCapital = currentMetrics.bank_balance + currentMetrics.accounts_receivable - currentMetrics.accounts_payable;

  const insights: string[] = [];

  if (revenueGrowth > 10) {
    insights.push(`Sterke omzetgroei van ${revenueGrowth.toFixed(1)}% YoY`);
  } else if (revenueGrowth < -5) {
    insights.push(`Omzet daalt met ${Math.abs(revenueGrowth).toFixed(1)}% YoY - actie nodig`);
  }

  if (expensesGrowth > revenueGrowth && revenueGrowth > 0) {
    insights.push('⚠️ Kosten stijgen sneller dan omzet - margedruk');
  }

  if (runway < 3) {
    insights.push(`⚠️ Liquiditeit: slechts ${runway.toFixed(1)} maanden runway`);
  }

  if (profitMargin < 10 && currentMetrics.revenue_ytd > 0) {
    insights.push('Lage winstmarge - focus op kostenbesparing of prijsverhoging');
  }

  if (currentMetrics.accounts_receivable > currentMetrics.revenue_ytd * 0.2) {
    insights.push('Veel openstaande debiteuren - verbeter creditmanagement');
  }

  return {
    current_year: currentYear,
    previous_year: previousYear,
    status: currentMetrics,
    comparison_last_year: {
      ...previousMetrics,
      revenue_growth_percent: revenueGrowth,
      expenses_growth_percent: expensesGrowth,
      margin_growth_percent: marginGrowth,
    },
    ratios: {
      profit_margin_percent: profitMargin,
      runway_months: runway,
      working_capital: workingCapital,
    },
    insights,
  };
}

export function formatFinancialContextForAI(context: FinancialContext): string {
  return `
FINANCIËLE CONTEXT - ${context.current_year}

════════════════════════════════════════════════════════════
ACTUELE CIJFERS (${context.current_year} YTD)
════════════════════════════════════════════════════════════
• Omzet:              €${context.status.revenue_ytd.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
• Kosten:             €${context.status.expenses_ytd.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
• Bruto Marge:        €${context.status.gross_margin.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
• Netto Winst:        €${context.status.net_profit.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}

════════════════════════════════════════════════════════════
LIQUIDITEIT
════════════════════════════════════════════════════════════
• Banksaldo:          €${context.status.bank_balance.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
• Debiteuren:         €${context.status.accounts_receivable.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
• Crediteuren:        €${context.status.accounts_payable.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
• Werkkapitaal:       €${context.ratios.working_capital.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}

════════════════════════════════════════════════════════════
VERGELIJKING MET ${context.previous_year}
════════════════════════════════════════════════════════════
• Omzetgroei:         ${context.comparison_last_year.revenue_growth_percent > 0 ? '+' : ''}${context.comparison_last_year.revenue_growth_percent.toFixed(1)}%
• Kostengroei:        ${context.comparison_last_year.expenses_growth_percent > 0 ? '+' : ''}${context.comparison_last_year.expenses_growth_percent.toFixed(1)}%
• Marge groei:        ${context.comparison_last_year.margin_growth_percent > 0 ? '+' : ''}${context.comparison_last_year.margin_growth_percent.toFixed(1)}%

════════════════════════════════════════════════════════════
KEY RATIOS
════════════════════════════════════════════════════════════
• Winstmarge:         ${context.ratios.profit_margin_percent.toFixed(1)}%
• Runway:             ${context.ratios.runway_months.toFixed(1)} maanden

════════════════════════════════════════════════════════════
AI INSIGHTS
════════════════════════════════════════════════════════════
${context.insights.map(i => `• ${i}`).join('\n')}
`;
}
