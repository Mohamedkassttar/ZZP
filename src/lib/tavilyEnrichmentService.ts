/**
 * Tavily Enrichment Service
 *
 * Enriches unknown transactions using external search (Tavily API).
 * Falls back to intelligent simulation if API key is not configured.
 *
 * Uses cleaned transaction descriptions for better search results.
 */

import { supabase } from './supabase';
import { cleanTransactionDescription, matchesWithWordBoundary } from './bankMatchingUtils';
import { AI_CONFIG } from './aiConfig';

export interface EnrichmentContext {
  name: string;
  city?: string;
  address?: string;
  categoryClues?: string;
}

export interface EnrichmentResult {
  confidence: number; // 0-100
  reason: string;
  accountId: string;
  contactId?: string;
  companyType?: string;
  suggestedCategory?: string;
  debug_info?: {
    clean_search_term: string;
    tavily_output: string;
    ai_reasoning: string;
    search_query: string;
  };
}

/**
 * Enrich transaction with external search (context-aware)
 */
export async function enrichTransactionWithTavily(
  context: string | EnrichmentContext,
  amount?: number
): Promise<EnrichmentResult | null> {
  // Support legacy string format
  const enrichmentContext: EnrichmentContext = typeof context === 'string'
    ? { name: context }
    : context;

  console.log(`🔍 [TAVILY SERVICE] Starting enrichment for: "${enrichmentContext.name}" (€${amount || 'unknown'})`);
  if (enrichmentContext.city) {
    console.log(`  📍 Location: ${enrichmentContext.city}`);
  }
  if (enrichmentContext.address) {
    console.log(`  🏠 Address: ${enrichmentContext.address}`);
  }
  if (enrichmentContext.categoryClues) {
    console.log(`  🏷️ Category clues: ${enrichmentContext.categoryClues}`);
  }

  try {
    // Check for Tavily API key in environment
    const tavilyApiKey = import.meta.env.VITE_TAVILY_API_KEY;

    let result: EnrichmentResult | null;

    if (tavilyApiKey && tavilyApiKey !== '') {
      console.log(`  ✓ Tavily API key found, using real API`);
      result = await enrichWithTavilyAPI(enrichmentContext, tavilyApiKey, amount);
    } else {
      console.log(`  ⚠ No Tavily API key, using simulation`);
      result = await enrichWithSimulation(enrichmentContext.name, amount);
    }

    if (result) {
      console.log(`✅ [TAVILY SERVICE] Enrichment successful:`, {
        confidence: result.confidence,
        accountId: result.accountId,
        category: result.suggestedCategory,
        reason: result.reason,
      });
    } else {
      console.log(`❌ [TAVILY SERVICE] Enrichment failed - no result`);
    }

    return result;
  } catch (error) {
    console.error('❌ [TAVILY SERVICE] Error enriching transaction:', error);
    return null;
  }
}

/**
 * Use real Tavily API for enrichment (CONTEXT-AWARE)
 *
 * DETECTIVE -> ACCOUNTANT Pattern:
 * 1. Detective: Use Tavily to find REAL facts about the business
 * 2. Accountant: Map the industry to appropriate ledger account
 *
 * This prevents hallucinations like "SHELL = Telephone costs" or "Jozef Restaurant = Law Firm"
 */
