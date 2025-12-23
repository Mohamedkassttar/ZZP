/**
 * Dashboard Service
 *
 * Provides revenue statistics and KPIs for dashboard displays
 * Shared between Expert Mode and Client Portal
 */

import { supabase } from './supabase';

export interface RevenueStats {
  today: number;
  thisWeek: number;
  thisMonth: number;
}

/**
 * Get revenue statistics for today, this week, and this month
 * Based on journal entries posted to Revenue accounts (type='Revenue')
 */
export async function getRevenueStats(): Promise<RevenueStats> {
  const now = new Date();

  // Calculate date boundaries
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  // Get start of week (Monday)
  const weekStart = new Date(now);
  const day = weekStart.getDay();
  const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is sunday
  weekStart.setDate(diff);
  weekStart.setHours(0, 0, 0, 0);

  // Get start of month
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Format dates for SQL
  const todayStartStr = todayStart.toISOString().split('T')[0];
  const weekStartStr = weekStart.toISOString().split('T')[0];
  const monthStartStr = monthStart.toISOString().split('T')[0];

  try {
    // Get all Revenue accounts
    const { data: revenueAccounts } = await supabase
      .from('accounts')
      .select('id')
      .eq('type', 'Revenue')
      .eq('is_active', true);

    if (!revenueAccounts || revenueAccounts.length === 0) {
      return { today: 0, thisWeek: 0, thisMonth: 0 };
    }

    const accountIds = revenueAccounts.map(acc => acc.id);

    // Fetch today's revenue from journal lines
    const { data: todayData } = await supabase
      .from('journal_lines')
      .select('credit, debit, journal_entries!inner(entry_date)')
      .in('account_id', accountIds)
      .eq('journal_entries.entry_date', todayStartStr);

    // Fetch this week's revenue
    const { data: weekData } = await supabase
      .from('journal_lines')
      .select('credit, debit, journal_entries!inner(entry_date)')
      .in('account_id', accountIds)
      .gte('journal_entries.entry_date', weekStartStr);

    // Fetch this month's revenue
    const { data: monthData } = await supabase
      .from('journal_lines')
      .select('credit, debit, journal_entries!inner(entry_date)')
      .in('account_id', accountIds)
      .gte('journal_entries.entry_date', monthStartStr);

    // Calculate totals (for Revenue accounts, credit increases revenue)
    const today = todayData?.reduce((sum, line) => {
      return sum + (Number(line.credit) - Number(line.debit));
    }, 0) || 0;

    const thisWeek = weekData?.reduce((sum, line) => {
      return sum + (Number(line.credit) - Number(line.debit));
    }, 0) || 0;

    const thisMonth = monthData?.reduce((sum, line) => {
      return sum + (Number(line.credit) - Number(line.debit));
    }, 0) || 0;

    return {
      today: Math.round(today * 100) / 100,
      thisWeek: Math.round(thisWeek * 100) / 100,
      thisMonth: Math.round(thisMonth * 100) / 100,
    };
  } catch (error) {
    console.error('Error fetching revenue stats:', error);
    return {
      today: 0,
      thisWeek: 0,
      thisMonth: 0,
    };
  }
}

/**
 * Get outstanding invoices (unpaid)
 */
export async function getOutstandingInvoices() {
  try {
    const { data, error } = await supabase
      .from('sales_invoices')
      .select(`
        id,
        invoice_number,
        date,
        total_amount,
        status,
        contact:contacts(company_name, email)
      `)
      .in('status', ['open', 'sent'])
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching outstanding invoices:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getOutstandingInvoices:', error);
    return [];
  }
}

/**
 * Get total outstanding amount
 */
export async function getTotalOutstanding(): Promise<number> {
  try {
    const { data } = await supabase
      .from('sales_invoices')
      .select('total_amount')
      .in('status', ['open', 'sent']);

    const total = data?.reduce((sum, inv) => sum + (inv.total_amount || 0), 0) || 0;
    return Math.round(total * 100) / 100;
  } catch (error) {
    console.error('Error fetching total outstanding:', error);
    return 0;
  }
}
