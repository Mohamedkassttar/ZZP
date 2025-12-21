# CRM/Relation Scanner with AI Fallback

## Overview

The CRM/Relation Scanner is an intelligent automation layer that checks if bank transaction counterparties exist in your Relations database before attempting other matching methods. When a relation is found, it automatically switches to "Invoice Route" mode and uses either the relation's default account or AI to determine the correct ledger account.

## How It Works

### Matching Hierarchy

The system now follows this priority order:

1. **Invoice Match** (100%) - Exact amount + date match
2. **User Rules** (100%) - User-defined keyword matches
3. **CRM/Relation Scanner** (100%) - **NEW!** Existing contacts with AI fallback
4. **Hardcoded Defaults** (100%) - Shell, BP, AH, etc.
5. **Tavily Fallback** - Only if steps 1-4 fail

### The CRM Scanner Logic

When a transaction is analyzed, the system:

#### Step 1: Fuzzy Search for Relations
- Searches the `contacts` table for active relations
- Performs case-insensitive matching between:
  - The transaction's counterparty name (e.g., "Coolblue BV")
  - The relation's company name in your database
- Match criteria: Either string contains the other

**Example Matches:**
- Transaction: "COOLBLUE BV" → Relation: "Coolblue B.V." ✓
- Transaction: "Albert Heijn 1234" → Relation: "Albert Heijn" ✓
- Transaction: "Microsoft" → Relation: "Microsoft Corporation" ✓

#### Step 2A: Relation Found WITH Default Account
If the matched relation has a `default_ledger_account_id` set:

```
✓ [CRM MATCH!] Found relation: Coolblue B.V. (Creditor)
✓ [CRM] Using relation's default account: 4210 Software en abonnementen

Result:
- Mode: relation (Invoice Route)
- Contact: Coolblue B.V.
- Account: 4210 Software en abonnementen
- Confidence: 100%
```

#### Step 2B: Relation Found WITHOUT Default Account
If the matched relation has NO default account set:

```
✓ [CRM MATCH!] Found relation: New Supplier B.V. (Creditor)
→ [CRM] No default account, calling AI for classification...
✓ [CRM + AI] Matched relation with AI account suggestion

Result:
- Mode: relation (Invoice Route)
- Contact: New Supplier B.V.
- Account: [Determined by AI based on transaction context]
- Confidence: 100%
```

The AI analyzes the transaction description and determines the most appropriate ledger account (e.g., office supplies → 4200, software → 4210, fuel → 4310).

#### Step 2C: AI Categorization Fails
If AI cannot determine an account:

```
✓ [CRM MATCH!] Found relation: Unknown Services Ltd. (Creditor)
⚠ [CRM] Relation found but AI failed to categorize

Result:
- Mode: relation (Invoice Route)
- Contact: Unknown Services Ltd.
- Account: [Empty - user must select]
- Confidence: 100%
```

The system still forces relation mode, but the user must manually select the ledger account.

## Benefits

### 1. Automatic Relation Detection
No need to manually switch to "Invoice Route" - if the counterparty exists in your CRM, the system automatically uses it.

### 2. Intelligent Account Assignment
- Relations with default accounts: Instant booking
- Relations without defaults: AI suggests the best account based on context
- Consistent categorization across multiple transactions with the same relation

### 3. Learning Over Time
As you add relations to your system and set default accounts, the automation becomes more accurate and requires less manual intervention.

### 4. Priority Over Generic Rules
The CRM Scanner runs AFTER user-defined rules but BEFORE hardcoded vendor patterns, ensuring your specific business relationships take precedence.

## Use Cases

### Scenario 1: Established Supplier with Default Account
**Setup:**
- Relation: "Office Depot B.V."
- Default Account: 4200 Kantoorkosten

**Transaction:**
```
Counterparty: OFFICE DEPOT NL
Amount: -€245.50
Description: Invoice #12345
```

**Result:**
- Automatically books via relation (Invoice Route)
- Uses account 4200 Kantoorkosten
- 100% confidence, auto-books immediately

### Scenario 2: New Supplier, No Default Account
**Setup:**
- Relation: "TechGear Solutions"
- Default Account: [Not Set]

**Transaction:**
```
Counterparty: TECHGEAR SOLUTIONS
Amount: -€1,250.00
Description: Laptop purchase
```

**Result:**
- Detects relation automatically
- AI analyzes "Laptop purchase" → suggests 4210 Automatiseringskosten
- Books via relation with AI-suggested account
- 100% confidence, auto-books immediately

