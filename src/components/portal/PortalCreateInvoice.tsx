import { useState, useEffect } from 'react';
import {
  Plus,
  X,
  CheckCircle,
  Search,
  Trash2,
  Save,
  Send,
  Loader,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getCurrentCompanyId } from '../../lib/companyHelper';
import type { Database } from '../../lib/database.types';

type Contact = Database['public']['Tables']['contacts']['Row'];
type Account = Database['public']['Tables']['accounts']['Row'];

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
  email: string;
}

export function PortalCreateInvoice() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [revenueAccounts, setRevenueAccounts] = useState<Account[]>([]);
  const [selectedContactId, setSelectedContactId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [showQuickCreate, setShowQuickCreate] = useState(false);
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
    email: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
    generateInvoiceNumber();
  }, []);

  async function loadData() {
    try {
      const companyId = await getCurrentCompanyId();
      if (!companyId) throw new Error('Geen bedrijf geselecteerd');

      const [contactsRes, accountsRes] = await Promise.all([
        supabase
          .from('contacts')
          .select('*')
          .eq('company_id', companyId)
          .eq('is_active', true)
          .or('relation_type.eq.Customer,relation_type.eq.Both')
          .order('company_name'),
        supabase
          .from('accounts')
          .select('*')
          .eq('company_id', companyId)
          .eq('type', 'Revenue')
          .eq('is_active', true)
          .order('code'),
      ]);

      if (contactsRes.data) setContacts(contactsRes.data);
      if (accountsRes.data) setRevenueAccounts(accountsRes.data);
    } catch (err) {
      console.error('Error loading data:', err);
    }
  }

  async function generateInvoiceNumber() {
    try {
      const companyId = await getCurrentCompanyId();
      if (!companyId) throw new Error('Geen bedrijf geselecteerd');

      const { data: lastInvoice } = await supabase
        .from('invoices')
        .select('invoice_number')
        .eq('company_id', companyId)
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

  async function handleQuickCreateClient() {
    if (!quickCreateData.company_name.trim()) {
      setError('Bedrijfsnaam is verplicht');
      return;
    }

    try {
      const companyId = await getCurrentCompanyId();
      if (!companyId) throw new Error('Geen bedrijf geselecteerd');

      const { data: newContact, error: insertError } = await supabase
        .from('contacts')
        .insert({
          company_id: companyId,
          company_name: quickCreateData.company_name,
          address: quickCreateData.address || null,
          postal_code: quickCreateData.postal_code || null,
          city: quickCreateData.city || null,
          vat_number: quickCreateData.vat_number || null,
          email: quickCreateData.email || null,
          relation_type: 'Customer',
          is_active: true,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      setContacts([...contacts, newContact]);
      setSelectedContactId(newContact.id);
      setSearchTerm(newContact.company_name);
      setShowQuickCreate(false);
      setQuickCreateData({
        company_name: '',
        address: '',
        postal_code: '',
        city: '',
        vat_number: '',
        email: '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fout bij aanmaken klant');
    }
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
        ledger_account_id: revenueAccounts[0]?.id || '',
        amount: 0,
        vat_amount: 0,
        line_order: lines.length,
      },
    ]);
  }

  function removeLine(id: string) {
    if (lines.length === 1) return;
    setLines(lines.filter((line) => line.id !== id));
  }

  function updateLine(id: string, field: keyof LineItem, value: any) {
    setLines(
      lines.map((line) => {
        if (line.id !== id) return line;

        const updated = { ...line, [field]: value };

        const qty = parseFloat(updated.quantity) || 0;
        const price = parseFloat(updated.unit_price) || 0;
        const vatRate = parseFloat(updated.vat_rate) || 0;

        updated.amount = qty * price;
        updated.vat_amount = updated.amount * (vatRate / 100);

        return updated;
      })
    );
  }

  async function handleSubmit(finalize: boolean = true) {
    setError(null);

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

    setIsSubmitting(true);

    try {
      const companyId = await getCurrentCompanyId();
      if (!companyId) throw new Error('Geen bedrijf geselecteerd');

      const invoiceData = {
        company_id: companyId,
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

      const { data: newInvoice, error: insertError } = await supabase
        .from('invoices')
        .insert(invoiceData)
        .select()
        .single();

      if (insertError) throw insertError;

      const lineInserts = validLines.map((line, index) => ({
        invoice_id: newInvoice.id,
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
        await bookInvoice(newInvoice.id, invoiceData, validLines);
      }

      setSuccess(true);
    } catch (err) {
      console.error('Error creating invoice:', err);
      setError(err instanceof Error ? err.message : 'Er ging iets fout bij het aanmaken van de factuur');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function bookInvoice(
    invoiceId: string,
    invoiceData: any,
    validLines: LineItem[]
  ) {
    try {
      const companyId = await getCurrentCompanyId();
      if (!companyId) throw new Error('Geen bedrijf geselecteerd');

      const { fetchSystemAccounts } = await import('../../lib/systemAccountsService');
      const systemAccounts = await fetchSystemAccounts();

      if (!systemAccounts.accountsReceivable || !systemAccounts.vatPayable) {
        throw new Error('Systeem grootboekrekeningen niet gevonden');
      }

      const journalLines = [];

      journalLines.push({
        account_id: systemAccounts.accountsReceivable.id,
        debit: invoiceData.total_amount,
        credit: 0,
        description: `Factuur ${invoiceData.invoice_number}`,
      });

      for (const line of validLines) {
        journalLines.push({
          account_id: line.ledger_account_id || revenueAccounts[0]?.id,
          debit: 0,
          credit: line.amount,
          description: line.description,
        });

        if (line.vat_amount > 0) {
          journalLines.push({
            account_id: systemAccounts.vatPayable.id,
            debit: 0,
            credit: line.vat_amount,
            description: `BTW ${line.vat_rate}% - ${line.description}`,
          });
        }
      }

      const { data: journalEntry, error: journalError } = await supabase
        .from('journal_entries')
        .insert({
          company_id: companyId,
          entry_date: invoiceData.invoice_date,
          reference: invoiceData.invoice_number,
          description: `Verkoopfactuur ${invoiceData.invoice_number}`,
          type: 'Sales',
          contact_id: invoiceData.contact_id,
          related_invoice_id: invoiceId,
        })
        .select()
        .single();

      if (journalError) throw journalError;

      const lineInserts = journalLines.map((line) => ({
        ...line,
        journal_entry_id: journalEntry.id,
      }));

      const { error: linesError } = await supabase.from('journal_lines').insert(lineInserts);

      if (linesError) throw linesError;
    } catch (err) {
      console.error('Error booking invoice:', err);
      throw err;
    }
  }

  function calculateTotals() {
    const subtotal = lines.reduce((sum, line) => sum + line.amount, 0);
    const vatAmount = lines.reduce((sum, line) => sum + line.vat_amount, 0);
    const total = subtotal + vatAmount;
    return { subtotal, vatAmount, total };
  }

  function reset() {
    setSelectedContactId('');
    setSearchTerm('');
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
        ledger_account_id: revenueAccounts[0]?.id || '',
        amount: 0,
        vat_amount: 0,
        line_order: 0,
      },
    ]);
    setSuccess(false);
    setError(null);
    generateInvoiceNumber();
  }

  const filteredContacts = contacts.filter((c) =>
    c.company_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const showCreateOption =
    searchTerm.trim().length > 0 &&
    !filteredContacts.some((c) => c.company_name?.toLowerCase() === searchTerm.toLowerCase());

  const { subtotal, vatAmount, total } = calculateTotals();

  if (success) {
    return (
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-3xl shadow-xl p-8 text-center border border-gray-100">
          <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Factuur Verstuurd!</h2>
          <p className="text-gray-600 mb-8">
            De factuur is succesvol aangemaakt en geboekt in de administratie.
          </p>
          <button
            onClick={reset}
            className="w-full bg-blue-600 text-white py-4 rounded-2xl font-semibold hover:bg-blue-700 transition-colors shadow-lg"
          >
            Nieuwe factuur maken
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Factuur Maken</h1>
        <p className="text-gray-600">Maak een verkoopfactuur aan voor een klant</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-100">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <label className="block text-sm font-semibold text-gray-900 mb-2">Klant *</label>
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
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
              />
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            </div>

            {showClientDropdown && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                {filteredContacts.map((contact) => (
                  <button
                    key={contact.id}
                    onClick={() => {
                      setSelectedContactId(contact.id);
                      setSearchTerm(contact.company_name || '');
                      setShowClientDropdown(false);
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-gray-100 transition-colors"
                  >
                    <div className="font-medium text-gray-900">{contact.company_name}</div>
                    {contact.city && <div className="text-xs text-gray-500">{contact.city}</div>}
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
                    className="w-full text-left px-4 py-3 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors border-t border-gray-200"
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
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Factuurnummer *
            </label>
            <input
              type="text"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Factuurdatum *
            </label>
            <input
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Vervaldatum *
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        {showQuickCreate && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-blue-900">Nieuwe Klant Aanmaken</h3>
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
                    setQuickCreateData({ ...quickCreateData, company_name: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">E-mail</label>
                <input
                  type="email"
                  value={quickCreateData.email}
                  onChange={(e) =>
                    setQuickCreateData({ ...quickCreateData, email: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Adres</label>
                <input
                  type="text"
                  value={quickCreateData.address}
                  onChange={(e) =>
                    setQuickCreateData({ ...quickCreateData, address: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Postcode</label>
                <input
                  type="text"
                  value={quickCreateData.postal_code}
                  onChange={(e) =>
                    setQuickCreateData({ ...quickCreateData, postal_code: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Plaats</label>
                <input
                  type="text"
                  value={quickCreateData.city}
                  onChange={(e) =>
                    setQuickCreateData({ ...quickCreateData, city: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">BTW-nummer</label>
                <input
                  type="text"
                  value={quickCreateData.vat_number}
                  onChange={(e) =>
                    setQuickCreateData({ ...quickCreateData, vat_number: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <button
              onClick={handleQuickCreateClient}
              className="w-full px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Klant Opslaan en Selecteren
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">Factuurregels</h3>
          <button
            onClick={addLine}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
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
                      onChange={(e) => updateLine(line.id, 'description', e.target.value)}
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

      <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-100">
        <label className="block text-sm font-semibold text-gray-900 mb-2">
          Opmerkingen (optioneel)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none resize-none"
          placeholder="Extra informatie of opmerkingen..."
        />
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => handleSubmit(true)}
          disabled={isSubmitting || !selectedContactId}
          className="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-semibold hover:bg-blue-700 transition-colors shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <>
              <Loader className="w-5 h-5 animate-spin" />
              Verwerken...
            </>
          ) : (
            <>
              <Send className="w-5 h-5" />
              Versturen & Boeken
            </>
          )}
        </button>
      </div>
    </div>
  );
}
