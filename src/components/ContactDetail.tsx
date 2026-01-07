import { useState, useEffect } from 'react';
import { ArrowLeft, FileText, Clock, Receipt, CreditCard, CheckCircle, Mail, Eye, Edit2, Trash2, Euro } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { resendInvoice } from '../lib/salesService';
import { ResendInvoiceModal } from './ResendInvoiceModal';
import { InvoicePreviewModal } from './InvoicePreviewModal';
import type { Database } from '../lib/database.types';

type Contact = Database['public']['Tables']['contacts']['Row'];
type Invoice = Database['public']['Tables']['invoices']['Row'];
type SalesInvoice = Database['public']['Tables']['sales_invoices']['Row'];

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
  const [activeTab, setActiveTab] = useState<'outstanding' | 'history' | 'invoices'>('outstanding');
  const [outstandingInvoices, setOutstandingInvoices] = useState<Invoice[]>([]);
  const [salesInvoices, setSalesInvoices] = useState<SalesInvoice[]>([]);
  const [history, setHistory] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [resendModal, setResendModal] = useState<{
    isOpen: boolean;
    invoiceId: string;
    invoiceNumber: string;
    defaultEmail: string;
  }>({
    isOpen: false,
    invoiceId: '',
    invoiceNumber: '',
    defaultEmail: '',
  });
  const [statusModal, setStatusModal] = useState<{
    isOpen: boolean;
    invoiceId: string;
    invoiceNumber: string;
    currentStatus: string;
    tableName: 'invoices' | 'sales_invoices';
  }>({
    isOpen: false,
    invoiceId: '',
    invoiceNumber: '',
    currentStatus: '',
    tableName: 'sales_invoices',
  });
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    invoiceId: string;
    invoiceNumber: string;
    tableName: 'invoices' | 'sales_invoices';
  }>({
    isOpen: false,
    invoiceId: '',
    invoiceNumber: '',
    tableName: 'sales_invoices',
  });
  const [editModal, setEditModal] = useState<{
    isOpen: boolean;
    invoiceId: string;
    invoiceNumber: string;
    totalAmount: number;
    tableName: 'invoices' | 'sales_invoices';
  }>({
    isOpen: false,
    invoiceId: '',
    invoiceNumber: '',
    totalAmount: 0,
    tableName: 'sales_invoices',
  });
  const [detailModal, setDetailModal] = useState<{
    isOpen: boolean;
    invoice: any;
    lines: any[];
    tableName: 'invoices' | 'sales_invoices';
  }>({
    isOpen: false,
    invoice: null,
    lines: [],
    tableName: 'sales_invoices',
  });
  const [previewModal, setPreviewModal] = useState<{
    isOpen: boolean;
    invoice: SalesInvoice | null;
  }>({
    isOpen: false,
    invoice: null,
  });

  const isCreditor = contact.relation_type === 'Supplier' || contact.relation_type === 'Both';
  const isDebtor = contact.relation_type === 'Customer' || contact.relation_type === 'Both';

  useEffect(() => {
    loadData();
  }, [contact.id]);

  async function loadData() {
    setLoading(true);
    try {
      await Promise.all([loadOutstandingInvoices(), loadSalesInvoices(), loadHistory()]);
    } catch (error) {
      console.error('Error loading contact data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadSalesInvoices() {
    const { data, error } = await supabase
      .from('sales_invoices')
      .select('*')
      .eq('contact_id', contact.id)
      .order('date', { ascending: false });

    if (error) throw error;
    setSalesInvoices(data || []);
  }

  async function loadOutstandingInvoices() {
    // Load from both old invoices and new sales_invoices tables
    const { data: oldInvoices, error: oldError } = await supabase
      .from('invoices')
      .select('*')
      .eq('contact_id', contact.id)
      .neq('status', 'Paid')
      .order('invoice_date', { ascending: false });

    const { data: newInvoices, error: newError } = await supabase
      .from('sales_invoices')
      .select('*')
      .eq('contact_id', contact.id)
      .neq('status', 'paid')
      .order('date', { ascending: false });

    if (oldError) throw oldError;
    if (newError) throw newError;

    // Convert to common format
    const combined = [
      ...(oldInvoices || []),
      ...(newInvoices || []).map(inv => ({
        ...inv,
        invoice_date: inv.date,
        invoice_number: inv.invoice_number || '',
        __isNewInvoice: true, // marker to identify sales_invoices
      }))
    ];

    setOutstandingInvoices(combined as any);
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

  const handleResendClick = (invoice: SalesInvoice) => {
    setResendModal({
      isOpen: true,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number || 'Onbekend',
      defaultEmail: invoice.sent_to_email || contact.email || '',
    });
  };

  const handleResendClickOldInvoice = (invoice: Invoice) => {
    setResendModal({
      isOpen: true,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number || 'Onbekend',
      defaultEmail: contact.email || '',
    });
  };

  const handleResend = async (email: string) => {
    const result = await resendInvoice(resendModal.invoiceId, email);

    if (result.success) {
      await loadSalesInvoices();
    }

    return result;
  };

  const handleStatusClick = (invoice: SalesInvoice) => {
    setStatusModal({
      isOpen: true,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number || 'Onbekend',
      currentStatus: invoice.status,
      tableName: 'sales_invoices',
    });
  };

  const handleStatusClickOldInvoice = (invoice: Invoice) => {
    setStatusModal({
      isOpen: true,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number || 'Onbekend',
      currentStatus: invoice.status,
      tableName: 'invoices',
    });
  };

  const handleStatusChange = async (newStatus: string) => {
    // Convert status to correct case based on table
    const statusValue = statusModal.tableName === 'invoices'
      ? newStatus.charAt(0).toUpperCase() + newStatus.slice(1)  // 'sent' -> 'Sent'
      : newStatus.toLowerCase();  // Keep lowercase for sales_invoices

    const { error } = await supabase
      .from(statusModal.tableName)
      .update({ status: statusValue })
      .eq('id', statusModal.invoiceId);

    if (error) {
      alert('Fout bij wijzigen status: ' + error.message);
      return false;
    }

    await loadSalesInvoices();
    await loadOutstandingInvoices();
    setStatusModal({ isOpen: false, invoiceId: '', invoiceNumber: '', currentStatus: '', tableName: 'sales_invoices' });
    return true;
  };

  const handleDeleteClick = (invoice: SalesInvoice) => {
    setDeleteModal({
      isOpen: true,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number || 'Onbekend',
      tableName: 'sales_invoices',
    });
  };

  const handleDeleteClickOldInvoice = (invoice: Invoice) => {
    setDeleteModal({
      isOpen: true,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number || 'Onbekend',
      tableName: 'invoices',
    });
  };

  const handleDeleteConfirm = async () => {
    const { error } = await supabase
      .from(deleteModal.tableName)
      .delete()
      .eq('id', deleteModal.invoiceId);

    if (error) {
      alert('Fout bij verwijderen factuur: ' + error.message);
      return;
    }

    await loadSalesInvoices();
    await loadOutstandingInvoices();
    setDeleteModal({ isOpen: false, invoiceId: '', invoiceNumber: '', tableName: 'sales_invoices' });
  };

  const handleEditClick = (invoice: SalesInvoice) => {
    setEditModal({
      isOpen: true,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number || 'Onbekend',
      totalAmount: invoice.total_amount || 0,
      tableName: 'sales_invoices',
    });
  };

  const handleEditClickOldInvoice = (invoice: Invoice) => {
    setEditModal({
      isOpen: true,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number || 'Onbekend',
      totalAmount: invoice.total_amount || 0,
      tableName: 'invoices',
    });
  };

  const handleEditSave = async () => {
    const { error } = await supabase
      .from(editModal.tableName)
      .update({ total_amount: editModal.totalAmount })
      .eq('id', editModal.invoiceId);

    if (error) {
      alert('Fout bij wijzigen bedrag: ' + error.message);
      return;
    }

    await loadSalesInvoices();
    await loadOutstandingInvoices();
    setEditModal({ isOpen: false, invoiceId: '', invoiceNumber: '', totalAmount: 0, tableName: 'sales_invoices' });
  };

  const handleInvoiceDetailClick = async (invoice: SalesInvoice) => {
    setDetailModal({
      isOpen: true,
      invoice,
      lines: [],
      tableName: 'sales_invoices',
    });
  };

  const handlePreviewClick = (invoice: SalesInvoice) => {
    setPreviewModal({
      isOpen: true,
      invoice,
    });
  };

  const handleInvoiceDetailClickOld = async (invoice: Invoice) => {
    const { data: lines } = await supabase
      .from('invoice_lines')
      .select('*, accounts:ledger_account_id(account_code, account_name)')
      .eq('invoice_id', invoice.id)
      .order('line_order');

    setDetailModal({
      isOpen: true,
      invoice,
      lines: lines || [],
      tableName: 'invoices',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'draft':
        return 'bg-slate-100 text-slate-800';
      case 'open':
        return 'bg-amber-100 text-amber-800';
      case 'sent':
        return 'bg-blue-100 text-blue-800';
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'overdue':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

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
            onClick={() => setActiveTab('invoices')}
            className={`flex items-center gap-2 px-6 py-4 font-semibold transition-colors ${
              activeTab === 'invoices'
                ? 'text-blue-700 border-b-2 border-blue-600 bg-blue-50/50'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Receipt className="w-5 h-5" />
            Factuurhistorie
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
          {activeTab === 'invoices' ? (
            <div>
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Factuurhistorie</h2>
              {salesInvoices.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <Receipt className="w-12 h-12 mx-auto mb-3 text-slate-400" />
                  <p>Geen facturen gevonden</p>
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
                          Factuurnummer
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-900">
                          Bedrag
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-900">
                          Status
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-900">
                          Laatst verzonden
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-900">
                          Acties
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {salesInvoices.map((invoice) => (
                        <tr key={invoice.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-sm text-slate-700">
                            {new Date(invoice.date).toLocaleDateString('nl-NL')}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium">
                            <button
                              onClick={() => handleInvoiceDetailClick(invoice)}
                              className="text-blue-600 hover:text-blue-800 hover:underline font-medium transition-colors"
                            >
                              {invoice.invoice_number}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-medium text-slate-900">
                            €{Number(invoice.total_amount).toFixed(2)}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(invoice.status)}`}>
                              {invoice.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600">
                            {invoice.last_sent_at ? (
                              <div>
                                <div>{new Date(invoice.last_sent_at).toLocaleDateString('nl-NL')}</div>
                                {invoice.sent_to_email && (
                                  <div className="text-xs text-slate-500">{invoice.sent_to_email}</div>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400">Niet verzonden</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handlePreviewClick(invoice)}
                                className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Preview factuur"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleEditClick(invoice)}
                                className="p-2 text-slate-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                                title="Bedrag wijzigen"
                              >
                                <Euro className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleStatusClick(invoice)}
                                className="p-2 text-slate-600 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                title="Status wijzigen"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleResendClick(invoice)}
                                className="p-2 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                title="Opnieuw mailen"
                              >
                                <Mail className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteClick(invoice)}
                                className="p-2 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Verwijderen"
                              >
                                <Trash2 className="w-4 h-4" />
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
          ) : activeTab === 'outstanding' ? (
            <div>
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Openstaande Facturen</h2>
              {outstandingInvoices.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <CheckCircle className="w-12 h-12 mx-auto mb-3 text-slate-400" />
                  <p>Geen openstaande facturen</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {outstandingInvoices.map((invoice) => (
                    <div key={invoice.id} className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <button
                            onClick={() => handleInvoiceDetailClickOld(invoice)}
                            className="text-base font-semibold text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                          >
                            {invoice.invoice_number}
                          </button>
                          <div className="mt-1 space-y-1">
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                              <Calendar className="w-4 h-4" />
                              <span>Datum: {new Date(invoice.invoice_date).toLocaleDateString('nl-NL')}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                              <Clock className="w-4 h-4" />
                              <span>Vervaldatum: {new Date(invoice.due_date).toLocaleDateString('nl-NL')}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-bold text-slate-900">
                            €{Number(invoice.total_amount).toFixed(2)}
                          </div>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 mt-1">
                            {invoice.status}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 pt-3 border-t border-slate-200">
                        {(invoice as any).__isNewInvoice ? (
                          <button
                            onClick={() => handlePreviewClick(invoice as any)}
                            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Preview factuur"
                          >
                            <Eye className="w-4 h-4" />
                            <span>Preview</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleInvoiceDetailClickOld(invoice)}
                            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Bekijk factuur"
                          >
                            <Eye className="w-4 h-4" />
                            <span>Bekijken</span>
                          </button>
                        )}
                        <button
                          onClick={() => handleEditClickOldInvoice(invoice)}
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                          title="Bedrag wijzigen"
                        >
                          <Euro className="w-4 h-4" />
                          <span>Bedrag</span>
                        </button>
                        <button
                          onClick={() => handleStatusClickOldInvoice(invoice)}
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Status wijzigen"
                        >
                          <Edit2 className="w-4 h-4" />
                          <span>Status</span>
                        </button>
                        <button
                          onClick={() => handleResendClickOldInvoice(invoice)}
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="Opnieuw mailen"
                        >
                          <Mail className="w-4 h-4" />
                          <span>Mail</span>
                        </button>
                        <button
                          onClick={() => handleDeleteClickOldInvoice(invoice)}
                          className="px-3 py-2 text-sm text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Verwijderen"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
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

      <ResendInvoiceModal
        isOpen={resendModal.isOpen}
        onClose={() => setResendModal({ ...resendModal, isOpen: false })}
        invoiceNumber={resendModal.invoiceNumber}
        defaultEmail={resendModal.defaultEmail}
        onResend={handleResend}
      />

      {statusModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h2 className="text-2xl font-black text-slate-800 mb-4">Status Wijzigen</h2>
            <p className="text-slate-600 mb-6">
              Wijzig de status van factuur <span className="font-semibold">{statusModal.invoiceNumber}</span>
            </p>

            <div className="space-y-3 mb-6">
              {['draft', 'open', 'sent', 'paid', 'overdue'].map((status) => (
                <button
                  key={status}
                  onClick={() => handleStatusChange(status)}
                  className={`w-full px-4 py-3 rounded-xl text-left font-medium transition-colors ${
                    statusModal.currentStatus === status
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="capitalize">{status === 'draft' ? 'Concept' : status === 'open' ? 'Open' : status === 'sent' ? 'Verzonden' : status === 'paid' ? 'Betaald' : 'Verlopen'}</span>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
                      {status}
                    </span>
                  </div>
                </button>
              ))}
            </div>

            <button
              onClick={() => setStatusModal({ isOpen: false, invoiceId: '', invoiceNumber: '', currentStatus: '', tableName: 'sales_invoices' })}
              className="w-full px-4 py-2.5 border-2 border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors font-semibold"
            >
              Annuleren
            </button>
          </div>
        </div>
      )}

      {deleteModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-red-100 rounded-full">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h2 className="text-2xl font-black text-slate-800">Factuur Verwijderen</h2>
            </div>

            <p className="text-slate-600 mb-6">
              Weet je zeker dat je factuur <span className="font-semibold">{deleteModal.invoiceNumber}</span> wilt verwijderen? Deze actie kan niet ongedaan gemaakt worden.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setDeleteModal({ isOpen: false, invoiceId: '', invoiceNumber: '', tableName: 'sales_invoices' })}
                className="flex-1 px-4 py-2.5 border-2 border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors font-semibold"
              >
                Annuleren
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors font-semibold"
              >
                Verwijderen
              </button>
            </div>
          </div>
        </div>
      )}

      {editModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-amber-100 rounded-full">
                <Euro className="w-6 h-6 text-amber-600" />
              </div>
              <h2 className="text-2xl font-black text-slate-800">Bedrag Wijzigen</h2>
            </div>

            <p className="text-slate-600 mb-4">
              Wijzig het totale bedrag van factuur <span className="font-semibold">{editModal.invoiceNumber}</span>
            </p>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Totaal Bedrag
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">€</span>
                <input
                  type="number"
                  step="0.01"
                  value={editModal.totalAmount}
                  onChange={(e) => setEditModal({ ...editModal, totalAmount: parseFloat(e.target.value) || 0 })}
                  className="w-full pl-8 pr-4 py-2.5 border-2 border-slate-200 rounded-xl focus:border-amber-500 focus:outline-none text-slate-900 font-medium"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setEditModal({ isOpen: false, invoiceId: '', invoiceNumber: '', totalAmount: 0, tableName: 'sales_invoices' })}
                className="flex-1 px-4 py-2.5 border-2 border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors font-semibold"
              >
                Annuleren
              </button>
              <button
                onClick={handleEditSave}
                className="flex-1 px-4 py-2.5 bg-amber-600 text-white rounded-xl hover:bg-amber-700 transition-colors font-semibold"
              >
                Opslaan
              </button>
            </div>
          </div>
        </div>
      )}

      {detailModal.isOpen && detailModal.invoice && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-100 rounded-full">
                    <FileText className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-slate-800">
                      Factuur {detailModal.tableName === 'sales_invoices'
                        ? detailModal.invoice.invoice_number
                        : detailModal.invoice.invoice_number}
                    </h2>
                    <p className="text-sm text-slate-500">
                      {detailModal.tableName === 'sales_invoices'
                        ? new Date(detailModal.invoice.date).toLocaleDateString('nl-NL', { year: 'numeric', month: 'long', day: 'numeric' })
                        : new Date(detailModal.invoice.invoice_date).toLocaleDateString('nl-NL', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setDetailModal({ isOpen: false, invoice: null, lines: [], tableName: 'sales_invoices' })}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <span className="text-2xl text-slate-400">&times;</span>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Factuurnummer
                    </label>
                    <p className="text-base font-semibold text-slate-900">
                      {detailModal.tableName === 'sales_invoices'
                        ? detailModal.invoice.invoice_number
                        : detailModal.invoice.invoice_number}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Status
                    </label>
                    <div className="mt-1">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(detailModal.invoice.status)}`}>
                        {detailModal.invoice.status}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Factuurdatum
                    </label>
                    <p className="text-base text-slate-900">
                      {detailModal.tableName === 'sales_invoices'
                        ? new Date(detailModal.invoice.date).toLocaleDateString('nl-NL')
                        : new Date(detailModal.invoice.invoice_date).toLocaleDateString('nl-NL')}
                    </p>
                  </div>
                  {detailModal.tableName === 'invoices' && (
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        Vervaldatum
                      </label>
                      <p className="text-base text-slate-900">
                        {new Date(detailModal.invoice.due_date).toLocaleDateString('nl-NL')}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {detailModal.tableName === 'invoices' && detailModal.lines.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-slate-800 mb-3">Factuurregels</h3>
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-900">Omschrijving</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-slate-900">Aantal</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-slate-900">Prijs</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-slate-900">BTW %</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-slate-900">Totaal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {detailModal.lines.map((line: any) => (
                          <tr key={line.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3">
                              <div className="text-sm font-medium text-slate-900">{line.description}</div>
                              {line.accounts && (
                                <div className="text-xs text-slate-500">{line.accounts.account_code} - {line.accounts.account_name}</div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center text-sm text-slate-700">
                              {Number(line.quantity).toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-right text-sm text-slate-700">
                              €{Number(line.unit_price).toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-right text-sm text-slate-700">
                              {Number(line.vat_rate).toFixed(0)}%
                            </td>
                            <td className="px-4 py-3 text-right text-sm font-medium text-slate-900">
                              €{Number(line.amount).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="bg-slate-50 rounded-xl p-6">
                <h3 className="text-lg font-bold text-slate-800 mb-4">Totalen</h3>
                <div className="space-y-2">
                  {detailModal.tableName === 'invoices' && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Subtotaal</span>
                        <span className="font-medium text-slate-900">
                          €{Number(detailModal.invoice.subtotal).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">BTW</span>
                        <span className="font-medium text-slate-900">
                          €{Number(detailModal.invoice.vat_amount).toFixed(2)}
                        </span>
                      </div>
                    </>
                  )}
                  {detailModal.tableName === 'sales_invoices' && detailModal.invoice.vat_amount > 0 && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Subtotaal</span>
                        <span className="font-medium text-slate-900">
                          €{(Number(detailModal.invoice.total_amount) - Number(detailModal.invoice.vat_amount)).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">BTW</span>
                        <span className="font-medium text-slate-900">
                          €{Number(detailModal.invoice.vat_amount).toFixed(2)}
                        </span>
                      </div>
                    </>
                  )}
                  <div className="pt-2 border-t-2 border-slate-300">
                    <div className="flex justify-between text-lg font-bold">
                      <span className="text-slate-900">Totaal</span>
                      <span className="text-slate-900">
                        €{Number(detailModal.invoice.total_amount).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {detailModal.invoice.notes && (
                <div className="mt-6">
                  <h3 className="text-lg font-bold text-slate-800 mb-2">Opmerkingen</h3>
                  <p className="text-sm text-slate-600 bg-slate-50 rounded-lg p-4">
                    {detailModal.invoice.notes}
                  </p>
                </div>
              )}

              {detailModal.tableName === 'sales_invoices' && detailModal.invoice.pdf_url && (
                <div className="mt-6">
                  <a
                    href={detailModal.invoice.pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                  >
                    <Eye className="w-4 h-4" />
                    Bekijk PDF
                  </a>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-200">
              <button
                onClick={() => setDetailModal({ isOpen: false, invoice: null, lines: [], tableName: 'sales_invoices' })}
                className="w-full px-4 py-2.5 border-2 border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors font-semibold"
              >
                Sluiten
              </button>
            </div>
          </div>
        </div>
      )}

      {previewModal.invoice && (
        <InvoicePreviewModal
          isOpen={previewModal.isOpen}
          onClose={() => setPreviewModal({ isOpen: false, invoice: null })}
          invoice={previewModal.invoice}
        />
      )}
    </div>
  );
}
