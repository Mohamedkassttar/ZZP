import { useState, useRef } from 'react';
import { Upload, Camera, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { processInvoiceWithAI } from '../../lib/intelligentInvoiceProcessor';
import { bookInvoice } from '../../lib/invoiceBookingService';
import { parseMT940File, parseCSVFile, parseCAMT053, importBankTransactions, type ImportResult } from '../../lib/bankImportService';
import type { EnhancedInvoiceData } from '../../lib/intelligentInvoiceProcessor';

interface PortalUploadProps {
  type: 'invoice' | 'bank';
}

type UploadState = 'idle' | 'uploading' | 'analyzing' | 'preview' | 'success' | 'error';

export function PortalUpload({ type }: PortalUploadProps) {
  const [state, setState] = useState<UploadState>('idle');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<EnhancedInvoiceData | null>(null);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [bankResult, setBankResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isInvoice = type === 'invoice';
  const title = isInvoice ? 'Factuur Uploaden' : 'Bank Afschrift Uploaden';
  const description = isInvoice
    ? 'Upload een factuur en laat de AI deze automatisch verwerken'
    : 'Upload je bankafschrift voor automatische verwerking';

  async function handleFileSelect(selectedFile: File) {
    if (!selectedFile) return;

    setFile(selectedFile);
    setState('uploading');
    setError(null);

    try {
      const timestamp = Date.now();
      const fileName = `${timestamp}_${selectedFile.name}`;
      const filePath = `invoices/${fileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('invoices')
        .upload(filePath, selectedFile, {
          contentType: selectedFile.type,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: document, error: docError } = await supabase
        .from('documents_inbox')
        .insert({
          file_url: uploadData.path,
          file_name: selectedFile.name,
          file_type: selectedFile.type,
          status: 'Processing',
          source: 'portal',
        })
        .select()
        .single();

      if (docError || !document) throw new Error('Failed to create document record');

      setDocumentId(document.id);

      if (isInvoice) {
        setState('analyzing');

        const { data: signedUrlData, error: signedUrlError } = await supabase.storage
          .from('invoices')
          .createSignedUrl(uploadData.path, 300);

        if (signedUrlError || !signedUrlData) {
          throw new Error('Kon geen signed URL maken voor AI verwerking');
        }

        const invoiceData = await processInvoiceWithAI(signedUrlData.signedUrl, document.id);
        setPreview(invoiceData);
        setState('preview');
      } else {
        await handleBankImport(selectedFile);
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'Upload failed');
      setState('error');
    }
  }

  async function handleBankImport(selectedFile: File) {
    setState('analyzing');
    setError(null);

    try {
      const { data: bankAccount } = await supabase
        .from('accounts')
        .select('id')
        .eq('code', '1100')
        .eq('is_active', true)
        .maybeSingle();

      if (!bankAccount) {
        throw new Error('Geen bankrekening (1100) gevonden. Neem contact op met je boekhouder.');
      }

      const fileContent = await extractFileContent(selectedFile);
      const isMT940 = selectedFile.name.toLowerCase().includes('mt940') ||
                      selectedFile.name.toLowerCase().includes('.sta') ||
                      selectedFile.name.toLowerCase().includes('.940') ||
                      fileContent.includes(':20:') ||
                      fileContent.includes(':25:');
      const isCSV = selectedFile.name.toLowerCase().endsWith('.csv');
      const isXML = selectedFile.name.toLowerCase().endsWith('.xml') ||
                    fileContent.trim().startsWith('<?xml') ||
                    fileContent.trim().startsWith('<Document');

      let transactions;
      let skippedCount = 0;

      if (isXML) {
        const parseResult = await parseCAMT053(fileContent);
        transactions = parseResult.transactions;
        skippedCount = parseResult.skipped;
      } else if (isMT940) {
        transactions = await parseMT940File(fileContent);
      } else if (isCSV) {
        transactions = await parseCSVFile(fileContent);
      } else {
        throw new Error('Ongeldig bestandsformaat. Gebruik CSV, MT940 (.sta) of CAMT.053 (XML).');
      }

      if (transactions.length === 0) {
        throw new Error('Geen geldige transacties gevonden in het bestand.');
      }

      const importResult = await importBankTransactions(transactions, bankAccount.id);
      setBankResult({
        ...importResult,
        skipped: skippedCount,
      });
      setState('success');
    } catch (err) {
      console.error('Bank import error:', err);
      setError(err instanceof Error ? err.message : 'Import mislukt');
      setState('error');
    }
  }

  async function extractFileContent(file: File): Promise<string> {
    try {
      const textContent = await file.text();
      return textContent;
    } catch (textError) {
      const arrayBuffer = await file.arrayBuffer();
      const decoder = new TextDecoder('iso-8859-1');
      return decoder.decode(arrayBuffer);
    }
  }

  async function handleApprove() {
    if (!preview || !documentId) return;

    if (!preview.suggested_account_id) {
      setError('Geen kostenrekening geselecteerd. Kan niet boeken.');
      return;
    }

    setState('uploading');
    setError(null);

    try {
      const result = await bookInvoice({
        documentId,
        invoiceData: preview,
        expenseAccountId: preview.suggested_account_id,
        supplierContactId: preview.contact_id,
      });

      if (!result.success) {
        throw new Error(result.error || 'Booking failed');
      }

      setState('success');
    } catch (err) {
      console.error('Booking error:', err);
      setError(err instanceof Error ? err.message : 'Booking failed');
      setState('error');
    }
  }

  function reset() {
    setState('idle');
    setFile(null);
    setPreview(null);
    setDocumentId(null);
    setBankResult(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  if (state === 'success') {
    return (
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-3xl shadow-xl p-8 text-center border border-gray-100">
          <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Gelukt!</h2>

          {isInvoice ? (
            <p className="text-gray-600 mb-8">Je factuur is succesvol verwerkt en geboekt.</p>
          ) : bankResult ? (
            <div className="text-left mb-8 space-y-3">
              <div className="bg-green-50 rounded-2xl p-4">
                <p className="text-sm text-gray-600 mb-1">Nieuwe transacties</p>
                <p className="text-2xl font-bold text-green-900">{bankResult.newTransactions}</p>
              </div>

              {bankResult.duplicates > 0 && (
                <div className="bg-yellow-50 rounded-2xl p-4">
                  <p className="text-sm text-gray-600 mb-1">Duplicaten overgeslagen</p>
                  <p className="text-xl font-bold text-yellow-900">{bankResult.duplicates}</p>
                </div>
              )}

              {bankResult.skipped && bankResult.skipped > 0 && (
                <div className="bg-gray-50 rounded-2xl p-4">
                  <p className="text-sm text-gray-600 mb-1">Andere overgeslagen</p>
                  <p className="text-xl font-bold text-gray-900">{bankResult.skipped}</p>
                </div>
              )}

              {bankResult.errors.length > 0 && (
                <div className="bg-red-50 rounded-2xl p-4">
                  <p className="text-sm text-red-600 mb-2 font-medium">Fouten:</p>
                  <ul className="text-xs text-red-800 space-y-1">
                    {bankResult.errors.map((err, idx) => (
                      <li key={idx}>• {err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-600 mb-8">Je bankafschrift is succesvol verwerkt.</p>
          )}

          <button
            onClick={reset}
            className="w-full bg-blue-600 text-white py-4 rounded-2xl font-semibold hover:bg-blue-700 transition-colors shadow-lg"
          >
            Nog een uploaden
          </button>
        </div>
      </div>
    );
  }

  if (state === 'preview' && preview) {
    return (
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-3xl shadow-xl p-6 border border-gray-100">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Controleer de gegevens</h2>

          <div className="space-y-4 mb-6">
            <div className="bg-gray-50 rounded-2xl p-4">
              <p className="text-xs text-gray-500 mb-1">Leverancier</p>
              <p className="text-lg font-semibold text-gray-900">{preview.supplier_name || 'Onbekend'}</p>
              {preview.is_new_supplier && (
                <p className="text-xs text-blue-600 mt-1">Nieuwe leverancier</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-2xl p-4">
                <p className="text-xs text-gray-500 mb-1">Factuurnummer</p>
                <p className="text-sm font-semibold text-gray-900">{preview.invoice_number || '-'}</p>
              </div>
              <div className="bg-gray-50 rounded-2xl p-4">
                <p className="text-xs text-gray-500 mb-1">Datum</p>
                <p className="text-sm font-semibold text-gray-900">
                  {preview.invoice_date
                    ? new Date(preview.invoice_date).toLocaleDateString('nl-NL')
                    : '-'}
                </p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-2xl p-4">
              <p className="text-xs text-gray-500 mb-1">Categorie</p>
              <p className="text-sm font-semibold text-gray-900">
                {preview.suggested_account_code} - {preview.suggested_account_name || 'Onbekend'}
              </p>
              <p className="text-xs text-gray-600 mt-1">{preview.description}</p>
            </div>

            <div className="bg-blue-50 rounded-2xl p-4 border-2 border-blue-200">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-blue-600 mb-1 font-medium">Excl. BTW</p>
                  <p className="text-lg font-bold text-blue-900">
                    {new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(
                      preview.net_amount || 0
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-blue-600 mb-1 font-medium">BTW {preview.vat_percentage || 0}%</p>
                  <p className="text-lg font-bold text-blue-900">
                    {new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(
                      preview.vat_amount || 0
                    )}
                  </p>
                </div>
              </div>
              <div className="border-t border-blue-200 mt-3 pt-3">
                <p className="text-xs text-blue-600 mb-1 font-medium">Totaalbedrag</p>
                <p className="text-2xl font-bold text-blue-900">
                  {new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(
                    preview.total_amount || 0
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleApprove}
              className="w-full bg-blue-600 text-white py-4 rounded-2xl font-semibold hover:bg-blue-700 transition-colors shadow-lg flex items-center justify-center gap-2"
            >
              <CheckCircle className="w-5 h-5" />
              Akkoord & Boeken
            </button>
            <button
              onClick={reset}
              className="w-full bg-gray-100 text-gray-700 py-4 rounded-2xl font-semibold hover:bg-gray-200 transition-colors"
            >
              Annuleren
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{title}</h1>
        <p className="text-gray-600">{description}</p>
      </div>

      {error && (
        <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 mb-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <div className="bg-white rounded-3xl shadow-xl p-8 border-2 border-dashed border-gray-300 text-center">
        {state === 'uploading' || state === 'analyzing' ? (
          <div className="py-12">
            <Loader2 className="w-16 h-16 text-blue-600 animate-spin mx-auto mb-4" />
            <p className="text-lg font-semibold text-gray-900 mb-2">
              {state === 'uploading' ? 'Uploaden...' : 'AI analyseert...'}
            </p>
            <p className="text-sm text-gray-600">
              {state === 'uploading' ? 'Bestand wordt geüpload' : 'De factuur wordt intelligent verwerkt'}
            </p>
          </div>
        ) : (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept={isInvoice ? 'application/pdf,image/*' : '.csv,.xml,.sta,.940,text/csv,application/xml,text/plain'}
              onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
              className="hidden"
            />

            <div className="mb-8">
              <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Upload className="w-10 h-10 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Sleep je bestand hierheen
              </h3>
              <p className="text-sm text-gray-600">of kies hieronder een optie</p>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full bg-blue-600 text-white py-4 rounded-2xl font-semibold hover:bg-blue-700 transition-colors shadow-lg flex items-center justify-center gap-2"
              >
                <Upload className="w-5 h-5" />
                Bestand kiezen
              </button>

              <button
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.setAttribute('capture', 'environment');
                    fileInputRef.current.click();
                  }
                }}
                className="w-full bg-gray-800 text-white py-4 rounded-2xl font-semibold hover:bg-gray-900 transition-colors shadow-lg flex items-center justify-center gap-2"
              >
                <Camera className="w-5 h-5" />
                Foto maken
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
