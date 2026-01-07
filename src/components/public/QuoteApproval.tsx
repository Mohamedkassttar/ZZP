import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, FileText, Calendar, Building2, Mail, Phone } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Database } from '../../lib/database.types';

type Quotation = Database['public']['Tables']['quotations']['Row'];
type Contact = Database['public']['Tables']['contacts']['Row'];
type CompanySettings = Database['public']['Tables']['company_settings']['Row'];

interface QuoteApprovalProps {
  quoteId: string;
  token: string;
}

export function QuoteApproval({ quoteId, token }: QuoteApprovalProps) {
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [contact, setContact] = useState<Contact | null>(null);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [action, setAction] = useState<'accepted' | 'rejected' | null>(null);

  useEffect(() => {
    loadQuotation();
  }, [quoteId, token]);

  async function loadQuotation() {
    try {
      setLoading(true);
      setError(null);

      const { data: quote, error: quoteError } = await supabase
        .from('quotations')
        .select('*')
        .eq('id', quoteId)
        .eq('public_token', token)
        .maybeSingle();

      if (quoteError) throw quoteError;
      if (!quote) {
        setError('Offerte niet gevonden of link is verlopen.');
        return;
      }

      if (quote.status === 'accepted') {
        setSuccess(true);
        setAction('accepted');
      } else if (quote.status === 'rejected') {
        setAction('rejected');
      }

      setQuotation(quote);

      if (quote.contact_id) {
        const { data: contactData } = await supabase
          .from('contacts')
          .select('*')
          .eq('id', quote.contact_id)
          .maybeSingle();

        if (contactData) setContact(contactData);
      }

      if (quote.company_id) {
        const { data: settings } = await supabase
          .from('company_settings')
          .select('*')
          .eq('company_id', quote.company_id)
          .maybeSingle();

        if (settings) setCompanySettings(settings);
      }
    } catch (err: any) {
      console.error('Error loading quotation:', err);
      setError('Er is een fout opgetreden bij het laden van de offerte.');
    } finally {
      setLoading(false);
    }
  }

  async function handleApproval(approved: boolean) {
    if (!quotation) return;

    setProcessing(true);
    try {
      const newStatus = approved ? 'accepted' : 'rejected';
      const now = new Date().toISOString();

      const { error: updateError } = await supabase
        .from('quotations')
        .update({
          status: newStatus,
          accepted_at: approved ? now : null,
          updated_at: now,
        })
        .eq('id', quotation.id)
        .eq('public_token', token);

      if (updateError) throw updateError;

      const { data: companyUsers } = await supabase
        .from('company_users')
        .select('user_id')
        .eq('company_id', quotation.company_id);

      if (companyUsers && companyUsers.length > 0) {
        const notifications = companyUsers.map(cu => ({
          user_id: cu.user_id,
          company_id: quotation.company_id,
          type: approved ? 'quote_accepted' : 'quote_rejected',
          title: approved ? 'Offerte Geaccepteerd' : 'Offerte Afgewezen',
          message: `Offerte ${quotation.quote_number} is ${approved ? 'geaccepteerd' : 'afgewezen'} door ${contact?.company_name || 'de klant'}.`,
          reference_id: quotation.id,
          reference_type: 'quotation',
          is_read: false,
        }));

        await supabase.from('notifications').insert(notifications);
      }

      setSuccess(true);
      setAction(approved ? 'accepted' : 'rejected');
      setQuotation({ ...quotation, status: newStatus });
    } catch (err: any) {
      console.error('Error updating quotation:', err);
      setError('Er is een fout opgetreden. Probeer het opnieuw.');
    } finally {
      setProcessing(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Offerte laden...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-slate-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Fout</h1>
          <p className="text-slate-600">{error}</p>
        </div>
      </div>
    );
  }

  if (success && action === 'accepted') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-slate-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Bedankt!</h1>
          <p className="text-slate-600 mb-6">
            Uw akkoord is ontvangen. Wij gaan direct voor u aan de slag.
          </p>
          {companySettings && (
            <div className="text-sm text-slate-500">
              Voor vragen kunt u contact opnemen met {companySettings.company_name}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (action === 'rejected') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-8 h-8 text-slate-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Offerte Afgewezen</h1>
          <p className="text-slate-600 mb-6">
            Deze offerte is afgewezen. Neem contact op voor aanpassingen.
          </p>
          {companySettings && (
            <div className="text-sm text-slate-500">
              Contact: {companySettings.company_name}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!quotation) return null;

  const items = Array.isArray(quotation.items) ? quotation.items : [];
  const validUntilDate = quotation.valid_until ? new Date(quotation.valid_until) : null;
  const isExpired = validUntilDate ? validUntilDate < new Date() : false;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 py-12 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-8">
            <div className="flex items-center gap-3 mb-4">
              <FileText className="w-8 h-8" />
              <h1 className="text-3xl font-bold">Offerte</h1>
            </div>
            <p className="text-blue-100">Offerte nummer: {quotation.quote_number}</p>
          </div>

          <div className="p-8">
            {companySettings && (
              <div className="mb-8 pb-8 border-b border-slate-200">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 mb-2">
                      {companySettings.company_name}
                    </h2>
                    {companySettings.address && (
                      <p className="text-sm text-slate-600">{companySettings.address}</p>
                    )}
                    {companySettings.postal_code && companySettings.city && (
                      <p className="text-sm text-slate-600">
                        {companySettings.postal_code} {companySettings.city}
                      </p>
                    )}
                    {companySettings.email && (
                      <p className="text-sm text-slate-600 flex items-center gap-2 mt-2">
                        <Mail className="w-4 h-4" />
                        {companySettings.email}
                      </p>
                    )}
                    {companySettings.phone && (
                      <p className="text-sm text-slate-600 flex items-center gap-2">
                        <Phone className="w-4 h-4" />
                        {companySettings.phone}
                      </p>
                    )}
                  </div>
                  {contact && (
                    <div className="text-right">
                      <p className="text-sm text-slate-500 mb-1">Voor:</p>
                      <p className="font-semibold text-slate-900">{contact.company_name}</p>
                      {contact.contact_person && (
                        <p className="text-sm text-slate-600">{contact.contact_person}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

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
                <div className="flex justify-between text-lg font-bold text-slate-900 pt-2 border-t border-slate-200">
                  <span>Totaal</span>
                  <span>€{Number(quotation.total_amount).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {quotation.notes && (
              <div className="mb-8 p-4 bg-slate-50 rounded-lg">
                <h4 className="font-semibold text-slate-900 mb-2">Opmerkingen</h4>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{quotation.notes}</p>
              </div>
            )}

            {quotation.terms && (
              <div className="mb-8 p-4 bg-slate-50 rounded-lg">
                <h4 className="font-semibold text-slate-900 mb-2">Voorwaarden</h4>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{quotation.terms}</p>
              </div>
            )}

            {quotation.status === 'sent' && !isExpired && (
              <div className="flex gap-4">
                <button
                  onClick={() => handleApproval(true)}
                  disabled={processing}
                  className="flex-1 bg-green-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                >
                  {processing ? (
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                  ) : (
                    <>
                      <CheckCircle className="w-6 h-6" />
                      Offerte Accepteren
                    </>
                  )}
                </button>
                <button
                  onClick={() => handleApproval(false)}
                  disabled={processing}
                  className="px-8 py-4 border-2 border-slate-300 text-slate-700 rounded-xl font-bold text-lg hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                >
                  <XCircle className="w-5 h-5" />
                  Afwijzen
                </button>
              </div>
            )}

            {isExpired && quotation.status === 'sent' && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                <p className="text-red-800 font-semibold">
                  Deze offerte is verlopen. Neem contact op voor een nieuwe offerte.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
