/**
 * Invoice Account Matcher - Smart Matching with VAT Validation
 *
 * Matches invoices to expense accounts using:
 * 1. Implicit VAT Rate Calculation
 * 2. Keyword Matching (Tavily industry → account name)
 * 3. VAT Code Filtering (21%, 9%, 0%, etc.)
 * 4. Fallback to generic account with correct VAT
 *
 * This ensures that the AI always returns a REAL account_id from the database,
 * never a made-up string.
 */

import { supabase } from './supabase';
import type { Database } from './database.types';

type Account = Database['public']['Tables']['accounts']['Row'];

export interface AccountMatchResult {
  accountId: string;
  accountCode: string;
  accountName: string;
  confidence: number;
  reason: string;
  matchType: 'keyword_vat' | 'vat_only' | 'keyword_only' | 'fallback';
}

/**
 * Calculate implicit VAT rate from invoice amounts
 */
function calculateVATRate(netAmount: number, vatAmount: number): number | null {
  if (!netAmount || netAmount <= 0 || !vatAmount || vatAmount < 0) {
    return null;
  }

  const rate = (vatAmount / netAmount) * 100;

  // Round to nearest standard Dutch VAT rate
  if (rate < 4) return 0;
  if (rate >= 4 && rate < 15) return 9;
  if (rate >= 15) return 21;

  return null;
}

/**
 * Normalize VAT code to standard rate
 */
function normalizeVATCode(vatCode: number): number {
  if (vatCode < 4) return 0;
  if (vatCode >= 4 && vatCode < 15) return 9;
  if (vatCode >= 15) return 21;
  return 21; // Default to high rate
}

/**
 * Test if keyword matches in text (case-insensitive, word boundary)
 */
function testKeywordMatch(text: string, keyword: string): boolean {
  const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`\\b${escapedKeyword}\\b`, 'i');
  return regex.test(text);
}

/**
 * Check if account is blacklisted (should never be suggested for invoices)
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

/**
 * Find best matching account for an invoice
 *
 * @param supplierName - Name of the supplier
 * @param industry - Industry/category from Tavily (e.g., "Software", "SaaS")
 * @param tags - Additional tags from Tavily
 * @param netAmount - Net amount (excl. VAT)
 * @param vatAmount - VAT amount
 * @param totalAmount - Total amount (incl. VAT)
 */
