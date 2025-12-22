import { useState, useEffect } from 'react';
import { Plus, Trash2, Save, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';
import { getCurrentCompanyId } from '../lib/companyHelper';

type Account = Database['public']['Tables']['accounts']['Row'];

interface JournalLine {
  id: string;
  account_id: string;
  debit: string;
  credit: string;
  description: string;
}

export function Memoriaal() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [reference, setReference] = useState('');
  const [lines, setLines] = useState<JournalLine[]>([
    { id: crypto.randomUUID(), account_id: '', debit: '', credit: '', description: '' },
    { id: crypto.randomUUID(), account_id: '', debit: '', credit: '', description: '' },
  ]);

  useEffect(() => {
    loadAccounts();
  }, []);

  async function loadAccounts() {
    try {
      const companyId = await getCurrentCompanyId();
      if (!companyId) {
        throw new Error('Geen bedrijf geselecteerd');
      }

      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('is_active', true)
        .eq('company_id', companyId)
        .order('code');

      if (error) throw error;
      setAccounts(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load accounts');
    } finally {
      setLoading(false);
    }
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
    return { totalDebit, totalCredit, balanced: Math.abs(totalDebit - totalCredit) < 0.01 };
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
    setSuccess(null);
    setSaving(true);

    try {
      const companyId = await getCurrentCompanyId();
      if (!companyId) {
        throw new Error('Geen bedrijf geselecteerd');
      }

      const { totalDebit, totalCredit } = calculateTotals();

      if (Math.abs(totalDebit - totalCredit) >= 0.01) {
        throw new Error('Debits must equal Credits');
      }

      const tempId = crypto.randomUUID();

      const { error: entryError } = await supabase
        .from('journal_entries')
        .insert({
          id: tempId,
          company_id: companyId,
          entry_date: entryDate,
          description,
          reference: reference || null,
          status: asFinal ? 'Final' : 'Draft',
          type: 'Memoriaal',
        });

      if (entryError) {
        console.error('Insert error:', entryError);
        throw entryError;
      }

      const journalEntry = { id: tempId };

      const journalLines = lines
        .filter((line) => line.account_id && (parseFloat(line.debit) > 0 || parseFloat(line.credit) > 0))
        .map((line) => ({
          journal_entry_id: journalEntry.id,
          account_id: line.account_id,
          debit: parseFloat(line.debit) || 0,
          credit: parseFloat(line.credit) || 0,
          description: line.description || null,
        }));

      const { error: linesError } = await supabase.from('journal_lines').insert(journalLines);

      if (linesError) throw linesError;

      const statusMsg = asFinal ? 'finalized' : 'saved as draft';
      setSuccess(`Journal entry ${statusMsg} successfully (Reference: ${journalEntry.id.slice(0, 8)})`);
      setDescription('');
      setReference('');
      setLines([
        { id: crypto.randomUUID(), account_id: '', debit: '', credit: '', description: '' },
        { id: crypto.randomUUID(), account_id: '', debit: '', credit: '', description: '' },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save journal entry');
    } finally {
      setSaving(false);
    }
  }

  const { totalDebit, totalCredit, balanced } = calculateTotals();
  const isValid = validateForm();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading accounts...</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Memoriaal Boekingen</h1>
        <p className="text-gray-600">Manual Journal Entries - Double-Entry Bookkeeping</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="text-red-800">{error}</div>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div className="text-green-800">{success}</div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
            <input
              type="date"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Reference</label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Invoice #, etc."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Description *</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Transaction description"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="border-t border-gray-200 pt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Journal Lines</h2>
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
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-2 text-sm font-semibold text-gray-700">Account</th>
                  <th className="text-left py-3 px-2 text-sm font-semibold text-gray-700">Description</th>
                  <th className="text-right py-3 px-2 text-sm font-semibold text-gray-700">Debit</th>
                  <th className="text-right py-3 px-2 text-sm font-semibold text-gray-700">Credit</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.id} className="border-b border-gray-100">
                    <td className="py-2 px-2">
                      <select
                        value={line.account_id}
                        onChange={(e) => updateLine(line.id, 'account_id', e.target.value)}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                        className="w-full px-2 py-1.5 text-sm text-right border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
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
                        className="w-full px-2 py-1.5 text-sm text-right border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
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
                <tr className="border-t-2 border-gray-300">
                  <td colSpan={2} className="py-3 px-2 text-right font-semibold text-gray-900">
                    Totals:
                  </td>
                  <td className="py-3 px-2 text-right font-semibold text-gray-900">
                    €{totalDebit.toFixed(2)}
                  </td>
                  <td className="py-3 px-2 text-right font-semibold text-gray-900">
                    €{totalCredit.toFixed(2)}
                  </td>
                  <td></td>
                </tr>
                <tr>
                  <td colSpan={2} className="py-2 px-2 text-right">
                    <span
                      className={`text-sm font-medium ${
                        balanced ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {balanced ? '✓ Balanced' : '✗ Not Balanced'}
                    </span>
                  </td>
                  <td colSpan={3} className="py-2 px-2 text-right">
                    <span className="text-sm text-gray-600">
                      Difference: €{Math.abs(totalDebit - totalCredit).toFixed(2)}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={() => handleSave(false)}
            disabled={!isValid || saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save as Draft'}
          </button>
          <button
            onClick={() => handleSave(true)}
            disabled={!isValid || saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save and Finalize'}
          </button>
        </div>
      </div>
    </div>
  );
}
