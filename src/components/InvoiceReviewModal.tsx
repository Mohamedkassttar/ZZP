import { useState, useEffect } from 'react';
import { X, Save, Sparkles, AlertCircle, Plus, CheckCircle, Wallet, DollarSign } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getSignedUrl } from '../lib/uploadService';
import { bookInvoice, type PaymentMethod } from '../lib/invoiceBookingService';
import type { Database, ExtractedInvoiceData } from '../lib/database.types';

type Account = Database['public']['Tables']['accounts']['Row'];
type Document = Database['public']['Tables']['documents_inbox']['Row'];

interface Props {
  document: Document;
  accounts: Account[];
  onClose: () => void;
  onBooked: () => void;
}

export function InvoiceReviewModal({ document, accounts, onClose, onBooked }: Props) {
  const [formData, setFormData] = useState<ExtractedInvoiceData & {
    contact_id?: string;
    is_new_supplier?: boolean;
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
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [creatingSupplier, setCreatingSupplier] = useState(false);
  const [fileUrl, setFileUrl] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('none');
  const isPdf = document.file_type === 'application/pdf';

  useEffect(() => {
    if (document.extracted_data) {
      setFormData(prev => ({
        ...prev,
        ...document.extracted_data,
      }));
    }
  }, [document.id]);

  useEffect(() => {
    async function loadSignedUrl() {
      try {
        const url = await getSignedUrl(document.file_url, 3600);
        setFileUrl(url);
      } catch (err) {
        console.error('Failed to get signed URL:', err);
      }
    }
    loadSignedUrl();
  }, [document.file_url]);

  function updateField<K extends keyof ExtractedInvoiceData>(
    field: K,
    value: ExtractedInvoiceData[K]
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

  async function handleCreateSupplier() {
    if (!formData.supplier_name?.trim()) return;

    setCreatingSupplier(true);
    setError(null);

    try {
      const { data: newContact, error: contactError } = await supabase
        .from('contacts')
        .insert({
          company_name: formData.supplier_name,
          relation_type: 'Supplier',
          is_active: true,
        })
        .select()
        .single();

      if (contactError) throw contactError;

      setFormData(prev => ({
        ...prev,
        contact_id: newContact.id,
        is_new_supplier: false,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create supplier');
    } finally {
      setCreatingSupplier(false);
    }
  }

  async function handleBook() {
    setError(null);
    setBooking(true);

    try {
      if (!formData.supplier_name?.trim()) {
        throw new Error('Supplier name is required');
      }
      if (!formData.invoice_date) {
        throw new Error('Invoice date is required');
      }
      if (!formData.total_amount || formData.total_amount <= 0) {
        throw new Error('Valid total amount is required');
      }
      if (!formData.suggested_account_id) {
        throw new Error('Please select an expense account');
      }

      const result = await bookInvoice({
        documentId: document.id,
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
        throw new Error(result.error || 'Failed to book invoice');
      }

      if (result.paymentAccountUsed) {
        setSuccess(`Factuur geboekt en betaald via ${result.paymentAccountUsed.code} - ${result.paymentAccountUsed.name}`);
      } else {
        setSuccess('Factuur succesvol geboekt!');
      }

      setTimeout(() => {
        onBooked();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to book invoice');
      setBooking(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="w-6 h-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-bold text-gray-900">Review Invoice</h2>
              <p className="text-sm text-gray-600">AI-extracted data - verify before booking</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-red-800">{error}</div>
          </div>
        )}

        {success && (
          <div className="mx-6 mt-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="text-green-800">{success}</div>
          </div>
        )}

        <div className="flex-1 overflow-hidden flex">
          <div className="w-1/2 border-r border-gray-200 p-6 overflow-auto bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Document Preview</h3>
            {isPdf ? (
              <iframe src={fileUrl} className="w-full h-full min-h-[600px] border rounded" />
            ) : (
              <img src={fileUrl} alt="Invoice" className="w-full h-auto rounded border" />
            )}
          </div>

          <div className="w-1/2 p-6 overflow-auto">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Supplier Name *
                </label>
                <input
                  type="text"
                  value={formData.supplier_name || ''}
                  onChange={(e) => updateField('supplier_name', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    formData.is_new_supplier
                      ? 'border-amber-400 bg-amber-50'
                      : 'border-gray-300'
                  }`}
                />
                {formData.is_new_supplier && !formData.contact_id && (
                  <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-amber-900 mb-2">
                          New Supplier detected: "{formData.supplier_name}"
                        </p>
                        <p className="text-xs text-amber-700 mb-3">
                          This supplier is not in your contacts. Create new creditor?
                        </p>
                        <button
                          onClick={handleCreateSupplier}
                          disabled={creatingSupplier}
                          className="flex items-center gap-2 px-3 py-1.5 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700 transition-colors disabled:bg-gray-400"
                        >
                          <Plus className="w-4 h-4" />
                          {creatingSupplier ? 'Creating...' : 'Create Creditor'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Invoice Date *
                  </label>
                  <input
                    type="date"
                    value={formData.invoice_date || ''}
                    onChange={(e) => updateField('invoice_date', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Invoice Number
                  </label>
                  <input
                    type="text"
                    value={formData.invoice_number || ''}
                    onChange={(e) => updateField('invoice_number', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <input
                  type="text"
                  value={formData.description || ''}
                  onChange={(e) => updateField('description', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Net Amount
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.net_amount || 0}
                    onChange={(e) => updateField('net_amount', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    VAT Amount
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.vat_amount || 0}
                    onChange={(e) => updateField('vat_amount', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Total Amount *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.total_amount || 0}
                    onChange={(e) => updateField('total_amount', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  VAT Percentage
                </label>
                <select
                  value={formData.vat_percentage || 21}
                  onChange={(e) => updateField('vat_percentage', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value={0}>0%</option>
                  <option value={9}>9%</option>
                  <option value={21}>21%</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Expense Account *
                  {formData.suggested_account_code && (
                    <span className="ml-2 text-blue-600 text-xs">
                      AI Suggested: {formData.suggested_account_code}
                    </span>
                  )}
                </label>
                <select
                  value={formData.suggested_account_id || ''}
                  onChange={(e) => updateField('suggested_account_id', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select account...</option>
                  {(accounts || [])
                    .filter((a) => a.type === 'Expense')
                    .map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.code} - {account.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Betaling
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="radio"
                      name="payment"
                      value="none"
                      checked={paymentMethod === 'none'}
                      onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                      className="w-4 h-4"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">Geen directe betaling</div>
                      <div className="text-xs text-gray-500">Factuur wordt open geboekt (te betalen)</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="radio"
                      name="payment"
                      value="cash"
                      checked={paymentMethod === 'cash'}
                      onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                      className="w-4 h-4"
                    />
                    <DollarSign className="w-5 h-5 text-green-600" />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">Direct betaald met Kas</div>
                      <div className="text-xs text-gray-500">Zoekt rekening met "Kas" in naam</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="radio"
                      name="payment"
                      value="private"
                      checked={paymentMethod === 'private'}
                      onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                      className="w-4 h-4"
                    />
                    <Wallet className="w-5 h-5 text-blue-600" />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">Direct betaald uit Privé</div>
                      <div className="text-xs text-gray-500">Zoekt rekening met "Prive" in naam</div>
                    </div>
                  </label>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Booking Preview</h4>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">
                      {(accounts || []).find((a) => a.id === formData.suggested_account_id)?.name ||
                        'Expense'}
                    </span>
                    <span className="font-medium">
                      Debit: €{(formData.net_amount || 0).toFixed(2)}
                    </span>
                  </div>
                  {formData.vat_amount ? (
                    <div className="flex justify-between">
                      <span className="text-gray-600">1300 - BTW te vorderen</span>
                      <span className="font-medium">
                        Debit: €{formData.vat_amount.toFixed(2)}
                      </span>
                    </div>
                  ) : null}
                  <div className="flex justify-between">
                    <span className="text-gray-600">1600 - Crediteuren</span>
                    <span className="font-medium">
                      Credit: €{(formData.total_amount || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {document.extracted_data?.confidence && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-800">
                    AI Confidence: {(document.extracted_data.confidence * 100).toFixed(0)}%
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleBook}
            disabled={booking}
            className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400"
          >
            <Save className="w-4 h-4" />
            {booking ? 'Booking...' : 'Boek In'}
          </button>
        </div>
      </div>
    </div>
  );
}
