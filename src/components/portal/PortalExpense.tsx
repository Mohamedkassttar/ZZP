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
  Edit2,
} from 'lucide-react';
import {
  uploadInvoiceFile,
  processAndExtractInvoice,
  getExpenseAccounts,
} from '../../lib/invoiceService';
import { bookInvoice, type PaymentMethod } from '../../lib/invoiceBookingService';
import type { EnhancedInvoiceData } from '../../lib/intelligentInvoiceProcessor';

type ProcessingState = 'idle' | 'uploading' | 'processing' | 'review' | 'booking' | 'success' | 'error';

export function PortalExpense() {
  const [state, setState] = useState<ProcessingState>('idle');
  const [dragActive, setDragActive] = useState(false);
  const [formData, setFormData] = useState<EnhancedInvoiceData & {
    contact_id?: string;
  }>({
    supplier_name: '',
    invoice_date: new Date().toISOString().split('T')[0],
    invoice_number: '',
    total_amount: 0,
    vat_amount: 0,
    net_amount: 0,
    vat_percentage: 21,
    suggested_account_id: '',
    description: '',
  });
  const [documentId, setDocumentId] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [expenseAccounts, setExpenseAccounts] = useState<any[]>([]);
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
      const uploadResult = await uploadInvoiceFile(file);

      if (!uploadResult.success || !uploadResult.documentId) {
        throw new Error(uploadResult.error || 'Fout bij uploaden factuur');
      }

      setState('processing');
      setDocumentId(uploadResult.documentId);

      const processResult = await processAndExtractInvoice(uploadResult.documentId);

      if (!processResult.success || !processResult.extractedData) {
        throw new Error(processResult.error || 'Fout bij verwerken factuur');
      }

      const accounts = await getExpenseAccounts();
      setExpenseAccounts(accounts);

      console.log('📊 [PORTAL] Extracted data received:', {
        suggested_account_id: processResult.extractedData.suggested_account_id,
        suggested_account_code: processResult.extractedData.suggested_account_code,
        suggested_account_name: processResult.extractedData.suggested_account_name,
        has_enrichment: !!processResult.extractedData.enrichment,
        enrichment_reason: processResult.extractedData.enrichment?.reason,
      });

      setFormData({
        ...processResult.extractedData,
      });

      setState('review');
    } catch (err) {
      console.error('Error processing file:', err);
      setError(err instanceof Error ? err.message : 'Onbekende fout');
      setState('error');
    }
  }

  function updateField<K extends keyof EnhancedInvoiceData>(
    field: K,
    value: EnhancedInvoiceData[K]
  ) {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };

      if (field === 'total_amount' || field === 'vat_amount') {
        const total = field === 'total_amount' ? Number(value) : prev.total_amount || 0;
        const vat = field === 'vat_amount' ? Number(value) : prev.vat_amount || 0;
        updated.net_amount = total - vat;
      }

      if (field === 'net_amount' || field === 'vat_amount') {
        const net = field === 'net_amount' ? Number(value) : prev.net_amount || 0;
        const vat = field === 'vat_amount' ? Number(value) : prev.vat_amount || 0;
        updated.total_amount = net + vat;
      }

      return updated;
    });
  }

  async function handleBook() {
    setError('');
    setState('booking');

    try {
      if (!formData.supplier_name?.trim()) {
        throw new Error('Leveranciersnaam is verplicht');
      }
      if (!formData.invoice_date) {
        throw new Error('Factuurdatum is verplicht');
      }
      if (!formData.total_amount || formData.total_amount <= 0) {
        throw new Error('Geldig totaalbedrag is verplicht');
      }
      if (!formData.suggested_account_id) {
        throw new Error('Selecteer een kostenrekening');
      }

      const result = await bookInvoice({
        documentId,
        invoiceData: {
          supplier_name: formData.supplier_name,
          invoice_date: formData.invoice_date,
          invoice_number: formData.invoice_number,
          total_amount: formData.total_amount,
          vat_amount: formData.vat_amount,
          net_amount: formData.net_amount,
          vat_percentage: formData.vat_percentage,
          suggested_account_id: formData.suggested_account_id,
          description: formData.description,
          contact_id: formData.contact_id,
        },
        expenseAccountId: formData.suggested_account_id,
        supplierContactId: formData.contact_id,
        notes: formData.description,
        paymentMethod: paymentMethod,
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
      setState('review');
    }
  }

  function reset() {
    setState('idle');
    setFormData({
      supplier_name: '',
      invoice_date: new Date().toISOString().split('T')[0],
      invoice_number: '',
      total_amount: 0,
      vat_amount: 0,
      net_amount: 0,
      vat_percentage: 21,
      suggested_account_id: '',
      description: '',
    });
    setDocumentId('');
    setError('');
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

  if (state === 'review') {
    const selectedAccount = expenseAccounts.find(acc => acc.id === formData.suggested_account_id);

    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Factuur Controleren</h1>
          <p className="text-gray-600">Controleer en bewerk de gegevens indien nodig</p>
        </div>

        <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Factuurgegevens</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <Building2 className="w-4 h-4 inline mr-1" />
                Leverancier *
              </label>
              <input
                type="text"
                value={formData.supplier_name || ''}
                onChange={(e) => updateField('supplier_name', e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
                placeholder="Naam leverancier"
              />
              {formData.is_new_supplier && (
                <span className="inline-block mt-2 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                  Nieuwe leverancier - wordt automatisch aangemaakt
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <FileText className="w-4 h-4 inline mr-1" />
                  Factuurnummer
                </label>
                <input
                  type="text"
                  value={formData.invoice_number || ''}
                  onChange={(e) => updateField('invoice_number', e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
                  placeholder="Factuurnummer"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Factuurdatum *
                </label>
                <input
                  type="date"
                  value={formData.invoice_date || ''}
                  onChange={(e) => updateField('invoice_date', e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <DollarSign className="w-4 h-4 inline mr-1" />
                  Excl. BTW *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.net_amount || ''}
                  onChange={(e) => updateField('net_amount', parseFloat(e.target.value) || 0)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  BTW Bedrag
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.vat_amount || ''}
                  onChange={(e) => updateField('vat_amount', parseFloat(e.target.value) || 0)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Totaal Incl. *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.total_amount || ''}
                  onChange={(e) => updateField('total_amount', parseFloat(e.target.value) || 0)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none font-bold"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Omschrijving
              </label>
              <textarea
                value={formData.description || ''}
                onChange={(e) => updateField('description', e.target.value)}
                rows={3}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none resize-none"
                placeholder="Optionele omschrijving"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="w-5 h-5 text-gray-700" />
            <h3 className="text-lg font-bold text-gray-900">Kostenrekening *</h3>
            {formData.suggested_account_id && formData.enrichment && (
              <span className="ml-auto inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">
                <Brain className="w-3 h-3" />
                AI Voorstel
              </span>
            )}
          </div>

          <select
            value={formData.suggested_account_id || ''}
            onChange={(e) => updateField('suggested_account_id', e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
          >
            <option value="">-- Selecteer kostenrekening --</option>
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
              {formData.suggested_account_id && formData.enrichment && (
                <p className="text-xs text-blue-700 mt-2">
                  <span className="font-semibold">AI Redenering:</span> {formData.enrichment.reason}
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
            disabled={state === 'booking'}
            className="flex-1 bg-gray-100 text-gray-700 py-4 rounded-2xl font-semibold hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            Annuleren
          </button>
          <button
            onClick={handleBook}
            disabled={state === 'booking' || !formData.suggested_account_id}
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
