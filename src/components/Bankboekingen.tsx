import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Calendar, Loader, CreditCard as Edit2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';
import { getCurrentCompanyId } from '../lib/companyHelper';
import { BankEntryEditModal } from './BankEntryEditModal';

type JournalEntry = Database['public']['Tables']['journal_entries']['Row'];
type Account = Database['public']['Tables']['accounts']['Row'];

interface JournalLine {
  id: string;
  account_id: string;
  debit: number;
  credit: number;
  description: string | null;
  account?: Account;
}

interface BankEntry extends JournalEntry {
  lines: JournalLine[];
  accountFrom?: string;
  accountTo?: string;
  amount: number;
  contraName?: string;
  ledgerAccountCode?: string;
  ledgerAccountName?: string;
}

interface MonthGroup {
  month: string;
  entries: BankEntry[];
  total: number;
}

export function Bankboekingen() {
  const [entries, setEntries] = useState<BankEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [editingEntry, setEditingEntry] = useState<BankEntry | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  useEffect(() => {
    // Set default date range to show ALL bank bookings (very wide range)
    const now = new Date();
    const startOfTime = new Date(2000, 0, 1);
    const endOfTime = new Date(now.getFullYear() + 5, 11, 31);
    setStartDate(startOfTime.toISOString().split('T')[0]);
    setEndDate(endOfTime.toISOString().split('T')[0]);
  }, []);

  useEffect(() => {
    if (startDate && endDate) {
      loadData();
    }
  }, [startDate, endDate]);

  async function loadData() {
    setLoading(true);
    try {
      const companyId = await getCurrentCompanyId();
      if (!companyId) throw new Error('Geen bedrijf geselecteerd');

      const { data: accountsData } = await supabase
        .from('accounts')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_active', true);

      const sortedAccounts = (accountsData || []).sort((a, b) => {
        const numA = parseInt(a.code);
        const numB = parseInt(b.code);
        return numA - numB;
      });

      setAccounts(sortedAccounts);

      // First, get all journal_entry_ids that are actually linked to bank_transactions
      const { data: bankTransactions } = await supabase
        .from('bank_transactions')
        .select('journal_entry_id')
        .eq('company_id', companyId)
        .not('journal_entry_id', 'is', null);

      const journalEntryIds = (bankTransactions || [])
        .map(bt => bt.journal_entry_id)
        .filter(id => id !== null) as string[];

      if (journalEntryIds.length === 0) {
        setEntries([]);
        setLoading(false);
        return;
      }

      // Fetch only journal entries that are linked to bank transactions
      const { data: entriesData } = await supabase
        .from('journal_entries')
        .select('*')
        .eq('company_id', companyId)
        .in('id', journalEntryIds)
        .gte('entry_date', startDate)
        .lte('entry_date', endDate)
        .order('entry_date', { ascending: false });

      if (!entriesData) {
        setEntries([]);
        setLoading(false);
        return;
      }

      // Fetch lines for each entry
      const enrichedEntries = await Promise.all(
        entriesData.map(async (entry) => {
          const { data: linesData } = await supabase
            .from('journal_lines')
            .select('*, accounts(*)')
            .eq('journal_entry_id', entry.id);

          const lines = (linesData || []).map(line => ({
            id: line.id,
            account_id: line.account_id,
            debit: line.debit,
            credit: line.credit,
            description: line.description,
            account: line.accounts as Account,
          }));

          // Determine account from/to and amount
          // Bank accounts are 1000 (Kas) and 1100+ (Bank accounts)
          const isBankAccount = (code: string | undefined) => {
            if (!code) return false;
            return code === '1000' || code.startsWith('11');
          };
          const bankLine = lines.find(l => isBankAccount(l.account?.code));
          const otherLine = lines.find(l => !isBankAccount(l.account?.code));

          const amount = bankLine ? (bankLine.debit - bankLine.credit) : 0;
          const accountFrom = amount > 0 ? otherLine?.account?.code : bankLine?.account?.code;
          const accountTo = amount > 0 ? bankLine?.account?.code : otherLine?.account?.code;

          // Fetch bank transaction to get contra_name
          const { data: bankTransaction } = await supabase
            .from('bank_transactions')
            .select('contra_name')
            .eq('company_id', companyId)
            .eq('journal_entry_id', entry.id)
            .maybeSingle();

          return {
            ...entry,
            lines,
            accountFrom,
            accountTo,
            amount: Math.abs(amount),
            contraName: bankTransaction?.contra_name || null,
            ledgerAccountCode: otherLine?.account?.code,
            ledgerAccountName: otherLine?.account?.name,
          };
        })
      );

      const validEntries = enrichedEntries.filter(entry => entry.amount > 0);
      setEntries(validEntries);

      // Auto-expand the most recent month
      if (validEntries.length > 0) {
        const mostRecentDate = new Date(validEntries[0].entry_date);
        const mostRecentMonth = `${mostRecentDate.getFullYear()}-${String(mostRecentDate.getMonth() + 1).padStart(2, '0')}`;
        setExpandedMonths(new Set([mostRecentMonth]));
      }
    } catch (err) {
      console.error('Failed to load bank entries:', err);
    } finally {
      setLoading(false);
    }
  }

  function groupEntriesByMonth(): MonthGroup[] {
    const groups: Record<string, BankEntry[]> = {};

    entries.forEach(entry => {
      const date = new Date(entry.entry_date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!groups[monthKey]) {
        groups[monthKey] = [];
      }
      groups[monthKey].push(entry);
    });

    return Object.entries(groups).map(([month, entries]) => {
      const total = entries.reduce((sum, e) => sum + e.amount, 0);
      return { month, entries, total };
    }).sort((a, b) => b.month.localeCompare(a.month));
  }

  function toggleMonth(month: string) {
    const newExpanded = new Set(expandedMonths);
    if (newExpanded.has(month)) {
      newExpanded.delete(month);
    } else {
      newExpanded.add(month);
    }
    setExpandedMonths(newExpanded);
  }

  function formatMonthLabel(monthKey: string): string {
    const [year, month] = monthKey.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('nl-NL', { year: 'numeric', month: 'long' });
  }

  function getAccountName(accountId: string): string {
    const account = accounts.find(a => a.id === accountId);
    return account ? `${account.code} - ${account.name}` : 'Onbekend';
  }

  function handleEditEntry(entry: BankEntry) {
    setEditingEntry(entry);
    setIsEditModalOpen(true);
  }

  function handleEditSuccess() {
    loadData();
  }

  const monthGroups = groupEntriesByMonth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="w-6 h-6 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bankboekingen</h1>
          <p className="text-sm text-gray-500">Geschiedenis van verwerkte banktransacties</p>
        </div>
      </div>

      {/* Date Range Filter */}
      <div className="rounded-lg border border-gray-200 shadow-sm p-4">
        <div className="flex items-center gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Van</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-9 px-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Tot</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-9 px-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="flex-1"></div>
          <div className="text-xs text-gray-500">
            {entries.length} transacties
          </div>
        </div>
      </div>

      {/* Month Groups */}
      {monthGroups.length === 0 ? (
        <div className="rounded-lg border border-gray-200 shadow-sm p-4 text-center">
          <Calendar className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-xs text-gray-500">Geen banktransacties gevonden in deze periode</p>
        </div>
      ) : (
        <div className="space-y-4">
          {monthGroups.map(group => (
            <div key={group.month} className="rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <button
                onClick={() => toggleMonth(group.month)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {expandedMonths.has(group.month) ? (
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-500" />
                  )}
                  <span className="text-base font-semibold text-gray-900">
                    {formatMonthLabel(group.month)}
                  </span>
                  <span className="text-xs text-gray-500">
                    ({group.entries.length} transacties)
                  </span>
                </div>
                <div className="text-sm font-medium text-gray-900">
                  €{group.total.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                </div>
              </button>

              {expandedMonths.has(group.month) && (
                <div className="border-t border-gray-200">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="h-10 bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs uppercase tracking-wide whitespace-nowrap">
                            Datum
                          </th>
                          <th className="px-3 py-2 text-left text-xs uppercase tracking-wide">
                            Omschrijving
                          </th>
                          <th className="px-3 py-2 text-left text-xs uppercase tracking-wide">
                            Tegenpartij
                          </th>
                          <th className="px-3 py-2 text-left text-xs uppercase tracking-wide">
                            Grootboek
                          </th>
                          <th className="px-3 py-2 text-right text-xs uppercase tracking-wide whitespace-nowrap">
                            Bedrag
                          </th>
                          <th className="px-3 py-2 text-center text-xs uppercase tracking-wide whitespace-nowrap">
                            Actie
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {group.entries.map(entry => (
                          <tr key={entry.id} className="h-10 border-b border-gray-100 hover:bg-gray-50 transition-colors">
                            <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">
                              {new Date(entry.entry_date).toLocaleDateString('nl-NL')}
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-900">
                              {entry.description}
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-600">
                              {entry.contraName || '-'}
                            </td>
                            <td className="px-3 py-2 text-sm">
                              {entry.ledgerAccountCode && entry.ledgerAccountName ? (
                                <div className="flex flex-col">
                                  <span className="font-medium text-gray-900">{entry.ledgerAccountCode}</span>
                                  <span className="text-xs text-gray-600">{entry.ledgerAccountName}</span>
                                </div>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-sm text-right font-medium text-gray-900 whitespace-nowrap">
                              €{entry.amount.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-3 py-2 text-center whitespace-nowrap">
                              <button
                                onClick={() => handleEditEntry(entry)}
                                className="inline-flex items-center justify-center p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                title="Bewerk boeking"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <BankEntryEditModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={handleEditSuccess}
        entry={editingEntry}
        accounts={accounts}
      />
    </div>
  );
}
