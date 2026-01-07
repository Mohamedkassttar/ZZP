import { useState, useEffect } from 'react';
import { FileText, Plus, Eye, Mail, CheckCircle, XCircle, Clock, ArrowRight, Copy, Edit2, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { QuotationDetail } from './QuotationDetail';
import type { Database } from '../lib/database.types';

type Quotation = Database['public']['Tables']['quotations']['Row'];
type Contact = Database['public']['Tables']['contacts']['Row'];

export function Quotations() {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedQuote, setSelectedQuote] = useState<Quotation | null>(null);
  const [filter, setFilter] = useState<'all' | 'draft' | 'sent' | 'accepted'>('all');

  useEffect(() => {
    loadData();
  }, [filter]);

  async function loadData() {
    try {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: companyUsers } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      if (!companyUsers?.company_id) return;

      let query = supabase
        .from('quotations')
        .select('*')
        .eq('company_id', companyUsers.company_id)
        .order('date', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data: quotesData, error: quotesError } = await query;
      if (quotesError) throw quotesError;

      const { data: contactsData } = await supabase
        .from('contacts')
        .select('*')
        .eq('company_id', companyUsers.company_id);

      setQuotations(quotesData || []);
      setContacts(contactsData || []);
    } catch (error) {
      console.error('Error loading quotations:', error);
    } finally {
      setLoading(false);
    }
  }

  function getContactName(contactId: string | null) {
    if (!contactId) return 'Onbekend';
    const contact = contacts.find(c => c.id === contactId);
    return contact?.company_name || 'Onbekend';
  }

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

  function getStatusIcon(status: string) {
    switch (status) {
      case 'accepted':
        return <CheckCircle className="w-4 h-4" />;
      case 'rejected':
        return <XCircle className="w-4 h-4" />;
      case 'sent':
        return <Mail className="w-4 h-4" />;
      case 'draft':
        return <Edit2 className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  }

  function getStatusText(status: string) {
    switch (status) {
      case 'draft':
        return 'Concept';
      case 'sent':
        return 'Verzonden';
      case 'accepted':
        return 'Geaccepteerd';
      case 'rejected':
        return 'Afgewezen';
      case 'expired':
        return 'Verlopen';
      default:
        return status;
    }
  }

  if (selectedQuote) {
    return (
      <QuotationDetail
        quotation={selectedQuote}
        onBack={() => {
          setSelectedQuote(null);
          loadData();
        }}
      />
    );
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-xl">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Offertes</h1>
              <p className="text-sm text-slate-600">{quotations.length} offertes</p>
            </div>
          </div>
          <button className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium">
            <Plus className="w-5 h-5" />
            Nieuwe Offerte
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button
            onClick={() => setFilter('all')}
            className={`p-6 rounded-lg border-2 transition-all ${
              filter === 'all'
                ? 'border-blue-600 bg-blue-50 shadow-md'
                : 'border-slate-200 bg-white hover:border-blue-300 hover:shadow-sm'
            }`}
          >
            <div className="flex items-center justify-center mb-3">
              <FileText className={`w-8 h-8 ${filter === 'all' ? 'text-blue-600' : 'text-slate-400'}`} />
            </div>
            <h3 className={`text-center font-semibold ${filter === 'all' ? 'text-blue-900' : 'text-slate-900'}`}>
              Alle
            </h3>
            <p className="text-center text-sm text-slate-500 mt-1">
              {quotations.length} offertes
            </p>
          </button>

          <button
            onClick={() => setFilter('draft')}
            className={`p-6 rounded-lg border-2 transition-all ${
              filter === 'draft'
                ? 'border-blue-600 bg-blue-50 shadow-md'
                : 'border-slate-200 bg-white hover:border-blue-300 hover:shadow-sm'
            }`}
          >
            <div className="flex items-center justify-center mb-3">
              <Edit2 className={`w-8 h-8 ${filter === 'draft' ? 'text-blue-600' : 'text-slate-400'}`} />
            </div>
            <h3 className={`text-center font-semibold ${filter === 'draft' ? 'text-blue-900' : 'text-slate-900'}`}>
              Concept
            </h3>
            <p className="text-center text-sm text-slate-500 mt-1">
              {quotations.filter(q => q.status === 'draft').length} offertes
            </p>
          </button>

          <button
            onClick={() => setFilter('sent')}
            className={`p-6 rounded-lg border-2 transition-all ${
              filter === 'sent'
                ? 'border-blue-600 bg-blue-50 shadow-md'
                : 'border-slate-200 bg-white hover:border-blue-300 hover:shadow-sm'
            }`}
          >
            <div className="flex items-center justify-center mb-3">
              <Mail className={`w-8 h-8 ${filter === 'sent' ? 'text-blue-600' : 'text-slate-400'}`} />
            </div>
            <h3 className={`text-center font-semibold ${filter === 'sent' ? 'text-blue-900' : 'text-slate-900'}`}>
              Verzonden
            </h3>
            <p className="text-center text-sm text-slate-500 mt-1">
              {quotations.filter(q => q.status === 'sent').length} offertes
            </p>
          </button>

          <button
            onClick={() => setFilter('accepted')}
            className={`p-6 rounded-lg border-2 transition-all ${
              filter === 'accepted'
                ? 'border-blue-600 bg-blue-50 shadow-md'
                : 'border-slate-200 bg-white hover:border-blue-300 hover:shadow-sm'
            }`}
          >
            <div className="flex items-center justify-center mb-3">
              <CheckCircle className={`w-8 h-8 ${filter === 'accepted' ? 'text-blue-600' : 'text-slate-400'}`} />
            </div>
            <h3 className={`text-center font-semibold ${filter === 'accepted' ? 'text-blue-900' : 'text-slate-900'}`}>
              Geaccepteerd
            </h3>
            <p className="text-center text-sm text-slate-500 mt-1">
              {quotations.filter(q => q.status === 'accepted').length} offertes
            </p>
          </button>
        </div>
      </div>

      {quotations.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-slate-900 mb-2">Geen offertes</h3>
          <p className="text-slate-600 mb-6">
            {filter === 'all'
              ? 'Je hebt nog geen offertes aangemaakt.'
              : `Geen offertes met status "${getStatusText(filter)}".`}
          </p>
          <button className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium">
            Eerste Offerte Maken
          </button>
        </div>
      ) : (
        <>
          {/* MOBILE VIEW - Cards */}
          <div className="block md:hidden space-y-3">
            {quotations.map((quote) => (
              <div
                key={quote.id}
                className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <button
                      onClick={() => setSelectedQuote(quote)}
                      className="text-lg font-bold text-blue-600 hover:text-blue-800 truncate block"
                    >
                      {quote.quote_number}
                    </button>
                    <p className="text-sm text-slate-600 mt-1 truncate">{getContactName(quote.contact_id)}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(quote.status)} flex-shrink-0 ml-2`}>
                    {getStatusIcon(quote.status)}
                    {getStatusText(quote.status)}
                  </span>
                </div>

                <div className="space-y-2 mb-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Datum:</span>
                    <span className="text-slate-900 font-medium">{new Date(quote.date).toLocaleDateString('nl-NL')}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Geldig tot:</span>
                    <span className="text-slate-900 font-medium">{new Date(quote.valid_until).toLocaleDateString('nl-NL')}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                    <span className="text-slate-500 font-medium">Bedrag:</span>
                    <span className="text-2xl font-black text-blue-600">€{Number(quote.total_amount).toFixed(2)}</span>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedQuote(quote)}
                  className="w-full flex items-center justify-center gap-2 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors font-medium"
                >
                  <Eye className="w-4 h-4" />
                  Bekijken
                </button>
              </div>
            ))}
          </div>

          {/* DESKTOP VIEW - Cards Grid */}
          <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {quotations.map((quote) => (
              <div
                key={quote.id}
                className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-lg transition-all duration-200 overflow-hidden group cursor-pointer"
                onClick={() => setSelectedQuote(quote)}
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xl font-bold text-blue-600 group-hover:text-blue-700 truncate">
                        {quote.quote_number}
                      </h3>
                      <p className="text-sm text-slate-600 mt-1 truncate">{getContactName(quote.contact_id)}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(quote.status)} flex-shrink-0 ml-2`}>
                      {getStatusIcon(quote.status)}
                      {getStatusText(quote.status)}
                    </span>
                  </div>

                  <div className="space-y-3 mb-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">Datum:</span>
                      <span className="text-slate-900 font-medium">{new Date(quote.date).toLocaleDateString('nl-NL')}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">Geldig tot:</span>
                      <span className="text-slate-900 font-medium">{new Date(quote.valid_until).toLocaleDateString('nl-NL')}</span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-200">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-700">Totaal Bedrag</span>
                      <span className="text-2xl font-black text-blue-600">
                        €{Number(quote.total_amount).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 px-6 py-3 flex items-center justify-between border-t border-slate-200">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedQuote(quote);
                    }}
                    className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                    Bekijken
                  </button>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