export async function findBestAccountMatch(
  supplierName: string,
  industry?: string,
  tags?: string[],
  netAmount?: number,
  vatAmount?: number,
  totalAmount?: number
): Promise<AccountMatchResult | null> {
  try {
    console.log('\n' + '═'.repeat(70));
    console.log('🎯 [ACCOUNT MATCHER] Starting smart account matching');
    console.log('═'.repeat(70));
    console.log(`Supplier: ${supplierName}`);
    console.log(`Industry: ${industry || 'Unknown'}`);
    console.log(`Tags: ${tags?.join(', ') || 'None'}`);
    console.log(`Amounts: Net €${netAmount?.toFixed(2) || '?'} + VAT €${vatAmount?.toFixed(2) || '?'} = Total €${totalAmount?.toFixed(2) || '?'}`);

    // STEP 1: Calculate Implicit VAT Rate
    let detectedVATRate: number | null = null;
    if (netAmount && vatAmount) {
      detectedVATRate = calculateVATRate(netAmount, vatAmount);
      console.log(`\n📊 STEP 1: VAT Calculation`);
      console.log(`  Detected VAT Rate: ${detectedVATRate}%`);
    } else if (totalAmount && vatAmount && totalAmount > vatAmount) {
      const calculatedNet = totalAmount - vatAmount;
      detectedVATRate = calculateVATRate(calculatedNet, vatAmount);
      console.log(`\n📊 STEP 1: VAT Calculation (from total)`);
      console.log(`  Detected VAT Rate: ${detectedVATRate}%`);
    } else {
      console.log(`\n📊 STEP 1: VAT Calculation`);
      console.log(`  ⚠ Insufficient data to calculate VAT rate`);
    }

    // STEP 2: Fetch All Active Accounts (Expense only)
    console.log(`\n📋 STEP 2: Fetching Expense Accounts`);

    const { data: allAccounts, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('is_active', true)
      .eq('type', 'Expense')
      .order('code');

    if (error || !allAccounts || allAccounts.length === 0) {
      console.error('❌ No active expense accounts found');
      return null;
    }

    // Filter out blacklisted accounts
    const accounts = allAccounts.filter(acc => !isBlacklistedAccount(acc));
    const blacklistedCount = allAccounts.length - accounts.length;

    console.log(`  ✓ Found ${allAccounts.length} active expense accounts`);
    if (blacklistedCount > 0) {
      console.log(`  ⚠ Filtered out ${blacklistedCount} blacklisted accounts (depreciation/internal)`);
    }

    // STEP 3: Smart Matching Logic
    console.log(`\n🎯 STEP 3: Smart Matching`);

    const matches: Array<{
      account: Account;
      score: number;
      reasons: string[];
      matchType: 'keyword_vat' | 'vat_only' | 'keyword_only' | 'fallback';
    }> = [];

    for (const account of accounts) {
      const score = { value: 0, reasons: [] as string[] };

      // Normalize account VAT code
      const accountVATRate = normalizeVATCode(account.vat_code || 0);

      // Keyword Matching (Industry + Tags → Account Name + Description)
      let hasKeywordMatch = false;

      if (industry) {
        // Match in account name
        if (testKeywordMatch(account.name, industry)) {
          score.value += 50;
          score.reasons.push(`Industry match in name: "${industry}"`);
          hasKeywordMatch = true;
        }

        // Match in account description (NEW - for better software matching)
        if (account.description && testKeywordMatch(account.description, industry)) {
          score.value += 45;
          score.reasons.push(`Industry match in description: "${industry}"`);
          hasKeywordMatch = true;
        }

        if (account.tax_category && testKeywordMatch(account.tax_category, industry)) {
          score.value += 30;
          score.reasons.push(`Tax category match: "${industry}"`);
          hasKeywordMatch = true;
        }

        // SPECIAL CASE: Software/SaaS mapping (prioritize subscription accounts)
        const softwareKeywords = ['software', 'saas', 'subscription', 'cloud', 'licentie', 'license', 'abonnement'];
        const isSoftwareIndustry = softwareKeywords.some(kw => testKeywordMatch(industry, kw));

        if (isSoftwareIndustry) {
          const isSubscriptionAccount =
            testKeywordMatch(account.name, 'abonnement') ||
            testKeywordMatch(account.name, 'contributie') ||
            testKeywordMatch(account.name, 'software') ||
            testKeywordMatch(account.name, 'licentie') ||
            (account.description && (
              testKeywordMatch(account.description, 'abonnement') ||
              testKeywordMatch(account.description, 'subscription') ||
              testKeywordMatch(account.description, 'software') ||
              testKeywordMatch(account.description, 'saas')
            ));

          if (isSubscriptionAccount) {
            // Extra boost if this is account 4815 (Contributies en abonnementen)
            if (account.code === '4815') {
              score.value += 100; // Highest priority for 4815 + software match
              score.reasons.push(`PERFECT MATCH: Software industry → 4815 Contributies en abonnementen`);
            } else {
              score.value += 60; // High priority for other subscription accounts
              score.reasons.push(`Perfect match: Software industry → Subscription account`);
            }
            hasKeywordMatch = true;
          }
        }
      }

      if (tags && tags.length > 0) {
        for (const tag of tags) {
          // Check account name
          if (testKeywordMatch(account.name, tag)) {
            score.value += 30;
            score.reasons.push(`Tag match in name: "${tag}"`);
            hasKeywordMatch = true;
          }
          // Check account description
          if (account.description && testKeywordMatch(account.description, tag)) {
            score.value += 25;
            score.reasons.push(`Tag match in description: "${tag}"`);
            hasKeywordMatch = true;
          }
        }
      }

      // VAT Rate Matching
      let hasVATMatch = false;
      if (detectedVATRate !== null) {
        if (accountVATRate === detectedVATRate) {
          score.value += 50;
          score.reasons.push(`VAT rate match: ${detectedVATRate}%`);
          hasVATMatch = true;
        } else {
          // Penalize VAT mismatch (don't reject, but lower score)
          score.value -= 20;
          score.reasons.push(`VAT mismatch: account ${accountVATRate}% vs invoice ${detectedVATRate}%`);
        }
      }

      // Determine match type
      let matchType: 'keyword_vat' | 'vat_only' | 'keyword_only' | 'fallback' = 'fallback';
      if (hasKeywordMatch && hasVATMatch) {
        matchType = 'keyword_vat';
      } else if (hasVATMatch) {
        matchType = 'vat_only';
      } else if (hasKeywordMatch) {
        matchType = 'keyword_only';
      }

      // Only consider accounts with positive score
      if (score.value > 0) {
        matches.push({
          account,
          score: score.value,
          reasons: score.reasons,
          matchType,
        });
      }
    }

    // Sort by score (highest first)
    matches.sort((a, b) => b.score - a.score);

    if (matches.length > 0) {
      const best = matches[0];

      console.log(`  ✓ Best Match: ${best.account.code} - ${best.account.name}`);
      console.log(`    Score: ${best.score}`);
      console.log(`    Type: ${best.matchType}`);
      console.log(`    Reasons: ${best.reasons.join(', ')}`);

      // Calculate confidence (0-1 scale)
      const confidence = Math.min(best.score / 100, 1.0);

      return {
        accountId: best.account.id,
        accountCode: best.account.code,
        accountName: best.account.name,
        confidence,
        reason: best.reasons.join(', '),
        matchType: best.matchType,
      };
    }

    // STEP 4: Fallback - Generic Account with Correct VAT
    console.log(`\n🔄 STEP 4: Fallback (No keyword match)`);

    if (detectedVATRate !== null) {
      console.log(`  Searching for generic expense account with VAT ${detectedVATRate}%...`);

      const genericAccounts = accounts.filter(acc => {
        const accVATRate = normalizeVATCode(acc.vat_code || 0);
        return accVATRate === detectedVATRate &&
               (acc.name.toLowerCase().includes('algemeen') ||
                acc.name.toLowerCase().includes('overig') ||
                acc.code.startsWith('47')); // Kantoorkosten range
      });

      if (genericAccounts.length > 0) {
        const fallback = genericAccounts[0];
        console.log(`  ✓ Fallback: ${fallback.code} - ${fallback.name}`);

        return {
          accountId: fallback.id,
          accountCode: fallback.code,
          accountName: fallback.name,
          confidence: 0.4, // Lower confidence for fallback
          reason: `Fallback to generic account with correct VAT rate (${detectedVATRate}%)`,
          matchType: 'fallback',
        };
      }
    }

    // Last resort: Safe fallback (NEVER use personnel accounts 40xx)
    console.log(`  ⚠ Searching for safe fallback account...`);

    // PRIORITY 1: Try account 4500 (Reclame- en advertentiekosten) or 7000 (Inkopen)
    const safeAccounts = accounts.filter(acc =>
      acc.code === '4500' || acc.code === '7000'
    );

    if (safeAccounts.length > 0) {
      const fallback = safeAccounts[0];
      console.log(`  ✓ Safe fallback: ${fallback.code} - ${fallback.name}`);

      return {
        accountId: fallback.id,
        accountCode: fallback.code,
        accountName: fallback.name,
        confidence: 0.25,
        reason: 'Safe fallback - manual review strongly recommended',
        matchType: 'fallback',
      };
    }

    // PRIORITY 2: Use any non-personnel account (NOT 40xx)
    const nonPersonnelAccounts = accounts.filter(acc =>
      !acc.code.startsWith('40')
    );

    if (nonPersonnelAccounts.length > 0) {
      // Choose highest code number (typically general expenses)
      const fallback = nonPersonnelAccounts.sort((a, b) =>
        parseInt(b.code) - parseInt(a.code)
      )[0];

      console.log(`  ✓ Non-personnel fallback: ${fallback.code} - ${fallback.name}`);

      return {
        accountId: fallback.id,
        accountCode: fallback.code,
        accountName: fallback.name,
        confidence: 0.2,
        reason: 'Non-personnel fallback - manual review required',
        matchType: 'fallback',
      };
    }

    // ABSOLUTE LAST RESORT: Any account (should never happen)
    console.log(`  ⚠⚠⚠ WARNING: Using absolute last resort account`);
    const lastResort = accounts[accounts.length - 1]; // Use LAST account, not first

    return {
      accountId: lastResort.id,
      accountCode: lastResort.code,
      accountName: lastResort.name,
      confidence: 0.1,
      reason: 'Emergency fallback - IMMEDIATE manual review required',
      matchType: 'fallback',
    };

  } catch (error) {
    console.error('❌ [ACCOUNT MATCHER] Error:', error);
    return null;
  }
}

/**
 * Example Usage:
 *
 * const match = await findBestAccountMatch(
 *   'StackBlitz',
 *   'Software',
 *   ['saas', 'development'],
 *   100,  // net
 *   21,   // vat
 *   121   // total
 * );
 *
 * Expected: Match with "4815 - Contributies en abonnementen" (21% VAT)
 * Reason: Software industry → subscription account with perfect VAT match
 */
