import { supabase } from './supabase';

export interface ReclassifyResult {
  success: boolean;
  error?: string;
}

export async function reclassifyJournalLine(
  journalLineId: string,
  newAccountId: string
): Promise<ReclassifyResult> {
  try {
    const { error } = await supabase
      .from('journal_lines')
      .update({ account_id: newAccountId })
      .eq('id', journalLineId);

    if (error) throw error;

    return { success: true };
  } catch (err) {
    console.error('Error reclassifying journal line:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to reclassify transaction',
    };
  }
}

export async function reclassifyBankTransaction(
  bankTransactionId: string,
  newAccountId: string
): Promise<ReclassifyResult> {
  try {
    const { data: bankTxn } = await supabase
      .from('bank_transactions')
      .select('journal_entry_id')
      .eq('id', bankTransactionId)
      .maybeSingle();

    if (!bankTxn?.journal_entry_id) {
      return {
        success: false,
        error: 'Bank transaction is not yet booked',
      };
    }

    const { data: journalLines } = await supabase
      .from('journal_lines')
      .select('id, account_id, accounts!inner(type)')
      .eq('journal_entry_id', bankTxn.journal_entry_id);

    if (!journalLines || journalLines.length === 0) {
      return {
        success: false,
        error: 'No journal lines found for this transaction',
      };
    }

    const nonBankLine = journalLines.find(
      (line: any) => line.accounts?.type !== 'Asset' || !line.accounts?.code?.startsWith('10')
    );

    if (!nonBankLine) {
      return {
        success: false,
        error: 'Could not identify the non-bank ledger line',
      };
    }

    const { error } = await supabase
      .from('journal_lines')
      .update({ account_id: newAccountId })
      .eq('id', nonBankLine.id);

    if (error) throw error;

    return { success: true };
  } catch (err) {
    console.error('Error reclassifying bank transaction:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to reclassify transaction',
    };
  }
}
