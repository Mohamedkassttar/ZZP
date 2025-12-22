import { useState, useEffect, useRef } from 'react';
import {
  Upload,
  FileText,
  Loader,
  AlertCircle,
  CheckCircle,
  Eye,
  Trash2,
  Edit2,
  Brain,
  DollarSign,
  Calendar,
  Building2,
  CheckSquare,
  XCircle,
  BookOpen,
  Archive,
  Inbox,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { processInvoiceWithAI, bulkProcessDocuments } from '../lib/intelligentInvoiceProcessor';
import { bookInvoice } from '../lib/invoiceBookingService';
import { InvoiceReviewModal } from './InvoiceReviewModal';
import type { Database } from '../lib/database.types';
import type { EnhancedInvoiceData } from '../lib/intelligentInvoiceProcessor';

type Document = Database['public']['Tables']['documents_inbox']['Row'];
type Account = Database['public']['Tables']['accounts']['Row'];
type Contact = Database['public']['Tables']['contacts']['Row'];

interface EnhancedDocument extends Document {
  extracted?: EnhancedInvoiceData;
}

interface BookedInvoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  total_amount: number;
  status: string;
  contact: {
    company_name: string;
  };
  document?: {
    file_url: string;
    file_name: string;
  };
}

type TabType = 'inbox' | 'booked';