async function enrichWithTavilyAPI(
  context: EnrichmentContext,
  apiKey: string,
  amount?: number
): Promise<EnrichmentResult | null> {
  try {
    // Clean the description for better search results
    const cleanedDescription = cleanTransactionDescription(context.name);

    if (!cleanedDescription || cleanedDescription.length < 3) {
      console.log('⚠ Description too short after cleaning, skipping Tavily');
      return null;
    }

    // STEP 1: DETECTIVE - Build context-aware search query
    // Priority: Use city and address if available to disambiguate common names
    let query: string;

    if (context.city && context.address) {
      // Best case: Full location data
      query = `"${cleanedDescription}" ${context.address} ${context.city} Netherlands business type`;
      console.log(`🔍 [DETECTIVE] Using FULL location context`);
    } else if (context.city) {
      // Good: City is available
      query = `"${cleanedDescription}" ${context.city} Netherlands business type`;
      console.log(`🔍 [DETECTIVE] Using CITY context`);
    } else {
      // Fallback: Generic query (may have ambiguity)
      query = `What kind of business is "${cleanedDescription}" in The Netherlands? Return ONLY the industry category (e.g., Gas Station, Supermarket, Restaurant, Software, Insurance, Bank, Telecom, Retail).`;
      console.log(`🔍 [DETECTIVE] Using GENERIC query (no location data)`);
    }

    // Add category clues to improve search if available
    if (context.categoryClues) {
      query += ` ${context.categoryClues}`;
      console.log(`  🏷️ Adding category clues: "${context.categoryClues}"`);
    }

    console.log(`🔍 [DETECTIVE] Tavily search query: "${query}"`);

    const requestPayload = {
      api_key: apiKey ? `${apiKey.substring(0, 8)}...` : 'NOT_SET',
      query: query,
      search_depth: 'basic',
      max_results: 5,
      include_answer: true,
    };
    console.log('📤 [TAVILY REQUEST] Payload:', requestPayload);

    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: apiKey,
        query: query,
        search_depth: 'basic',
        max_results: 5,
        include_answer: true,
      }),
    });

    console.log('📥 [TAVILY RESPONSE] Status:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [TAVILY ERROR] Status:', response.status);
      console.error('❌ [TAVILY ERROR] Response:', errorText);

      if (response.status === 401 || response.status === 403) {
        throw new Error(`Tavily API authentication failed (${response.status}). Check your VITE_TAVILY_API_KEY. Response: ${errorText}`);
      } else if (response.status === 429) {
        throw new Error(`Tavily API rate limit exceeded (${response.status}). Please try again later. Response: ${errorText}`);
      } else {
        throw new Error(`Tavily API request failed (${response.status}): ${errorText}`);
      }
    }

    const data = await response.json();
    console.log('📄 [TAVILY RESPONSE] Data:', JSON.stringify(data, null, 2).substring(0, 500));

    // STEP 2: Extract industry from Tavily response (with OCR clues for verification)
    const industry = extractIndustryFromTavilyResults(data, cleanedDescription, context.categoryClues);

    if (!industry) {
      console.log('⚠ Tavily could not determine industry');

      // FALLBACK: If Tavily fails but we have category clues from OCR, trust the clues
      if (context.categoryClues) {
        console.log(`  ✓ [FALLBACK] Using category clues from OCR: "${context.categoryClues}"`);
        const fallbackIndustry = mapCategoryCluestoIndustry(context.categoryClues);
        if (fallbackIndustry) {
          console.log(`  ✓ [FALLBACK] Mapped clues to industry: "${fallbackIndustry}"`);
          const detectiveEvidence = `OCR detected: ${context.categoryClues}`;
          const enrichment = await mapIndustryToLedgerAccount(fallbackIndustry, cleanedDescription, amount, detectiveEvidence);

          if (enrichment) {
            enrichment.debug_info = {
              clean_search_term: cleanedDescription,
              tavily_output: `Tavily failed, used OCR clues: ${context.categoryClues}`,
              ai_reasoning: enrichment.reason,
              search_query: query,
            };
          }

          return enrichment;
        }
      }

      return null;
    }

    console.log(`✓ [DETECTIVE] Found industry: "${industry}" for "${cleanedDescription}"`);

    // STEP 3: Verify industry matches category clues (if available)
    if (context.categoryClues) {
      const cluesLower = context.categoryClues.toLowerCase();
      const industryLower = industry.toLowerCase();

      // Check if there's a major mismatch
      const isMismatch =
        (cluesLower.includes('restaurant') || cluesLower.includes('cafe') || cluesLower.includes('bar')) &&
        !industryLower.includes('food') && !industryLower.includes('hospitality') && !industryLower.includes('restaurant');

      if (isMismatch) {
        console.log(`  ⚠️ [VERIFICATION] Industry mismatch detected!`);
        console.log(`     OCR clues: "${context.categoryClues}"`);
        console.log(`     Tavily result: "${industry}"`);
        console.log(`  ✓ [VERIFICATION] Trusting OCR clues over Tavily`);

        const correctedIndustry = mapCategoryCluestoIndustry(context.categoryClues);
        if (correctedIndustry) {
          const detectiveEvidence = `OCR detected: ${context.categoryClues} (Tavily mismatch corrected)`;
          const enrichment = await mapIndustryToLedgerAccount(correctedIndustry, cleanedDescription, amount, detectiveEvidence);

          if (enrichment) {
            enrichment.debug_info = {
              clean_search_term: cleanedDescription,
              tavily_output: `Tavily said "${industry}", but OCR clues "${context.categoryClues}" were more accurate`,
              ai_reasoning: enrichment.reason,
              search_query: query,
            };
          }

          return enrichment;
        }
      }
    }

    // STEP 4: ACCOUNTANT - Map industry to ledger account (with full detective evidence)
    const detectiveEvidence = data.answer || industry;
    console.log(`🔍 [TAVILY] Passing to accountant - Amount: €${amount || 'unknown'}, Industry: ${industry}`);
    const enrichment = await mapIndustryToLedgerAccount(industry, cleanedDescription, amount, detectiveEvidence);

    if (enrichment) {
      console.log(`✓ [ACCOUNTANT] Mapped "${industry}" to account`);

      // Add debug info
      enrichment.debug_info = {
        clean_search_term: cleanedDescription,
        tavily_output: detectiveEvidence,
        ai_reasoning: enrichment.reason,
        search_query: query,
      };
    }

    return enrichment;
  } catch (error) {
    console.error('Tavily API error:', error);
    // Fall back to simulation
    return await enrichWithSimulation(context.name, amount);
  }
}

/**
 * Map category clues from OCR to industry type
 * This is used when Tavily fails or returns incorrect results
 */
function mapCategoryCluestoIndustry(categoryClues: string): string | null {
  const cluesLower = categoryClues.toLowerCase();

  if (cluesLower.includes('restaurant') || cluesLower.includes('cafe') ||
      cluesLower.includes('bar') || cluesLower.includes('bistro') ||
      cluesLower.includes('lunchroom') || cluesLower.includes('brasserie')) {
    return 'Food & Hospitality';
  }

  if (cluesLower.includes('bakery') || cluesLower.includes('bakkerij') ||
      cluesLower.includes('patisserie')) {
    return 'Food & Hospitality';
  }

  if (cluesLower.includes('supermarket') || cluesLower.includes('grocery')) {
    return 'Supermarket';
  }

  if (cluesLower.includes('taxi') || cluesLower.includes('uber')) {
    return 'Transport';
  }

  if (cluesLower.includes('garage') || cluesLower.includes('car service')) {
    return 'Car Repair Shop';
  }

  if (cluesLower.includes('gas station') || cluesLower.includes('fuel')) {
    return 'Gas Station';
  }

  if (cluesLower.includes('software') || cluesLower.includes('saas')) {
    return 'Software';
  }

  if (cluesLower.includes('hotel') || cluesLower.includes('accommodation')) {
    return 'Travel';
  }

  return null;
}

/**
 * STEP 2: Extract industry type from Tavily search results
 *
 * Analyzes Tavily's answer and content to determine the business type.
 * Returns a normalized industry string (e.g., "Gas Station", "Supermarket").
 *
 * @param categoryClues - Optional OCR clues to help verify the industry match
 */
