import { useState, useEffect } from 'react';
import { Plus, Search, Edit2, FileSpreadsheet, AlertCircle, CheckCircle, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getCurrentCompanyId } from '../lib/companyHelper';
import { UniversalImporter } from './UniversalImporter';
import { contactsConfig } from '../lib/importConfigs';
import type { Database } from '../lib/database.types';

type Contact = Database['public']['Tables']['contacts']['Row'];
type RelationType = Database['public']['Enums']['relation_type'];
type Account = Database['public']['Tables']['accounts']['Row'];

interface ContactWithBalance extends Contact {
  open_balance?: number;
}

export function Relations() {
  const [activeTab, setActiveTab] = useState<'customers' | 'suppliers'>('customers');
  const [contacts, setContacts] = useState<ContactWithBalance[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<ContactWithBalance[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showImporter, setShowImporter] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);

  const [formData, setFormData] = useState({
    company_name: '',
    contact_person: '',
    email: '',
    phone: '',
    address: '',
    postal_code: '',
    city: '',
    country: 'Netherlands',
    vat_number: '',
    coc_number: '',
    payment_term_days: 14,
    iban: '',
    relation_type: 'Customer' as RelationType,
    default_ledger_account_id: null as string | null,
  });

  useEffect(() => {
    loadAccounts();
    loadContacts();
  }, []);

  async function loadAccounts() {
    try {
      const companyId = await getCurrentCompanyId();
      if (!companyId) {
        setError('Geen bedrijf geselecteerd');
        return;
      }

      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('code');

      if (error) throw error;
      setAccounts(data || []);
    } catch (err) {
      console.error('Error loading accounts:', err);
    }
  }

  useEffect(() => {
    filterContacts();
  }, [contacts, activeTab, searchQuery]);

  async function loadContacts() {
    try {
      setLoading(true);
      const companyId = await getCurrentCompanyId();
      if (!companyId) {
        setError('Geen bedrijf geselecteerd');
        setLoading(false);
        return;
      }

      const { data: contactsData, error: contactsError } = await supabase
        .from('contacts')
        .select('*')
        .eq('company_id', companyId)
        .order('company_name');

      if (contactsError) throw contactsError;

      const { data: invoicesData } = await supabase
        .from('invoices')
        .select('contact_id, total_amount, status');

      const contactsWithBalance = (contactsData || []).map((contact) => {
        const contactInvoices = invoicesData?.filter(
          (inv) => inv.contact_id === contact.id && inv.status !== 'Paid'
        ) || [];
        const open_balance = contactInvoices.reduce((sum, inv) => sum + Number(inv.total_amount), 0);
        return { ...contact, open_balance };
      });

      setContacts(contactsWithBalance);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load contacts');
    } finally {
      setLoading(false);
    }
  }

  function filterContacts() {
    let filtered = contacts;

    if (activeTab === 'customers') {
      filtered = filtered.filter(
        (c) => c.relation_type === 'Customer' || c.relation_type === 'Both'
      );
    } else {
      filtered = filtered.filter(
        (c) => c.relation_type === 'Supplier' || c.relation_type === 'Both'
      );
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.company_name.toLowerCase().includes(query) ||
          c.city?.toLowerCase().includes(query) ||
          c.email?.toLowerCase().includes(query)
      );
    }

    setFilteredContacts(filtered);
  }

  function openCreateModal() {
    setEditingContact(null);
    setFormData({
      company_name: '',
      contact_person: '',
      email: '',
      phone: '',
      address: '',
      postal_code: '',
      city: '',
      country: 'Netherlands',
      vat_number: '',
      coc_number: '',
      payment_term_days: 14,
      iban: '',
      relation_type: activeTab === 'customers' ? 'Customer' : 'Supplier',
      default_ledger_account_id: null,
    });
    setShowModal(true);
  }

  function openEditModal(contact: Contact) {
    setEditingContact(contact);
    setFormData({
      company_name: contact.company_name,
      contact_person: contact.contact_person || '',
      email: contact.email || '',
      phone: contact.phone || '',
      address: contact.address || '',
      postal_code: contact.postal_code || '',
      city: contact.city || '',
      country: contact.country || 'Netherlands',
      vat_number: contact.vat_number || '',
      coc_number: contact.coc_number || '',
      payment_term_days: contact.payment_term_days || 14,
      iban: contact.iban || '',
      relation_type: contact.relation_type,
      default_ledger_account_id: contact.default_ledger_account_id || null,
    });
    setShowModal(true);
  }

  function validateForm(): string | null {
    if (!formData.company_name.trim()) {
      return 'Company name is required';
    }

    const genericNames = ['unknown', 'onbekend', 'test', 'n/a', 'na'];
    if (genericNames.includes(formData.company_name.toLowerCase().trim())) {
      return 'Please use a specific company name instead of generic names like "Unknown"';
    }

    if (formData.iban && !validateIBAN(formData.iban)) {
      return 'Invalid IBAN format';
    }

    if (formData.email && !validateEmail(formData.email)) {
      return 'Invalid email format';
    }

    return null;
  }

  function validateIBAN(iban: string): boolean {
    const cleanIban = iban.replace(/\s/g, '').toUpperCase();
    if (cleanIban.length < 15 || cleanIban.length > 34) return false;
    if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/.test(cleanIban)) return false;
    return true;
  }

  function validateEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  async function handleSave() {
    setError(null);
    setSuccess(null);

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      const companyId = await getCurrentCompanyId();
      if (!companyId) {
        setError('Geen bedrijf geselecteerd');
        return;
      }

      const dataToSave = {
        company_id: companyId,
        company_name: formData.company_name.trim(),
        contact_person: formData.contact_person.trim() || null,
        email: formData.email.trim() || null,
        phone: formData.phone.trim() || null,
        address: formData.address.trim() || null,
        postal_code: formData.postal_code.trim() || null,
        city: formData.city.trim() || null,
        country: formData.country.trim() || 'Netherlands',
        vat_number: formData.vat_number.trim() || null,
        coc_number: formData.coc_number.trim() || null,
        payment_term_days: formData.payment_term_days || 14,
        iban: formData.iban.trim() || null,
        relation_type: formData.relation_type,
        default_ledger_account_id: formData.default_ledger_account_id,
        is_active: true,
      };

      if (editingContact) {
        const { error: updateError } = await supabase
          .from('contacts')
          .update(dataToSave)
          .eq('id', editingContact.id)
          .eq('company_id', companyId);

        if (updateError) throw updateError;
        setSuccess('Contact updated successfully');
      } else {
        const { error: insertError } = await supabase
          .from('contacts')
          .insert(dataToSave);

        if (insertError) throw insertError;
        setSuccess('Contact created successfully');
      }

      await loadContacts();
      setShowModal(false);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save contact');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-slate-600">Loading contacts...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Relaties</h1>
          <p className="text-sm text-gray-500">Beheer klanten en leveranciers</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowImporter(true)}
            className="h-9 flex items-center gap-1.5 px-4 bg-emerald-600 text-white rounded text-sm font-medium hover:bg-emerald-700 transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Importeer
          </button>
          <button
            onClick={openCreateModal}
            className="h-9 flex items-center gap-1.5 px-4 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Nieuwe relatie
          </button>
        </div>
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

      <div className="rounded-lg shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <div className="flex">
            <button
              onClick={() => setActiveTab('customers')}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === 'customers'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Klanten
            </button>
            <button
              onClick={() => setActiveTab('suppliers')}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === 'suppliers'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Leveranciers
            </button>
          </div>
        </div>

        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, city, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 w-full pl-10 pr-4 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="h-10 bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-2 text-left text-xs uppercase tracking-wide">
                  Name
                </th>
                <th className="px-6 py-2 text-left text-xs uppercase tracking-wide">
                  City
                </th>
                <th className="px-6 py-2 text-left text-xs uppercase tracking-wide">
                  Email
                </th>
                <th className="px-6 py-2 text-right text-xs uppercase tracking-wide">
                  Open Balance
                </th>
                <th className="px-6 py-2 text-right text-xs uppercase tracking-wide">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredContacts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    No {activeTab === 'customers' ? 'customers' : 'suppliers'} found
                  </td>
                </tr>
              ) : (
                filteredContacts.map((contact) => (
                  <tr key={contact.id} className="h-10 border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-2">
                      <div className="font-medium text-sm text-gray-900">{contact.company_name}</div>
                      {contact.contact_person && (
                        <div className="text-xs text-gray-500">{contact.contact_person}</div>
                      )}
                    </td>
                    <td className="px-6 py-2 text-sm text-gray-700">{contact.city || '-'}</td>
                    <td className="px-6 py-2 text-sm text-gray-700">{contact.email || '-'}</td>
                    <td className="px-6 py-2 text-right">
                      <span
                        className={`text-sm font-medium ${
                          (contact.open_balance || 0) > 0 ? 'text-amber-600' : 'text-gray-900'
                        }`}
                      >
                        €{(contact.open_balance || 0).toFixed(2)}
                      </span>
                    </td>
                    <td className="px-6 py-2 text-right">
                      <button
                        onClick={() => openEditModal(contact)}
                        className="h-9 inline-flex items-center gap-1 px-4 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                        Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-900">
                {editingContact ? 'Edit Relation' : 'New Relation'}
              </h2>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Company Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    value={formData.contact_person}
                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Postal Code</label>
                  <input
                    type="text"
                    value={formData.postal_code}
                    onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Country</label>
                  <input
                    type="text"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    VAT Number (BTW)
                  </label>
                  <input
                    type="text"
                    value={formData.vat_number}
                    onChange={(e) => setFormData({ ...formData, vat_number: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    CoC Number (KvK)
                  </label>
                  <input
                    type="text"
                    value={formData.coc_number}
                    onChange={(e) => setFormData({ ...formData, coc_number: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Payment Terms (Days)
                  </label>
                  <input
                    type="number"
                    value={formData.payment_term_days}
                    onChange={(e) =>
                      setFormData({ ...formData, payment_term_days: parseInt(e.target.value) || 14 })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">IBAN</label>
                  <input
                    type="text"
                    value={formData.iban}
                    onChange={(e) => setFormData({ ...formData, iban: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="NL91ABNA0417164300"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Relation Type
                  </label>
                  <select
                    value={formData.relation_type}
                    onChange={(e) =>
                      setFormData({ ...formData, relation_type: e.target.value as RelationType })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="Customer">Customer</option>
                    <option value="Supplier">Supplier</option>
                    <option value="Both">Both</option>
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Standaard Grootboekrekening
                    <span className="text-xs text-slate-500 font-normal ml-2">(Optional)</span>
                  </label>
                  <div className="relative">
                    <select
                      value={formData.default_ledger_account_id || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          default_ledger_account_id: e.target.value || null
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-10"
                    >
                      <option value="">Geen standaard</option>
                      {['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'].map(type => {
                        const typeAccounts = accounts.filter(acc => acc.type === type);
                        if (typeAccounts.length === 0) return null;
                        return (
                          <optgroup key={type} label={type}>
                            {typeAccounts.map(account => (
                              <option key={account.id} value={account.id}>
                                {account.code} - {account.name}
                              </option>
                            ))}
                          </optgroup>
                        );
                      })}
                    </select>
                    {formData.default_ledger_account_id && (
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, default_ledger_account_id: null })}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition-colors"
                        title="Clear selection"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    When set, bank transactions from this contact will automatically use this account
                  </p>
                </div>
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
                {editingContact ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showImporter && (
        <UniversalImporter
          config={contactsConfig}
          onClose={() => setShowImporter(false)}
          onComplete={() => {
            loadContacts();
            setShowImporter(false);
            setSuccess('Contacts imported successfully');
            setTimeout(() => setSuccess(null), 3000);
          }}
        />
      )}
    </div>
  );
}
