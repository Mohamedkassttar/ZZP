import { supabase } from './supabase';
import type { Database } from './database.types';
import { callOpenAIWithRetry, extractJSON } from './openaiRetryHelper';
import { findActiveAccountsPayable } from './systemAccountsService';
import { getCurrentCompanyId } from './companyHelper';

type Account = Database['public']['Tables']['accounts']['Row'];
type Contact = Database['public']['Tables']['contacts']['Row'];

/**
 * Check if account is blacklisted (should never be suggested for bank transactions)
 * Blacklisted accounts:
 * - 4200-4299: Depreciation costs (Afschrijvingskosten)
 * - 4900-4999: Internal allocations/corrections
 * - Any account with "Afschrijving" or "Depreciation" in name
 */
function isBlacklistedAccount(account: Account): boolean {
  const code = parseInt(account.code);

  // Blacklist code ranges
  if ((code >= 4200 && code <= 4299) || (code >= 4900 && code <= 4999)) {
    return true;
  }

  // Blacklist by name keywords
  const name = account.name.toLowerCase();
  const blacklistKeywords = ['afschrijving', 'depreciation', 'amortization'];

  for (const keyword of blacklistKeywords) {
    if (name.includes(keyword)) {
      return true;
    }
  }

  return false;
}

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

export interface NewLedgerProposal {
  code: string;
  name: string;
  type: 'Revenue' | 'Expense' | 'Asset' | 'Liability' | 'Equity';
  vat_code: 'HIGH' | 'LOW' | 'NONE';
}

export interface AIReconciliationSuggestion {
  suggested_creditor: string;
  suggested_ledger_id: string | null;
  suggested_ledger_code: string;
  suggested_ledger_name: string;
  likely_vat_code: number;
  is_new_creditor: boolean;
  existing_contact_id?: string;
  confidence: number;
  new_ledger_proposal?: NewLedgerProposal;
}

