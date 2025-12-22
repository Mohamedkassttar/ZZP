import { useState, useEffect } from 'react';
import { Save, DollarSign, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import {
  getFinancialSettings,
  updateFinancialSettings,
  type FinancialSettings as Settings,
} from '../../lib/financialSettingsService';
import type { Database } from '../../lib/database.types';

type Account = Database['public']['Tables']['accounts']['Row'];

export function FinancialSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [cashAccountId, setCashAccountId] = useState<string>('');
  const [privateAccountId, setPrivateAccountId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [settingsData, accountsData] = await Promise.all([
        getFinancialSettings(),
        supabase.from('accounts').select('*').order('code'),
      ]);

      if (settingsData) {
        setSettings(settingsData);
        setCashAccountId(settingsData.cash_account_id || '');
        setPrivateAccountId(settingsData.private_account_id || '');
      }

      if (accountsData.data) {
        setAccounts(accountsData.data);
      }
    } catch (err) {
      console.error('Error loading financial settings:', err);
      setMessage({
        type: 'error',
        text: 'Fout bij laden van instellingen',
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);

    try {
      const result = await updateFinancialSettings(
        cashAccountId || null,
        privateAccountId || null
      );

      if (result.success) {
        setMessage({
          type: 'success',
          text: 'Instellingen succesvol opgeslagen',
        });
        await loadData();
      } else {
        setMessage({
          type: 'error',
          text: result.error || 'Fout bij opslaan',
        });
      }
    } catch (err) {
      console.error('Error saving settings:', err);
      setMessage({
        type: 'error',
        text: 'Onverwachte fout bij opslaan',
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Laden...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Financiële Instellingen</h2>
              <p className="text-sm text-gray-500 mt-1">
                Configureer standaard grootboekrekeningen voor kas- en privé-transacties
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {message && (
            <div
              className={`p-4 rounded-lg flex items-start gap-3 ${
                message.type === 'success'
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-red-50 border border-red-200'
              }`}
            >
              {message.type === 'success' ? (
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              )}
              <p
                className={`text-sm ${
                  message.type === 'success' ? 'text-green-800' : 'text-red-800'
                }`}
              >
                {message.text}
              </p>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Waarom deze instellingen?</p>
                <p>
                  Wanneer je een factuur direct betaalt (via "Betalen met Kas" of "Privé Opname"),
                  gebruikt het systeem deze instellingen om automatisch de juiste tegenrekening te
                  kiezen. Dit voorkomt fouten en zorgt voor consistente boekingen.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Standaard Kasrekening
              </label>
              <select
                value={cashAccountId}
                onChange={(e) => setCashAccountId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Geen selectie</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.code} - {account.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Deze rekening wordt gebruikt bij "Betalen met Kas"
              </p>
              {settings?.cash_account && cashAccountId === settings.cash_account_id && (
                <div className="mt-2 text-xs text-green-600 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  Huidig: {settings.cash_account.code} - {settings.cash_account.name}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Standaard Privérekening
              </label>
              <select
                value={privateAccountId}
                onChange={(e) => setPrivateAccountId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Geen selectie</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.code} - {account.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Deze rekening wordt gebruikt bij "Privé Opname"
              </p>
              {settings?.private_account && privateAccountId === settings.private_account_id && (
                <div className="mt-2 text-xs text-green-600 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  Huidig: {settings.private_account.code} - {settings.private_account.name}
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-gray-200 flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Opslaan...' : 'Opslaan'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
