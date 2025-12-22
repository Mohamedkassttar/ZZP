import { useState, useEffect, useRef } from 'react';
import { Upload, Loader, CheckCircle, XCircle, DollarSign, ArrowRight, Sparkles, Zap } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { bookBankTransaction, bookBankTransactionViaRelatie } from '../lib/bankService';
import { AIReconciliationCard } from './AIReconciliationCard';
import { analyzeTransaction } from '../lib/bankAutomationService';
import { matchTransactionWithRules, matchTransactionWithContact, createBankRule } from '../lib/bankRulesService';
import { reclassifyBankTransaction } from '../lib/reclassificationService';
import { getCurrentCompanyId } from '../lib/companyHelper';
import type { Database } from '../lib/database.types';

type Account = Database['public']['Tables']['accounts']['Row'];
type BankTransaction = Database['public']['Tables']['bank_transactions']['Row'];

type BankTransactionWithLedger = BankTransaction & {
  ledgerAccount?: { id: string; code: string; name: string } | null;
  aiSuggestion?: any;
};

interface BulkProcessProgress {
  current: number;
  total: number;
  status: string;
}

export function Bank() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<BankTransactionWithLedger[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTransaction, setSelectedTransaction] = useState<BankTransaction | null>(null);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [bookingDescription, setBookingDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<BulkProcessProgress | null>(null);
  const [bankAccountId, setBankAccountId] = useState<string>('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuccess, setAiSuccess] = useState(false);
  const [createRule, setCreateRule] = useState(false);
  const [ruleKeyword, setRuleKeyword] = useState('');
  const [reclassifyingTxnId, setReclassifyingTxnId] = useState<string | null>(null);
  const [selectedContact, setSelectedContact] = useState<string>('');
  const [contacts, setContacts] = useState<any[]>([]);
  const [setAsDefault, setSetAsDefault] = useState(false);
  const [matchedContact, setMatchedContact] = useState<any | null>(null);
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [bookingMode, setBookingMode] = useState<'direct' | 'via-relatie'>('direct');
  const [showNewRelationModal, setShowNewRelationModal] = useState(false);
  const [newRelationName, setNewRelationName] = useState('');
  const [newRelationDefaultAccount, setNewRelationDefaultAccount] = useState('');
  const [selectedPrivateIds, setSelectedPrivateIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedTransaction && selectedTransaction.contra_name && contacts.length > 0) {
      const contraName = selectedTransaction.contra_name.toLowerCase().trim();
      const found = contacts.find(c =>
        c.company_name.toLowerCase().trim() === contraName
      );

      if (found) {
        setMatchedContact(found);
        setSelectedContact(found.id);
        if (found.default_ledger_account_id) {
          setSelectedAccount(found.default_ledger_account_id);
        }
        setShowAddSupplier(false);
      } else {
        setMatchedContact(null);
        setNewSupplierName(selectedTransaction.contra_name);
        setShowAddSupplier(true);
      }
    } else {
      setMatchedContact(null);
      setShowAddSupplier(false);
    }
  }, [selectedTransaction, contacts]);

  async function loadData() {
    try {
      const companyId = await getCurrentCompanyId();
      if (!companyId) throw new Error('Geen bedrijf geselecteerd');

      const [accountsRes, transactionsRes, contactsRes] = await Promise.all([
        supabase.from('accounts').select('*').eq('is_active', true).eq('company_id', companyId),
        supabase
          .from('bank_transactions')
          .select('*')
          .eq('company_id', companyId)
          .order('transaction_date', { ascending: false }),
        supabase
          .from('contacts')
          .select('*')
          .eq('is_active', true)
          .eq('company_id', companyId)
          .order('company_name'),
      ]);

      if (accountsRes.data) {
        const sortedAccounts = accountsRes.data.sort((a, b) => {
          const numA = parseInt(a.code);
          const numB = parseInt(b.code);
          return numA - numB;
        });
        setAccounts(sortedAccounts);
        const bankAccount = sortedAccounts.find(a => a.code === '1100');
        if (bankAccount) {
          setBankAccountId(bankAccount.id);
        }
      }

      if (transactionsRes.data) {
        const enrichedTransactions = await Promise.all(
          transactionsRes.data.map(async (txn) => {
            let aiSuggestion = null;
            try {
              aiSuggestion = txn.ai_suggestion ? JSON.parse(txn.ai_suggestion as string) : null;
            } catch (e) {
              console.warn('Failed to parse ai_suggestion:', e);
            }

            if (txn.journal_entry_id) {
              const { data: journalLines } = await supabase
                .from('journal_lines')
                .select('account_id, accounts!inner(id, code, name, type)')
                .eq('journal_entry_id', txn.journal_entry_id);

              const nonBankLine = journalLines?.find(
                (line: any) => line.accounts?.type !== 'Asset' || !line.accounts?.code?.startsWith('10')
              );

              if (nonBankLine) {
                return {
                  ...txn,
                  ledgerAccount: {
                    id: nonBankLine.accounts.id,
                    code: nonBankLine.accounts.code,
                    name: nonBankLine.accounts.name,
                  },
                  aiSuggestion,
                };
              }
            }
            return { ...txn, ledgerAccount: null, aiSuggestion };
          })
        );
        setTransactions(enrichedTransactions);
      }

      if (contactsRes.data) {
        setContacts(contactsRes.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }


  async function handleReclassify(txnId: string, newAccountId: string) {
    if (!newAccountId) return;

    setReclassifyingTxnId(txnId);
    setError(null);

    try {
      const result = await reclassifyBankTransaction(txnId, newAccountId);

      if (result.success) {
        const account = accounts.find((a) => a.id === newAccountId);
        setSuccess(`Boeking verplaatst naar ${account?.code} - ${account?.name}`);
        await loadData();
      } else {
        setError(result.error || 'Failed to reclassify transaction');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reclassify transaction');
    } finally {
      setReclassifyingTxnId(null);
    }
  }

  async function handleAddSupplier() {
    if (!newSupplierName.trim() || !selectedAccount) {
      setError('Please provide supplier name and select a ledger account');
      return;
    }

    try {
      const companyId = await getCurrentCompanyId();
      if (!companyId) throw new Error('Geen bedrijf geselecteerd');

      const { data: newContact, error: insertError } = await supabase
        .from('contacts')
        .insert({
          company_name: newSupplierName.trim(),
          relation_type: 'Supplier',
          default_ledger_account_id: selectedAccount,
          is_active: true,
          company_id: companyId,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      if (newContact) {
        setMatchedContact(newContact);
        setSelectedContact(newContact.id);
        setShowAddSupplier(false);
        await loadData();
        setSuccess(`Supplier "${newSupplierName}" added successfully with default ledger account`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add supplier');
    }
  }

  async function handleCreateNewRelation() {
    if (!newRelationName.trim()) {
      setError('Naam is verplicht');
      return;
    }

    if (!newRelationDefaultAccount) {
      setError('Selecteer een standaard grootboekrekening');
      return;
    }

    try {
      const companyId = await getCurrentCompanyId();
      if (!companyId) throw new Error('Geen bedrijf geselecteerd');

      const relationType = selectedTransaction && selectedTransaction.amount > 0 ? 'Customer' : 'Supplier';

      const { data: newContact, error: insertError } = await supabase
        .from('contacts')
        .insert({
          company_name: newRelationName.trim(),
          relation_type: relationType,
          default_ledger_account_id: newRelationDefaultAccount,
          is_active: true,
          company_id: companyId,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      if (newContact) {
        await loadData();

        setSelectedContact(newContact.id);
        setSelectedAccount(newRelationDefaultAccount);
        setMatchedContact(newContact);

        setShowNewRelationModal(false);
        setNewRelationName('');
        setNewRelationDefaultAccount('');

        setSuccess(`${relationType === 'Customer' ? 'Debiteur' : 'Leverancier'} "${newRelationName}" succesvol aangemaakt`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fout bij aanmaken relatie');
    }
  }

  async function handleUpdateDefaultLedger() {
    if (!matchedContact || !selectedAccount) return;

    try {
      const companyId = await getCurrentCompanyId();
      if (!companyId) throw new Error('Geen bedrijf geselecteerd');

      const { error: updateError } = await supabase
        .from('contacts')
        .update({ default_ledger_account_id: selectedAccount })
        .eq('id', matchedContact.id)
        .eq('company_id', companyId);

      if (updateError) throw updateError;

      setSuccess(`Default ledger account set for "${matchedContact.company_name}"`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update default ledger');
    }
  }

  async function handleAiSuggest() {
    if (!selectedTransaction) return;

    setAiLoading(true);
    setAiSuccess(false);
    setError(null);

    try {
      const confidence = await analyzeTransaction(selectedTransaction);

      if (confidence.suggestion.accountId) {
        setSelectedAccount(confidence.suggestion.accountId);
      }

      if (confidence.suggestion.contactId) {
        setSelectedContact(confidence.suggestion.contactId);
        setBookingMode('via-relatie');
      } else {
        setBookingMode('direct');
      }

      if (confidence.suggestion.description) {
        setBookingDescription(confidence.suggestion.description);
      }

      setAiSuccess(true);
      setTimeout(() => setAiSuccess(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI suggestion failed');
    } finally {
      setAiLoading(false);
    }
  }

  async function handleBookTransaction() {
    if (!selectedTransaction || !selectedAccount) return;

    if (bookingMode === 'via-relatie' && !selectedContact) {
      setError('Selecteer een relatie');
      return;
    }

    setError(null);

    if (setAsDefault && selectedContact && selectedAccount) {
      const companyId = await getCurrentCompanyId();
      if (!companyId) throw new Error('Geen bedrijf geselecteerd');

      const { error: updateContactError } = await supabase
        .from('contacts')
        .update({ default_ledger_account_id: selectedAccount })
        .eq('id', selectedContact)
        .eq('company_id', companyId);

      if (updateContactError) {
        console.warn('Failed to set default ledger account:', updateContactError);
      }
    }

    if (createRule && ruleKeyword.trim()) {
      const ruleResult = await createBankRule({
        keyword: ruleKeyword.trim(),
        targetAccountId: selectedAccount,
      });

      if (!ruleResult.success) {
        setError(`Rule creation failed: ${ruleResult.error}`);
        return;
      }
    }

    let result;
    if (bookingMode === 'via-relatie') {
      result = await bookBankTransactionViaRelatie(
        selectedTransaction.id,
        selectedContact,
        selectedAccount,
        bookingDescription || selectedTransaction.description
      );
    } else {
      result = await bookBankTransaction(
        selectedTransaction.id,
        selectedAccount,
        bookingDescription || selectedTransaction.description
      );
    }

    if (result.success) {
      const message = createRule && ruleKeyword.trim()
        ? `Transaction booked and rule created for "${ruleKeyword}"`
        : 'Transaction booked successfully';
      setSuccess(message);
      setSelectedTransaction(null);
      setSelectedAccount('');
      setBookingDescription('');
      setSelectedContact('');
      setSetAsDefault(false);
      setMatchedContact(null);
      setShowAddSupplier(false);
      setNewSupplierName('');
      setAiLoading(false);
      setAiSuccess(false);
      setCreateRule(false);
      setRuleKeyword('');
      setBookingMode('direct');
      setShowNewRelationModal(false);
      setNewRelationName('');
      setNewRelationDefaultAccount('');
      await loadData();
    } else {
      setError(result.error || 'Failed to book transaction');
    }
  }

  async function handleAutoProcess() {
    const unmatchedTxns = transactions.filter(t => t.status === 'Unmatched');

    if (unmatchedTxns.length === 0) {
      setError('Geen onverwerkte transacties');
      return;
    }

    setBulkProcessing(true);
    setError(null);
    setSuccess(null);

    let bookedPrivate = 0;
    let bookedAI = 0;
    let skipped = 0;

    // FASE A: Verwerk Privé Uitgaven (met checkbox aangevinkt)
    const privateTxns = unmatchedTxns.filter(t => selectedPrivateIds.has(t.id));
    const nonPrivateTxns = unmatchedTxns.filter(t => !selectedPrivateIds.has(t.id));

    const totalToProcess = unmatchedTxns.length;
    let currentIndex = 0;

    if (privateTxns.length > 0) {
      // Find private withdrawal account (code 510 - Privé opname)
      const privateAccount = accounts.find(a => a.code === '510' && a.type === 'Equity');

      if (!privateAccount) {
        setError('Privé rekening (510 - Privé opname) niet gevonden');
        setBulkProcessing(false);
        return;
      }

      for (const txn of privateTxns) {
        currentIndex++;
        setBulkProgress({
          current: currentIndex,
          total: totalToProcess,
          status: `Privé verwerken: ${currentIndex} van ${totalToProcess}...`
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

    // FASE B: Verwerk overige transacties via AI
    for (const txn of nonPrivateTxns) {
      currentIndex++;
      setBulkProgress({
        current: currentIndex,
        total: totalToProcess,
        status: `AI verwerken: ${currentIndex} van ${totalToProcess}...`
      });

      try {
        const confidence = await analyzeTransaction(txn);

        if (confidence.score < 70) {
          skipped++;
          await new Promise(resolve => setTimeout(resolve, 300));
          continue;
        }

        const { mode, accountId, contactId, description } = confidence.suggestion;

        if (!accountId) {
          skipped++;
          await new Promise(resolve => setTimeout(resolve, 300));
          continue;
        }

        let result;
        if (mode === 'relation' && contactId) {
          result = await bookBankTransactionViaRelatie(
            txn.id,
            contactId,
            accountId,
            description || txn.description
          );
        } else {
          result = await bookBankTransaction(
            txn.id,
            accountId,
            description || txn.description
          );
        }

        if (result.success) {
          bookedAI++;
        } else {
          skipped++;
        }

        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (err) {
        console.error(`Failed to process transaction ${txn.id}:`, err);
        skipped++;
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    setBulkProcessing(false);
    setBulkProgress(null);
    setSelectedPrivateIds(new Set());

    const totalBooked = bookedPrivate + bookedAI;
    setSuccess(
      `Klaar! ${totalBooked} transacties geboekt (${bookedPrivate} privé, ${bookedAI} via AI), ${skipped} overgeslagen.`
    );
    await loadData();
  }

  function getStatusColor(status: BankTransaction['status']) {
    switch (status) {
      case 'Unmatched':
        return 'text-orange-600';
      case 'Matched':
        return 'text-blue-600';
      case 'Booked':
        return 'text-green-600';
      default:
        return 'text-gray-600';
    }
  }

  const unmatchedTransactions = transactions.filter((t) => t.status === 'Unmatched');
  // Count all transactions with a journal_entry_id as "booked", regardless of status
  const bookedTransactions = transactions.filter((t) => t.journal_entry_id !== null);

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
        <h1 className="text-2xl font-bold text-gray-900">Bank Reconciliatie</h1>
        <p className="text-sm text-gray-500">Te verwerken transacties (to-do lijst)</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="text-red-800">{error}</div>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div className="text-green-800">{success}</div>
        </div>
      )}


      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-lg border border-gray-200 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Ongeboekt</span>
            <span className="text-xl font-semibold text-orange-600">{unmatchedTransactions.length}</span>
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Geboekt</span>
            <span className="text-xl font-semibold text-green-600">{bookedTransactions.length}</span>
          </div>
        </div>
      </div>

      {unmatchedTransactions.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sparkles className="w-6 h-6 text-purple-600" />
              <h2 className="text-2xl font-bold text-slate-900">AI Bank Reconciliation</h2>
            </div>
            <button
              onClick={handleAutoProcess}
              disabled={bulkProcessing}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg hover:from-emerald-700 hover:to-teal-700 transition-all font-semibold shadow-lg disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed"
            >
              <Zap className="w-5 h-5" />
              {bulkProcessing ? 'Bezig...' : 'Auto verwerk'}
            </button>
          </div>

          {bulkProgress && (
            <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-300 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-slate-900">{bulkProgress.status}</span>
                <span className="text-sm text-slate-600">{bulkProgress.current} / {bulkProgress.total}</span>
              </div>
              <div className="w-full bg-white rounded-full h-3 overflow-hidden shadow-inner">
                <div
                  className="bg-gradient-to-r from-blue-500 to-purple-500 h-full transition-all duration-300"
                  style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      <div className="rounded-lg border border-gray-200 shadow-sm">
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">Transacties</h2>
        </div>

        {unmatchedTransactions.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-400" />
            <p className="text-xs font-medium text-green-700">Alles verwerkt!</p>
            <p className="text-xs text-gray-500 mt-1">Er zijn geen openstaande transacties.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="h-10 bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-2 text-center text-xs uppercase tracking-wide whitespace-nowrap">Privé</th>
                  <th className="px-3 py-2 text-left text-xs uppercase tracking-wide whitespace-nowrap">Datum</th>
                  <th className="px-3 py-2 text-left text-xs uppercase tracking-wide">Omschrijving</th>
                  <th className="px-3 py-2 text-left text-xs uppercase tracking-wide">Tegenpartij</th>
                  <th className="px-3 py-2 text-left text-xs uppercase tracking-wide">Grootboek</th>
                  <th className="px-3 py-2 text-right text-xs uppercase tracking-wide whitespace-nowrap">Bedrag</th>
                  <th className="px-3 py-2 text-left text-xs uppercase tracking-wide whitespace-nowrap">Status</th>
                  <th className="px-3 py-2 text-right text-xs uppercase tracking-wide">Actie</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {unmatchedTransactions.map((txn, index) => (
                  <>
                    <tr key={`txn-${txn.id}`} className="h-10 border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={selectedPrivateIds.has(txn.id)}
                          onChange={(e) => {
                            const newSet = new Set(selectedPrivateIds);
                            if (e.target.checked) {
                              newSet.add(txn.id);
                            } else {
                              newSet.delete(txn.id);
                            }
                            setSelectedPrivateIds(newSet);
                          }}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">
                        {new Date(txn.transaction_date).toLocaleDateString('nl-NL')}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-900 max-w-xs truncate">
                        {txn.description}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-600">
                        {txn.contra_name || txn.contra_account || '-'}
                      </td>
                      <td className="px-3 py-2 text-sm">
                        {txn.ledgerAccount ? (
                          <div className="flex items-center gap-1.5">
                            <select
                              value={txn.ledgerAccount.id}
                              onChange={(e) => handleReclassify(txn.id, e.target.value)}
                              disabled={reclassifyingTxnId === txn.id}
                              className="h-9 text-sm px-2 border border-gray-300 rounded bg-blue-50 text-blue-800 hover:bg-blue-100 cursor-pointer disabled:opacity-50 disabled:cursor-wait"
                            >
                              {accounts.map((acc) => (
                                <option key={acc.id} value={acc.id}>
                                  {acc.code} - {acc.name}
                                </option>
                              ))}
                            </select>
                            {reclassifyingTxnId === txn.id && (
                              <Loader className="w-3 h-3 text-blue-600 animate-spin" />
                            )}
                          </div>
                        ) : txn.status === 'Unmatched' ? (
                          <span className="text-xs text-gray-400 italic">Nog te verwerken</span>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-sm text-right font-medium whitespace-nowrap">
                        <span className={txn.amount > 0 ? 'text-green-600' : 'text-red-600'}>
                          €{Math.abs(txn.amount).toFixed(2)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-sm whitespace-nowrap">
                        <span className={`font-medium ${getStatusColor(txn.status)}`}>
                          {txn.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        {txn.status === 'Unmatched' && (
                          <button
                            onClick={() => {
                              setSelectedTransaction(txn);
                              setBookingDescription(txn.description);
                              setAiLoading(false);
                              setAiSuccess(false);
                              setError(null);
                              setCreateRule(false);
                              setRuleKeyword('');
                              setBookingMode('direct');
                            }}
                            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                          >
                            Boek
                          </button>
                        )}
                      </td>
                    </tr>
                    {txn.aiSuggestion?.debug_info && (
                      <tr key={`debug-${txn.id}`} className="bg-blue-50">
                        <td colSpan={8} className="px-3 py-2">
                          <div className="text-xs space-y-1">
                            <div className="flex items-start gap-2">
                              <span className="font-semibold text-blue-900 shrink-0">🔍 Zoekterm:</span>
                              <span className="text-blue-800">{txn.aiSuggestion.debug_info.clean_search_term}</span>
                            </div>
                            <div className="flex items-start gap-2">
                              <span className="font-semibold text-blue-900 shrink-0">🌍 Tavily Info:</span>
                              <span className="text-blue-800">{txn.aiSuggestion.debug_info.tavily_output}</span>
                            </div>
                            <div className="flex items-start gap-2">
                              <span className="font-semibold text-blue-900 shrink-0">🤖 AI Conclusie:</span>
                              <span className="text-blue-800">{txn.aiSuggestion.debug_info.ai_reasoning}</span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedTransaction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
            <div className="flex-none px-4 pt-3 pb-2.5 border-b border-gray-200">
              <h3 className="text-base font-bold text-gray-900">Book Transaction</h3>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 px-4 py-3">
              <div className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2 p-3 bg-gray-50 rounded">
                <div>
                  <span className="text-xs text-gray-600">Date</span>
                  <p className="text-sm font-medium">
                    {new Date(selectedTransaction.transaction_date).toLocaleDateString('nl-NL')}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-gray-600">Amount</span>
                  <p className={`text-sm font-bold ${selectedTransaction.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    €{Math.abs(selectedTransaction.amount).toFixed(2)}
                  </p>
                </div>
                <div className="col-span-2">
                  <span className="text-xs text-gray-600">Description</span>
                  <p className="text-sm font-medium">{selectedTransaction.description}</p>
                </div>
                {selectedTransaction.contra_name && (
                  <div className="col-span-2">
                    <span className="text-xs text-gray-600">Contra Party</span>
                    <p className="text-sm font-medium">{selectedTransaction.contra_name}</p>
                  </div>
                )}
              </div>

              <div className="bg-gray-100 border border-gray-300 rounded p-3">
                <label className="block text-xs font-semibold text-gray-700 mb-2">
                  Boekingswijze
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="bookingMode"
                      value="direct"
                      checked={bookingMode === 'direct'}
                      onChange={(e) => setBookingMode(e.target.value as 'direct' | 'via-relatie')}
                      className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-900">Direct</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="bookingMode"
                      value="via-relatie"
                      checked={bookingMode === 'via-relatie'}
                      onChange={(e) => setBookingMode(e.target.value as 'direct' | 'via-relatie')}
                      className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-900">Via Relatie</span>
                  </label>
                </div>
                <p className="text-xs text-gray-600 mt-1.5">
                  {bookingMode === 'direct'
                    ? 'Direct boeken zonder relatie (één boeking)'
                    : 'Boeken via debiteuren/crediteuren (twee boekingen: factuur + betaling)'}
                </p>
              </div>

              {bookingMode === 'via-relatie' && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    {selectedTransaction.amount > 0 ? 'Debtor (Klant)' : 'Leverancier (Creditor)'}
                  </label>
                  <select
                    value={selectedContact}
                    onChange={(e) => {
                      setSelectedContact(e.target.value);
                      const contact = contacts.find(c => c.id === e.target.value);
                      if (contact?.default_ledger_account_id) {
                        setSelectedAccount(contact.default_ledger_account_id);
                      }
                    }}
                    className="h-9 w-full px-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Selecteer {selectedTransaction.amount > 0 ? 'klant' : 'leverancier'}...</option>
                    {contacts
                      .filter((contact) => {
                        const isIncome = selectedTransaction.amount > 0;
                        if (isIncome) {
                          return contact.relation_type === 'Customer' || contact.relation_type === 'Both';
                        } else {
                          return contact.relation_type === 'Supplier' || contact.relation_type === 'Both';
                        }
                      })
                      .map((contact) => (
                        <option key={contact.id} value={contact.id}>
                          {contact.company_name}
                        </option>
                      ))}
                  </select>
                  <button
                    onClick={() => {
                      setShowNewRelationModal(true);
                      setNewRelationName(selectedTransaction?.contra_name || '');
                    }}
                    className="mt-2 w-full px-3 py-2 text-sm text-blue-600 border border-blue-300 rounded hover:bg-blue-50 transition-colors font-medium"
                  >
                    + Nieuwe Relatie Aanmaken
                  </button>
                </div>
              )}

              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Omschrijving
                </label>
                <input
                  type="text"
                  value={bookingDescription}
                  onChange={(e) => setBookingDescription(e.target.value)}
                  className="h-9 w-full px-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  {selectedTransaction.amount > 0 ? 'Omzetrekening (Revenue)' : 'Kostenrekening (Expense)'}
                </label>
                <div className="flex gap-2">
                  <select
                    value={selectedAccount}
                    onChange={(e) => setSelectedAccount(e.target.value)}
                    className="h-9 flex-1 px-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select account...</option>
                    {(() => {
                      const isIncoming = selectedTransaction.amount > 0;
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
                  <button
                    onClick={handleAiSuggest}
                    disabled={aiLoading}
                    title="Vraag AI om suggestie"
                    className={`h-9 px-3 border rounded transition-all ${
                      aiSuccess
                        ? 'bg-green-50 border-green-300 text-green-700'
                        : 'border-purple-300 text-purple-600 hover:bg-purple-50 hover:border-purple-400'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {aiLoading ? (
                      <Loader className="w-4 h-4 animate-spin" />
                    ) : aiSuccess ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {aiSuccess && (
                  <p className="text-xs text-green-600 mt-0.5 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    AI suggestion applied
                  </p>
                )}
              </div>

              {selectedTransaction.contra_name && (
                <div>
                  {showAddSupplier ? (
                    <div className="bg-amber-50 border border-amber-300 rounded p-3">
                      <div className="mb-2">
                        <p className="text-xs font-semibold text-amber-900 mb-0.5">
                          Nieuwe leverancier: "{selectedTransaction.contra_name}"
                        </p>
                        <p className="text-xs text-amber-700">
                          Deze staat nog niet in je systeem. Toevoegen met standaard grootboek?
                        </p>
                      </div>
                      <div className="space-y-1.5">
                        <input
                          type="text"
                          value={newSupplierName}
                          onChange={(e) => setNewSupplierName(e.target.value)}
                          placeholder="Leverancier naam"
                          className="w-full px-2 py-1.5 text-xs border border-amber-300 rounded focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                        />
                        <button
                          onClick={handleAddSupplier}
                          disabled={!selectedAccount || !newSupplierName.trim()}
                          className="w-full px-3 py-1.5 bg-amber-600 text-white text-xs font-medium rounded hover:bg-amber-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                        >
                          Leverancier toevoegen met standaard grootboek
                        </button>
                      </div>
                    </div>
                  ) : matchedContact && !matchedContact.default_ledger_account_id ? (
                    <div className="bg-blue-50 border border-blue-300 rounded p-3">
                      <div className="mb-2">
                        <p className="text-xs font-semibold text-blue-900 mb-0.5">
                          Leverancier: "{matchedContact.company_name}"
                        </p>
                        <p className="text-xs text-blue-700">
                          Geen standaard grootboek. De huidige selectie als standaard instellen?
                        </p>
                      </div>
                      <button
                        onClick={handleUpdateDefaultLedger}
                        disabled={!selectedAccount}
                        className="w-full px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                      >
                        Stel in als standaard grootboek
                      </button>
                    </div>
                  ) : matchedContact && matchedContact.default_ledger_account_id ? (
                    <div className="bg-green-50 border border-green-300 rounded p-2">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle className="w-3 h-3 text-green-600 flex-shrink-0" />
                        <p className="text-xs text-green-900">
                          Leverancier "{matchedContact.company_name}" herkend met standaard grootboek
                        </p>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}

              {selectedContact && !matchedContact && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="setAsDefaultBank"
                    checked={setAsDefault}
                    onChange={(e) => setSetAsDefault(e.target.checked)}
                    className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="setAsDefaultBank" className="text-xs text-gray-700 cursor-pointer">
                    Stel in als standaard grootboek voor deze leverancier
                  </label>
                </div>
              )}

              <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded p-2.5">
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    id="createRule"
                    checked={createRule}
                    onChange={(e) => {
                      setCreateRule(e.target.checked);
                      if (e.target.checked && selectedTransaction) {
                        const words = selectedTransaction.description.split(' ');
                        const firstWord = words.find(w => w.length > 3) || words[0];
                        setRuleKeyword(firstWord || '');
                      }
                    }}
                    className="mt-0.5 w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <label htmlFor="createRule" className="text-xs font-medium text-gray-900 cursor-pointer">
                      Maak hiervan een vaste bankregel
                    </label>
                    <p className="text-xs text-gray-600 mt-0.5">
                      Toekomstige transacties worden automatisch gecategoriseerd
                    </p>
                    {createRule && (
                      <div className="mt-2">
                        <label className="block text-xs font-medium text-gray-700 mb-0.5">
                          Keyword om te matchen
                        </label>
                        <input
                          type="text"
                          value={ruleKeyword}
                          onChange={(e) => setRuleKeyword(e.target.value)}
                          placeholder="bijv. Shell, Albert Heijn"
                          className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded p-2.5">
                <p className="text-xs font-medium text-blue-900 mb-1.5">
                  Booking Preview {bookingMode === 'via-relatie' && '(2 Journal Entries)'}:
                </p>
                <div className="space-y-0.5 text-xs text-blue-800">
                  {bookingMode === 'direct' ? (
                    selectedTransaction.amount > 0 ? (
                      <>
                        <div className="flex justify-between">
                          <span>1100 Bank</span>
                          <span className="font-medium">Debit €{Math.abs(selectedTransaction.amount).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>{accounts.find((a) => a.id === selectedAccount)?.name || 'Selected Account'}</span>
                          <span className="font-medium">Credit €{Math.abs(selectedTransaction.amount).toFixed(2)}</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex justify-between">
                          <span>{accounts.find((a) => a.id === selectedAccount)?.name || 'Selected Account'}</span>
                          <span className="font-medium">Debit €{Math.abs(selectedTransaction.amount).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>1100 Bank</span>
                          <span className="font-medium">Credit €{Math.abs(selectedTransaction.amount).toFixed(2)}</span>
                        </div>
                      </>
                    )
                  ) : (
                    selectedTransaction.amount > 0 ? (
                      <>
                        <div className="text-xs font-semibold text-blue-900 mb-1">Entry 1: Revenue</div>
                        <div className="flex justify-between">
                          <span>1310 Tussenrekening Debiteuren</span>
                          <span className="font-medium">Debit €{Math.abs(selectedTransaction.amount).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>{accounts.find((a) => a.id === selectedAccount)?.name || 'Revenue'}</span>
                          <span className="font-medium">Credit €{Math.abs(selectedTransaction.amount).toFixed(2)}</span>
                        </div>
                        <div className="h-px bg-blue-300 my-1.5"></div>
                        <div className="text-xs font-semibold text-blue-900 mb-1">Entry 2: Payment</div>
                        <div className="flex justify-between">
                          <span>1100 Bank</span>
                          <span className="font-medium">Debit €{Math.abs(selectedTransaction.amount).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>1300 Debiteuren</span>
                          <span className="font-medium">Credit €{Math.abs(selectedTransaction.amount).toFixed(2)}</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-xs font-semibold text-blue-900 mb-1">Entry 1: Payment</div>
                        <div className="flex justify-between">
                          <span>1500 Crediteuren</span>
                          <span className="font-medium">Debit €{Math.abs(selectedTransaction.amount).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>1100 Bank</span>
                          <span className="font-medium">Credit €{Math.abs(selectedTransaction.amount).toFixed(2)}</span>
                        </div>
                        <div className="h-px bg-blue-300 my-1.5"></div>
                        <div className="text-xs font-semibold text-blue-900 mb-1">Entry 2: Cost</div>
                        <div className="flex justify-between">
                          <span>{accounts.find((a) => a.id === selectedAccount)?.name || 'Expense'}</span>
                          <span className="font-medium">Debit €{Math.abs(selectedTransaction.amount).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>2300 Nog te ontvangen facturen</span>
                          <span className="font-medium">Credit €{Math.abs(selectedTransaction.amount).toFixed(2)}</span>
                        </div>
                      </>
                    )
                  )}
                </div>
              </div>
              </div>
            </div>

            <div className="flex-none border-t border-gray-200 px-4 py-2.5 bg-white">
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setSelectedTransaction(null);
                    setSelectedAccount('');
                    setBookingDescription('');
                    setSelectedContact('');
                    setSetAsDefault(false);
                    setMatchedContact(null);
                    setShowAddSupplier(false);
                    setNewSupplierName('');
                    setAiLoading(false);
                    setAiSuccess(false);
                    setCreateRule(false);
                    setRuleKeyword('');
                    setBookingMode('direct');
                    setShowNewRelationModal(false);
                    setNewRelationName('');
                    setNewRelationDefaultAccount('');
                  }}
                  className="h-9 px-4 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBookTransaction}
                  disabled={!selectedAccount || (bookingMode === 'via-relatie' && !selectedContact)}
                  className="h-9 flex items-center gap-1.5 px-4 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:bg-gray-400"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  Verwerken
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showNewRelationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full">
            <div className="px-6 pt-5 pb-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">
                Nieuwe {selectedTransaction && selectedTransaction.amount > 0 ? 'Debiteur' : 'Leverancier'} Aanmaken
              </h3>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Naam <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newRelationName}
                  onChange={(e) => setNewRelationName(e.target.value)}
                  placeholder="Naam van de relatie"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Standaard Grootboekrekening <span className="text-red-500">*</span>
                </label>
                <select
                  value={newRelationDefaultAccount}
                  onChange={(e) => setNewRelationDefaultAccount(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Selecteer grootboekrekening...</option>
                  {(() => {
                    const isIncoming = selectedTransaction && selectedTransaction.amount > 0;
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
                <p className="text-xs text-gray-500 mt-1.5">
                  Deze grootboekrekening wordt automatisch voorgeselecteerd bij toekomstige transacties
                </p>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowNewRelationModal(false);
                  setNewRelationName('');
                  setNewRelationDefaultAccount('');
                }}
                className="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-100 transition-colors"
              >
                Annuleren
              </button>
              <button
                onClick={handleCreateNewRelation}
                disabled={!newRelationName.trim() || !newRelationDefaultAccount}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Aanmaken
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
