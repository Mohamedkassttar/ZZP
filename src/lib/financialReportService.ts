import { supabase } from './supabase';

export interface FinancialContext {
  period: string;
  revenue_ytd: number;
  expenses_ytd: number;
  net_profit_ytd: number;
  bank_balance: number;
  accounts_receivable: number;
  accounts_payable: number;
  total_assets: number;
  total_liabilities: number;
  total_equity: number;
  liquidity_ratio: number | null;
  solvency_ratio: number | null;
  outstanding_invoices_count: number;
  overdue_invoices_count: number;
  monthly_revenue_trend: { month: string; amount: number }[];
  top_expenses: { category: string; amount: number }[];
}

export async function getFinancialContext(
  companyId: string,
  year?: number
): Promise<FinancialContext> {
  if (!companyId) {
    throw new Error('Company ID is required');
  }

  const currentYear = year || new Date().getFullYear();
  const startDate = `${currentYear}-01-01`;
  const endDate = `${currentYear}-12-31`;
  const today = new Date().toISOString().split('T')[0];

  const { data: accounts } = await supabase
    .from('accounts')
    .select('id, code, name, type')
    .eq('company_id', companyId)
    .eq('is_active', true);

  if (!accounts) throw new Error('Failed to load accounts');

  const { data: journalEntries } = await supabase
    .from('journal_entries')
    .select('id, entry_date, status')
    .eq('company_id', companyId)
    .gte('entry_date', startDate)
    .lte('entry_date', endDate)
    .eq('status', 'Final');

  const entryIds = journalEntries?.map((e) => e.id) || [];

  if (entryIds.length === 0) {
    return createEmptyContext(startDate, today);
  }

  const { data: lines } = await supabase
    .from('journal_lines')
    .select('account_id, debit, credit, journal_entry_id')
    .eq('company_id', companyId)
    .in('journal_entry_id', entryIds);

  if (!lines) throw new Error('Failed to load journal lines');

  const accountMap = new Map(accounts.map((acc) => [acc.id, acc]));

  let revenueYTD = 0;
  let expensesYTD = 0;
  let bankBalance = 0;
  let accountsReceivable = 0;
  let accountsPayable = 0;
  let totalAssets = 0;
  let totalLiabilities = 0;

  const monthlyRevenue: { [key: string]: number } = {};
  const expensesByCategory: { [key: string]: number } = {};

  for (const line of lines) {
    const account = accountMap.get(line.account_id);
    if (!account) continue;

    const code = parseInt(account.code);
    const netAmount = Number(line.credit) - Number(line.debit);

    if (code >= 8000 && code <= 8999) {
      revenueYTD += netAmount;

      const entry = journalEntries?.find((e) => e.id === line.journal_entry_id);
      if (entry) {
        const month = entry.entry_date.substring(0, 7);
        monthlyRevenue[month] = (monthlyRevenue[month] || 0) + netAmount;
      }
    }

    if (code >= 4000 && code <= 7999) {
      const expenseAmount = Number(line.debit) - Number(line.credit);
      expensesYTD += expenseAmount;

      const category = getCategoryName(code);
      expensesByCategory[category] = (expensesByCategory[category] || 0) + expenseAmount;
    }

    if (code >= 1000 && code <= 1099) {
      bankBalance += Number(line.debit) - Number(line.credit);
    }

    if (code >= 1300 && code <= 1399) {
      accountsReceivable += Number(line.debit) - Number(line.credit);
    }

    if (code >= 1600 && code <= 1699) {
      accountsPayable += Number(line.credit) - Number(line.debit);
    }

    if (code >= 1000 && code <= 1999) {
      totalAssets += Number(line.debit) - Number(line.credit);
    }

    if (code >= 1600 && code <= 1999) {
      totalLiabilities += Number(line.credit) - Number(line.debit);
    }
  }

  const totalEquity = totalAssets - totalLiabilities;
  const netProfitYTD = revenueYTD - expensesYTD;

  const currentAssets = bankBalance + accountsReceivable;
  const currentLiabilities = accountsPayable;
  const liquidityRatio = currentLiabilities > 0 ? currentAssets / currentLiabilities : null;
  const solvencyRatio = totalAssets > 0 ? totalEquity / totalAssets : null;

  const { data: salesInvoices } = await supabase
    .from('sales_invoices')
    .select('id, status, due_date')
    .eq('company_id', companyId)
    .in('status', ['Sent', 'Overdue']);

  const outstandingCount = salesInvoices?.length || 0;
  const overdueCount =
    salesInvoices?.filter((inv) => inv.status === 'Overdue' || (inv.due_date && inv.due_date < today))
      .length || 0;

  const monthlyRevenueTrend = Object.entries(monthlyRevenue)
    .map(([month, amount]) => ({ month, amount }))
    .sort((a, b) => a.month.localeCompare(b.month));

  const topExpenses = Object.entries(expensesByCategory)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  return {
    period: `${startDate} t/m ${today}`,
    revenue_ytd: Math.round(revenueYTD * 100) / 100,
    expenses_ytd: Math.round(expensesYTD * 100) / 100,
    net_profit_ytd: Math.round(netProfitYTD * 100) / 100,
    bank_balance: Math.round(bankBalance * 100) / 100,
    accounts_receivable: Math.round(accountsReceivable * 100) / 100,
    accounts_payable: Math.round(accountsPayable * 100) / 100,
    total_assets: Math.round(totalAssets * 100) / 100,
    total_liabilities: Math.round(totalLiabilities * 100) / 100,
    total_equity: Math.round(totalEquity * 100) / 100,
    liquidity_ratio: liquidityRatio ? Math.round(liquidityRatio * 100) / 100 : null,
    solvency_ratio: solvencyRatio ? Math.round(solvencyRatio * 100) / 100 : null,
    outstanding_invoices_count: outstandingCount,
    overdue_invoices_count: overdueCount,
    monthly_revenue_trend: monthlyRevenueTrend,
    top_expenses: topExpenses,
  };
}

