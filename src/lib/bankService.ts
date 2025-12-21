import { supabase } from './supabase';
import type { Database } from './database.types';
import { learnFromUserAction } from './bankAutomationService';

type BankTransaction = Database['public']['Tables']['bank_transactions']['Insert'];

/**
 * Helper function to dynamically fetch account by code from database
 * Throws an error if account is not found
 */
async function getAccountByCode(code: string): Promise<{ id: string; name: string; code: string }> {
  const { data, error } = await supabase
    .from('accounts')
    .select('id, name, code')
    .eq('code', code)
    .maybeSingle();

  if (error || !data) {
    throw new Error(`Account with code ${code} not found in database`);
  }

  return data;
}

export interface ParsedTransaction {
  transaction_date: string;
  description: string;
  amount: number;
  contra_account?: string;
  contra_name?: string;
  reference?: string;
  balance_after?: number;
}

export function parseBankFile(fileContent: string, fileName: string): ParsedTransaction[] {
  const isMT940 = detectMT940Format(fileContent);

  if (isMT940) {
    return parseMT940(fileContent);
  } else {
    return parseCSV(fileContent);
  }
}

function detectMT940Format(content: string): boolean {
  const essentialTags = [':61:', ':86:'];
  const hasEssentialTags = essentialTags.every(tag => content.includes(tag));

  if (hasEssentialTags) {
    return true;
  }

  const mt940Tags = [':20:', ':25:', ':60F:', ':60M:', ':61:', ':86:', ':62F:', ':62M:', ':64:'];
  const tagCount = mt940Tags.filter(tag => content.includes(tag)).length;
  return tagCount >= 2;
}

