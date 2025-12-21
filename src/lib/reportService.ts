import { supabase } from './supabase';

export interface VATReport {
  period: string;
  box1_revenue: number;
  box1_vat: number;
  box5b_vat_receivable: number;
  net_payable: number;
}

export interface ProfitLossAccountItem {
  id: string;
  code: string;
  name: string;
  amount: number;
}

export interface ProfitLossCategoryGroup {
  category: string;
  accounts: ProfitLossAccountItem[];
  total: number;
}

export interface ProfitLossReport {
  period: string;
  revenue_groups: ProfitLossCategoryGroup[];
  expense_groups: ProfitLossCategoryGroup[];
  total_revenue: number;
  total_expenses: number;
  net_profit: number;
}

export interface BalanceSheetAccountItem {
  id: string;
  code: string;
  name: string;
  eindbalans: number;
}

export interface BalanceSheetCategoryGroup {
  category: string;
  accounts: BalanceSheetAccountItem[];
  total: number;
}

export interface BalanceSheetReport {
  period: string;
  asset_groups: BalanceSheetCategoryGroup[];
  liability_groups: BalanceSheetCategoryGroup[];
  equity_groups: BalanceSheetCategoryGroup[];
  total_assets: number;
  total_liabilities: number;
  total_equity: number;
  total_liabilities_equity: number;
  difference: number;
}

export async function generateVATReport(
  startDate: string,
  endDate: string
): Promise<VATReport> {
  const { data: accounts } = await supabase
    .from('accounts')
    .select('id, code, name, type');

  if (!accounts) throw new Error('Failed to load accounts');

  const { data: journalEntries } = await supabase
    .from('journal_entries')
    .select('id, entry_date, status')
    .gte('entry_date', startDate)
    .lte('entry_date', endDate)
    .eq('status', 'Final');

  const entryIds = journalEntries?.map((e) => e.id) || [];

  if (entryIds.length === 0) {
    return {
      period: `${startDate} - ${endDate}`,
      box1_revenue: 0,
      box1_vat: 0,
      box5b_vat_receivable: 0,
      net_payable: 0,
    };
  }

  const { data: lines } = await supabase
    .from('journal_lines')
    .select('account_id, debit, credit')
    .in('journal_entry_id', entryIds);

  if (!lines) throw new Error('Failed to load journal lines');

  let box1_revenue = 0;
  let box1_vat = 0;
  let box5b_vat_receivable = 0;

  const accountMap = new Map(accounts.map((a) => [a.id, a]));

  for (const line of lines) {
    const account = accountMap.get(line.account_id);
    if (!account) continue;

    const netAmount = line.credit - line.debit;

    if (account.type === 'Revenue') {
      box1_revenue += netAmount;
    }

    if (account.code === '1400') {
      box1_vat += netAmount;
    }

    if (account.code === '1300') {
      box5b_vat_receivable += line.debit - line.credit;
    }
  }

  const net_payable = box1_vat - box5b_vat_receivable;

  return {
    period: `${startDate} - ${endDate}`,
    box1_revenue,
    box1_vat,
    box5b_vat_receivable,
    net_payable,
  };
}

export async function generateProfitLossReport(
  startDate: string,
  endDate: string
): Promise<ProfitLossReport> {
  const { data: accounts } = await supabase
    .from('accounts')
    .select('*')
    .in('type', ['Revenue', 'Expense'])
    .eq('is_active', true);

  if (!accounts) throw new Error('Failed to load accounts');

  const { data: periodLines } = await supabase
    .from('journal_lines')
    .select('*, journal_entries!inner(*)')
    .gte('journal_entries.entry_date', startDate)
    .lte('journal_entries.entry_date', endDate)
    .eq('journal_entries.status', 'Final');

  if (!periodLines) throw new Error('Failed to load journal lines');

  const accountTotals = new Map<string, number>();

  for (const line of periodLines) {
    const account = accounts.find((a) => a.id === line.account_id);
    if (!account) continue;

    const current = accountTotals.get(line.account_id) || 0;

    if (account.type === 'Revenue') {
      accountTotals.set(line.account_id, current + Number(line.credit) - Number(line.debit));
    } else if (account.type === 'Expense') {
      accountTotals.set(line.account_id, current + Number(line.debit) - Number(line.credit));
    }
  }

  const revenueAccounts = accounts
    .filter((a) => a.type === 'Revenue')
    .map((a) => ({
      id: a.id,
      code: a.code,
      name: a.name,
      tax_category: a.tax_category || 'Overig',
      amount: accountTotals.get(a.id) || 0,
    }))
    .filter((a) => a.amount !== 0)
    .sort((a, b) => parseInt(a.code) - parseInt(b.code));

  const expenseAccounts = accounts
    .filter((a) => a.type === 'Expense')
    .map((a) => ({
      id: a.id,
      code: a.code,
      name: a.name,
      tax_category: a.tax_category || 'Overig',
      amount: accountTotals.get(a.id) || 0,
    }))
    .filter((a) => a.amount !== 0)
    .sort((a, b) => parseInt(a.code) - parseInt(b.code));

  const revenue_groups = groupByCategory(revenueAccounts);
  const expense_groups = groupByCategory(expenseAccounts);

  const total_revenue = revenue_groups.reduce((sum, g) => sum + g.total, 0);
  const total_expenses = expense_groups.reduce((sum, g) => sum + g.total, 0);

  return {
    period: `${startDate} - ${endDate}`,
    revenue_groups,
    expense_groups,
    total_revenue,
    total_expenses,
    net_profit: total_revenue - total_expenses,
  };
}