function extractIndustryFromTavilyResults(tavilyData: any, description: string, categoryClues?: string): string | null {
  // Try to get answer from Tavily's AI summary first
  let content = '';

  if (tavilyData.answer) {
    content = tavilyData.answer.toLowerCase();
  } else if (tavilyData.results && tavilyData.results.length > 0) {
    // Combine search results
    content = tavilyData.results
      .map((r: any) => r.content || '')
      .join(' ')
      .toLowerCase();
  }

  if (!content) {
    return null;
  }

  console.log(`🔍 [DETECTIVE] Analyzing: "${content.substring(0, 200)}..."`);

  // Industry keyword detection with synonyms
  const industryPatterns = [
    { keywords: ['car service', 'auto service', 'automotive repair', 'car repair', 'garage', 'autowerkplaats', 'autoschade'], industry: 'Car Repair Shop' },
    { keywords: ['gas station', 'petrol station', 'fuel station', 'tankstation', 'benzinestation'], industry: 'Gas Station' },
    { keywords: ['supermarket', 'grocery store', 'supermarkt', 'levensmiddelen'], industry: 'Supermarket' },
    { keywords: ['patisserie', 'bakery', 'bakker', 'boulangerie', 'lunchroom', 'cafe', 'coffee', 'delicatessen', 'restaurant', 'eatery', 'dining', 'food service', 'bistro', 'brasserie', 'horeca'], industry: 'Food & Hospitality' },
    { keywords: ['software', 'saas', 'cloud service', 'tech company', 'application'], industry: 'Software' },
    { keywords: ['insurance', 'verzekering', 'insurer'], industry: 'Insurance' },
    { keywords: ['bank', 'banking', 'financial institution'], industry: 'Bank' },
    { keywords: ['telecom', 'telecommunication', 'mobile provider', 'internet provider'], industry: 'Telecom' },
    { keywords: ['energy', 'electricity', 'gas supplier', 'utilities', 'energie'], industry: 'Energy' },
    { keywords: ['retail', 'store', 'shop', 'winkel'], industry: 'Retail' },
    { keywords: ['consulting', 'consultancy', 'advisory', 'advies'], industry: 'Consulting' },
    { keywords: ['marketing', 'advertising', 'reclame'], industry: 'Marketing' },
    { keywords: ['office supplies', 'stationery', 'kantoor'], industry: 'Office Supplies' },
    { keywords: ['travel', 'airline', 'hotel', 'booking', 'reis'], industry: 'Travel' },
    { keywords: ['transport', 'logistics', 'delivery', 'courier'], industry: 'Transport' },
    { keywords: ['hardware store', 'bouwmarkt', 'construction'], industry: 'Hardware Store' },
  ];

  // Find matching industry
  for (const pattern of industryPatterns) {
    for (const keyword of pattern.keywords) {
      if (content.includes(keyword)) {
        console.log(`✓ [DETECTIVE] Matched keyword "${keyword}" -> Industry: "${pattern.industry}"`);
        return pattern.industry;
      }
    }
  }

  console.log('⚠ [DETECTIVE] No industry pattern matched in Tavily response');
  return null;
}

/**
 * Map an account to a UI category (emoji) for display purposes
 * This happens AFTER account selection, purely for visual organization
 *
 * SOURCE OF TRUTH: Uses the `tax_category` field from the database (Tax Category IB Aangifte)
 * This replaces hardcoded number ranges with database-driven logic.
 *
 * IMPORTANT: BTW/VAT is NOT considered here - that's handled during invoice booking,
 * not during bank transaction matching. We only look at semantic meaning via tax_category.
 */
function mapAccountToUICategory(account: any): { emoji: string; label: string } {
  const taxCategory = account.tax_category?.toLowerCase() || '';
  const name = account.name?.toLowerCase() || '';
  const code = account.code;

  // PRIORITY 1: Use tax_category from database (Tax Category IB Aangifte)
  // This is the source of truth set by the user in Settings

  // 🚗 CAR & TRAVEL - Autokosten / Vervoer
  if (taxCategory.includes('autokosten') || taxCategory.includes('vervoer') ||
      taxCategory.includes('auto') || taxCategory.includes('transport')) {
    return { emoji: '🚗', label: 'CAR & TRAVEL' };
  }

  // 🏠 HOUSING & FACILITIES - Huisvestingskosten
  if (taxCategory.includes('huisvesting') || taxCategory.includes('huur') ||
      taxCategory.includes('gebouw') || taxCategory.includes('pand')) {
    return { emoji: '🏠', label: 'HOUSING & FACILITIES' };
  }

  // 🏢 OFFICE & GENERAL - Kantoorkosten / Algemene kosten
  if (taxCategory.includes('kantoor') || taxCategory.includes('algemene kosten') ||
      taxCategory.includes('algemeen') || taxCategory.includes('office')) {
    return { emoji: '🏢', label: 'OFFICE & GENERAL' };
  }

  // 🍽️ FOOD & HOSPITALITY - Verkoopkosten / Representatie
  if (taxCategory.includes('verkoop') || taxCategory.includes('representatie') ||
      taxCategory.includes('relatie') || taxCategory.includes('marketing')) {
    return { emoji: '🍽️', label: 'FOOD & HOSPITALITY' };
  }

  // 💼 PROFESSIONAL SERVICES - Advieskosten / Administratie
  if (taxCategory.includes('advies') || taxCategory.includes('administratie') ||
      taxCategory.includes('accountant') || taxCategory.includes('juridisch') ||
      taxCategory.includes('notaris')) {
    return { emoji: '💼', label: 'PROFESSIONAL SERVICES' };
  }

  // 🏛️ ASSETS & DEPRECIATION - Afschrijvingen
  if (taxCategory.includes('afschrijving') || taxCategory.includes('depreci')) {
    return { emoji: '🏛️', label: 'ASSETS & DEPRECIATION' };
  }

  // 👤 PRIVATE & PERSONAL - Prive
  if (taxCategory.includes('prive') || taxCategory.includes('privé') ||
      taxCategory.includes('priv')) {
    return { emoji: '👤', label: 'PRIVATE & PERSONAL' };
  }

  // 🏦 BANKING & FINANCE - Financiele baten en lasten
  if (taxCategory.includes('financieel') || taxCategory.includes('financiele') ||
      taxCategory.includes('bank') || taxCategory.includes('rente') ||
      taxCategory.includes('baten en lasten')) {
    return { emoji: '🏦', label: 'BANKING & FINANCE' };
  }

  // 📦 INVENTORY & PURCHASES - Inkoop / Voorraad
  if (taxCategory.includes('inkoop') || taxCategory.includes('voorraad') ||
      taxCategory.includes('handelsgoederen') || taxCategory.includes('purchase')) {
    return { emoji: '📦', label: 'INVENTORY & PURCHASES' };
  }

  // FALLBACK: If no tax_category is set, use name-based matching
  // This ensures backward compatibility for accounts without tax_category

  // Car & Travel (name fallback)
  if (name.includes('auto') || name.includes('brandstof') || name.includes('voertuig') ||
      name.includes('reis') || name.includes('parkeer') || name.includes('kilometervergoeding')) {
    return { emoji: '🚗', label: 'CAR & TRAVEL' };
  }

  // Food & Hospitality (name fallback)
  if (name.includes('kantine') || name.includes('representatie') || name.includes('relatie') ||
      name.includes('maaltijd') || name.includes('horeca') || name.includes('restaurant')) {
    return { emoji: '🍽️', label: 'FOOD & HOSPITALITY' };
  }

  // Housing & Facilities (name fallback)
  if (name.includes('huur') || name.includes('onderhoud gebouw') || name.includes('gebouw') ||
      name.includes('energi') || name.includes('schoonmaak') || name.includes('water') ||
      name.includes('gas') || name.includes('elektra')) {
    return { emoji: '🏠', label: 'HOUSING & FACILITIES' };
  }

  // Professional Services (name fallback)
  if (name.includes('accountant') || name.includes('advies') || name.includes('notaris') ||
      name.includes('juridisch') || name.includes('administratie') || name.includes('advocaat')) {
    return { emoji: '💼', label: 'PROFESSIONAL SERVICES' };
  }

  // Inventory & Purchases (name fallback)
  if (name.includes('inkoop') || name.includes('voorraad') || name.includes('handelsgoederen')) {
    return { emoji: '📦', label: 'INVENTORY & PURCHASES' };
  }

  // Banking & Finance (name fallback)
  if (name.includes('bank') || name.includes('rente') || name.includes('financier') ||
      name.includes('kosten geldverkeer')) {
    return { emoji: '🏦', label: 'BANKING & FINANCE' };
  }

  // Assets & Depreciation (name fallback)
  if (name.includes('afschrijving') || name.includes('depreci')) {
    return { emoji: '🏛️', label: 'ASSETS & DEPRECIATION' };
  }

  // Private & Personal (name fallback)
  if (name.includes('privé') || name.includes('prive')) {
    return { emoji: '👤', label: 'PRIVATE & PERSONAL' };
  }

  // Default: Office & General
  return { emoji: '🏢', label: 'OFFICE & GENERAL' };
}

