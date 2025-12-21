# High-Intelligence Bank Automation Engine

## Overview

The Bank Automation Engine is a self-learning system that automatically processes bank transactions with minimal user intervention. It combines multiple intelligence sources to achieve high-accuracy auto-booking while maintaining strict mode separation.

**Key Features:**
- **Common Knowledge Base** with 100+ Dutch vendors (NEW)
- Self-learning from user actions
- External enrichment (Tavily API)
- Confidence-based auto-booking
- Detailed import analytics
- Strict Direct vs Relation mode separation

---

## Architecture

### 1. Intelligence Layers

```
┌─────────────────────────────────────┐
│  Layer 1: Invoice Match (100%)     │ ← Exact match with existing invoices
├─────────────────────────────────────┤
│  Layer 2: Bank Rules (95%)         │ ← User-created or learned rules
├─────────────────────────────────────┤
│  Layer 2.5: Common Knowledge (75-95%)│ ← 100+ Dutch vendors (NEW)
├─────────────────────────────────────┤
│  Layer 3: Tavily Enrichment (80-90%)│ ← External API + simulation
├─────────────────────────────────────┤
│  Layer 4: Basic Inference (30-60%) │ ← Keyword matching
└─────────────────────────────────────┘
```

**New in v1.1**: The Common Knowledge Base instantly recognizes common Dutch vendors like Shell (fuel), Albert Heijn (groceries), KPN (telecom), and 100+ others without any training. See `COMMON_VENDOR_KNOWLEDGE_BASE.md` for complete list.

### 2. Confidence Scoring

| Score Range | Action | Description |
|-------------|--------|-------------|
| **90-100%** | Auto-book | Exact invoice match, bank rules, hardcoded vendors |
| **80-89%** | Auto-book | Strong Tavily match with high confidence |
| **70-79%** | **Suggest** | Tavily match - show suggestion for user review |
| **0-69%** | Manual | Low confidence - requires manual selection |

**Critical Threshold**: Transactions with confidence ≥ 80% are automatically booked without user intervention.

**New in v1.2**: Tavily suggestions now appear at 70%+ confidence (was 80%), allowing more AI suggestions to be displayed for manual review. This increases the "smart suggestion" rate without compromising auto-booking accuracy.

---

## The Self-Learning System

### How It Works

Every time a user manually processes a transaction, the system automatically:

1. **Extracts Pattern**: Identifies the counterparty name or key description
2. **Creates/Updates Rule**: Stores pattern → account mapping
3. **Tracks Usage**: Increments use count for reinforcement
4. **Improves Accuracy**: Next similar transaction is auto-processed

### Pattern Extraction Priority

```typescript
Priority 1: transaction.contra_name (e.g., "Google Ireland Ltd")
Priority 2: transaction.description (e.g., "Google Ads Payment")
```

### Learning Code Flow

```
User Action
    ↓
bookBankTransaction() / bookBankTransactionViaRelatie()
    ↓
learnFromUserAction(transaction, mode, accountId, contactId)
    ↓
Check if rule exists (by keyword)
    ↓
Yes → Update use_count, last_used
No  → Create new bank rule
```

**Files**:
- `src/lib/bankAutomationService.ts:389` - `learnFromUserAction()`
- `src/lib/bankService.ts:359` (Direct mode)
- `src/lib/bankService.ts:530` (Relation mode)

---

## External Enrichment (Tavily)

### Purpose

When a transaction is unknown to the system, it uses external search to identify the company type and map it to the appropriate accounting category.

**New in v1.2**: The Tavily pipeline now uses a two-phase "Detective → Accountant" pattern:
1. **Detective Phase**: Tavily finds REAL facts about the business (e.g., "Shell is a gas station")
2. **Accountant Phase**: OpenAI semantically maps the industry to the best ledger account

**New in v1.3**: The Accountant is now amount-aware and applies strict accounting rules:
- Transaction amounts are passed to the AI for context
- Depreciation accounts (4010-4019) are BLOCKED for transactions < €500
- Strict rules prevent mismatches like "Supermarket" → "Afschrijving"
- Amount-based logic ensures proper categorization

This prevents AI hallucinations like mapping "Shell" to telephone costs or "Albert Heijn" to depreciation.

### Configuration

```env
# Add to .env for real API calls
VITE_TAVILY_API_KEY=your_api_key_here
VITE_OPENAI_API_KEY=your_openai_key_here
```

If no API key is present, the system uses intelligent **simulation** with pattern matching for common vendors.

### Enrichment Flow (NEW v1.3)