export function FactuurInbox() {
  const [activeTab, setActiveTab] = useState<TabType>('inbox');
  const [documents, setDocuments] = useState<EnhancedDocument[]>([]);
  const [bookedInvoices, setBookedInvoices] = useState<BookedInvoice[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [booking, setBooking] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [editingDoc, setEditingDoc] = useState<EnhancedDocument | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const loadingRef = useRef(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeToDocuments();
    return () => {
      if (unsubscribe) unsubscribe();
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [activeTab]);

  async function loadData() {
    // Prevent multiple simultaneous loads (infinite loop protection)
    if (loadingRef.current) {
      console.log('[FactuurInbox] Load already in progress, skipping...');
      return;
    }

    loadingRef.current = true;

    try {
      setError(null);

      if (activeTab === 'inbox') {
        const [docsRes, accountsRes, contactsRes] = await Promise.all([
          supabase
            .from('documents_inbox')
            .select('*')
            .in('status', ['Review_Needed', 'Processing'])
            .order('created_at', { ascending: false }),
          supabase.from('accounts').select('*').eq('is_active', true),
          supabase.from('contacts').select('*').eq('is_active', true),
        ]);

        if (docsRes.error) throw docsRes.error;
        if (accountsRes.error) throw accountsRes.error;
        if (contactsRes.error) throw contactsRes.error;

        if (docsRes.data) {
          const enrichedDocs = docsRes.data.map(doc => ({
            ...doc,
            extracted: doc.extracted_data as EnhancedInvoiceData | undefined,
          }));
          setDocuments(enrichedDocs);
        } else {
          setDocuments([]);
        }

        if (accountsRes.data) {
          const sorted = accountsRes.data.sort((a, b) =>
            parseInt(a.code) - parseInt(b.code)
          );
          setAccounts(sorted);
        } else {
          setAccounts([]);
        }

        if (contactsRes.data) {
          const sorted = contactsRes.data.sort((a, b) =>
            a.company_name.localeCompare(b.company_name)
          );
          setContacts(sorted);
        } else {
          setContacts([]);
        }
      } else {
        const { data: invoices, error: invoicesError } = await supabase
          .from('purchase_invoices')
          .select(`
            id,
            invoice_number,
            invoice_date,
            total_amount,
            status,
            contact:contacts(company_name),
            document:documents_inbox(file_url, file_name)
          `)
          .order('invoice_date', { ascending: false });

        if (invoicesError) throw invoicesError;

        setBookedInvoices(invoices as any || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      setError(error instanceof Error ? error.message : 'Er is een fout opgetreden bij het laden van data');
      setDocuments([]);
      setBookedInvoices([]);
      setAccounts([]);
      setContacts([]);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }

  function subscribeToDocuments() {
    const subscription = supabase
      .channel('factuur_inbox_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'documents_inbox' },
        () => {
          // Debounce database changes to prevent excessive re-renders
          if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
          }
          debounceTimerRef.current = setTimeout(() => {
            console.log('[FactuurInbox] Database change detected, reloading data...');
            loadData();
          }, 500); // Wait 500ms after last change before reloading
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }

  function handleDrag(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files);
    await handleFiles(files);
  }

  async function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      await handleFiles(files);
    }
  }

  async function handleFiles(files: File[]) {
    setUploading(true);

    for (const file of files) {
      // CRITICAL: Sanitize filename first - strip any directory paths
      // If file.name contains "invoices/file.pdf", we only want "file.pdf"
      const rawFileName = file.name.split('/').pop()?.split('\\').pop() || 'unknown';

      if (!file.type.match(/^(image\/(jpeg|jpg|png|webp)|application\/pdf)$/)) {
        alert(`${rawFileName}: Alleen PDF en afbeeldingen worden ondersteund`);
        continue;
      }

      if (file.size > 10 * 1024 * 1024) {
        alert(`${rawFileName}: Bestand is te groot (max 10MB)`);
        continue;
      }

      try {
        // Build clean path with timestamp
        const timestamp = Date.now();
        const uniqueFileName = `${timestamp}_${rawFileName}`;

        // Define storage structure (never trust input paths)
        const BUCKET = 'invoices';
        const FOLDER = 'invoices';
        const storagePath = `${FOLDER}/${uniqueFileName}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(storagePath, file, {
            contentType: file.type,
            upsert: false,
          });

        if (uploadError) throw uploadError;

        await supabase.from('documents_inbox').insert({
          file_url: uploadData.path,
          file_name: rawFileName,
          file_type: file.type,
          status: 'Processing',
        });
      } catch (error) {
        console.error('Error uploading file:', error);
        alert(`Fout bij uploaden van ${rawFileName}`);
      }
    }

    setUploading(false);
    await loadData();
  }

  async function handleBulkProcess() {
    const docsToProcess = (documents || [])
      .filter(doc => doc.status === 'Processing')
      .map(doc => doc.id);

    if (docsToProcess.length === 0) {
      alert('Geen documenten om te verwerken');
      return;
    }

    setProcessing(true);

    try {
      await bulkProcessDocuments(docsToProcess);
      await loadData();
    } catch (error) {
      console.error('Error processing documents:', error);
      alert('Fout bij verwerken van documenten');
    } finally {
      setProcessing(false);
    }
  }

  async function handleBookDocument(doc: EnhancedDocument) {
    if (!doc.extracted) {
      alert('Document is nog niet geanalyseerd');
      return;
    }

    const ext = doc.extracted;

    if (!ext.suggested_account_id) {
      alert('Geen categorie geselecteerd');
      return;
    }

    setBooking(doc.id);

    try {
      const result = await bookInvoice({
        documentId: doc.id,
        invoiceData: ext,
        expenseAccountId: ext.suggested_account_id,
        supplierContactId: ext.contact_id,
      });

      if (!result.success) {
        throw new Error(result.error || 'Onbekende fout');
      }

      await loadData();
      alert('Factuur succesvol geboekt!');
    } catch (error) {
      console.error('Error booking document:', error);
      alert(`Fout bij boeken: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setBooking(null);
    }
  }

  async function handleDeleteDocument(doc: Document) {
    if (!confirm('Document verwijderen?')) return;

    try {
      await supabase.from('documents_inbox').delete().eq('id', doc.id);
      await supabase.storage.from('invoices').remove([doc.file_url]);
      await loadData();
    } catch (error) {
      console.error('Error deleting document:', error);
      alert('Fout bij verwijderen');
    }
  }

  function toggleSelectDoc(docId: string) {
    const newSelected = new Set(selectedDocs);
    if (newSelected.has(docId)) {
      newSelected.delete(docId);
    } else {
      newSelected.add(docId);
    }
    setSelectedDocs(newSelected);
  }

  function getStatusBadge(status: string) {
    const styles = {
      Processing: 'bg-blue-100 text-blue-800',
      Review_Needed: 'bg-yellow-100 text-yellow-800',
      Booked: 'bg-green-100 text-green-800',
      Error: 'bg-red-100 text-red-800',
      Draft: 'bg-gray-100 text-gray-800',
      Pending: 'bg-yellow-100 text-yellow-800',
      Paid: 'bg-green-100 text-green-800',
      Overdue: 'bg-red-100 text-red-800',
    };

    const labels = {
      Processing: 'Bezig...',
      Review_Needed: 'Beoordelen',
      Booked: 'Geboekt',
      Error: 'Fout',
      Draft: 'Concept',
      Pending: 'Te betalen',
      Paid: 'Betaald',
      Overdue: 'Verlopen',
    };

    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-800'}`}>
        {labels[status as keyof typeof labels] || status}
      </span>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="w-12 h-12 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-7 h-7 text-blue-600" />
            Factuur Inbox
          </h1>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-red-900 font-semibold mb-2">Er is een fout opgetreden</h3>
              <p className="text-red-700 mb-4">{error}</p>
              <button
                onClick={() => {
                  setError(null);
                  setLoading(true);
                  loadData();
                }}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Opnieuw proberen
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-7 h-7 text-blue-600" />
            Inkoopfacturen
          </h1>
          <p className="text-gray-600 mt-1">
            Upload PDF facturen voor automatische verwerking met AI
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('inbox')}
            className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'inbox'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Inbox className="w-5 h-5" />
            Te Verwerken
            {documents.length > 0 && (
              <span className="ml-2 bg-blue-100 text-blue-600 py-0.5 px-2 rounded-full text-xs font-medium">
                {documents.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('booked')}
            className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'booked'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Archive className="w-5 h-5" />
            Verwerkt / Archief
          </button>
        </nav>
      </div>

      {/* Tab Content: Inbox */}
      {activeTab === 'inbox' && (
        <>
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,image/jpeg,image/jpg,image/png,image/webp"
              onChange={handleFileInput}
              className="hidden"
            />

            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />

            <p className="text-gray-600 mb-2">
              Sleep PDF bestanden hierheen of klik om te uploaden
            </p>

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {uploading ? 'Uploaden...' : 'Selecteer Bestanden'}
            </button>

            <p className="text-sm text-gray-500 mt-2">
              PDF, JPG, PNG (max 10MB per bestand)
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {documents?.length || 0} document(en) in inbox
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleBulkProcess}
                disabled={processing || !(documents || []).some(d => d.status === 'Processing')}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
              >
                <Brain className="w-4 h-4" />
                {processing ? 'AI Analyseert...' : 'Start AI Analyse'}
              </button>
            </div>
          </div>

          {(documents || []).length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Geen facturen in de inbox</p>
              <p className="text-sm text-gray-500 mt-1">
                Upload facturen om te beginnen
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        <CheckSquare className="w-4 h-4" />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Bestand
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Datum
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Leverancier
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Bedrag
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Categorie
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Status
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Acties
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {(documents || []).map(doc => (
                      <tr key={doc.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedDocs.has(doc.id)}
                            onChange={() => toggleSelectDoc(doc.id)}
                            className="rounded border-gray-300"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-900 truncate max-w-xs">
                              {doc.file_name}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {doc.extracted?.invoice_date ? (
                            <div className="flex items-center gap-1 text-sm text-gray-900">
                              <Calendar className="w-4 h-4 text-gray-400" />
                              {new Date(doc.extracted.invoice_date).toLocaleDateString('nl-NL')}
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {doc.extracted?.contact_name ? (
                            <div className="flex items-center gap-1">
                              <Building2 className="w-4 h-4 text-gray-400" />
                              <span className="text-sm text-gray-900">
                                {doc.extracted.contact_name}
                              </span>
                              {doc.extracted.is_new_supplier && (
                                <span className="text-xs text-orange-600">(nieuw)</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {doc.extracted?.total_amount ? (
                            <div className="flex items-center justify-end gap-1">
                              <DollarSign className="w-4 h-4 text-gray-400" />
                              <span className="text-sm font-medium text-gray-900">
                                €{doc.extracted.total_amount.toFixed(2)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {doc.extracted?.suggested_account_code ? (
                            <div className="text-sm text-gray-900">
                              <div>{doc.extracted.suggested_account_code} - {doc.extracted.suggested_account_name}</div>
                              {doc.extracted.enrichment?.tavily_used && (
                                <div className="text-xs text-purple-600 mt-0.5">
                                  Tavily: {doc.extracted.enrichment.reason}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {getStatusBadge(doc.status)}
                          {doc.extracted?.payment_match?.matched && (
                            <div className="mt-1">
                              <span className="text-xs text-green-600 flex items-center gap-1">
                                <CheckCircle className="w-3 h-3" />
                                Betaling gevonden
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            {doc.status === 'Review_Needed' && doc.extracted && (
                              <>
                                <button
                                  onClick={() => setEditingDoc(doc)}
                                  className="flex items-center gap-1 px-3 py-1 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700"
                                  title="Bewerk vóór boeken"
                                >
                                  <Edit2 className="w-4 h-4" />
                                  Bewerk
                                </button>
                                {doc.extracted.suggested_account_id && (
                                  <button
                                    onClick={() => handleBookDocument(doc)}
                                    disabled={booking === doc.id}
                                    className="flex items-center gap-1 px-3 py-1 text-sm font-medium text-white bg-green-600 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Boek factuur direct"
                                  >
                                    <BookOpen className="w-4 h-4" />
                                    {booking === doc.id ? 'Bezig...' : 'Boeken'}
                                  </button>
                                )}
                              </>
                            )}
                            <button
                              onClick={async () => {
                                const { data, error } = await supabase.storage
                                  .from('invoices')
                                  .createSignedUrl(doc.file_url, 300);
                                if (data && !error) {
                                  window.open(data.signedUrl, '_blank');
                                }
                              }}
                              className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                              title="Bekijk document"
                            >
                              <Eye className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleDeleteDocument(doc)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                              title="Verwijder"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Tab Content: Booked */}
      {activeTab === 'booked' && (
        <>
          {bookedInvoices.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <Archive className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Nog geen geboekte facturen</p>
              <p className="text-sm text-gray-500 mt-1">
                Geboekte facturen verschijnen hier
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Factuurnummer
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Datum
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Leverancier
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Bedrag
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Status
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Acties
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {bookedInvoices.map(invoice => (
                      <tr key={invoice.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-900">
                              {invoice.invoice_number}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 text-sm text-gray-900">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            {new Date(invoice.invoice_date).toLocaleDateString('nl-NL')}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <Building2 className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-900">
                              {invoice.contact.company_name}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <DollarSign className="w-4 h-4 text-gray-400" />
                            <span className="text-sm font-medium text-gray-900">
                              €{invoice.total_amount.toFixed(2)}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {getStatusBadge(invoice.status)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            {invoice.document?.file_url && (
                              <button
                                onClick={async () => {
                                  const { data, error } = await supabase.storage
                                    .from('invoices')
                                    .createSignedUrl(invoice.document.file_url, 300);
                                  if (data && !error) {
                                    window.open(data.signedUrl, '_blank');
                                  }
                                }}
                                className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                title="Bekijk document"
                              >
                                <Eye className="w-5 h-5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {editingDoc && (
        <InvoiceReviewModal
          document={editingDoc}
          accounts={accounts}
          onClose={() => setEditingDoc(null)}
          onBooked={() => {
            setEditingDoc(null);
            loadData();
          }}
        />
      )}
    </div>
  );
}
