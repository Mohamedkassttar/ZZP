import { useState, useEffect } from 'react';
import { ArrowLeft, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
}

interface JournalLine {
  id: string;
  debit: number;
  credit: number;
  description: string | null;
  journal_entry: {
    id: string;
    entry_date: string;
    description: string;
    reference: string | null;
  };
}

interface AccountDetailProps {
  accountId: string;
  startDate: string;
  endDate: string;
  onBack: () => void;
}

export function AccountDetail({ accountId, startDate, endDate, onBack }: AccountDetailProps) {
  const [account, setAccount] = useState<Account | null>(null);
  const [lines, setLines] = useState<JournalLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState(0);

  useEffect(() => {
    loadAccountDetail();
  }, [accountId, startDate, endDate]);

  async function loadAccountDetail() {
    setLoading(true);
    try {
      const { data: accountData, error: accountError } = await supabase
        .from('accounts')
        .select('*')
        .eq('id', accountId)
        .single();

      if (accountError) throw accountError;
      setAccount(accountData);

      const { data: linesData, error: linesError } = await supabase
        .from('journal_lines')
        .select(`
          id,
          debit,
          credit,
          description,
          journal_entry:journal_entries!inner(
            id,
            entry_date,
            description,
            reference,
            status
          )
        `)
        .eq('account_id', accountId)
        .eq('journal_entry.status', 'Final')
        .gte('journal_entry.entry_date', startDate)
        .lte('journal_entry.entry_date', endDate)
        .order('journal_entry(entry_date)', { ascending: false });

      if (linesError) throw linesError;

      const formattedLines = (linesData || []).map((line: any) => ({
        id: line.id,
        debit: Number(line.debit),
        credit: Number(line.credit),
        description: line.description,
        journal_entry: line.journal_entry,
      }));

      setLines(formattedLines);

      const totalBalance = formattedLines.reduce(
        (sum, line) => sum + line.debit - line.credit,
        0
      );
      setBalance(totalBalance);
    } catch (error) {
      console.error('Error loading account detail:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
        </div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-800">Account not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Reports</span>
      </button>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">
              {account.code} - {account.name}
            </h1>
            <div className="flex items-center gap-4 text-sm text-slate-600">
              <span className="px-3 py-1 bg-slate-100 rounded-full font-medium">
                {account.type}
              </span>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>
                  {new Date(startDate).toLocaleDateString('nl-NL')} -{' '}
                  {new Date(endDate).toLocaleDateString('nl-NL')}
                </span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-600 mb-1">Period Balance</p>
            <p className={`text-3xl font-bold ${
              balance >= 0 ? 'text-emerald-700' : 'text-rose-700'
            }`}>
              €{Math.abs(balance).toFixed(2)}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {account.type === 'Asset' || account.type === 'Expense' ? 'Debit' : 'Credit'} Balance
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">Date</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">Reference</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">Description</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-slate-900">Debit</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-slate-900">Credit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {lines.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-600">
                    No transactions found for this period
                  </td>
                </tr>
              ) : (
                lines.map((line) => (
                  <tr key={line.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-sm text-slate-900">
                      {new Date(line.journal_entry.entry_date).toLocaleDateString('nl-NL')}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {line.journal_entry.reference || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-900">
                      <div className="font-medium">{line.journal_entry.description}</div>
                      {line.description && (
                        <div className="text-slate-600 text-xs mt-1">{line.description}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-right font-medium text-emerald-700">
                      {line.debit > 0 ? `€${line.debit.toFixed(2)}` : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-right font-medium text-rose-700">
                      {line.credit > 0 ? `€${line.credit.toFixed(2)}` : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {lines.length > 0 && (
              <tfoot className="bg-slate-50 border-t-2 border-slate-300">
                <tr>
                  <td colSpan={3} className="px-6 py-4 text-sm font-bold text-slate-900">
                    Total
                  </td>
                  <td className="px-6 py-4 text-sm text-right font-bold text-emerald-700">
                    €{lines.reduce((sum, line) => sum + line.debit, 0).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-sm text-right font-bold text-rose-700">
                    €{lines.reduce((sum, line) => sum + line.credit, 0).toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
