import { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Save,
  X,
  AlertCircle,
  CheckCircle,
  FileText,
  Loader,
  Send,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Database } from '../../lib/database.types';

type Invoice = Database['public']['Tables']['invoices']['Row'];
type Contact = Database['public']['Tables']['contacts']['Row'];
type Account = Database['public']['Tables']['accounts']['Row'];

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

export function PortalCreateInvoice() {
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
  const [showContactEditModal, setShowContactEditModal] = useState(false);
  const [contactToEdit, setContactToEdit] = useState<Contact | null>(null);
  const [pendingFinalize, setPendingFinalize] = useState(false);

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

  async function handleSaveContactDetails() {
    if (!contactToEdit) return;

    const isComplete = contactToEdit.address && contactToEdit.postal_code && contactToEdit.city;

    if (!isComplete) {
      setError('Vul alle verplichte velden in (Adres, Postcode, Plaats)');
      return;
    }

    try {
      const { error: updateError } = await supabase
        .from('contacts')
        .update({
          address: contactToEdit.address,
          postal_code: contactToEdit.postal_code,
          city: contactToEdit.city,
          email: contactToEdit.email || null,
          vat_number: contactToEdit.vat_number || null,
        })
        .eq('id', contactToEdit.id);

      if (updateError) throw updateError;

      setShowContactEditModal(false);
      setContactToEdit(null);

      if (pendingFinalize) {
        setPendingFinalize(false);
        await handleSaveInvoice(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fout bij opslaan klantgegevens');
    }
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

    if (finalize) {
      const { data: contactData, error: contactError } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', selectedContactId)
        .maybeSingle();

      if (contactError || !contactData) {
        setError('Kon klantgegevens niet ophalen');
        return;
      }

      const isComplete = contactData.address && contactData.postal_code && contactData.city;

      if (!isComplete) {
        setContactToEdit(contactData as Contact);
        setPendingFinalize(true);
        setShowContactEditModal(true);
        return;
      }
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
    const { findActiveAccountsReceivable } = await import('../../lib/systemAccountsService');
    const debtorAccount = await findActiveAccountsReceivable();

    if (!debtorAccount) {
      throw new Error('Active Debiteuren account not found.');
    }

    const { data: journalEntry, error: entryError } = await supabase
      .from('journal_entries')
      .insert({
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
      const { findActiveVATPayable } = await import('../../lib/systemAccountsService');
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
          <h1 className="text-2xl font-bold text-gray-900">Facturen</h1>
          <p className="text-gray-600">Beheer je verkoop facturen</p>
        </div>
        <button
          onClick={() => openEditor()}
          className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-semibold hover:bg-blue-700 transition-colors shadow-lg flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Nieuwe Factuur
        </button>
      </div>

      {revenueTransactions.length === 0 ? (
        <div className="bg-white rounded-3xl shadow-md p-12 text-center border border-gray-100">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Nog geen facturen aangemaakt</p>
          <button
            onClick={() => openEditor()}
            className="mt-6 bg-blue-600 text-white px-6 py-3 rounded-2xl font-semibold hover:bg-blue-700 transition-colors"
          >
            Maak je eerste factuur
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-3xl shadow-md overflow-hidden border border-gray-100">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Datum
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Referentie
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Klant
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Omschrijving
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Bedrag
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Acties
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {revenueTransactions.map((transaction) => (
                  <tr key={transaction.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-2 text-sm text-gray-900 whitespace-nowrap">
                      {new Date(transaction.date).toLocaleDateString('nl-NL')}
                    </td>
                    <td className="px-6 py-2 text-sm text-gray-900 whitespace-nowrap font-medium">
                      {transaction.reference}
                    </td>
                    <td className="px-6 py-2 text-sm text-gray-900">
                      {transaction.contact_name || '-'}
                    </td>
                    <td className="px-6 py-2 text-sm text-gray-600">
                      {transaction.description}
                    </td>
                    <td className="px-6 py-2 text-sm text-right font-semibold text-gray-900 whitespace-nowrap">
                      {new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(transaction.amount)}
                    </td>
                    <td className="px-6 py-2 text-center">
                      <span
                        className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${
                          transaction.source === 'Invoice'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-green-100 text-green-700'
                        }`}
                      >
                        {transaction.source === 'Invoice' ? 'Factuur' : 'Boeking'}
                      </span>
                    </td>
                    <td className="px-6 py-2 text-right">
                      {transaction.source === 'Invoice' && transaction.invoice_id && (
                        <button
                          onClick={() => {
                            const invoice = invoices.find(inv => inv.id === transaction.invoice_id);
                            if (invoice) openEditor(invoice);
                          }}
                          className="text-blue-600 hover:text-blue-800 p-2 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Bewerken"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
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
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6">
          <div className="relative flex w-full max-w-5xl flex-col rounded-xl bg-white shadow-2xl max-h-[calc(100dvh-120px)] md:max-h-[85vh]">
            {/* HEADER (Fixed) */}
            <div className="flex-none flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
                {editingInvoice ? 'Factuur Bewerken' : 'Nieuwe Factuur'}
              </h2>
              <button
                onClick={closeEditor}
                className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>

            {/* BODY (Scrollable) */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
              {error && (
                <div className="p-4 bg-red-50 border-2 border-red-200 rounded-2xl flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-red-800 font-medium">{error}</div>
                </div>
              )}

              {success && (
                <div className="p-4 bg-green-50 border-2 border-green-200 rounded-2xl flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-green-800 font-medium">{success}</div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:gap-4">
                <div className="relative">
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 sm:mb-2">
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
                      className="w-full px-3 sm:px-4 py-2.5 sm:py-3 pr-10 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none text-sm"
                    />
                    <Search className="absolute right-3 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" style={{ top: '50%', transform: 'translateY(-50%)' }} />
                  </div>

                  {showClientDropdown && (
                    <div className="absolute z-10 w-full mt-2 bg-white border-2 border-gray-200 rounded-2xl shadow-xl max-h-60 overflow-y-auto">
                      {filteredContacts.map((contact) => (
                        <button
                          key={contact.id}
                          onClick={() => {
                            setSelectedContactId(contact.id);
                            setSearchTerm(contact.company_name);
                            setShowClientDropdown(false);
                          }}
                          className="w-full text-left px-4 py-3 text-sm hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-0"
                        >
                          <div className="font-semibold text-gray-900">
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
                          className="w-full text-left px-4 py-3 text-sm bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors font-semibold"
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
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 sm:mb-2">
                    Factuurnummer *
                  </label>
                  <input
                    type="text"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 sm:mb-2">
                      Factuurdatum *
                    </label>
                    <input
                      type="date"
                      value={invoiceDate}
                      onChange={(e) => setInvoiceDate(e.target.value)}
                      className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 sm:mb-2">
                      Vervaldatum *
                    </label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none text-sm"
                    />
                  </div>
                </div>
              </div>

              {showQuickCreate && (
                <div className="p-3 sm:p-4 bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 rounded-xl sm:rounded-2xl space-y-3 sm:space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base sm:text-lg font-bold text-blue-900">
                      Nieuwe Klant Aanmaken
                    </h3>
                    <button
                      onClick={() => setShowQuickCreate(false)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <X className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                  </div>

                  <div className="space-y-3 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-4">
                    <div>
                      <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 sm:mb-2">
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
                        className="w-full px-3 py-2 text-xs sm:text-sm border-2 border-blue-200 rounded-xl focus:border-blue-500 focus:outline-none bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 sm:mb-2">
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
                        className="w-full px-3 py-2 text-xs sm:text-sm border-2 border-blue-200 rounded-xl focus:border-blue-500 focus:outline-none bg-white"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 sm:mb-2">
                        Adres
                      </label>
                      <input
                        type="text"
                        value={quickCreateData.address}
                        onChange={(e) =>
                          setQuickCreateData({ ...quickCreateData, address: e.target.value })
                        }
                        className="w-full px-3 py-2 text-xs sm:text-sm border-2 border-blue-200 rounded-xl focus:border-blue-500 focus:outline-none bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 sm:mb-2">
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
                        className="w-full px-3 py-2 text-xs sm:text-sm border-2 border-blue-200 rounded-xl focus:border-blue-500 focus:outline-none bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 sm:mb-2">
                        Plaats
                      </label>
                      <input
                        type="text"
                        value={quickCreateData.city}
                        onChange={(e) =>
                          setQuickCreateData({ ...quickCreateData, city: e.target.value })
                        }
                        className="w-full px-3 py-2 text-xs sm:text-sm border-2 border-blue-200 rounded-xl focus:border-blue-500 focus:outline-none bg-white"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleQuickCreateClient}
                    className="w-full px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
                  >
                    Klant Opslaan en Selecteren
                  </button>
                </div>
              )}

              <div className="border-t-2 border-gray-200 pt-4 sm:pt-6">
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                  <h3 className="text-base sm:text-lg font-bold text-gray-900">Factuurregels</h3>
                  <button
                    onClick={addLine}
                    className="bg-blue-600 text-white px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold hover:bg-blue-700 transition-colors flex items-center gap-1.5 sm:gap-2"
                  >
                    <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline">Regel toevoegen</span>
                    <span className="sm:hidden">Regel</span>
                  </button>
                </div>

                <div className="space-y-3 sm:space-y-4">
                  {lines.map((line, index) => (
                    <div key={line.id} className="bg-gray-50 rounded-xl sm:rounded-2xl p-3 sm:p-4 border-2 border-gray-200">
                      <div className="flex items-start justify-between mb-2 sm:mb-3">
                        <span className="text-xs sm:text-sm font-semibold text-gray-700">Regel {index + 1}</span>
                        {lines.length > 1 && (
                          <button
                            onClick={() => removeLine(line.id)}
                            className="text-red-600 hover:text-red-700 p-1 hover:bg-red-50 rounded transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          </button>
                        )}
                      </div>

                      <div className="space-y-2 sm:space-y-3">
                        <input
                          type="text"
                          value={line.description}
                          onChange={(e) => updateLine(line.id, 'description', e.target.value)}
                          placeholder="Omschrijving..."
                          className="w-full px-3 py-2 text-xs sm:text-sm border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none bg-white"
                        />

                        <div className="grid grid-cols-3 gap-2 sm:gap-3">
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1" style={{ fontSize: '10px' }}>Aantal</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={line.quantity}
                              onChange={(e) => updateLine(line.id, 'quantity', e.target.value)}
                              className="w-full px-2 sm:px-3 py-2 text-xs sm:text-sm border-2 border-gray-300 rounded-lg sm:rounded-xl focus:border-blue-500 focus:outline-none bg-white"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1" style={{ fontSize: '10px' }}>Prijs</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={line.unit_price}
                              onChange={(e) => updateLine(line.id, 'unit_price', e.target.value)}
                              className="w-full px-2 sm:px-3 py-2 text-xs sm:text-sm border-2 border-gray-300 rounded-lg sm:rounded-xl focus:border-blue-500 focus:outline-none bg-white"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1" style={{ fontSize: '10px' }}>BTW</label>
                            <select
                              value={line.vat_rate}
                              onChange={(e) => updateLine(line.id, 'vat_rate', e.target.value)}
                              className="w-full px-2 sm:px-3 py-2 text-xs sm:text-sm border-2 border-gray-300 rounded-lg sm:rounded-xl focus:border-blue-500 focus:outline-none bg-white"
                            >
                              <option value="0">0%</option>
                              <option value="9">9%</option>
                              <option value="21">21%</option>
                            </select>
                          </div>
                        </div>

                        <div className="text-right pt-1">
                          <span className="text-xs sm:text-sm text-gray-600">Totaal: </span>
                          <span className="text-sm sm:text-base font-bold text-gray-900">
                            {new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(line.amount + line.vat_amount)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 sm:mt-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl sm:rounded-2xl p-4 sm:p-6 border-2 border-blue-200">
                  <div className="space-y-1.5 sm:space-y-2">
                    <div className="flex justify-between text-xs sm:text-sm">
                      <span className="text-gray-700 font-medium">Subtotaal:</span>
                      <span className="font-semibold text-gray-900">
                        {new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(subtotal)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs sm:text-sm">
                      <span className="text-gray-700 font-medium">BTW:</span>
                      <span className="font-semibold text-gray-900">
                        {new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(vatAmount)}
                      </span>
                    </div>
                    <div className="flex justify-between pt-2 sm:pt-3 border-t-2 border-blue-300">
                      <span className="font-bold text-blue-900 text-base sm:text-lg">Totaal:</span>
                      <span className="font-bold text-blue-900 text-lg sm:text-2xl">
                        {new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(total)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 sm:mb-2">
                  Opmerkingen
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Optionele opmerkingen..."
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
                />
              </div>

            </div>

            {/* FOOTER (Fixed at bottom) */}
            <div className="flex-none bg-white border-t-2 border-gray-200 px-4 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row justify-end gap-2 sm:gap-3">
              <button
                onClick={closeEditor}
                className="px-4 sm:px-6 py-2.5 sm:py-3 text-sm font-semibold border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors order-3 sm:order-1"
              >
                Annuleren
              </button>
              <button
                onClick={() => handleSaveInvoice(false)}
                className="px-4 sm:px-6 py-2.5 sm:py-3 text-sm font-semibold bg-gray-600 text-white rounded-xl hover:bg-gray-700 transition-colors flex items-center justify-center gap-2 order-2"
              >
                <Save className="w-4 h-4" />
                Concept Opslaan
              </button>
              <button
                onClick={() => handleSaveInvoice(true)}
                className="px-4 sm:px-6 py-2.5 sm:py-3 text-sm font-semibold bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors flex items-center justify-center gap-2 order-1 sm:order-3"
              >
                <Send className="w-4 h-4" />
                Boeken & Versturen
              </button>
            </div>
          </div>
        </div>
      )}

      {showContactEditModal && contactToEdit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4 sm:p-6">
          <div className="relative flex w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl max-h-[calc(100dvh-120px)] md:max-h-[85vh]">
            {/* HEADER */}
            <div className="flex-none p-4 sm:p-6 border-b border-slate-200">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <AlertCircle className="w-6 h-6 text-amber-600" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl sm:text-2xl font-black text-slate-800 mb-1">Klantgegevens Incompleet</h2>
                  <p className="text-xs sm:text-sm text-slate-600">
                    Voor het boeken en versturen van een factuur zijn volledige klantgegevens vereist. Vul de ontbrekende gegevens aan.
                  </p>
                </div>
              </div>
            </div>

            {/* BODY (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <p className="font-semibold text-blue-900">Klant: {contactToEdit.company_name}</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Adres <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={contactToEdit.address || ''}
                  onChange={(e) => setContactToEdit({ ...contactToEdit, address: e.target.value })}
                  placeholder="Straat + huisnummer"
                  className="w-full px-4 py-2.5 border-2 border-slate-300 rounded-xl focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Postcode <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={contactToEdit.postal_code || ''}
                    onChange={(e) => setContactToEdit({ ...contactToEdit, postal_code: e.target.value })}
                    placeholder="1234 AB"
                    className="w-full px-4 py-2.5 border-2 border-slate-300 rounded-xl focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Plaats <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={contactToEdit.city || ''}
                    onChange={(e) => setContactToEdit({ ...contactToEdit, city: e.target.value })}
                    placeholder="Amsterdam"
                    className="w-full px-4 py-2.5 border-2 border-slate-300 rounded-xl focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Email (optioneel)
                </label>
                <input
                  type="email"
                  value={contactToEdit.email || ''}
                  onChange={(e) => setContactToEdit({ ...contactToEdit, email: e.target.value })}
                  placeholder="info@klant.nl"
                  className="w-full px-4 py-2.5 border-2 border-slate-300 rounded-xl focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  BTW-nummer (optioneel)
                </label>
                <input
                  type="text"
                  value={contactToEdit.vat_number || ''}
                  onChange={(e) => setContactToEdit({ ...contactToEdit, vat_number: e.target.value })}
                  placeholder="NL123456789B01"
                  className="w-full px-4 py-2.5 border-2 border-slate-300 rounded-xl focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {/* FOOTER */}
            <div className="flex-none bg-white border-t border-slate-200 p-4 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowContactEditModal(false);
                  setContactToEdit(null);
                  setPendingFinalize(false);
                }}
                className="px-4 sm:px-6 py-2.5 border-2 border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors font-semibold"
              >
                Annuleren
              </button>
              <button
                onClick={handleSaveContactDetails}
                className="px-4 sm:px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors flex items-center gap-2 font-semibold"
              >
                <Save className="w-4 h-4 sm:w-5 sm:h-5" />
                Opslaan & Doorgaan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
