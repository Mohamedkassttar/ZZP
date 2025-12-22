/**
 * Bank Automation Service - "Bulldozer" Method
 *
 * ═══════════════════════════════════════════════════════════════
 * SIMPLIFIED HARD-MATCHING LOGIC (No Complex Scoring!)
 * ═══════════════════════════════════════════════════════════════
 *
 * PHILOSOPHY: If we find a match, we're 100% confident. NO DOUBT.
 *
 * MATCHING HIERARCHY:
 * 1. Invoice Match (100%) - Exact amount + date match
 * 2. User Rules (100%) - User-defined keyword matches
 * 3. CRM/Relation Scanner (100%) - Existing contacts with AI fallback
 *    - If relation found: Force "relation" mode
 *    - If relation has default account: Use it (100% confidence)
 *    - If no default account: Use AI to determine account
 * 4. Hardcoded Defaults (100%) - Shell, BP, AH, etc.
 * 5. Tavily Fallback (only if steps 1-4 fail)
 *
 * INPUT SOURCE PRIORITY:
 * 1. contra_name (counterparty) - HIGHEST QUALITY
 * 2. description - ONLY IF contra_name is empty
 * 3. ALWAYS clean noise (Apple Pay, Pasnr, etc.)
 *
 * WORD BOUNDARY MATCHING:
 * - "BP" matches "BP Station" ✓
 * - "BP" does NOT match "BPost" ✗
 * - "SHELL" matches "SHELL UTRECHT" ✓
 * - "SHELL" does NOT match "SHELLFISH" ✗
 */

import { supabase } from './supabase';
import { bookBankTransaction, bookBankTransactionViaRelatie } from './bankService';
import { enrichTransactionWithTavily, type EnrichmentContext } from './tavilyEnrichmentService';
import { cleanTransactionDescription } from './bankMatchingUtils';
import { limitConcurrencyWithErrorHandling } from './concurrencyLimiter';

export interface ConfidenceScore {
  score: number; // Always 100 for matches, 0 for no match
  reason: string;
  source: 'invoice_match' | 'bank_rule' | 'vendor_map' | 'tavily_enrichment' | 'manual';
  suggestion: {
    mode: 'direct' | 'relation';
    accountId?: string;
    contactId?: string;
    description: string;
  };
  debug_info?: {
    clean_search_term: string;
    tavily_output: string;
    ai_reasoning: string;
  };
}

export interface AutoBookingResult {
  transactionId: string;
  status: 'auto_booked' | 'needs_review' | 'error';
  confidence: ConfidenceScore;
  error?: string;
}

export interface ImportAnalysisReport {
  totalProcessed: number;
  autoBooked: number;
  autoBookedDirect: number;
  autoBookedRelation: number;
  needsReview: number;
  errors: number;
  details: AutoBookingResult[];
}

/**
 * Hardcoded vendor defaults with keywords for regex matching
 */
interface VendorDefault {
  keywords: string[];
  accountCode: string;
  category: string;
}