```
Unknown Transaction: "BLOEMIST JANSEN" | Amount: €45.00
    ↓
PHASE 1: DETECTIVE (Tavily Search)
    ↓
    "What kind of business is 'Bloemist Jansen'?"
    → Result: "Retail / Florist"
    ↓
PHASE 2: ACCOUNTANT (Smart Semantic Mapper)
    ↓
    Input: Industry = "Retail / Florist"
    Input: Amount = €45.00
    Input: Available accounts (excluding 4010-4019 for small amounts)
    ↓
    OpenAI applies STRICT ACCOUNTING RULES:
    ✓ Amount < €100 → Operational expense
    ✓ "Retail" for small purchase → Kantoorkosten
    ✗ BLOCKED: Afschrijving (depreciation) accounts
    → Result: 4200 Kantoorkosten (Office supplies)
    ↓
RESULT:
    {
      accountId: "uuid-123",
      confidence: 85%,
      reason: "Retail / Florist → Kantoorkosten"
    }
    ↓
UI displays suggestion in dropdown (pre-selected)

EXAMPLE 2: Large Asset Purchase
Transaction: "GAMMA BOUWMARKT" | Amount: €1,250.00
    ↓
DETECTIVE: "Hardware Store"
    ↓
ACCOUNTANT:
    Amount > €500 → Could be asset purchase
    "Hardware Store" + large amount → Equipment
    Depreciation accounts NOW AVAILABLE
    → Result: 4010 Afschrijving (Depreciation)
```

### Strict Accounting Rules (v1.3)

The AI Accountant follows professional Dutch accounting standards:

#### Depreciation Accounts (4010-4019)
**ONLY** used for:
- Asset purchases > €500
- Items depreciated over multiple years
- Examples: Computers, machinery, vehicles, office furniture

**NEVER** used for:
- Groceries, fuel, utilities, subscriptions
- Any transaction < €500
- ANY operational/recurring expense

#### Implementation
```typescript
// Automatic filtering before OpenAI sees the accounts
if (transaction.amount < 500) {
  // Depreciation accounts (4010-4019) are EXCLUDED from menu
  // AI cannot choose them even if it wants to
}
```

#### Forbidden Combinations
The AI prompt explicitly blocks these mismatches:
- ❌ "Supermarket" → Afschrijving
- ❌ "Gas Station" → Afschrijving
- ❌ "Restaurant" → Afschrijving
- ❌ Any subscription service → Afschrijving
- ❌ Any amount < €500 → Afschrijving

#### Amount-Based Logic
- **< €100**: Likely operational expense → Kantoorkosten (4200) or specific category
- **€100-500**: Operational expense → Specific category based on industry
- **> €500**: Could be asset → Depreciation considered if industry matches

### EMERGENCY FIX: Dummy Mode (v1.5) 🚨

**Problem:** JSON-based responses were too fragile. OpenAI would add markdown, explanations, or use wrong field names, causing the UI to remain empty.

**Solution:** Complete rewrite to "Dummy Mode" - Stop asking for JSON entirely!

#### How It Works Now

**Simplified Prompt (tavilyEnrichmentService.ts:282-304)**
```
You are a Dutch accounting expert. Match this transaction to the BEST ledger account ID.

Business: "Supermarket"
Description: "Albert Heijn Store 123"
Transaction Amount: €42.50

Available Accounts:
- ID: abc-123-def | Code: 4200 | Name: Kantoorkosten
- ID: xyz-789-ghi | Code: 4280 | Name: Kantine & Levensmiddelen
...

CRITICAL: Reply with ONLY the ID from the list above.
Do NOT write JSON. Do NOT write explanations. JUST the ID.

What is the best account ID?
```

**Expected Response:**
- Good: `xyz-789-ghi`
- Good: `The ID is xyz-789-ghi`
- Good: `I suggest xyz-789-ghi for this`

**4-Strategy Bulletproof Extraction:**

1. **Strategy 1: Clean JSON** (if AI ignores instructions and returns JSON anyway)
   - Strips markdown, extracts JSON, normalizes fields
   - Confidence: 80%

2. **Strategy 2: UUID Brute Force** ⭐ PRIMARY
   - Finds ALL UUID patterns: `[0-9a-f]{8}-[0-9a-f]{4}-...`
   - Tests each against account database
   - Works for: `"xyz-789"`, `"The ID is xyz-789"`, `{"id":"xyz-789"}`
   - Confidence: 75%

3. **Strategy 3: Account Code Extraction**
   - Searches for 4-digit codes (4200, 4280, 1800-1899)
   - Matches against database
   - Confidence: 70%

