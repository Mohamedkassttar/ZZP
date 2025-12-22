import { useState, useEffect } from 'react';
import { Plus, FileSpreadsheet } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { UniversalImporter } from '../UniversalImporter';
import { salesInvoicesConfig } from '../../lib/importConfigs';
import type { Database } from '../../lib/database.types';
import { getCurrentCompanyId } from '../../lib/companyHelper';

type Contact = Database['public']['Tables']['contacts']['Row'];
type Invoice = Database['public']['Tables']['invoices']['Row'];
type Account = Database['public']['Tables']['accounts']['Row'];

export function InvoicesManager() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showImporter, setShowImporter] = useState(false);
  const [selectedContact, setSelectedContact] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [lines, setLines] = useState([
    { description: '', quantity: 1, price: 0, vatRate: 21, accountId: '' },
  ]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (showCreate) {
      loadContacts();
    }
  }, [showCreate]);

  async function loadData() {
    const [inv, cont, acc] = await Promise.all([
      supabase.from('invoices').select('*').order('created_at', { ascending: false }),
      supabase.from('contacts').select('*').in('relation_type', ['Customer', 'Both']).eq('is_active', true).order('company_name'),
      supabase.from('accounts').select('*').eq('type', 'Revenue').eq('is_active', true),
    ]);

    setInvoices(inv.data || []);
    setContacts(cont.data || []);
    setAccounts(acc.data || []);
    setLoading(false);
  }

  async function loadContacts() {
    const { data } = await supabase
      .from('contacts')
      .select('*')
      .in('relation_type', ['Customer', 'Both'])
      .eq('is_active', true)
      .order('company_name');

    if (data) {
      setContacts(data);
    }
  }

  async function createInvoice() {
    try {
      const subtotal = lines.reduce((sum, l) => sum + l.quantity * l.price, 0);
      const vatAmount = lines.reduce((sum, l) => sum + (l.quantity * l.price * l.vatRate) / 100, 0);
      const total = subtotal + vatAmount;

      const invoiceNum = `INV-${Date.now()}`;

      const { data: invoice, error: invError } = await supabase
        .from('invoices')
        .insert({
          contact_id: selectedContact,
          invoice_number: invoiceNum,
          due_date: dueDate,
          subtotal,
          vat_amount: vatAmount,
          total_amount: total,
          status: 'Draft',
        })
        .select()
        .single();

      if (invError) throw invError;

      const invoiceLines = lines.map((line, idx) => ({
        invoice_id: invoice.id,
        description: line.description,
        quantity: line.quantity,
        unit_price: line.price,
        amount: line.quantity * line.price,
        vat_rate: line.vatRate,
        vat_amount: (line.quantity * line.price * line.vatRate) / 100,
        ledger_account_id: line.accountId,
        line_order: idx,
      }));

      const { error: linesError } = await supabase.from('invoice_lines').insert(invoiceLines);

      if (linesError) throw linesError;

      alert('Invoice created successfully!');
      setShowCreate(false);
      loadData();
    } catch (err) {
      alert('Error: ' + (err instanceof Error ? err.message : 'Unknown'));
    }
  }

  async function finalizeInvoice(invoice: Invoice) {
    if (!confirm('Finalize this invoice? This will create accounting entries.')) return;

    try {
      const companyId = await getCurrentCompanyId();
      if (!companyId) {
        throw new Error('Geen bedrijf geselecteerd');
      }

      // Dynamically look up active system accounts (no more hardcoded 1100!)
      const { findActiveAccountsReceivable, findActiveVATPayable } = await import('../../lib/systemAccountsService');
      const [debitorsAccount, vatPayableAccount] = await Promise.all([
        findActiveAccountsReceivable(),
        findActiveVATPayable(),
      ]);

      if (!debitorsAccount || !vatPayableAccount) {
        throw new Error('Required active system accounts not found. Please ensure you have active Debiteuren and BTW te betalen accounts in Settings.');
      }

      const { data: invLines } = await supabase
        .from('invoice_lines')
        .select('*, accounts(*)')
        .eq('invoice_id', invoice.id);

      const entryId = crypto.randomUUID();
      const { error: jeError } = await supabase
        .from('journal_entries')
        .insert({
          id: entryId,
          company_id: companyId,
          entry_date: invoice.invoice_date,
          description: `Invoice ${invoice.invoice_number}`,
          reference: invoice.invoice_number,
          status: 'Draft',
          contact_id: invoice.contact_id,
        });

      if (jeError) throw jeError;
      const journalEntry = { id: entryId };

      const journalLines = [
        {
          journal_entry_id: journalEntry.id,
          account_id: debitorsAccount.id,
          debit: invoice.total_amount,
          credit: 0,
          description: 'Debiteuren',
        },
      ];

      invLines?.forEach((line) => {
        journalLines.push({
          journal_entry_id: journalEntry.id,
          account_id: line.ledger_account_id,
          debit: 0,
          credit: line.amount,
          description: line.description,
        });
      });

      if (invoice.vat_amount > 0) {
        journalLines.push({
          journal_entry_id: journalEntry.id,
          account_id: vatPayableAccount.id,
          debit: 0,
          credit: invoice.vat_amount,
          description: 'BTW te betalen',
        });
      }

      const { error: jlError } = await supabase.from('journal_lines').insert(journalLines);

      if (jlError) throw jlError;

      const { error: updateError } = await supabase
        .from('invoices')
        .update({ status: 'Sent', journal_entry_id: journalEntry.id })
        .eq('id', invoice.id);

      if (updateError) throw updateError;

      alert('Invoice finalized and booked!');
      loadData();
    } catch (err) {
      alert('Error: ' + (err instanceof Error ? err.message : 'Unknown'));
    }
  }

  if (loading) return <div className="text-center py-8">Loading...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Sales Invoices</h2>
        <div className="flex gap-3">
          <button
            onClick={() => setShowImporter(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Import Invoices
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg"
          >
            <Plus className="w-4 h-4" />
            New Invoice
          </button>
        </div>
      </div>

      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left text-sm font-semibold">Invoice #</th>
            <th className="px-4 py-2 text-left text-sm font-semibold">Date</th>
            <th className="px-4 py-2 text-right text-sm font-semibold">Total</th>
            <th className="px-4 py-2 text-left text-sm font-semibold">Status</th>
            <th className="px-4 py-2 text-right text-sm font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {invoices.map((inv) => (
            <tr key={inv.id}>
              <td className="px-4 py-2 text-sm">{inv.invoice_number}</td>
              <td className="px-4 py-2 text-sm">{inv.invoice_date}</td>
              <td className="px-4 py-2 text-sm text-right">€{inv.total_amount.toFixed(2)}</td>
              <td className="px-4 py-2 text-sm">
                <span className={`px-2 py-1 rounded text-xs ${inv.status === 'Draft' ? 'bg-yellow-100' : 'bg-green-100'}`}>
                  {inv.status}
                </span>
              </td>
              <td className="px-4 py-2 text-right">
                {inv.status === 'Draft' && (
                  <button
                    onClick={() => finalizeInvoice(inv)}
                    className="text-sm text-blue-600"
                  >
                    Finalize
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {showCreate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4">Create Invoice</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Customer</label>
                <select
                  value={selectedContact}
                  onChange={(e) => setSelectedContact(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">Select customer...</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.company_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Due Date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Line Items</label>
                {lines.map((line, idx) => (
                  <div key={idx} className="flex gap-2 mb-2">
                    <input
                      placeholder="Description"
                      value={line.description}
                      onChange={(e) => {
                        const newLines = [...lines];
                        newLines[idx].description = e.target.value;
                        setLines(newLines);
                      }}
                      className="flex-1 px-2 py-1 border rounded"
                    />
                    <input
                      type="number"
                      placeholder="Qty"
                      value={line.quantity}
                      onChange={(e) => {
                        const newLines = [...lines];
                        newLines[idx].quantity = Number(e.target.value);
                        setLines(newLines);
                      }}
                      className="w-16 px-2 py-1 border rounded"
                    />
                    <input
                      type="number"
                      placeholder="Price"
                      value={line.price}
                      onChange={(e) => {
                        const newLines = [...lines];
                        newLines[idx].price = Number(e.target.value);
                        setLines(newLines);
                      }}
                      className="w-24 px-2 py-1 border rounded"
                    />
                    <select
                      value={line.accountId}
                      onChange={(e) => {
                        const newLines = [...lines];
                        newLines[idx].accountId = e.target.value;
                        setLines(newLines);
                      }}
                      className="w-48 px-2 py-1 border rounded text-sm"
                    >
                      <option value="">Select account...</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code} - {a.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
                <button
                  onClick={() =>
                    setLines([...lines, { description: '', quantity: 1, price: 0, vatRate: 21, accountId: '' }])
                  }
                  className="text-sm text-blue-600"
                >
                  + Add Line
                </button>
              </div>

              <div className="border-t pt-4">
                <div className="text-right space-y-1">
                  <div>
                    Subtotal: €
                    {lines.reduce((sum, l) => sum + l.quantity * l.price, 0).toFixed(2)}
                  </div>
                  <div>
                    VAT: €
                    {lines
                      .reduce((sum, l) => sum + (l.quantity * l.price * l.vatRate) / 100, 0)
                      .toFixed(2)}
                  </div>
                  <div className="text-lg font-bold">
                    Total: €
                    {lines
                      .reduce(
                        (sum, l) => sum + l.quantity * l.price * (1 + l.vatRate / 100),
                        0
                      )
                      .toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 border rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={createInvoice}
                disabled={!selectedContact || !dueDate}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:bg-gray-400"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {showImporter && (
        <UniversalImporter
          config={salesInvoicesConfig}
          onClose={() => setShowImporter(false)}
          onComplete={() => {
            loadData();
            setShowImporter(false);
            alert('Invoices imported successfully');
          }}
        />
      )}
    </div>
  );
}
