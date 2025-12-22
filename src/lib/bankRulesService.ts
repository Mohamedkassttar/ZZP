import { supabase } from './supabase';
import type { Database } from './database.types';
import { matchesWithWordBoundary } from './bankMatchingUtils';
import { getCurrentCompanyId } from './companyHelper';

type BankRule = Database['public']['Tables']['bank_rules']['Row'];
type Account = Database['public']['Tables']['accounts']['Row'];
type Contact = Database['public']['Tables']['contacts']['Row'];

interface BankRuleWithAccount extends BankRule {
  account?: Account;
}

interface MatchResult {
  matched: boolean;
  rule?: BankRuleWithAccount;
  contact?: Contact;
  journalEntryId?: string;
  confidence?: 'high' | 'medium' | 'low';
}

export async function matchTransactionWithContact(
  contraAccount: string | null,
  contraName: string | null,
  description: string,
  amount: number,
  transactionDate: string
): Promise<MatchResult> {
  if (!contraAccount && !contraName) {
    return { matched: false };
  }

  try {
    let contact: Contact | null = null;

    if (contraAccount) {
      const { data: contactByIban } = await supabase
        .from('contacts')
        .select('*')
        .eq('iban', contraAccount)
        .eq('is_active', true)
        .maybeSingle();

      contact = contactByIban;
    }

    if (!contact && contraName) {
      const { data: contactByName } = await supabase
        .from('contacts')
        .select('*')
        .ilike('company_name', `%${contraName}%`)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      contact = contactByName;
    }

    if (contact && contact.default_ledger_account_id) {
      const journalEntryId = await createContactBasedJournalEntry(
        contact,
        description,
        amount,
        transactionDate
      );

      return {
        matched: true,
        contact,
        journalEntryId,
        confidence: 'high',
      };
    }

    return { matched: false };
  } catch (error) {
    console.error('Error matching transaction with contact:', error);
    return { matched: false };
  }
}

export async function matchTransactionWithRules(
  description: string,
  amount: number,
  transactionDate: string
): Promise<MatchResult> {
  try {
    const { data: rules, error } = await supabase
      .from('bank_rules')
      .select('*, account:target_ledger_account_id(*), contact:contact_id(*)')
      .eq('is_active', true)
      .order('priority', { ascending: false });

    if (error) throw error;
    if (!rules || rules.length === 0) {
      return { matched: false };
    }

    for (const rule of rules) {
      let isMatch = false;

      if (rule.match_type === 'Exact') {
        isMatch = description.toLowerCase() === rule.keyword.toLowerCase();
      } else {
        isMatch = description.toLowerCase().includes(rule.keyword.toLowerCase());
      }

      if (isMatch) {
        if (rule.contact_id) {
          const contact = rule.contact as any;
          const journalEntryId = await createRuleBasedContactEntry(
            rule,
            contact,
            description,
            amount,
            transactionDate
          );

          return {
            matched: true,
            rule: rule as BankRuleWithAccount,
            contact,
            journalEntryId,
            confidence: 'high',
          };
        } else {
          const journalEntryId = await createProposedJournalEntry(
            rule,
            description,
            amount,
            transactionDate
          );

          return {
            matched: true,
            rule: rule as BankRuleWithAccount,
            journalEntryId,
            confidence: 'high',
          };
        }
      }
    }

    return { matched: false };
  } catch (error) {
    console.error('Error matching transaction with rules:', error);
    return { matched: false };
  }
}