export function parseMT940(mt940Content: string): ParsedTransaction[] {
  const lines = mt940Content.trim().split('\n').map(line => line.trim());
  const transactions: ParsedTransaction[] = [];

  let currentTransaction: Partial<ParsedTransaction> | null = null;
  let errorCount = 0;
  const maxErrors = 5;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith(':61:')) {
      if (currentTransaction && currentTransaction.transaction_date && currentTransaction.amount !== undefined) {
        transactions.push(currentTransaction as ParsedTransaction);
      }

      try {
        currentTransaction = parseMT940TransactionLine(line);
      } catch (err) {
        errorCount++;
        if (errorCount <= maxErrors) {
          console.warn(`Error parsing MT940 line ${i + 1}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
        currentTransaction = null;
      }
    } else if (line.startsWith(':86:') && currentTransaction) {
      const description = line.substring(4).trim();
      let fullDescription = description;

      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].startsWith(':')) break;
        fullDescription += ' ' + lines[j].trim();
        i = j;
      }

      currentTransaction.description = fullDescription || 'Bank transaction';

      const nameMatch = fullDescription.match(/Naam:\s*([^,]+)/i) ||
                       fullDescription.match(/Name:\s*([^,]+)/i);
      if (nameMatch) {
        currentTransaction.contra_name = nameMatch[1].trim();
      }

      const ibanMatch = fullDescription.match(/([A-Z]{2}[0-9]{2}[A-Z0-9]+)/);
      if (ibanMatch) {
        currentTransaction.contra_account = ibanMatch[1];
      }
    }
  }

  if (currentTransaction && currentTransaction.transaction_date && currentTransaction.amount !== undefined) {
    transactions.push(currentTransaction as ParsedTransaction);
  }

  if (transactions.length === 0) {
    throw new Error('No valid transactions found in MT940 file');
  }

  return transactions;
}

function parseMT940TransactionLine(line: string): Partial<ParsedTransaction> {
  const content = line.substring(4);

  const dateMatch = content.match(/^(\d{6})/);
  if (!dateMatch) {
    throw new Error('Invalid MT940 transaction line: missing date');
  }

  const dateStr = dateMatch[1];
  const year = parseInt('20' + dateStr.substring(0, 2));
  const month = parseInt(dateStr.substring(2, 4));
  const day = parseInt(dateStr.substring(4, 6));
  const transactionDate = new Date(year, month - 1, day);

  if (isNaN(transactionDate.getTime())) {
    throw new Error('Invalid date in MT940 transaction');
  }

  const debitCreditMatch = content.match(/[CD]/);
  if (!debitCreditMatch) {
    throw new Error('Invalid MT940 transaction line: missing D/C indicator');
  }

  const isCredit = debitCreditMatch[0] === 'C';
  const debitCreditIndex = content.indexOf(debitCreditMatch[0]);

  const amountStr = content.substring(debitCreditIndex + 1).match(/[\d,]+/)?.[0];
  if (!amountStr) {
    throw new Error('Invalid MT940 transaction line: missing amount');
  }

  const amount = parseFloat(amountStr.replace(',', '.')) * (isCredit ? 1 : -1);

  const refMatch = content.match(/\/\/([^\n\r]+)/);
  const reference = refMatch ? refMatch[1].trim() : undefined;

  return {
    transaction_date: transactionDate.toISOString().split('T')[0],
    description: 'Bank transaction',
    amount,
    reference,
  };
}

export function parseCSV(csvContent: string): ParsedTransaction[] {
  const lines = csvContent.trim().split('\n');
  if (lines.length < 2) {
    throw new Error('CSV file is empty or invalid');
  }

  const header = lines[0].toLowerCase().split(/[,;]/);

  const dateIndex = header.findIndex(h => h.includes('date') || h.includes('datum'));
  const descIndex = header.findIndex(h => h.includes('desc') || h.includes('omschrijving') || h.includes('memo'));
  const amountIndex = header.findIndex(h => h.includes('amount') || h.includes('bedrag'));
  const contraAccIndex = header.findIndex(h => h.includes('contra') || h.includes('rekening') || h.includes('iban'));
  const contraNameIndex = header.findIndex(h => h.includes('name') || h.includes('naam') || h.includes('tegenpartij'));
  const refIndex = header.findIndex(h => h.includes('ref') || h.includes('kenmerk'));
  const balanceIndex = header.findIndex(h => h.includes('balance') || h.includes('saldo'));

  if (dateIndex === -1 || descIndex === -1) {
    throw new Error('CSV must contain Date/Description columns. If this is an MT940 file (.sta, .swi, .940), it should contain tags like :61: and :86:. Found headers: ' + header.join(', '));
  }

  const transactions: ParsedTransaction[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(/[,;]/);

    const dateStr = parts[dateIndex]?.trim();
    const description = parts[descIndex]?.trim();
    const amountStr = parts[amountIndex]?.trim().replace(/[€\s]/g, '').replace(',', '.');

    if (!dateStr || !description || !amountStr) continue;

    const date = parseDateString(dateStr);
    const amount = parseFloat(amountStr);

    if (!date || isNaN(amount)) continue;

    transactions.push({
      transaction_date: date,
      description,
      amount,
      contra_account: contraAccIndex !== -1 ? parts[contraAccIndex]?.trim() : undefined,
      contra_name: contraNameIndex !== -1 ? parts[contraNameIndex]?.trim() : undefined,
      reference: refIndex !== -1 ? parts[refIndex]?.trim() : undefined,
      balance_after: balanceIndex !== -1 ? parseFloat(parts[balanceIndex]?.trim().replace(/[€\s]/g, '').replace(',', '.')) : undefined,
    });
  }

  return transactions;
}

function parseDateString(dateStr: string): string | null {
  dateStr = dateStr.replace(/['"]/g, '');

  let date: Date | null = null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    date = new Date(dateStr);
  } else if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
    const [day, month, year] = dateStr.split('-');
    date = new Date(`${year}-${month}-${day}`);
  } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
    const [day, month, year] = dateStr.split('/');
    date = new Date(`${year}-${month}-${day}`);
  }

  if (date && !isNaN(date.getTime())) {
    return date.toISOString().split('T')[0];
  }

  return null;
}

export async function importBankTransactions(transactions: ParsedTransaction[]): Promise<{
  success: boolean;
  imported: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let imported = 0;

  for (const txn of transactions) {
    try {
      const { error } = await supabase
        .from('bank_transactions')
        .insert({
          ...txn,
          status: 'Unmatched',
        });

      if (error) {
        errors.push(`Failed to import transaction on ${txn.transaction_date}: ${error.message}`);
      } else {
        imported++;
      }
    } catch (err) {
      errors.push(`Error processing transaction: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  return {
    success: errors.length === 0,
    imported,
    errors,
  };
}

/**
 * DIRECT MODE: "Directe Kosten/Omzet"
 *
 * Simple direct booking without suspense accounts or relations.
 * Use this for straightforward transactions that don't require invoice matching.
 *
 * Flow:
 * - Expense: Debit Cost Account / Credit Bank
 * - Income: Debit Bank / Credit Revenue Account
 *
 * Result: Transaction marked as 'Booked' (fully processed)
 * No suspense accounts involved, no future matching required.
 */
export async function bookBankTransaction(
  transactionId: string,
  accountId: string,
  description: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: transaction, error: txnError } = await supabase
      .from('bank_transactions')
      .select('*')
      .eq('id', transactionId)
      .single();

    if (txnError || !transaction) {
      throw new Error('Transaction not found');
    }

    // Use 1100 (Bank) for all bank transactions
    const bankAccount = await getAccountByCode('1100');

    const { data: journalEntry, error: entryError } = await supabase
      .from('journal_entries')
      .insert({
        entry_date: transaction.transaction_date,
        description: description || transaction.description,
        reference: transaction.reference || transaction.contra_account || undefined,
        status: 'Draft',
        type: 'Bank',
      })
      .select()
      .single();

    if (entryError) throw entryError;

    const lines = [];

    if (transaction.amount > 0) {
      lines.push({
        journal_entry_id: journalEntry.id,
        account_id: bankAccount.id,
        debit: Math.abs(transaction.amount),
        credit: 0,
        description: 'Bank ontvangst',
      });
      lines.push({
        journal_entry_id: journalEntry.id,
        account_id: accountId,
        debit: 0,
        credit: Math.abs(transaction.amount),
        description: transaction.contra_name || null,
      });
    } else {
      lines.push({
        journal_entry_id: journalEntry.id,
        account_id: accountId,
        debit: Math.abs(transaction.amount),
        credit: 0,
        description: transaction.contra_name || null,
      });
      lines.push({
        journal_entry_id: journalEntry.id,
        account_id: bankAccount.id,
        debit: 0,
        credit: Math.abs(transaction.amount),
        description: 'Bank betaling',
      });
    }

    const { error: linesError } = await supabase.from('journal_lines').insert(lines);

    if (linesError) {
      console.error('Failed to insert journal lines:', linesError);
      throw new Error(`Failed to insert journal lines: ${linesError.message}`);
    }

    const { error: updateError } = await supabase
      .from('bank_transactions')
      .update({
        status: 'Booked',
        journal_entry_id: journalEntry.id,
      })
      .eq('id', transactionId);

    if (updateError) throw updateError;

    // Learn from this user action (self-learning)
    await learnFromUserAction(transaction, 'direct', accountId);

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to book transaction',
    };
  }
}