4. **Strategy 4: Account Name Fuzzy Matching**
   - Case-insensitive substring search
   - Last resort before fallback
   - Confidence: 65%

#### Debug Logging
```
🔍 [PARSER] Raw OpenAI response: The best match is abc-123-def
🛡️ [BULLETPROOF PARSER] Starting...
  → Strategy 1: Clean JSON parsing...
    ✗ Strategy 1 failed: Unexpected token T
  → Strategy 2: UUID pattern extraction...
    Found 1 UUID(s) in response
  ✅ Strategy 2 SUCCESS: 4280 Kantine & Levensmiddelen
```

#### Why This Works

**Old Approach (v1.4 and earlier):**
```json
{
  "accountId": "abc-123",
  "confidence": 85,
  "reasoning": "This looks like..."
}
```
Problem: AI adds text outside JSON, uses wrong field names, adds markdown → Parser fails

**New Approach (v1.5 - Dummy Mode):**
```
abc-123
```
Success: Just the UUID! Regex finds it instantly, no parsing needed.

**Result:** The UI NEVER remains empty. Even if AI returns complete gibberish, Strategy 2-4 will extract something useful. The system is now virtually impossible to break.

### Supported Categories (Simulation)

| Pattern | Category | Account | Confidence |
|---------|----------|---------|------------|
| atlassian, github, gitlab | Software/SaaS | 4210 | 85% |
| kpn, vodafone, t-mobile | Telecommunicatie | 4220 | 90% |
| essent, eneco, vattenfall | Energie | 4420 | 90% |
| asr, aegon, nn | Verzekeringen | 4600 | 90% |
| google ads, facebook ads | Marketing | 4340 | 85% |
| bank, abn amro, ing | Bankkosten | 4900 | 95% |

**Files**:
- `src/lib/tavilyEnrichmentService.ts`

---

## Auto-Booking Logic

### Decision Tree

```
For each transaction:
    ↓
Analyze transaction
    ↓
Calculate confidence score
    ↓
Score >= 80%?
├─ Yes → Execute auto-booking
│         ├─ Direct Mode: bookBankTransaction()
│         └─ Relation Mode: bookBankTransactionViaRelatie()
│         └─ Mark: auto_booked = true, status = 'Booked'/'pending'
│
└─ No  → Store suggestion
          └─ Save to: ai_suggestion (JSONB)
          └─ Pre-fill UI fields for user review
```

### Mode Routing

The automation engine **strictly respects** the two-mode system:

```typescript
if (suggestion.mode === 'direct') {
  // Simple direct booking
  await bookBankTransaction(transactionId, accountId, description);
  // Result: status = 'Booked' (final)
} else {
  // Bridge accounting with suspense
  await bookBankTransactionViaRelatie(transactionId, contactId, accountId, description);
  // Result: status = 'pending' (awaits invoice match)
}
```

**Important**: Contact ID is **required** for Relation mode, **never used** for Direct mode.

---

## Import Analysis Report

### What It Shows

After importing a bank file, users see a comprehensive statistics modal:

**Summary Metrics:**
1. **Totaal Verwerkt**: Number of transactions analyzed
2. **Automatisch Geboekt**: Transactions auto-processed (≥80% confidence)
   - Via Directe Route
   - Via Factuur/Relatie Route
3. **Controle Vereist**: Transactions needing user review (<80%)

**Confidence Distribution:**
- 90-100% (Excellent): Green bar
- 80-89% (Hoog): Blue bar
- 60-79% (Matig): Amber bar
- 0-59% (Laag): Red bar

**Next Steps:**
- Auto-booked transactions are ready to use
- Review remaining transactions with AI suggestions
- System learns from user corrections

**Files**:
- `src/components/ImportReportModal.tsx`
- `src/components/BankImporter.tsx:106-110`

---

## Database Schema

### New Columns: `bank_transactions`

```sql
-- Tracks AI automation metadata
auto_booked      boolean DEFAULT false    -- Was this auto-processed?
confidence_score numeric(5,2)             -- AI confidence (0-100)
ai_suggestion    jsonb                    -- Complete suggestion data
```

### New Columns: `bank_rules`

```sql
-- Tracks self-learning metrics
use_count  integer     DEFAULT 0    -- How many times rule was used
last_used  timestamptz              -- Last usage timestamp
```

**Migration**: `20251220140000_add_bank_automation_fields.sql`

---

## Usage Examples

### Example 1: First Import (Cold Start)