/**
 * Group accounts by semantic meaning using database tax_category field
 *
 * SOURCE OF TRUTH: The `tax_category` field (Tax Category IB Aangifte) from the database.
 * This field is set by the user in Settings and determines the semantic grouping.
 *
 * CRITICAL: This is NOT about BTW/VAT rules. BTW is handled during invoice booking.
 * The tax_category field here is used purely for semantic categorization
 * (e.g., "Autokosten" → 🚗 CAR & TRAVEL).
 */
interface SemanticAccountGroup {
  emoji: string;
  title: string;
  accounts: Array<{ id: string; code: string; name: string }>;
}

function groupAccountsBySemantic(accounts: any[]): SemanticAccountGroup[] {
  const groups: SemanticAccountGroup[] = [
    { emoji: '🚗', title: 'CAR & TRAVEL', accounts: [] },
    { emoji: '🏢', title: 'OFFICE & GENERAL', accounts: [] },
    { emoji: '🏠', title: 'HOUSING & FACILITIES', accounts: [] },
    { emoji: '💼', title: 'PROFESSIONAL SERVICES', accounts: [] },
    { emoji: '🍽️', title: 'FOOD & HOSPITALITY', accounts: [] },
    { emoji: '📦', title: 'INVENTORY & PURCHASES', accounts: [] },
    { emoji: '🏦', title: 'BANKING & FINANCE', accounts: [] },
    { emoji: '🏛️', title: 'ASSETS & DEPRECIATION', accounts: [] },
    { emoji: '👤', title: 'PRIVATE & PERSONAL', accounts: [] },
    { emoji: '📊', title: 'OTHER EXPENSES', accounts: [] },
  ];

  for (const acc of accounts) {
    const entry = { id: acc.id, code: acc.code, name: acc.name };
    const category = mapAccountToUICategory(acc);

    // Find the matching group by emoji
    const group = groups.find(g => g.emoji === category.emoji);
    if (group) {
      group.accounts.push(entry);
    } else {
      // Fallback to OTHER EXPENSES
      groups[9].accounts.push(entry);
    }
  }

  // Filter out empty groups
  return groups.filter(g => g.accounts.length > 0);
}

function formatSemanticAccountMenu(groups: SemanticAccountGroup[]): string {
  return groups
    .map(group => {
      const accountList = group.accounts
        .map(a => `  • ${a.code} ${a.name} (ID: ${a.id})`)
        .join('\n');
      return `${group.emoji} ${group.title}:\n${accountList}`;
    })
    .join('\n\n');
}

/**
 * Generate a smart reasoning prompt with chain-of-thought
 * Uses SEMANTIC grouping (NOT tax/VAT logic) and full detective context
 *
 * CRITICAL: VAT/BTW rules are NOT considered during bank matching.
 * VAT is handled during invoice booking. Here we only match on semantic meaning.
 */
