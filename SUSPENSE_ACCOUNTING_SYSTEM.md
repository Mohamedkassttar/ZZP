# Suspense Account System (Tussenrekeningen)

## Overview

Version 1.0 introduces **Bridge Accounting** using suspense accounts ("Tussenrekeningen") for cleaner cutoff management and more accurate financial reporting. This methodology follows Dutch accounting best practices for handling the timing difference between bank transactions and invoice recognition.

**IMPORTANT**: Suspense accounts are ONLY used in **"Factuur / Relatie" mode**. The **"Directe Kosten/Omzet" mode** bypasses suspense accounts entirely for simple, direct bookings. See `BANK_PROCESSING_MODES.md` for the complete comparison.

## Why Suspense Accounts?

Previously, bank transactions were booked directly to debtor/creditor accounts, which created challenges:
- **Cutoff Issues**: Bank payments didn't always align with invoice dates
- **Reconciliation Complexity**: Matching payments to invoices was implicit
- **Audit Trail**: The relationship between payments and invoices wasn't clear
- **Period-End Accuracy**: Financial statements could be distorted if transactions crossed fiscal periods

The new system introduces **intermediate accounts** that temporarily hold transactions until they're properly matched and cleared.

---

## System Accounts

Two new system-protected accounts have been added:

### 1300 - Nog te vorderen verkoopfacturen (Asset)
- **Type**: Asset (Activa)
- **Category**: Vorderingen (Receivables)
- **Purpose**: Temporary holding account for bank receipts awaiting sales invoice matching
- **Status**: System Protected (cannot be deleted)

### 2300 - Nog te ontvangen inkoopfacturen (Liability)
- **Type**: Liability (Passiva)
- **Category**: Kortlopende schulden (Current Liabilities)
- **Purpose**: Temporary holding account for bank payments awaiting purchase invoice matching
- **Status**: System Protected (cannot be deleted)

---

## The 3-Step Bridge Accounting Flow

### Purchase Flow (Expenses)

#### Step 1: Bank Payment (Suspense Booking)
When money leaves the bank account before the invoice is processed:

**Journal Entry:**
```
Debit:  2300 Nog te ontvangen inkoopfacturen    €1,000
Credit: 1000 Bank                               €1,000
```

**Effect**: The payment is recorded but "parked" in the suspense account until the invoice is matched.

**Transaction Status**: `pending`

---

#### Step 2: Invoice Entry (Standard Invoice Recognition)
When the purchase invoice is received and entered:

**Journal Entry:**
```
Debit:  4xxx Cost Account                       €826.45
Debit:  1500 BTW Te Vorderen                    €173.55
Credit: 1600 Crediteuren                        €1,000
```

**Effect**: The expense and creditor liability are recognized. This step is unchanged from the previous system.

---

#### Step 3: Settlement (Clearing Entry)
When the bank transaction is matched to the invoice:

**Journal Entry:**
```
Debit:  1600 Crediteuren                        €1,000
Credit: 2300 Nog te ontvangen inkoopfacturen    €1,000
```

**Effect**:
- The creditor account is cleared (debt paid)
- The suspense account is cleared (payment matched)
- The transaction is marked as reconciled

**Transaction Status**: `reconciled`

---

### Net Effect (Purchase Flow)

After all three steps are complete:

| Account | Debit | Credit | Net |
|---------|-------|--------|-----|
| 4xxx Cost | €826.45 | - | +€826.45 |
| 1500 BTW | €173.55 | - | +€173.55 |
| 1000 Bank | - | €1,000 | -€1,000 |
| 1600 Crediteuren | €1,000 | €1,000 | €0 (cleared) |
| 2300 Suspense | €1,000 | €1,000 | €0 (cleared) |

**Result**: The cost is recognized, the bank is reduced, and all temporary accounts are cleared.

---

### Sales Flow (Income)

#### Step 1: Bank Receipt (Suspense Booking)
When money enters the bank account before the invoice is processed:

**Journal Entry:**
```
Debit:  1000 Bank                               €1,000
Credit: 1300 Nog te vorderen verkoopfacturen    €1,000
```

**Effect**: The receipt is recorded but "parked" in the suspense account.

**Transaction Status**: `pending`

---

#### Step 2: Invoice Entry (Standard Invoice Recognition)
When the sales invoice is issued:

**Journal Entry:**
```
Debit:  1200 Debiteuren                         €1,000
Credit: 8xxx Revenue Account                    €826.45
Credit: 1520 BTW Te Betalen                     €173.55
```

**Effect**: The revenue and debtor asset are recognized.

---

#### Step 3: Settlement (Clearing Entry)
When the bank transaction is matched to the invoice:

**Journal Entry:**
```
Debit:  1300 Nog te vorderen verkoopfacturen    €1,000
Credit: 1200 Debiteuren                         €1,000
```

**Effect**:
- The debtor account is cleared (payment received)
- The suspense account is cleared (receipt matched)
- The transaction is marked as reconciled

**Transaction Status**: `reconciled`

---

### Net Effect (Sales Flow)

After all three steps are complete:

| Account | Debit | Credit | Net |
|---------|-------|--------|-----|
| 1000 Bank | €1,000 | - | +€1,000 |
| 8xxx Revenue | - | €826.45 | +€826.45 |
| 1520 BTW | - | €173.55 | +€173.55 |
| 1200 Debiteuren | €1,000 | €1,000 | €0 (cleared) |
| 1300 Suspense | €1,000 | €1,000 | €0 (cleared) |

**Result**: The revenue is recognized, the bank is increased, and all temporary accounts are cleared.

---

## Implementation Details

### Database Changes

**New Column: `accounts.system_protected`**
- Type: `boolean`
- Default: `false`
- Purpose: Prevents deletion of critical system accounts
- Protected accounts: 1300, 2300

**New Journal Entry Type: `settlement`**
- Used to distinguish settlement entries from regular transactions
- Helps with reporting and audit trails

### Service Layer

#### `suspenseSettlementService.ts`
New service providing:
- `settlePurchaseTransaction()`: Clears purchase suspense and creditor
- `settleSalesTransaction()`: Clears sales suspense and debtor
- `autoSettle()`: Automatically determines transaction type and settles

#### Updated Services

**`bankService.ts`**
- `bookBankTransactionViaRelatie()`: Now books to suspense accounts instead of debtor/creditor
- Status changed from `Booked` to `pending` to indicate awaiting settlement

**`aiReconciliationService.ts`**
- `bookUnmatchedTransaction()`: Now creates 3-step flow automatically:
  1. Invoice entry (Cost + Creditor)
  2. Bank entry (Suspense + Bank)
  3. Settlement entry (Creditor + Suspense)
- Transaction marked as `reconciled` after settlement

---

## User Experience Changes

### Bank Transaction Processing

**Before:**
- User processes bank transaction → Transaction marked as "Booked"
- Direct posting to debtor/creditor accounts
- No explicit matching step

**After:**
- User processes bank transaction → Transaction marked as "Pending"
- Posting to suspense accounts (1300 or 2300)
- Explicit matching to invoice required
- Transaction marked as "Reconciled" after matching

### AI Reconciliation

**Before:**
- AI creates invoice and books to debtor/creditor directly
- Status: "Booked"

**After:**
- AI creates invoice, books to suspense, and auto-settles
- Status: "Reconciled"
- Three separate journal entries for complete audit trail

---

## Benefits

### 1. Cleaner Cutoff Management
- Transactions can be recorded when they occur (bank statement date)
- Invoices can be recorded when they're issued/received
- Matching happens explicitly, preventing period-end errors

### 2. Better Audit Trail
- Three distinct journal entries show the complete story:
  - When money moved (bank entry)
  - What the transaction was for (invoice entry)
  - When they were matched (settlement entry)