const HARDCODED_VENDORS: VendorDefault[] = [
  {
    keywords: ['geldmaat', 'geldopname', 'pinautomaat', 'cash withdrawal'],
    accountCode: '1800',
    category: 'Privé opnames (Cash)',
  },
  {
    keywords: [
      'shell',
      'bp',
      'esso',
      'texaco',
      'total',
      'tango',
      'tinq',
      'fastned',
      'tesla supercharger',
      'yellowbrick',
      'avia',
      'lukoil'
    ],
    accountCode: '4310',
    category: 'Brandstofkosten',
  },
  {
    keywords: ['parkmobile', 'q-park', 'parkeren', 'parking'],
    accountCode: '4300',
    category: 'Parkeerkosten',
  },
  {
    keywords: [
      'albert heijn', 'ah to go', 'ah ',
      'jumbo',
      'lidl',
      'aldi',
      'plus supermarkt', 'plus ',
      'picnic',
      'sligro',
      'makro',
      'hanos',
      'dirk', 'dirk vd broek', 'dirk van den broek', 'dirk vdbroek', 'd. v.d. broek',
      'dekamarkt',
      'vomar',
      'hoogvliet',
      'coop',
      'spar',
      'poiesz',
      'nettorama',
      'boni',
      'jan linders',
      'crisp'
    ],
    accountCode: '4700',
    category: 'Kantoorbenodigdheden (Kantine/Inkopen)',
  },
  {
    keywords: [
      'kruidvat',
      'etos',
      'trekpleister',
      'da drogist'
    ],
    accountCode: '4700',
    category: 'Kantoorbenodigdheden (Drogisterij)',
  },
  {
    keywords: [
      'hema',
      'action',
      'blokker',
      'bruna',
      'primera',
      'the read shop',
      '123inkt',
      'viking',
      'staples',
      'office centre'
    ],
    accountCode: '4700',
    category: 'Kantoorbenodigdheden (Kantoorartikelen)',
  },
  {
    keywords: [
      'gamma',
      'praxis',
      'karwei',
      'hornbach',
      'hubo',
      'kluswijs'
    ],
    accountCode: '4700',
    category: 'Kantoorbenodigdheden (Bouwmarkt)',
  },
  {
    keywords: ['kpn', 'ziggo', 'vodafone', 't-mobile', 'odido'],
    accountCode: '4220',
    category: 'Telefoon en internet',
  },
  {
    keywords: ['google ireland', 'google workspace', 'google ads', 'google cloud', 'microsoft 365', 'microsoft azure', 'adobe', 'apple.com/bill', 'dropbox', 'zoom', 'slack'],
    accountCode: '4210',
    category: 'Software en abonnementen',
  },
  {
    keywords: ['moneybird', 'exact', 'twinfield', 'afas'],
    accountCode: '4210',
    category: 'Boekhoudprogramma',
  },
  {
    keywords: ['interpolis', 'centraal beheer', 'unive', 'achmea', 'nationale nederlanden', 'nn ', 'asr verzekeringen'],
    accountCode: '4600',
    category: 'Verzekeringen',
  },
  {
    keywords: ['rabobank', 'ing bank', 'abn amro', 'knab', 'bunq', 'transactiekosten', 'rente'],
    accountCode: '4900',
    category: 'Bankkosten',
  },
  {
    keywords: ['ns ', 'ns groep', 'connexxion', 'uber ', 'bolt ', 'schiphol', 'klm', 'transavia', 'ryanair', 'easyjet'],
    accountCode: '4300',
    category: 'Reiskosten zakelijk',
  },
  {
    keywords: ['thuisbezorgd', 'uber eats', 'deliveroo', 'mcdonalds', "mcdonald's", 'burger king', 'kfc', 'subway', 'dominos', 'new york pizza'],
    accountCode: '4700',
    category: 'Kantoorbenodigdheden (Maaltijden)',
  },
  {
    keywords: ['loetje', 'van der valk', 'la place', 'starbucks', 'restaurant ', 'brasserie', 'cafe ', 'grand cafe'],
    accountCode: '4360',
    category: 'Representatiekosten',
  },
  {
    keywords: ['kwikfit', 'kwik-fit', 'carglass', 'euromaster', 'profile tyrecenter', 'profile tyre'],
    accountCode: '4310',
    category: 'Autokosten (Onderhoud)',
  },
  {
    keywords: ['van mossel', 'stern', 'louwman', 'broekhuis', 'hedin', 'garage ', 'dealer ', 'apk keuring', 'rdw'],
    accountCode: '4310',
    category: 'Autokosten (Onderhoud/Keuring)',
  },
  {
    keywords: ['bmw ', 'audi ', 'mercedes', 'volkswagen', 'toyota ', 'peugeot', 'renault'],
    accountCode: '4310',
    category: 'Autokosten',
  },
];

/**
 * ═══════════════════════════════════════════════════════════════
 * STEP 1: GET CLEAN INPUT TEXT (Counterparty First!)
 * ═══════════════════════════════════════════════════════════════
 */