function generateAccountantPrompt(
  industry: string,
  description: string,
  amount: number | undefined,
  detectiveEvidence: string,
  semanticGroups: SemanticAccountGroup[]
): string {
  // Build amount context
  const amountLine = amount !== undefined
    ? `€${Math.abs(amount).toFixed(2)}`
    : 'Unknown';

  // Build hard rules based on amount
  let amountGuidance = '';
  if (amount !== undefined && amount < 450) {
    amountGuidance = `
⚠️ AMOUNT RULE: This is a small expense (€${Math.abs(amount).toFixed(2)} < €450).
   - In Dutch accounting, amounts under €450 are DIRECT expenses, NOT capitalized.
   - DO NOT select accounts from "🏛️ ASSETS & DEPRECIATION" category.
   - Focus on operational expense categories.`;
  } else if (amount !== undefined && amount >= 450) {
    amountGuidance = `
💡 AMOUNT CONTEXT: This is a larger expense (€${Math.abs(amount).toFixed(2)} >= €450).
   - This COULD be a capital asset (equipment, furniture, IT) if appropriate.
   - Otherwise, treat as operational expense.`;
  }

  // Format the account menu by semantic category
  const accountMenu = formatSemanticAccountMenu(semanticGroups);

  // Build the prompt with chain-of-thought structure
  return `You are a Dutch accounting expert. Your task is to match this bank transaction to the most appropriate ledger account.

═══════════════════════════════════════════════════════════════
📋 TRANSACTION DETAILS
═══════════════════════════════════════════════════════════════
Description: "${description}"
Amount: ${amountLine}
Industry Tag: "${industry}"

🔍 DETECTIVE EVIDENCE (What we know about this merchant):
${detectiveEvidence}
${amountGuidance}

═══════════════════════════════════════════════════════════════
📚 AVAILABLE ACCOUNTS (Grouped by SEMANTIC MEANING)
═══════════════════════════════════════════════════════════════
The accounts below are grouped by their SEMANTIC PURPOSE (NOT by VAT/tax rules).
VAT is handled during invoice booking, not here. Focus ONLY on matching the account name to the transaction.

${accountMenu}

═══════════════════════════════════════════════════════════════
🧠 REASONING INSTRUCTIONS (SEMANTIC MATCHING)
═══════════════════════════════════════════════════════════════
Use CHAIN-OF-THOUGHT reasoning based on SEMANTIC MEANING ONLY:

1. READ the detective evidence - what does this merchant do?
2. IDENTIFY which semantic category best matches the merchant's business
3. WITHIN that category, find the account whose NAME best describes the expense
4. VERIFY the account makes sense given the amount and context

CRITICAL RULES:
- DO NOT consider VAT/BTW rules - VAT is handled later during invoice booking
- Match ONLY on the semantic meaning of the account name
- "Brandstof" for Shell, "Onderhoud auto" for garage, "Kantoorkosten" for office supplies, etc.
- The emoji categories are just for organization - focus on the account NAME

Examples of SEMANTIC reasoning:
- "Shell gas station" → Look in 🚗 CAR & TRAVEL → Select "Brandstof" (Fuel)
- "Complete Car Service" → Look in 🚗 CAR & TRAVEL → Select "Onderhoud auto" (Car maintenance)
- "Albert Heijn supermarket" → Look in 🍽️ FOOD & HOSPITALITY → Select "Kantine" (Canteen/food) for small amounts
- "Bakkerij/Patisserie" → Look in 🍽️ FOOD & HOSPITALITY → Select "Kantinekosten" (4035) for small purchases OR "Representatiekosten" (4510) for business gifts
- "Restaurant/Lunchroom" → Look in 🍽️ FOOD & HOSPITALITY → Select "Representatiekosten" (4510) for business meals
- "Office Depot" → Look in 🏢 OFFICE & GENERAL → Select "Kantoorkosten" (Office costs)
- "ING Bank fee" → Look in 🏦 BANKING & FINANCE → Select "Bankkosten" (Bank costs)

SPECIAL RULES for 🍽️ FOOD & HOSPITALITY:
- Bakeries/Patisseries: Use "Kantinekosten" (4035) for small amounts, "Representatiekosten" (4510) for business gifts
- Restaurants/Cafes: Use "Representatiekosten" (4510) for business lunches/dinners
- Supermarkets: Use "Kantinekosten" (4035) for office snacks

═══════════════════════════════════════════════════════════════
📤 REQUIRED RESPONSE FORMAT (JSON)
═══════════════════════════════════════════════════════════════
You MUST respond with valid JSON in this exact format:

{
  "analysis": "Brief explanation: what is the merchant and why this account name fits semantically",
  "category_group": "The emoji category (e.g., '🚗 CAR & TRAVEL')",
  "selected_account_code": "The 4-digit code (e.g., '4605')",
  "selected_account_name": "The account name",
  "id": "The full UUID of the selected account"
}

Example response:
{
  "analysis": "Complete Car Service is an automotive repair shop. The expense is for vehicle maintenance, which matches 'Onderhoud auto'.",
  "category_group": "🚗 CAR & TRAVEL",
  "selected_account_code": "4605",
  "selected_account_name": "Onderhoud auto",
  "id": "a1b2c3d4-1234-5678-9abc-def012345678"
}

Think step-by-step, then respond with the JSON.`;
}

/**
 * STEP 3: ACCOUNTANT - Map industry to appropriate ledger account
 *
 * Uses SEMANTIC MATCHING via OpenAI with chain-of-thought reasoning.
 * Prevents incorrect mappings (e.g., "Supermarket" -> "Depreciation").
 *
 * Process:
 * 1. Fetch ALL expense + private accounts from database
 * 2. Group accounts thematically for better AI reasoning
 * 3. Ask OpenAI to use chain-of-thought to match (with detective evidence & amount)
 * 4. Return the matched account with confidence score
 */
