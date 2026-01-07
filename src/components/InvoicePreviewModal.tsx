import { X, Printer } from 'lucide-react';
import type { Database } from '../lib/database.types';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

type SalesInvoice = Database['public']['Tables']['sales_invoices']['Row'];
type Contact = Database['public']['Tables']['contacts']['Row'];

interface InvoicePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: SalesInvoice;
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

export function InvoicePreviewModal({ isOpen, onClose, invoice }: InvoicePreviewModalProps) {
  const [contact, setContact] = useState<Contact | null>(null);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && invoice) {
      loadInvoiceData();
    }
  }, [isOpen, invoice]);

  async function loadInvoiceData() {
    setLoading(true);
    try {
      const [contactRes, settingsRes] = await Promise.all([
        supabase
          .from('contacts')
          .select('*')
          .eq('id', invoice.contact_id)
          .maybeSingle(),
        supabase
          .from('company_settings')
          .select('*')
          .maybeSingle()
      ]);

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

  const subtotal = Number(invoice.total_amount) - Number(invoice.vat_amount || 0);
  const dueDate = new Date(invoice.date);
  dueDate.setDate(dueDate.getDate() + 14);

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
            <div className="max-w-3xl mx-auto bg-white print:max-w-none">
              <div className="flex justify-between items-start mb-12">
                <div>
                  <h1 className="text-4xl font-bold text-slate-900 mb-2">FACTUUR</h1>
                  <p className="text-slate-600">
                    Factuurnummer: <span className="font-semibold text-slate-900">{invoice.invoice_number}</span>
                  </p>
                  <p className="text-slate-600">
                    Datum: <span className="font-semibold text-slate-900">{new Date(invoice.date).toLocaleDateString('nl-NL')}</span>
                  </p>
                  <p className="text-slate-600">
                    Vervaldatum: <span className="font-semibold text-slate-900">{dueDate.toLocaleDateString('nl-NL')}</span>
                  </p>
                </div>
                {companySettings && (
                  <div className="text-right">
                    <h2 className="text-xl font-bold text-slate-900 mb-2">{companySettings.company_name}</h2>
                    <p className="text-sm text-slate-600">{companySettings.address}</p>
                    <p className="text-sm text-slate-600">{companySettings.postal_code} {companySettings.city}</p>
                    <p className="text-sm text-slate-600 mt-2">{companySettings.phone}</p>
                    <p className="text-sm text-slate-600">{companySettings.email}</p>
                    {companySettings.kvk_number && (
                      <p className="text-sm text-slate-600 mt-2">KvK: {companySettings.kvk_number}</p>
                    )}
                    {companySettings.vat_number && (
                      <p className="text-sm text-slate-600">BTW: {companySettings.vat_number}</p>
                    )}
                  </div>
                )}
              </div>

              <div className="mb-12">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">Factuur aan:</h3>
                {contact ? (
                  <div className="bg-slate-50 rounded-lg p-4">
                    <p className="font-semibold text-slate-900 text-lg mb-1">{contact.company_name}</p>
                    {contact.contact_person && (
                      <p className="text-slate-700">T.a.v. {contact.contact_person}</p>
                    )}
                    {contact.address && (
                      <>
                        <p className="text-slate-700">{contact.address}</p>
                        <p className="text-slate-700">{contact.postal_code} {contact.city}</p>
                      </>
                    )}
                    {contact.vat_number && (
                      <p className="text-slate-700 mt-2">BTW-nummer: {contact.vat_number}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-slate-500 italic">Contactgegevens niet beschikbaar</p>
                )}
              </div>

              <div className="mb-8">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b-2 border-slate-300">
                      <th className="text-left py-3 px-2 text-sm font-semibold text-slate-700 uppercase tracking-wide">
                        Omschrijving
                      </th>
                      <th className="text-right py-3 px-2 text-sm font-semibold text-slate-700 uppercase tracking-wide">
                        Bedrag
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-200">
                      <td className="py-4 px-2 text-slate-900">
                        Dienstverlening
                      </td>
                      <td className="text-right py-4 px-2 font-medium text-slate-900">
                        €{subtotal.toFixed(2)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end mb-12">
                <div className="w-80">
                  <div className="space-y-2">
                    <div className="flex justify-between text-slate-700">
                      <span>Subtotaal:</span>
                      <span className="font-medium">€{subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-700">
                      <span>BTW (21%):</span>
                      <span className="font-medium">€{Number(invoice.vat_amount || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between pt-3 border-t-2 border-slate-300">
                      <span className="text-lg font-bold text-slate-900">Totaal:</span>
                      <span className="text-lg font-bold text-slate-900">€{Number(invoice.total_amount).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t-2 border-slate-200 pt-8">
                <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">Betaalinformatie</h3>
                <div className="bg-blue-50 rounded-lg p-4 space-y-2">
                  {companySettings?.bank_account && (
                    <p className="text-sm text-slate-700">
                      <span className="font-semibold">IBAN:</span> {companySettings.bank_account}
                    </p>
                  )}
                  <p className="text-sm text-slate-700">
                    <span className="font-semibold">Referentie:</span> {invoice.invoice_number}
                  </p>
                  <p className="text-sm text-slate-700">
                    <span className="font-semibold">Vervaldatum:</span> {dueDate.toLocaleDateString('nl-NL')}
                  </p>
                </div>
                <p className="text-xs text-slate-500 mt-4 italic">
                  Gelieve het factuurnummer te vermelden bij de betaling.
                </p>
              </div>

              {invoice.notes && (
                <div className="mt-8 border-t border-slate-200 pt-6">
                  <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-2">Opmerkingen</h3>
                  <p className="text-sm text-slate-600">{invoice.notes}</p>
                </div>
              )}

              <div className="mt-12 text-center text-xs text-slate-500 border-t border-slate-200 pt-6">
                <p>Bedankt voor uw vertrouwen!</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
