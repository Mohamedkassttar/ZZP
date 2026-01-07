import { X, Printer } from 'lucide-react';
import type { Database } from '../lib/database.types';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

type Invoice = Database['public']['Tables']['invoices']['Row'];
type SalesInvoice = Database['public']['Tables']['sales_invoices']['Row'];
type InvoiceLine = Database['public']['Tables']['invoice_lines']['Row'];
type Contact = Database['public']['Tables']['contacts']['Row'];

interface InvoicePreviewModalProps {
  invoiceId?: string;
  invoice?: Invoice | SalesInvoice;
  tableName?: 'invoices' | 'sales_invoices';
  isOpen?: boolean;
  onClose: () => void;
}

interface CompanySettings {
  company_name: string;
  address: string;
  postal_code: string;
  city: string;
  phone: string;
  email: string;
  vat_number: string;
  kvk_number: string;
  bank_account: string;
}

export function InvoicePreviewModal({ invoiceId, invoice: invoiceProp, tableName = 'invoices', isOpen = true, onClose }: InvoicePreviewModalProps) {
  const [invoice, setInvoice] = useState<Invoice | SalesInvoice | null>(invoiceProp || null);
  const [invoiceLines, setInvoiceLines] = useState<InvoiceLine[]>([]);
  const [contact, setContact] = useState<Contact | null>(null);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && (invoiceId || invoiceProp)) {
      loadInvoiceData();
    }
  }, [isOpen, invoiceId, invoiceProp, tableName]);

  async function loadInvoiceData() {
    setLoading(true);
    try {
      let currentInvoice = invoiceProp;

      if (invoiceId && !currentInvoice) {
        const { data: invoiceData, error: invoiceError } = await supabase
          .from(tableName)
          .select('*')
          .eq('id', invoiceId)
          .maybeSingle();

        if (invoiceError) throw invoiceError;
        currentInvoice = invoiceData;
        setInvoice(invoiceData);
      }

      if (!currentInvoice) {
        throw new Error('No invoice found');
      }

      const [linesRes, contactRes, settingsRes] = await Promise.all([
        supabase
          .from('invoice_lines')
          .select('*')
          .eq('invoice_id', currentInvoice.id)
          .order('line_order'),
        currentInvoice.contact_id ? supabase
          .from('contacts')
          .select('*')
          .eq('id', currentInvoice.contact_id)
          .maybeSingle() : Promise.resolve({ data: null, error: null }),
        supabase
          .from('company_settings')
          .select('*')
          .maybeSingle()
      ]);

      if (linesRes.data) {
        setInvoiceLines(linesRes.data);
      }

      if (contactRes.data) {
        setContact(contactRes.data);
      }

      if (settingsRes.data) {
        setCompanySettings(settingsRes.data as CompanySettings);
      }
    } catch (error) {
      console.error('Error loading invoice data:', error);
    } finally {
      setLoading(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  if (!isOpen) return null;
  if (!invoice) return null;

  const isSalesInvoice = tableName === 'sales_invoices';
  const invoiceDate = isSalesInvoice ? (invoice as SalesInvoice).date : (invoice as Invoice).invoice_date;
  const dueDate = isSalesInvoice
    ? (invoiceDate ? new Date(new Date(invoiceDate).getTime() + 30 * 24 * 60 * 60 * 1000) : new Date())
    : ((invoice as Invoice).due_date ? new Date((invoice as Invoice).due_date) : new Date(invoiceDate));

  const subtotal = isSalesInvoice
    ? (Number(invoice.total_amount || 0) - Number(invoice.vat_amount || 0))
    : Number((invoice as Invoice).subtotal || 0);
  const vatAmount = Number(invoice.vat_amount || 0);
  const total = Number(invoice.total_amount || 0);

  interface VATBreakdown {
    rate: number;
    netAmount: number;
    vatAmount: number;
  }

  const vatBreakdown: { [key: string]: VATBreakdown } = {};
  invoiceLines.forEach(line => {
    const rate = Number(line.vat_rate || 0);
    const rateKey = rate.toString();

    if (!vatBreakdown[rateKey]) {
      vatBreakdown[rateKey] = {
        rate,
        netAmount: 0,
        vatAmount: 0
      };
    }

    vatBreakdown[rateKey].netAmount += Number(line.amount || 0);
    vatBreakdown[rateKey].vatAmount += Number(line.vat_amount || 0);
  });

  const vatBreakdownArray = Object.values(vatBreakdown).sort((a, b) => b.rate - a.rate);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 overflow-y-auto print:bg-white print:block print:p-0">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[95vh] overflow-hidden flex flex-col print:shadow-none print:max-w-none print:max-h-none print:rounded-none">
        <div className="flex items-center justify-between p-4 border-b border-slate-200 print:hidden">
          <h2 className="text-xl font-bold text-slate-900">Factuur Preview</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              <Printer className="w-4 h-4" />
              Afdrukken
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 print:p-12 print:overflow-visible">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto bg-white print:max-w-none">
              <div className="mb-12">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h1 className="text-5xl font-bold text-slate-900 mb-2">FACTUUR</h1>
                  </div>
                  {companySettings && (
                    <div className="text-right">
                      <h2 className="text-xl font-bold text-slate-900 mb-3">{companySettings.company_name}</h2>
                      <div className="text-sm text-slate-600 space-y-0.5">
                        <p>{companySettings.address}</p>
                        <p>{companySettings.postal_code} {companySettings.city}</p>
                        <p className="mt-2">{companySettings.phone}</p>
                        <p>{companySettings.email}</p>
                      </div>
                      <div className="mt-3 pt-3 border-t border-slate-200 text-xs text-slate-500 space-y-0.5">
                        {companySettings.kvk_number && (
                          <p>KvK-nr: {companySettings.kvk_number}</p>
                        )}
                        {companySettings.vat_number && (
                          <p>BTW-nr: {companySettings.vat_number}</p>
                        )}
                        {companySettings.bank_account && (
                          <p>IBAN: {companySettings.bank_account}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8 mb-12">
                <div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Factuur aan</h3>
                  {contact ? (
                    <div className="text-slate-900">
                      <p className="font-bold text-lg mb-1">{contact.company_name}</p>
                      {contact.contact_person && (
                        <p className="text-slate-700 mb-2">T.a.v. {contact.contact_person}</p>
                      )}
                      {contact.address && (
                        <>
                          <p className="text-slate-700">{contact.address}</p>
                          <p className="text-slate-700">{contact.postal_code} {contact.city}</p>
                        </>
                      )}
                      {contact.vat_number && (
                        <p className="text-slate-700 text-sm mt-2">BTW-nr: {contact.vat_number}</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-slate-500 italic">Contactgegevens niet beschikbaar</p>
                  )}
                </div>

                <div className="text-right">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Facturatiegegevens</h3>
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs text-slate-500">Factuurnummer</p>
                      <p className="font-bold text-slate-900">{invoice.invoice_number}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Factuurdatum</p>
                      <p className="font-semibold text-slate-900">{invoiceDate ? new Date(invoiceDate).toLocaleDateString('nl-NL') : 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Vervaldatum</p>
                      <p className="font-semibold text-slate-900">{dueDate.toLocaleDateString('nl-NL')}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mb-10">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-slate-900">
                      <th className="text-left py-3 text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Omschrijving
                      </th>
                      <th className="text-center py-3 text-xs font-bold text-slate-900 uppercase tracking-wider w-20">
                        Aantal
                      </th>
                      <th className="text-right py-3 text-xs font-bold text-slate-900 uppercase tracking-wider w-24">
                        Prijs
                      </th>
                      <th className="text-right py-3 text-xs font-bold text-slate-900 uppercase tracking-wider w-20">
                        BTW
                      </th>
                      <th className="text-right py-3 text-xs font-bold text-slate-900 uppercase tracking-wider w-28">
                        Totaal
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoiceLines.map((line, index) => (
                      <tr key={line.id} className={index !== invoiceLines.length - 1 ? "border-b border-slate-200" : ""}>
                        <td className="py-4 text-slate-900">
                          {line.description}
                        </td>
                        <td className="text-center py-4 text-slate-700">
                          {Number(line.quantity).toFixed(0)}
                        </td>
                        <td className="text-right py-4 text-slate-700">
                          €{Number(line.unit_price).toFixed(2)}
                        </td>
                        <td className="text-right py-4 text-slate-700">
                          {Number(line.vat_rate).toFixed(0)}%
                        </td>
                        <td className="text-right py-4 font-semibold text-slate-900">
                          €{(Number(line.amount) + Number(line.vat_amount)).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end mb-12">
                <div className="w-96">
                  <div className="space-y-2.5 mb-4">
                    <div className="flex justify-between text-slate-700">
                      <span>Subtotaal (excl. BTW)</span>
                      <span className="font-medium">€{subtotal.toFixed(2)}</span>
                    </div>
                  </div>

                  {vatBreakdownArray.length > 0 && (
                    <div className="border-t border-slate-300 pt-3 mb-3">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">BTW Specificatie</p>
                      {vatBreakdownArray.map((vat) => (
                        <div key={vat.rate} className="flex justify-between text-sm text-slate-700 mb-1.5">
                          <span>BTW {vat.rate}% over €{vat.netAmount.toFixed(2)}</span>
                          <span className="font-medium">€{vat.vatAmount.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex justify-between pt-4 border-t-2 border-slate-900">
                    <span className="text-xl font-bold text-slate-900">Totaal (incl. BTW)</span>
                    <span className="text-xl font-bold text-slate-900">€{total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-300 pt-8 mb-8">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4">Betaalinformatie</h3>
                <div className="bg-slate-50 rounded-lg p-5 grid grid-cols-3 gap-4">
                  {companySettings?.bank_account && (
                    <div>
                      <p className="text-xs text-slate-500 mb-1">IBAN</p>
                      <p className="text-sm font-semibold text-slate-900">{companySettings.bank_account}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Betalingskenmerk</p>
                    <p className="text-sm font-semibold text-slate-900">{invoice.invoice_number}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Vervaldatum</p>
                    <p className="text-sm font-semibold text-slate-900">{dueDate.toLocaleDateString('nl-NL')}</p>
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-3 italic">
                  Gelieve het betalingskenmerk te vermelden bij uw betaling.
                </p>
              </div>

              {invoice.notes && (
                <div className="border-t border-slate-300 pt-6 mb-8">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">Opmerkingen</h3>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{invoice.notes}</p>
                </div>
              )}

              <div className="mt-16 pt-6 border-t border-slate-200 text-center">
                <p className="text-xs text-slate-500">Bedankt voor uw vertrouwen</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
