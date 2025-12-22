/**
 * Invoice Payment Matching Service
 *
 * Matches invoices with bank transactions to automatically mark as paid
 * or suggest booking as "Te betalen" (Accounts Payable)
 */

import { supabase } from './supabase';
import type { Database } from './database.types';

type BankTransaction = Database['public']['Tables']['bank_transactions']['Row'];

export interface PaymentMatchResult {
  matched: boolean;
  bankTransactionId?: string;
  matchedAmount?: number;
  matchedDate?: string;
  matchConfidence: number;
  suggestedStatus: 'Paid' | 'Pending';
  reason: string;
}

export async function findPaymentMatch(
  invoiceDate: string,
  totalAmount: number,
  supplierName?: string
): Promise<PaymentMatchResult> {
  console.log(`🔍 [PAYMENT MATCH] Looking for payment match:`, {
    invoiceDate,
    totalAmount,
    supplierName,
  });

  try {
    const invoiceDateObj = new Date(invoiceDate);
    const startDate = new Date(invoiceDateObj);
    startDate.setDate(startDate.getDate() - 30);
    const endDate = new Date(invoiceDateObj);
    endDate.setDate(endDate.getDate() + 90);

    const { data: transactions, error } = await supabase
      .from('bank_transactions')
      .select('*')
      .gte('transaction_date', startDate.toISOString().split('T')[0])
      .lte('transaction_date', endDate.toISOString().split('T')[0])
      .lt('amount', 0)
      .order('transaction_date', { ascending: false });

    if (error) {
      console.error('❌ [PAYMENT MATCH] Error fetching transactions:', error);
      return {
        matched: false,
        matchConfidence: 0,
        suggestedStatus: 'Pending',
        reason: 'Geen banktransacties gevonden',
      };
    }

    if (!transactions || transactions.length === 0) {
      console.log('⚠ [PAYMENT MATCH] No transactions found in date range');
      return {
        matched: false,
        matchConfidence: 0,
        suggestedStatus: 'Pending',
        reason: 'Geen banktransacties in periode',
      };
    }

    console.log(`📊 [PAYMENT MATCH] Found ${transactions.length} potential matches`);

    const matches = transactions
      .map(tx => {
        const txAmount = Math.abs(tx.amount);
        const amountDiff = Math.abs(txAmount - totalAmount);
        const amountMatch = amountDiff < 0.02;

        const dateDiff = Math.abs(
          new Date(tx.transaction_date).getTime() - invoiceDateObj.getTime()
        ) / (1000 * 60 * 60 * 24);

        const dateMatch = dateDiff <= 90;

        let nameMatch = 0;
        if (supplierName && tx.counterparty_name) {
          const supplierLower = supplierName.toLowerCase();
          const counterpartyLower = tx.counterparty_name.toLowerCase();

          const supplierWords = supplierLower.split(/\s+/).filter(w => w.length > 2);
          const matchedWords = supplierWords.filter(word =>
            counterpartyLower.includes(word)
          );

          nameMatch = supplierWords.length > 0
            ? matchedWords.length / supplierWords.length
            : 0;
        }

        let confidence = 0;
        if (amountMatch) confidence += 70;
        if (dateMatch) confidence += 15;
        if (nameMatch > 0.5) confidence += 15 * nameMatch;

        const alreadyMatched = tx.status === 'Booked' || tx.journal_entry_id;

        return {
          transaction: tx,
          amountMatch,
          amountDiff,
          dateDiff,
          nameMatch,
          confidence,
          alreadyMatched,
        };
      })
      .filter(m => m.amountMatch && !m.alreadyMatched)
      .sort((a, b) => b.confidence - a.confidence);

    if (matches.length === 0) {
      console.log('⚠ [PAYMENT MATCH] No matching transactions found');
      return {
        matched: false,
        matchConfidence: 0,
        suggestedStatus: 'Pending',
        reason: 'Geen matchende betaling gevonden',
      };
    }

    const bestMatch = matches[0];

    console.log(`✅ [PAYMENT MATCH] Found match:`, {
      transactionId: bestMatch.transaction.id,
      amount: Math.abs(bestMatch.transaction.amount),
      date: bestMatch.transaction.transaction_date,
      confidence: bestMatch.confidence,
    });

    return {
      matched: true,
      bankTransactionId: bestMatch.transaction.id,
      matchedAmount: Math.abs(bestMatch.transaction.amount),
      matchedDate: bestMatch.transaction.transaction_date,
      matchConfidence: bestMatch.confidence,
      suggestedStatus: 'Paid',
      reason: `Match gevonden: €${Math.abs(bestMatch.transaction.amount).toFixed(2)} op ${bestMatch.transaction.transaction_date} (${bestMatch.confidence.toFixed(0)}% zekerheid)`,
    };
  } catch (error) {
    console.error('❌ [PAYMENT MATCH] Unexpected error:', error);
    return {
      matched: false,
      matchConfidence: 0,
      suggestedStatus: 'Pending',
      reason: 'Fout bij zoeken naar betaling',
    };
  }
}

export async function linkInvoiceToPayment(
  invoiceId: string,
  bankTransactionId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`🔗 [PAYMENT MATCH] Linking invoice ${invoiceId} to transaction ${bankTransactionId}`);

    const { error: invoiceError } = await supabase
      .from('purchase_invoices')
      .update({
        status: 'Paid',
        paid_at: new Date().toISOString(),
        notes: `Gekoppeld aan banktransactie ${bankTransactionId}`,
      })
      .eq('id', invoiceId);

    if (invoiceError) {
      console.error('❌ [PAYMENT MATCH] Error updating invoice:', invoiceError);
      return { success: false, error: invoiceError.message };
    }

    console.log('✅ [PAYMENT MATCH] Invoice linked successfully');
    return { success: true };
  } catch (error) {
    console.error('❌ [PAYMENT MATCH] Unexpected error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
