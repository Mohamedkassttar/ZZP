/**
 * System Accounts Service
 *
 * Dynamically looks up active system accounts (Crediteuren, Debiteuren, BTW, etc.)
 * instead of using hardcoded account numbers.
 *
 * SOURCE OF TRUTH: The database `accounts` table where is_active = true
 */

import { supabase } from './supabase';
import { getCurrentCompanyId } from './companyHelper';

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

  const companyId = await getCurrentCompanyId();
  if (!companyId) throw new Error('Geen bedrijf geselecteerd');

  // STRATEGY 1: Search by name (flexible keywords)
  const { data: accountsByName, error: nameError } = await supabase
    .from('accounts')
    .select('*')
    .eq('company_id', companyId)
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
    .eq('company_id', companyId)
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
    .eq('company_id', companyId)
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
 * Intelligent search strategy (client-side filtering for maximum flexibility):
 * 1. Fetch all ASSET accounts for the company
 * 2. Search by code '1300' (standard Dutch chart of accounts)
 * 3. Search by name patterns (case insensitive):
 *    - "debiteuren"
 *    - "accounts receivable"
 *    - "te ontvangen"
 *    - "klanten"
 * 4. Return best match or throw clear error
 *
 * @returns Active accounts receivable account
 * @throws Error if no suitable account found
 */
