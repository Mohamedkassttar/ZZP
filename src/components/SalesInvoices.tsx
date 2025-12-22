import { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Save,
  X,
  ChevronDown,
  AlertCircle,
  CheckCircle,
  FileText,
  Loader,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';
import { getCurrentCompanyId } from '../lib/companyHelper';

type Invoice = Database['public']['Tables']['invoices']['Row'];
type Contact = Database['public']['Tables']['contacts']['Row'];
type Account = Database['public']['Tables']['accounts']['Row'];
type InvoiceLine = Database['public']['Tables']['invoice_lines']['Row'];
type JournalEntry = Database['public']['Tables']['journal_entries']['Row'];

interface InvoiceWithContact extends Invoice {
  contact?: Contact;
}

interface RevenueTransaction {
  id: string;
  date: string;
  reference: string;
  contact_name: string | null;
  description: string;
  amount: number;
  source: 'Invoice' | 'Journal';
  invoice_id?: string;
}

interface LineItem {
  id: string;
  description: string;
  quantity: string;
  unit_price: string;
  vat_rate: string;
  ledger_account_id: string;
  amount: number;
  vat_amount: number;
  line_order: number;
}

interface QuickCreateClientData {
  company_name: string;
  address: string;
  postal_code: string;
  city: string;
  vat_number: string;
}

export function SalesInvoices() {
  const [revenueTransactions, setRevenueTransactions] = useState<RevenueTransaction[]>([]);
  const [invoices, setInvoices] = useState<InvoiceWithContact[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [revenueAccounts, setRevenueAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [showQuickCreate, setShowQuickCreate] = useState(false);

  const [selectedContactId, setSelectedContactId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineItem[]>([
    {
      id: crypto.randomUUID(),
      description: '',
      quantity: '1',
      unit_price: '',
      vat_rate: '21',
      ledger_account_id: '',
      amount: 0,
      vat_amount: 0,
      line_order: 0,
    },
  ]);

  const [quickCreateData, setQuickCreateData] = useState<QuickCreateClientData>({
    company_name: '',
    address: '',
    postal_code: '',
    city: '',
    vat_number: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (showEditor && !editingInvoice) {
      generateInvoiceNumber();
    }
  }, [showEditor]);

  async function loadData() {
    setLoading(true);
    try {
      const [invoicesRes, contactsRes, accountsRes] = await Promise.all([
        supabase
          .from('invoices')
          .select('*, contacts(*)')
          .order('invoice_date', { ascending: false })
          .limit(100),
        supabase
          .from('contacts')
          .select('*')
          .eq('is_active', true)
          .or('relation_type.eq.Customer,relation_type.eq.Both')
          .order('company_name'),
        supabase
          .from('accounts')
          .select('*')
          .eq('type', 'Revenue')
          .eq('is_active', true)
          .order('code'),
      ]);

      if (invoicesRes.data) {
        const enriched = invoicesRes.data.map((inv: any) => ({
          ...inv,
          contact: inv.contacts,
        }));
        setInvoices(enriched);
      }

      setContacts(contactsRes.data || []);
      setRevenueAccounts(accountsRes.data || []);

      await loadRevenueTransactions(accountsRes.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  async function loadRevenueTransactions(revenueAccs: Account[]) {
    try {
      const transactions: RevenueTransaction[] = [];

      const { data: invoicesData } = await supabase
        .from('invoices')
        .select('*, contacts(*)')
        .order('invoice_date', { ascending: false });

      if (invoicesData) {
        invoicesData.forEach((inv: any) => {
          transactions.push({
            id: inv.id,
            date: inv.invoice_date,
            reference: inv.invoice_number,
            contact_name: inv.contacts?.company_name || null,
            description: `Verkoopfactuur ${inv.invoice_number}`,
            amount: Number(inv.total_amount),
            source: 'Invoice',
            invoice_id: inv.id,
          });
        });
      }

      const revenueAccountIds = revenueAccs
        .filter(
          (acc) =>
            acc.tax_category === 'Netto Omzet' || acc.tax_category === 'Overige Opbrengsten'
        )
        .map((acc) => acc.id);

      if (revenueAccountIds.length > 0) {
        const { data: journalLines } = await supabase
          .from('journal_lines')
          .select('*, journal_entries!inner(*), accounts!inner(*), contacts(*)')
          .in('account_id', revenueAccountIds)
          .neq('journal_entries.type', 'Sales')
          .gt('credit', 0);

        if (journalLines) {
          for (const line of journalLines) {
            const entry = line.journal_entries as any;
            const account = line.accounts as any;

            if (account.type !== 'Revenue') continue;

            if (!entry.contact_id) continue;

            const contact = line.contacts as any;

            transactions.push({
              id: line.id,
              date: entry.entry_date,
              reference: entry.reference || '-',
              contact_name: contact?.company_name || null,
              description: line.description || entry.description || 'Omzetboeking',
              amount: Number(line.credit),
              source: 'Journal',
            });
          }
        }
      }

      transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setRevenueTransactions(transactions);
    } catch (err) {
      console.error('Failed to load revenue transactions:', err);
    }
  }

  async function generateInvoiceNumber() {
    try {
      const { data: lastInvoice } = await supabase
        .from('invoices')
        .select('invoice_number')
        .order('invoice_number', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastInvoice?.invoice_number) {
        const match = lastInvoice.invoice_number.match(/(\d+)$/);
        if (match) {
          const nextNum = parseInt(match[1]) + 1;
          setInvoiceNumber(`INV-${String(nextNum).padStart(4, '0')}`);
        } else {
          setInvoiceNumber('INV-0001');
        }
      } else {
        setInvoiceNumber('INV-0001');
      }
    } catch {
      setInvoiceNumber('INV-0001');
    }
  }

  function openEditor(invoice?: Invoice) {
    if (invoice) {
      setEditingInvoice(invoice);
      setSelectedContactId(invoice.contact_id);
      setInvoiceNumber(invoice.invoice_number);
      setInvoiceDate(invoice.invoice_date);
      setDueDate(invoice.due_date);
      setNotes(invoice.notes || '');
      loadInvoiceLines(invoice.id);
    } else {
      resetEditor();
    }
    setShowEditor(true);
  }

  async function loadInvoiceLines(invoiceId: string) {
    const { data } = await supabase
      .from('invoice_lines')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('line_order');

    if (data && data.length > 0) {
      setLines(
        data.map((line) => ({
          id: line.id,
          description: line.description,
          quantity: String(line.quantity),
          unit_price: String(line.unit_price),
          vat_rate: String(line.vat_rate),
          ledger_account_id: line.ledger_account_id,
          amount: Number(line.amount),
          vat_amount: Number(line.vat_amount),
          line_order: line.line_order,
        }))
      );
    }
  }

  function resetEditor() {
    setEditingInvoice(null);
    setSelectedContactId('');
    setInvoiceDate(new Date().toISOString().split('T')[0]);
    setDueDate(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    setNotes('');
    setLines([
      {
        id: crypto.randomUUID(),
        description: '',
        quantity: '1',
        unit_price: '',
        vat_rate: '21',
        ledger_account_id: '',
        amount: 0,
        vat_amount: 0,
        line_order: 0,
      },
    ]);
    setSearchTerm('');
    setShowQuickCreate(false);
  }

  function closeEditor() {
    setShowEditor(false);
    resetEditor();
  }

  function addLine() {
    setLines([
      ...lines,
      {
        id: crypto.randomUUID(),
        description: '',
        quantity: '1',
        unit_price: '',
        vat_rate: '21',
        ledger_account_id: '',
        amount: 0,
        vat_amount: 0,
        line_order: lines.length,
      },
    ]);
  }

  function removeLine(id: string) {
    if (lines.length > 1) {
      setLines(lines.filter((line) => line.id !== id));
    }
  }

  function updateLine(id: string, field: keyof LineItem, value: string) {
    setLines(
      lines.map((line) => {
        if (line.id === id) {
          const updated = { ...line, [field]: value };

          const qty = parseFloat(updated.quantity) || 0;
          const price = parseFloat(updated.unit_price) || 0;
          const vatRate = parseFloat(updated.vat_rate) || 0;

          updated.amount = qty * price;
          updated.vat_amount = updated.amount * (vatRate / 100);

          return updated;
        }
        return line;
      })
    );
  }

  function calculateTotals() {
    const subtotal = lines.reduce((sum, line) => sum + line.amount, 0);
    const vatAmount = lines.reduce((sum, line) => sum + line.vat_amount, 0);
    const total = subtotal + vatAmount;
    return { subtotal, vatAmount, total };
  }

  async function handleQuickCreateClient() {
    if (!quickCreateData.company_name.trim()) {
      setError('Bedrijfsnaam is verplicht');
      return;
    }

    try {
      const { data: newContact, error: contactError } = await supabase
        .from('contacts')
        .insert({
          company_name: quickCreateData.company_name,
          address: quickCreateData.address || null,
          postal_code: quickCreateData.postal_code || null,
          city: quickCreateData.city || null,
          vat_number: quickCreateData.vat_number || null,
          relation_type: 'Customer',
          is_active: true,
        })
        .select()
        .single();

      if (contactError) throw contactError;

      setContacts([...contacts, newContact]);
      setSelectedContactId(newContact.id);
      setSearchTerm(newContact.company_name);
      setShowQuickCreate(false);
      setShowClientDropdown(false);
      setQuickCreateData({
        company_name: '',
        address: '',
        postal_code: '',
        city: '',
        vat_number: '',
      });
      setSuccess('Klant succesvol aangemaakt');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create client');
    }
  }

  async function handleSaveInvoice(finalize: boolean = false) {
    setError(null);
    setSuccess(null);

    if (!selectedContactId) {
      setError('Selecteer een klant');
      return;
    }

    if (!invoiceNumber.trim()) {
      setError('Factuurnummer is verplicht');
      return;
    }

    const validLines = lines.filter(
      (line) => line.description.trim() && parseFloat(line.unit_price) > 0
    );

    if (validLines.length === 0) {
      setError('Voeg minimaal één factuurlijn toe');
      return;
    }

    const { subtotal, vatAmount, total } = calculateTotals();

    try {
      const invoiceData = {
        contact_id: selectedContactId,
        invoice_number: invoiceNumber,
        invoice_date: invoiceDate,
        due_date: dueDate,
        subtotal,
        vat_amount: vatAmount,
        total_amount: total,
        net_amount: subtotal,
        status: finalize ? ('Sent' as const) : ('Draft' as const),
        notes: notes || null,
      };

      let invoiceId: string;

      if (editingInvoice) {
        const { error: updateError } = await supabase
          .from('invoices')
          .update(invoiceData)
          .eq('id', editingInvoice.id);

        if (updateError) throw updateError;
        invoiceId = editingInvoice.id;

        await supabase.from('invoice_lines').delete().eq('invoice_id', invoiceId);
      } else {
        const { data: newInvoice, error: insertError } = await supabase
          .from('invoices')
          .insert(invoiceData)
          .select()
          .single();

        if (insertError) throw insertError;
        invoiceId = newInvoice.id;
      }

      const lineInserts = validLines.map((line, index) => ({
        invoice_id: invoiceId,
        description: line.description,
        quantity: parseFloat(line.quantity),
        unit_price: parseFloat(line.unit_price),
        amount: line.amount,
        vat_rate: parseFloat(line.vat_rate),
        vat_amount: line.vat_amount,
        ledger_account_id: line.ledger_account_id || revenueAccounts[0]?.id,
        line_order: index,
      }));

      const { error: linesError } = await supabase.from('invoice_lines').insert(lineInserts);

      if (linesError) throw linesError;

      if (finalize) {
        await bookInvoice(invoiceId, invoiceData, validLines);
      }

      setSuccess(
        finalize
          ? 'Factuur geboekt en klaar voor verzending'
          : 'Factuur opgeslagen als concept'
      );

      setTimeout(() => {
        closeEditor();
        loadData();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save invoice');
    }
  }

  async function bookInvoice(
    invoiceId: string,
    invoiceData: any,
    validLines: LineItem[]
  ) {
    const companyId = await getCurrentCompanyId();
    if (!companyId) {
      throw new Error('Geen bedrijf geselecteerd');
    }

    // Dynamically look up active system accounts (no more hardcoded 1300!)
    const { findActiveAccountsReceivable } = await import('../lib/systemAccountsService');
    const debtorAccount = await findActiveAccountsReceivable();

    if (!debtorAccount) {
      throw new Error('Active Debiteuren account not found. Please ensure you have an active Debiteuren account in Settings.');
    }

    const { data: journalEntry, error: entryError } = await supabase
      .from('journal_entries')
      .insert({
        company_id: companyId,
        entry_date: invoiceData.invoice_date,
        description: `Verkoopfactuur ${invoiceData.invoice_number}`,
        reference: invoiceData.invoice_number,
        contact_id: invoiceData.contact_id,
        type: 'Sales',
        status: 'Final',
      })
      .select()
      .single();

    if (entryError) throw entryError;

    const journalLines = [];

    journalLines.push({
      journal_entry_id: journalEntry.id,
      account_id: debtorAccount.id,
      debit: invoiceData.total_amount,
      credit: 0,
      description: `Factuur ${invoiceData.invoice_number}`,
    });

    for (const line of validLines) {
      journalLines.push({
        journal_entry_id: journalEntry.id,
        account_id: line.ledger_account_id || revenueAccounts[0]?.id,
        debit: 0,
        credit: line.amount,
        description: line.description,
      });
    }

    if (invoiceData.vat_amount > 0) {
      // Dynamically look up active VAT Payable account (no more hardcoded 1600!)
      const { findActiveVATPayable } = await import('../lib/systemAccountsService');
      const vatAccount = await findActiveVATPayable();

      if (vatAccount) {
        journalLines.push({
          journal_entry_id: journalEntry.id,
          account_id: vatAccount.id,
          debit: 0,
          credit: invoiceData.vat_amount,
          description: 'BTW verkopen',
        });
      }
    }

    const { error: linesError } = await supabase.from('journal_lines').insert(journalLines);

    if (linesError) throw linesError;

    await supabase
      .from('invoices')
      .update({
        journal_entry_id: journalEntry.id,
        finalized_at: new Date().toISOString(),
      })
      .eq('id', invoiceId);
  }

  const filteredContacts = contacts.filter((c) =>
    c.company_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const showCreateOption =
    searchTerm.trim() &&
    !filteredContacts.some(
      (c) => c.company_name.toLowerCase() === searchTerm.toLowerCase()
    );

  const { subtotal, vatAmount, total } = calculateTotals();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="w-6 h-6 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Verkoop Overzicht</h1>
          <p className="text-sm text-gray-500">Alle omzettransacties</p>
        </div>
        <button
          onClick={() => openEditor()}
          className="h-9 flex items-center gap-1.5 px-4 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nieuwe Factuur
        </button>
      </div>

      {revenueTransactions.length === 0 ? (
        <div className="rounded-lg border border-gray-200 shadow-sm p-4 text-center">
          <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-xs text-gray-500">Nog geen omzettransacties gevonden</p>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="h-10 bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-2 text-left text-xs uppercase tracking-wide whitespace-nowrap">
                    Datum
                  </th>
                  <th className="px-3 py-2 text-left text-xs uppercase tracking-wide whitespace-nowrap">
                    Referentie
                  </th>
                  <th className="px-3 py-2 text-left text-xs uppercase tracking-wide">
                    Klant
                  </th>
                  <th className="px-3 py-2 text-left text-xs uppercase tracking-wide">
                    Omschrijving
                  </th>
                  <th className="px-3 py-2 text-right text-xs uppercase tracking-wide whitespace-nowrap">
                    Bedrag
                  </th>
                  <th className="px-3 py-2 text-center text-xs uppercase tracking-wide whitespace-nowrap">
                    Bron
                  </th>
                  <th className="px-3 py-2 text-right text-xs uppercase tracking-wide">
                    Acties
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {revenueTransactions.map((transaction) => (
                  <tr key={transaction.id} className="h-10 border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">
                      {new Date(transaction.date).toLocaleDateString('nl-NL')}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">
                      {transaction.reference}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-900">
                      {transaction.contact_name || '-'}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-600">
                      {transaction.description}
                    </td>
                    <td className="px-3 py-2 text-sm text-right font-medium text-gray-900 whitespace-nowrap">
                      €{transaction.amount.toLocaleString('nl-NL', {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span
                        className={`inline-flex px-1.5 py-0.5 text-xs font-medium rounded ${
                          transaction.source === 'Invoice'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-green-100 text-green-700'
                        }`}
                      >
                        {transaction.source === 'Invoice' ? 'Factuur' : 'Boeking'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      {transaction.source === 'Invoice' && transaction.invoice_id && (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => {
                              const invoice = invoices.find(inv => inv.id === transaction.invoice_id);
                              if (invoice) openEditor(invoice);
                            }}
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Bewerken"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showEditor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full my-8">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingInvoice ? 'Factuur Bewerken' : 'Nieuwe Factuur'}
              </h2>
              <button
                onClick={closeEditor}
                className="p-1 text-gray-400 hover:bg-gray-100 rounded transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-red-800">{error}</div>
                </div>
              )}

              {success && (
                <div className="p-3 bg-green-50 border border-green-200 rounded flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-green-800">{success}</div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative">
                  <label className="block text-xs text-gray-500 mb-1">
                    Klant *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setShowClientDropdown(true);
                      }}
                      onFocus={() => setShowClientDropdown(true)}
                      placeholder="Zoek of maak nieuwe klant..."
                      className="h-9 w-full px-3 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <Search className="absolute right-2 top-2 w-4 h-4 text-gray-400" />
                  </div>

                  {showClientDropdown && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-60 overflow-y-auto">
                      {filteredContacts.map((contact) => (
                        <button
                          key={contact.id}
                          onClick={() => {
                            setSelectedContactId(contact.id);
                            setSearchTerm(contact.company_name);
                            setShowClientDropdown(false);
                          }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 transition-colors"
                        >
                          <div className="font-medium text-gray-900">
                            {contact.company_name}
                          </div>
                          {contact.city && (
                            <div className="text-xs text-gray-500">{contact.city}</div>
                          )}
                        </button>
                      ))}

                      {showCreateOption && (
                        <button
                          onClick={() => {
                            setShowQuickCreate(true);
                            setQuickCreateData({
                              ...quickCreateData,
                              company_name: searchTerm,
                            });
                            setShowClientDropdown(false);
                          }}
                          className="w-full text-left px-3 py-2 text-sm bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors border-t border-gray-200"
                        >
                          <div className="flex items-center gap-2">
                            <Plus className="w-4 h-4" />
                            <span>+ "{searchTerm}" aanmaken</span>
                          </div>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Factuurnummer *
                  </label>
                  <input
                    type="text"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    className="h-9 w-full px-3 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Factuurdatum *
                  </label>
                  <input
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className="h-9 w-full px-3 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Vervaldatum *
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="h-9 w-full px-3 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {showQuickCreate && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-blue-900">
                      Nieuwe Klant Aanmaken
                    </h3>
                    <button
                      onClick={() => setShowQuickCreate(false)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Bedrijfsnaam *
                      </label>
                      <input
                        type="text"
                        value={quickCreateData.company_name}
                        onChange={(e) =>
                          setQuickCreateData({
                            ...quickCreateData,
                            company_name: e.target.value,
                          })
                        }
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        BTW-nummer
                      </label>
                      <input
                        type="text"
                        value={quickCreateData.vat_number}
                        onChange={(e) =>
                          setQuickCreateData({
                            ...quickCreateData,
                            vat_number: e.target.value,
                          })
                        }
                        placeholder="NL123456789B01"
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Adres
                      </label>
                      <input
                        type="text"
                        value={quickCreateData.address}
                        onChange={(e) =>
                          setQuickCreateData({ ...quickCreateData, address: e.target.value })
                        }
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Postcode
                      </label>
                      <input
                        type="text"
                        value={quickCreateData.postal_code}
                        onChange={(e) =>
                          setQuickCreateData({
                            ...quickCreateData,
                            postal_code: e.target.value,
                          })
                        }
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Plaats
                      </label>
                      <input
                        type="text"
                        value={quickCreateData.city}
                        onChange={(e) =>
                          setQuickCreateData({ ...quickCreateData, city: e.target.value })
                        }
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleQuickCreateClient}
                    className="w-full px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  >
                    Klant Opslaan en Selecteren
                  </button>
                </div>
              )}

              <div className="border-t border-gray-200 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-semibold text-gray-900">Factuurregels</h3>
                  <button
                    onClick={addLine}
                    className="h-9 flex items-center gap-1 px-4 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    Regel toevoegen
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 px-2 text-xs font-semibold text-gray-700">
                          Omschrijving
                        </th>
                        <th className="text-right py-2 px-2 text-xs font-semibold text-gray-700 whitespace-nowrap">
                          Aantal
                        </th>
                        <th className="text-right py-2 px-2 text-xs font-semibold text-gray-700 whitespace-nowrap">
                          Prijs
                        </th>
                        <th className="text-right py-2 px-2 text-xs font-semibold text-gray-700 whitespace-nowrap">
                          BTW %
                        </th>
                        <th className="text-right py-2 px-2 text-xs font-semibold text-gray-700 whitespace-nowrap">
                          Totaal
                        </th>
                        <th className="w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((line) => (
                        <tr key={line.id} className="border-b border-gray-100">
                          <td className="py-2 px-2">
                            <input
                              type="text"
                              value={line.description}
                              onChange={(e) =>
                                updateLine(line.id, 'description', e.target.value)
                              }
                              placeholder="Omschrijving..."
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                            />
                          </td>
                          <td className="py-2 px-2">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={line.quantity}
                              onChange={(e) => updateLine(line.id, 'quantity', e.target.value)}
                              className="w-20 px-2 py-1 text-sm text-right border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                            />
                          </td>
                          <td className="py-2 px-2">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={line.unit_price}
                              onChange={(e) => updateLine(line.id, 'unit_price', e.target.value)}
                              className="w-24 px-2 py-1 text-sm text-right border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                            />
                          </td>
                          <td className="py-2 px-2">
                            <select
                              value={line.vat_rate}
                              onChange={(e) => updateLine(line.id, 'vat_rate', e.target.value)}
                              className="w-20 px-2 py-1 text-sm text-right border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                            >
                              <option value="0">0%</option>
                              <option value="9">9%</option>
                              <option value="21">21%</option>
                            </select>
                          </td>
                          <td className="py-2 px-2 text-right text-sm font-medium text-gray-900 whitespace-nowrap">
                            €
                            {(line.amount + line.vat_amount).toLocaleString('nl-NL', {
                              minimumFractionDigits: 2,
                            })}
                          </td>
                          <td className="py-2 px-2">
                            <button
                              onClick={() => removeLine(line.id)}
                              disabled={lines.length <= 1}
                              className="p-1 text-red-600 hover:bg-red-50 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 flex justify-end">
                  <div className="w-64 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Subtotaal:</span>
                      <span className="font-medium text-gray-900">
                        €{subtotal.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">BTW:</span>
                      <span className="font-medium text-gray-900">
                        €{vatAmount.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-gray-200">
                      <span className="font-semibold text-gray-900">Totaal:</span>
                      <span className="font-semibold text-gray-900 text-base">
                        €{total.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Opmerkingen
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Optionele opmerkingen..."
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={closeEditor}
                  className="h-9 px-4 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors"
                >
                  Annuleren
                </button>
                <button
                  onClick={() => handleSaveInvoice(false)}
                  className="h-9 flex items-center gap-1.5 px-4 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                >
                  <Save className="w-4 h-4" />
                  Opslaan als Concept
                </button>
                <button
                  onClick={() => handleSaveInvoice(true)}
                  className="h-9 flex items-center gap-1.5 px-4 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                >
                  <CheckCircle className="w-4 h-4" />
                  Factuur Boeken
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
