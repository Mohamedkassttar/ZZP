import { useState, useEffect } from 'react';
import { ArrowLeft, Mail, Copy, CheckCircle, ArrowRight, FileText, Calendar, Eye } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';

type Quotation = Database['public']['Tables']['quotations']['Row'];
type Contact = Database['public']['Tables']['contacts']['Row'];
type CompanySettings = Database['public']['Tables']['company_settings']['Row'];

interface QuotationDetailProps {
  quotation: Quotation;
  onBack: () => void;
}

export function QuotationDetail({ quotation, onBack }: QuotationDetailProps) {
  const [contact, setContact] = useState<Contact | null>(null);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [converting, setConverting] = useState(false);

  useEffect(() => {
    loadData();
  }, [quotation.id]);

  async function loadData() {
    try {
      if (quotation.contact_id) {
        const { data: contactData } = await supabase
          .from('contacts')
          .select('*')
          .eq('id', quotation.contact_id)
          .maybeSingle();

        if (contactData) setContact(contactData);
      }

      if (quotation.company_id) {
        const { data: settings } = await supabase
          .from('company_settings')
          .select('*')
          .eq('company_id', quotation.company_id)
          .maybeSingle();

        if (settings) setCompanySettings(settings);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function copyPublicLink() {
    const baseUrl = window.location.origin;
    const publicLink = `${baseUrl}/quote/${quotation.id}/approve?token=${quotation.public_token}`;

    try {
      await navigator.clipboard.writeText(publicLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Error copying link:', error);
    }
  }

  async function convertToInvoice() {
    if (!confirm('Wil je deze offerte omzetten naar een factuur?')) return;

    setConverting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Niet ingelogd');

      const invoiceNumber = `INV-${Date.now()}`;
      const items = Array.isArray(quotation.items) ? quotation.items : [];

      const invoiceData = {
        company_id: quotation.company_id,
        contact_id: quotation.contact_id,
        invoice_number: invoiceNumber,
        date: new Date().toISOString().split('T')[0],
        due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'draft',
        items: items,
        subtotal: quotation.subtotal,
        vat_amount: quotation.vat_amount,
        total_amount: quotation.total_amount,
        notes: quotation.notes || `Gebaseerd op offerte ${quotation.quote_number}`,
      };

      const { data: newInvoice, error: invoiceError } = await supabase
        .from('sales_invoices')
        .insert([invoiceData])
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      const { data: companyUsers } = await supabase
        .from('company_users')
        .select('user_id')
        .eq('company_id', quotation.company_id);

      if (companyUsers && companyUsers.length > 0) {
        const notifications = companyUsers.map(cu => ({
          user_id: cu.user_id,
          company_id: quotation.company_id,
          type: 'system',
          title: 'Factuur Aangemaakt',
          message: `Offerte ${quotation.quote_number} is omgezet naar factuur ${invoiceNumber}.`,
          reference_id: newInvoice.id,
          reference_type: 'invoice',
          is_read: false,
        }));

        await supabase.from('notifications').insert(notifications);
      }

      alert(`Factuur ${invoiceNumber} is succesvol aangemaakt!`);
      onBack();
    } catch (error: any) {
      console.error('Error converting to invoice:', error);
      alert('Fout bij omzetten naar factuur: ' + error.message);
    } finally {
      setConverting(false);
    }
  }

  const items = Array.isArray(quotation.items) ? quotation.items : [];
  const validUntilDate = quotation.valid_until ? new Date(quotation.valid_until) : null;
  const isExpired = validUntilDate ? validUntilDate < new Date() : false;

  function getStatusColor(status: string) {
    switch (status) {
      case 'draft':
        return 'bg-slate-100 text-slate-800';
      case 'sent':
        return 'bg-blue-100 text-blue-800';
      case 'accepted':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'expired':
        return 'bg-amber-100 text-amber-800';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Terug naar Overzicht</span>
      </button>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm mb-6">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 mb-2">{quotation.quote_number}</h1>
              <p className="text-slate-600">{contact?.company_name || 'Onbekende klant'}</p>
            </div>
            <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${getStatusColor(quotation.status)}`}>
              {quotation.status === 'accepted' && <CheckCircle className="w-4 h-4" />}
              {quotation.status.charAt(0).toUpperCase() + quotation.status.slice(1)}
            </span>
          </div>

          {quotation.status === 'accepted' && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
              <div className="flex items-center gap-3 mb-3">
                <CheckCircle className="w-6 h-6 text-green-600" />
                <div>
                  <p className="font-semibold text-green-900">Offerte Geaccepteerd!</p>
                  {quotation.accepted_at && (
                    <p className="text-sm text-green-700">
                      Geaccepteerd op {new Date(quotation.accepted_at).toLocaleDateString('nl-NL')}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={convertToInvoice}
                disabled={converting}
                className="w-full bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors font-bold text-lg flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {converting ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  <>
                    <ArrowRight className="w-5 h-5" />
                    Omzetten naar Factuur
                  </>
                )}
              </button>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              onClick={copyPublicLink}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              {copied ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Gekopieerd!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Kopieer Publieke Link
                </>
              )}
            </button>
            {contact?.email && (
              <button className="flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium">
                <Mail className="w-4 h-4" />
                Verstuur per Email
              </button>
            )}
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-2 gap-6 mb-8 pb-8 border-b border-slate-200">
            <div>
              <p className="text-sm text-slate-500 mb-1">Offertedatum</p>
              <p className="font-semibold text-slate-900 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {new Date(quotation.date).toLocaleDateString('nl-NL')}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500 mb-1">Geldig tot</p>
              <p className={`font-semibold flex items-center gap-2 ${isExpired ? 'text-red-600' : 'text-slate-900'}`}>
                <Calendar className="w-4 h-4" />
                {validUntilDate?.toLocaleDateString('nl-NL')}
                {isExpired && <span className="text-xs">(Verlopen)</span>}
              </p>
            </div>
          </div>

          {companySettings && (
            <div className="mb-8 pb-8 border-b border-slate-200">
              <h3 className="font-semibold text-slate-900 mb-3">Van:</h3>
              <p className="font-medium text-slate-900">{companySettings.company_name}</p>
              {companySettings.address && <p className="text-sm text-slate-600">{companySettings.address}</p>}
              {companySettings.postal_code && companySettings.city && (
                <p className="text-sm text-slate-600">
                  {companySettings.postal_code} {companySettings.city}
                </p>
              )}
            </div>
          )}

          {contact && (
            <div className="mb-8 pb-8 border-b border-slate-200">
              <h3 className="font-semibold text-slate-900 mb-3">Aan:</h3>
              <p className="font-medium text-slate-900">{contact.company_name}</p>
              {contact.contact_person && <p className="text-sm text-slate-600">{contact.contact_person}</p>}
              {contact.email && <p className="text-sm text-slate-600">{contact.email}</p>}
              {contact.address && <p className="text-sm text-slate-600">{contact.address}</p>}
              {contact.postal_code && contact.city && (
                <p className="text-sm text-slate-600">
                  {contact.postal_code} {contact.city}
                </p>
              )}
            </div>
          )}

          {items.length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Specificatie</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">
                        Omschrijving
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-slate-900">
                        Aantal
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-slate-900">
                        Prijs
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-slate-900">
                        Totaal
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {items.map((item: any, index: number) => (
                      <tr key={index}>
                        <td className="px-4 py-3 text-sm text-slate-700">
                          <div className="font-medium">{item.description}</div>
                          {item.details && (
                            <div className="text-xs text-slate-500 mt-1">{item.details}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-slate-700">
                          {item.quantity}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-slate-700">
                          €{Number(item.price).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-slate-900">
                          €{(Number(item.quantity) * Number(item.price)).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex justify-end mb-8">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-sm text-slate-600">
                <span>Subtotaal</span>
                <span>€{Number(quotation.subtotal).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm text-slate-600">
                <span>BTW (21%)</span>
                <span>€{Number(quotation.vat_amount).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xl font-bold text-slate-900 pt-2 border-t border-slate-200">
                <span>Totaal</span>
                <span>€{Number(quotation.total_amount).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {quotation.notes && (
            <div className="mb-6 p-4 bg-slate-50 rounded-lg">
              <h4 className="font-semibold text-slate-900 mb-2">Opmerkingen</h4>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{quotation.notes}</p>
            </div>
          )}

          {quotation.terms && (
            <div className="p-4 bg-slate-50 rounded-lg">
              <h4 className="font-semibold text-slate-900 mb-2">Voorwaarden</h4>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{quotation.terms}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
