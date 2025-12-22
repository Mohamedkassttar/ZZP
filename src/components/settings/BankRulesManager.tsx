import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, ArrowUp, ArrowDown, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Database } from '../../lib/database.types';

type BankRule = Database['public']['Tables']['bank_rules']['Row'];
type MatchType = Database['public']['Enums']['match_type'];
type Account = Database['public']['Tables']['accounts']['Row'];
type Contact = Database['public']['Tables']['contacts']['Row'];

interface BankRuleWithAccount extends BankRule {
  account?: Account;
  contact?: Contact;
}

export function BankRulesManager() {
  const [rules, setRules] = useState<BankRuleWithAccount[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<BankRule | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    keyword: '',
    match_type: 'Contains' as MatchType,
    target_ledger_account_id: '',
    contact_id: '',
    description_template: '',
    priority: 0,
    is_active: true,
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);

      const [rulesResponse, accountsResponse, contactsResponse] = await Promise.all([
        supabase
          .from('bank_rules')
          .select('*, account:target_ledger_account_id(id, code, name), contact:contact_id(id, company_name)')
          .order('priority', { ascending: false }),
        supabase
          .from('accounts')
          .select('*')
          .eq('is_active', true),
        supabase
          .from('contacts')
          .select('*')
          .eq('is_active', true)
      ]);

      if (rulesResponse.error) throw rulesResponse.error;
      if (accountsResponse.error) throw accountsResponse.error;
      if (contactsResponse.error) throw contactsResponse.error;

      const sortedAccounts = (accountsResponse.data || []).sort((a, b) => {
        const numA = parseInt(a.code);
        const numB = parseInt(b.code);
        return numA - numB;
      });

      setRules(rulesResponse.data || []);
      setAccounts(sortedAccounts);
      setContacts(contactsResponse.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setEditingRule(null);
    setFormData({
      keyword: '',
      match_type: 'Contains',
      target_ledger_account_id: '',
      contact_id: '',
      description_template: '',
      priority: 0,
      is_active: true,
    });
    setShowModal(true);
  }

  function openEditModal(rule: BankRule) {
    setEditingRule(rule);
    setFormData({
      keyword: rule.keyword,
      match_type: rule.match_type,
      target_ledger_account_id: rule.target_ledger_account_id || '',
      contact_id: rule.contact_id || '',
      description_template: rule.description_template || '',
      priority: rule.priority,
      is_active: rule.is_active || true,
    });
    setShowModal(true);
  }

  async function handleSave() {
    setError(null);
    setSuccess(null);

    if (!formData.keyword.trim()) {
      setError('Keyword is required');
      return;
    }

    if (!formData.target_ledger_account_id && !formData.contact_id) {
      setError('Either target account or contact is required');
      return;
    }

    try {
      const dataToSave = {
        keyword: formData.keyword.trim(),
        match_type: formData.match_type,
        target_ledger_account_id: formData.target_ledger_account_id || null,
        contact_id: formData.contact_id || null,
        description_template: formData.description_template.trim() || null,
        priority: formData.priority,
        is_active: formData.is_active,
      };

      if (editingRule) {
        const { error: updateError } = await supabase
          .from('bank_rules')
          .update(dataToSave)
          .eq('id', editingRule.id);

        if (updateError) throw updateError;
        setSuccess('Rule updated successfully');
      } else {
        const { error: insertError } = await supabase
          .from('bank_rules')
          .insert(dataToSave);

        if (insertError) throw insertError;
        setSuccess('Rule created successfully');
      }

      await loadData();
      setShowModal(false);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save rule');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this rule?')) return;

    try {
      const { error } = await supabase
        .from('bank_rules')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setSuccess('Rule deleted successfully');
      await loadData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete rule');
    }
  }

  async function toggleActive(rule: BankRule) {
    try {
      const { error } = await supabase
        .from('bank_rules')
        .update({ is_active: !rule.is_active })
        .eq('id', rule.id);

      if (error) throw error;
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update rule');
    }
  }

  async function changePriority(rule: BankRule, direction: 'up' | 'down') {
    const newPriority = direction === 'up' ? rule.priority + 1 : rule.priority - 1;

    try {
      const { error } = await supabase
        .from('bank_rules')
        .update({ priority: newPriority })
        .eq('id', rule.id);

      if (error) throw error;
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update priority');
    }
  }

  if (loading) {
    return <div className="text-center py-8 text-slate-600">Loading rules...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Bank Allocation Rules</h2>
          <p className="text-slate-600 mt-1">Automate transaction bookkeeping with smart matching rules</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Rule
        </button>
      </div>

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
          <span className="text-green-800">{success}</span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <span className="text-red-800">{error}</span>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        {rules.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            No rules configured. Create your first rule to automate transaction bookkeeping.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-900 uppercase">Priority</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-900 uppercase">Keyword</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-900 uppercase">Match Type</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-900 uppercase">Target Account</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-900 uppercase">Contact</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-900 uppercase">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-900 uppercase">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-900 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {rules.map((rule) => (
                  <tr key={rule.id} className={`hover:bg-slate-50 transition-colors ${!rule.is_active ? 'opacity-50' : ''}`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900">{rule.priority}</span>
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={() => changePriority(rule, 'up')}
                            className="text-slate-400 hover:text-blue-600 transition-colors"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => changePriority(rule, 'down')}
                            className="text-slate-400 hover:text-blue-600 transition-colors"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-medium text-slate-900">{rule.keyword}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                        {rule.match_type}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {rule.account ? (
                        <div>
                          <div className="font-medium text-slate-900">{rule.account.name}</div>
                          <div className="text-sm text-slate-600">{rule.account.code}</div>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-sm">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {rule.contact ? (
                        <div className="font-medium text-slate-900">{rule.contact.company_name}</div>
                      ) : (
                        <span className="text-slate-400 text-sm">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {rule.is_system_rule ? (
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-amber-100 text-amber-800">
                          System
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                          Custom
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => toggleActive(rule)}
                        className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                          rule.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-slate-100 text-slate-800'
                        }`}
                      >
                        {rule.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openEditModal(rule)}
                          className="inline-flex items-center gap-1 px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(rule.id)}
                          className="inline-flex items-center gap-1 px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-900">
                {editingRule ? 'Edit Rule' : 'New Rule'}
              </h2>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Keyword <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.keyword}
                  onChange={(e) => setFormData({ ...formData, keyword: e.target.value })}
                  placeholder="e.g., Shell, KPN, Albert Heijn"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-slate-500 mt-1">The text to search for in transaction descriptions</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Match Type
                </label>
                <select
                  value={formData.match_type}
                  onChange={(e) => setFormData({ ...formData, match_type: e.target.value as MatchType })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="Contains">Contains</option>
                  <option value="Exact">Exact Match</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Target Account
                </label>
                <select
                  value={formData.target_ledger_account_id}
                  onChange={(e) => setFormData({ ...formData, target_ledger_account_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select an account...</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.code} - {account.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Contact (Optional)
                </label>
                <select
                  value={formData.contact_id}
                  onChange={(e) => setFormData({ ...formData, contact_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">No contact</option>
                  {contacts.map((contact) => (
                    <option key={contact.id} value={contact.id}>
                      {contact.company_name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">Optionally auto-assign this contact to matching transactions</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Description Template (Optional)
                </label>
                <input
                  type="text"
                  value={formData.description_template}
                  onChange={(e) => setFormData({ ...formData, description_template: e.target.value })}
                  placeholder="Optional: Override the transaction description"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Priority
                </label>
                <input
                  type="number"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-slate-500 mt-1">Higher priority rules are checked first</p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <label htmlFor="is_active" className="text-sm font-medium text-slate-700">
                  Rule is active
                </label>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowModal(false);
                  setError(null);
                }}
                className="px-6 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {editingRule ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
