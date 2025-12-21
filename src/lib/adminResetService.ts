import { supabase } from './supabase';

export interface ResetResult {
  success: boolean;
  error?: string;
  stats?: {
    journalEntriesDeleted: number;
    journalLinesDeleted: number;
    invoicesDeleted: number;
    invoiceLinesDeleted: number;
    bankTransactionsDeleted: number;
    contactsDeleted: number;
  };
}

export async function resetAdministration(): Promise<ResetResult> {
  try {
    const stats = {
      journalEntriesDeleted: 0,
      journalLinesDeleted: 0,
      invoicesDeleted: 0,
      invoiceLinesDeleted: 0,
      bankTransactionsDeleted: 0,
      contactsDeleted: 0,
    };

    const { count: bankTransactionsCount, error: bankDeleteError } = await supabase
      .from('bank_transactions')
      .delete({ count: 'exact' })
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (bankDeleteError) {
      console.error('Error deleting bank transactions:', bankDeleteError);
      throw new Error(`Failed to delete bank transactions: ${bankDeleteError.message}`);
    }
    stats.bankTransactionsDeleted = bankTransactionsCount || 0;

    const { data: journalEntries, error: fetchError } = await supabase
      .from('journal_entries')
      .select('id');

    if (fetchError) {
      console.error('Error fetching journal entries:', fetchError);
      throw new Error(`Failed to fetch journal entries: ${fetchError.message}`);
    }

    if (journalEntries && journalEntries.length > 0) {
      const journalIds = journalEntries.map(j => j.id);

      const { count: linesCount, error: linesError } = await supabase
        .from('journal_lines')
        .delete({ count: 'exact' })
        .in('journal_entry_id', journalIds);

      if (linesError) {
        console.error('Error deleting journal lines:', linesError);
        throw new Error(`Failed to delete journal lines: ${linesError.message}`);
      }
      stats.journalLinesDeleted = linesCount || 0;

      const { error: entriesError } = await supabase
        .from('journal_entries')
        .delete()
        .in('id', journalIds);

      if (entriesError) {
        console.error('Error deleting journal entries:', entriesError);
        throw new Error(`Failed to delete journal entries: ${entriesError.message}`);
      }

      stats.journalEntriesDeleted = journalEntries.length;
    }

    const { data: invoices, error: invoicesFetchError } = await supabase
      .from('invoices')
      .select('id');

    if (invoicesFetchError) {
      console.error('Error fetching invoices:', invoicesFetchError);
      throw new Error(`Failed to fetch invoices: ${invoicesFetchError.message}`);
    }

    if (invoices && invoices.length > 0) {
      const invoiceIds = invoices.map(i => i.id);

      const { count: invoiceLinesCount, error: invoiceLinesError } = await supabase
        .from('invoice_lines')
        .delete({ count: 'exact' })
        .in('invoice_id', invoiceIds);

      if (invoiceLinesError) {
        console.error('Error deleting invoice lines:', invoiceLinesError);
        throw new Error(`Failed to delete invoice lines: ${invoiceLinesError.message}`);
      }
      stats.invoiceLinesDeleted = invoiceLinesCount || 0;

      const { error: invoicesError } = await supabase
        .from('invoices')
        .delete()
        .in('id', invoiceIds);

      if (invoicesError) {
        console.error('Error deleting invoices:', invoicesError);
        throw new Error(`Failed to delete invoices: ${invoicesError.message}`);
      }

      stats.invoicesDeleted = invoices.length;
    }

    const { count: contactsCount, error: contactsDeleteError } = await supabase
      .from('contacts')
      .delete({ count: 'exact' })
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (contactsDeleteError) {
      console.error('Error deleting contacts:', contactsDeleteError);
      throw new Error(`Failed to delete contacts: ${contactsDeleteError.message}`);
    }
    stats.contactsDeleted = contactsCount || 0;

    return {
      success: true,
      stats,
    };
  } catch (error) {
    console.error('Reset administration error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}
