import { useState, useEffect } from 'react';
import { Users, TrendingUp, AlertCircle, ArrowRight, Mail, Phone, MapPin } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { ContactDetail } from '../ContactDetail';
import type { Database } from '../../lib/database.types';

type Contact = Database['public']['Tables']['contacts']['Row'];

interface ContactWithBalance extends Contact {
  outstanding_amount?: number;
  invoice_count?: number;
}

export function PortalFinance() {
  const [activeTab, setActiveTab] = useState<'debtors' | 'creditors'>('debtors');
  const [debtors, setDebtors] = useState<ContactWithBalance[]>([]);
  const [creditors, setCreditors] = useState<ContactWithBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

  useEffect(() => {
    loadFinancialData();
  }, []);

  async function loadFinancialData() {
    setLoading(true);
    try {
      await Promise.all([loadDebtors(), loadCreditors()]);
    } catch (error) {
      console.error('Error loading financial data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadDebtors() {
    // Get all customer contacts
    const { data: contacts, error: contactsError } = await supabase
      .from('contacts')
      .select('*')
      .or('relation_type.eq.Customer,relation_type.eq.Both')
      .order('company_name');

    if (contactsError) throw contactsError;

    // Get outstanding invoices per contact
    const contactsWithBalance = await Promise.all(
      (contacts || []).map(async (contact) => {
        const { data: invoices, error } = await supabase
          .from('sales_invoices')
          .select('total_amount, status')
          .eq('contact_id', contact.id)
          .neq('status', 'paid');

        if (error) {
          console.error('Error loading invoices for contact:', error);
          return { ...contact, outstanding_amount: 0, invoice_count: 0 };
        }

        const outstanding_amount = (invoices || []).reduce(
          (sum, inv) => sum + (inv.total_amount || 0),
          0
        );
        const invoice_count = invoices?.length || 0;

        return { ...contact, outstanding_amount, invoice_count };
      })
    );

    // Sort by outstanding amount (highest first)
    contactsWithBalance.sort((a, b) => (b.outstanding_amount || 0) - (a.outstanding_amount || 0));
    setDebtors(contactsWithBalance);
  }

  async function loadCreditors() {
    // Get all supplier contacts
    const { data: contacts, error } = await supabase
      .from('contacts')
      .select('*')
      .or('relation_type.eq.Supplier,relation_type.eq.Both')
      .order('company_name');

    if (error) throw error;
    setCreditors(contacts || []);
  }

  if (selectedContact) {
    return (
      <ContactDetail
        contact={selectedContact}
        onBack={() => setSelectedContact(null)}
      />
    );
  }

  const totalOutstanding = debtors.reduce((sum, debtor) => sum + (debtor.outstanding_amount || 0), 0);
  const totalDebtors = debtors.filter((d) => (d.outstanding_amount || 0) > 0).length;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl">
            <TrendingUp className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Financieel Overzicht</h1>
            <p className="text-sm text-gray-600">Debiteuren en Crediteuren</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border-2 border-blue-200">
            <p className="text-sm font-medium text-blue-900 mb-1">Openstaand Bedrag</p>
            <p className="text-2xl font-bold text-blue-900">
              {new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(
                totalOutstanding
              )}
            </p>
          </div>

          <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl p-4 border-2 border-amber-200">
            <p className="text-sm font-medium text-amber-900 mb-1">Klanten met Openstaand</p>
            <p className="text-2xl font-bold text-amber-900">{totalDebtors}</p>
          </div>

          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-4 border-2 border-emerald-200">
            <p className="text-sm font-medium text-emerald-900 mb-1">Totaal Relaties</p>
            <p className="text-2xl font-bold text-emerald-900">
              {debtors.length + creditors.length}
            </p>
          </div>
        </div>

        <div className="flex gap-2 border-b border-gray-200 mb-6">
          <button
            onClick={() => setActiveTab('debtors')}
            className={`px-6 py-3 font-semibold text-sm transition-colors relative ${
              activeTab === 'debtors'
                ? 'text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Debiteuren ({debtors.length})
            {activeTab === 'debtors' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('creditors')}
            className={`px-6 py-3 font-semibold text-sm transition-colors relative ${
              activeTab === 'creditors'
                ? 'text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Crediteuren ({creditors.length})
            {activeTab === 'creditors' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
            )}
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="mt-4 text-gray-600">Laden...</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeTab === 'debtors' && (
              <>
                {debtors.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-600">Geen debiteuren gevonden</p>
                  </div>
                ) : (
                  <>
                    {debtors.map((debtor) => (
                      <button
                        key={debtor.id}
                        onClick={() => setSelectedContact(debtor)}
                        className="w-full bg-white border-2 border-gray-200 rounded-xl p-4 hover:border-blue-400 hover:shadow-lg transition-all text-left group"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="font-bold text-gray-900 text-lg">
                                {debtor.company_name}
                              </h3>
                              {(debtor.outstanding_amount || 0) > 0 && (
                                <span className="px-2 py-1 bg-amber-100 text-amber-800 text-xs font-semibold rounded-full">
                                  {debtor.invoice_count} openstaand
                                </span>
                              )}
                            </div>

                            <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                              {debtor.email && (
                                <div className="flex items-center gap-1">
                                  <Mail className="w-4 h-4" />
                                  <span>{debtor.email}</span>
                                </div>
                              )}
                              {debtor.phone && (
                                <div className="flex items-center gap-1">
                                  <Phone className="w-4 h-4" />
                                  <span>{debtor.phone}</span>
                                </div>
                              )}
                              {debtor.city && (
                                <div className="flex items-center gap-1">
                                  <MapPin className="w-4 h-4" />
                                  <span>{debtor.city}</span>
                                </div>
                              )}
                            </div>

                            {(debtor.outstanding_amount || 0) > 0 && (
                              <div className="mt-3 flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 text-amber-600" />
                                <span className="text-sm font-semibold text-amber-900">
                                  Openstaand:{' '}
                                  {new Intl.NumberFormat('nl-NL', {
                                    style: 'currency',
                                    currency: 'EUR',
                                  }).format(debtor.outstanding_amount)}
                                </span>
                              </div>
                            )}
                          </div>

                          <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                        </div>
                      </button>
                    ))}
                  </>
                )}
              </>
            )}

            {activeTab === 'creditors' && (
              <>
                {creditors.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-600">Geen crediteuren gevonden</p>
                  </div>
                ) : (
                  <>
                    {creditors.map((creditor) => (
                      <button
                        key={creditor.id}
                        onClick={() => setSelectedContact(creditor)}
                        className="w-full bg-white border-2 border-gray-200 rounded-xl p-4 hover:border-blue-400 hover:shadow-lg transition-all text-left group"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <h3 className="font-bold text-gray-900 text-lg mb-2">
                              {creditor.company_name}
                            </h3>

                            <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                              {creditor.email && (
                                <div className="flex items-center gap-1">
                                  <Mail className="w-4 h-4" />
                                  <span>{creditor.email}</span>
                                </div>
                              )}
                              {creditor.phone && (
                                <div className="flex items-center gap-1">
                                  <Phone className="w-4 h-4" />
                                  <span>{creditor.phone}</span>
                                </div>
                              )}
                              {creditor.city && (
                                <div className="flex items-center gap-1">
                                  <MapPin className="w-4 h-4" />
                                  <span>{creditor.city}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                        </div>
                      </button>
                    ))}
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
