import { useState, useEffect } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';

type Account = Database['public']['Tables']['accounts']['Row'];
type Contact = Database['public']['Tables']['contacts']['Row'];

interface BankEntryEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  entry: {
    id: string;
    entry_date: string;
    description: string;
    amount: number;
    lines: Array<{
      id: string;
      account_id: string;
      debit: number;
      credit: number;
      description: string | null;
      account?: Account;
    }>;
  } | null;
  accounts: Account[];
}

const VAT_RATES = [
  { value: '0', label: '0% (Geen BTW)' },
  { value: '9', label: '9% (Verlaagd tarief)' },
  { value: '21', label: '21% (Hoog tarief)' },
];

export function BankEntryEditModal({
  isOpen,
  onClose,
  onSuccess,
  entry,
  accounts,
}: BankEntryEditModalProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);

  const [description, setDescription] = useState('');
  const [counterAccountId, setCounterAccountId] = useState('');
  const [contactId, setContactId] = useState('');
  const [vatRate, setVatRate] = useState('0');

  useEffect(() => {
    if (isOpen) {
      loadContacts();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && entry) {
      setDescription(entry.description);

      const nonBankLine = entry.lines.find(l => !l.account?.code?.startsWith('10'));
      if (nonBankLine) {
        setCounterAccountId(nonBankLine.account_id);
      }

      setContactId('');
      setVatRate('0');
      setError(null);
    }
  }, [isOpen, entry]);

  async function loadContacts() {
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('is_active', true)
        .order('company_name');

      if (error) throw error;
      setContacts(data || []);
    } catch (err) {
      console.error('Failed to load contacts:', err);
    }
  }

  async function handleSave() {
    if (!entry) return;

    setError(null);
    setSaving(true);

    try {
      if (!description.trim()) {
        throw new Error('Omschrijving is verplicht');
      }

      if (!counterAccountId) {
        throw new Error('Tegenrekening is verplicht');
      }

      const { error: updateError } = await supabase
        .from('journal_entries')
        .update({
          description: description.trim(),
        })
        .eq('id', entry.id);

      if (updateError) throw updateError;

      const bankLine = entry.lines.find(l => l.account?.code?.startsWith('10'));
      const nonBankLine = entry.lines.find(l => !l.account?.code?.startsWith('10'));

      if (bankLine && nonBankLine) {
        const { error: lineUpdateError } = await supabase
          .from('journal_lines')
          .update({
            account_id: counterAccountId,
            description: description.trim(),
          })
          .eq('id', nonBankLine.id);

        if (lineUpdateError) throw lineUpdateError;
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fout bij opslaan');
    } finally {
      setSaving(false);
    }
  }

  if (!isOpen || !entry) return null;

  const bankLine = entry.lines.find(l => l.account?.code?.startsWith('10'));
  const transactionType = bankLine && bankLine.debit > 0 ? 'Bij' : 'Af';
  const displayAmount = Math.abs(entry.amount);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Bankboeking Wijzigen</h2>
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

          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4 pb-5 border-b border-slate-200">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Datum</label>
                <div className="text-sm font-medium text-slate-900">
                  {new Date(entry.entry_date).toLocaleDateString('nl-NL')}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Bedrag</label>
                <div className="text-sm font-medium text-slate-900">
                  {transactionType === 'Bij' ? '+' : '-'}€{displayAmount.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Type</label>
                <div className="text-sm font-medium text-slate-900">
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs ${
                    transactionType === 'Bij'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {transactionType}
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Bankrekening</label>
                <div className="text-sm font-medium text-slate-900">
                  {bankLine?.account?.code} - {bankLine?.account?.name}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Omschrijving <span className="text-red-500">*</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Grootboekrekening (Tegenrekening) <span className="text-red-500">*</span>
              </label>
              <select
                value={counterAccountId}
                onChange={(e) => setCounterAccountId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Selecteer rekening...</option>
                {accounts
                  .filter(acc => !acc.code.startsWith('10'))
                  .map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.code} - {account.name}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Relatie (Optioneel)
              </label>
              <select
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Geen relatie</option>
                {contacts.map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.company_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                BTW-tarief
              </label>
              <select
                value={vatRate}
                onChange={(e) => setVatRate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {VAT_RATES.map((rate) => (
                  <option key={rate.value} value={rate.value}>
                    {rate.label}
                  </option>
                ))}
              </select>
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
            onClick={handleSave}
            disabled={saving || !description.trim() || !counterAccountId}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Opslaan...' : 'Wijzigingen Opslaan'}
          </button>
        </div>
      </div>
    </div>
  );
}
