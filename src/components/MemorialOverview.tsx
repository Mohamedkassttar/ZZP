import { useState, useEffect } from 'react';
import { Edit, Trash2, CheckCircle, FileText, Calendar, Euro, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { JournalEntryModal } from './JournalEntryModal';
import type { Database } from '../lib/database.types';

type JournalEntry = Database['public']['Tables']['journal_entries']['Row'];
type Account = Database['public']['Tables']['accounts']['Row'];

interface JournalLine {
  id: string;
  account_id: string;
  debit: number;
  credit: number;
  description: string | null;
}

interface MemorialEntry extends JournalEntry {
  total_amount: number;
  lines: JournalLine[];
}

export function MemorialOverview() {
  const [entries, setEntries] = useState<MemorialEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<MemorialEntry | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError(null);

    try {
      const { data: accountsData } = await supabase
        .from('accounts')
        .select('*')
        .eq('is_active', true);

      const sortedAccounts = (accountsData || []).sort((a, b) => {
        const numA = parseInt(a.code);
        const numB = parseInt(b.code);
        return numA - numB;
      });

      setAccounts(sortedAccounts);

      const { data: journalEntries, error: entriesError } = await supabase
        .from('journal_entries')
        .select('*')
        .in('type', ['Memoriaal', 'memoriaal', 'manual', 'opening_balance'])
        .order('entry_date', { ascending: false });

      if (entriesError) throw entriesError;

      const entriesWithLines: MemorialEntry[] = await Promise.all(
        (journalEntries || []).map(async (entry) => {
          const { data: lines } = await supabase
            .from('journal_lines')
            .select('*')
            .eq('journal_entry_id', entry.id);

          const totalDebit = (lines || []).reduce((sum, line) => sum + Number(line.debit), 0);

          return {
            ...entry,
            total_amount: totalDebit,
            lines: (lines || []).map((line) => ({
              id: line.id,
              account_id: line.account_id,
              debit: Number(line.debit),
              credit: Number(line.credit),
              description: line.description,
            })),
          };
        })
      );

      setEntries(entriesWithLines);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load memorial entries');
    } finally {
      setLoading(false);
    }
  }

  async function handleFinalize(entryId: string) {
    try {
      const { error } = await supabase
        .from('journal_entries')
        .update({ status: 'Final' })
        .eq('id', entryId);

      if (error) throw error;

      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to finalize entry');
    }
  }

  async function handleDelete(entryId: string) {
    try {
      const { error: linesError } = await supabase
        .from('journal_lines')
        .delete()
        .eq('journal_entry_id', entryId);

      if (linesError) throw linesError;

      const { error: entryError } = await supabase
        .from('journal_entries')
        .delete()
        .eq('id', entryId);

      if (entryError) throw entryError;

      await loadData();
      setShowDeleteConfirm(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete entry');
    }
  }

  function getAccountName(accountId: string) {
    const account = accounts.find((a) => a.id === accountId);
    return account ? `${account.code} - ${account.name}` : 'Unknown';
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-500">Loading memorial entries...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Grootboek</h1>
        <p className="text-sm text-gray-500">Overzicht van alle journaalposten</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="text-red-800">{error}</div>
        </div>
      )}

      {entries.length === 0 ? (
        <div className="rounded-lg border border-gray-200 shadow-sm p-4 text-center">
          <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-xs text-gray-500">Geen journaalposten gevonden</p>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="h-10 bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wide whitespace-nowrap">Datum</th>
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wide">
                    Omschrijving
                  </th>
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wide whitespace-nowrap">
                    Referentie
                  </th>
                  <th className="text-right py-2 px-3 text-xs uppercase tracking-wide whitespace-nowrap">
                    Bedrag
                  </th>
                  <th className="text-center py-2 px-3 text-xs uppercase tracking-wide whitespace-nowrap">
                    Status
                  </th>
                  <th className="text-right py-2 px-3 text-xs uppercase tracking-wide">
                    Acties
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <>
                    <tr
                      key={entry.id}
                      className="h-10 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() =>
                        setExpandedEntry(expandedEntry === entry.id ? null : entry.id)
                      }
                    >
                      <td className="py-2 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-sm text-gray-900">
                          <Calendar className="w-3 h-3 text-gray-400" />
                          {new Date(entry.entry_date).toLocaleDateString('nl-NL')}
                      </div>
                    </td>
                    <td className="py-2 px-3 text-sm text-gray-900">{entry.description}</td>
                    <td className="py-2 px-3 text-sm text-gray-600 whitespace-nowrap">
                      {entry.reference || '-'}
                    </td>
                    <td className="py-2 px-3 text-right text-sm font-medium text-gray-900 whitespace-nowrap">
                      €{entry.total_amount.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2 px-3 text-center">
                      {entry.status === 'Final' ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded">
                          <CheckCircle className="w-3 h-3" />
                          Final
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded">
                          <FileText className="w-3 h-3" />
                          Concept
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingEntry(entry);
                            setShowEditModal(true);
                          }}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Bewerk"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        {entry.status === 'Draft' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleFinalize(entry.id);
                            }}
                            className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors"
                            title="Afronden"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowDeleteConfirm(entry.id);
                          }}
                          className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Verwijder"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedEntry === entry.id && (
                    <tr>
                      <td colSpan={6} className="bg-gray-50 p-2 border-b border-gray-100">
                        <div className="space-y-2">
                          <h4 className="text-xs text-gray-500 mb-2">
                            Journaalregels
                          </h4>
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-gray-300">
                                <th className="text-left py-1.5 text-xs uppercase tracking-wide">
                                  Rekening
                                </th>
                                <th className="text-left py-1.5 text-xs uppercase tracking-wide">
                                  Omschrijving
                                </th>
                                <th className="text-right py-1.5 text-xs uppercase tracking-wide">
                                  Debet
                                </th>
                                <th className="text-right py-1.5 text-xs uppercase tracking-wide">
                                  Credit
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {entry.lines.map((line) => (
                                <tr key={line.id} className="border-b border-gray-200">
                                  <td className="py-1.5 text-sm text-gray-900">
                                    {getAccountName(line.account_id)}
                                  </td>
                                  <td className="py-1.5 text-sm text-gray-600">
                                    {line.description || '-'}
                                  </td>
                                  <td className="py-1.5 text-right text-sm text-gray-900 whitespace-nowrap">
                                    {line.debit > 0
                                      ? `€${line.debit.toLocaleString('nl-NL', {
                                          minimumFractionDigits: 2,
                                        })}`
                                      : '-'}
                                  </td>
                                  <td className="py-1.5 text-right text-sm text-gray-900 whitespace-nowrap">
                                    {line.credit > 0
                                      ? `€${line.credit.toLocaleString('nl-NL', {
                                          minimumFractionDigits: 2,
                                        })}`
                                      : '-'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot className="border-t-2 border-slate-300">
                              <tr>
                                <td
                                  colSpan={2}
                                  className="py-2 text-right font-semibold text-slate-900"
                                >
                                  Totals:
                                </td>
                                <td className="py-2 text-right font-semibold text-slate-900">
                                  €
                                  {entry.lines
                                    .reduce((sum, l) => sum + l.debit, 0)
                                    .toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                                </td>
                                <td className="py-2 text-right font-semibold text-slate-900">
                                  €
                                  {entry.lines
                                    .reduce((sum, l) => sum + l.credit, 0)
                                    .toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
        </div>
      )}

      <JournalEntryModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingEntry(null);
        }}
        onSuccess={() => {
          loadData();
        }}
        editingEntry={editingEntry}
        accounts={accounts}
      />

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-start gap-3 mb-4">
              <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">Delete Memorial Entry?</h3>
                <p className="text-sm text-slate-600">
                  This will permanently delete this journal entry and all its lines. This action
                  cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-semibold"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
