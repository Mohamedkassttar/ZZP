import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Send, X, CheckCircle, Search, Trash2 } from 'lucide-react';

interface Contact {
  id: string;
  company_name: string | null;
  email: string | null;
  address: string | null;
}

interface InvoiceLine {
  id: string;
  description: string;
  amount: number;
  vatRate: number;
}

export function PortalCreateInvoice() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContactId, setSelectedContactId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showNewContactModal, setShowNewContactModal] = useState(false);
  const [lines, setLines] = useState<InvoiceLine[]>([
    { id: crypto.randomUUID(), description: '', amount: 0, vatRate: 21 },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const [newContact, setNewContact] = useState({
    company_name: '',
    email: '',
    address: '',
  });

  useEffect(() => {
    loadContacts();
  }, []);

  async function loadContacts() {
    const { data } = await supabase
      .from('contacts')
      .select('id, company_name, email, address')
      .eq('relation_type', 'Customer')
      .eq('is_active', true)
      .order('company_name');

    if (data) setContacts(data);
  }

  async function createNewContact() {
    if (!newContact.company_name.trim()) return;

    const { data: debtorAccount } = await supabase
      .from('accounts')
      .select('id')
      .eq('type', 'Asset')
      .ilike('name', '%debiteur%')
      .limit(1)
      .maybeSingle();

    const { data, error } = await supabase
      .from('contacts')
      .insert({
        company_name: newContact.company_name,
        email: newContact.email || null,
        address: newContact.address || null,
        relation_type: 'Customer',
        default_ledger_account_id: debtorAccount?.id || null,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      alert('Fout bij aanmaken klant: ' + error.message);
      return;
    }

    if (data) {
      setContacts([...contacts, data]);
      setSelectedContactId(data.id);
      setShowNewContactModal(false);
      setNewContact({ company_name: '', email: '', address: '' });
    }
  }

  function addLine() {
    setLines([...lines, { id: crypto.randomUUID(), description: '', amount: 0, vatRate: 21 }]);
  }

  function removeLine(id: string) {
    if (lines.length === 1) return;
    setLines(lines.filter((line) => line.id !== id));
  }

  function updateLine(id: string, field: keyof InvoiceLine, value: any) {
    setLines(lines.map((line) => (line.id === id ? { ...line, [field]: value } : line)));
  }

  async function handleSubmit() {
    if (!selectedContactId) {
      alert('Selecteer een klant');
      return;
    }

    const validLines = lines.filter((line) => line.description.trim() && line.amount > 0);
    if (validLines.length === 0) {
      alert('Voeg minimaal één regel toe');
      return;
    }

    setIsSubmitting(true);

    try {
      const subtotal = validLines.reduce((sum, line) => sum + line.amount, 0);
      const vatAmount = validLines.reduce((sum, line) => sum + line.amount * (line.vatRate / 100), 0);
      const total = subtotal + vatAmount;

      const invoiceNumber = `INV-${Date.now()}`;
      const invoiceDate = new Date().toISOString().split('T')[0];
      const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const { data: revenueAccount } = await supabase
        .from('accounts')
        .select('id')
        .eq('type', 'Revenue')
        .eq('is_active', true)
        .order('code')
        .limit(1)
        .maybeSingle();

      const { data: debtorAccount } = await supabase
        .from('accounts')
        .select('id')
        .eq('type', 'Asset')
        .ilike('name', '%debiteur%')
        .limit(1)
        .maybeSingle();

      const { data: vatPayableAccount } = await supabase
        .from('accounts')
        .select('id')
        .eq('code', '1700')
        .maybeSingle();

      if (!revenueAccount || !debtorAccount || !vatPayableAccount) {
        throw new Error('Required accounts not found');
      }

      const { data: journalEntry, error: journalError } = await supabase
        .from('journal_entries')
        .insert({
          entry_date: invoiceDate,
          description: `Verkoopfactuur ${invoiceNumber}`,
          reference: invoiceNumber,
          status: 'Final',
          contact_id: selectedContactId,
          memoriaal_type: 'Verkoopfactuur',
        })
        .select()
        .single();

      if (journalError || !journalEntry) throw new Error('Failed to create journal entry');

      const journalLines = [
        {
          journal_entry_id: journalEntry.id,
          account_id: debtorAccount.id,
          debit: total,
          credit: 0,
          description: `Debiteur ${invoiceNumber}`,
        },
        {
          journal_entry_id: journalEntry.id,
          account_id: revenueAccount.id,
          debit: 0,
          credit: subtotal,
          description: `Omzet ${invoiceNumber}`,
        },
      ];

      if (vatAmount > 0.01) {
        journalLines.push({
          journal_entry_id: journalEntry.id,
          account_id: vatPayableAccount.id,
          debit: 0,
          credit: vatAmount,
          description: `BTW ${invoiceNumber}`,
        });
      }

      const { error: linesError } = await supabase.from('journal_lines').insert(journalLines);

      if (linesError) throw linesError;

      const { error: invoiceError } = await supabase.from('sales_invoices').insert({
        contact_id: selectedContactId,
        invoice_number: invoiceNumber,
        invoice_date: invoiceDate,
        due_date: dueDate,
        subtotal: subtotal,
        vat_amount: vatAmount,
        total_amount: total,
        status: 'Pending',
        journal_entry_id: journalEntry.id,
      });

      if (invoiceError) throw invoiceError;

      setSuccess(true);
    } catch (error) {
      console.error('Error creating invoice:', error);
      alert('Er ging iets fout bij het aanmaken van de factuur');
    } finally {
      setIsSubmitting(false);
    }
  }

  function reset() {
    setSelectedContactId('');
    setSearchTerm('');
    setLines([{ id: crypto.randomUUID(), description: '', amount: 0, vatRate: 21 }]);
    setSuccess(false);
  }

  const filteredContacts = contacts.filter((c) =>
    c.company_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const subtotal = lines.reduce((sum, line) => sum + line.amount, 0);
  const vatAmount = lines.reduce((sum, line) => sum + line.amount * (line.vatRate / 100), 0);
  const total = subtotal + vatAmount;

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
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Factuur Maken</h1>
        <p className="text-gray-600">Maak snel een verkoopfactuur aan</p>
      </div>

      <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-100">
        <label className="block text-sm font-semibold text-gray-900 mb-3">Klant</label>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Zoek klant..."
            className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
          />
        </div>

        <select
          value={selectedContactId}
          onChange={(e) => setSelectedContactId(e.target.value)}
          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none mb-3"
        >
          <option value="">-- Selecteer klant --</option>
          {filteredContacts.map((contact) => (
            <option key={contact.id} value={contact.id}>
              {contact.company_name}
            </option>
          ))}
        </select>

        <button
          onClick={() => setShowNewContactModal(true)}
          className="w-full bg-gray-100 text-gray-700 py-3 rounded-xl font-medium hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Nieuwe klant
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">Factuurregels</h3>
          <button
            onClick={addLine}
            className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {lines.map((line, index) => (
            <div key={line.id} className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-start justify-between mb-3">
                <span className="text-sm font-semibold text-gray-700">Regel {index + 1}</span>
                {lines.length > 1 && (
                  <button
                    onClick={() => removeLine(line.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <input
                type="text"
                value={line.description}
                onChange={(e) => updateLine(line.id, 'description', e.target.value)}
                placeholder="Omschrijving"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-3 focus:border-blue-500 focus:outline-none"
              />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Bedrag (ex. BTW)</label>
                  <input
                    type="number"
                    value={line.amount || ''}
                    onChange={(e) => updateLine(line.id, 'amount', parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    step="0.01"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-600 mb-1">BTW</label>
                  <select
                    value={line.vatRate}
                    onChange={(e) => updateLine(line.id, 'vatRate', parseInt(e.target.value))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  >
                    <option value={21}>Hoog (21%)</option>
                    <option value={9}>Laag (9%)</option>
                    <option value={0}>Nul (0%)</option>
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-6 border border-blue-200">
        <div className="space-y-2 mb-4">
          <div className="flex justify-between text-sm">
            <span className="text-gray-700">Subtotaal</span>
            <span className="font-semibold text-gray-900">
              {new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(subtotal)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-700">BTW</span>
            <span className="font-semibold text-gray-900">
              {new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(vatAmount)}
            </span>
          </div>
          <div className="border-t-2 border-blue-300 pt-2 flex justify-between">
            <span className="font-bold text-gray-900">Totaal</span>
            <span className="text-2xl font-bold text-blue-900">
              {new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(total)}
            </span>
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={isSubmitting || !selectedContactId}
          className="w-full bg-blue-600 text-white py-4 rounded-2xl font-semibold hover:bg-blue-700 transition-colors shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <>Verwerken...</>
          ) : (
            <>
              <Send className="w-5 h-5" />
              Versturen & Boeken
            </>
          )}
        </button>
      </div>

      {showNewContactModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Nieuwe Klant</h2>
              <button
                onClick={() => setShowNewContactModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Bedrijfsnaam *
                </label>
                <input
                  type="text"
                  value={newContact.company_name}
                  onChange={(e) => setNewContact({ ...newContact, company_name: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
                  placeholder="Bijv. Acme B.V."
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">E-mail</label>
                <input
                  type="email"
                  value={newContact.email}
                  onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
                  placeholder="info@acme.nl"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Adres</label>
                <textarea
                  value={newContact.address}
                  onChange={(e) => setNewContact({ ...newContact, address: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
                  rows={3}
                  placeholder="Straat 123, 1234 AB Plaats"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowNewContactModal(false)}
                className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
              >
                Annuleren
              </button>
              <button
                onClick={createNewContact}
                disabled={!newContact.company_name.trim()}
                className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Opslaan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