function getCleanInputText(transaction: any): string {
  const contraName = (transaction.contra_name || '').trim();
  const description = (transaction.description || '').trim();

  let selectedString: string;
  let source: 'contra_name' | 'description';

  // Priority 1: Use contra_name if meaningful (> 2 chars)
  if (contraName.length > 2) {
    selectedString = contraName;
    source = 'contra_name';
    console.log(`✓ [INPUT] Using contra_name: "${contraName}"`);
  } else {
    // Priority 2: Fallback to description
    selectedString = description;
    source = 'description';
    if (contraName.length > 0) {
      console.log(`⚠ [INPUT] contra_name too short, using description`);
    } else {
      console.log(`⚠ [INPUT] No contra_name, using description`);
    }
  }

  // ALWAYS clean noise (Apple Pay, Pasnr, etc.)
  const cleaned = cleanTransactionDescription(selectedString);

  if (cleaned !== selectedString) {
    console.log(`🧹 [CLEAN] "${selectedString}" -> "${cleaned}"`);
  }

  console.log(`→ [FINAL] Using ${source}: "${cleaned}"`);
  return cleaned;
}

/**
 * Extract city name from transaction description for location context
 */
function extractCityFromDescription(description: string): string | undefined {
  // Common Dutch cities (ordered by size for better matching)
  const dutchCities = [
    'amsterdam', 'rotterdam', 'den haag', 'utrecht', 'eindhoven',
    'groningen', 'tilburg', 'almere', 'breda', 'nijmegen',
    'apeldoorn', 'haarlem', 'arnhem', 'zaanstad', 'amersfoort',
    'den bosch', 's-hertogenbosch', 'hoofddorp', 'maastricht', 'leiden',
    'dordrecht', 'zoetermeer', 'zwolle', 'deventer', 'delft',
    'alkmaar', 'heerlen', 'venlo', 'leeuwarden', 'hilversum',
  ];

  const lowerDesc = description.toLowerCase();

  // Check for each city name in description
  for (const city of dutchCities) {
    // Use word boundary matching to avoid partial matches
    const regex = new RegExp(`\\b${city}\\b`, 'i');
    if (regex.test(lowerDesc)) {
      // Return with proper capitalization
      return city
        .split(/[\s-]/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    }
  }

  return undefined;
}

/**
 * ═══════════════════════════════════════════════════════════════
 * STEP 2: THE HARD MATCHER (Word Boundary Regex)
 * ═══════════════════════════════════════════════════════════════
 *
 * Test each keyword with word boundaries:
 * - \b ensures whole word match
 * - Case-insensitive (i flag)
 *
 * Examples:
 * - Regex: /\bBP\b/i matches "BP Station" ✓
 * - Regex: /\bBP\b/i does NOT match "BPost" ✗
 */
function testKeywordMatch(text: string, keyword: string): boolean {
  // Escape special regex characters
  const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Create regex with word boundaries
  const regex = new RegExp(`\\b${escapedKeyword}\\b`, 'i');

  return regex.test(text);
}

/**
 * ═══════════════════════════════════════════════════════════════
 * STEP 3: CHECK USER RULES (Priority: Highest)
 * ═══════════════════════════════════════════════════════════════
 */
async function checkUserRules(cleanText: string): Promise<ConfidenceScore | null> {
  try {
    const { data: rules } = await supabase
      .from('bank_rules')
      .select('*, accounts(id, code, name), contacts(id, company_name)')
      .eq('is_active', true);

    if (!rules || rules.length === 0) {
      console.log(`→ [USER RULES] No active rules found`);
      return null;
    }

    console.log(`→ [USER RULES] Testing ${rules.length} rules...`);

    for (const rule of rules) {
      const keyword = rule.keyword.trim();

      if (testKeywordMatch(cleanText, keyword)) {
        console.log(`✓ [MATCH!] User Rule: "${keyword}" -> ${rule.accounts?.code} ${rule.accounts?.name}`);

        return {
          score: 100, // BULLDOZER: 100% confidence!
          reason: `User Rule Match: "${keyword}"`,
          source: 'bank_rule',
          suggestion: {
            mode: rule.contact_id ? 'relation' : 'direct',
            accountId: rule.target_ledger_account_id || undefined,
            contactId: rule.contact_id || undefined,
            description: `Matched rule: ${keyword}`,
          },
        };
      }
    }

    console.log(`→ [USER RULES] No match`);
    return null;
  } catch (error) {
    console.error('[ERROR] User rules check failed:', error);
    return null;
  }
}

/**
 * ═══════════════════════════════════════════════════════════════
 * STEP 4: CRM/RELATION SCANNER with AI Fallback
 * ═══════════════════════════════════════════════════════════════
 *
 * This step checks if the counterparty exists in the user's Relations.
 * If found, it forces "Invoice Route" mode, but uses AI to determine
 * the Ledger Account if one isn't pre-set.
 *
 * LOGIC:
 * 1. Fuzzy search in relations table for counterparty match
 * 2. If match found:
 *    - Force mode = 'relation'
 *    - Check if relation has default_ledger_account_id:
 *      - YES: Use it (100% confidence)
 *      - NO: Call AI (Tavily) to determine account
 * 3. If no match found: Continue to Hardcoded Defaults
 */
async function checkCRMRelation(cleanText: string, transaction: any): Promise<ConfidenceScore | null> {
  try {
    console.log(`→ [CRM SCAN] Searching for relation: "${cleanText}"`);

    // Query all active relations
    const { data: relations, error } = await supabase
      .from('contacts')
      .select('id, company_name, relation_type, default_ledger_account_id')
      .eq('is_active', true);

    if (error || !relations || relations.length === 0) {
      console.log(`→ [CRM SCAN] No active relations found`);
      return null;
    }

    // Fuzzy match: case-insensitive contains
    const matchedRelation = relations.find(rel => {
      const companyName = rel.company_name.toLowerCase();
      const searchText = cleanText.toLowerCase();

      // Match if company name contains search text or vice versa
      return companyName.includes(searchText) || searchText.includes(companyName);
    });

    if (!matchedRelation) {
      console.log(`→ [CRM SCAN] No matching relation found`);
      return null;
    }

    console.log(`✓ [CRM MATCH!] Found relation: ${matchedRelation.company_name} (${matchedRelation.relation_type})`);

    // Check if relation has default ledger account
    if (matchedRelation.default_ledger_account_id) {
      // SCENARIO A: Relation has default account set
      const { data: account } = await supabase
        .from('accounts')
        .select('id, code, name')
        .eq('id', matchedRelation.default_ledger_account_id)
        .maybeSingle();

      if (account) {
        console.log(`✓ [CRM] Using relation's default account: ${account.code} ${account.name}`);

        return {
          score: 100,
          reason: `CRM Match: ${matchedRelation.company_name} with default account`,
          source: 'bank_rule',
          suggestion: {
            mode: 'relation',
            accountId: account.id,
            contactId: matchedRelation.id,
            description: `${matchedRelation.company_name}`,
          },
        };
      }
    }

    // SCENARIO B: Relation found but NO default account - Use AI
    console.log(`→ [CRM] No default account, calling AI for classification...`);

    // Extract city from description for location context
    const cityName = extractCityFromDescription(transaction.description || '');

    // Build enrichment context with location data
    const enrichmentContext: EnrichmentContext = {
      name: cleanText,
      city: cityName || undefined,
      address: undefined,
      categoryClues: undefined,
    };

    if (cityName) {
      console.log(`  📍 [CONTEXT] Extracted city for AI: ${cityName}`);
    }

    const aiEnrichment = await enrichTransactionWithTavily(enrichmentContext, Math.abs(transaction.amount));

    if (aiEnrichment && aiEnrichment.accountId) {
      console.log(`✓ [CRM + AI] Matched relation with AI account suggestion`);

      return {
        score: 100,
        reason: `CRM Match: ${matchedRelation.company_name} (AI categorized: ${aiEnrichment.reason})`,
        source: 'bank_rule',
        suggestion: {
          mode: 'relation',
          accountId: aiEnrichment.accountId,
          contactId: matchedRelation.id,
          description: `${matchedRelation.company_name}`,
        },
        debug_info: aiEnrichment.debug_info,
      };
    }

    // AI failed but we still have the relation - return without account
    console.log(`⚠ [CRM] Relation found but AI failed to categorize`);
    return {
      score: 100,
      reason: `CRM Match: ${matchedRelation.company_name} (account needs manual selection)`,
      source: 'bank_rule',
      suggestion: {
        mode: 'relation',
        accountId: undefined,
        contactId: matchedRelation.id,
        description: `${matchedRelation.company_name}`,
      },
    };

  } catch (error) {
    console.error('[ERROR] CRM scan failed:', error);
    return null;
  }
}

/**
 * ═══════════════════════════════════════════════════════════════
 * STEP 5: CHECK HARDCODED DEFAULTS (Shell, BP, etc.)
 * ═══════════════════════════════════════════════════════════════
 */
async function checkHardcodedDefaults(cleanText: string): Promise<ConfidenceScore | null> {
  console.log(`→ [DEFAULTS] Testing ${HARDCODED_VENDORS.length} vendor patterns...`);

  for (const vendor of HARDCODED_VENDORS) {
    for (const keyword of vendor.keywords) {
      if (testKeywordMatch(cleanText, keyword)) {
        // Get account from database
        const { data: account } = await supabase
          .from('accounts')
          .select('id, code, name')
          .eq('code', vendor.accountCode)
          .maybeSingle();

        if (!account) {
          console.log(`⚠ [DEFAULTS] Keyword "${keyword}" matched but account ${vendor.accountCode} not found`);
          continue;
        }

        console.log(`✓ [MATCH!] Default: "${keyword}" -> ${account.code} ${account.name}`);

        return {
          score: 100, // BULLDOZER: 100% confidence!
          reason: `Default Match: ${vendor.category}`,
          source: 'vendor_map',
          suggestion: {
            mode: 'direct',
            accountId: account.id,
            description: vendor.category,
          },
        };
      }
    }
  }

  console.log(`→ [DEFAULTS] No match`);
  return null;
}

/**
 * ═══════════════════════════════════════════════════════════════
 * STEP 6: CHECK INVOICE MATCH (Exact amount + date)
 * ═══════════════════════════════════════════════════════════════
 */
async function checkInvoiceMatch(transaction: any): Promise<ConfidenceScore | null> {
  try {
    const amount = Math.abs(transaction.amount);
    const isExpense = transaction.amount < 0;

    // Search in purchase invoices (for expenses)
    if (isExpense) {
      const { data: invoice } = await supabase
        .from('purchase_invoices')
        .select('*, contact:contacts(*)')
        .eq('total_amount', amount)
        .gte('invoice_date', new Date(transaction.transaction_date).toISOString().split('T')[0])
        .lte('invoice_date', new Date(new Date(transaction.transaction_date).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .in('status', ['Pending', 'Overdue'])
        .maybeSingle();

      if (invoice && invoice.contact) {
        console.log(`✓ [MATCH!] Invoice: ${invoice.invoice_number}`);

        return {
          score: 100,
          reason: `Invoice Match: ${invoice.invoice_number}`,
          source: 'invoice_match',
          suggestion: {
            mode: 'relation',
            accountId: invoice.contact.default_ledger_account,
            contactId: invoice.contact.id,
            description: `Payment invoice ${invoice.invoice_number}`,
          },
        };
      }
    }

    // Search in sales invoices (for income)
    if (!isExpense) {
      const { data: invoice } = await supabase
        .from('invoices')
        .select('*, contact:contacts(*)')
        .eq('total_amount', amount)
        .gte('invoice_date', new Date(transaction.transaction_date).toISOString().split('T')[0])
        .lte('invoice_date', new Date(new Date(transaction.transaction_date).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .eq('status', 'Sent')
        .maybeSingle();

      if (invoice && invoice.contact) {
        console.log(`✓ [MATCH!] Invoice: ${invoice.invoice_number}`);

        return {
          score: 100,
          reason: `Invoice Match: ${invoice.invoice_number}`,
          source: 'invoice_match',
          suggestion: {
            mode: 'relation',
            accountId: invoice.contact.default_ledger_account,
            contactId: invoice.contact.id,
            description: `Payment invoice ${invoice.invoice_number}`,
          },
        };
      }
    }

    return null;
  } catch (error) {
    console.error('[ERROR] Invoice match check failed:', error);
    return null;
  }
}

/**
 * ═══════════════════════════════════════════════════════════════
 * STEP 7: TAVILY FALLBACK (Only if nothing else matches)
 * ═══════════════════════════════════════════════════════════════
 */
async function checkTavilyEnrichment(cleanText: string, transaction: any): Promise<ConfidenceScore | null> {
  console.log(`→ [TAVILY] Searching for: "${cleanText}" (€${Math.abs(transaction.amount)})`);

  try {
    // Extract city from description for location context
    const cityName = extractCityFromDescription(transaction.description || '');

    // Build enrichment context with location data
    const enrichmentContext: EnrichmentContext = {
      name: cleanText,
      city: cityName || undefined,
      address: undefined, // Not available in bank transaction data
      categoryClues: undefined,
    };

    if (cityName) {
      console.log(`  📍 [CONTEXT] Extracted city: ${cityName}`);
    }

    const enrichment = await enrichTransactionWithTavily(enrichmentContext, Math.abs(transaction.amount));

    if (!enrichment) {
      console.log(`→ [TAVILY] No match found - enrichment returned null`);
      return null;
    }

    console.log(`→ [TAVILY] Enrichment result:`, {
      confidence: enrichment.confidence,
      accountId: enrichment.accountId,
      reason: enrichment.reason,
      hasDebugInfo: !!enrichment.debug_info,
    });

    // Accept suggestions with confidence >= 70% (was 80%)
    // This allows more suggestions to appear for manual review
    if (enrichment.confidence >= 70) {
      console.log(`✓ [MATCH!] Tavily: ${enrichment.reason} (${enrichment.confidence}% confidence)`);

      // Ensure accountId is valid
      if (!enrichment.accountId) {
        console.log(`⚠ [TAVILY] Match found but no accountId provided`);
        return null;
      }

      return {
        score: enrichment.confidence,
        reason: `Tavily: ${enrichment.reason}`,
        source: 'tavily_enrichment',
        suggestion: {
          mode: enrichment.contactId ? 'relation' : 'direct',
          accountId: enrichment.accountId,
          contactId: enrichment.contactId,
          description: cleanText,
        },
        debug_info: enrichment.debug_info,
      };
    }

    console.log(`→ [TAVILY] Match found but confidence too low (${enrichment.confidence}%)`);
    return null;

  } catch (error) {
    console.error('❌ [TAVILY] Enrichment failed with error:');
    console.error('Error type:', error instanceof Error ? error.constructor.name : typeof error);
    console.error('Error message:', error instanceof Error ? error.message : String(error));
    console.error('Full error:', error);

    // Store error in debug info for UI visibility
    return {
      score: 0,
      reason: `Tavily error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      source: 'manual',
      suggestion: {
        mode: 'direct',
        accountId: undefined,
        description: cleanText,
      },
      debug_info: {
        clean_search_term: cleanText,
        tavily_output: 'ERROR',
        ai_reasoning: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

/**
 * ═══════════════════════════════════════════════════════════════
 * MAIN ANALYZER: Run all matchers in order
 * ═══════════════════════════════════════════════════════════════
 */
export async function analyzeTransaction(transaction: any): Promise<ConfidenceScore> {
  console.log('\n' + '═'.repeat(60));
  console.log(`🔍 ANALYZING: ${transaction.description.substring(0, 50)}...`);
  console.log('═'.repeat(60));

  try {
    // STEP 1: Get clean input text (prioritize contra_name)
    const cleanText = getCleanInputText(transaction);

    // STEP 2: Check invoice match first
    const invoiceMatch = await checkInvoiceMatch(transaction);
    if (invoiceMatch) {
      console.log(`✅ RESULT: Invoice Match (100%)`);
      return invoiceMatch;
    }

    // STEP 3: Check user rules (HIGHEST PRIORITY for keywords)
    const userRuleMatch = await checkUserRules(cleanText);
    if (userRuleMatch) {
      console.log(`✅ RESULT: User Rule (100%)`);
      return userRuleMatch;
    }

    // STEP 4: CRM/Relation Scanner with AI Fallback
    const crmMatch = await checkCRMRelation(cleanText, transaction);
    if (crmMatch) {
      console.log(`✅ RESULT: CRM Match (100%)`);
      return crmMatch;
    }

    // STEP 5: Check hardcoded defaults (Shell, BP, etc.)
    const defaultMatch = await checkHardcodedDefaults(cleanText);
    if (defaultMatch) {
      console.log(`✅ RESULT: Default Vendor (100%)`);
      return defaultMatch;
    }

    // STEP 6: Tavily fallback (only if nothing else matches)
    const tavilyMatch = await checkTavilyEnrichment(cleanText, transaction);
    if (tavilyMatch) {
      console.log(`✅ RESULT: Tavily Enrichment (${tavilyMatch.score}%)`);
      return tavilyMatch;
    }

    // NO MATCH: Manual review required
    console.log(`⚠ RESULT: No Match - Manual Review Required`);
    return {
      score: 0,
      reason: 'No match found - manual review required',
      source: 'manual',
      suggestion: {
        mode: 'direct',
        accountId: undefined,
        description: transaction.description,
      },
    };

  } catch (error) {
    console.error('[ERROR] Analysis failed:', error);
    return {
      score: 0,
      reason: 'Analysis error',
      source: 'manual',
      suggestion: {
        mode: 'direct',
        accountId: undefined,
        description: transaction.description,
      },
    };
  }
}

/**
 * ═══════════════════════════════════════════════════════════════
 * AUTO-BOOKING: Execute if score = 100
 * ═══════════════════════════════════════════════════════════════
 */
export async function autoBookTransaction(
  transaction: any,
  confidence: ConfidenceScore
): Promise<AutoBookingResult> {
  try {
    // Auto-book if score is 70% or higher
    if (confidence.score < 70) {
      console.log(`⚠ Score ${confidence.score}% < 70% - Needs review`);
      return {
        transactionId: transaction.id,
        status: 'needs_review',
        confidence,
      };
    }

    const { mode, accountId, contactId, description } = confidence.suggestion;

    // Validate required fields
    if (!accountId) {
      throw new Error('Account ID is required for auto-booking');
    }

    console.log(`🚀 AUTO-BOOKING: Mode=${mode}, Account=${accountId}`);

    // Execute booking
    if (mode === 'direct') {
      const result = await bookBankTransaction(transaction.id, accountId, description);
      if (!result.success) {
        throw new Error(result.error || 'Failed to book transaction');
      }
    } else {
      if (!contactId) {
        throw new Error('Contact ID is required for relation mode');
      }
      const result = await bookBankTransactionViaRelatie(
        transaction.id,
        contactId,
        accountId,
        description
      );
      if (!result.success) {
        throw new Error(result.error || 'Failed to book transaction');
      }
    }

    // Mark as auto-booked
    await supabase
      .from('bank_transactions')
      .update({
        auto_booked: true,
        confidence_score: confidence.score,
        ai_suggestion: JSON.stringify(confidence),
      })
      .eq('id', transaction.id);

    console.log(`✅ AUTO-BOOKED successfully`);

    return {
      transactionId: transaction.id,
      status: 'auto_booked',
      confidence,
    };
  } catch (error) {
    console.error('[ERROR] Auto-booking failed:', error);
    return {
      transactionId: transaction.id,
      status: 'error',
      confidence,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * ═══════════════════════════════════════════════════════════════
 * BATCH PROCESSING: Process multiple transactions
 * ═══════════════════════════════════════════════════════════════
 */
export async function analyzeAndBookTransactions(
  transactionIds: string[],
  onProgress?: (completed: number, total: number, errors: number) => void
): Promise<ImportAnalysisReport> {
  const report: ImportAnalysisReport = {
    totalProcessed: 0,
    autoBooked: 0,
    autoBookedDirect: 0,
    autoBookedRelation: 0,
    needsReview: 0,
    errors: 0,
    details: [],
  };

  console.log(`🚀 Batch processing: ${transactionIds.length} transactions`);

  const tasks = transactionIds.map((transactionId) => async () => {
    try {
      const { data: transaction, error } = await supabase
        .from('bank_transactions')
        .select('*')
        .eq('id', transactionId)
        .single();

      if (error || !transaction) {
        return { status: 'error' as const, transactionId };
      }

      // Skip already processed
      if (transaction.status !== 'Unmatched') {
        return { status: 'skipped' as const, transactionId };
      }

      // Analyze
      const confidence = await analyzeTransaction(transaction);

      // Auto-book
      const result = await autoBookTransaction(transaction, confidence);

      // Store suggestion for review if needed
      if (result.status === 'needs_review') {
        await supabase
          .from('bank_transactions')
          .update({
            ai_suggestion: JSON.stringify(confidence),
            confidence_score: confidence.score,
          })
          .eq('id', transactionId);
      }

      return { ...result, confidence };
    } catch (error) {
      console.error('[ERROR] Processing transaction:', error);
      return {
        status: 'error' as const,
        transactionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // Process with limited concurrency (max 5 at a time)
  const results = await limitConcurrencyWithErrorHandling(
    tasks,
    5,
    (completed, total, errors) => {
      console.log(`📊 Progress: ${completed}/${total} (${errors} errors)`);
      if (onProgress) {
        onProgress(completed, total, errors);
      }
    }
  );

  // Compile report
  for (const result of results) {
    if (!result.success) {
      report.errors++;
      continue;
    }

    const data = result.data;

    if (data.status === 'skipped') {
      continue;
    }

    if (data.status === 'error') {
      report.errors++;
      continue;
    }

    report.totalProcessed++;
    report.details.push(data as AutoBookingResult);

    if (data.status === 'auto_booked') {
      report.autoBooked++;
      if (data.confidence?.suggestion.mode === 'direct') {
        report.autoBookedDirect++;
      } else {
        report.autoBookedRelation++;
      }
    } else if (data.status === 'needs_review') {
      report.needsReview++;
    }
  }

  console.log(`✅ Batch complete:`, {
    totalProcessed: report.totalProcessed,
    autoBooked: report.autoBooked,
    needsReview: report.needsReview,
    errors: report.errors,
  });

  return report;
}

/**
 * ═══════════════════════════════════════════════════════════════
 * SELF-LEARNING: Create/update rule from user action
 * ═══════════════════════════════════════════════════════════════
 */
export async function learnFromUserAction(
  transaction: any,
  mode: 'direct' | 'relation',
  accountId: string,
  contactId?: string
): Promise<void> {
  try {
    // Extract pattern (prioritize contra_name)
    const pattern = transaction.contra_name && transaction.contra_name.length > 3
      ? transaction.contra_name.trim()
      : null;

    if (!pattern) {
      console.log(`⚠ Cannot learn: No meaningful pattern found`);
      return;
    }

    // Check if rule exists
    const { data: existingRule } = await supabase
      .from('bank_rules')
      .select('*')
      .ilike('keyword', pattern)
      .maybeSingle();

    if (existingRule) {
      // Update existing rule
      await supabase
        .from('bank_rules')
        .update({
          target_ledger_account_id: accountId,
          contact_id: contactId || null,
          use_count: (existingRule.use_count || 0) + 1,
          last_used: new Date().toISOString(),
        })
        .eq('id', existingRule.id);

      console.log(`✓ Updated rule: "${pattern}"`);
    } else {
      // Create new rule
      await supabase
        .from('bank_rules')
        .insert({
          keyword: pattern,
          target_ledger_account_id: accountId,
          contact_id: contactId || null,
          match_type: 'Contains',
          is_active: true,
          use_count: 1,
          created_at: new Date().toISOString(),
        });

      console.log(`✓ Created rule: "${pattern}"`);
    }
  } catch (error) {
    console.error('[ERROR] Learning failed:', error);
  }
}
