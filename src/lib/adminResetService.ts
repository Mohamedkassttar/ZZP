import { supabase } from './supabase';

export interface ResetResult {
  success: boolean;
  error?: string;
  stats?: {
    journalEntriesDeleted: number;
    journalLinesDeleted: number;
    purchaseInvoicesDeleted: number;
    salesInvoicesDeleted: number;
    documentsDeleted: number;
    bankTransactionsDeleted: number;
    contactsDeleted: number;
  };
}

export async function resetAdministration(): Promise<ResetResult> {
  try {
    console.log('🔄 Starting Smart Reset - Preserving configuration...');

    const stats = {
      journalEntriesDeleted: 0,
      journalLinesDeleted: 0,
      purchaseInvoicesDeleted: 0,
      salesInvoicesDeleted: 0,
      documentsDeleted: 0,
      bankTransactionsDeleted: 0,
      contactsDeleted: 0,
    };

    // Step 1: Delete journal lines first (child records)
    console.log('  → Deleting journal lines...');
    const { count: linesCount, error: linesError } = await supabase
      .from('journal_lines')
      .delete({ count: 'exact' })
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (linesError) {
      console.error('Error deleting journal lines:', linesError);
      throw new Error(`Failed to delete journal lines: ${linesError.message}`);
    }
    stats.journalLinesDeleted = linesCount || 0;
    console.log(`  ✓ Deleted ${linesCount || 0} journal lines`);

    // Step 2: Delete journal entries (parent records)
    console.log('  → Deleting journal entries...');
    const { count: entriesCount, error: entriesError } = await supabase
      .from('journal_entries')
      .delete({ count: 'exact' })
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (entriesError) {
      console.error('Error deleting journal entries:', entriesError);
      throw new Error(`Failed to delete journal entries: ${entriesError.message}`);
    }
    stats.journalEntriesDeleted = entriesCount || 0;
    console.log(`  ✓ Deleted ${entriesCount || 0} journal entries`);

    // Step 3: Delete invoice lines (if table exists)
    console.log('  → Deleting invoice lines...');
    const { error: invoiceLinesError } = await supabase
      .from('invoice_lines')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (invoiceLinesError && !invoiceLinesError.message.includes('does not exist')) {
      console.warn('Warning deleting invoice lines:', invoiceLinesError.message);
    }

    // Step 4: Delete legacy invoices table
    console.log('  → Deleting legacy invoices...');
    const { error: legacyInvoicesError } = await supabase
      .from('invoices')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (legacyInvoicesError && !legacyInvoicesError.message.includes('does not exist')) {
      console.warn('Warning deleting invoices:', legacyInvoicesError.message);
    }

    // Step 5: Delete purchase invoices
    console.log('  → Deleting purchase invoices...');
    const { count: purchaseInvoicesCount, error: purchaseInvoicesError } = await supabase
      .from('purchase_invoices')
      .delete({ count: 'exact' })
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (purchaseInvoicesError) {
      console.error('Error deleting purchase invoices:', purchaseInvoicesError);
      throw new Error(`Failed to delete purchase invoices: ${purchaseInvoicesError.message}`);
    }
    stats.purchaseInvoicesDeleted = purchaseInvoicesCount || 0;
    console.log(`  ✓ Deleted ${purchaseInvoicesCount || 0} purchase invoices`);

    // Step 6: Delete sales invoices
    console.log('  → Deleting sales invoices...');
    const { count: salesInvoicesCount, error: salesInvoicesError } = await supabase
      .from('sales_invoices')
      .delete({ count: 'exact' })
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (salesInvoicesError) {
      console.error('Error deleting sales invoices:', salesInvoicesError);
      throw new Error(`Failed to delete sales invoices: ${salesInvoicesError.message}`);
    }
    stats.salesInvoicesDeleted = salesInvoicesCount || 0;
    console.log(`  ✓ Deleted ${salesInvoicesCount || 0} sales invoices`);

    // Step 7: Delete bank transactions
    console.log('  → Deleting bank transactions...');
    const { count: bankTransactionsCount, error: bankDeleteError } = await supabase
      .from('bank_transactions')
      .delete({ count: 'exact' })
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (bankDeleteError) {
      console.error('Error deleting bank transactions:', bankDeleteError);
      throw new Error(`Failed to delete bank transactions: ${bankDeleteError.message}`);
    }
    stats.bankTransactionsDeleted = bankTransactionsCount || 0;
    console.log(`  ✓ Deleted ${bankTransactionsCount || 0} bank transactions`);

    // Step 8: Delete documents
    console.log('  → Deleting documents...');
    const { count: documentsCount, error: documentsError } = await supabase
      .from('documents_inbox')
      .delete({ count: 'exact' })
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (documentsError) {
      console.error('Error deleting documents:', documentsError);
      throw new Error(`Failed to delete documents: ${documentsError.message}`);
    }
    stats.documentsDeleted = documentsCount || 0;
    console.log(`  ✓ Deleted ${documentsCount || 0} documents from inbox`);

    // Step 9: Delete contacts
    console.log('  → Deleting contacts...');
    const { count: contactsCount, error: contactsDeleteError } = await supabase
      .from('contacts')
      .delete({ count: 'exact' })
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (contactsDeleteError) {
      console.error('Error deleting contacts:', contactsDeleteError);
      throw new Error(`Failed to delete contacts: ${contactsDeleteError.message}`);
    }
    stats.contactsDeleted = contactsCount || 0;
    console.log(`  ✓ Deleted ${contactsCount || 0} contacts`);

    // Step 10: Delete mileage logs (if any)
    console.log('  → Deleting mileage logs...');
    const { error: mileageError } = await supabase
      .from('mileage_logs')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (mileageError && !mileageError.message.includes('does not exist')) {
      console.warn('Warning deleting mileage logs:', mileageError.message);
    }

    // Step 11: Clear storage bucket (optional - only if files exist)
    console.log('  → Clearing uploaded files from storage...');
    try {
      const { data: files } = await supabase.storage
        .from('invoices')
        .list();

      if (files && files.length > 0) {
        const filePaths = files.map(f => f.name);
        await supabase.storage
          .from('invoices')
          .remove(filePaths);
        console.log(`  ✓ Deleted ${files.length} files from storage`);
      }
    } catch (storageError) {
      console.warn('Warning clearing storage:', storageError);
    }

    console.log('\n✅ Smart Reset Complete!');
    console.log('📊 Summary:');
    console.log(`  - Journal Entries: ${stats.journalEntriesDeleted} (${stats.journalLinesDeleted} lines)`);
    console.log(`  - Purchase Invoices: ${stats.purchaseInvoicesDeleted}`);
    console.log(`  - Sales Invoices: ${stats.salesInvoicesDeleted}`);
    console.log(`  - Documents: ${stats.documentsDeleted}`);
    console.log(`  - Bank Transactions: ${stats.bankTransactionsDeleted}`);
    console.log(`  - Contacts: ${stats.contactsDeleted}`);
    console.log('\n✓ Configuration preserved (accounts, bank_rules, company_settings, fiscal_years)');

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