async function mapIndustryToLedgerAccount(
  industry: string,
  description: string,
  amount: number | undefined,
  detectiveEvidence: string
): Promise<EnrichmentResult | null> {
  console.log(`💼 [ACCOUNTANT] Mapping industry "${industry}" to ledger account... (Amount: €${amount || 'unknown'})`);

  try {
    // STEP 1: Fetch relevant ledger accounts (Expense + Private only)
    const { data: accounts, error } = await supabase
      .from('accounts')
      .select('id, code, name, tax_category, type')
      .in('type', ['Expense', 'Equity'])
      .eq('is_active', true)
      .order('code');

    if (error || !accounts || accounts.length === 0) {
      console.log('⚠ [ACCOUNTANT] No accounts found in database');
      return null;
    }

    // Filter: Only expense accounts + private accounts (1800-1899)
    // CRITICAL: ALWAYS exclude ALL depreciation accounts - these are NEVER bank transactions!
    // Depreciation entries are always year-end journal entries, never from bank imports.
    const relevantAccounts = accounts.filter(acc => {
      // Always include private accounts
      if (acc.code >= '1800' && acc.code < '1900') {
        return true;
      }

      // For expense accounts, apply HARD DEPRECIATION BLACKLIST
      if (acc.type === 'Expense') {
        // BLACKLIST: Exclude ALL depreciation and internal accounts (regardless of amount)
        // Check by multiple methods to catch all blacklisted accounts:
        // 1. Account code ranges: 4200-4299 (Depreciation), 4900-4999 (Internal)
        // 2. Tax category containing "afschrijv" or "depreci"
        // 3. Account name containing "afschrijv" or "depreci"

        const code = parseInt(acc.code);
        const isBlacklistedByCode =
          (code >= 4200 && code <= 4299) ||
          (code >= 4900 && code <= 4999);

        const isBlacklistedByCategory =
          acc.tax_category?.toLowerCase().includes('afschrijv') ||
          acc.tax_category?.toLowerCase().includes('depreci');

        const isBlacklistedByName =
          acc.name?.toLowerCase().includes('afschrijv') ||
          acc.name?.toLowerCase().includes('depreci');

        if (isBlacklistedByCode || isBlacklistedByCategory || isBlacklistedByName) {
          console.log(`  🚫 BLACKLISTED: ${acc.code} ${acc.name} (depreciation/internal - never a bank transaction)`);
          return false;
        }

        return true;
      }

      return false;
    });

    if (relevantAccounts.length === 0) {
      console.log('⚠ [ACCOUNTANT] No expense/private accounts found');
      return null;
    }

    console.log(`  ✓ Filtered to ${relevantAccounts.length} relevant accounts (amount: €${amount || 'unknown'})`);

    // STEP 2: Group accounts by semantic meaning (NOT by tax/VAT rules)
    // VAT is handled during invoice booking, not during bank matching
    const semanticGroups = groupAccountsBySemantic(relevantAccounts);
    console.log(`📋 [ACCOUNTANT] Grouped into ${semanticGroups.length} semantic categories (no VAT logic)`);

    // STEP 3: Ask OpenAI for semantic match with chain-of-thought
    const openaiApiKey = import.meta.env.VITE_OPENAI_API_KEY;

    if (!openaiApiKey) {
      console.log('⚠ [ACCOUNTANT] No OpenAI API key, falling back to simple match');
      return fallbackSimpleMatch(industry, relevantAccounts);
    }

    // Build the prompt with semantic grouping and detective evidence
    const prompt = generateAccountantPrompt(industry, description, amount, detectiveEvidence, semanticGroups);

    // DEBUG: Log the full prompt being sent to OpenAI
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[PROMPT] Sending to OpenAI:');
    console.log(prompt);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: AI_CONFIG.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: AI_CONFIG.temperature,
        max_tokens: 300, // Increased for chain-of-thought response
      }),
    });

    if (!response.ok) {
      console.log('⚠ [ACCOUNTANT] OpenAI request failed, using fallback');
      return fallbackSimpleMatch(industry, relevantAccounts);
    }

    const data = await response.json();
    const rawContent = data.choices[0]?.message?.content;

    if (!rawContent) {
      console.log('⚠ [ACCOUNTANT] Empty OpenAI response, using fallback');
      return fallbackSimpleMatch(industry, relevantAccounts);
    }

    console.log('🔍 [PARSER] Raw OpenAI response:', rawContent);

    // ═══════════════════════════════════════════════════════════════
    // CHAIN-OF-THOUGHT RESPONSE PARSER
    // ═══════════════════════════════════════════════════════════════
    const result = parseChainOfThoughtResponse(rawContent, relevantAccounts, industry);

    if (!result) {
      console.log('⚠ [ACCOUNTANT] Chain-of-thought parsing failed, using fallback');
      return fallbackSimpleMatch(industry, relevantAccounts);
    }

    return result;
  } catch (error) {
    console.error('❌ [ACCOUNTANT] Critical error in OpenAI mapping:', error);
    return fallbackSimpleMatch(industry, relevantAccounts);
  }
}

/**
 * ═══════════════════════════════════════════════════════════════
 * CHAIN-OF-THOUGHT RESPONSE PARSER (SEMANTIC AWARE)
 * ═══════════════════════════════════════════════════════════════
 *
 * Parses the new JSON format with analysis, category_group, and account details.
 * Falls back to legacy parsing strategies if JSON format fails.
 *
 * IMPORTANT: No tax/VAT logic here - purely semantic matching.
 */
