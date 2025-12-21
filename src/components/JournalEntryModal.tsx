import { useState, useEffect } from 'react';
import { Plus, Trash2, Save, X, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';

type Account = Database['public']['Tables']['accounts']['Row'];
type JournalEntry = Database['public']['Tables']['journal_entries']['Row'];

interface JournalLine {
  id: string;
  account_id: string;
  debit: string;
  credit: string;
  description: string;
}

interface JournalEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingEntry?: {
    id: string;
    entry_date: string;
    description: string;
    reference: string | null;
    status: string;
    lines: Array<{
      id: string;
      account_id: string;
      debit: number;
      credit: number;
      description: string | null;
    }>;
  } | null;
  accounts: Account[];
}

export function JournalEntryModal({
  isOpen,
  onClose,
  onSuccess,
  editingEntry,
  accounts,
}: JournalEntryModalProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [reference, setReference] = useState('');
  const [lines, setLines] = useState<JournalLine[]>([
    { id: crypto.randomUUID(), account_id: '', debit: '', credit: '', description: '' },
    { id: crypto.randomUUID(), account_id: '', debit: '', credit: '', description: '' },
  ]);

  useEffect(() => {
    if (isOpen && editingEntry) {
      setEntryDate(editingEntry.entry_date);
      setDescription(editingEntry.description);
      setReference(editingEntry.reference || '');
      setLines(
        editingEntry.lines.map((line) => ({
          id: crypto.randomUUID(),
          account_id: line.account_id,
          debit: line.debit > 0 ? line.debit.toString() : '',
          credit: line.credit > 0 ? line.credit.toString() : '',
          description: line.description || '',
        }))
      );
    } else if (isOpen && !editingEntry) {
      resetForm();
    }
  }, [isOpen, editingEntry]);

  function resetForm() {
    setEntryDate(new Date().toISOString().split('T')[0]);
    setDescription('');
    setReference('');
    setLines([
      { id: crypto.randomUUID(), account_id: '', debit: '', credit: '', description: '' },
      { id: crypto.randomUUID(), account_id: '', debit: '', credit: '', description: '' },
    ]);
    setError(null);
  }

  function addLine() {
    setLines([
      ...lines,
      { id: crypto.randomUUID(), account_id: '', debit: '', credit: '', description: '' },
    ]);
  }

  function removeLine(id: string) {
    if (lines.length > 2) {
      setLines(lines.filter((line) => line.id !== id));
    }
  }

  function updateLine(id: string, field: keyof JournalLine, value: string) {
    setLines(
      lines.map((line) => {
        if (line.id === id) {
          const updatedLine = { ...line, [field]: value };
          if (field === 'debit' && value !== '') {
            updatedLine.credit = '';
          } else if (field === 'credit' && value !== '') {
            updatedLine.debit = '';
          }
          return updatedLine;
        }
        return line;
      })
    );
  }

  function calculateTotals() {
    const totalDebit = lines.reduce((sum, line) => sum + (parseFloat(line.debit) || 0), 0);
    const totalCredit = lines.reduce((sum, line) => sum + (parseFloat(line.credit) || 0), 0);
    const difference = Math.abs(totalDebit - totalCredit);
    const balanced = difference < 0.01;
    return { totalDebit, totalCredit, difference, balanced };
  }

  function validateForm() {
    if (!description.trim()) return false;
    const hasValidLines = lines.some(
      (line) => line.account_id && (parseFloat(line.debit) > 0 || parseFloat(line.credit) > 0)
    );
    if (!hasValidLines) return false;
    const { balanced } = calculateTotals();
    return balanced;
  }

  async function handleSave(asFinal: boolean = false) {
    setError(null);
    setSaving(true);

    try {
      const { totalDebit, totalCredit } = calculateTotals();

      if (Math.abs(totalDebit - totalCredit) >= 0.01) {
        throw new Error('Debits must equal Credits');
      }

      const validLines = lines.filter(
        (line) => line.account_id && (parseFloat(line.debit) > 0 || parseFloat(line.credit) > 0)
      );

      const journalLines = validLines.map((line) => ({
        account_id: line.account_id,
        debit: parseFloat(line.debit) || 0,
        credit: parseFloat(line.credit) || 0,
        description: line.description || null,
      }));

      if (editingEntry) {
        const { error: updateError } = await supabase
          .from('journal_entries')
          .update({
            entry_date: entryDate,
            description,
            reference: reference || null,
            status: asFinal ? 'Final' : editingEntry.status,
          })
          .eq('id', editingEntry.id);

        if (updateError) throw updateError;

        const { error: deleteError } = await supabase
          .from('journal_lines')
          .delete()
          .eq('journal_entry_id', editingEntry.id);

        if (deleteError) throw deleteError;

        const journalLinesWithId = journalLines.map((line) => ({
          ...line,
          journal_entry_id: editingEntry.id,
        }));

        const { error: insertError } = await supabase
          .from('journal_lines')
          .insert(journalLinesWithId);

        if (insertError) throw insertError;
      } else {
        const { data: journalEntry, error: entryError } = await supabase
          .from('journal_entries')
          .insert({
            entry_date: entryDate,
            description,
            reference: reference || null,
            status: asFinal ? 'Final' : 'Draft',
          })
          .select()
          .single();

        if (entryError) throw entryError;

        const journalLinesWithId = journalLines.map((line) => ({
          ...line,
          journal_entry_id: journalEntry.id,
        }));

        const { error: linesError } = await supabase.from('journal_lines').insert(journalLinesWithId);

        if (linesError) throw linesError;
      }

      onSuccess();
      onClose();
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save journal entry');
    } finally {
      setSaving(false);
    }
  }

  if (!isOpen) return null;

  const { totalDebit, totalCredit, difference, balanced } = calculateTotals();
  const isValid = validateForm();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">
            {editingEntry ? 'Wijzig Boeking' : 'Nieuwe Memoriaal Boeking'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="text-red-800">{error}</div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Reference</label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Invoice #, etc."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Description <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Transaction description"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="border-t border-slate-200 pt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Journal Lines</h3>
              <button
                onClick={addLine}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Line
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-2 text-sm font-semibold text-slate-700">
                      Account
                    </th>
                    <th className="text-left py-3 px-2 text-sm font-semibold text-slate-700">
                      Description
                    </th>
                    <th className="text-right py-3 px-2 text-sm font-semibold text-slate-700">
                      Debit
                    </th>
                    <th className="text-right py-3 px-2 text-sm font-semibold text-slate-700">
                      Credit
                    </th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => (
                    <tr key={line.id} className="border-b border-slate-100">
                      <td className="py-2 px-2">
                        <select
                          value={line.account_id}
                          onChange={(e) => updateLine(line.id, 'account_id', e.target.value)}
                          className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="">Select account...</option>
                          {accounts.map((account) => (
                            <option key={account.id} value={account.id}>
                              {account.code} - {account.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="text"
                          value={line.description}
                          onChange={(e) => updateLine(line.id, 'description', e.target.value)}
                          placeholder="Optional"
                          className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={line.debit}
                          onChange={(e) => updateLine(line.id, 'debit', e.target.value)}
                          disabled={!!line.credit}
                          className="w-full px-2 py-1.5 text-sm text-right border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-50"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={line.credit}
                          onChange={(e) => updateLine(line.id, 'credit', e.target.value)}
                          disabled={!!line.debit}
                          className="w-full px-2 py-1.5 text-sm text-right border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-50"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <button
                          onClick={() => removeLine(line.id)}
                          disabled={lines.length <= 2}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-300">
                    <td colSpan={2} className="py-3 px-2 text-right font-semibold text-slate-900">
                      Totals:
                    </td>
                    <td className="py-3 px-2 text-right font-semibold text-slate-900">
                      €{totalDebit.toFixed(2)}
                    </td>
                    <td className="py-3 px-2 text-right font-semibold text-slate-900">
                      €{totalCredit.toFixed(2)}
                    </td>
                    <td></td>
                  </tr>
                  <tr>
                    <td colSpan={2} className="py-2 px-2 text-right"></td>
                    <td colSpan={3} className="py-2 px-2 text-right">
                      {balanced ? (
                        <span className="text-sm font-semibold text-green-600">
                          ✓ In balans
                        </span>
                      ) : (
                        <span className="text-sm font-semibold text-red-600">
                          Verschil: €{difference.toFixed(2)}
                        </span>
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3 bg-slate-50">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-6 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-white transition-colors disabled:opacity-50"
          >
            Annuleren
          </button>
          <button
            onClick={() => handleSave(false)}
            disabled={!isValid || saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Opslaan...' : editingEntry ? 'Bijwerken' : 'Opslaan als Concept'}
          </button>
          {!editingEntry && (
            <button
              onClick={() => handleSave(true)}
              disabled={!isValid || saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Opslaan...' : 'Opslaan en Definitief maken'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
