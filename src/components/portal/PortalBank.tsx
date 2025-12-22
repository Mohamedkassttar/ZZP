import { useState, useEffect } from 'react';
import { Upload as UploadIcon, Zap, CheckCircle, Loader2, DollarSign } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { PortalUpload } from './PortalUpload';
import { bookBankTransaction } from '../../lib/bankService';
import { analyzeTransaction } from '../../lib/bankAutomationService';
import type { Database } from '../../lib/database.types';

type BankTransaction = Database['public']['Tables']['bank_transactions']['Row'];
type Account = Database['public']['Tables']['accounts']['Row'];

interface ProcessProgress {
  current: number;
  total: number;
  status: string;
}

export function PortalBank() {
  const [activeTab, setActiveTab] = useState<'upload' | 'process'>('upload');
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedPrivateIds, setSelectedPrivateIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState<ProcessProgress | null>(null);
  const [result, setResult] = useState<{ private: number; ai: number; skipped: number } | null>(null);

  useEffect(() => {
    if (activeTab === 'process') {
      loadUnmatchedTransactions();
    }
  }, [activeTab]);

  async function loadUnmatchedTransactions() {
    setLoading(true);
    try {
      const [txnsRes, accountsRes] = await Promise.all([
        supabase
          .from('bank_transactions')
          .select('*')
          .eq('status', 'Unmatched')
          .order('transaction_date', { ascending: false })
          .limit(100),
        supabase
          .from('accounts')
          .select('*')
          .eq('is_active', true),
      ]);

      setTransactions(txnsRes.data || []);
      setAccounts(accountsRes.data || []);
    } catch (error) {
      console.error('Failed to load transactions:', error);
    } finally {
      setLoading(false);
    }
  }

  function togglePrivate(txnId: string) {
    const newSelected = new Set(selectedPrivateIds);
    if (newSelected.has(txnId)) {
      newSelected.delete(txnId);
    } else {
      newSelected.add(txnId);
    }
    setSelectedPrivateIds(newSelected);
  }

  async function handleProcess() {
    const unmatchedTxns = transactions.filter(t => t.status === 'Unmatched');

    if (unmatchedTxns.length === 0) {
      alert('Geen onverwerkte transacties');
      return;
    }

    setProcessing(true);
    setResult(null);

    let bookedPrivate = 0;
    let bookedAI = 0;
    let skipped = 0;

    const privateTxns = unmatchedTxns.filter(t => selectedPrivateIds.has(t.id));
    const nonPrivateTxns = unmatchedTxns.filter(t => !selectedPrivateIds.has(t.id));

    const totalToProcess = unmatchedTxns.length;
    let currentIndex = 0;

    try {
      if (privateTxns.length > 0) {
        const privateAccount = accounts.find(a => a.code === '510' && a.type === 'Equity');

        if (!privateAccount) {
          alert('Privé rekening (510 - Privé opname) niet gevonden');
          setProcessing(false);
          return;
        }

        for (const txn of privateTxns) {
          currentIndex++;
          setProgress({
            current: currentIndex,
            total: totalToProcess,
            status: `Privé verwerken: ${currentIndex} van ${totalToProcess}...`,
          });

          try {
            const result = await bookBankTransaction(
              txn.id,
              privateAccount.id,
              txn.description || 'Privé opname'
            );

            if (result.success) {
              bookedPrivate++;
            } else {
              skipped++;
            }
          } catch (err) {
            console.error(`Failed to process private transaction ${txn.id}:`, err);
            skipped++;
          }

          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      for (const txn of nonPrivateTxns) {
        currentIndex++;
        setProgress({
          current: currentIndex,
          total: totalToProcess,
          status: `AI verwerken: ${currentIndex} van ${totalToProcess}...`,
        });

        try {
          const confidence = await analyzeTransaction(txn);

          if (confidence.score < 70) {
            skipped++;
            await new Promise(resolve => setTimeout(resolve, 300));
            continue;
          }

          const { accountId, description } = confidence.suggestion;

          if (!accountId) {
            skipped++;
            await new Promise(resolve => setTimeout(resolve, 300));
            continue;
          }

          const result = await bookBankTransaction(
            txn.id,
            accountId,
            description || txn.description
          );

          if (result.success) {
            bookedAI++;
          } else {
            skipped++;
          }
        } catch (err) {
          console.error(`Failed to process AI transaction ${txn.id}:`, err);
          skipped++;
        }

        await new Promise(resolve => setTimeout(resolve, 300));
      }

      setResult({ private: bookedPrivate, ai: bookedAI, skipped });
      await loadUnmatchedTransactions();
      setSelectedPrivateIds(new Set());
    } catch (error) {
      console.error('Processing failed:', error);
      alert('Er ging iets fout bij het verwerken');
    } finally {
      setProcessing(false);
      setProgress(null);
    }
  }

  if (result) {
    return (
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-3xl shadow-xl p-8 text-center border border-gray-100">
          <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Verwerking Voltooid!</h2>

          <div className="text-left mb-8 space-y-3">
            {result.private > 0 && (
              <div className="bg-blue-50 rounded-2xl p-4">
                <p className="text-sm text-gray-600 mb-1">Privé geboekt</p>
                <p className="text-2xl font-bold text-blue-900">{result.private}</p>
              </div>
            )}

            {result.ai > 0 && (
              <div className="bg-green-50 rounded-2xl p-4">
                <p className="text-sm text-gray-600 mb-1">AI geboekt</p>
                <p className="text-2xl font-bold text-green-900">{result.ai}</p>
              </div>
            )}

            {result.skipped > 0 && (
              <div className="bg-yellow-50 rounded-2xl p-4">
                <p className="text-sm text-gray-600 mb-1">Overgeslagen</p>
                <p className="text-xl font-bold text-yellow-900">{result.skipped}</p>
              </div>
            )}
          </div>

          <button
            onClick={() => {
              setResult(null);
              setActiveTab('upload');
            }}
            className="w-full bg-blue-600 text-white py-4 rounded-2xl font-semibold hover:bg-blue-700 transition-colors shadow-lg"
          >
            Klaar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-2">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setActiveTab('upload')}
            className={`py-3 px-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'upload'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <UploadIcon className="w-5 h-5" />
            Upload
          </button>
          <button
            onClick={() => setActiveTab('process')}
            className={`py-3 px-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'process'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Zap className="w-5 h-5" />
            Verwerk
          </button>
        </div>
      </div>

      {activeTab === 'upload' ? (
        <PortalUpload type="bank" />
      ) : (
        <div className="space-y-4">
          {processing && progress ? (
            <div className="bg-white rounded-3xl shadow-xl p-8 text-center border border-gray-100">
              <Loader2 className="w-16 h-16 text-blue-600 animate-spin mx-auto mb-4" />
              <p className="text-lg font-semibold text-gray-900 mb-2">{progress.status}</p>
              <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
                <div
                  className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
              <p className="text-sm text-gray-600">
                {progress.current} van {progress.total} transacties verwerkt
              </p>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="bg-white rounded-3xl shadow-md p-8 text-center border border-gray-100">
              <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-gray-900 mb-2">Alles verwerkt!</h3>
              <p className="text-gray-600 mb-6">Er zijn geen openstaande transacties meer.</p>
              <button
                onClick={() => setActiveTab('upload')}
                className="bg-blue-600 text-white py-3 px-6 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
              >
                Nieuw bestand uploaden
              </button>
            </div>
          ) : (
            <>
              <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4 mb-4">
                <p className="text-sm text-blue-900 font-medium mb-1">
                  {transactions.length} {transactions.length === 1 ? 'transactie' : 'transacties'} te verwerken
                </p>
                <p className="text-xs text-blue-700">
                  Vink privé uitgaven aan, klik dan op "Verwerk"
                </p>
              </div>

              <div className="space-y-3">
                {transactions.map((txn) => {
                  const isPrivate = selectedPrivateIds.has(txn.id);
                  const isNegative = txn.amount < 0;

                  return (
                    <div
                      key={txn.id}
                      className={`bg-white rounded-2xl shadow-md border-2 p-4 transition-all ${
                        isPrivate ? 'border-blue-400 bg-blue-50' : 'border-gray-100'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0 pr-3">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {txn.contra_name || 'Onbekend'}
                          </p>
                          <p className="text-xs text-gray-600 truncate">{txn.description}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(txn.transaction_date).toLocaleDateString('nl-NL')}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p
                            className={`text-lg font-bold ${
                              isNegative ? 'text-red-600' : 'text-green-600'
                            }`}
                          >
                            {new Intl.NumberFormat('nl-NL', {
                              style: 'currency',
                              currency: 'EUR',
                            }).format(txn.amount)}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => togglePrivate(txn.id)}
                        className={`w-full py-2 px-4 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
                          isPrivate
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        <DollarSign className="w-4 h-4" />
                        {isPrivate ? 'Privé (aangevinkt)' : 'Markeer als Privé'}
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="sticky bottom-20 mt-6">
                <button
                  onClick={handleProcess}
                  disabled={processing}
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-5 rounded-2xl font-bold hover:from-blue-700 hover:to-blue-800 transition-all shadow-xl flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Zap className="w-6 h-6" />
                  Verwerk {transactions.length} {transactions.length === 1 ? 'Transactie' : 'Transacties'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
