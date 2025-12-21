# Bank Rules Auto-Matcher Integration Guide

## Overview
The Bank Rules system automatically matches imported bank transactions with configured rules and creates proposed journal entries.

## How to Integrate

### 1. During Bank Import

When processing a CSV line in your bank import logic, call the auto-matcher:

```typescript
import { matchTransactionWithRules } from '../lib/bankRulesService';

// After creating bank_transaction record
const matchResult = await matchTransactionWithRules(
  transaction.description,
  transaction.amount,
  transaction.transaction_date
);

if (matchResult.matched && matchResult.journalEntryId) {
  // Link the journal entry to the bank transaction
  await supabase
    .from('bank_transactions')
    .update({
      journal_entry_id: matchResult.journalEntryId,
      status: 'Matched'
    })
    .eq('id', bankTransactionId);

  console.log(`Auto-matched with rule: ${matchResult.rule?.keyword}`);
}
```

### 2. Show Rule Suggestion Toast

When a user manually books a transaction, suggest creating a rule:

```typescript
import { suggestRuleCreation } from '../lib/bankRulesService';

// After user manually matches a transaction
const keyword = extractKeywordFromDescription(transaction.description);
const created = await suggestRuleCreation(keyword, selectedAccountId);

if (created) {
  showToast({
    message: `Regel aangemaakt voor "${keyword}"`,
    type: 'success'
  });
}
```

### 3. Example Toast Component

```typescript
function showRuleSuggestionToast(keyword: string, accountId: string, onAccept: () => void) {
  return (
    <Toast>
      <p>Wil je een regel aanmaken voor "{keyword}"?</p>
      <button onClick={async () => {
        await suggestRuleCreation(keyword, accountId);
        onAccept();
      }}>
        Ja, regel aanmaken
      </button>
      <button onClick={() => dismissToast()}>
        Nee, bedankt
      </button>
    </Toast>
  );
}
```

## Features Implemented

### ✅ Database Schema
- `bank_rules` table with priority-based matching
- Support for "Contains" and "Exact" match types
- Links to chart of accounts

### ✅ UI Management
- Settings → Bankregels tab
- Create/Edit/Delete rules
- Priority ordering (drag up/down)
- Active/Inactive toggle

### ✅ Auto-Matcher Service
- `matchTransactionWithRules()` - Finds matching rule and creates journal entry
- `suggestRuleCreation()` - Helps user create rules from manual bookings
- Priority-based rule checking (highest first)

### ✅ Journal Entry Creation
- Automatically creates Draft journal entries
- Uses rule's description template (or original description)
- Properly debits/credits based on transaction type
- Marks with "Auto-matched: [keyword]" for transparency

## Usage in Settings

Navigate to **Instellingen → Bankregels** to:
- View all configured rules
- Create new automation rules
- Edit existing rules
- Change priority order
- Toggle rules on/off
- Delete unused rules

## Example Rules

| Keyword | Match Type | Target Account | Priority |
|---------|-----------|----------------|----------|
| Shell | Contains | 6210 - Brandstof | 10 |
| KPN | Contains | 6420 - Internetkosten | 9 |
| Albert Heijn | Contains | 6411 - Kantinekosten | 8 |
| Salaris | Contains | 4000 - Lonen & Salarissen | 7 |
