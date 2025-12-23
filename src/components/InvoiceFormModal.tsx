import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Save, Edit2, AlertCircle, Loader } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';

type Contact = Database['public']['Tables']['contacts']['Row'];
type Account = Database['public']['Tables']['accounts']['Row'];

export interface InvoiceLineInput {
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
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

interface InvoiceFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (invoiceId: string, invoiceNumber: string) => void;
  initialContact?: Contact;
  initialLines?: InvoiceLineInput[];
  timeEntryIds?: string[];
}

export function InvoiceFormModal({
  isOpen,
  onClose,
  onSave,
  initialContact,
  initialLines = [],
  timeEntryIds = [],
}: InvoiceFormModalProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [revenueAccounts, setRevenueAccounts] = useState<Account[]>([]);
  const [selectedContactId, setSelectedContactId] = useState(initialContact?.id || '');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showContactEdit, setShowContactEdit] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadInitialData();
    }
  }, [isOpen]);

  useEffect(() => {
    if (initialContact) {
      setSelectedContactId(initialContact.id);
    }
  }, [initialContact]);

  useEffect(() => {
    if (initialLines.length > 0) {
      setLines(
        initialLines.map((line, index) => ({
          id: crypto.randomUUID(),
          description: line.description,
          quantity: String(line.quantity),
          unit_price: String(line.unit_price),
          vat_rate: String(line.vat_rate),
          ledger_account_id: '',
          amount: line.quantity * line.unit_price,
          vat_amount: (line.quantity * line.unit_price * line.vat_rate) / 100,
          line_order: index,
        }))
      );
    } else {
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
    }
  }, [initialLines]);

  async function loadInitialData() {
    try {
      const [contactsRes, accountsRes] = await Promise.all([
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

      setContacts(contactsRes.data || []);
      setRevenueAccounts(accountsRes.data || []);

      await generateInvoiceNumber();
    } catch (err) {
      console.error('Error loading initial data:', err);
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
          updated.vat_amount = (updated.amount * vatRate) / 100;

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

  function handleOpenContactEdit() {
    const contact = contacts.find((c) => c.id === selectedContactId);
    if (contact) {
      setEditingContact(contact);
      setShowContactEdit(true);
    }
  }

  async function handleSaveContactEdit() {
    if (!editingContact) return;

    const isComplete = editingContact.address && editingContact.postal_code && editingContact.city;

    if (!isComplete) {
      alert('Vul alle verplichte velden in (Adres, Postcode, Plaats)');
      return;
    }

    const { error } = await supabase
      .from('contacts')
      .update({
        address: editingContact.address,
        postal_code: editingContact.postal_code,
        city: editingContact.city,
        email: editingContact.email || null,
        vat_number: editingContact.vat_number || null,
        hourly_rate: editingContact.hourly_rate || null,
      })
      .eq('id', editingContact.id);

    if (error) {
      alert('Fout bij opslaan klantgegevens: ' + error.message);
      return;
    }

    const oldRate = contacts.find((c) => c.id === editingContact.id)?.hourly_rate;
    const newRate = editingContact.hourly_rate;

    if (oldRate !== newRate && newRate && newRate > 0) {
      const shouldUpdatePrices = confirm(
        `Wil je de prijzen in de huidige factuurregels updaten naar het nieuwe tarief van €${newRate}/uur?`
      );

      if (shouldUpdatePrices) {
        setLines(
          lines.map((line) => {
            const qty = parseFloat(line.quantity) || 0;
            const updatedPrice = String(newRate);
            const amount = qty * newRate;
            const vatRate = parseFloat(line.vat_rate) || 0;
            const vat_amount = (amount * vatRate) / 100;

            return {
              ...line,
              unit_price: updatedPrice,
              amount,
              vat_amount,
            };
          })
        );
      }
    }

    const updatedContacts = contacts.map((c) =>
      c.id === editingContact.id ? editingContact : c
    );
    setContacts(updatedContacts);

    setShowContactEdit(false);
    setEditingContact(null);
  }

  async function handleSaveInvoice() {
    setError(null);
    setSaving(true);

    try {
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

      const invoiceData = {
        contact_id: selectedContactId,
        invoice_number: invoiceNumber,
        invoice_date: invoiceDate,
        due_date: dueDate,
        subtotal,
        vat_amount: vatAmount,
        total_amount: total,
        net_amount: subtotal,
        status: 'Draft' as const,
        notes: notes || null,
      };

      const { data: newInvoice, error: insertError } = await supabase
        .from('invoices')
        .insert(invoiceData)
        .select()
        .single();

      if (insertError) throw insertError;

      const invoiceId = newInvoice.id;

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

      if (timeEntryIds.length > 0) {
        const { error: updateError } = await supabase
          .from('time_entries')
          .update({
            status: 'billed',
            invoice_id: invoiceId,
            updated_at: new Date().toISOString(),
          })
          .in('id', timeEntryIds);

        if (updateError) {
          console.error('Error updating time entries:', updateError);
        }
      }

      onSave(invoiceId, invoiceNumber);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fout bij opslaan factuur');
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    setError(null);
    setSelectedContactId(initialContact?.id || '');
    setNotes('');
    setShowContactEdit(false);
    setEditingContact(null);
    onClose();
  }

  const { subtotal, vatAmount, total } = calculateTotals();
  const selectedContact = contacts.find((c) => c.id === selectedContactId);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex-shrink-0 flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-2xl font-black text-slate-800">Nieuwe Factuur</h2>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-600 p-2"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Klant <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <select
                  value={selectedContactId}
                  onChange={(e) => setSelectedContactId(e.target.value)}
                  className="flex-1 px-4 py-2.5 border-2 border-slate-300 rounded-xl focus:border-blue-500 focus:outline-none"
                >
                  <option value="">Selecteer klant...</option>
                  {contacts.map((contact) => (
                    <option key={contact.id} value={contact.id}>
                      {contact.company_name}
                    </option>
                  ))}
                </select>
                {selectedContactId && (
                  <button
                    onClick={handleOpenContactEdit}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors"
                    title="Klant bewerken"
                  >
                    <Edit2 className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Factuurnummer <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="w-full px-4 py-2.5 border-2 border-slate-300 rounded-xl focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Factuurdatum
              </label>
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="w-full px-4 py-2.5 border-2 border-slate-300 rounded-xl focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Vervaldatum
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-4 py-2.5 border-2 border-slate-300 rounded-xl focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold text-slate-800">Factuurregels</h3>
              <button
                onClick={addLine}
                className="px-3 py-1.5 text-sm bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition-colors flex items-center gap-2 font-semibold"
              >
                <Plus className="w-4 h-4" />
                Regel
              </button>
            </div>

            <div className="space-y-3">
              {lines.map((line) => (
                <div
                  key={line.id}
                  className="grid grid-cols-12 gap-3 p-4 bg-slate-50 rounded-xl border-2 border-slate-200"
                >
                  <div className="col-span-5">
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Omschrijving
                    </label>
                    <input
                      type="text"
                      value={line.description}
                      onChange={(e) => updateLine(line.id, 'description', e.target.value)}
                      placeholder="Beschrijving..."
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Aantal
                    </label>
                    <input
                      type="number"
                      step="0.25"
                      value={line.quantity}
                      onChange={(e) => updateLine(line.id, 'quantity', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Prijs
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={line.unit_price}
                      onChange={(e) => updateLine(line.id, 'unit_price', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      BTW%
                    </label>
                    <select
                      value={line.vat_rate}
                      onChange={(e) => updateLine(line.id, 'vat_rate', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    >
                      <option value="0">0%</option>
                      <option value="9">9%</option>
                      <option value="21">21%</option>
                    </select>
                  </div>

                  <div className="col-span-1 flex items-end">
                    {lines.length > 1 && (
                      <button
                        onClick={() => removeLine(line.id)}
                        className="w-full p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Verwijderen"
                      >
                        <Trash2 className="w-5 h-5 mx-auto" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Opmerkingen
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-4 py-2.5 border-2 border-slate-300 rounded-xl focus:border-blue-500 focus:outline-none"
              placeholder="Optionele opmerkingen..."
            />
          </div>

          <div className="bg-slate-50 rounded-xl p-4 border-2 border-slate-200">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Subtotaal:</span>
                <span className="font-semibold text-slate-800">€{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">BTW:</span>
                <span className="font-semibold text-slate-800">€{vatAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg border-t-2 border-slate-300 pt-2 mt-2">
                <span className="font-bold text-slate-800">Totaal:</span>
                <span className="font-black text-slate-800">€{total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-shrink-0 flex justify-end gap-3 p-6 border-t border-slate-200 bg-slate-50">
          <button
            onClick={handleClose}
            className="px-6 py-2.5 border-2 border-slate-300 text-slate-700 rounded-xl hover:bg-white transition-colors font-semibold"
          >
            Annuleren
          </button>
          <button
            onClick={handleSaveInvoice}
            disabled={saving}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors flex items-center gap-2 font-semibold disabled:bg-slate-300 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                Opslaan...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Opslaan als Concept
              </>
            )}
          </button>
        </div>
      </div>

      {showContactEdit && editingContact && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex-shrink-0 p-6 border-b border-slate-200">
              <h3 className="text-2xl font-black text-slate-800">Klant Bewerken</h3>
              <p className="text-sm text-slate-600 mt-1">{editingContact.company_name}</p>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Adres <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editingContact.address || ''}
                  onChange={(e) =>
                    setEditingContact({ ...editingContact, address: e.target.value })
                  }
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
                    value={editingContact.postal_code || ''}
                    onChange={(e) =>
                      setEditingContact({ ...editingContact, postal_code: e.target.value })
                    }
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
                    value={editingContact.city || ''}
                    onChange={(e) =>
                      setEditingContact({ ...editingContact, city: e.target.value })
                    }
                    placeholder="Amsterdam"
                    className="w-full px-4 py-2.5 border-2 border-slate-300 rounded-xl focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={editingContact.email || ''}
                  onChange={(e) =>
                    setEditingContact({ ...editingContact, email: e.target.value })
                  }
                  placeholder="info@klant.nl"
                  className="w-full px-4 py-2.5 border-2 border-slate-300 rounded-xl focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  BTW-nummer
                </label>
                <input
                  type="text"
                  value={editingContact.vat_number || ''}
                  onChange={(e) =>
                    setEditingContact({ ...editingContact, vat_number: e.target.value })
                  }
                  placeholder="NL123456789B01"
                  className="w-full px-4 py-2.5 border-2 border-slate-300 rounded-xl focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Uurtarief (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={editingContact.hourly_rate || ''}
                  onChange={(e) =>
                    setEditingContact({
                      ...editingContact,
                      hourly_rate: parseFloat(e.target.value) || null,
                    })
                  }
                  placeholder="85.00"
                  className="w-full px-4 py-2.5 border-2 border-slate-300 rounded-xl focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex-shrink-0 flex justify-end gap-3 p-6 border-t border-slate-200 bg-slate-50">
              <button
                onClick={() => {
                  setShowContactEdit(false);
                  setEditingContact(null);
                }}
                className="px-6 py-2.5 border-2 border-slate-300 text-slate-700 rounded-xl hover:bg-white transition-colors font-semibold"
              >
                Annuleren
              </button>
              <button
                onClick={handleSaveContactEdit}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors flex items-center gap-2 font-semibold"
              >
                <Save className="w-5 h-5" />
                Opslaan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
