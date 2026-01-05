import { useState, useEffect } from 'react';
import { Search, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { ContactDetail } from '../ContactDetail';
import type { Database } from '../../lib/database.types';

type Contact = Database['public']['Tables']['contacts']['Row'];

interface ContactWithBalance extends Contact {
  open_balance?: number;
}

export function PortalRelations() {
  const [contacts, setContacts] = useState<ContactWithBalance[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<ContactWithBalance[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

  useEffect(() => {
    loadContacts();
  }, []);

  useEffect(() => {
    filterContacts();
  }, [contacts, searchQuery]);

  async function loadContacts() {
    try {
      setLoading(true);
      const { data: contactsData, error: contactsError } = await supabase
        .from('contacts')
        .select('*')
        .or('relation_type.eq.Customer,relation_type.eq.Both')
        .eq('is_active', true)
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
      console.error('Error loading contacts:', err);
    } finally {
      setLoading(false);
    }
  }

  function filterContacts() {
    if (!searchQuery.trim()) {
      setFilteredContacts(contacts);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = contacts.filter(
      (contact) =>
        contact.company_name.toLowerCase().includes(query) ||
        contact.email?.toLowerCase().includes(query) ||
        contact.contact_person?.toLowerCase().includes(query)
    );
    setFilteredContacts(filtered);
  }

  if (selectedContact) {
    return (
      <ContactDetail
        contact={selectedContact}
        onBack={() => setSelectedContact(null)}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Mijn Klanten</h1>
        <p className="text-gray-600">Overzicht van al je klantrelaties</p>
      </div>

      <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Zoek op naam, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors"
            />
          </div>
        </div>

        {filteredContacts.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500 text-lg">
              {searchQuery ? 'Geen klanten gevonden' : 'Nog geen klanten'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredContacts.map((contact) => (
              <button
                key={contact.id}
                onClick={() => setSelectedContact(contact)}
                className="w-full p-6 hover:bg-blue-50 transition-colors text-left flex items-center justify-between group"
              >
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 mb-1 group-hover:text-blue-600 transition-colors">
                    {contact.company_name}
                  </h3>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    {contact.contact_person && (
                      <span>{contact.contact_person}</span>
                    )}
                    {contact.email && (
                      <span>{contact.email}</span>
                    )}
                    {contact.city && (
                      <span>{contact.city}</span>
                    )}
                  </div>
                </div>
                {contact.open_balance !== undefined && contact.open_balance > 0 && (
                  <div className="text-right">
                    <p className="text-xs text-gray-500 mb-1">Openstaand</p>
                    <p className="text-xl font-bold text-emerald-600">
                      €{contact.open_balance.toFixed(2)}
                    </p>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
