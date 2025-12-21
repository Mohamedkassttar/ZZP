/**
 * System Accounts Service
 *
 * Dynamically looks up active system accounts (Crediteuren, Debiteuren, BTW, etc.)
 * instead of using hardcoded account numbers.
 *
 * SOURCE OF TRUTH: The database `accounts` table where is_active = true
 */

import { supabase } from './supabase';

/**
 * Find the active Crediteuren (Accounts Payable) account
 *
 * Flexible search strategy (in order of priority):
 * 1. Type = 'Liability' + Name contains "crediteur", "accounts payable", "te betalen", or "leveranciers"
 * 2. Type = 'Liability' + Code = 1500 or 1600 (user preference)
 * 3. Type = 'Liability' + No tax_category (fallback to generic liability)
 * 4. Error: "Kan geen grootboekrekening vinden voor 'Crediteuren'"
 *
 * If multiple matches found, prefer lowest code number (most standard)
 *
 * @returns Active accounts payable account
 * @throws Error if no suitable account found
 */
export async function findActiveAccountsPayable() {
  console.log('[SYSTEM_ACCOUNTS] Searching for Crediteuren (Accounts Payable) account...');

  // STRATEGY 1: Search by name (flexible keywords)
  const { data: accountsByName, error: nameError } = await supabase
    .from('accounts')
    .select('*')
    .eq('type', 'Liability')
    .eq('is_active', true)
    .or('name.ilike.%crediteur%,name.ilike.%accounts payable%,name.ilike.%te betalen%,name.ilike.%leveranciers%')
    .order('code', { ascending: true });

  if (nameError) {
    console.error('[SYSTEM_ACCOUNTS] Error in name search:', nameError);
  } else if (accountsByName && accountsByName.length > 0) {
    const account = accountsByName[0];
    console.log(`[SYSTEM_ACCOUNTS] ✓ Found by name: ${account.code} ${account.name}`);
    return account;
  }

  console.log('[SYSTEM_ACCOUNTS] No match by name, trying code-based search...');

  // STRATEGY 2: Search by code (1500 or 1600)
  const { data: accountsByCode, error: codeError } = await supabase
    .from('accounts')
    .select('*')
    .eq('type', 'Liability')
    .eq('is_active', true)
    .in('code', ['1500', '1600'])
    .order('code', { ascending: true });

  if (codeError) {
    console.error('[SYSTEM_ACCOUNTS] Error in code search:', codeError);
  } else if (accountsByCode && accountsByCode.length > 0) {
    const account = accountsByCode[0];
    console.log(`[SYSTEM_ACCOUNTS] ✓ Found by code: ${account.code} ${account.name}`);
    return account;
  }

  console.log('[SYSTEM_ACCOUNTS] No match by code, trying generic liability fallback...');

  // STRATEGY 3: Fallback to generic liability (no tax_category)
  const { data: genericLiabilities, error: fallbackError } = await supabase
    .from('accounts')
    .select('*')
    .eq('type', 'Liability')
    .eq('is_active', true)
    .is('tax_category', null)
    .order('code', { ascending: true });

  if (fallbackError) {
    console.error('[SYSTEM_ACCOUNTS] Error in fallback search:', fallbackError);
  } else if (genericLiabilities && genericLiabilities.length > 0) {
    const account = genericLiabilities[0];
    console.log(`[SYSTEM_ACCOUNTS] ⚠ Using generic liability fallback: ${account.code} ${account.name}`);
    return account;
  }

  // STRATEGY 4: No account found - throw clear error
  const errorMsg = "Kan geen grootboekrekening vinden voor 'Crediteuren'. Maak een passiva-rekening aan met de naam 'Crediteuren'.";
  console.error('[SYSTEM_ACCOUNTS]', errorMsg);
  throw new Error(errorMsg);
}

/**
 * Find the active Debiteuren (Accounts Receivable) account
 *
 * Logic:
 * 1. Type = 'Asset'
 * 2. is_active = true
 * 3. Name contains "debiteur" (case insensitive)
 * 4. If multiple found, prefer lowest code number (most standard)
 *
 * @returns Active accounts receivable account or null if not found
 */
