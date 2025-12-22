/**
 * Invoice Booking Service
 *
 * Handles the complete process of booking a purchase invoice:
 * 1. Contact Management - Create or find supplier contact
 * 2. Purchase Invoice Creation - Create purchase_invoices record
 * 3. Journal Entry Creation - Create double-entry bookkeeping entries
 * 4. Document Status Update - Mark invoice as booked
 *
 * ACCOUNTING LOGIC:
 * - Purchase invoices are EXPENSES (negative cash flow)
 * - DEBIT: Expense account (4xxx) with net amount - MUST be type EXPENSE or ASSET
 * - DEBIT: VAT to claim (1300) with VAT amount - ONLY if vat_amount > 0.01
 * - CREDIT: Supplier liability (0400-0499 or contact ledger) with total amount
 *
 * For 0% VAT invoices (vrijgesteld/verlegd):
 * - DEBIT: Expense account with total amount (no VAT line)
 * - CREDIT: Supplier liability with total amount
 */

import { supabase } from './supabase';
import type { Database } from './database.types';
import type { EnhancedInvoiceData } from './intelligentInvoiceProcessor';
import { findActiveAccountsPayable } from './systemAccountsService';
import { getAccountIdByCode } from './bankService';
import { getCashAccount, getPrivateAccount } from './financialSettingsService';
import { getCurrentCompanyId } from './companyHelper';

type Contact = Database['public']['Tables']['contacts']['Row'];
type Account = Database['public']['Tables']['accounts']['Row'];


export type PaymentMethod = 'none' | 'cash' | 'private';

export interface BookInvoiceParams {
  documentId: string;
  invoiceData: EnhancedInvoiceData;
  expenseAccountId: string;
  supplierContactId?: string;
  notes?: string;
  paymentMethod?: PaymentMethod;
}

export interface BookInvoiceResult {
  success: boolean;
  purchaseInvoiceId?: string;
  journalEntryId?: string;
  contactId?: string;
  paymentAccountUsed?: { code: string; name: string };
  error?: string;
}

/**
 * Book a purchase invoice to the ledger
 *
 * This function handles the complete booking process including:
 * - Contact creation/lookup
 * - Purchase invoice record creation
 * - Journal entry with double-entry bookkeeping
 * - Document status update
 */