/**
 * INVOICE/RELATION MODE: "Factuur / Relatie"
 *
 * Creates TWO journal entry sets for proper debtor/creditor accounting.
 * Use this when the transaction relates to an invoice that needs to be matched.
 *
 * CREDITOR FLOW (Inkoop/Uitgaven):
 * - Set A (Payment): Credit 1100 (Bank), Debit 1500 (Crediteuren)
 * - Set B (Cost): Debit Cost Account, Credit 2300 (Nog te ontvangen inkoopfacturen)
 *
 * DEBTOR FLOW (Verkoop/Inkomsten):
 * - Set A (Revenue): Credit Revenue Account, Debit 1310 (Tussenrekening/Ontvangsten Debiteuren)
 * - Set B (Payment): Debit 1100 (Bank), Credit 1300 (Debiteuren)
 *
 * Result: Transaction marked as 'pending' (awaiting invoice match)
 * Requires: Contact ID (debtor/creditor) and Ledger Account ID (cost/revenue account)
 */
export async function bookBankTransactionViaRelatie(
  transactionId: string,
  contactId: string,
  ledgerAccountId: string,
  description: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: transaction, error: txnError } = await supabase
      .from('bank_transactions')
      .select('*')
      .eq('id', transactionId)
      .maybeSingle();

    if (txnError || !transaction) {
      throw new Error('Transaction not found');
    }

    // Dynamically fetch all required accounts from database
    const bankAccount = await getAccountByCode('1100'); // Bank

    const isIncome = transaction.amount > 0;
    const amount = Math.abs(transaction.amount);

    if (isIncome) {
      // DEBTOR FLOW (Verkoop/Inkomsten)
      // Set A: Credit Revenue Account, Debit 1310 (Tussenrekening/Ontvangsten Debiteuren)
      // Set B: Debit 1100 (Bank), Credit 1300 (Debiteuren)

      const debtorAccount = await getAccountByCode('1300'); // Debiteuren
      const intermediateAccount = await getAccountByCode('1310'); // Tussenrekening/Ontvangsten Debiteuren

      // Set A: Revenue Entry
      const { data: revenueEntry, error: revenueError } = await supabase
        .from('journal_entries')
        .insert({
          entry_date: transaction.transaction_date,
          description: description || `Omzet ${transaction.contra_name || ''}`.trim(),
          reference: transaction.reference || transaction.contra_account || undefined,
          contact_id: contactId,
          status: 'Final',
          type: 'Sales',
        })
        .select()
        .single();

      if (revenueError) throw revenueError;

      const revenueLines = [
        {
          journal_entry_id: revenueEntry.id,
          account_id: intermediateAccount.id,
          debit: amount,
          credit: 0,
          description: 'Tussenrekening debiteuren',
        },
        {
          journal_entry_id: revenueEntry.id,
          account_id: ledgerAccountId,
          debit: 0,
          credit: amount,
          description: transaction.contra_name || 'Omzet',
        },
      ];

      const { error: revenueLinesError } = await supabase.from('journal_lines').insert(revenueLines);
      if (revenueLinesError) throw revenueLinesError;

      // Set B: Payment Entry
      const { data: paymentEntry, error: paymentError } = await supabase
        .from('journal_entries')
        .insert({
          entry_date: transaction.transaction_date,
          description: `Betaling debiteur ${transaction.contra_name || ''}`.trim(),
          reference: transaction.reference || transaction.contra_account || undefined,
          contact_id: contactId,
          status: 'Final',
          type: 'Bank',
        })
        .select()
        .single();

      if (paymentError) throw paymentError;

      const paymentLines = [
        {
          journal_entry_id: paymentEntry.id,
          account_id: bankAccount.id,
          debit: amount,
          credit: 0,
          description: 'Bank ontvangst',
        },
        {
          journal_entry_id: paymentEntry.id,
          account_id: debtorAccount.id,
          debit: 0,
          credit: amount,
          description: transaction.contra_name || 'Debiteur',
        },
      ];

      const { error: paymentLinesError } = await supabase.from('journal_lines').insert(paymentLines);
      if (paymentLinesError) throw paymentLinesError;

      // Update transaction to link to payment entry (set B)
      const { error: updateError } = await supabase
        .from('bank_transactions')
        .update({
          status: 'pending',
          journal_entry_id: paymentEntry.id,
        })
        .eq('id', transactionId);

      if (updateError) throw updateError;

    } else {
      // CREDITOR FLOW (Inkoop/Uitgaven)
      // Set A: Credit 1100 (Bank), Debit 1500 (Crediteuren)
      // Set B: Debit Cost Account, Credit 2300 (Nog te ontvangen inkoopfacturen)

      const creditorAccount = await getAccountByCode('1500'); // Crediteuren
      const suspenseAccount = await getAccountByCode('2300'); // Nog te ontvangen inkoopfacturen

      // Set A: Payment Entry
      const { data: paymentEntry, error: paymentError } = await supabase
        .from('journal_entries')
        .insert({
          entry_date: transaction.transaction_date,
          description: `Betaling crediteur ${transaction.contra_name || ''}`.trim(),
          reference: transaction.reference || transaction.contra_account || undefined,
          contact_id: contactId,
          status: 'Final',
          type: 'Bank',
        })
        .select()
        .single();

      if (paymentError) throw paymentError;

      const paymentLines = [
        {
          journal_entry_id: paymentEntry.id,
          account_id: creditorAccount.id,
          debit: amount,
          credit: 0,
          description: transaction.contra_name || 'Crediteur',
        },
        {
          journal_entry_id: paymentEntry.id,
          account_id: bankAccount.id,
          debit: 0,
          credit: amount,
          description: 'Bank betaling',
        },
      ];

      const { error: paymentLinesError } = await supabase.from('journal_lines').insert(paymentLines);
      if (paymentLinesError) throw paymentLinesError;

      // Set B: Cost Entry
      const { data: costEntry, error: costError } = await supabase
        .from('journal_entries')
        .insert({
          entry_date: transaction.transaction_date,
          description: description || `Kosten ${transaction.contra_name || ''}`.trim(),
          reference: transaction.reference || transaction.contra_account || undefined,
          contact_id: contactId,
          status: 'Final',
          type: 'Purchase',
        })
        .select()
        .single();

      if (costError) throw costError;

      const costLines = [
        {
          journal_entry_id: costEntry.id,
          account_id: ledgerAccountId,
          debit: amount,
          credit: 0,
          description: transaction.contra_name || 'Kosten',
        },
        {
          journal_entry_id: costEntry.id,
          account_id: suspenseAccount.id,
          debit: 0,
          credit: amount,
          description: 'Nog te ontvangen inkoopfactuur',
        },
      ];

      const { error: costLinesError } = await supabase.from('journal_lines').insert(costLines);
      if (costLinesError) throw costLinesError;

      // Update transaction to link to payment entry (set A)
      const { error: updateError } = await supabase
        .from('bank_transactions')
        .update({
          status: 'pending',
          journal_entry_id: paymentEntry.id,
        })
        .eq('id', transactionId);

      if (updateError) throw updateError;
    }

    // Learn from this user action (self-learning)
    await learnFromUserAction(transaction, 'relation', ledgerAccountId, contactId);

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to book transaction via relatie',
    };
  }
}
