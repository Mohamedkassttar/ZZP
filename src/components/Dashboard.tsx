import { useState, useEffect, DragEvent } from 'react';
import { Upload, FileText, Building2, Landmark, MapPin, Package, Edit3, TrendingUp, TrendingDown, Wallet, DollarSign, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { CashflowChart } from './CashflowChart';
import { getRevenueStats, type RevenueStats } from '../lib/dashboardService';

interface FinancialMetrics {
  openSales: number;
  openCosts: number;
  bankBalance: number;
}

interface DashboardProps {
  onNavigate: (view: string, data?: unknown) => void;
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const [metrics, setMetrics] = useState<FinancialMetrics>({
    openSales: 0,
    openCosts: 0,
    bankBalance: 0,
  });
  const [revenueStats, setRevenueStats] = useState<RevenueStats>({
    today: 0,
    thisWeek: 0,
    thisMonth: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMetrics();
    loadRevenueStats();
  }, []);

  async function loadRevenueStats() {
    try {
      const stats = await getRevenueStats();
      setRevenueStats(stats);
    } catch (error) {
      console.error('Error loading revenue stats:', error);
    }
  }

  async function loadMetrics() {
    try {
      const bankBalance = await calculateBankBalance();

      setMetrics({
        openSales: 0,
        openCosts: 0,
        bankBalance,
      });
    } catch (error) {
      console.error('Error loading metrics:', error);
    } finally {
      setLoading(false);
    }
  }

  async function calculateBankBalance(): Promise<number> {
    const { data: bankAccounts } = await supabase
      .from('accounts')
      .select('id')
      .eq('type', 'Asset')
      .ilike('name', '%bank%');

    if (!bankAccounts || bankAccounts.length === 0) return 0;

    const accountIds = bankAccounts.map(acc => acc.id);

    const { data: lines } = await supabase
      .from('journal_lines')
      .select('debit, credit')
      .in('account_id', accountIds);

    if (!lines) return 0;

    return lines.reduce((sum, line) => sum + (Number(line.debit) - Number(line.credit)), 0);
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  function handleDrop(e: DragEvent, type: 'purchase' | 'sales' | 'bank') {
    e.preventDefault();
    e.stopPropagation();

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      if (type === 'purchase') {
        onNavigate('inbox');
      } else if (type === 'bank') {
        onNavigate('bank');
      }
    }
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-4xl font-black text-slate-800">Dashboard</h1>
        <p className="text-lg text-slate-600 mt-2 font-medium">Overzicht van je administratie</p>
      </div>

      {/* Revenue KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-3xl shadow-xl shadow-emerald-100/40 p-4 hover:shadow-2xl hover:shadow-emerald-200/60 transition-all duration-300 border border-emerald-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-2xl shadow-lg">
              <DollarSign className="w-5 h-5 text-white" />
            </div>
            <span className="text-sm text-slate-700 font-medium">Omzet Vandaag</span>
          </div>
          <p className="text-2xl md:text-3xl font-black text-slate-800">
            €{revenueStats.today.toFixed(2)}
          </p>
          <p className="text-xs text-slate-500 mt-1.5 font-medium">Excl. BTW</p>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-3xl shadow-xl shadow-blue-100/40 p-4 hover:shadow-2xl hover:shadow-blue-200/60 transition-all duration-300 border border-blue-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 bg-gradient-to-br from-blue-400 to-cyan-600 rounded-2xl shadow-lg">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <span className="text-sm text-slate-700 font-medium">Omzet Deze Week</span>
          </div>
          <p className="text-2xl md:text-3xl font-black text-slate-800">
            €{revenueStats.thisWeek.toFixed(2)}
          </p>
          <p className="text-xs text-slate-500 mt-1.5 font-medium">Excl. BTW</p>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-sky-50 rounded-3xl shadow-xl shadow-blue-100/40 p-4 hover:shadow-2xl hover:shadow-blue-200/60 transition-all duration-300 border border-blue-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 bg-gradient-to-br from-blue-400 to-sky-600 rounded-2xl shadow-lg">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <span className="text-sm text-slate-700 font-medium">Omzet Deze Maand</span>
          </div>
          <p className="text-2xl md:text-3xl font-black text-slate-800">
            €{revenueStats.thisMonth.toFixed(2)}
          </p>
          <p className="text-xs text-slate-500 mt-1.5 font-medium">Excl. BTW</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <div
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, 'purchase')}
          onClick={() => onNavigate('inbox')}
          className="group relative bg-white/80 backdrop-blur-xl rounded-3xl p-8 hover:shadow-2xl hover:shadow-emerald-200/60 shadow-xl shadow-emerald-100/40 border-2 border-dashed border-emerald-300 hover:border-emerald-500 transition-all duration-300 cursor-pointer min-h-[140px] flex items-center hover:scale-[1.02]"
        >
          <div className="flex items-center gap-5 w-full">
            <div className="p-4 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-2xl group-hover:shadow-xl group-hover:shadow-emerald-300/60 transition-all">
              <FileText className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-black text-slate-800">Inkoop & Bonnetjes</h3>
              <p className="text-sm text-slate-600 mt-1 font-semibold">Sleep facturen hier</p>
            </div>
            <Upload className="w-6 h-6 text-slate-400 group-hover:text-emerald-600 transition-colors" />
          </div>
        </div>

        <div
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, 'sales')}
          onClick={() => onNavigate('sales')}
          className="group relative bg-white/80 backdrop-blur-xl rounded-3xl p-8 hover:shadow-2xl hover:shadow-blue-200/50 shadow-xl shadow-slate-200/40 border-2 border-dashed border-blue-300 hover:border-blue-500 transition-all duration-300 cursor-pointer min-h-[140px] flex items-center hover:scale-[1.02]"
        >
          <div className="flex items-center gap-5 w-full">
            <div className="p-4 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl group-hover:shadow-xl group-hover:shadow-blue-300/50 transition-all">
              <Building2 className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-black text-slate-800">Verkoop Facturen</h3>
              <p className="text-sm text-slate-600 mt-1 font-semibold">Maak nieuwe factuur</p>
            </div>
            <Upload className="w-6 h-6 text-slate-400 group-hover:text-blue-600 transition-colors" />
          </div>
        </div>

        <div
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, 'bank')}
          onClick={() => onNavigate('bank')}
          className="group relative bg-white/80 backdrop-blur-xl rounded-3xl p-8 hover:shadow-2xl hover:shadow-cyan-200/50 shadow-xl shadow-slate-200/40 border-2 border-dashed border-cyan-300 hover:border-cyan-500 transition-all duration-300 cursor-pointer min-h-[140px] flex items-center hover:scale-[1.02]"
        >
          <div className="flex items-center gap-5 w-full">
            <div className="p-4 bg-gradient-to-br from-cyan-500 to-teal-600 rounded-2xl group-hover:shadow-xl group-hover:shadow-cyan-300/50 transition-all">
              <Landmark className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-black text-slate-800">Bank Transacties</h3>
              <p className="text-sm text-slate-600 mt-1 font-semibold">Importeer bankafschrift</p>
            </div>
            <Upload className="w-6 h-6 text-slate-400 group-hover:text-cyan-600 transition-colors" />
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-black text-slate-800 mb-5">Snelle acties</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <button
            onClick={() => onNavigate('settings', { tab: 'mileage' })}
            className="flex flex-col items-center gap-3 p-6 bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl shadow-amber-100/40 hover:shadow-2xl hover:shadow-amber-200/60 transition-all duration-300 group hover:scale-[1.02]"
          >
            <div className="p-4 bg-gradient-to-br from-amber-400 to-amber-600 rounded-2xl group-hover:shadow-xl group-hover:shadow-amber-300/60 transition-all">
              <MapPin className="w-6 h-6 text-white" />
            </div>
            <span className="text-sm font-black text-slate-800">Rit</span>
          </button>

          <button
            onClick={() => onNavigate('settings', { tab: 'assets' })}
            className="flex flex-col items-center gap-3 p-6 bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl shadow-slate-100/40 hover:shadow-2xl hover:shadow-slate-200/60 transition-all duration-300 group hover:scale-[1.02]"
          >
            <div className="p-4 bg-gradient-to-br from-slate-400 to-slate-600 rounded-2xl group-hover:shadow-xl group-hover:shadow-slate-300/60 transition-all">
              <Package className="w-6 h-6 text-white" />
            </div>
            <span className="text-sm font-black text-slate-800">Investering</span>
          </button>

          <button
            onClick={() => onNavigate('memoriaal-boekingen')}
            className="flex flex-col items-center gap-3 p-6 bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl shadow-teal-100/40 hover:shadow-2xl hover:shadow-teal-200/60 transition-all duration-300 group hover:scale-[1.02]"
          >
            <div className="p-4 bg-gradient-to-br from-teal-400 to-teal-600 rounded-2xl group-hover:shadow-xl group-hover:shadow-teal-300/60 transition-all">
              <Edit3 className="w-6 h-6 text-white" />
            </div>
            <span className="text-sm font-black text-slate-800">Boeking</span>
          </button>

          <button
            onClick={() => onNavigate('reports')}
            className="flex flex-col items-center gap-3 p-6 bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl shadow-blue-100/40 hover:shadow-2xl hover:shadow-blue-200/60 transition-all duration-300 group hover:scale-[1.02]"
          >
            <div className="p-4 bg-gradient-to-br from-blue-400 to-blue-600 rounded-2xl group-hover:shadow-xl group-hover:shadow-blue-300/60 transition-all">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <span className="text-sm font-black text-slate-800">Grootboek</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl shadow-emerald-100/40 p-4 hover:shadow-2xl hover:shadow-emerald-200/60 transition-all duration-300 hover:scale-[1.02]">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-2xl shadow-lg">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <span className="text-sm text-slate-600 font-medium">Openstaande verkoop</span>
          </div>
          <p className="text-2xl md:text-3xl font-black text-slate-800">
            {loading ? '...' : `€${metrics.openSales.toFixed(2)}`}
          </p>
        </div>

        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl shadow-rose-100/40 p-4 hover:shadow-2xl hover:shadow-rose-200/60 transition-all duration-300 hover:scale-[1.02]">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 bg-gradient-to-br from-rose-400 to-rose-600 rounded-2xl shadow-lg">
              <TrendingDown className="w-5 h-5 text-white" />
            </div>
            <span className="text-sm text-slate-600 font-medium">Openstaande kosten</span>
          </div>
          <p className="text-2xl md:text-3xl font-black text-slate-800">
            {loading ? '...' : `€${metrics.openCosts.toFixed(2)}`}
          </p>
        </div>

        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl shadow-slate-200/40 p-4 hover:shadow-2xl hover:shadow-blue-200/50 transition-all duration-300 hover:scale-[1.02] sm:col-span-2 md:col-span-1">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl shadow-lg">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            <span className="text-sm text-slate-600 font-medium">Banksaldo</span>
          </div>
          <p className="text-2xl md:text-3xl font-black text-slate-800">
            {loading ? '...' : `€${metrics.bankBalance.toFixed(2)}`}
          </p>
        </div>
      </div>

      <CashflowChart />
    </div>
  );
}