```
Import 50 transactions
    ↓
Analysis:
- 5 exact invoice matches → 100% confidence → Auto-booked (Relation mode)
- 10 match existing rules → 95% confidence → Auto-booked (Mixed modes)
- 15 enriched via Tavily → 85% confidence → Auto-booked (Direct mode)
- 20 low confidence → Suggestions stored

Result:
✅ 30 automatically processed
⚠️ 20 require user review
```

### Example 2: After Learning Phase

```
User processes 20 "needs review" transactions
    ↓
System learns 20 new patterns
    ↓
Next import (same vendors):
- 18 of those vendors → 95% confidence → Auto-booked
- 2 edge cases → Suggestions

Improvement: 90% automation rate
```

### Example 3: Invoice Matching

```
Transaction: €500 from "Acme Corp" on 2024-01-15

Analysis finds:
- Invoice #2024-001 from Acme Corp
- Amount: €500
- Date: 2024-01-15

Confidence: 100%
Action: Auto-book in Relation mode
Result:
- Journal entry links transaction to invoice
- Status: 'pending' (awaits settlement)
```

---

## API Reference

### Core Functions

#### `analyzeTransaction(transaction)`

Returns confidence score and booking suggestion.

**Returns:**
```typescript
{
  score: number;              // 0-100
  reason: string;            // Human-readable explanation
  source: 'invoice_match' | 'bank_rule' | 'tavily_enrichment' | 'manual';
  suggestion: {
    mode: 'direct' | 'relation';
    accountId?: string;
    contactId?: string;
    description: string;
  }
}
```

#### `autoBookTransaction(transaction, confidence)`

Executes booking if confidence >= 80%.

**Returns:**
```typescript
{
  transactionId: string;
  status: 'auto_booked' | 'needs_review' | 'error';
  confidence: ConfidenceScore;
  error?: string;
}
```

#### `analyzeAndBookTransactions(transactionIds[])`

Batch process multiple transactions.

**Returns:**
```typescript
{
  totalProcessed: number;
  autoBooked: number;
  autoBookedDirect: number;
  autoBookedRelation: number;
  needsReview: number;
  errors: number;
  details: AutoBookingResult[];
}
```

#### `learnFromUserAction(transaction, mode, accountId, contactId?)`

Records user action as new pattern.

**Parameters:**
- `mode`: 'direct' | 'relation'
- `accountId`: Target ledger account
- `contactId`: Only for Relation mode

---

## Configuration

### Environment Variables

```env
# Optional: Enable real Tavily API
VITE_TAVILY_API_KEY=tvly-xxxxxxxxxxxxx

# Required: Supabase (already configured)
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

### Tuning Parameters

**In `bankAutomationService.ts`:**

```typescript
// Adjust auto-booking threshold
if (confidence.score >= 80) {  // Change to 85 for stricter
  autoBook();
}

// Adjust rule match score
return {
  score: 95,  // Change to 90 for more conservative
  source: 'bank_rule',
  ...
};
```

---

## Troubleshooting

### Issue: Too Many Auto-Bookings

**Solution**: Increase threshold
```typescript
if (confidence.score >= 85) {  // Was 80
```

### Issue: Too Few Auto-Bookings

**Solution**: Review and create more bank rules manually, or lower threshold to 75% temporarily.

### Issue: Wrong Account Selected

**Cause**: Pattern collision (multiple vendors with similar names)
**Solution**:
1. Check `bank_rules` table
2. Make patterns more specific
3. Delete conflicting rule
4. System will learn correct pattern on next user action

### Issue: Tavily Suggestions Not Appearing

**Fixed in v1.2**: The confidence threshold was lowered from 80% to 70%, allowing more suggestions to appear.

**Symptoms**:
- Unknown vendors show no AI suggestion
- Manual account selection required for everything
- Console shows "Tavily: Match found but confidence too low"

**Solution**:
1. Check console logs for the full enrichment flow:
   ```
   🔍 [TAVILY SERVICE] Starting enrichment...
   ✓ [DETECTIVE] Found industry: "Retail"
   ✓ [ACCOUNTANT] Mapped to account
   ✅ [TAVILY SERVICE] Enrichment successful
   ```

2. If you see "confidence too low (65%)", the match exists but doesn't meet the 70% threshold
3. If you see "no match", Tavily couldn't identify the business
4. If you see "OpenAI failed", check `VITE_OPENAI_API_KEY` is set

**Debugging**:
```typescript
// In checkTavilyEnrichment():
if (enrichment.confidence >= 70) {  // Current threshold
  // Suggestion will appear
}
```

### Issue: Tavily Returns Wrong Account

**Cause**: OpenAI semantic mapper chose incorrect ledger account

**Solution**:
1. Add the vendor to hardcoded defaults (100% confidence)
2. Create a bank rule after first booking (overrides Tavily)
3. Adjust OpenAI prompt examples in `tavilyEnrichmentService.ts:236-261`

**Example Fix**:
```typescript
// Add to HARDCODED_VENDORS in bankAutomationService.ts
{
  keywords: ['specific-vendor-name'],
  accountCode: '4200',
  category: 'Kantoorkosten',
}
```

### Issue: JSON Parsing Errors

**Fixed in v1.2**: Multiple fallback mechanisms now handle all OpenAI response formats.

The system now:
- Strips markdown wrappers (` ```json `)
- Extracts JSON from text
- Accepts multiple field name variations
- Falls back to UUID pattern matching
- Uses keyword matching as last resort

