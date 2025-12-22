import { supabase } from './supabase';
import { getCurrentCompanyId } from './companyHelper';

const SUSPENSE_RECEIVABLES = '1300';
const SUSPENSE_PAYABLES = '2300';

export interface SettlementParams {
  bankTransactionId: string;
  invoiceId: string;
  amount: number;
  fiscalYearId: string;
  description?: string;
}

export interface SettlementResult {
  success: boolean;
  journalEntryId?: string;
  error?: string;
}

async function getAccountIdByCode(code: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('accounts')
    .select('id')
    .eq('code', code)
    .maybeSingle();

  if (error || !data) {
    console.error(`Failed to find account with code ${code}:`, error);
    return null;
  }

  return data.id;
}

async function getInvoiceDetails(invoiceId: string) {
  const { data, error } = await supabase
    .from('invoices')
    .select('contact_id, type, invoice_number')
    .eq('id', invoiceId)
    .maybeSingle();

  if (error || !data) {
    console.error('Failed to fetch invoice details:', error);
    return null;
  }

  return data;
}

async function getContactLedgerAccount(contactId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('contacts')
    .select('default_ledger_account_id')
    .eq('id', contactId)
    .maybeSingle();

  if (error || !data) {
    console.error('Failed to fetch contact ledger account:', error);
    return null;
  }

  return data.default_ledger_account_id;
}

export async function settlePurchaseTransaction(
  params: SettlementParams
): Promise<SettlementResult> {
  try {
    const companyId = await getCurrentCompanyId();
    if (!companyId) {
      return { success: false, error: 'No company selected' };
    }

    const invoice = await getInvoiceDetails(params.invoiceId);
    if (!invoice) {
      return { success: false, error: 'Invoice not found' };
    }

    if (invoice.type !== 'purchase') {
      return { success: false, error: 'Invoice is not a purchase invoice' };
    }

    const creditorAccountId = await getContactLedgerAccount(invoice.contact_id);
    if (!creditorAccountId) {
      return { success: false, error: 'Creditor ledger account not found' };
    }

    const suspenseAccountId = await getAccountIdByCode(SUSPENSE_PAYABLES);
    if (!suspenseAccountId) {
      return { success: false, error: 'Suspense account 2300 not found' };
    }

    const entryDescription = params.description ||
      `Settlement: ${invoice.invoice_number} - Payment matched to invoice`;

    const { data: journalEntry, error: entryError } = await supabase
      .from('journal_entries')
      .insert({
        company_id: companyId,
        fiscal_year_id: params.fiscalYearId,
        entry_date: new Date().toISOString().split('T')[0],
        description: entryDescription,
        reference: `SETTLEMENT-${invoice.invoice_number}`,
        type: 'settlement'
      })
      .select()
      .single();

    if (entryError || !journalEntry) {
      console.error('Failed to create journal entry:', entryError);
      return { success: false, error: 'Failed to create settlement entry' };
    }

    const lines = [
      {
        journal_entry_id: journalEntry.id,
        account_id: creditorAccountId,
        debit: Math.abs(params.amount),
        credit: 0,
        description: `Clear creditor - ${invoice.invoice_number}`
      },
      {
        journal_entry_id: journalEntry.id,
        account_id: suspenseAccountId,
        debit: 0,
        credit: Math.abs(params.amount),
        description: `Clear suspense - ${invoice.invoice_number}`
      }
    ];

    const { error: linesError } = await supabase
      .from('journal_lines')
      .insert(lines);

    if (linesError) {
      console.error('Failed to create journal entry lines:', linesError);
      await supabase.from('journal_entries').delete().eq('id', journalEntry.id);
      return { success: false, error: 'Failed to create settlement lines' };
    }

    const { error: updateError } = await supabase
      .from('bank_transactions')
      .update({
        status: 'reconciled',
        matched_invoice_id: params.invoiceId
      })
      .eq('id', params.bankTransactionId);

    if (updateError) {
      console.warn('Failed to update bank transaction status:', updateError);
    }

    return { success: true, journalEntryId: journalEntry.id };

  } catch (error) {
    console.error('Settlement error:', error);
    return { success: false, error: String(error) };
  }
}