export async function findActiveAccountsReceivable() {
  const { data: accounts, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('type', 'Asset')
    .eq('is_active', true)
    .ilike('name', '%debiteur%')
    .order('code', { ascending: true });

  if (error) {
    console.error('[SYSTEM_ACCOUNTS] Error fetching accounts receivable:', error);
    return null;
  }

  if (!accounts || accounts.length === 0) {
    console.warn('[SYSTEM_ACCOUNTS] No active Debiteuren account found');
    return null;
  }

  // Return the first match (lowest code number)
  const account = accounts[0];
  console.log(`[SYSTEM_ACCOUNTS] Found Accounts Receivable: ${account.code} ${account.name}`);
  return account;
}

/**
 * Find the active BTW te vorderen (VAT Receivable) account
 *
 * Logic:
 * 1. Type = 'Asset'
 * 2. is_active = true
 * 3. Name contains "btw" and "vorderen" (case insensitive)
 * 4. If multiple found, prefer lowest code number (most standard)
 *
 * @returns Active VAT receivable account or null if not found
 */
export async function findActiveVATReceivable() {
  const { data: accounts, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('type', 'Asset')
    .eq('is_active', true)
    .or('name.ilike.%btw%vorderen%,name.ilike.%voorbelasting%')
    .order('code', { ascending: true });

  if (error) {
    console.error('[SYSTEM_ACCOUNTS] Error fetching VAT receivable:', error);
    return null;
  }

  if (!accounts || accounts.length === 0) {
    console.warn('[SYSTEM_ACCOUNTS] No active BTW te vorderen account found');
    return null;
  }

  // Return the first match (lowest code number)
  const account = accounts[0];
  console.log(`[SYSTEM_ACCOUNTS] Found VAT Receivable: ${account.code} ${account.name}`);
  return account;
}

/**
 * Find the active BTW te betalen (VAT Payable) account
 *
 * Logic:
 * 1. Type = 'Liability'
 * 2. is_active = true
 * 3. Name contains "btw" and "betalen" (case insensitive)
 * 4. If multiple found, prefer lowest code number (most standard)
 *
 * @returns Active VAT payable account or null if not found
 */
export async function findActiveVATPayable() {
  const { data: accounts, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('type', 'Liability')
    .eq('is_active', true)
    .or('name.ilike.%btw%betalen%,name.ilike.%omzetbelasting%')
    .order('code', { ascending: true });

  if (error) {
    console.error('[SYSTEM_ACCOUNTS] Error fetching VAT payable:', error);
    return null;
  }

  if (!accounts || accounts.length === 0) {
    console.warn('[SYSTEM_ACCOUNTS] No active BTW te betalen account found');
    return null;
  }

  // Return the first match (lowest code number)
  const account = accounts[0];
  console.log(`[SYSTEM_ACCOUNTS] Found VAT Payable: ${account.code} ${account.name}`);
  return account;
}

/**
 * Fetch all critical system accounts at once
 *
 * @returns Object with all system accounts or throws error if any required account is missing
 */
export async function fetchSystemAccounts() {
  const [accountsPayable, accountsReceivable, vatReceivable, vatPayable] = await Promise.all([
    findActiveAccountsPayable(),
    findActiveAccountsReceivable(),
    findActiveVATReceivable(),
    findActiveVATPayable(),
  ]);

  const missing: string[] = [];
  if (!accountsPayable) missing.push('Crediteuren (Accounts Payable)');
  if (!accountsReceivable) missing.push('Debiteuren (Accounts Receivable)');
  if (!vatReceivable) missing.push('BTW te vorderen (VAT Receivable)');
  if (!vatPayable) missing.push('BTW te betalen (VAT Payable)');

  if (missing.length > 0) {
    const errorMsg = `Missing required system accounts: ${missing.join(', ')}. Please configure these in Settings > Accounts.`;
    console.error('[SYSTEM_ACCOUNTS]', errorMsg);
    throw new Error(errorMsg);
  }

  return {
    accountsPayable: accountsPayable!,
    accountsReceivable: accountsReceivable!,
    vatReceivable: vatReceivable!,
    vatPayable: vatPayable!,
  };
}