### 3. Improved Financial Reporting
- Suspense account balances show unmatched transactions
- Easy to identify outstanding items at period end
- Supports accurate accrual accounting

### 4. Enhanced Reconciliation
- Clear distinction between:
  - Pending transactions (suspense balance)
  - Matched transactions (zero suspense balance)
  - Unmatched transactions (suspense balance persists)

### 5. Regulatory Compliance
- Follows Dutch GAAP principles
- Supports proper accrual vs. cash basis accounting
- Provides clear documentation for tax authorities

---

## Reporting Impact

### Balance Sheet

**New Line Items:**
- **Assets**: 1300 Nog te vorderen verkoopfacturen
  - Shows money received but not yet matched to invoices
  - Should be zero or minimal at period end

- **Liabilities**: 2300 Nog te ontvangen inkoopfacturen
  - Shows money paid but not yet matched to invoices
  - Should be zero or minimal at period end

### Period-End Procedures

1. **Review Suspense Balances**
   - Any remaining balance indicates unmatched transactions
   - Investigate and match before closing period

2. **Aging Analysis**
   - Track how long transactions remain in suspense
   - Old unmatched items may indicate errors or missing invoices

3. **Reconciliation Report**
   - Compare bank statement to suspense + matched transactions
   - Ensures all bank activity is properly recorded

---

## Migration Notes

### Existing Data
- Existing transactions remain unchanged
- New system applies to all transactions processed after upgrade
- No retroactive changes to historical data

### Account Codes
- **1300** was previously "Debiteuren" in some implementations
- Now dedicated to suspense functionality
- Existing debiteuren moved to **1200** if needed
- **2300** was previously unused
- Now dedicated to suspense functionality

### Backward Compatibility
- Settlement service is optional
- System still supports direct booking for specific use cases
- AI reconciliation uses new system automatically

---

## Technical Reference

### Transaction Statuses

| Status | Meaning | Suspense Balance |
|--------|---------|------------------|
| `Unmatched` | Not yet processed | N/A |
| `pending` | Booked to suspense | Yes |
| `reconciled` | Fully matched and settled | No |

### Journal Entry Types

| Type | Purpose | Typical Accounts |
|------|---------|------------------|
| `bank` | Bank transaction to suspense | Bank + Suspense |
| `purchase` | Purchase invoice | Cost + Creditor |
| `sales` | Sales invoice | Debtor + Revenue |
| `settlement` | Clearing suspense | Creditor/Debtor + Suspense |

---

## Troubleshooting

### Issue: Suspense balance not clearing

**Possible Causes:**
1. Invoice not created for the bank transaction
2. Settlement entry not generated
3. Amount mismatch between invoice and bank transaction

**Resolution:**
- Verify invoice exists with correct amount
- Check matched_invoice_id on bank_transactions table
- Manually create settlement entry if needed using `suspenseSettlementService`

### Issue: Duplicate postings

**Possible Cause:**
- Settlement run twice for same transaction

**Resolution:**
- Check transaction status before settling
- Only settle transactions in `pending` status
- Settlement service includes safeguards against this

---

## Future Enhancements

Planned for v1.1+:
- **Partial Matching**: Match one bank transaction to multiple invoices
- **Tolerance Handling**: Auto-settle transactions with small differences
- **Bulk Settlement**: Settle multiple transactions at once
- **Suspense Dashboard**: Dedicated UI for managing unmatched items
- **Auto-Settlement Rules**: Automatic matching based on patterns

---

## Version History

- **v1.0** (2024-12-20): Initial implementation
  - Added accounts 1300 and 2300
  - Implemented 3-step bridge accounting
  - Updated bank processing and AI reconciliation
  - Created settlement service

---

**End of Documentation**

For questions or issues, refer to:
- Migration file: `supabase/migrations/add_suspense_accounts_system.sql`
- Settlement service: `src/lib/suspenseSettlementService.ts`
- Bank service: `src/lib/bankService.ts`
- AI reconciliation: `src/lib/aiReconciliationService.ts`
