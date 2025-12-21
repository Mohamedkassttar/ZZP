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
 * Logic:
 * 1. Type = 'Liability'
 * 2. is_active = true
 * 3. Name contains "crediteur" (case insensitive)
 * 4. If multiple found, prefer lowest code number (most standard)
 *
 * @returns Active accounts payable account or null if not found
 */
export async function findActiveAccountsPayable() {
  const { data: accounts, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('type', 'Liability')
    .eq('is_active', true)
    .ilike('name', '%crediteur%')
    .order('code', { ascending: true });

  if (error) {
    console.error('[SYSTEM_ACCOUNTS] Error fetching accounts payable:', error);
    return null;
  }

  if (!accounts || accounts.length === 0) {
    console.warn('[SYSTEM_ACCOUNTS] No active Crediteuren account found');
    return null;
  }

  // Return the first match (lowest code number)
  const account = accounts[0];
  console.log(`[SYSTEM_ACCOUNTS] Found Accounts Payable: ${account.code} ${account.name}`);
  return account;
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