export async function analyzeUnmatchedTransaction(
  description: string,
  amount: number
): Promise<AIReconciliationSuggestion> {
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key is not configured');
  }

  const { data: allAccounts } = await supabase
    .from('accounts')
    .select('*')
    .eq('is_active', true);

  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, company_name, relation_type, default_ledger_account_id, accounts(id, code, name)')
    .eq('is_active', true);

  // Filter out blacklisted accounts (depreciation, internal corrections)
  const accounts = (allAccounts || []).filter(acc => !isBlacklistedAccount(acc));
  const blacklistedCount = (allAccounts || []).length - accounts.length;

  if (blacklistedCount > 0) {
    console.log(`⚠ [AI RECON] Filtered out ${blacklistedCount} blacklisted accounts (depreciation/internal)`);
  }

  const accountList = accounts
    .map(acc => ({
      id: acc.id,
      code: acc.code,
      name: acc.name,
      type: acc.type,
      vat_code: acc.vat_code,
    }));

  const contactList = (contacts || [])
    .filter(c => c.relation_type === 'Supplier' || c.relation_type === 'Both')
    .map(c => ({
      id: c.id,
      name: c.company_name,
      default_ledger_account_id: c.default_ledger_account_id,
      default_ledger_account: c.accounts ? {
        id: (c.accounts as any).id,
        code: (c.accounts as any).code,
        name: (c.accounts as any).name,
      } : null,
    }));

  const systemPrompt = `You are an expert Dutch accountant specializing in ZZP (freelancer) bookkeeping.

Your task is to analyze a bank transaction and suggest the appropriate booking based on the transaction direction and description.

CRITICAL TRANSACTION DIRECTION RULES:
- **POSITIVE amount (Money IN)**: Prioritize Revenue (8xxx), then Equity/Liabilities (refunds, loans, capital injections)
- **NEGATIVE amount (Money OUT)**: Prioritize Expenses (4xxx), then Liabilities (paying off debt), then Assets (transfers, investments)

Analyze the transaction and predict:
- suggested_creditor: Extract or infer the company/person name
- suggested_ledger_id: The UUID of the most appropriate account (OR null if proposing new account)
- suggested_ledger_code: The account code (existing or proposed)
- suggested_ledger_name: The account name (existing or proposed)
- likely_vat_code: The VAT percentage (21, 9, or 0)
- is_new_creditor: true if creditor NOT found in existing contacts
- existing_contact_id: UUID if creditor found in contacts (otherwise null)
- confidence: Your confidence level (0-1)
- new_ledger_proposal: ONLY if no existing account fits well, propose a new one with:
  - code: Appropriate code following Dutch chart of accounts
  - name: Clear descriptive name in Dutch
  - type: "Revenue" | "Expense" | "Asset" | "Liability" | "Equity"
  - vat_code: "HIGH" (21%), "LOW" (9%), or "NONE" (0%)

Dutch Chart of Accounts:
**Revenue (8xxx):**
- 8000-8099: Sales/Services revenue
- 8100-8199: Project revenue
- 8200-8299: Consulting revenue

**Expenses (4xxx):**
- 4000-4099: Auto/Transport (fuel, parking, leasing)
- 4100-4199: Accommodation (rent, utilities)
- 4200-4299: BLACKLISTED - Depreciation (NEVER use for bank transactions - year-end journal only)
- 4300-4399: Sales/Marketing (ads, promotion, website)
- 4400-4499: Communication (phone, internet, hosting)
- 4500-4599: General expenses
- 4600-4699: Professional services (accountant, lawyer)
- 4700-4799: Office supplies (equipment, software)
- 4800-4899: Financial costs (bank fees, interest)
- 4900-4999: BLACKLISTED - Internal allocations (NEVER use for bank transactions)

CRITICAL: Accounts in the 4200-4299 and 4900-4999 ranges are BLACKLISTED and will NOT appear in the available accounts list. These are for internal journal entries only, never for bank transactions.

**Assets (1xxx):**
- 1000-1099: Bank accounts
- 1100-1199: Receivables
- 1200-1299: Inventory

**Liabilities (1500-1999):**
- 1500-1599: Short-term payables
- 1600-1699: VAT payable
- 1700-1799: Long-term debt

**Equity (0xxx):**
- 0100: Capital
- 0400: Retained earnings

VAT Rate Guidelines:
- 21% (High): Electronics, software, office supplies, most services, fuel
- 9% (Low): Food, books, newspapers, hotel stays
- 0% (None): Financial services, insurance, international transactions

Examples:
- POSITIVE €5000 "Invoice payment Client X" → Revenue account 8000, VAT 21%
- NEGATIVE €50 "Shell petrol" → Expense account 4010 (Brandstof), VAT 21%
- NEGATIVE €100 "Transfer to savings" → Asset account (internal transfer), VAT 0%
- POSITIVE €1000 "Loan received" → Liability account, VAT 0%

Available contacts (IMPORTANT: If a contact has a default_ledger_account, ALWAYS use that as your suggestion):
${JSON.stringify(contactList, null, 2)}

Available accounts (all types):
${JSON.stringify(accountList, null, 2)}

CRITICAL RULE: If you identify a known contact (existing_contact_id is set) that has a default_ledger_account, you MUST use that account as your suggestion. The default_ledger_account overrides all other logic.`;

  try {
    console.log('\n' + '═'.repeat(60));
    console.log('🤖 [AI RECONCILIATION] Starting analysis');
    console.log(`📝 Description: "${description}"`);
    console.log(`💰 Amount: €${amount.toFixed(2)}`);
    console.log(`📊 Available accounts: ${accountList.length}`);
    console.log(`👥 Available contacts: ${contactList.length}`);
    console.log('═'.repeat(60));

    const requestConfig = {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Analyze this bank transaction:
Description: "${description}"
Amount: €${amount.toFixed(2)}

Provide your analysis in JSON format.`,
        },
      ],
      max_tokens: 500,
      temperature: 0.1,
    };

    console.log('📤 [AI RECONCILIATION] Sending request to OpenAI...');

    const data = await callOpenAIWithRetry(OPENAI_API_KEY, requestConfig);

    console.log('📥 [AI RECONCILIATION] Received response from OpenAI');

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      console.error('❌ [AI RECONCILIATION] No content in OpenAI response');
      console.error('Full response:', JSON.stringify(data, null, 2));
      throw new Error('No response from OpenAI - received empty content');
    }

    console.log('✓ [AI RECONCILIATION] Extracting JSON from response...');

    const suggestion: AIReconciliationSuggestion = extractJSON(content);

    console.log('✓ [AI RECONCILIATION] Analysis complete');
    console.log('📊 Result:', {
      creditor: suggestion.suggested_creditor,
      account: `${suggestion.suggested_ledger_code} - ${suggestion.suggested_ledger_name}`,
      confidence: `${(suggestion.confidence * 100).toFixed(0)}%`,
      isNew: suggestion.is_new_creditor,
    });

    return suggestion;
  } catch (error) {
    console.error('❌ [AI RECONCILIATION] Analysis failed');
    console.error('Error details:', error);

    // Re-throw with more context
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`AI Reconciliation failed: ${errorMessage}`);
  }
}

interface BookTransactionParams {
  bankTransactionId: string;
  creditorName: string;
  creditorId?: string;
  ledgerAccountId: string | null;
  newLedgerProposal?: NewLedgerProposal;
  vatCode: number;
  amount: number;
  transactionDate: string;
  description: string;
  setAsDefault?: boolean;
}

export async function bookUnmatchedTransaction(
  params: BookTransactionParams
): Promise<{ success: boolean; invoiceId?: string; error?: string }> {
  try {
    console.log('[Booking] Starting transaction booking process...', { params });

    const companyId = await getCurrentCompanyId();
    if (!companyId) {
      throw new Error('No company selected');
    }

    let finalCreditorId = params.creditorId;

    if (!finalCreditorId) {
      console.log('[Booking] Creating new creditor:', params.creditorName);
      const { data: newContact, error: contactError } = await supabase
        .from('contacts')
        .insert({
          company_name: params.creditorName,
          relation_type: 'Supplier',
          is_active: true,
        })
        .select('id')
        .single();

      if (contactError) {
        console.error('[Booking] Failed to create creditor:', contactError);
        throw new Error(`Failed to create creditor: ${contactError.message}`);
      }

      if (!newContact) {
        console.error('[Booking] No contact data returned');
        throw new Error('Failed to create creditor: No data returned');
      }

      finalCreditorId = newContact.id;
      console.log('[Booking] Creditor created successfully:', finalCreditorId);
    } else {
      console.log('[Booking] Using existing creditor:', finalCreditorId);
    }

    let finalLedgerAccountId = params.ledgerAccountId;

    if (!finalLedgerAccountId && params.newLedgerProposal) {
      console.log('[Booking] Creating new ledger account:', params.newLedgerProposal);
      const vatCodeMap = {
        'HIGH': 21,
        'LOW': 9,
        'NONE': 0,
      };

      const { data: newAccount, error: accountError } = await supabase
        .from('accounts')
        .insert({
          code: params.newLedgerProposal.code,
          name: params.newLedgerProposal.name,
          type: params.newLedgerProposal.type,
          vat_code: vatCodeMap[params.newLedgerProposal.vat_code],
          is_active: true,
        })
        .select('id')
        .single();

      if (accountError) {
        console.error('[Booking] Failed to create new ledger account:', accountError);
        throw new Error(`Failed to create new ledger account: ${accountError.message}`);
      }

      if (!newAccount) {
        console.error('[Booking] No account data returned');
        throw new Error('Failed to create new ledger account: No data returned');
      }

      finalLedgerAccountId = newAccount.id;
      console.log('[Booking] Ledger account created successfully:', finalLedgerAccountId);
    }

    if (!finalLedgerAccountId) {
      throw new Error('No ledger account ID provided or created');
    }

    if (params.setAsDefault && finalCreditorId && finalLedgerAccountId) {
      console.log('[Booking] Setting default ledger account for contact:', {
        contactId: finalCreditorId,
        ledgerAccountId: finalLedgerAccountId,
      });

      const { error: updateContactError } = await supabase
        .from('contacts')
        .update({ default_ledger_account_id: finalLedgerAccountId })
        .eq('id', finalCreditorId);

      if (updateContactError) {
        console.warn('[Booking] Failed to set default ledger account:', updateContactError);
      } else {
        console.log('[Booking] Default ledger account set successfully');
      }
    }

    const { data: bankAccount } = await supabase
      .from('accounts')
      .select('id')
      .eq('type', 'Asset')
      .ilike('name', '%bank%')
      .limit(1)
      .maybeSingle();

    if (!bankAccount) {
      throw new Error('No bank account found');
    }

    const creditorsAccount = await findActiveAccountsPayable();

    const { data: vatReceivableAccount } = await supabase
      .from('accounts')
      .select('id')
      .eq('type', 'Asset')
      .or('name.ilike.%btw te vorderen%,name.ilike.%vat receivable%')
      .limit(1)
      .maybeSingle();

    const absoluteAmount = Math.abs(params.amount);
    const netAmount = params.vatCode > 0
      ? absoluteAmount / (1 + params.vatCode / 100)
      : absoluteAmount;
    const vatAmount = absoluteAmount - netAmount;

    console.log('[Booking] Creating invoice with contact_id:', finalCreditorId);
    const invoiceData = {
      contact_id: finalCreditorId,
      invoice_number: `AUTO-${Date.now()}`,
      invoice_date: params.transactionDate,
      due_date: params.transactionDate,
      status: 'Paid' as const,
      net_amount: netAmount,
      vat_amount: vatAmount,
      total_amount: absoluteAmount,
      notes: `Auto-booked from bank transaction: ${params.description}`,
    };

    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert(invoiceData)
      .select('id')
      .single();

    if (invoiceError) {
      console.error('[Booking] Failed to create invoice:', invoiceError, 'Data:', invoiceData);
      throw new Error(`Failed to create invoice: ${invoiceError.message} (Code: ${invoiceError.code})`);
    }

    if (!invoice) {
      console.error('[Booking] No invoice data returned');
      throw new Error('Failed to create invoice: No data returned');
    }

    console.log('[Booking] Invoice created successfully:', invoice.id);

    const { data: costEntry, error: costEntryError } = await supabase
      .from('journal_entries')
      .insert({
        company_id: companyId,
        entry_date: params.transactionDate,
        description: `Cost: ${params.description}`,
        status: 'Final',
      })
      .select('id')
      .single();

    if (costEntryError || !costEntry) {
      throw new Error('Failed to create cost journal entry');
    }

    const costLines = [
      {
        journal_entry_id: costEntry.id,
        account_id: finalLedgerAccountId,
        debit: netAmount,
        credit: 0,
        description: params.description,
      },
      {
        journal_entry_id: costEntry.id,
        account_id: creditorsAccount.id,
        debit: 0,
        credit: absoluteAmount,
        description: `Creditor: ${params.creditorName}`,
      },
    ];

    if (vatAmount > 0 && vatReceivableAccount) {
      costLines.splice(1, 0, {
        journal_entry_id: costEntry.id,
        account_id: vatReceivableAccount.id,
        debit: vatAmount,
        credit: 0,
        description: `VAT ${params.vatCode}%`,
      });
    }

    const { error: costLinesError } = await supabase
      .from('journal_lines')
      .insert(costLines);

    if (costLinesError) {
      throw new Error('Failed to create cost journal lines');
    }

    const { data: suspenseAccount } = await supabase
      .from('accounts')
      .select('id')
      .eq('code', '2300')
      .maybeSingle();

    if (!suspenseAccount) {
      throw new Error('Suspense account 2300 (Nog te ontvangen inkoopfacturen) not found');
    }

    const { data: paymentEntry, error: paymentEntryError } = await supabase
      .from('journal_entries')
      .insert({
        company_id: companyId,
        entry_date: params.transactionDate,
        description: `Bank payment (suspense): ${params.description}`,
        status: 'Final',
        type: 'Bank',
      })
      .select('id')
      .single();

    if (paymentEntryError || !paymentEntry) {
      throw new Error('Failed to create payment journal entry');
    }

    const { error: paymentLinesError } = await supabase
      .from('journal_lines')
      .insert([
        {
          journal_entry_id: paymentEntry.id,
          account_id: suspenseAccount.id,
          debit: absoluteAmount,
          credit: 0,
          description: `Suspense - ${params.creditorName}`,
        },
        {
          journal_entry_id: paymentEntry.id,
          account_id: bankAccount.id,
          debit: 0,
          credit: absoluteAmount,
          description: 'Bank payment',
        },
      ]);

    if (paymentLinesError) {
      throw new Error('Failed to create payment journal lines');
    }

    const { error: updateError } = await supabase
      .from('bank_transactions')
      .update({
        journal_entry_id: paymentEntry.id,
        status: 'pending',
        matched_invoice_id: invoice.id,
      })
      .eq('id', params.bankTransactionId);

    if (updateError) {
      throw new Error('Failed to update bank transaction');
    }

    const { data: settlementEntry, error: settlementError } = await supabase
      .from('journal_entries')
      .insert({
        company_id: companyId,
        entry_date: params.transactionDate,
        description: `Settlement: ${params.description}`,
        reference: `SETTLEMENT-AUTO-${Date.now()}`,
        status: 'Final',
        type: 'settlement',
      })
      .select('id')
      .single();

    if (settlementError || !settlementEntry) {
      throw new Error('Failed to create settlement journal entry');
    }

    const { error: settlementLinesError } = await supabase
      .from('journal_lines')
      .insert([
        {
          journal_entry_id: settlementEntry.id,
          account_id: creditorsAccount.id,
          debit: absoluteAmount,
          credit: 0,
          description: `Clear creditor - ${params.creditorName}`,
        },
        {
          journal_entry_id: settlementEntry.id,
          account_id: suspenseAccount.id,
          debit: 0,
          credit: absoluteAmount,
          description: `Clear suspense`,
        },
      ]);

    if (settlementLinesError) {
      throw new Error('Failed to create settlement journal lines');
    }

    const { error: finalUpdateError } = await supabase
      .from('bank_transactions')
      .update({
        status: 'reconciled',
      })
      .eq('id', params.bankTransactionId);

    if (finalUpdateError) {
      throw new Error('Failed to update bank transaction to reconciled');
    }

    return { success: true, invoiceId: invoice.id };
  } catch (error) {
    console.error('Error booking transaction:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
