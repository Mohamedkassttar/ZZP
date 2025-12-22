import { useState, useEffect, useRef } from 'react';
import { Upload, FileText, Loader, AlertCircle, CheckCircle, Eye, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { uploadAndProcessInvoice, deleteDocument } from '../lib/uploadService';
import { InvoiceReviewModal } from './InvoiceReviewModal';
import type { Database } from '../lib/database.types';

type Account = Database['public']['Tables']['accounts']['Row'];
type Document = Database['public']['Tables']['documents_inbox']['Row'];

export function Inbox() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
    subscribeToDocuments();
  }, []);

  async function loadData() {
    try {
      const [accountsRes, documentsRes] = await Promise.all([
        supabase.from('accounts').select('*').eq('is_active', true),
        supabase.from('documents_inbox').select('*').order('created_at', { ascending: false }),
      ]);

      if (accountsRes.data) {
        const sortedAccounts = accountsRes.data.sort((a, b) => {
          const numA = parseInt(a.code);
          const numB = parseInt(b.code);
          return numA - numB;
        });
        setAccounts(sortedAccounts);
      }
      if (documentsRes.data) setDocuments(documentsRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  function subscribeToDocuments() {
    const subscription = supabase
      .channel('documents_inbox_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'documents_inbox' },
        () => {
          loadData();
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
      if (!file.type.match(/^(image\/(jpeg|jpg|png|webp)|application\/pdf)$/)) {
        alert(`${file.name}: Only PDF and image files are supported`);
        continue;
      }

      if (file.size > 10 * 1024 * 1024) {
        alert(`${file.name}: File too large. Max 10MB`);
        continue;
      }

      const result = await uploadAndProcessInvoice(file, accounts);
      if (!result.success) {
        alert(`${file.name}: ${result.error}`);
      }
    }

    setUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  async function handleDelete(doc: Document) {
    if (!confirm(`Delete ${doc.file_name}?`)) return;

    const success = await deleteDocument(doc.id, doc.file_url);
    if (success) {
      setDocuments(documents.filter((d) => d.id !== doc.id));
    } else {
      alert('Failed to delete document');
    }
  }

  function getStatusIcon(status: Document['status']) {
    switch (status) {
      case 'Processing':
        return <Loader className="w-5 h-5 text-blue-600 animate-spin" />;
      case 'Review_Needed':
        return <AlertCircle className="w-5 h-5 text-orange-600" />;
      case 'Booked':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'Error':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      default:
        return <FileText className="w-5 h-5 text-gray-600" />;
    }
  }

  function getStatusText(status: Document['status']) {
    switch (status) {
      case 'Processing':
        return 'AI Analyzing...';
      case 'Review_Needed':
        return 'Ready for Review';
      case 'Booked':
        return 'Booked';
      case 'Error':
        return 'Error';
      default:
        return status;
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Inkoop Inbox</h1>
        <p className="text-sm text-gray-500">AI-scan en automatische verwerking</p>
      </div>

      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          dragActive
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 bg-white hover:border-gray-400'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-base font-semibold text-gray-900 mb-2">
          {uploading ? 'Uploading...' : 'Drop invoices here'}
        </h3>
        <p className="text-sm text-gray-500 mb-4">or click to browse</p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          onChange={handleFileInput}
          className="hidden"
          disabled={uploading}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="h-9 px-4 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400"
        >
          {uploading ? 'Processing...' : 'Select Files'}
        </button>
        <p className="text-xs text-gray-500 mt-3">PDF, JPG, PNG up to 10MB</p>
      </div>

      <div className="rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">Documents</h2>
        </div>

        {documents.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-3 text-gray-400" />
            <p>No documents yet. Upload your first invoice to get started.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {documents.map((doc) => (
              <div key={doc.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    {getStatusIcon(doc.status)}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 truncate">{doc.file_name}</h3>
                      <div className="flex items-center gap-3 mt-1">
                        <span
                          className={`text-sm font-medium ${
                            doc.status === 'Review_Needed'
                              ? 'text-orange-600'
                              : doc.status === 'Booked'
                              ? 'text-green-600'
                              : doc.status === 'Error'
                              ? 'text-red-600'
                              : 'text-blue-600'
                          }`}
                        >
                          {getStatusText(doc.status)}
                        </span>
                        <span className="text-sm text-gray-500">
                          {new Date(doc.created_at).toLocaleString('nl-NL')}
                        </span>
                        {doc.extracted_data?.supplier_name && (
                          <span className="text-sm text-gray-700">
                            {doc.extracted_data.supplier_name}
                          </span>
                        )}
                        {doc.extracted_data?.total_amount && (
                          <span className="text-sm font-medium text-gray-900">
                            €{doc.extracted_data.total_amount.toFixed(2)}
                          </span>
                        )}
                      </div>
                      {doc.error_message && (
                        <p className="text-sm text-red-600 mt-1">{doc.error_message}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {doc.status === 'Review_Needed' && (
                      <button
                        onClick={() => setSelectedDocument(doc)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                        Review
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(doc)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedDocument && (
        <InvoiceReviewModal
          document={selectedDocument}
          accounts={accounts}
          onClose={() => setSelectedDocument(null)}
          onBooked={() => {
            setSelectedDocument(null);
            loadData();
          }}
        />
      )}
    </div>
  );
}
