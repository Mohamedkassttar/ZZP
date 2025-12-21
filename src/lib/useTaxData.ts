import { useState, useEffect } from 'react';
import { supabase } from './supabase';

export interface TaxData {
  fiscalYearId: string | null;
  revenue: number;
  costs: number;
  profit: number;
  wozValue: number;
  mortgageInterest: number;
  aovPremium: number;
  hasFiscalPartner: boolean;
  hoursCriterion: boolean;
  isStarter: boolean;
  totalAssets: number;
  totalLiabilities: number;
  privateWithdrawals: number;
  privateDeposits: number;
  startEquity: number;
}

export interface TaxDataResult {
  data: TaxData;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useTaxData(year: number): TaxDataResult {
  const [data, setData] = useState<TaxData>({
    fiscalYearId: null,
    revenue: 0,
    costs: 0,
    profit: 0,
    wozValue: 0,
    mortgageInterest: 0,
    aovPremium: 0,
    hasFiscalPartner: false,
    hoursCriterion: false,
    isStarter: false,
    totalAssets: 0,
    totalLiabilities: 0,
    privateWithdrawals: 0,
    privateDeposits: 0,
    startEquity: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data: fiscalYear } = await supabase
        .from('fiscal_years')
        .select('*')
        .eq('year', year)
        .maybeSingle();

      let revenue = 0;
      let costs = 0;
      let totalAssets = 0;
      let totalLiabilities = 0;
      let privateWithdrawals = 0;
      let privateDeposits = 0;
      let startEquity = 0;

      const { data: accounts } = await supabase
        .from('accounts')
        .select('*')
        .eq('is_active', true);

      if (accounts) {
        const revenueAccountIds = accounts.filter(a => a.type === 'Revenue').map(a => a.id);
        const expenseAccountIds = accounts.filter(a => a.type === 'Expense').map(a => a.id);
        const assetAccountIds = accounts.filter(a => a.type === 'Asset').map(a => a.id);
        const liabilityAccountIds = accounts.filter(a => a.type === 'Liability').map(a => a.id);
        const privateAccountIds = accounts.filter(a =>
          a.name?.toLowerCase().includes('privé') ||
          a.name?.toLowerCase().includes('prive')
        ).map(a => a.id);

        const { data: yearLines } = await supabase
          .from('journal_lines')
          .select('account_id, debit, credit, journal_entries!inner(entry_date)')
          .gte('journal_entries.entry_date', `${year}-01-01`)
          .lte('journal_entries.entry_date', `${year}-12-31`);

        if (yearLines) {
          for (const line of yearLines) {
            const netAmount = line.debit - line.credit;

            if (revenueAccountIds.includes(line.account_id)) {
              revenue += Math.abs(line.credit - line.debit);
            }
            if (expenseAccountIds.includes(line.account_id)) {
              costs += Math.abs(line.debit - line.credit);
            }
            if (privateAccountIds.includes(line.account_id)) {
              if (netAmount > 0) {
                privateWithdrawals += netAmount;
              } else {
                privateDeposits += -netAmount;
              }
            }
          }
        }

        const { data: balanceLines } = await supabase
          .from('journal_lines')
          .select('account_id, debit, credit, journal_entries!inner(entry_date)')
          .lte('journal_entries.entry_date', `${year}-12-31`);

        if (balanceLines) {
          for (const line of balanceLines) {
            const netAmount = line.debit - line.credit;

            if (assetAccountIds.includes(line.account_id)) {
              totalAssets += netAmount;
            }
            if (liabilityAccountIds.includes(line.account_id)) {
              totalLiabilities += -netAmount;
            }
          }
        }

        const { data: prevYearLines } = await supabase
          .from('journal_lines')
          .select('account_id, debit, credit, journal_entries!inner(entry_date)')
          .lt('journal_entries.entry_date', `${year}-01-01`);

        if (prevYearLines) {
          let prevAssets = 0;
          let prevLiabilities = 0;

          for (const line of prevYearLines) {
            const netAmount = line.debit - line.credit;

            if (assetAccountIds.includes(line.account_id)) {
              prevAssets += netAmount;
            }
            if (liabilityAccountIds.includes(line.account_id)) {
              prevLiabilities += -netAmount;
            }
          }

          startEquity = prevAssets - prevLiabilities;
        }
      }

      const profit = revenue - costs;

      const { data: privateTaxData } = await supabase
        .from('tax_returns_private')
        .select('*')
        .eq('fiscal_year', year)
        .maybeSingle();

      setData({
        fiscalYearId: fiscalYear?.id || null,
        revenue,
        costs,
        profit,
        wozValue: privateTaxData?.woz_value || 0,
        mortgageInterest: privateTaxData?.mortgage_interest || 0,
        aovPremium: privateTaxData?.aov_premium || 0,
        hasFiscalPartner: privateTaxData?.has_fiscal_partner || false,
        hoursCriterion: fiscalYear?.hours_criterion || false,
        isStarter: fiscalYear?.is_starter || false,
        totalAssets,
        totalLiabilities,
        privateWithdrawals,
        privateDeposits,
        startEquity,
      });
    } catch (err) {
      console.error('Error fetching tax data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load tax data');
      setData({
        fiscalYearId: null,
        revenue: 0,
        costs: 0,
        profit: 0,
        wozValue: 0,
        mortgageInterest: 0,
        aovPremium: 0,
        hasFiscalPartner: false,
        hoursCriterion: false,
        isStarter: false,
        totalAssets: 0,
        totalLiabilities: 0,
        privateWithdrawals: 0,
        privateDeposits: 0,
        startEquity: 0,
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [year]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchData,
  };
}