export async function bookInvoice(params: BookInvoiceParams): Promise<BookInvoiceResult> {
  const { documentId, invoiceData, expenseAccountId, supplierContactId, notes, paymentMethod = 'none' } = params;

  console.log('\n' + '═'.repeat(70));
  console.log('📗 [BOOKING SERVICE] Starting invoice booking process');
  console.log('═'.repeat(70));
  console.log(`Document ID: ${documentId}`);
  console.log(`Supplier: ${invoiceData.supplier_name || 'Unknown'}`);
  console.log(`Amount: €${invoiceData.total_amount?.toFixed(2) || '0.00'}`);
  console.log(`Expense Account: ${expenseAccountId}`);
  console.log('─'.repeat(70));

  try {
    const companyId = await getCurrentCompanyId();
    if (!companyId) {
      throw new Error('No company selected');
    }
    // STEP 0: Validate Expense Account Type
    console.log('\n📋 STEP 0: Expense Account Validation');
    console.log('─'.repeat(70));

    const { data: expenseAccount, error: accountError } = await supabase
      .from('accounts')
      .select('id, code, name, type')
      .eq('id', expenseAccountId)
      .single();

    if (accountError || !expenseAccount) {
      throw new Error(`Expense account not found: ${expenseAccountId}`);
    }

    if (expenseAccount.type !== 'Expense' && expenseAccount.type !== 'Asset') {
      throw new Error(
        `Invalid account type: ${expenseAccount.code} - ${expenseAccount.name} is type "${expenseAccount.type}". ` +
        `Only EXPENSE or ASSET accounts can be used for invoice booking. ` +
        `Please select a cost account (4xxx) or asset account.`
      );
    }

    console.log(`  ✓ Valid expense account: ${expenseAccount.code} - ${expenseAccount.name} (${expenseAccount.type})`);

    // STEP 1: Contact Management
    console.log('\n📋 STEP 1: Contact Management');
    console.log('─'.repeat(70));

    let contactId = supplierContactId || invoiceData.contact_id;

    if (!contactId && invoiceData.supplier_name) {
      console.log('  Creating new supplier contact...');
      const newContact = await createSupplierContact(
        invoiceData.supplier_name,
        expenseAccountId
      );

      if (!newContact) {
        throw new Error('Failed to create supplier contact');
      }

      contactId = newContact.id;
      console.log(`  ✓ Created contact: ${newContact.company_name} (ID: ${contactId})`);
    } else if (contactId) {
      console.log(`  ✓ Using existing contact (ID: ${contactId})`);
    } else {
      throw new Error('No supplier contact information available');
    }

    // STEP 2: Fetch supplier's default creditor account
    console.log('\n📋 STEP 2: Supplier Creditor Account');
    console.log('─'.repeat(70));

    const { data: contact } = await supabase
      .from('contacts')
      .select('default_ledger_account_id, company_name')
      .eq('id', contactId)
      .single();

    let creditorAccountId = contact?.default_ledger_account_id;

    if (!creditorAccountId) {
      console.log('  No default creditor account, finding generic supplier account...');
      const creditorAccount = await findActiveAccountsPayable();
      creditorAccountId = creditorAccount.id;
      console.log(`  ✓ Using generic creditor: ${creditorAccount.code} - ${creditorAccount.name}`);
    } else {
      console.log(`  ✓ Using contact's default ledger account: ${creditorAccountId}`);
    }

    // STEP 3: Fetch VAT account (only used if VAT amount > 0)
    console.log('\n📋 STEP 3: VAT Account (Te vorderen BTW)');
    console.log('─'.repeat(70));

    const { data: vatAccount } = await supabase
      .from('accounts')
      .select('id, code, name')
      .eq('code', '1300')
      .eq('is_active', true)
      .single();

    if (!vatAccount) {
      throw new Error('VAT account (1300 - Te vorderen BTW) not found. Please create this account first.');
    }

    console.log(`  ✓ VAT Account: ${vatAccount.code} - ${vatAccount.name}`);

    // STEP 4: Calculate amounts
    console.log('\n📋 STEP 4: Amount Calculation');
    console.log('─'.repeat(70));

    const totalAmount = invoiceData.total_amount || 0;
    const vatAmount = invoiceData.vat_amount || 0;
    const netAmount = invoiceData.net_amount || (totalAmount - vatAmount);
    const vatPercentage = invoiceData.vat_percentage || (vatAmount > 0 && netAmount > 0 ? (vatAmount / netAmount) * 100 : 21);

    console.log(`  Total (incl. VAT): €${totalAmount.toFixed(2)}`);
    console.log(`  Net Amount:        €${netAmount.toFixed(2)}`);
    console.log(`  VAT Amount:        €${vatAmount.toFixed(2)} (${vatPercentage}%)`);

    if (totalAmount <= 0) {
      throw new Error('Invalid amount: Total must be greater than 0');
    }

    // STEP 5: Create Journal Entry
    console.log('\n📋 STEP 5: Journal Entry Creation');
    console.log('─'.repeat(70));

    const invoiceDate = invoiceData.invoice_date || new Date().toISOString().split('T')[0];
    const description = `Inkoopfactuur ${invoiceData.invoice_number || ''} - ${invoiceData.supplier_name || 'Leverancier'}`.trim();

    const { data: journalEntry, error: journalError } = await supabase
      .from('journal_entries')
      .insert({
        company_id: companyId,
        entry_date: invoiceDate,
        description: description,
        reference: invoiceData.invoice_number || null,
        status: 'Final',
        contact_id: contactId,
        memoriaal_type: 'Inkoopfactuur',
      })
      .select()
      .single();

    if (journalError || !journalEntry) {
      console.error('  ❌ Journal entry creation failed:', journalError);
      throw new Error(`Failed to create journal entry: ${journalError?.message}`);
    }

    console.log(`  ✓ Journal Entry created (ID: ${journalEntry.id})`);

    // STEP 6: Create Journal Lines (Double Entry)
    console.log('\n📋 STEP 6: Journal Lines (Double Entry Bookkeeping)');
    console.log('─'.repeat(70));

    const journalLines = [];

    // Line 1: DEBIT Expense Account (Net Amount)
    // This is ALWAYS the EXPENSE or ASSET account (never VAT, Bank, or Creditor)
    journalLines.push({
      journal_entry_id: journalEntry.id,
      account_id: expenseAccountId,
      debit: netAmount,
      credit: 0,
      description: `${description} (Netto)`,
    });
    console.log(`  [DEBIT]  Expense Account: €${netAmount.toFixed(2)}`);

    // Line 2: DEBIT VAT to Claim (VAT Amount) - only if VAT > 0.01
    if (vatAmount > 0.01) {
      journalLines.push({
        journal_entry_id: journalEntry.id,
        account_id: vatAccount.id,
        debit: vatAmount,
        credit: 0,
        description: `${description} (BTW ${vatPercentage}%)`,
      });
      console.log(`  [DEBIT]  VAT Account: €${vatAmount.toFixed(2)}`);
    } else if (vatAmount > 0 && vatAmount <= 0.01) {
      console.log(`  ⚠ VAT amount €${vatAmount.toFixed(2)} too small, skipping VAT line (0% BTW transaction)`);
    } else {
      console.log(`  ℹ No VAT amount (0% BTW transaction) - skipping VAT line`);
    }

    // Line 3: CREDIT Creditor Account (Total Amount)
    journalLines.push({
      journal_entry_id: journalEntry.id,
      account_id: creditorAccountId,
      debit: 0,
      credit: totalAmount,
      description: `${description} (Te betalen)`,
    });
    console.log(`  [CREDIT] Creditor Account: €${totalAmount.toFixed(2)}`);

    // Validate: DEBIT must equal CREDIT (Double Entry fundamental rule)
    const totalDebit = journalLines.reduce((sum, line) => sum + (line.debit || 0), 0);
    const totalCredit = journalLines.reduce((sum, line) => sum + (line.credit || 0), 0);

    console.log(`\n  Validation: Total DEBIT = €${totalDebit.toFixed(2)}, Total CREDIT = €${totalCredit.toFixed(2)}`);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new Error(`Double entry validation failed: DEBIT (€${totalDebit.toFixed(2)}) ≠ CREDIT (€${totalCredit.toFixed(2)})`);
    }

    console.log(`  ✓ Double entry validation passed (DEBIT = CREDIT)`);

    const { error: linesError } = await supabase
      .from('journal_lines')
      .insert(journalLines);

    if (linesError) {
      console.error('  ❌ Journal lines creation failed:', linesError);
      await supabase.from('journal_entries').delete().eq('id', journalEntry.id);
      throw new Error(`Failed to create journal lines: ${linesError.message}`);
    }

    console.log(`  ✓ ${journalLines.length} journal lines created`);

    // STEP 7: Create Purchase Invoice Record
    console.log('\n📋 STEP 7: Purchase Invoice Record');
    console.log('─'.repeat(70));

    const dueDate = invoiceData.invoice_date
      ? new Date(new Date(invoiceData.invoice_date).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const { data: purchaseInvoice, error: purchaseError } = await supabase
      .from('purchase_invoices')
      .insert({
        company_id: companyId,
        contact_id: contactId,
        invoice_number: invoiceData.invoice_number || `INV-${Date.now()}`,
        invoice_date: invoiceDate,
        due_date: dueDate,
        total_amount: totalAmount,
        subtotal: netAmount,
        vat_amount: vatAmount,
        net_amount: netAmount,
        status: invoiceData.payment_match?.matched ? 'Paid' : 'Pending',
        journal_entry_id: journalEntry.id,
        description: description,
        document_id: documentId,
        notes: notes || invoiceData.processing_notes?.join('\n'),
        paid_at: invoiceData.payment_match?.matched ? invoiceData.payment_match.transaction_date : null,
      })
      .select()
      .single();

    if (purchaseError || !purchaseInvoice) {
      console.error('  ❌ Purchase invoice creation failed:', purchaseError);
      await supabase.from('journal_entries').delete().eq('id', journalEntry.id);
      throw new Error(`Failed to create purchase invoice: ${purchaseError?.message}`);
    }

    console.log(`  ✓ Purchase Invoice created (ID: ${purchaseInvoice.id})`);
    console.log(`  Status: ${purchaseInvoice.status}`);

    // STEP 8: Update Document Status
    console.log('\n📋 STEP 8: Document Status Update');
    console.log('─'.repeat(70));

    const { error: docUpdateError } = await supabase
      .from('documents_inbox')
      .update({
        status: 'Booked',
        journal_entry_id: journalEntry.id,
        booked_at: new Date().toISOString(),
      })
      .eq('id', documentId);

    if (docUpdateError) {
      console.error('  ⚠ Warning: Failed to update document status:', docUpdateError);
    } else {
      console.log('  ✓ Document marked as Booked');
    }

    // STEP 9: Link bank transaction if matched
    if (invoiceData.payment_match?.matched && invoiceData.payment_match.transaction_id) {
      console.log('\n📋 STEP 9: Bank Transaction Linking');
      console.log('─'.repeat(70));

      const { error: bankUpdateError } = await supabase
        .from('bank_transactions')
        .update({
          matched_invoice_id: purchaseInvoice.id,
          journal_entry_id: journalEntry.id,
          status: 'Matched',
        })
        .eq('id', invoiceData.payment_match.transaction_id);

      if (bankUpdateError) {
        console.error('  ⚠ Warning: Failed to link bank transaction:', bankUpdateError);
      } else {
        console.log(`  ✓ Bank transaction linked (ID: ${invoiceData.payment_match.transaction_id})`);
      }
    }

    // STEP 10: Process Direct Payment (if applicable)
    let paymentAccountUsed: { code: string; name: string } | undefined;

    if (paymentMethod && paymentMethod !== 'none') {
      console.log('\n📋 STEP 10: Direct Payment Processing');
      console.log('─'.repeat(70));
      console.log(`  Payment Method: ${paymentMethod === 'cash' ? 'Kas (Cash)' : 'Privé opname'}`);

      try {
        // Get payment account from financial settings
        const paymentAccount = paymentMethod === 'cash'
          ? await getCashAccount()
          : await getPrivateAccount();

        if (!paymentAccount) {
          throw new Error(
            `Geen ${paymentMethod === 'cash' ? 'kas' : 'privé'}-rekening geconfigureerd. ` +
            'Stel deze in via Instellingen → Financiële Instellingen.'
          );
        }

        console.log(`  ✓ Using configured account: ${paymentAccount.code} - ${paymentAccount.name}`);
        paymentAccountUsed = { code: paymentAccount.code, name: paymentAccount.name };

        // Create payment journal entry
        // DEBIT: Creditor (clear liability) / CREDIT: Cash or Private account
        const paymentDescription = `Betaling ${invoiceData.invoice_number || ''} via ${paymentAccount.name}`.trim();

        const { data: paymentEntry, error: paymentEntryError } = await supabase
          .from('journal_entries')
          .insert({
            company_id: companyId,
            entry_date: invoiceDate,
            description: paymentDescription,
            reference: invoiceData.invoice_number || null,
            status: 'Final',
            contact_id: contactId,
            memoriaal_type: 'Betaling',
          })
          .select()
          .single();

        if (paymentEntryError || !paymentEntry) {
          throw new Error(`Failed to create payment entry: ${paymentEntryError?.message}`);
        }

        const paymentLines = [
          {
            journal_entry_id: paymentEntry.id,
            account_id: creditorAccountId,
            debit: totalAmount,
            credit: 0,
            description: `Crediteur vereffening`,
          },
          {
            journal_entry_id: paymentEntry.id,
            account_id: paymentAccount.id,
            debit: 0,
            credit: totalAmount,
            description: `Betaling via ${paymentAccount.name}`,
          },
        ];

        const { error: paymentLinesError } = await supabase
          .from('journal_lines')
          .insert(paymentLines);

        if (paymentLinesError) {
          console.error('  ❌ Payment lines creation failed:', paymentLinesError);
          throw new Error(`Failed to create payment lines: ${paymentLinesError.message}`);
        }

        // Update purchase invoice status to Paid
        const { error: updateInvoiceError } = await supabase
          .from('purchase_invoices')
          .update({
            status: 'Paid',
            paid_at: invoiceDate,
          })
          .eq('id', purchaseInvoice.id);

        if (updateInvoiceError) {
          console.error('  ⚠ Warning: Failed to update invoice to Paid:', updateInvoiceError);
        }

        console.log(`  ✓ Payment journal entry created (ID: ${paymentEntry.id})`);
        console.log(`  ✓ Invoice marked as Paid`);
        console.log(`  ✓ Payment processed via: ${paymentAccount.code} - ${paymentAccount.name}`);

      } catch (paymentError) {
        console.error('  ⚠ Warning: Direct payment processing failed:', paymentError);
        // Don't fail the entire booking if payment fails - invoice is still booked
        // User can manually process payment later
      }
    }

    console.log('\n' + '═'.repeat(70));
    console.log('✅ [BOOKING SERVICE] Invoice booking completed successfully');
    console.log('═'.repeat(70));
    console.log(`Purchase Invoice ID: ${purchaseInvoice.id}`);
    console.log(`Journal Entry ID: ${journalEntry.id}`);
    console.log(`Contact ID: ${contactId}`);
    if (paymentAccountUsed) {
      console.log(`Payment Account Used: ${paymentAccountUsed.code} - ${paymentAccountUsed.name}`);
    }
    console.log('═'.repeat(70) + '\n');

    return {
      success: true,
      purchaseInvoiceId: purchaseInvoice.id,
      journalEntryId: journalEntry.id,
      contactId: contactId,
      paymentAccountUsed,
    };
  } catch (error) {
    console.error('\n❌ [BOOKING SERVICE] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Create a new supplier contact
 */
async function createSupplierContact(
  companyName: string,
  defaultLedgerAccountId?: string
): Promise<Contact | null> {
  try {
    // Check if contact already exists
    const { data: existing } = await supabase
      .from('contacts')
      .select('*')
      .ilike('company_name', companyName)
      .limit(1)
      .maybeSingle();

    if (existing) {
      console.log(`  ℹ Contact already exists: ${existing.company_name}`);
      return existing;
    }

    // Find default creditor account if not provided
    let ledgerAccountId = defaultLedgerAccountId;
    if (!ledgerAccountId) {
      try {
        const creditorAccount = await findActiveAccountsPayable();
        ledgerAccountId = creditorAccount.id;
      } catch (error) {
        console.warn('  ⚠ Could not find creditor account:', error);
        // Continue without default account - it's optional for contact creation
      }
    }

    // Create new contact
    const companyId = await getCurrentCompanyId();
    if (!companyId) {
      console.error('  ❌ No company selected');
      return null;
    }

    const { data: newContact, error } = await supabase
      .from('contacts')
      .insert({
        company_id: companyId,
        company_name: companyName,
        relation_type: 'Supplier',
        default_ledger_account_id: ledgerAccountId || null,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error('  ❌ Failed to create contact:', error);
      return null;
    }

    return newContact;
  } catch (error) {
    console.error('  ❌ Error creating contact:', error);
    return null;
  }
}
