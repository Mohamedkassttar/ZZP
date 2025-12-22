import { useState, useEffect } from 'react';
import { Plus, Trash2, Save, Upload, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { BankImporter } from './BankImporter';
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

export function Boeken() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showImporter, setShowImporter] = useState(false);
  const [bankAccountId, setBankAccountId] = useState<string>('');

  // Memorial entry state
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
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('is_active', true)
        .order('code');

      if (error) throw error;

      const sortedAccounts = (data || []).sort((a, b) => {
        const numA = parseInt(a.code);
        const numB = parseInt(b.code);
        return numA - numB;
      });

      setAccounts(sortedAccounts);

      // Find bank account
      const bankAccount = sortedAccounts.find(a => a.code === '1000' || a.type === 'Asset');
      if (bankAccount) {
        setBankAccountId(bankAccount.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load accounts');
    } finally {
      setLoading(false);
    }
  }

  function addLine() {
    setLines([...lines, { id: crypto.randomUUID(), account_id: '', debit: '', credit: '', description: '' }]);
  }

  function removeLine(id: string) {
    if (lines.length > 2) {
      setLines(lines.filter(line => line.id !== id));
    }
  }

  function updateLine(id: string, field: keyof JournalLine, value: string) {
    setLines(lines.map(line => (line.id === id ? { ...line, [field]: value } : line)));
  }

  function calculateTotals() {
    const debitTotal = lines.reduce((sum, line) => sum + (parseFloat(line.debit) || 0), 0);
    const creditTotal = lines.reduce((sum, line) => sum + (parseFloat(line.credit) || 0), 0);
    return { debitTotal, creditTotal, balanced: Math.abs(debitTotal - creditTotal) < 0.01 };
  }

  function resetForm() {
    setEntryDate(new Date().toISOString().split('T')[0]);
    setDescription('');
    setReference('');
    setLines([
      { id: crypto.randomUUID(), account_id: '', debit: '', credit: '', description: '' },
      { id: crypto.randomUUID(), account_id: '', debit: '', credit: '', description: '' },
    ]);
  }

  async function handleSave() {
    setError(null);
    setSuccess(null);

    const { debitTotal, creditTotal, balanced } = calculateTotals();

    if (!balanced) {
      setError('Boeking is niet in balans. Debet en Credit moeten gelijk zijn.');
      return;
    }

    if (debitTotal === 0) {
      setError('Voer minimaal één bedrag in.');
      return;
    }

    setSaving(true);

    try {
      const companyId = await getCurrentCompanyId();
      if (!companyId) {
        throw new Error('Geen bedrijf geselecteerd');
      }

      const entryId = crypto.randomUUID();

      const { error: entryError } = await supabase
        .from('journal_entries')
        .insert({
          id: entryId,
          company_id: companyId,
          entry_date: entryDate,
          description,
          reference,
          type: 'Memoriaal',
          status: 'Final',
        });

      if (entryError) throw entryError;

      const entry = { id: entryId };

      const journalLines = lines
        .filter((line) => parseFloat(line.debit) > 0 || parseFloat(line.credit) > 0)
        .map((line) => ({
          journal_entry_id: entry.id,
          account_id: line.account_id,
          debit: parseFloat(line.debit) || 0,
          credit: parseFloat(line.credit) || 0,
          description: line.description || null,
        }));

      const { error: linesError } = await supabase.from('journal_lines').insert(journalLines);

      if (linesError) throw linesError;

      setSuccess('Memoriaal boeking succesvol opgeslagen!');
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save entry');
    } finally {
      setSaving(false);
    }
  }

  const { debitTotal, creditTotal, balanced } = calculateTotals();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-500 text-xs">Laden...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Boeken</h1>
        <p className="text-sm text-gray-500">Handmatige invoer en bankimport</p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-red-800">{error}</div>
        </div>
      )}

      {success && (
        <div className="p-3 bg-green-50 border border-green-200 rounded flex items-start gap-2">
          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-green-800">{success}</div>
        </div>
      )}

      {/* Bank Import Section */}
      <div className="rounded-lg border border-gray-200 shadow-sm p-4">
        <h2 className="text-base font-semibold text-gray-900 mb-2">Bankafschrift importeren</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowImporter(true)}
            disabled={!bankAccountId}
            className="h-9 flex items-center gap-1.5 px-4 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 transition-colors disabled:bg-gray-400"
          >
            <Upload className="w-3.5 h-3.5" />
            Importeer CSV/MT940
          </button>
          <p className="text-xs text-gray-500">Upload bankafschrift voor reconciliatie</p>
        </div>
      </div>

      {/* Manual Entry Section */}
      <div className="rounded-lg border border-gray-200 shadow-sm p-4">
        <h2 className="text-base font-semibold text-gray-900 mb-3">Memoriaal boeking</h2>

        <div className="grid grid-cols-3 gap-4 mb-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Datum</label>
            <input
              type="date"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              className="h-9 w-full px-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Omschrijving</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Beschrijving boeking"
              className="h-9 w-full px-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Referentie</label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Optioneel"
              className="h-9 w-full px-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="h-10 bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-2 py-2 text-left text-xs uppercase tracking-wide">Grootboekrekening</th>
                <th className="px-2 py-2 text-left text-xs uppercase tracking-wide">Omschrijving</th>
                <th className="px-2 py-2 text-right text-xs uppercase tracking-wide w-24">Debet</th>
                <th className="px-2 py-2 text-right text-xs uppercase tracking-wide w-24">Credit</th>
                <th className="px-2 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lines.map((line, index) => (
                <tr key={line.id} className="h-10 border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-2 py-2">
                    <select
                      value={line.account_id}
                      onChange={(e) => updateLine(line.id, 'account_id', e.target.value)}
                      className="h-9 w-full px-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Selecteer rekening...</option>
                      {accounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.code} - {acc.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="text"
                      value={line.description}
                      onChange={(e) => updateLine(line.id, 'description', e.target.value)}
                      placeholder="Optioneel"
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="number"
                      step="0.01"
                      value={line.debit}
                      onChange={(e) => updateLine(line.id, 'debit', e.target.value)}
                      placeholder="0.00"
                      className="w-full px-2 py-1 text-xs text-right border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="number"
                      step="0.01"
                      value={line.credit}
                      onChange={(e) => updateLine(line.id, 'credit', e.target.value)}
                      placeholder="0.00"
                      className="w-full px-2 py-1 text-xs text-right border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    {lines.length > 2 && (
                      <button
                        onClick={() => removeLine(line.id)}
                        className="text-red-600 hover:text-red-700"
                        title="Regel verwijderen"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-gray-300">
              <tr>
                <td colSpan={2} className="px-2 py-1.5 text-right text-xs font-semibold text-gray-700">
                  Totaal:
                </td>
                <td className="px-2 py-1.5 text-right text-xs font-semibold">
                  €{debitTotal.toFixed(2)}
                </td>
                <td className="px-2 py-1.5 text-right text-xs font-semibold">
                  €{creditTotal.toFixed(2)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {!balanced && debitTotal > 0 && (
          <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded">
            <p className="text-xs text-amber-800">
              Verschil: €{Math.abs(debitTotal - creditTotal).toFixed(2)} - Boeking niet in balans
            </p>
          </div>
        )}

        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={addLine}
            className="h-9 flex items-center gap-1.5 px-4 bg-gray-100 text-gray-700 rounded text-sm font-medium hover:bg-gray-200 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Regel toevoegen
          </button>
          <button
            onClick={handleSave}
            disabled={!balanced || saving || debitTotal === 0}
            className="h-9 flex items-center gap-1.5 px-4 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Opslaan...' : 'Boeking opslaan'}
          </button>
        </div>
      </div>

      {showImporter && bankAccountId && (
        <BankImporter
          bankAccountId={bankAccountId}
          onClose={() => setShowImporter(false)}
          onComplete={() => {
            setShowImporter(false);
            setSuccess('Banktransacties succesvol geïmporteerd');
          }}
        />
      )}
    </div>
  );
}