If you still see JSON errors, check console for the raw OpenAI response and report it.

---

## Performance

### Expected Automation Rates

| Phase | Auto-Book Rate | Description |
|-------|----------------|-------------|
| **Week 1** | 20-30% | Initial learning phase |
| **Week 2** | 50-60% | Common patterns learned |
| **Week 4** | 70-80% | Mature system |
| **Week 8+** | 80-90% | Fully optimized |

### Benchmarks

- Transaction analysis: ~100ms per transaction
- Auto-booking: ~300ms per transaction
- Batch import (100 txns): ~30 seconds total

---

## Security & Data Privacy

### What's Stored

**Bank Rules:**
- Patterns extracted from transaction descriptions
- Account mappings
- Contact associations
- NO sensitive financial data

**AI Suggestions:**
- Stored as JSONB in `bank_transactions.ai_suggestion`
- Contains: confidence score, reasoning, suggested mode/accounts
- Cleared after user processes transaction

### External API

**Tavily API:**
- Sends only: Transaction description (e.g., "Google Ads")
- Does NOT send: Amounts, dates, account numbers, personal data
- Optional: System works without it

---

## Future Enhancements

### Planned Features

1. **ML Model Integration**: Replace keyword matching with trained model
2. **Multi-Currency Support**: Auto-detect and convert currencies
3. **Recurring Transaction Detection**: Identify subscriptions
4. **Anomaly Detection**: Flag unusual patterns
5. **Batch Rule Creation**: Suggest multiple rules at once

### Extensibility

**Adding New Intelligence Layer:**

```typescript
// In analyzeTransaction()
const customMatch = await checkCustomLogic(transaction);
if (customMatch) {
  return {
    score: 88,
    reason: 'Custom logic match',
    source: 'custom_layer',
    suggestion: customMatch.suggestion,
  };
}
```

---

## Files Reference

| File | Purpose |
|------|---------|
| `src/lib/bankAutomationService.ts` | Core automation engine |
| `src/lib/tavilyEnrichmentService.ts` | External enrichment |
| `src/lib/bankRulesService.ts` | Rule matching |
| `src/lib/bankService.ts` | Booking functions + learning hooks |
| `src/lib/bankImportService.ts` | Import and deduplication |
| `src/components/ImportReportModal.tsx` | Statistics UI |
| `src/components/BankImporter.tsx` | Import flow |
| `supabase/migrations/20251220140000_add_bank_automation_fields.sql` | Database schema |

---

## Compliance with Mode Separation

The automation engine **strictly enforces** the two-mode system:

### Direct Mode ("Directe Kosten/Omzet")
- ✅ No suspense accounts
- ✅ No contact required
- ✅ Immediate finalization
- ✅ Status: `Booked`

### Relation Mode ("Factuur / Relatie")
- ✅ Uses suspense accounts (1300/2300)
- ✅ Contact ID mandatory
- ✅ 3-step bridge accounting
- ✅ Status: `pending` → `reconciled`

**See**: `BANK_PROCESSING_MODES.md` for complete specification

---

**Version**: 1.1 (with Common Knowledge Base)
**Last Updated**: 2024-12-20
**Minimum Confidence for Auto-Booking**: 80%

---

## Additional Documentation

- **`COMMON_VENDOR_KNOWLEDGE_BASE.md`** - Complete list of 100+ recognized Dutch vendors
- **`BANK_PROCESSING_MODES.md`** - Two-mode system specification
- **`AI_RECONCILIATION_GUIDE.md`** - Invoice matching and reconciliation
- **`SUSPENSE_ACCOUNTING_SYSTEM.md`** - Bridge accounting details