function groupByCategory(accounts: Array<{ id: string; code: string; name: string; tax_category: string; amount: number }>): ProfitLossCategoryGroup[] {
  const categoryMap = new Map<string, ProfitLossAccountItem[]>();

  for (const acc of accounts) {
    const category = acc.tax_category;
    if (!categoryMap.has(category)) {
      categoryMap.set(category, []);
    }
    categoryMap.get(category)!.push({
      id: acc.id,
      code: acc.code,
      name: acc.name,
      amount: acc.amount,
    });
  }

  return Array.from(categoryMap.entries()).map(([category, accounts]) => ({
    category,
    accounts,
    total: accounts.reduce((sum, a) => sum + a.amount, 0),
  }));
}

export async function generateBalanceSheet(
  startDate: string,
  endDate: string
): Promise<BalanceSheetReport> {
  const { data: accounts } = await supabase
    .from('accounts')
    .select('*')
    .in('type', ['Asset', 'Liability', 'Equity'])
    .eq('is_active', true);

  if (!accounts) throw new Error('Failed to load accounts');

  const { data: allLines } = await supabase
    .from('journal_lines')
    .select('*, journal_entries!inner(*)')
    .lte('journal_entries.entry_date', endDate)
    .eq('journal_entries.status', 'Final');

  if (!allLines) throw new Error('Failed to load journal lines');

  const endBalances = new Map<string, number>();

  for (const line of allLines) {
    const account = accounts.find((a) => a.id === line.account_id);
    if (!account) continue;

    const current = endBalances.get(line.account_id) || 0;

    if (account.type === 'Asset') {
      endBalances.set(line.account_id, current + Number(line.debit) - Number(line.credit));
    } else if (account.type === 'Liability' || account.type === 'Equity') {
      endBalances.set(line.account_id, current + Number(line.credit) - Number(line.debit));
    }
  }

  const assetAccounts = accounts
    .filter((a) => a.type === 'Asset')
    .map((a) => ({
      id: a.id,
      code: a.code,
      name: a.name,
      tax_category: a.tax_category || 'Overig',
      eindbalans: endBalances.get(a.id) || 0,
    }))
    .filter((a) => a.eindbalans !== 0)
    .sort((a, b) => parseInt(a.code) - parseInt(b.code));

  const liabilityAccounts = accounts
    .filter((a) => a.type === 'Liability')
    .map((a) => ({
      id: a.id,
      code: a.code,
      name: a.name,
      tax_category: a.tax_category || 'Overig',
      eindbalans: endBalances.get(a.id) || 0,
    }))
    .filter((a) => a.eindbalans !== 0)
    .sort((a, b) => parseInt(a.code) - parseInt(b.code));

  const equityAccounts = accounts
    .filter((a) => a.type === 'Equity')
    .map((a) => ({
      id: a.id,
      code: a.code,
      name: a.name,
      tax_category: a.tax_category || 'Overig',
      eindbalans: endBalances.get(a.id) || 0,
    }))
    .filter((a) => a.eindbalans !== 0)
    .sort((a, b) => parseInt(a.code) - parseInt(b.code));

  const asset_groups = groupByCategoryForBalance(assetAccounts);
  const liability_groups = groupByCategoryForBalance(liabilityAccounts);
  const equity_groups = groupByCategoryForBalance(equityAccounts);

  const total_assets = asset_groups.reduce((sum, g) => sum + g.total, 0);
  const total_liabilities = liability_groups.reduce((sum, g) => sum + g.total, 0);
  const total_equity = equity_groups.reduce((sum, g) => sum + g.total, 0);
  const total_liabilities_equity = total_liabilities + total_equity;

  return {
    period: `${startDate} - ${endDate}`,
    asset_groups,
    liability_groups,
    equity_groups,
    total_assets,
    total_liabilities,
    total_equity,
    total_liabilities_equity,
    difference: Math.abs(total_assets - total_liabilities_equity),
  };
}

function groupByCategoryForBalance(accounts: Array<{ id: string; code: string; name: string; tax_category: string; eindbalans: number }>): BalanceSheetCategoryGroup[] {
  const categoryMap = new Map<string, BalanceSheetAccountItem[]>();

  for (const acc of accounts) {
    const category = acc.tax_category;
    if (!categoryMap.has(category)) {
      categoryMap.set(category, []);
    }
    categoryMap.get(category)!.push({
      id: acc.id,
      code: acc.code,
      name: acc.name,
      eindbalans: acc.eindbalans,
    });
  }

  return Array.from(categoryMap.entries()).map(([category, accounts]) => ({
    category,
    accounts,
    total: accounts.reduce((sum, a) => sum + a.eindbalans, 0),
  }));
}