function parseChainOfThoughtResponse(
  rawContent: string,
  accounts: any[],
  industry: string
): EnrichmentResult | null {
  console.log('🧠 [CHAIN-OF-THOUGHT PARSER] Starting...');

  // STRATEGY 1: Parse Chain-of-Thought JSON
  // ─────────────────────────────────────────────────────────────
  try {
    console.log('  → Strategy 1: Chain-of-thought JSON parsing...');

    let cleanContent = rawContent
      .replace(/```json\s*/gi, '')
      .replace(/```javascript\s*/gi, '')
      .replace(/```js\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();

    // Extract JSON object from text
    const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleanContent = jsonMatch[0];
    }

    const parsed = JSON.parse(cleanContent);
    console.log('    ✓ JSON parsed:', parsed);

    // Extract the account ID from the chain-of-thought response
    const accountId = parsed.id;

    if (accountId && typeof accountId === 'string') {
      const foundAccount = accounts.find(acc => acc.id === accountId);
      if (foundAccount) {
        // Map to UI category AFTER selection (for display purposes only)
        const uiCategory = mapAccountToUICategory(foundAccount);

        console.log(`  ✅ Strategy 1 SUCCESS: ${foundAccount.code} ${foundAccount.name}`);
        console.log(`    📊 Semantic Category: ${parsed.category_group || uiCategory.label}`);
        console.log(`    💭 Analysis: ${parsed.analysis}`);
        console.log(`    🎨 UI Category: ${uiCategory.emoji} ${uiCategory.label}`);

        return {
          confidence: 85, // Higher confidence with chain-of-thought
          reason: `${parsed.analysis || 'AI reasoning'} → ${foundAccount.name}`,
          accountId: foundAccount.id,
          suggestedCategory: foundAccount.name,
          companyType: industry,
        };
      } else {
        console.log('    ⚠ Account ID found but not in list:', accountId);
      }
    }

    // Try to match by code if ID not found
    if (parsed.selected_account_code) {
      const foundAccount = accounts.find(acc => acc.code === parsed.selected_account_code);
      if (foundAccount) {
        const uiCategory = mapAccountToUICategory(foundAccount);

        console.log(`  ✅ Strategy 1b SUCCESS (by code): ${foundAccount.code} ${foundAccount.name}`);
        console.log(`    📊 Semantic Category: ${parsed.category_group || uiCategory.label}`);
        console.log(`    🎨 UI Category: ${uiCategory.emoji} ${uiCategory.label}`);

        return {
          confidence: 80,
          reason: `${parsed.analysis || 'AI reasoning'} → ${foundAccount.name}`,
          accountId: foundAccount.id,
          suggestedCategory: foundAccount.name,
          companyType: industry,
        };
      }
    }
  } catch (e) {
    console.log('    ✗ Strategy 1 failed:', (e as Error).message);
  }

  // STRATEGY 2: UUID Extraction (Brute Force)
  // ─────────────────────────────────────────────────────────────
  try {
    console.log('  → Strategy 2: UUID pattern extraction...');

    const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
    const uuidMatches = rawContent.match(uuidPattern);

    if (uuidMatches && uuidMatches.length > 0) {
      for (const uuid of uuidMatches) {
        const foundAccount = accounts.find(acc => acc.id.toLowerCase() === uuid.toLowerCase());
        if (foundAccount) {
          const uiCategory = mapAccountToUICategory(foundAccount);
          console.log(`  ✅ Strategy 2 SUCCESS: ${foundAccount.code} ${foundAccount.name}`);
          console.log(`    🎨 UI Category: ${uiCategory.emoji} ${uiCategory.label}`);
          return {
            confidence: 75,
            reason: `AI Match: ${foundAccount.name}`,
            accountId: foundAccount.id,
            suggestedCategory: foundAccount.name,
            companyType: industry,
          };
        }
      }
    }
  } catch (e) {
    console.log('    ✗ Strategy 2 failed:', (e as Error).message);
  }

  // STRATEGY 3: Account Code Extraction
  // ─────────────────────────────────────────────────────────────
  try {
    console.log('  → Strategy 3: Account code pattern extraction...');

    const codePattern = /\b(4\d{3}|1[89]\d{2}|\d{4})\b/g;
    const codeMatches = rawContent.match(codePattern);

    if (codeMatches && codeMatches.length > 0) {
      for (const code of codeMatches) {
        const foundAccount = accounts.find(acc => acc.code === code);
        if (foundAccount) {
          const uiCategory = mapAccountToUICategory(foundAccount);
          console.log(`  ✅ Strategy 3 SUCCESS: ${foundAccount.code} ${foundAccount.name}`);
          console.log(`    🎨 UI Category: ${uiCategory.emoji} ${uiCategory.label}`);
          return {
            confidence: 70,
            reason: `AI Match: ${foundAccount.name}`,
            accountId: foundAccount.id,
            suggestedCategory: foundAccount.name,
            companyType: industry,
          };
        }
      }
    }
  } catch (e) {
    console.log('    ✗ Strategy 3 failed:', (e as Error).message);
  }

  console.log('  ❌ All parsing strategies failed');
  return null;
}


/**
 * Fallback: Simple keyword matching when OpenAI is unavailable
 */
function fallbackSimpleMatch(industry: string, accounts: any[]): EnrichmentResult | null {
  console.log(`🔄 [FALLBACK] Attempting simple match for industry: "${industry}"`);

  const industryKeywords: Record<string, string[]> = {
    'Car Repair Shop': ['onderhoud', 'auto', 'voertuig', 'reparatie'],
    'Gas Station': ['brandstof', 'fuel', 'auto'],
    'Supermarket': ['kantine', 'levensmiddel', 'inkoop', 'kantoor'],
    'Food & Hospitality': ['kantine', 'representatie', 'relatie', 'maaltijd'],
    'Restaurant': ['representatie', 'relatie', 'maaltijd'],
    'Software': ['automatisering', 'software', 'ict'],
    'Insurance': ['verzekering'],
    'Bank': ['bank'],
    'Telecom': ['telecommunicatie', 'telefoon', 'internet'],
    'Energy': ['energie', 'gas', 'elektra'],
    'Retail': ['representatie', 'kantoor'],
    'Consulting': ['advies', 'accountant', 'consultant'],
    'Marketing': ['marketing', 'reclame', 'advertentie'],
    'Office Supplies': ['kantoor', 'benodigdheden'],
    'Travel': ['reis', 'travel'],
    'Transport': ['vervoer', 'transport'],
    'Hardware Store': ['onderhoud', 'inventaris', 'kantoor'],
  };

  const keywords = industryKeywords[industry] || [];

  if (keywords.length === 0) {
    console.log(`⚠ [FALLBACK] No keywords defined for industry: "${industry}"`);
    // Try generic expense account as last resort
    // NOTE: We explicitly avoid 4200 (depreciation in DB) and look for office/general expenses
    const genericExpense = accounts.find(acc =>
      acc.name.toLowerCase().includes('kantoor') ||
      acc.name.toLowerCase().includes('algemeen') ||
      acc.name.toLowerCase().includes('overig')
    );

    if (genericExpense) {
      console.log(`✓ [FALLBACK] Using generic expense account: ${genericExpense.code} ${genericExpense.name}`);
      return {
        confidence: 70,
        reason: `Generic match: ${genericExpense.name}`,
        accountId: genericExpense.id,
        suggestedCategory: genericExpense.name,
        companyType: industry,
      };
    }
  }

  for (const keyword of keywords) {
    const match = accounts.find(acc =>
      acc.name.toLowerCase().includes(keyword) ||
      acc.tax_category?.toLowerCase().includes(keyword)
    );

    if (match) {
      console.log(`✓ [FALLBACK] Matched "${industry}" -> ${match.code} ${match.name}`);
      return {
        confidence: 75,
        reason: `Keyword match: ${industry} → ${match.name}`,
        accountId: match.id,
        suggestedCategory: match.name,
        companyType: industry,
      };
    }
  }

  console.log(`⚠ [FALLBACK] No match found for "${industry}"`);
  return null;
}

/**
 * Intelligent simulation for enrichment (when no API key available)
 *
 * ALSO uses DETECTIVE -> ACCOUNTANT pattern:
 * 1. Detective: Detect industry from known vendor patterns
 * 2. Accountant: Map industry to ledger account (same logic as Tavily path)
 */
async function enrichWithSimulation(description: string, amount?: number): Promise<EnrichmentResult | null> {
  // Clean the description first
  const cleanedDescription = cleanTransactionDescription(description);
  const lowerDesc = cleanedDescription.toLowerCase();

  console.log(`🔍 [DETECTIVE-SIM] Analyzing: "${cleanedDescription}" (€${amount || 'unknown'})`);

  // Known Dutch vendors and their industries
  const vendorPatterns = [
    // Car Services & Repair
    {
      keywords: ['car service', 'auto service', 'garage', 'autowerkplaats', 'autoschade', 'apr', 'onderhoud auto'],
      industry: 'Car Repair Shop',
    },
    // Gas Stations
    {
      keywords: ['shell', 'bp', 'esso', 'texaco', 'total', 'q8', 'gulf', 'tinq'],
      industry: 'Gas Station',
    },
    // Supermarkets
    {
      keywords: ['albert heijn', 'ah to go', 'jumbo', 'lidl', 'aldi', 'plus', 'coop', 'spar', 'dirk'],
      industry: 'Supermarket',
    },
    // Software & SaaS
    {
      keywords: ['github', 'gitlab', 'aws', 'azure', 'google cloud', 'dropbox', 'slack', 'zoom', 'microsoft', 'adobe', 'atlassian'],
      industry: 'Software',
    },
    // Telecom
    {
      keywords: ['kpn', 'vodafone', 'ziggo', 't-mobile', 'tele2', 'telfort'],
      industry: 'Telecom',
    },
    // Energy
    {
      keywords: ['essent', 'eneco', 'vattenfall', 'greenchoice', 'energiedirect'],
      industry: 'Energy',
    },
    // Insurance
    {
      keywords: ['asr', 'aegon', 'nn verzekeringen', 'achmea', 'univé', 'centraal beheer'],
      industry: 'Insurance',
    },
    // Travel
    {
      keywords: ['ns ', 'schiphol', 'klm', 'booking', 'hotels.com', 'airbnb', 'transavia'],
      industry: 'Travel',
    },
    // Transport
    {
      keywords: ['uber', 'taxi', 'bolt'],
      industry: 'Transport',
    },
    // Marketing
    {
      keywords: ['google ads', 'facebook ads', 'meta ads', 'linkedin ads'],
      industry: 'Marketing',
    },
    // Office Supplies
    {
      keywords: ['staples', 'office centre', 'makro'],
      industry: 'Office Supplies',
    },
    // Banks
    {
      keywords: ['abn amro', 'ing bank', 'rabobank', 'bunq', 'knab', 'triodos'],
      industry: 'Bank',
    },
    // Hardware Stores
    {
      keywords: ['gamma', 'karwei', 'praxis', 'hornbach', 'bouwmaat'],
      industry: 'Hardware Store',
    },
    // Food & Hospitality (Restaurants, Bakeries, Cafes)
    {
      keywords: ['mcdonalds', 'burger king', 'kfc', 'subway', 'dominos', 'pizza hut', 'patisserie', 'bakkerij', 'bakker', 'lunchroom', 'coffee company', 'starbucks', 'cafe', 'restaurant', 'horeca'],
      industry: 'Food & Hospitality',
    },
  ];

  // STEP 1: DETECTIVE - Detect industry from vendor patterns
  let detectedIndustry: string | null = null;

  for (const pattern of vendorPatterns) {
    for (const keyword of pattern.keywords) {
      if (matchesWithWordBoundary(cleanedDescription, keyword)) {
        detectedIndustry = pattern.industry;
        console.log(`✓ [DETECTIVE-SIM] Matched vendor "${keyword}" -> Industry: "${detectedIndustry}"`);
        break;
      }
    }
    if (detectedIndustry) break;
  }

  if (!detectedIndustry) {
    console.log(`✗ [DETECTIVE-SIM] No vendor pattern matched for: "${cleanedDescription}"`);
    return null;
  }

  // STEP 2: ACCOUNTANT - Use same mapping logic as Tavily path (with amount and evidence)
  const detectiveEvidence = `This appears to be a ${detectedIndustry} based on known vendor patterns in the Netherlands.`;
  console.log(`🔍 [SIM] Passing to accountant - Amount: €${amount || 'unknown'}, Industry: ${detectedIndustry}`);
  const enrichment = await mapIndustryToLedgerAccount(detectedIndustry, cleanedDescription, amount, detectiveEvidence);

  if (enrichment) {
    // Override reason to indicate simulation
    enrichment.reason = `Herkend als ${enrichment.suggestedCategory || detectedIndustry}`;

    // Add debug info
    enrichment.debug_info = {
      clean_search_term: cleanedDescription,
      tavily_output: `${detectedIndustry} (simulation - no API key)`,
      ai_reasoning: enrichment.reason,
    };
  }

  return enrichment;
}

/**
 * Search for existing contact by name (fuzzy match)
 */
export async function searchContactByName(name: string): Promise<string | null> {
  try {
    const { data: contacts } = await supabase
      .from('contacts')
      .select('id, name')
      .ilike('name', `%${name}%`)
      .limit(1);

    if (contacts && contacts.length > 0) {
      return contacts[0].id;
    }

    return null;
  } catch (error) {
    console.error('Error searching contact:', error);
    return null;
  }
}