async function createRuleBasedContactEntry(
  rule: BankRule,
  contact: Contact,
  description: string,
  amount: number,
  transactionDate: string
): Promise<string | undefined> {
  try {
    const companyId = await getCurrentCompanyId();
    if (!companyId) {
      throw new Error('No company selected');
    }

    const entryDescription = rule.description_template || `${description} (Rule: ${rule.keyword})`;

    const entryId = crypto.randomUUID();
    const { error: entryError } = await supabase
      .from('journal_entries')
      .insert({
        id: entryId,
        company_id: companyId,
        entry_date: transactionDate,
        description: entryDescription,
        status: 'Draft',
        contact_id: contact.id,
        type: 'Bank',
      });

    if (entryError) throw entryError;
    const journalEntry = { id: entryId };

    const { data: bankAccount } = await supabase
      .from('accounts')
      .select('id')
      .eq('type', 'Asset')
      .ilike('name', '%bank%')
      .limit(1)
      .maybeSingle();

    if (!bankAccount) {
      console.warn('No bank account found');
      return journalEntry.id;
    }

    const targetAccountId = rule.target_ledger_account_id || contact.default_ledger_account_id;
    if (!targetAccountId) {
      console.warn('No target account found for rule-based contact entry');
      return journalEntry.id;
    }

    const { data: targetAccount } = await supabase
      .from('accounts')
      .select('*')
      .eq('id', targetAccountId)
      .maybeSingle();

    if (!targetAccount) {
      console.warn('Target account not found');
      return journalEntry.id;
    }

    const absoluteAmount = Math.abs(amount);
    const isDebit = amount < 0;

    if (isDebit) {
      await supabase.from('journal_lines').insert([
        {
          journal_entry_id: journalEntry.id,
          account_id: targetAccountId,
          debit: absoluteAmount,
          credit: 0,
          description: targetAccount.name,
        },
        {
          journal_entry_id: journalEntry.id,
          account_id: bankAccount.id,
          debit: 0,
          credit: absoluteAmount,
          description: 'Bank',
        },
      ]);
    } else {
      await supabase.from('journal_lines').insert([
        {
          journal_entry_id: journalEntry.id,
          account_id: bankAccount.id,
          debit: absoluteAmount,
          credit: 0,
          description: 'Bank',
        },
        {
          journal_entry_id: journalEntry.id,
          account_id: targetAccountId,
          debit: 0,
          credit: absoluteAmount,
          description: targetAccount.name,
        },
      ]);
    }

    return journalEntry.id;
  } catch (error) {
    console.error('Error creating rule-based contact journal entry:', error);
    return undefined;
  }
}

async function createContactBasedJournalEntry(
  contact: Contact,
  description: string,
  amount: number,
  transactionDate: string
): Promise<string | undefined> {
  try {
    const companyId = await getCurrentCompanyId();
    if (!companyId) {
      throw new Error('No company selected');
    }

    const entryId = crypto.randomUUID();
    const { error: entryError } = await supabase
      .from('journal_entries')
      .insert({
        id: entryId,
        company_id: companyId,
        entry_date: transactionDate,
        description: `${description} (Contact: ${contact.company_name})`,
        status: 'Draft',
        contact_id: contact.id,
        type: 'Bank',
      });

    if (entryError) throw entryError;
    const journalEntry = { id: entryId };

    const { data: bankAccount } = await supabase
      .from('accounts')
      .select('id')
      .eq('type', 'Asset')
      .ilike('name', '%bank%')
      .limit(1)
      .maybeSingle();

    if (!bankAccount) {
      console.warn('No bank account found');
      return journalEntry.id;
    }

    const { data: targetAccount } = await supabase
      .from('accounts')
      .select('*')
      .eq('id', contact.default_ledger_account_id!)
      .maybeSingle();

    if (!targetAccount) {
      console.warn('Target account not found');
      return journalEntry.id;
    }

    const absoluteAmount = Math.abs(amount);
    const isDebit = amount < 0;

    if (isDebit) {
      await supabase.from('journal_lines').insert([
        {
          journal_entry_id: journalEntry.id,
          account_id: contact.default_ledger_account_id!,
          debit: absoluteAmount,
          credit: 0,
          description: targetAccount.name,
        },
        {
          journal_entry_id: journalEntry.id,
          account_id: bankAccount.id,
          debit: 0,
          credit: absoluteAmount,
          description: 'Bank',
        },
      ]);
    } else {
      await supabase.from('journal_lines').insert([
        {
          journal_entry_id: journalEntry.id,
          account_id: bankAccount.id,
          debit: absoluteAmount,
          credit: 0,
          description: 'Bank',
        },
        {
          journal_entry_id: journalEntry.id,
          account_id: contact.default_ledger_account_id!,
          debit: 0,
          credit: absoluteAmount,
          description: targetAccount.name,
        },
      ]);
    }

    return journalEntry.id;
  } catch (error) {
    console.error('Error creating contact-based journal entry:', error);
    return undefined;
  }
}

