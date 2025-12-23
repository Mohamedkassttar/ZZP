import { useState } from 'react';
import { X, Mail, AlertCircle, CheckCircle } from 'lucide-react';

interface ResendInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceNumber: string;
  defaultEmail: string;
  onResend: (email: string) => Promise<{ success: boolean; message: string }>;
}

export function ResendInvoiceModal({
  isOpen,
  onClose,
  invoiceNumber,
  defaultEmail,
  onResend,
}: ResendInvoiceModalProps) {
  const [email, setEmail] = useState(defaultEmail);
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim() || !email.includes('@')) {
      setResult({
        success: false,
        message: 'Voer een geldig emailadres in',
      });
      return;
    }

    setIsSending(true);
    setResult(null);

    try {
      const response = await onResend(email);
      setResult(response);

      if (response.success) {
        setTimeout(() => {
          onClose();
          setResult(null);
        }, 2000);
      }
    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : 'Onbekende fout',
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-md flex-col rounded-xl bg-white shadow-2xl">
        <div className="flex-none flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Mail className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Factuur versturen
              </h2>
              <p className="text-sm text-slate-600">{invoiceNumber}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
            disabled={isSending}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Emailadres ontvanger
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="naam@voorbeeld.nl"
                disabled={isSending}
                required
              />
              <p className="text-xs text-slate-500 mt-2">
                Dit adres wordt opgeslagen bij de factuur
              </p>
            </div>

            {result && (
              <div
                className={`mb-4 p-4 rounded-lg flex items-start gap-3 ${
                  result.success
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-red-50 border border-red-200'
                }`}
              >
                {result.success ? (
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                )}
                <p
                  className={`text-sm ${
                    result.success ? 'text-green-800' : 'text-red-800'
                  }`}
                >
                  {result.message}
                </p>
              </div>
            )}
          </div>

          <div className="flex-none sticky bottom-0 z-10 border-t bg-gray-50 px-6 py-4">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition-colors"
                disabled={isSending}
              >
                Annuleren
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                disabled={isSending}
              >
                {isSending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Versturen...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4" />
                    Versturen
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
