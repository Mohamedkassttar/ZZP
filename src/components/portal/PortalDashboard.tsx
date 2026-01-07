import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Wallet, TrendingDown, TrendingUp, Clock, ArrowRight, DollarSign, Calendar, ChevronDown } from 'lucide-react';
import { getRevenueStats, type RevenueStats } from '../../lib/dashboardService';

interface DashboardData {
  bankBalance: number;
  unpaidPurchases: number;
  unpaidSales: number;
  recentActivities: Array<{
    id: string;
    type: string;
    description: string;
    amount: number;
    date: string;
  }>;
}

interface FiscalYear {
  id: string;
  year: number;
}

export function PortalDashboard() {
  const [data, setData] = useState<DashboardData>({
    bankBalance: 0,
    unpaidPurchases: 0,
    unpaidSales: 0,
    recentActivities: [],
  });
  const [revenueStats, setRevenueStats] = useState<RevenueStats>({
    today: 0,
    thisWeek: 0,
    thisMonth: 0,
  });
  const [loading, setLoading] = useState(true);
  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  useEffect(() => {
    loadFiscalYears();
    loadDashboardData();
    loadRevenueStats();
  }, []);

  useEffect(() => {
    loadDashboardData();
    loadRevenueStats();
  }, [selectedYear]);

  async function loadFiscalYears() {
    try {
      const { data: years } = await supabase
        .from('fiscal_years')
        .select('id, year')
        .order('year', { ascending: false });

      if (years && years.length > 0) {
        setFiscalYears(years);
        setSelectedYear(years[0].year);
      }
    } catch (error) {
      console.error('Error loading fiscal years:', error);
    }
  }

  async function loadRevenueStats() {
    try {
      const stats = await getRevenueStats();
      setRevenueStats(stats);
    } catch (error) {
      console.error('Error loading revenue stats:', error);
    }
  }

  async function loadDashboardData() {
    try {
      const yearStart = new Date(selectedYear, 0, 1).toISOString();
      const yearEnd = new Date(selectedYear, 11, 31, 23, 59, 59).toISOString();

      const [bankResult, purchasesResult, salesResult, activitiesResult] = await Promise.all([
        supabase
          .from('accounts')
          .select('id, code, name')
          .eq('code', '1100')
          .eq('is_active', true)
          .maybeSingle(),
        supabase
          .from('purchase_invoices')
          .select('total_amount')
          .eq('status', 'Pending')
          .gte('invoice_date', yearStart)
          .lte('invoice_date', yearEnd),
        supabase
          .from('sales_invoices')
          .select('total_amount')
          .eq('status', 'open')
          .gte('date', yearStart)
          .lte('date', yearEnd),
        supabase
          .from('journal_entries')
          .select('id, entry_date, description, memoriaal_type')
          .gte('entry_date', yearStart)
          .lte('entry_date', yearEnd)
          .order('entry_date', { ascending: false })
          .limit(10),
      ]);

      let bankBalance = 0;
      if (bankResult.data) {
        const { data: lines } = await supabase
          .from('journal_lines')
          .select('debit, credit')
          .eq('account_id', bankResult.data.id);

        if (lines) {
          bankBalance = lines.reduce((sum, line) => sum + (line.debit || 0) - (line.credit || 0), 0);
        }
      }

      const unpaidPurchases = purchasesResult.data?.reduce((sum, inv) => sum + (inv.total_amount || 0), 0) || 0;
      const unpaidSales = salesResult.data?.reduce((sum, inv) => sum + (inv.total_amount || 0), 0) || 0;

      const recentActivities =
        activitiesResult.data?.map((entry) => ({
          id: entry.id,
          type: entry.memoriaal_type || 'Algemeen',
          description: entry.description || 'Boeking',
          amount: 0,
          date: entry.entry_date,
        })) || [];

      setData({
        bankBalance,
        unpaidPurchases,
        unpaidSales,
        recentActivities,
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {fiscalYears.length > 0 && (
        <div className="bg-white rounded-2xl shadow-md p-4 border border-gray-100">
          <label className="block text-sm font-medium text-gray-700 mb-2">Boekjaar</label>
          <div className="relative">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="w-full appearance-none bg-white border-2 border-gray-200 rounded-xl px-4 py-3 pr-10 text-gray-900 font-medium focus:border-blue-500 focus:outline-none transition-colors"
            >
              {fiscalYears.map((fy) => (
                <option key={fy.id} value={fy.year}>
                  {fy.year}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
          </div>
        </div>
      )}

      <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-3xl shadow-xl p-5 text-white">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5" />
            <span className="text-sm font-medium opacity-90">Bank Saldo</span>
          </div>
          <span className="text-xs opacity-75">Zakelijk</span>
        </div>
        <div className="text-2xl md:text-3xl font-bold mb-1">
          {new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(data.bankBalance)}
        </div>
        <p className="text-xs opacity-80">Per vandaag</p>
      </div>

      {/* Revenue KPI Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl shadow-md p-4 border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-emerald-600" />
            </div>
          </div>
          <div className="text-lg font-bold text-gray-900 mb-1">
            {new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(revenueStats.today)}
          </div>
          <p className="text-xs text-gray-600 font-medium">Omzet vandaag</p>
        </div>

        <div className="bg-white rounded-2xl shadow-md p-4 border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
              <Calendar className="w-4 h-4 text-blue-600" />
            </div>
          </div>
          <div className="text-lg font-bold text-gray-900 mb-1">
            {new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(revenueStats.thisWeek)}
          </div>
          <p className="text-xs text-gray-600 font-medium">Deze week</p>
        </div>

        <div className="bg-white rounded-2xl shadow-md p-4 border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-violet-50 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-violet-600" />
            </div>
          </div>
          <div className="text-lg font-bold text-gray-900 mb-1">
            {new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(revenueStats.thisMonth)}
          </div>
          <p className="text-xs text-gray-600 font-medium">Deze maand</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <button className="bg-white rounded-2xl shadow-md p-5 text-left hover:shadow-lg transition-shadow border border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center">
              <TrendingDown className="w-5 h-5 text-red-600" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900 mb-1">
            {new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(data.unpaidPurchases)}
          </div>
          <p className="text-xs text-gray-600 font-medium">Nog te betalen</p>
        </button>

        <button className="bg-white rounded-2xl shadow-md p-5 text-left hover:shadow-lg transition-shadow border border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900 mb-1">
            {new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(data.unpaidSales)}
          </div>
          <p className="text-xs text-gray-600 font-medium">Nog te ontvangen</p>
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-md p-5 border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">Laatste updates</h3>
          <Clock className="w-5 h-5 text-gray-400" />
        </div>

        <div className="space-y-3">
          {data.recentActivities.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">Nog geen activiteit</p>
          ) : (
            data.recentActivities.slice(0, 5).map((activity) => (
              <div
                key={activity.id}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors"
              >
                <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center flex-shrink-0">
                  <ArrowRight className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{activity.description}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-500">{activity.type}</span>
                    <span className="text-xs text-gray-400">•</span>
                    <span className="text-xs text-gray-500">
                      {new Date(activity.date).toLocaleDateString('nl-NL', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