export async function settleSalesTransaction(
  params: SettlementParams
): Promise<SettlementResult> {
  try {
    const companyId = await getCurrentCompanyId();
    if (!companyId) {
      return { success: false, error: 'No company selected' };
    }

    const invoice = await getInvoiceDetails(params.invoiceId);
    if (!invoice) {
      return { success: false, error: 'Invoice not found' };
    }

    if (invoice.type !== 'sales') {
      return { success: false, error: 'Invoice is not a sales invoice' };
    }

    const debtorAccountId = await getContactLedgerAccount(invoice.contact_id);
    if (!debtorAccountId) {
      return { success: false, error: 'Debtor ledger account not found' };
    }

    const suspenseAccountId = await getAccountIdByCode(SUSPENSE_RECEIVABLES);
    if (!suspenseAccountId) {
      return { success: false, error: 'Suspense account 1300 not found' };
    }

    const entryDescription = params.description ||
      `Settlement: ${invoice.invoice_number} - Receipt matched to invoice`;

    const { data: journalEntry, error: entryError } = await supabase
      .from('journal_entries')
      .insert({
        company_id: companyId,
        fiscal_year_id: params.fiscalYearId,
        entry_date: new Date().toISOString().split('T')[0],
        description: entryDescription,
        reference: `SETTLEMENT-${invoice.invoice_number}`,
        type: 'settlement'
      })
      .select()
      .single();

    if (entryError || !journalEntry) {
      console.error('Failed to create journal entry:', entryError);
      return { success: false, error: 'Failed to create settlement entry' };
    }

    const lines = [
      {
        journal_entry_id: journalEntry.id,
        account_id: suspenseAccountId,
        debit: Math.abs(params.amount),
        credit: 0,
        description: `Clear suspense - ${invoice.invoice_number}`
      },
      {
        journal_entry_id: journalEntry.id,
        account_id: debtorAccountId,
        debit: 0,
        credit: Math.abs(params.amount),
        description: `Clear debtor - ${invoice.invoice_number}`
      }
    ];

    const { error: linesError } = await supabase
      .from('journal_lines')
      .insert(lines);

    if (linesError) {
      console.error('Failed to create journal entry lines:', linesError);
      await supabase.from('journal_entries').delete().eq('id', journalEntry.id);
      return { success: false, error: 'Failed to create settlement lines' };
    }

    const { error: updateError } = await supabase
      .from('bank_transactions')
      .update({
        status: 'reconciled',
        matched_invoice_id: params.invoiceId
      })
      .eq('id', params.bankTransactionId);

    if (updateError) {
      console.warn('Failed to update bank transaction status:', updateError);
    }

    return { success: true, journalEntryId: journalEntry.id };

  } catch (error) {
    console.error('Settlement error:', error);
    return { success: false, error: String(error) };
  }
}

export async function autoSettle(
  bankTransactionId: string,
  invoiceId: string,
  fiscalYearId: string
): Promise<SettlementResult> {
  try {
    const { data: transaction } = await supabase
      .from('bank_transactions')
      .select('amount')
      .eq('id', bankTransactionId)
      .maybeSingle();

    if (!transaction) {
      return { success: false, error: 'Bank transaction not found' };
    }

    const { data: invoice } = await supabase
      .from('invoices')
      .select('type')
      .eq('id', invoiceId)
      .maybeSingle();

    if (!invoice) {
      return { success: false, error: 'Invoice not found' };
    }

    const params: SettlementParams = {
      bankTransactionId,
      invoiceId,
      amount: transaction.amount,
      fiscalYearId
    };

    if (invoice.type === 'purchase') {
      return await settlePurchaseTransaction(params);
    } else {
      return await settleSalesTransaction(params);
    }

  } catch (error) {
    console.error('Auto settlement error:', error);
    return { success: false, error: String(error) };
  }
}