async function createProposedJournalEntry(
  rule: BankRule,
  originalDescription: string,
  amount: number,
  transactionDate: string
): Promise<string | undefined> {
  try {
    const companyId = await getCurrentCompanyId();
    if (!companyId) {
      throw new Error('No company selected');
    }

    const description = rule.description_template || originalDescription;

    const entryId = crypto.randomUUID();
    const { error: entryError } = await supabase
      .from('journal_entries')
      .insert({
        id: entryId,
        company_id: companyId,
        entry_date: transactionDate,
        description: `${description} (Auto-matched: ${rule.keyword})`,
        status: 'Draft',
        type: 'Bank',
      });

    if (entryError) throw entryError;
    const journalEntry = { id: entryId };

    const { data: bankAccount } = await supabase
      .from('accounts')
      .select('id')
      .eq('type', 'Asset')
      .ilike('name', '%bank%')
      .limit(1)
      .maybeSingle();

    if (!bankAccount) {
      console.warn('No bank account found');
      return journalEntry.id;
    }

    const isExpense = amount < 0;
    const absoluteAmount = Math.abs(amount);

    if (isExpense) {
      await supabase.from('journal_lines').insert([
        {
          journal_entry_id: journalEntry.id,
          account_id: rule.target_ledger_account_id,
          debit: absoluteAmount,
          credit: 0,
          description: description,
        },
        {
          journal_entry_id: journalEntry.id,
          account_id: bankAccount.id,
          debit: 0,
          credit: absoluteAmount,
          description: 'Bank',
        },
      ]);
    } else {
      await supabase.from('journal_lines').insert([
        {
          journal_entry_id: journalEntry.id,
          account_id: bankAccount.id,
          debit: absoluteAmount,
          credit: 0,
          description: 'Bank',
        },
        {
          journal_entry_id: journalEntry.id,
          account_id: rule.target_ledger_account_id,
          debit: 0,
          credit: absoluteAmount,
          description: description,
        },
      ]);
    }

    return journalEntry.id;
  } catch (error) {
    console.error('Error creating proposed journal entry:', error);
    return undefined;
  }
}

export async function createBankRule(params: {
  keyword: string;
  targetAccountId?: string;
  contactId?: string;
  matchType?: 'Contains' | 'Exact';
  descriptionTemplate?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: existingRule } = await supabase
      .from('bank_rules')
      .select('id')
      .ilike('keyword', params.keyword)
      .maybeSingle();

    if (existingRule) {
      return { success: false, error: 'Rule with this keyword already exists' };
    }

    const maxPriority = await getMaxPriority();

    const { error } = await supabase
      .from('bank_rules')
      .insert({
        keyword: params.keyword,
        match_type: params.matchType || 'Contains',
        target_ledger_account_id: params.targetAccountId || null,
        contact_id: params.contactId || null,
        description_template: params.descriptionTemplate || null,
        priority: maxPriority + 1,
        is_active: true,
        is_system_rule: false,
      });

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error creating bank rule:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function suggestRuleCreation(
  keyword: string,
  targetAccountId: string
): Promise<boolean> {
  const result = await createBankRule({ keyword, targetAccountId });
  return result.success;
}

async function getMaxPriority(): Promise<number> {
  const { data } = await supabase
    .from('bank_rules')
    .select('priority')
    .order('priority', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.priority || 0;
}

/**
 * Find matching bank rule for transaction (used by automation engine)
 */
/**
 * Find matching bank rule for transaction
 *
 * Uses WORD BOUNDARY matching to avoid false positives:
 * - "BP" matches "BP Station" ✓ but NOT "BPost" ✗
 * - "SHELL" matches "SHELL UTRECHT" ✓ but NOT "SHELLFISH" ✗
 *
 * Searches in both description and contra_name fields.
 *
 * @param transaction - Bank transaction to match
 * @returns Matching rule or null
 */
export async function findMatchingRuleForTransaction(
  transaction: any,
  bestMatchString?: string
): Promise<BankRule | null> {
  try {
    const { data: rules, error } = await supabase
      .from('bank_rules')
      .select('*')
      .eq('is_active', true)
      .order('priority', { ascending: false });

    if (error) throw error;

    if (!rules || rules.length === 0) {
      console.log('⚠ No active bank rules found in database');
      return null;
    }

    // Use bestMatchString if provided, otherwise fall back to legacy logic
    const searchText = bestMatchString || `${transaction.description || ''} ${transaction.contra_name || ''}`;

    console.log(`🔍 Checking ${rules.length} bank rules against: "${searchText}"`);

    for (const rule of rules) {
      if (!rule.keyword) {
        console.log(`⚠ Skipping rule with empty keyword (ID: ${rule.id})`);
        continue;
      }

      const keyword = rule.keyword;
      let isMatch = false;

      // Check match type
      if (rule.match_type === 'Exact') {
        // Exact match (case-insensitive)
        isMatch = searchText.toLowerCase() === keyword.toLowerCase();
        if (isMatch) {
          console.log(`✓ EXACT MATCH found: Rule "${rule.keyword}" matched!`);
        }
      } else {
        // Contains match with WORD BOUNDARIES
        isMatch = matchesWithWordBoundary(searchText, keyword);
        if (isMatch) {
          console.log(`✓ WORD BOUNDARY MATCH found: Rule "${rule.keyword}" matched in "${searchText}"!`);
        }
      }

      if (isMatch) {
        return rule;
      }
    }

    console.log(`✗ No bank rule matched for: "${searchText}"`);
    return null;
  } catch (error) {
    console.error('Error finding matching rule:', error);
    return null;
  }
}
