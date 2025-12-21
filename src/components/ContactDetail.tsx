import { useState, useEffect } from 'react';
import { ArrowLeft, FileText, Clock, Receipt, CreditCard, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';

type Contact = Database['public']['Tables']['contacts']['Row'];
type Invoice = Database['public']['Tables']['invoices']['Row'];

interface JournalEntry {
  id: string;
  entry_date: string;
  description: string;
  status: string;
  invoice_id?: string;
  amount: number;
  entry_type: 'Factuur' | 'Betaling';
}

interface ContactDetailProps {
  contact: Contact;
  onBack: () => void;
}

export function ContactDetail({ contact, onBack }: ContactDetailProps) {
  const [activeTab, setActiveTab] = useState<'outstanding' | 'history'>('outstanding');
  const [outstandingInvoices, setOutstandingInvoices] = useState<Invoice[]>([]);
  const [history, setHistory] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const isCreditor = contact.relation_type === 'Supplier' || contact.relation_type === 'Both';
  const isDebtor = contact.relation_type === 'Customer' || contact.relation_type === 'Both';

  useEffect(() => {
    loadData();
  }, [contact.id]);

  async function loadData() {
    setLoading(true);
    try {
      await Promise.all([loadOutstandingInvoices(), loadHistory()]);
    } catch (error) {
      console.error('Error loading contact data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadOutstandingInvoices() {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('contact_id', contact.id)
      .neq('status', 'Paid')
      .order('invoice_date', { ascending: false });

    if (error) throw error;
    setOutstandingInvoices(data || []);
  }

  async function loadHistory() {
    const { data: paidInvoices } = await supabase
      .from('invoices')
      .select('*')
      .eq('contact_id', contact.id)
      .eq('status', 'Paid')
      .order('invoice_date', { ascending: false });

    const { data: bankTransactions } = await supabase
      .from('bank_transactions')
      .select('*, journal_entries!inner(*)')
      .ilike('contra_name', `%${contact.company_name}%`)
      .eq('status', 'Booked')
      .order('transaction_date', { ascending: false });

    const { data: journalEntries } = await supabase
      .from('journal_entries')
      .select(`
        *,
        journal_lines(
          id,
          debit,
          credit,
          description,
          account_id,
          accounts(name)
        )
      `)
      .ilike('description', `%${contact.company_name}%`)
      .eq('status', 'Final')
      .order('entry_date', { ascending: false });

    const historyItems: JournalEntry[] = [];

    (paidInvoices || []).forEach(inv => {
      historyItems.push({
        id: `inv-${inv.id}`,
        entry_date: inv.invoice_date,
        description: `Factuur ${inv.invoice_number}`,
        status: inv.status,
        invoice_id: inv.id,
        amount: Number(inv.total_amount),
        entry_type: 'Factuur'
      });
    });

    (bankTransactions || []).forEach(txn => {
      historyItems.push({
        id: `bank-${txn.id}`,
        entry_date: txn.transaction_date,
        description: txn.description,
        status: 'Paid',
        amount: Math.abs(txn.amount),
        entry_type: 'Betaling'
      });
    });

    (journalEntries || []).forEach(entry => {
      if (entry.description.toLowerCase().includes('payment') ||
          entry.description.toLowerCase().includes('betaling') ||
          entry.description.toLowerCase().includes('settlement')) {

        let amount = 0;
        if (Array.isArray(entry.journal_lines)) {
          const bankLine = entry.journal_lines.find(line =>
            line.accounts?.name?.toLowerCase().includes('bank')
          );
          if (bankLine) {
            amount = Number(bankLine.debit || bankLine.credit || 0);
          }
        }

        historyItems.push({
          id: `je-${entry.id}`,
          entry_date: entry.entry_date,
          description: entry.description,
          status: entry.status,
          amount: amount,
          entry_type: 'Betaling'
        });
      }
    });

    const uniqueItems = historyItems.filter((item, index, self) =>
      index === self.findIndex(t => t.id === item.id)
    );

    uniqueItems.sort((a, b) =>
      new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime()
    );

    setHistory(uniqueItems);
  }

  const totalOutstanding = outstandingInvoices.reduce(
    (sum, inv) => sum + Number(inv.total_amount),
    0
  );

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Terug naar Overzicht</span>
      </button>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">{contact.company_name}</h1>
            <div className="space-y-1 text-sm text-slate-600">
              {contact.contact_person && <p>{contact.contact_person}</p>}
              {contact.email && <p>{contact.email}</p>}
              {contact.phone && <p>{contact.phone}</p>}
              {contact.address && (
                <p>{contact.address}, {contact.postal_code} {contact.city}</p>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-600 mb-1">Openstaand</p>
            <p className={`text-3xl font-bold ${
              totalOutstanding > 0
                ? (isDebtor ? 'text-emerald-600' : 'text-rose-600')
                : 'text-slate-900'
            }`}>
              €{totalOutstanding.toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab('outstanding')}
            className={`flex items-center gap-2 px-6 py-4 font-semibold transition-colors ${
              activeTab === 'outstanding'
                ? 'text-blue-700 border-b-2 border-blue-600 bg-blue-50/50'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Clock className="w-5 h-5" />
            Openstaand
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-6 py-4 font-semibold transition-colors ${
              activeTab === 'history'
                ? 'text-blue-700 border-b-2 border-blue-600 bg-blue-50/50'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <FileText className="w-5 h-5" />
            Transactie Historie
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'outstanding' ? (
            <div>
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Openstaande Facturen</h2>
              {outstandingInvoices.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <CheckCircle className="w-12 h-12 mx-auto mb-3 text-slate-400" />
                  <p>Geen openstaande facturen</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-900">
                          Factuurnummer
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-900">
                          Datum
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-900">
                          Vervaldatum
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-900">
                          Bedrag
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-900">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {outstandingInvoices.map((invoice) => (
                        <tr key={invoice.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-sm font-medium text-slate-900">
                            {invoice.invoice_number}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-700">
                            {new Date(invoice.invoice_date).toLocaleDateString('nl-NL')}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-700">
                            {new Date(invoice.due_date).toLocaleDateString('nl-NL')}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-medium text-slate-900">
                            €{Number(invoice.total_amount).toFixed(2)}
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                              {invoice.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div>
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Transactie Historie</h2>
              {history.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <FileText className="w-12 h-12 mx-auto mb-3 text-slate-400" />
                  <p>Geen transacties gevonden</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-900">
                          Datum
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-900">
                          Type
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-900">
                          Omschrijving
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-900">
                          Bedrag
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-900">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {history.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-sm text-slate-700">
                            {new Date(item.entry_date).toLocaleDateString('nl-NL')}
                          </td>
                          <td className="px-4 py-3">
                            {item.entry_type === 'Factuur' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                <Receipt className="w-3 h-3" />
                                Factuur
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                <CreditCard className="w-3 h-3" />
                                Betaling
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-700">
                            {item.description}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-medium">
                            {item.amount !== 0 && (
                              <span className={isCreditor ? 'text-red-600' : 'text-green-600'}>
                                €{item.amount.toFixed(2)}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {item.status === 'Paid' && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                Betaald
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