### Scenario 3: Personal Expense with Relation
**Setup:**
- Relation: "John Doe (Owner)"
- Default Account: 1800 Privé-opnames

**Transaction:**
```
Counterparty: J DOE
Amount: -€500.00
Description: Private withdrawal
```

**Result:**
- Recognizes owner relation
- Uses default privé account 1800
- Books as relation transaction
- Perfect for tracking private/business separation

## Configuration

### Setting Default Accounts for Relations

1. Go to **Relations** page
2. Edit a contact
3. Set the **Default Ledger Account** field
4. Save

Future transactions with this relation will automatically use this account.

### When to Set Default Accounts

**Recommended for:**
- Frequent suppliers (e.g., "Office Depot" → 4200 Kantoorkosten)
- Fixed service providers (e.g., "KPN" → 4220 Telecommunicatie)
- Tax authorities (e.g., "Belastingdienst" → 1740 Belastingen)
- Owner/shareholders (e.g., "John Doe" → 1800 Privé)

**Not necessary for:**
- Infrequent suppliers (AI will categorize on-demand)
- Relations that supply multiple categories (e.g., Amazon → AI decides based on item)
- Test/temporary contacts

## Technical Details

### Matching Algorithm

```typescript
// Fuzzy match: case-insensitive contains
const companyName = relation.company_name.toLowerCase();
const searchText = cleanText.toLowerCase();

// Match if either string contains the other
return companyName.includes(searchText) ||
       searchText.includes(companyName);
```

### AI Fallback Integration

When a relation is found without a default account, the system:

1. Calls the Tavily Enrichment Service
2. Passes the cleaned transaction description
3. Receives an AI-suggested account based on:
   - Transaction description semantics
   - Dutch accounting rules
   - Common expense/revenue categorization

4. Returns a 100% confidence match with:
   - Mode: `relation`
   - Contact ID: The matched relation
   - Account ID: AI-suggested account

### Database Schema

The feature uses:

```sql
-- Contacts table
CREATE TABLE contacts (
  id uuid PRIMARY KEY,
  company_name text NOT NULL,
  relation_type relation_type NOT NULL,  -- 'Creditor' or 'Debtor'
  default_ledger_account_id uuid,        -- NEW: Optional default account
  is_active boolean DEFAULT true,
  ...
);

-- Foreign key to accounts
ALTER TABLE contacts
ADD CONSTRAINT fk_contacts_default_ledger_account
FOREIGN KEY (default_ledger_account_id)
REFERENCES accounts(id)
ON DELETE SET NULL;
```

## Logging & Debugging

The CRM Scanner provides detailed console logging:

```
→ [CRM SCAN] Searching for relation: "Coolblue BV"
✓ [CRM MATCH!] Found relation: Coolblue B.V. (Creditor)
✓ [CRM] Using relation's default account: 4210 Software en abonnementen
✅ RESULT: CRM Match (100%)
```

Or with AI fallback:

```
→ [CRM SCAN] Searching for relation: "TechSupplier"
✓ [CRM MATCH!] Found relation: TechSupplier B.V. (Creditor)
→ [CRM] No default account, calling AI for classification...
✓ [CRM + AI] Matched relation with AI account suggestion
✅ RESULT: CRM Match (100%)
```

## Best Practices

1. **Add Relations Early**: Create contact entries for your frequent suppliers/customers
2. **Set Default Accounts Strategically**: Only for suppliers with consistent categorization
3. **Review AI Suggestions**: The first few times a relation is used without a default, verify the AI's account suggestion
4. **Update Defaults**: If AI consistently suggests the same account, set it as the default to speed up future transactions
5. **Keep Relations Active**: Deactivate old/unused relations to avoid false matches

## Integration with Other Features

### User Rules
User rules have HIGHER priority than CRM Scanner. If you create a keyword rule for "COOLBLUE" → 4210, it will match before checking the relations database.

### Hardcoded Vendors
The CRM Scanner has HIGHER priority than hardcoded vendor patterns. Your specific relations override generic Shell/BP/AH rules.

### Self-Learning
When you manually book a transaction via relation, the system can learn and suggest creating a default account assignment for future automation.

## Future Enhancements

Potential improvements:
- **Learning Mode**: Automatically set default accounts after 3+ consistent manual selections
- **Multi-Category Relations**: Track which accounts are used most frequently per relation
- **Confidence Scoring**: Lower confidence for fuzzy matches, require manual review
- **Duplicate Detection**: Warn if multiple relations match the same counterparty name
