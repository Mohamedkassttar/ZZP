import { useState, useEffect } from 'react';
import { Sparkles, Loader, CheckCircle, XCircle, Building2, Receipt, Tag } from 'lucide-react';
import type { Database } from '../lib/database.types';
import type { AIReconciliationSuggestion } from '../lib/aiReconciliationService';
import { analyzeUnmatchedTransaction, bookUnmatchedTransaction } from '../lib/aiReconciliationService';
import { supabase } from '../lib/supabase';

type BankTransaction = Database['public']['Tables']['bank_transactions']['Row'];
type Account = Database['public']['Tables']['accounts']['Row'];

interface AIReconciliationCardProps {
  transaction: BankTransaction;
  onComplete: () => void;
}

export function AIReconciliationCard({ transaction, onComplete }: AIReconciliationCardProps) {
  const [analyzing, setAnalyzing] = useState(false);
  const [booking, setBooking] = useState(false);
  const [suggestion, setSuggestion] = useState<AIReconciliationSuggestion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [creditorName, setCreditorName] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [vatCode, setVatCode] = useState(21);
  const [setAsDefault, setSetAsDefault] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);

  useEffect(() => {
    loadAccounts();
    analyzeTransaction();
  }, []);

  async function loadAccounts() {
    const { data } = await supabase
      .from('accounts')
      .select('*')
      .eq('is_active', true);

    if (data) {
      const sortedAccounts = data.sort((a, b) => {
        const numA = parseInt(a.code);
        const numB = parseInt(b.code);
        return numA - numB;
      });
      setAccounts(sortedAccounts);
    }
  }

  async function analyzeTransaction() {
    setAnalyzing(true);
    setError(null);

    try {
      // CRITICAL: Use contra_name (counterparty) if available, fallback to description
      // This prevents AI from being confused by payment processor noise
      const analysisText = transaction.contra_name && transaction.contra_name.length > 2
        ? transaction.contra_name
        : transaction.description;

      console.log('\n' + '═'.repeat(60));
      console.log('[AI CARD] Starting transaction analysis');
      console.log(`Input text: "${analysisText}"`);
      console.log(`Source: ${transaction.contra_name ? 'contra_name' : 'description'}`);
      console.log(`Amount: €${transaction.amount}`);
      console.log('═'.repeat(60));

      const result = await analyzeUnmatchedTransaction(
        analysisText,
        transaction.amount
      );

      console.log('[AI CARD] Analysis successful');

      setSuggestion(result);
      setCreditorName(result.suggested_creditor);
      setSelectedAccountId(result.suggested_ledger_id);
      setVatCode(result.likely_vat_code);
    } catch (err) {
      console.error('[AI CARD] Analysis failed:', err);
      const errorMessage = err instanceof Error ? err.message : 'AI analysis failed - unknown error';
      console.error('[AI CARD] Error message:', errorMessage);
      setError(errorMessage);
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleBookTransaction() {
    const hasNewLedgerProposal = suggestion?.new_ledger_proposal && !selectedAccountId;

    if (!creditorName.trim()) {
      setError('Please fill in creditor name');
      return;
    }

    if (!selectedAccountId && !hasNewLedgerProposal) {
      setError('Please select an account or accept the new account proposal');
      return;
    }

    setBooking(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await bookUnmatchedTransaction({
        bankTransactionId: transaction.id,
        creditorName: creditorName.trim(),
        creditorId: suggestion?.existing_contact_id,
        ledgerAccountId: selectedAccountId || null,
        newLedgerProposal: hasNewLedgerProposal ? suggestion.new_ledger_proposal : undefined,
        vatCode: vatCode,
        amount: transaction.amount,
        transactionDate: transaction.transaction_date,
        description: transaction.description,
        setAsDefault: setAsDefault,
      });

      if (result.success) {
        setSuccess('Transaction booked successfully!');
        setTimeout(() => {
          onComplete();
        }, 1500);
      } else {
        setError(result.error || 'Failed to book transaction');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Booking failed');
    } finally {
      setBooking(false);
    }
  }

  if (analyzing) {
    return (
      <div className="bg-purple-50 rounded border border-purple-200 p-2">
        <div className="flex items-center gap-1.5 text-purple-700">
          <Loader className="w-3 h-3 animate-spin" />
          <span className="text-xs">AI analyseert...</span>
        </div>
      </div>
    );
  }

  if (error && !suggestion) {
    return (
      <div className="bg-red-50 rounded border border-red-200 p-2">
        <div className="flex items-center gap-1.5 text-red-700">
          <XCircle className="w-3 h-3" />
          <span className="text-xs">{error}</span>
        </div>
        <button
          onClick={analyzeTransaction}
          className="text-xs text-red-600 hover:text-red-700 ml-auto"
        >
          Opnieuw
        </button>
      </div>
    );
  }

  return (
    <div className="bg-purple-50 rounded border border-purple-200 p-2">
      <div className="flex items-center gap-1.5 mb-2">
        <Sparkles className="w-3 h-3 text-purple-600" />
        <h3 className="text-xs font-semibold text-slate-900">
          AI suggestie {suggestion && `(${(suggestion.confidence * 100).toFixed(0)}%)`}
        </h3>
      </div>

      {success && (
        <div className="mb-1.5 p-1.5 bg-green-50 border border-green-200 rounded flex items-center gap-1">
          <CheckCircle className="w-3 h-3 text-green-600" />
          <span className="text-xs text-green-800">{success}</span>
        </div>
      )}

      {error && suggestion && (
        <div className="mb-1.5 p-1.5 bg-red-50 border border-red-200 rounded flex items-center gap-1">
          <XCircle className="w-3 h-3 text-red-600" />
          <span className="text-xs text-red-800">{error}</span>
        </div>
      )}

      <div className="bg-white rounded p-1.5 mb-2">
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div>
            <span className="text-gray-500">{new Date(transaction.transaction_date).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit' })}</span>
          </div>
          <div className="text-right">
            <span className={`font-medium ${transaction.amount < 0 ? 'text-red-600' : 'text-green-600'}`}>
              €{Math.abs(transaction.amount).toFixed(2)}
            </span>
          </div>
          <div className="col-span-3">
            <p className="text-slate-900 truncate">{transaction.description}</p>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Crediteur {suggestion?.is_new_creditor && <span className="text-purple-600">(Nieuw)</span>}
          </label>
          <input
            type="text"
            value={creditorName}
            onChange={(e) => setCreditorName(e.target.value)}
            className="w-full px-2 py-1 text-xs border border-purple-200 rounded focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
            placeholder="Naam"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Grootboek
          </label>

          {suggestion?.new_ledger_proposal ? (
            <div className="space-y-1.5">
              <div className="p-1.5 bg-green-50 border border-green-200 rounded">
                <div className="flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-green-600" />
                  <p className="text-xs font-semibold text-green-900">
                    {suggestion.new_ledger_proposal.code} - {suggestion.new_ledger_proposal.name}
                  </p>
                </div>
              </div>

              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="w-full px-2 py-1 text-xs border border-purple-200 rounded focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="">Gebruik AI suggestie</option>
                {(() => {
                  const isIncoming = transaction.amount > 0;
                  const grouped = {
                    Revenue: accounts.filter(a => a.type === 'Revenue'),
                    Expense: accounts.filter(a => a.type === 'Expense'),
                    Asset: accounts.filter(a => a.type === 'Asset'),
                    Liability: accounts.filter(a => a.type === 'Liability'),
                    Equity: accounts.filter(a => a.type === 'Equity'),
                  };

                  const order = isIncoming
                    ? ['Revenue', 'Equity', 'Liability', 'Asset', 'Expense']
                    : ['Expense', 'Liability', 'Asset', 'Revenue', 'Equity'];

                  const labels = {
                    Revenue: 'Omzet (Revenue)',
                    Expense: 'Kosten (Expenses)',
                    Asset: 'Activa (Assets)',
                    Liability: 'Passiva (Liabilities)',
                    Equity: 'Eigen Vermogen (Equity)',
                  };

                  return order.map(type =>
                    grouped[type as keyof typeof grouped].length > 0 && (
                      <optgroup key={type} label={labels[type as keyof typeof labels]}>
                        {grouped[type as keyof typeof grouped].map(account => (
                          <option key={account.id} value={account.id}>
                            {account.code} - {account.name}
                          </option>
                        ))}
                      </optgroup>
                    )
                  );
                })()}
              </select>
            </div>
          ) : (
            <>
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="w-full px-2 py-1 text-xs border border-purple-200 rounded focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="">Selecteer...</option>
                {(() => {
                  const isIncoming = transaction.amount > 0;
                  const grouped = {
                    Revenue: accounts.filter(a => a.type === 'Revenue'),
                    Expense: accounts.filter(a => a.type === 'Expense'),
                    Asset: accounts.filter(a => a.type === 'Asset'),
                    Liability: accounts.filter(a => a.type === 'Liability'),
                    Equity: accounts.filter(a => a.type === 'Equity'),
                  };

                  const order = isIncoming
                    ? ['Revenue', 'Equity', 'Liability', 'Asset', 'Expense']
                    : ['Expense', 'Liability', 'Asset', 'Revenue', 'Equity'];

                  const labels = {
                    Revenue: 'Omzet (Revenue)',
                    Expense: 'Kosten (Expenses)',
                    Asset: 'Activa (Assets)',
                    Liability: 'Passiva (Liabilities)',
                    Equity: 'Eigen Vermogen (Equity)',
                  };

                  return order.map(type =>
                    grouped[type as keyof typeof grouped].length > 0 && (
                      <optgroup key={type} label={labels[type as keyof typeof labels]}>
                        {grouped[type as keyof typeof grouped].map(account => (
                          <option key={account.id} value={account.id}>
                            {account.code} - {account.name}
                          </option>
                        ))}
                      </optgroup>
                    )
                  );
                })()}
              </select>
              {suggestion && (
                <p className="text-xs text-slate-500 mt-1">
                  AI suggestion: {suggestion.suggested_ledger_code} - {suggestion.suggested_ledger_name}
                </p>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <input
            type="checkbox"
            id="setAsDefault"
            checked={setAsDefault}
            onChange={(e) => setSetAsDefault(e.target.checked)}
            className="w-3 h-3 text-purple-600 border-gray-300 rounded focus:ring-1 focus:ring-purple-500"
          />
          <label htmlFor="setAsDefault" className="text-xs text-slate-700 cursor-pointer">
            Stel in als standaard grootboek voor deze leverancier
          </label>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">BTW</label>
            <select
              value={vatCode}
              onChange={(e) => setVatCode(Number(e.target.value))}
              className="w-full px-2 py-1 text-xs border border-purple-200 rounded focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
            >
              <option value={21}>21%</option>
              <option value={9}>9%</option>
              <option value={0}>0%</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={handleBookTransaction}
              disabled={booking || !creditorName.trim() || (!selectedAccountId && !suggestion?.new_ledger_proposal)}
              className="w-full flex items-center justify-center gap-1 px-2 py-1 bg-purple-600 text-white rounded text-xs font-medium hover:bg-purple-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {booking ? (
                <>
                  <Loader className="w-3 h-3 animate-spin" />
                  <span>Bezig...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-3 h-3" />
                  <span>Boek</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
