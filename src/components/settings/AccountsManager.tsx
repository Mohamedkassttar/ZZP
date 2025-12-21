import { useState, useEffect } from 'react';
import { Plus, CreditCard as Edit2, Loader, CheckCircle, XCircle, FileSpreadsheet, Trash2, Sparkles } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { UniversalImporter } from '../UniversalImporter';
import { chartOfAccountsConfig } from '../../lib/importConfigs';
import { inferTaxCategory } from '../../lib/taxCategoryInference';
import type { Database } from '../../lib/database.types';

type Account = Database['public']['Tables']['accounts']['Row'];

export function AccountsManager() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImporter, setShowImporter] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [editingTaxCategoryId, setEditingTaxCategoryId] = useState<string | null>(null);
  const [editingRgsCodeId, setEditingRgsCodeId] = useState<string | null>(null);
  const [editingVatCodeId, setEditingVatCodeId] = useState<string | null>(null);
  const [isAutoMapping, setIsAutoMapping] = useState(false);

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    type: 'Expense' as Database['public']['Enums']['account_type'],
    vat_code: 21,
    description: '',
    tax_category: null as Database['public']['Enums']['dutch_tax_category'] | null,
    rgs_code: '',
  });

  useEffect(() => {
    loadAccounts();
  }, []);

  async function loadAccounts() {
    try {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .order('code', { ascending: true });

      if (error) throw error;

      setAccounts(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load accounts');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setError(null);
    setSuccess(null);

    try {
      if (editingAccount) {
        const { error } = await supabase
          .from('accounts')
          .update({
            name: formData.name,
            vat_code: formData.vat_code,
            description: formData.description,
            tax_category: formData.tax_category,
            rgs_code: formData.rgs_code || null,
          })
          .eq('id', editingAccount.id);

        if (error) throw error;
        setSuccess('Account updated successfully');
      } else {
        const { error } = await supabase.from('accounts').insert({
          code: formData.code,
          name: formData.name,
          type: formData.type,
          vat_code: formData.vat_code,
          description: formData.description,
          tax_category: formData.tax_category,
          rgs_code: formData.rgs_code || null,
          is_active: true,
        });

        if (error) throw error;
        setSuccess('Account created successfully');
      }

      await loadAccounts();
      setEditingAccount(null);
      setShowAddModal(false);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save account');
    }
  }

  async function toggleActive(account: Account) {
    try {
      const { error } = await supabase
        .from('accounts')
        .update({ is_active: !account.is_active })
        .eq('id', account.id);

      if (error) throw error;
      await loadAccounts();
      setSuccess(`Account ${account.is_active ? 'deactivated' : 'activated'}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle account');
    }
  }

  async function updateAccountType(accountId: string, newType: Database['public']['Enums']['account_type']) {
    try {
      const { error } = await supabase
        .from('accounts')
        .update({ type: newType })
        .eq('id', accountId);

      if (error) throw error;
      await loadAccounts();
      setEditingTypeId(null);
      setSuccess('Account category updated successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update category');
    }
  }

  async function updateTaxCategory(accountId: string, newCategory: Database['public']['Enums']['dutch_tax_category'] | null) {
    try {
      const { error } = await supabase
        .from('accounts')
        .update({ tax_category: newCategory })
        .eq('id', accountId);

      if (error) throw error;
      await loadAccounts();
      setEditingTaxCategoryId(null);
      setSuccess('Fiscale categorie succesvol bijgewerkt');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fiscale categorie kon niet worden bijgewerkt');
    }
  }

  async function updateRgsCode(accountId: string, newRgsCode: string) {
    try {
      const { error } = await supabase
        .from('accounts')
        .update({ rgs_code: newRgsCode || null })
        .eq('id', accountId);

      if (error) throw error;
      await loadAccounts();
      setEditingRgsCodeId(null);
      setSuccess('RGS code succesvol bijgewerkt');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'RGS code kon niet worden bijgewerkt');
    }
  }

  async function updateVatCode(accountId: string, newVatCode: number) {
    try {
      const { error } = await supabase
        .from('accounts')
        .update({ vat_code: newVatCode })
        .eq('id', accountId);

      if (error) throw error;
      await loadAccounts();
      setEditingVatCodeId(null);
      setSuccess('BTW percentage succesvol bijgewerkt');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'BTW percentage kon niet worden bijgewerkt');
    }
  }

  function getTypeBadgeColor(type: string) {
    switch (type) {
      case 'Asset':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Liability':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'Equity':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'Revenue':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'Expense':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  }

  function getTypeLabel(type: string) {
    switch (type) {
      case 'Asset':
        return 'Activa';
      case 'Liability':
        return 'Passiva';
      case 'Equity':
        return 'Eigen Vermogen';
      case 'Revenue':
        return 'Omzet';
      case 'Expense':
        return 'Kosten';
      default:
        return type;
    }
  }

  function startEdit(account: Account) {
    setEditingAccount(account);
    setFormData({
      code: account.code,
      name: account.name,
      type: account.type,
      vat_code: account.vat_code,
      description: account.description || '',
      tax_category: account.tax_category || null,
      rgs_code: account.rgs_code || '',
    });
  }

  function resetForm() {
    setFormData({
      code: '',
      name: '',
      type: 'Expense',
      vat_code: 21,
      description: '',
      tax_category: null,
      rgs_code: '',
    });
  }

  function handleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedAccountIds(accounts.map((account) => account.id));
    } else {
      setSelectedAccountIds([]);
    }
  }

  function handleSelectAccount(accountId: string, checked: boolean) {
    if (checked) {
      setSelectedAccountIds([...selectedAccountIds, accountId]);
    } else {
      setSelectedAccountIds(selectedAccountIds.filter((id) => id !== accountId));
    }
  }

  async function handleBulkDeactivate() {
    setShowBulkConfirm(false);
    setError(null);
    setSuccess(null);

    try {
      const { error: bulkError } = await supabase
        .from('accounts')
        .update({ is_active: false })
        .in('id', selectedAccountIds);

      if (bulkError) throw bulkError;

      await loadAccounts();
      setSelectedAccountIds([]);
      setSuccess(`Successfully deactivated ${selectedAccountIds.length} account(s)`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to deactivate accounts');
    }
  }

  async function handleAIAutoMap() {
    setIsAutoMapping(true);
    setError(null);
    setSuccess(null);

    try {
      let skippedCount = 0;
      const updates: Array<{ id: string; tax_category: Database['public']['Enums']['dutch_tax_category'] }> = [];

      for (const account of accounts) {
        const inferredCategory = inferTaxCategory(account.name, account.code, account.type);

        if (inferredCategory === null) {
          skippedCount++;
          continue;
        }

        if (inferredCategory !== account.tax_category) {
          updates.push({
            id: account.id,
            tax_category: inferredCategory,
          });
        }
      }

      if (updates.length === 0) {
        if (skippedCount > 0) {
          setSuccess(`Alle grootboekrekeningen met herkenbare patronen hebben al de juiste categorieën. ${skippedCount} ${skippedCount === 1 ? 'rekening kon' : 'rekeningen konden'} niet automatisch bepaald worden.`);
        } else {
          setSuccess('Alle grootboekrekeningen hebben al de juiste fiscale categorieën.');
        }
        setIsAutoMapping(false);
        return;
      }

      for (const update of updates) {
        const { error: updateError } = await supabase
          .from('accounts')
          .update({ tax_category: update.tax_category })
          .eq('id', update.id);

        if (updateError) throw updateError;
      }

      const updatedCount = updates.length;
      await loadAccounts();

      if (skippedCount > 0) {
        setSuccess(`Succes! ${updatedCount} ${updatedCount === 1 ? 'rekening is' : 'rekeningen zijn'} automatisch gekoppeld. ${skippedCount} ${skippedCount === 1 ? 'rekening kon' : 'rekeningen konden'} niet met zekerheid bepaald worden; controleer deze handmatig.`);
      } else {
        setSuccess(`Succes! ${updatedCount} ${updatedCount === 1 ? 'grootboekrekening is' : 'grootboekrekeningen zijn'} automatisch gekoppeld aan een fiscale categorie.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Er is een fout opgetreden bij het automatisch toewijzen van categorieën.');
    } finally {
      setIsAutoMapping(false);
    }
  }

  const isAllSelected = accounts.length > 0 && selectedAccountIds.length === accounts.length;
  const isSomeSelected = selectedAccountIds.length > 0 && selectedAccountIds.length < accounts.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Chart of Accounts</h2>
        <div className="flex gap-3">
          <button
            onClick={handleAIAutoMap}
            disabled={isAutoMapping}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-lg hover:from-violet-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md"
          >
            {isAutoMapping ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                Analyseren...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                AI Categorieën Toewijzen
              </>
            )}
          </button>
          <button
            onClick={() => setShowImporter(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Import Accounts
          </button>
          <button
            onClick={() => {
              resetForm();
              setShowAddModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Add Account
          </button>
        </div>
      </div>

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <span className="text-green-800">{success}</span>
        </div>
      )}

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <XCircle className="w-5 h-5 text-red-600" />
          <span className="text-red-800">{error}</span>
        </div>
      )}

      <div className="overflow-x-auto relative">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left w-12">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  ref={(input) => {
                    if (input) {
                      input.indeterminate = isSomeSelected;
                    }
                  }}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Code</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Name</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Type</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Tax Category (IB Aangifte)</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">RGS Code</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">VAT %</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Status</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {accounts.map((account) => (
              <tr key={account.id} className={!account.is_active ? 'bg-gray-50 opacity-60' : ''}>
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedAccountIds.includes(account.id)}
                    onChange={(e) => handleSelectAccount(account.id, e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                </td>
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{account.code}</td>
                <td className="px-4 py-3 text-sm text-gray-900">{account.name}</td>
                <td className="px-4 py-3 text-sm">
                  {editingTypeId === account.id ? (
                    <select
                      value={account.type}
                      onChange={(e) => updateAccountType(account.id, e.target.value as Database['public']['Enums']['account_type'])}
                      onBlur={() => setEditingTypeId(null)}
                      autoFocus
                      className="px-2 py-1 border border-blue-300 rounded text-xs focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Asset">Activa</option>
                      <option value="Liability">Passiva</option>
                      <option value="Equity">Eigen Vermogen</option>
                      <option value="Revenue">Omzet</option>
                      <option value="Expense">Kosten</option>
                    </select>
                  ) : (
                    <button
                      onClick={() => setEditingTypeId(account.id)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border cursor-pointer hover:opacity-80 transition-opacity ${getTypeBadgeColor(account.type)}`}
                    >
                      {getTypeLabel(account.type)}
                    </button>
                  )}
                </td>
                <td className="px-4 py-3 text-sm">
                  {editingTaxCategoryId === account.id ? (
                    <select
                      value={account.tax_category || ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        updateTaxCategory(account.id, value ? value as Database['public']['Enums']['dutch_tax_category'] : null);
                      }}
                      onBlur={() => setEditingTaxCategoryId(null)}
                      autoFocus
                      className="w-full px-2 py-1.5 border border-blue-300 rounded text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      <option value="">-- Niet ingesteld --</option>
                      <optgroup label="Balans - Activa">
                        <option value="Materiële vaste activa">Materiële vaste activa</option>
                        <option value="Immateriële vaste activa">Immateriële vaste activa</option>
                        <option value="Financiële vaste activa">Financiële vaste activa</option>
                        <option value="Voorraden">Voorraden</option>
                        <option value="Vorderingen">Vorderingen</option>
                        <option value="Liquide middelen">Liquide middelen</option>
                      </optgroup>
                      <optgroup label="Balans - Passiva">
                        <option value="Kortlopende schulden">Kortlopende schulden</option>
                        <option value="Langlopende schulden">Langlopende schulden</option>
                        <option value="Ondernemingsvermogen">Ondernemingsvermogen</option>
                      </optgroup>
                      <optgroup label="Winst & Verlies - Opbrengsten">
                        <option value="Netto Omzet">Netto Omzet</option>
                      </optgroup>
                      <optgroup label="Winst & Verlies - Kosten">
                        <option value="Inkoopwaarde van de omzet">Inkoopwaarde van de omzet</option>
                        <option value="Afschrijvingen">Afschrijvingen</option>
                        <option value="Huisvestingskosten">Huisvestingskosten</option>
                        <option value="Kantoorkosten">Kantoorkosten</option>
                        <option value="Kosten van vervoer">Kosten van vervoer</option>
                        <option value="Verkoopkosten">Verkoopkosten</option>
                        <option value="Algemene kosten">Algemene kosten</option>
                        <option value="Rente en bankkosten">Rente en bankkosten</option>
                      </optgroup>
                    </select>
                  ) : (
                    <button
                      onClick={() => setEditingTaxCategoryId(account.id)}
                      className="w-full text-left px-2 py-1 rounded hover:bg-blue-50 transition-colors cursor-pointer"
                    >
                      {account.tax_category ? (
                        <span className="text-gray-900 text-xs">{account.tax_category}</span>
                      ) : (
                        <span className="text-gray-400 italic text-xs">Klik om in te stellen</span>
                      )}
                    </button>
                  )}
                </td>
                <td className="px-4 py-3 text-sm">
                  {editingRgsCodeId === account.id ? (
                    <input
                      type="text"
                      defaultValue={account.rgs_code || ''}
                      onBlur={(e) => updateRgsCode(account.id, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          updateRgsCode(account.id, e.currentTarget.value);
                        } else if (e.key === 'Escape') {
                          setEditingRgsCodeId(null);
                        }
                      }}
                      autoFocus
                      className="w-full px-2 py-1 border border-blue-300 rounded text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      placeholder="bijv. WBedAutBra"
                    />
                  ) : (
                    <button
                      onClick={() => setEditingRgsCodeId(account.id)}
                      className="w-full text-left px-2 py-1 rounded hover:bg-blue-50 transition-colors cursor-pointer"
                    >
                      {account.rgs_code ? (
                        <span className="text-gray-900 text-xs font-mono">{account.rgs_code}</span>
                      ) : (
                        <span className="text-gray-400 italic text-xs">Klik om in te stellen</span>
                      )}
                    </button>
                  )}
                </td>
                <td className="px-4 py-3 text-sm">
                  {editingVatCodeId === account.id ? (
                    <select
                      value={account.vat_code}
                      onChange={(e) => updateVatCode(account.id, Number(e.target.value))}
                      onBlur={() => setEditingVatCodeId(null)}
                      autoFocus
                      className="w-full px-2 py-1 border border-blue-300 rounded text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      <option value={0}>0%</option>
                      <option value={9}>9%</option>
                      <option value={21}>21%</option>
                    </select>
                  ) : (
                    <button
                      onClick={() => setEditingVatCodeId(account.id)}
                      className="w-full text-left px-2 py-1 rounded hover:bg-blue-50 transition-colors cursor-pointer"
                    >
                      <span className="text-gray-900 text-xs font-semibold">{account.vat_code}%</span>
                    </button>
                  )}
                </td>
                <td className="px-4 py-3 text-sm">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      account.is_active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {account.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right space-x-2">
                  <button
                    onClick={() => startEdit(account)}
                    className="text-blue-600 hover:text-blue-700"
                  >
                    <Edit2 className="w-4 h-4 inline" />
                  </button>
                  <button
                    onClick={() => toggleActive(account)}
                    className={`ml-2 text-sm ${
                      account.is_active ? 'text-red-600' : 'text-green-600'
                    }`}
                  >
                    {account.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {selectedAccountIds.length > 0 && (
          <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-slate-800 text-white rounded-lg shadow-2xl px-6 py-4 flex items-center gap-6 z-40 animate-in slide-in-from-bottom-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-blue-400" />
              <span className="font-semibold">
                {selectedAccountIds.length} account{selectedAccountIds.length > 1 ? 's' : ''} selected
              </span>
            </div>
            <div className="h-6 w-px bg-slate-600" />
            <button
              onClick={() => setShowBulkConfirm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors font-medium"
            >
              <Trash2 className="w-4 h-4" />
              Deactivate Selected
            </button>
            <button
              onClick={() => setSelectedAccountIds([])}
              className="text-slate-300 hover:text-white transition-colors"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {(showAddModal || editingAccount) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-bold mb-4">
              {editingAccount ? 'Edit Account' : 'Add New Account'}
            </h3>
            <div className="space-y-4">
              {!editingAccount && (
                <div>
                  <label className="block text-sm font-medium mb-1">Account Code</label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Category</label>
                <select
                  value={formData.type}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      type: e.target.value as Database['public']['Enums']['account_type'],
                    })
                  }
                  className="w-full px-3 py-2 border rounded-lg"
                  disabled={!!editingAccount}
                >
                  <option value="Asset">Activa (Assets)</option>
                  <option value="Liability">Passiva (Liabilities)</option>
                  <option value="Equity">Eigen Vermogen (Equity)</option>
                  <option value="Revenue">Omzet (Revenue)</option>
                  <option value="Expense">Kosten (Expenses)</option>
                </select>
                {editingAccount && (
                  <p className="text-xs text-gray-500 mt-1">
                    Category cannot be changed after creation. Use the quick edit in the table.
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Tax Category (IB Aangifte)</label>
                <select
                  value={formData.tax_category || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      tax_category: e.target.value || null,
                    })
                  }
                  className="w-full px-3 py-2 border rounded-lg bg-white"
                >
                  <option value="">-- Select Tax Category --</option>
                  <optgroup label="Winst & Verlies - Omzet">
                    <option value="Netto Omzet">Netto Omzet</option>
                    <option value="Overige Opbrengsten">Overige Opbrengsten</option>
                  </optgroup>
                  <optgroup label="Winst & Verlies - Kosten">
                    <option value="Inkoopwaarde van de omzet">Inkoopwaarde van de omzet</option>
                    <option value="Afschrijvingen">Afschrijvingen</option>
                    <option value="Huisvestingskosten">Huisvestingskosten</option>
                    <option value="Kosten van vervoer">Kosten van vervoer</option>
                    <option value="Kantoorkosten">Kantoorkosten</option>
                    <option value="Verkoopkosten">Verkoopkosten</option>
                    <option value="Algemene kosten">Algemene kosten</option>
                  </optgroup>
                  <optgroup label="Balans - Activa">
                    <option value="Materiële vaste activa">Materiële vaste activa</option>
                    <option value="Financiële vaste activa">Financiële vaste activa</option>
                    <option value="Vorderingen">Vorderingen</option>
                    <option value="Liquide middelen">Liquide middelen</option>
                    <option value="Voorraden">Voorraden</option>
                  </optgroup>
                  <optgroup label="Balans - Passiva">
                    <option value="Ondernemingsvermogen">Ondernemingsvermogen</option>
                    <option value="Voorzieningen">Voorzieningen</option>
                    <option value="Langlopende schulden">Langlopende schulden</option>
                    <option value="Kortlopende schulden">Kortlopende schulden</option>
                  </optgroup>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Required for IB Aangifte (Dutch Tax Return) reporting
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">RGS Code</label>
                <input
                  type="text"
                  value={formData.rgs_code}
                  onChange={(e) => setFormData({ ...formData, rgs_code: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg font-mono text-sm"
                  placeholder="bijv. WBedAutBra, BLiqBan"
                />
                <p className="text-xs text-gray-500 mt-1">
                  RGS (Referentie Grootboekschema) code voor XML Auditfile export
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Default VAT %</label>
                <select
                  value={formData.vat_code}
                  onChange={(e) => setFormData({ ...formData, vat_code: Number(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value={0}>0%</option>
                  <option value={9}>9%</option>
                  <option value={21}>21%</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={2}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setEditingAccount(null);
                  setShowAddModal(false);
                  resetForm();
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg"
              >
                Cancel
              </button>
              <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded-lg">
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {showImporter && (
        <UniversalImporter
          config={chartOfAccountsConfig}
          onClose={() => setShowImporter(false)}
          onComplete={() => {
            loadAccounts();
            setShowImporter(false);
            setSuccess('Accounts imported successfully');
          }}
        />
      )}

      {showBulkConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-red-100 rounded-full">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Deactivate Accounts</h3>
                <p className="text-sm text-gray-600">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-gray-700 mb-6">
              Are you sure you want to deactivate{' '}
              <strong>{selectedAccountIds.length}</strong> account{selectedAccountIds.length > 1 ? 's' : ''}?
              These accounts will no longer appear in dropdowns or be available for new transactions.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowBulkConfirm(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDeactivate}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Deactivate {selectedAccountIds.length} Account{selectedAccountIds.length > 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
