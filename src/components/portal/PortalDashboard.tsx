import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useCompany } from '../../lib/CompanyContext';
import { Wallet, TrendingDown, TrendingUp, Clock, ArrowRight, FileText, Receipt, CheckCircle2, AlertCircle } from 'lucide-react';

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
  recentDocuments: Array<{
    id: string;
    filename: string;
    status: string;
    created_at: string;
  }>;
  recentInvoices: Array<{
    id: string;
    invoice_number: string;
    total_amount: number;
    status: string;
    invoice_date: string;
  }>;
}

export function PortalDashboard() {
  const { currentCompany } = useCompany();
  const [data, setData] = useState<DashboardData>({
    bankBalance: 0,
    unpaidPurchases: 0,
    unpaidSales: 0,
    recentActivities: [],
    recentDocuments: [],
    recentInvoices: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentCompany) {
      loadDashboardData();
    }
  }, [currentCompany]);

  async function loadDashboardData() {
    if (!currentCompany) return;

    try {
      const [
        bankAccountsResult,
        purchasesResult,
        salesResult,
        activitiesResult,
        documentsResult,
        invoicesResult
      ] = await Promise.all([
        supabase
          .from('accounts')
          .select('id, code, name')
          .eq('company_id', currentCompany.id)
          .gte('code', '1000')
          .lte('code', '1199')
          .eq('is_active', true),
        supabase
          .from('purchase_invoices')
          .select('total_amount')
          .eq('company_id', currentCompany.id)
          .eq('status', 'Pending'),
        supabase
          .from('sales_invoices')
          .select('total_amount')
          .eq('company_id', currentCompany.id)
          .eq('status', 'open'),
        supabase
          .from('journal_entries')
          .select('id, entry_date, description, memoriaal_type')
          .eq('company_id', currentCompany.id)
          .eq('status', 'Final')
          .order('entry_date', { ascending: false })
          .limit(10),
        supabase
          .from('documents_inbox')
          .select('id, filename, status, created_at')
          .eq('company_id', currentCompany.id)
          .order('created_at', { ascending: false })
          .limit(10),
        supabase
          .from('invoices')
          .select('id, invoice_number, total_amount, status, invoice_date')
          .eq('company_id', currentCompany.id)
          .order('invoice_date', { ascending: false })
          .limit(10),
      ]);

      let bankBalance = 0;
      if (bankAccountsResult.data && bankAccountsResult.data.length > 0) {
        const bankAccountIds = bankAccountsResult.data.map((acc) => acc.id);
        const { data: lines } = await supabase
          .from('journal_lines')
          .select('debit, credit, account_id, journal_entry_id')
          .in('account_id', bankAccountIds);

        if (lines) {
          const { data: finalEntries } = await supabase
            .from('journal_entries')
            .select('id')
            .eq('company_id', currentCompany.id)
            .eq('status', 'Final');

          const finalEntryIds = new Set(finalEntries?.map((e) => e.id) || []);

          bankBalance = lines
            .filter((line) => finalEntryIds.has(line.journal_entry_id))
            .reduce((sum, line) => sum + (line.debit || 0) - (line.credit || 0), 0);
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

      const recentDocuments =
        documentsResult.data?.map((doc) => ({
          id: doc.id,
          filename: doc.filename || 'Onbekend',
          status: doc.status || 'Pending',
          created_at: doc.created_at,
        })) || [];

      const recentInvoices =
        invoicesResult.data?.map((inv) => ({
          id: inv.id,
          invoice_number: inv.invoice_number || '',
          total_amount: inv.total_amount || 0,
          status: inv.status || 'Draft',
          invoice_date: inv.invoice_date || '',
        })) || [];

      setData({
        bankBalance,
        unpaidPurchases,
        unpaidSales,
        recentActivities,
        recentDocuments,
        recentInvoices,
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading || !currentCompany) {
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

      <div className="bg-white rounded-2xl shadow-md p-5 border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-bold text-gray-900">Geüploade Facturen</h3>
          </div>
          <span className="text-xs text-gray-500">{data.recentDocuments.length} totaal</span>
        </div>

        <div className="space-y-2">
          {data.recentDocuments.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">Nog geen facturen geüpload</p>
          ) : (
            data.recentDocuments.slice(0, 5).map((doc) => (
              <div
                key={doc.id}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors"
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  doc.status === 'Processed' || doc.status === 'Booked'
                    ? 'bg-green-50'
                    : doc.status === 'Failed'
                    ? 'bg-red-50'
                    : 'bg-blue-50'
                }`}>
                  {doc.status === 'Processed' || doc.status === 'Booked' ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  ) : doc.status === 'Failed' ? (
                    <AlertCircle className="w-4 h-4 text-red-600" />
                  ) : (
                    <FileText className="w-4 h-4 text-blue-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{doc.filename}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      doc.status === 'Processed' || doc.status === 'Booked'
                        ? 'bg-green-100 text-green-700'
                        : doc.status === 'Failed'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {doc.status}
                    </span>
                    <span className="text-xs text-gray-400">•</span>
                    <span className="text-xs text-gray-500">
                      {new Date(doc.created_at).toLocaleDateString('nl-NL', {
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

      <div className="bg-white rounded-2xl shadow-md p-5 border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-green-600" />
            <h3 className="text-lg font-bold text-gray-900">Mijn Facturen</h3>
          </div>
          <span className="text-xs text-gray-500">{data.recentInvoices.length} totaal</span>
        </div>

        <div className="space-y-2">
          {data.recentInvoices.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">Nog geen facturen aangemaakt</p>
          ) : (
            data.recentInvoices.slice(0, 5).map((inv) => (
              <div
                key={inv.id}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors"
              >
                <div className="w-8 h-8 bg-green-50 rounded-full flex items-center justify-center flex-shrink-0">
                  <FileText className="w-4 h-4 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900">{inv.invoice_number || 'Concept'}</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(inv.total_amount)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      inv.status === 'Paid'
                        ? 'bg-green-100 text-green-700'
                        : inv.status === 'Sent'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      {inv.status}
                    </span>
                    <span className="text-xs text-gray-400">•</span>
                    <span className="text-xs text-gray-500">
                      {new Date(inv.invoice_date).toLocaleDateString('nl-NL', {
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
