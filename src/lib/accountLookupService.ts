import { supabase } from './supabase';
import type { Database } from './database.types';

type Account = Database['public']['Tables']['accounts']['Row'];

export interface AccountLookupResult {
  account: Account | null;
  confidence: 'high' | 'medium' | 'low';
  method: string;
}

function normalizeVatRate(rate: number): number {
  return Math.round(rate);
}

function matchesVatPattern(text: string, vatRate: number): boolean {
  const normalized = normalizeVatRate(vatRate);
  const lower = text.toLowerCase();

  if (normalized === 21) {
    return lower.includes('hoog') ||
           lower.includes('21') ||
           lower.includes('standaard') ||
           lower.includes('algemeen');
  }

  if (normalized === 9) {
    return lower.includes('laag') ||
           lower.includes('9') ||
           lower.includes('gereduceerd');
  }

  if (normalized === 0) {
    return lower.includes('nul') ||
           lower.includes('0%') ||
           lower.includes('vrijgesteld') ||
           lower.includes('verlegd') ||
           lower.includes('verlegging');
  }

  return lower.includes(normalized.toString());
}

export async function findRevenueAccount(
  vatPercentage: number
): Promise<AccountLookupResult> {
  console.log(`[ACCOUNT_LOOKUP] Searching for Revenue account with VAT ${vatPercentage}%`);

  const normalizedVat = normalizeVatRate(vatPercentage);

  const { data: accounts, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('type', 'Revenue')
    .eq('is_active', true)
    .order('code');

  if (error || !accounts || accounts.length === 0) {
    console.error('[ACCOUNT_LOOKUP] No Revenue accounts found');
    return { account: null, confidence: 'low', method: 'none' };
  }

  // Strategy 1: Exact match on vat_code column
  const exactVatMatch = accounts.find(acc => {
    if (acc.vat_code !== null && acc.vat_code !== undefined) {
      const accountVat = normalizeVatRate(Number(acc.vat_code));
      return accountVat === normalizedVat;
    }
    return false;
  });

  if (exactVatMatch) {
    console.log(`[ACCOUNT_LOOKUP] ✓ Exact VAT match: ${exactVatMatch.code} - ${exactVatMatch.name} (vat_code=${exactVatMatch.vat_code})`);
    return { account: exactVatMatch, confidence: 'high', method: 'exact_vat_code' };
  }

  // Strategy 2: Name pattern matching
  const nameMatch = accounts.find(acc => matchesVatPattern(acc.name, vatPercentage));

  if (nameMatch) {
    console.log(`[ACCOUNT_LOOKUP] ✓ Name pattern match: ${nameMatch.code} - ${nameMatch.name}`);
    return { account: nameMatch, confidence: 'high', method: 'name_pattern' };
  }

  // Strategy 3: Description pattern matching
  const descriptionMatch = accounts.find(acc =>
    acc.description && matchesVatPattern(acc.description, vatPercentage)
  );

  if (descriptionMatch) {
    console.log(`[ACCOUNT_LOOKUP] ✓ Description pattern match: ${descriptionMatch.code} - ${descriptionMatch.name}`);
    return { account: descriptionMatch, confidence: 'medium', method: 'description_pattern' };
  }

  // Strategy 4: Fallback to first Revenue account
  const fallback = accounts[0];
  console.log(`[ACCOUNT_LOOKUP] ⚠ Using fallback: ${fallback.code} - ${fallback.name}`);

  return { account: fallback, confidence: 'low', method: 'fallback' };
}

export async function findExpenseAccount(
  vatPercentage: number
): Promise<AccountLookupResult> {
  console.log(`[ACCOUNT_LOOKUP] Searching for Expense account with VAT ${vatPercentage}%`);

  const normalizedVat = normalizeVatRate(vatPercentage);

  const { data: accounts, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('type', 'Expense')
    .eq('is_active', true)
    .order('code');

  if (error || !accounts || accounts.length === 0) {
    console.error('[ACCOUNT_LOOKUP] No Expense accounts found');
    return { account: null, confidence: 'low', method: 'none' };
  }

  // Strategy 1: Exact match on vat_code column
  const exactVatMatch = accounts.find(acc => {
    if (acc.vat_code !== null && acc.vat_code !== undefined) {
      const accountVat = normalizeVatRate(Number(acc.vat_code));
      return accountVat === normalizedVat;
    }
    return false;
  });

  if (exactVatMatch) {
    console.log(`[ACCOUNT_LOOKUP] ✓ Exact VAT match: ${exactVatMatch.code} - ${exactVatMatch.name} (vat_code=${exactVatMatch.vat_code})`);
    return { account: exactVatMatch, confidence: 'high', method: 'exact_vat_code' };
  }

  // Strategy 2: Name pattern matching
  const nameMatch = accounts.find(acc => matchesVatPattern(acc.name, vatPercentage));

  if (nameMatch) {
    console.log(`[ACCOUNT_LOOKUP] ✓ Name pattern match: ${nameMatch.code} - ${nameMatch.name}`);
    return { account: nameMatch, confidence: 'high', method: 'name_pattern' };
  }

  // Strategy 3: Description pattern matching
  const descriptionMatch = accounts.find(acc =>
    acc.description && matchesVatPattern(acc.description, vatPercentage)
  );

  if (descriptionMatch) {
    console.log(`[ACCOUNT_LOOKUP] ✓ Description pattern match: ${descriptionMatch.code} - ${descriptionMatch.name}`);
    return { account: descriptionMatch, confidence: 'medium', method: 'description_pattern' };
  }

  // Strategy 4: Fallback to first Expense account
  const fallback = accounts[0];
  console.log(`[ACCOUNT_LOOKUP] ⚠ Using fallback: ${fallback.code} - ${fallback.name}`);

  return { account: fallback, confidence: 'low', method: 'fallback' };
}

export async function findVatLiabilityAccount(
  vatPercentage: number
): Promise<AccountLookupResult> {
  console.log(`[ACCOUNT_LOOKUP] Searching for VAT Liability account with ${vatPercentage}%`);

  const normalizedVat = normalizeVatRate(vatPercentage);

  const { data: accounts, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('type', 'Liability')
    .eq('is_active', true)
    .order('code');

  if (error || !accounts || accounts.length === 0) {
    console.error('[ACCOUNT_LOOKUP] No Liability accounts found');
    return { account: null, confidence: 'low', method: 'none' };
  }

  // Look for accounts with "BTW" or "VAT" in name that match the rate
  const btwPattern = (acc: Account) => {
    const lower = acc.name.toLowerCase();
    const hasVatKeyword = lower.includes('btw') ||
                         lower.includes('vat') ||
                         lower.includes('belasting');

    if (!hasVatKeyword) return false;

    // Check if it's payable/liability (not receivable)
    const isPayable = lower.includes('betalen') ||
                     lower.includes('schuld') ||
                     lower.includes('te betalen') ||
                     lower.includes('verschuldigd');

    if (!isPayable) return false;

    // Check if VAT rate matches
    return matchesVatPattern(acc.name + ' ' + (acc.description || ''), vatPercentage);
  };

  const vatMatch = accounts.find(btwPattern);

  if (vatMatch) {
    console.log(`[ACCOUNT_LOOKUP] ✓ VAT liability match: ${vatMatch.code} - ${vatMatch.name}`);
    return { account: vatMatch, confidence: 'high', method: 'vat_pattern' };
  }

  // Fallback: Any VAT liability account
  const generalVatAccount = accounts.find(acc => {
    const lower = acc.name.toLowerCase();
    return (lower.includes('btw') || lower.includes('vat')) &&
           (lower.includes('betalen') || lower.includes('schuld'));
  });

  if (generalVatAccount) {
    console.log(`[ACCOUNT_LOOKUP] ⚠ Using general VAT liability: ${generalVatAccount.code} - ${generalVatAccount.name}`);
    return { account: generalVatAccount, confidence: 'medium', method: 'general_vat' };
  }

  console.log('[ACCOUNT_LOOKUP] ⚠ No suitable VAT liability account found');
  return { account: null, confidence: 'low', method: 'none' };
}

export async function findVatReceivableAccount(
  vatPercentage: number
): Promise<AccountLookupResult> {
  console.log(`[ACCOUNT_LOOKUP] Searching for VAT Receivable account with ${vatPercentage}%`);

  const normalizedVat = normalizeVatRate(vatPercentage);

  const { data: accounts, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('type', 'Asset')
    .eq('is_active', true)
    .order('code');

  if (error || !accounts || accounts.length === 0) {
    console.error('[ACCOUNT_LOOKUP] No Asset accounts found');
    return { account: null, confidence: 'low', method: 'none' };
  }

  // Look for accounts with "BTW" or "VAT" in name that are receivable
  const btwReceivablePattern = (acc: Account) => {
    const lower = acc.name.toLowerCase();
    const hasVatKeyword = lower.includes('btw') ||
                         lower.includes('vat') ||
                         lower.includes('belasting');

    if (!hasVatKeyword) return false;

    // Check if it's receivable (not payable)
    const isReceivable = lower.includes('vorderen') ||
                        lower.includes('terug') ||
                        lower.includes('te vorderen') ||
                        lower.includes('voorbelasting');

    if (!isReceivable) return false;

    // Check if VAT rate matches
    return matchesVatPattern(acc.name + ' ' + (acc.description || ''), vatPercentage);
  };

  const vatMatch = accounts.find(btwReceivablePattern);

  if (vatMatch) {
    console.log(`[ACCOUNT_LOOKUP] ✓ VAT receivable match: ${vatMatch.code} - ${vatMatch.name}`);
    return { account: vatMatch, confidence: 'high', method: 'vat_pattern' };
  }

  // Fallback: Any VAT receivable account
  const generalVatAccount = accounts.find(acc => {
    const lower = acc.name.toLowerCase();
    return (lower.includes('btw') || lower.includes('vat')) &&
           (lower.includes('vorderen') || lower.includes('voorbelasting'));
  });

  if (generalVatAccount) {
    console.log(`[ACCOUNT_LOOKUP] ⚠ Using general VAT receivable: ${generalVatAccount.code} - ${generalVatAccount.name}`);
    return { account: generalVatAccount, confidence: 'medium', method: 'general_vat' };
  }

  console.log('[ACCOUNT_LOOKUP] ⚠ No suitable VAT receivable account found');
  return { account: null, confidence: 'low', method: 'none' };
}

export async function groupInvoiceLinesByVatRate(
  lines: Array<{ amount: number; vatRate: number; description: string }>
): Promise<Map<number, { netAmount: number; vatAmount: number; lines: typeof lines }>> {
  const grouped = new Map<number, { netAmount: number; vatAmount: number; lines: typeof lines }>();

  for (const line of lines) {
    const rate = normalizeVatRate(line.vatRate);
    const existing = grouped.get(rate) || { netAmount: 0, vatAmount: 0, lines: [] };

    existing.netAmount += line.amount;
    existing.vatAmount += line.amount * (line.vatRate / 100);
    existing.lines.push(line);

    grouped.set(rate, existing);
  }

  return grouped;
}
