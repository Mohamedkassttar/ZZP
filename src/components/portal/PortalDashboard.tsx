import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Wallet, TrendingDown, TrendingUp, Clock, ArrowRight } from 'lucide-react';

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

export function PortalDashboard() {
  const [data, setData] = useState<DashboardData>({
    bankBalance: 0,
    unpaidPurchases: 0,
    unpaidSales: 0,
    recentActivities: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    try {
      const [bankResult, purchasesResult, salesResult, activitiesResult] = await Promise.all([
        supabase.from('accounts').select('id, code, name').eq('code', '1100').eq('is_active', true).maybeSingle(),
        supabase.from('purchase_invoices').select('total_amount').eq('status', 'Pending'),
        supabase.from('sales_invoices').select('total_amount').eq('status', 'open'),
        supabase
          .from('journal_entries')
          .select('id, entry_date, description, memoriaal_type')
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
      <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-3xl shadow-xl p-6 text-white">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Wallet className="w-6 h-6" />
            <span className="text-sm font-medium opacity-90">Bank Saldo</span>
          </div>
          <span className="text-xs opacity-75">Zakelijk</span>
        </div>
        <div className="text-4xl font-bold mb-1">
          {new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(data.bankBalance)}
        </div>
        <p className="text-sm opacity-80">Per vandaag</p>
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
