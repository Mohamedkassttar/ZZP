import { useState, useEffect } from 'react';
import { Users, Building2, AlertCircle, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { ContactDetail } from './ContactDetail';
import type { Database } from '../lib/database.types';

type Tab = 'debtors' | 'creditors';
type Contact = Database['public']['Tables']['contacts']['Row'];

interface OutstandingItemsProps {
  onBack: () => void;
}

export function OutstandingItems({ onBack }: OutstandingItemsProps) {
  const [tab, setTab] = useState<Tab>('debtors');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadContacts();
  }, [tab]);

  async function loadContacts() {
    setLoading(true);
    try {
      const relationType = tab === 'debtors' ? 'Customer' : 'Supplier';

      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .or(`relation_type.eq.${relationType},relation_type.eq.Both`)
        .eq('is_active', true)
        .order('company_name');

      if (error) throw error;
      setContacts(data || []);
    } catch (error) {
      console.error('Error loading contacts:', error);
    } finally {
      setLoading(false);
    }
  }

  if (selectedContact) {
    return (
      <ContactDetail
        contact={selectedContact}
        onBack={() => setSelectedContact(null)}
      />
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Dashboard</span>
      </button>

      <div>
        <h1 className="text-lg font-semibold text-slate-900">Openstaande Posten</h1>
        <p className="text-xs text-slate-500">Beheer vorderingen en schulden</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm mb-6">
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setTab('debtors')}
            className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 font-semibold transition-colors ${
              tab === 'debtors'
                ? 'text-emerald-700 border-b-2 border-emerald-600 bg-emerald-50/50'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Users className="w-5 h-5" />
            Debiteuren (Customers)
          </button>
          <button
            onClick={() => setTab('creditors')}
            className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 font-semibold transition-colors ${
              tab === 'creditors'
                ? 'text-rose-700 border-b-2 border-rose-600 bg-rose-50/50'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Building2 className="w-5 h-5" />
            Crediteuren (Suppliers)
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
        </div>
      ) : contacts.length === 0 ? (
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-12 text-center">
          <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            No {tab === 'debtors' ? 'Customers' : 'Suppliers'} Found
          </h3>
          <p className="text-slate-600">
            {tab === 'debtors'
              ? 'Create your first customer to start sending invoices'
              : 'Suppliers will appear here when you process purchase invoices'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {contacts.map((contact) => (
            <div
              key={contact.id}
              onClick={() => setSelectedContact(contact)}
              className={`bg-white rounded-xl border-2 p-6 hover:shadow-lg transition-all cursor-pointer ${
                tab === 'debtors'
                  ? 'border-emerald-200 hover:border-emerald-400'
                  : 'border-rose-200 hover:border-rose-400'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-lg ${
                  tab === 'debtors' ? 'bg-emerald-100' : 'bg-rose-100'
                }`}>
                  {tab === 'debtors' ? (
                    <Users className={`w-6 h-6 ${tab === 'debtors' ? 'text-emerald-700' : 'text-rose-700'}`} />
                  ) : (
                    <Building2 className={`w-6 h-6 ${tab === 'debtors' ? 'text-emerald-700' : 'text-rose-700'}`} />
                  )}
                </div>
              </div>

              <h3 className="text-lg font-bold text-slate-900 mb-2 truncate">
                {contact.company_name}
              </h3>

              <div className="space-y-1 mb-4">
                {contact.email && (
                  <p className="text-sm text-slate-600 truncate">{contact.email}</p>
                )}
                {contact.phone && (
                  <p className="text-sm text-slate-600">{contact.phone}</p>
                )}
              </div>

              <div className="pt-4 border-t border-slate-200">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Outstanding</span>
                  <span className={`text-xl font-bold ${
                    tab === 'debtors' ? 'text-emerald-700' : 'text-rose-700'
                  }`}>
                    €0.00
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
