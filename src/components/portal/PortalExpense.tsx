import { useState, useRef } from 'react';
import {
  Upload,
  Camera,
  CheckCircle,
  Loader,
  AlertCircle,
  FileText,
  Building2,
  DollarSign,
  Calendar,
  BookOpen,
  ArrowRight,
  Wallet,
  Brain,
} from 'lucide-react';
import {
  uploadAndProcessInvoiceFast,
  bookInvoiceFromPortal,
  getExpenseAccounts,
} from '../../lib/invoiceService';
import type { EnhancedInvoiceData } from '../../lib/intelligentInvoiceProcessor';
import type { PaymentMethod } from '../../lib/invoiceBookingService';

type ProcessingState = 'idle' | 'uploading' | 'processing' | 'review' | 'booking' | 'success' | 'error';

export function PortalExpense() {
  const [state, setState] = useState<ProcessingState>('idle');
  const [dragActive, setDragActive] = useState(false);
  const [extractedData, setExtractedData] = useState<EnhancedInvoiceData | null>(null);
  const [documentId, setDocumentId] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [expenseAccounts, setExpenseAccounts] = useState<any[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('none');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

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

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await handleFile(e.dataTransfer.files[0]);
    }
  }

  async function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files[0]) {
      await handleFile(e.target.files[0]);
    }
  }

  async function handleFile(file: File) {
    setState('uploading');
    setError('');

    try {
      setState('processing');

      console.log('🚀 [PORTAL EXPENSE] Starting fast upload with compression...');
      const result = await uploadAndProcessInvoiceFast(file);

      if (!result.success || !result.extractedData) {
        throw new Error(result.error || 'Fout bij verwerken factuur');
      }

      const accounts = await getExpenseAccounts();
      setExpenseAccounts(accounts);

      console.log('📊 [PORTAL] Extracted data received:', {
        suggested_account_id: result.extractedData.suggested_account_id,
        suggested_account_code: result.extractedData.suggested_account_code,
        suggested_account_name: result.extractedData.suggested_account_name,
        has_enrichment: !!result.extractedData.enrichment,
        enrichment_reason: result.extractedData.enrichment?.reason,
      });

      setExtractedData(result.extractedData);
      setDocumentId(result.documentId);

      if (result.extractedData.suggested_account_id) {
        console.log('✓ [PORTAL] Pre-selecting AI suggested account:', result.extractedData.suggested_account_id);
        setSelectedAccountId(result.extractedData.suggested_account_id);
      } else if (accounts.length > 0) {
        console.log('⚠ [PORTAL] No AI suggestion, defaulting to first account');
        setSelectedAccountId(accounts[0].id);
      }

      setState('review');
    } catch (err) {
      console.error('Error processing file:', err);
      setError(err instanceof Error ? err.message : 'Onbekende fout');
      setState('error');
    }
  }

  async function handleBook() {
    if (!extractedData || !documentId || !selectedAccountId) {
      setError('Selecteer een categorie');
      return;
    }

    setState('booking');
    setError('');

    try {
      const result = await bookInvoiceFromPortal({
        documentId,
        invoiceData: extractedData,
        expenseAccountId: selectedAccountId,
        supplierContactId: extractedData.contact_id,
        paymentMethod,
      });

      if (!result.success) {
        throw new Error(result.error || 'Fout bij boeken');
      }

      if (result.paymentAccountUsed) {
        setSuccessMessage(`Factuur geboekt en betaald via ${result.paymentAccountUsed.code} - ${result.paymentAccountUsed.name}`);
      } else {
        setSuccessMessage('De inkoopfactuur is succesvol verwerkt en geboekt in de administratie.');
      }

      setState('success');
    } catch (err) {
      console.error('Error booking invoice:', err);
      setError(err instanceof Error ? err.message : 'Fout bij boeken');
      setState('error');
    }
  }

  function reset() {
    setState('idle');
    setExtractedData(null);
    setDocumentId('');
    setError('');
    setSelectedAccountId('');
    setExpenseAccounts([]);
    setPaymentMethod('none');
    setSuccessMessage('');
  }

  if (state === 'success') {
    return (
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-3xl shadow-xl p-8 text-center border border-gray-100">
          <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Factuur Geboekt!</h2>
          <p className="text-gray-600 mb-8">
            {successMessage}
          </p>
          <button
            onClick={reset}
            className="w-full bg-blue-600 text-white py-4 rounded-2xl font-semibold hover:bg-blue-700 transition-colors shadow-lg"
          >
            Nieuwe factuur verwerken
          </button>
        </div>
      </div>
    );
  }

  if (state === 'review' && extractedData) {
    const selectedAccount = expenseAccounts.find(acc => acc.id === selectedAccountId);

    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Factuur Controleren</h1>
          <p className="text-gray-600">Controleer de gegevens en bevestig de boeking</p>
        </div>

        <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Geëxtraheerde Gegevens</h3>

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Building2 className="w-5 h-5 text-gray-500 mt-1" />
              <div className="flex-1">
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Leverancier
                </label>
                <p className="text-gray-900">{extractedData.supplier_name || 'Onbekend'}</p>
                {extractedData.is_new_supplier && (
                  <span className="inline-block mt-1 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                    Nieuwe leverancier
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-gray-500 mt-1" />
              <div className="flex-1">
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Factuurnummer
                </label>
                <p className="text-gray-900">{extractedData.invoice_number || '-'}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-gray-500 mt-1" />
              <div className="flex-1">
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Factuurdatum
                </label>
                <p className="text-gray-900">
                  {extractedData.invoice_date
                    ? new Date(extractedData.invoice_date).toLocaleDateString('nl-NL')
                    : '-'}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <DollarSign className="w-5 h-5 text-gray-500 mt-1" />
              <div className="flex-1">
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Bedrag
                </label>
                <p className="text-2xl font-bold text-gray-900">
                  {new Intl.NumberFormat('nl-NL', {
                    style: 'currency',
                    currency: 'EUR',
                  }).format(extractedData.total_amount || 0)}
                </p>
                {extractedData.vat_amount !== undefined && extractedData.vat_amount > 0.01 && (
                  <p className="text-sm text-gray-600 mt-1">
                    Waarvan BTW:{' '}
                    {new Intl.NumberFormat('nl-NL', {
                      style: 'currency',
                      currency: 'EUR',
                    }).format(extractedData.vat_amount)}
                  </p>
                )}
              </div>
            </div>

            {extractedData.description && (
              <div className="flex items-start gap-3">
                <FileText className="w-5 h-5 text-gray-500 mt-1" />
                <div className="flex-1">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Omschrijving
                  </label>
                  <p className="text-gray-900 text-sm">{extractedData.description}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="w-5 h-5 text-gray-700" />
            <h3 className="text-lg font-bold text-gray-900">Categorie</h3>
            {extractedData.suggested_account_id && extractedData.suggested_account_id === selectedAccountId && (
              <span className="ml-auto inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">
                <Brain className="w-3 h-3" />
                AI Voorstel
              </span>
            )}
          </div>

          <select
            value={selectedAccountId}
            onChange={e => setSelectedAccountId(e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
          >
            <option value="">-- Selecteer categorie --</option>
            {expenseAccounts.map(account => (
              <option key={account.id} value={account.id}>
                {account.code} - {account.name}
              </option>
            ))}
          </select>

          {selectedAccount && (
            <div className="mt-3 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-900">
                <span className="font-semibold">Geboekt naar:</span> {selectedAccount.code} -{' '}
                {selectedAccount.name}
              </p>
              {extractedData.suggested_account_id && extractedData.suggested_account_id === selectedAccountId && extractedData.enrichment && (
                <p className="text-xs text-blue-700 mt-2">
                  <span className="font-semibold">AI Redenering:</span> {extractedData.enrichment.reason}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Betaling</h3>
          <div className="space-y-3">
            <label className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
              <input
                type="radio"
                name="payment"
                value="none"
                checked={paymentMethod === 'none'}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-5 h-5"
              />
              <div className="flex-1">
                <div className="font-semibold text-gray-900">Geen directe betaling</div>
                <div className="text-sm text-gray-600">Factuur wordt open geboekt (te betalen)</div>
              </div>
            </label>

            <label className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
              <input
                type="radio"
                name="payment"
                value="cash"
                checked={paymentMethod === 'cash'}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-5 h-5"
              />
              <DollarSign className="w-6 h-6 text-green-600" />
              <div className="flex-1">
                <div className="font-semibold text-gray-900">Direct betaald met Kas</div>
                <div className="text-sm text-gray-600">Zoekt rekening met "Kas" in naam</div>
              </div>
            </label>

            <label className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
              <input
                type="radio"
                name="payment"
                value="private"
                checked={paymentMethod === 'private'}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-5 h-5"
              />
              <Wallet className="w-6 h-6 text-blue-600" />
              <div className="flex-1">
                <div className="font-semibold text-gray-900">Direct betaald uit Privé</div>
                <div className="text-sm text-gray-600">Zoekt rekening met "Prive" in naam</div>
              </div>
            </label>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={reset}
            className="flex-1 bg-gray-100 text-gray-700 py-4 rounded-2xl font-semibold hover:bg-gray-200 transition-colors"
          >
            Annuleren
          </button>
          <button
            onClick={handleBook}
            disabled={state === 'booking' || !selectedAccountId}
            className="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-semibold hover:bg-blue-700 transition-colors shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {state === 'booking' ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                Boeken...
              </>
            ) : (
              <>
                Bevestigen & Boeken
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Inkoopfactuur</h1>
        <p className="text-gray-600">Upload een factuur om deze te verwerken</p>
      </div>

      {(state === 'uploading' || state === 'processing') && (
        <div className="bg-white rounded-3xl shadow-xl p-12 text-center border border-gray-100">
          <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Loader className="w-10 h-10 text-blue-600 animate-spin" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            {state === 'uploading' ? 'Uploaden...' : 'Factuur wordt verwerkt'}
          </h2>
          <p className="text-gray-600">
            {state === 'uploading'
              ? 'Bestand wordt geüpload...'
              : 'AI analyseert de factuur en extraheert de gegevens...'}
          </p>
        </div>
      )}

      {state === 'error' && (
        <div className="bg-white rounded-3xl shadow-xl p-12 text-center border border-gray-100">
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-10 h-10 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Fout opgetreden</h2>
          <p className="text-gray-600 mb-8">{error}</p>
          <button
            onClick={reset}
            className="bg-blue-600 text-white px-8 py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
          >
            Opnieuw proberen
          </button>
        </div>
      )}

      {state === 'idle' && (
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`
            border-3 border-dashed rounded-3xl p-12 text-center transition-all
            ${
              dragActive
                ? 'border-blue-500 bg-blue-50 scale-105'
                : 'border-gray-300 bg-white hover:border-blue-400 hover:bg-gray-50'
            }
          `}
        >
          <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Upload className="w-10 h-10 text-blue-600" />
          </div>

          <h3 className="text-xl font-bold text-gray-900 mb-3">
            Sleep factuur hierheen
          </h3>
          <p className="text-gray-600 mb-8">
            Of kies een bestand van je apparaat
          </p>

          <div className="flex gap-3 justify-center">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <FileText className="w-5 h-5" />
              Bestand kiezen
            </button>

            <button
              onClick={() => cameraInputRef.current?.click()}
              className="bg-gray-700 text-white px-6 py-3 rounded-xl font-semibold hover:bg-gray-800 transition-colors flex items-center gap-2"
            >
              <Camera className="w-5 h-5" />
              Foto maken
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileInput}
            accept="image/*,application/pdf"
            className="hidden"
          />

          <input
            ref={cameraInputRef}
            type="file"
            onChange={handleFileInput}
            accept="image/*"
            capture="environment"
            className="hidden"
          />

          <p className="text-sm text-gray-500 mt-6">
            Ondersteunt: PDF, JPEG, PNG, WebP (max 10MB)
          </p>
        </div>
      )}
    </div>
  );
}