export async function findActiveAccountsReceivable() {
  console.log('[SYSTEM_ACCOUNTS] Searching for Debiteuren (Accounts Receivable) account...');

  const companyId = await getCurrentCompanyId();
  if (!companyId) throw new Error('Geen bedrijf geselecteerd');

  // 1. Haal alle Activa rekeningen op
  const { data: accounts, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('company_id', companyId)
    .eq('type', 'Asset')
    .eq('is_active', true);

  if (error) {
    console.error('[SYSTEM_ACCOUNTS] Error fetching asset accounts:', error);
    throw new Error('Kon rekeningschema niet laden');
  }

  if (!accounts || accounts.length === 0) {
    const errorMsg = 'Geen actieve Activa-rekeningen gevonden. Maak eerst een rekeningschema aan.';
    console.error('[SYSTEM_ACCOUNTS]', errorMsg);
    throw new Error(errorMsg);
  }

  console.log(`[SYSTEM_ACCOUNTS] Found ${accounts.length} ASSET accounts, searching for Accounts Receivable...`);

  // 2. Zoek slim naar de rekening (Case insensitive)
  const receivableAccount = accounts.find(acc => {
    const name = acc.name.toLowerCase();
    const code = acc.code;

    return (
      code === '1300' ||
      name.includes('debiteuren') ||
      name.includes('accounts receivable') ||
      name.includes('te ontvangen') ||
      name.includes('klanten')
    );
  });

  // 3. Return of Error
  if (receivableAccount) {
    console.log(`[SYSTEM_ACCOUNTS] ✓ Found Accounts Receivable: ${receivableAccount.code} ${receivableAccount.name}`);
    return receivableAccount;
  }

  const errorMsg = 'Geen rekening "Debiteuren" gevonden in uw grootboek. Maak een Activa-rekening aan met "Debiteuren" of "Klanten" in de naam.';
  console.error('[SYSTEM_ACCOUNTS]', errorMsg);
  throw new Error(errorMsg);
}

/**
 * Find the active BTW te vorderen (VAT Receivable) account
 *
 * Intelligent search strategy (client-side filtering for maximum flexibility):
 * 1. Fetch all ASSET accounts for the company
 * 2. Search by code '1450' (standard Dutch chart of accounts)
 * 3. Search by name patterns (case insensitive):
 *    - "btw te vorderen"
 *    - "voorbelasting"
 *    - "btw vordering"
 *    - "vat receivable"
 * 4. Return best match or throw clear error
 *
 * @returns Active VAT receivable account
 * @throws Error if no suitable account found
 */
export async function findActiveVATReceivable() {
  console.log('[SYSTEM_ACCOUNTS] Searching for BTW te vorderen (VAT Receivable) account...');

  const companyId = await getCurrentCompanyId();
  if (!companyId) throw new Error('Geen bedrijf geselecteerd');

  // 1. Haal alle Activa rekeningen op
  const { data: accounts, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('company_id', companyId)
    .eq('type', 'Asset')
    .eq('is_active', true);

  if (error) {
    console.error('[SYSTEM_ACCOUNTS] Error fetching asset accounts:', error);
    throw new Error('Kon rekeningschema niet laden');
  }

  if (!accounts || accounts.length === 0) {
    const errorMsg = 'Geen actieve Activa-rekeningen gevonden. Maak eerst een rekeningschema aan.';
    console.error('[SYSTEM_ACCOUNTS]', errorMsg);
    throw new Error(errorMsg);
  }

  console.log(`[SYSTEM_ACCOUNTS] Found ${accounts.length} ASSET accounts, searching for VAT Receivable...`);

  // 2. Zoek slim naar de rekening (Case insensitive)
  const vatAccount = accounts.find(acc => {
    const name = acc.name.toLowerCase();
    const code = acc.code;

    return (
      code === '1450' ||
      name.includes('btw te vorderen') ||
      name.includes('voorbelasting') ||
      name.includes('btw vordering') ||
      name.includes('vat receivable') ||
      (name.includes('btw') && name.includes('vorderen'))
    );
  });

  // 3. Return of Error
  if (vatAccount) {
    console.log(`[SYSTEM_ACCOUNTS] ✓ Found VAT Receivable: ${vatAccount.code} ${vatAccount.name}`);
    return vatAccount;
  }

  const errorMsg = 'Geen rekening "BTW te vorderen" gevonden in uw grootboek. Maak een Activa-rekening aan met "BTW" of "Voorbelasting" in de naam.';
  console.error('[SYSTEM_ACCOUNTS]', errorMsg);
  throw new Error(errorMsg);
}

/**
 * Find the active BTW te betalen (VAT Payable) account
 *
 * Intelligent search strategy (client-side filtering for maximum flexibility):
 * 1. Fetch all LIABILITY accounts for the company
 * 2. Search by code '1500' (standard Dutch chart of accounts)
 * 3. Search by name patterns (case insensitive):
 *    - "btw te betalen"
 *    - "omzetbelasting"
 *    - "verschuldigde btw"
 *    - "vat payable"
 * 4. Return best match or throw clear error
 *
 * @returns Active VAT payable account
 * @throws Error if no suitable account found
 */
export async function findActiveVATPayable() {
  console.log('[SYSTEM_ACCOUNTS] Searching for BTW te betalen (VAT Payable) account...');

  const companyId = await getCurrentCompanyId();
  if (!companyId) throw new Error('Geen bedrijf geselecteerd');

  // 1. Haal alle Passiva rekeningen op
  const { data: accounts, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('company_id', companyId)
    .eq('type', 'Liability')
    .eq('is_active', true);

  if (error) {
    console.error('[SYSTEM_ACCOUNTS] Error fetching liability accounts:', error);
    throw new Error('Kon rekeningschema niet laden');
  }

  if (!accounts || accounts.length === 0) {
    const errorMsg = 'Geen actieve Passiva-rekeningen gevonden. Maak eerst een rekeningschema aan.';
    console.error('[SYSTEM_ACCOUNTS]', errorMsg);
    throw new Error(errorMsg);
  }

  console.log(`[SYSTEM_ACCOUNTS] Found ${accounts.length} LIABILITY accounts, searching for VAT Payable...`);

  // 2. Zoek slim naar de rekening (Case insensitive)
  const vatAccount = accounts.find(acc => {
    const name = acc.name.toLowerCase();
    const code = acc.code;

    return (
      code === '1530' ||
      code === '1540' ||
      name.includes('btw te betalen') ||
      name.includes('omzetbelasting') ||
      name.includes('verschuldigde btw') ||
      name.includes('vat payable') ||
      (name.includes('btw') && name.includes('betalen'))
    );
  });

  // 3. Return of Error
  if (vatAccount) {
    console.log(`[SYSTEM_ACCOUNTS] ✓ Found VAT Payable: ${vatAccount.code} ${vatAccount.name}`);
    return vatAccount;
  }

  const errorMsg = 'Geen rekening "BTW te betalen" gevonden in uw grootboek. Maak een Passiva-rekening aan met "BTW" of "Omzetbelasting" in de naam.';
  console.error('[SYSTEM_ACCOUNTS]', errorMsg);
  throw new Error(errorMsg);
}

/**
 * Fetch all critical system accounts at once (OPTIMIZED VERSION)
 *
 * This optimized version fetches all Asset and Liability accounts in ONE query,
 * then performs client-side matching for all system accounts. This is more efficient
 * than 4 separate database queries.
 *
 * @returns Object with all system accounts
 * @throws Error if any required account is missing (with specific details)
 */
export async function fetchSystemAccounts() {
  console.log('[SYSTEM_ACCOUNTS] Fetching all critical system accounts (optimized)...');

  const companyId = await getCurrentCompanyId();
  if (!companyId) throw new Error('Geen bedrijf geselecteerd');

  // OPTIMIZATION: Fetch all relevant accounts in ONE query
  const { data: accounts, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('company_id', companyId)
    .in('type', ['Asset', 'Liability'])
    .eq('is_active', true);

  if (error) {
    console.error('[SYSTEM_ACCOUNTS] Error fetching accounts:', error);
    throw new Error('Kon rekeningschema niet laden');
  }

  if (!accounts || accounts.length === 0) {
    throw new Error('Geen actieve rekeningen gevonden. Maak eerst een rekeningschema aan.');
  }

  console.log(`[SYSTEM_ACCOUNTS] Loaded ${accounts.length} active accounts, matching system accounts...`);

  // Split accounts by type for easier filtering
  const assets = accounts.filter(acc => acc.type === 'Asset');
  const liabilities = accounts.filter(acc => acc.type === 'Liability');

  // Find Crediteuren (Accounts Payable)
  const accountsPayable = liabilities.find(acc => {
    const name = acc.name.toLowerCase();
    const code = acc.code;
    return (
      code === '1500' || code === '1600' ||
      name.includes('crediteur') ||
      name.includes('accounts payable') ||
      name.includes('te betalen') ||
      name.includes('leveranciers')
    );
  });

  if (!accountsPayable) {
    throw new Error("Geen rekening 'Crediteuren' gevonden. Maak een Passiva-rekening aan met 'Crediteuren' in de naam.");
  }
  console.log(`[SYSTEM_ACCOUNTS] ✓ Found Accounts Payable: ${accountsPayable.code} ${accountsPayable.name}`);

  // Find Debiteuren (Accounts Receivable)
  const accountsReceivable = assets.find(acc => {
    const name = acc.name.toLowerCase();
    const code = acc.code;
    return (
      code === '1300' ||
      name.includes('debiteuren') ||
      name.includes('accounts receivable') ||
      name.includes('te ontvangen') ||
      name.includes('klanten')
    );
  });

  if (!accountsReceivable) {
    throw new Error("Geen rekening 'Debiteuren' gevonden. Maak een Activa-rekening aan met 'Debiteuren' in de naam.");
  }
  console.log(`[SYSTEM_ACCOUNTS] ✓ Found Accounts Receivable: ${accountsReceivable.code} ${accountsReceivable.name}`);

  // Find BTW te vorderen (VAT Receivable)
  const vatReceivable = assets.find(acc => {
    const name = acc.name.toLowerCase();
    const code = acc.code;
    return (
      code === '1450' ||
      name.includes('btw te vorderen') ||
      name.includes('voorbelasting') ||
      name.includes('btw vordering') ||
      name.includes('vat receivable') ||
      (name.includes('btw') && name.includes('vorderen'))
    );
  });

  if (!vatReceivable) {
    throw new Error("Geen rekening 'BTW te vorderen' gevonden. Maak een Activa-rekening aan met 'BTW' in de naam.");
  }
  console.log(`[SYSTEM_ACCOUNTS] ✓ Found VAT Receivable: ${vatReceivable.code} ${vatReceivable.name}`);

  // Find BTW te betalen (VAT Payable)
  const vatPayable = liabilities.find(acc => {
    const name = acc.name.toLowerCase();
    const code = acc.code;
    return (
      code === '1530' ||
      code === '1540' ||
      name.includes('btw te betalen') ||
      name.includes('omzetbelasting') ||
      name.includes('verschuldigde btw') ||
      name.includes('vat payable') ||
      (name.includes('btw') && name.includes('betalen'))
    );
  });

  if (!vatPayable) {
    throw new Error("Geen rekening 'BTW te betalen' gevonden. Maak een Passiva-rekening aan met 'BTW' in de naam.");
  }
  console.log(`[SYSTEM_ACCOUNTS] ✓ Found VAT Payable: ${vatPayable.code} ${vatPayable.name}`);

  console.log('[SYSTEM_ACCOUNTS] ✓ All system accounts successfully loaded');

  return {
    accountsPayable,
    accountsReceivable,
    vatReceivable,
    vatPayable,
  };
}