function getCategoryName(code: number): string {
  if (code >= 4000 && code <= 4999) return 'Inkoop & Voorraad';
  if (code >= 5000 && code <= 5999) return 'Lonen & Personeel';
  if (code >= 6000 && code <= 6999) return 'Huisvesting & Auto';
  if (code >= 7000 && code <= 7999) return 'Overige Bedrijfskosten';
  return 'Overig';
}

function createEmptyContext(startDate: string, today: string): FinancialContext {
  return {
    period: `${startDate} t/m ${today}`,
    revenue_ytd: 0,
    expenses_ytd: 0,
    net_profit_ytd: 0,
    bank_balance: 0,
    accounts_receivable: 0,
    accounts_payable: 0,
    total_assets: 0,
    total_liabilities: 0,
    total_equity: 0,
    liquidity_ratio: null,
    solvency_ratio: null,
    outstanding_invoices_count: 0,
    overdue_invoices_count: 0,
    monthly_revenue_trend: [],
    top_expenses: [],
  };
}

export function formatFinancialContextForAI(context: FinancialContext): string {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercentage = (ratio: number | null) => {
    if (ratio === null) return 'n.v.t.';
    return `${Math.round(ratio * 100)}%`;
  };

  let summary = `FINANCIËLE CONTEXT BEDRIJF (Vertrouwelijk)\n`;
  summary += `Periode: ${context.period}\n\n`;

  summary += `WINST & VERLIES:\n`;
  summary += `- Omzet (YTD): ${formatCurrency(context.revenue_ytd)}\n`;
  summary += `- Kosten (YTD): ${formatCurrency(context.expenses_ytd)}\n`;
  summary += `- Nettowinst (YTD): ${formatCurrency(context.net_profit_ytd)}\n\n`;

  summary += `LIQUIDITEIT:\n`;
  summary += `- Banksaldo: ${formatCurrency(context.bank_balance)}\n`;
  summary += `- Openstaande debiteuren: ${formatCurrency(context.accounts_receivable)}\n`;
  summary += `- Openstaande crediteuren: ${formatCurrency(context.accounts_payable)}\n`;
  summary += `- Current Ratio (liquiditeit): ${formatPercentage(context.liquidity_ratio)}\n\n`;

  summary += `BALANS:\n`;
  summary += `- Totaal Activa: ${formatCurrency(context.total_assets)}\n`;
  summary += `- Totaal Passiva: ${formatCurrency(context.total_liabilities)}\n`;
  summary += `- Eigen Vermogen: ${formatCurrency(context.total_equity)}\n`;
  summary += `- Solvabiliteit: ${formatPercentage(context.solvency_ratio)}\n\n`;

  summary += `FACTUREN:\n`;
  summary += `- Openstaande facturen: ${context.outstanding_invoices_count}\n`;
  summary += `- Achterstallige facturen: ${context.overdue_invoices_count}\n\n`;

  if (context.top_expenses.length > 0) {
    summary += `TOP KOSTENPOSTEN:\n`;
    context.top_expenses.forEach((exp) => {
      summary += `- ${exp.category}: ${formatCurrency(exp.amount)}\n`;
    });
    summary += `\n`;
  }

  if (context.monthly_revenue_trend.length > 0) {
    summary += `OMZET TREND (per maand):\n`;
    context.monthly_revenue_trend.slice(-6).forEach((trend) => {
      summary += `- ${trend.month}: ${formatCurrency(trend.amount)}\n`;
    });
  }

  return summary;
}
