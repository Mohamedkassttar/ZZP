# Bank Processing Modes

## Overview

The bank processing system supports **two distinct modes** for handling transactions. Each mode serves a different purpose and follows different accounting logic.

---

## Mode 1: Direct Mode ("Directe Kosten/Omzet")

### When to Use
- Simple transactions that don't require invoice matching
- One-time expenses or income
- Bank fees, interest, transfers
- Transactions where you want immediate finalization

### Characteristics
- **No suspense accounts** involved
- **No relation/contact** required
- **Immediate booking** to final accounts
- **Status**: `Booked` (fully processed)
- **Single journal entry** (complete in one step)

### Accounting Flow

#### Expense (Money Out)
```
Debit:  Selected Cost Account (e.g., 4xxx)    €100
Credit: 1000 Bank                             €100
```

**Result**: Cost is immediately recognized, bank is reduced.

#### Income (Money In)
```
Debit:  1000 Bank                             €100
Credit: Selected Revenue Account (e.g., 8xxx) €100
```

**Result**: Revenue is immediately recognized, bank is increased.

### Code Reference
- Function: `bookBankTransaction()`
- File: `src/lib/bankService.ts:266`

---

## Mode 2: Invoice/Relation Mode ("Factuur / Relatie")

### When to Use
- Transactions related to suppliers or customers
- Payments/receipts that need to be matched to invoices
- Transactions requiring proper cutoff management
- When you want to track outstanding items

### Characteristics
- **Uses suspense accounts** (1300 or 2300)
- **Requires relation/contact** (debtor or creditor)
- **3-step bridge accounting** process
- **Status**: `pending` → `reconciled`
- **Multiple journal entries** (bank → invoice → settlement)

### Accounting Flow

#### Purchase Flow (Money Out)

**Step 1: Bank Payment**
```
Debit:  2300 Nog te ontvangen inkoopfacturen  €100
Credit: 1000 Bank                             €100
```
*Transaction status: `pending`*

**Step 2: Invoice Entry** (separate action)
```
Debit:  4xxx Cost Account                     €100
Credit: 1600 Crediteuren                      €100
```

**Step 3: Settlement** (automatic when matched)
```
Debit:  1600 Crediteuren                      €100
Credit: 2300 Nog te ontvangen inkoopfacturen  €100
```
*Transaction status: `reconciled`*

**Net Result**: Cost €100 DB, Bank €100 CR, Suspense €0, Creditor €0

#### Sales Flow (Money In)

**Step 1: Bank Receipt**
```
Debit:  1000 Bank                             €100
Credit: 1300 Nog te vorderen verkoopfacturen  €100
```
*Transaction status: `pending`*

**Step 2: Invoice Entry** (separate action)
```
Debit:  1200 Debiteuren                       €100
Credit: 8xxx Revenue Account                  €100
```

**Step 3: Settlement** (automatic when matched)
```
Debit:  1300 Nog te vorderen verkoopfacturen  €100
Credit: 1200 Debiteuren                       €100
```
*Transaction status: `reconciled`*

**Net Result**: Bank €100 DB, Revenue €100 CR, Suspense €0, Debtor €0

### Code Reference
- Function: `bookBankTransactionViaRelatie()`
- File: `src/lib/bankService.ts:382`
- Settlement Service: `src/lib/suspenseSettlementService.ts`

---

## Comparison Table

| Aspect | Direct Mode | Invoice/Relation Mode |
|--------|-------------|----------------------|
| **Purpose** | Quick, simple transactions | Formal invoice-based transactions |
| **Suspense Accounts** | No | Yes (1300, 2300) |
| **Contact Required** | No | Yes (mandatory) |
| **Steps** | 1 (immediate) | 3 (bank → invoice → settlement) |
| **Status** | `Booked` | `pending` → `reconciled` |
| **Use Cases** | Bank fees, transfers, misc | Supplier invoices, customer payments |
| **Cutoff Management** | Simple | Advanced (proper period allocation) |
| **Matching Required** | No | Yes (to invoice) |
| **Audit Trail** | Single entry | Three separate entries |

---

## Choosing the Right Mode

### Use **Direct Mode** When:
- ✅ Transaction is straightforward and final
- ✅ No invoice exists or is needed
- ✅ You want immediate recognition
- ✅ Examples:
  - Bank service fees
  - Interest received/paid
  - Internal transfers
  - One-time consulting fees
  - Cash withdrawals

### Use **Invoice/Relation Mode** When:
- ✅ Transaction relates to a supplier or customer
- ✅ An invoice exists or will be issued
- ✅ You need proper cutoff management
- ✅ You want to track outstanding items
- ✅ Examples:
  - Supplier payments (awaiting invoice)
  - Customer receipts (awaiting sales invoice)
  - Recurring vendor relationships
  - Prepayments
  - Deposits received/paid

---

## Technical Implementation

### User Interface Flow

```
[Bank Transaction List]
  └─> Click "Process"
      └─> Select Mode:
          ├─> "Directe Kosten/Omzet"
          │   ├─> Select Account (Revenue/Expense)
          │   ├─> Enter Description
          │   └─> [Book] → Status: Booked ✓
          │
          └─> "Factuur / Relatie"
              ├─> Select Contact (Required)
              ├─> Select Account (for future invoice)
              ├─> Enter Description
              └─> [Book] → Status: Pending ⏳
                  └─> Later: Match to Invoice
                      └─> Auto-Settlement → Status: Reconciled ✓
```

### Backend Conditional Routing

```typescript
// Example pseudo-code
function handleProcessTransaction(mode, data) {
  if (mode === 'direct') {
    // Execute Direct Booking Logic
    return bookBankTransaction(
      data.transactionId,
      data.accountId,
      data.description
    );
  } else {
    // Execute Suspense/Relation Booking Logic
    return bookBankTransactionViaRelatie(
      data.transactionId,
      data.contactId,
      data.ledgerAccountId,
      data.description
    );
  }
}
```

---

## Status Lifecycle

### Direct Mode
```
Unmatched → [Process with Direct Mode] → Booked (FINAL)
```

### Invoice/Relation Mode
```
Unmatched → [Process with Relation Mode] → Pending → [Match to Invoice] → Reconciled (FINAL)
```

---

## Common Questions

### Q: Can I switch modes after booking?
**A**: No. Once a transaction is booked, the mode is locked. If you need to change it, you must reverse the transaction and re-book it.

### Q: What if I use Direct Mode but later realize I need an invoice?
**A**: You'll need to:
1. Create a manual adjustment entry
2. Reverse the direct booking
3. Re-book using Invoice/Relation mode
4. Match to the invoice

### Q: Can a transaction be in both modes?
**A**: No. Each transaction uses exactly one mode.

### Q: What happens if I never match an Invoice/Relation transaction?
**A**: The transaction remains in `pending` status, and the suspense account balance will show an outstanding item. This should be resolved before closing the fiscal period.

### Q: Which mode does AI Reconciliation use?
**A**: AI Reconciliation automatically uses **Invoice/Relation Mode** and creates all three steps (bank entry, invoice entry, settlement) in one operation, resulting in a `reconciled` status.

---

## Best Practices

### For Direct Mode:
1. ✅ Use clear, descriptive descriptions
2. ✅ Select the most specific account possible
3. ✅ Review monthly to ensure no invoices were missed
4. ✅ Reserve for truly one-off transactions

### For Invoice/Relation Mode:
1. ✅ Always select the correct contact
2. ✅ Ensure contact has default ledger account set
3. ✅ Match to invoice promptly (within same fiscal period)
4. ✅ Review suspense account balances regularly
5. ✅ Clear all suspense balances before period-end

---

## Reporting Impact

### Balance Sheet
- **Direct Mode**: No impact on suspense accounts
- **Invoice/Relation Mode**: Suspense balances show pending items
  - 1300: Unmatched receipts
  - 2300: Unmatched payments

### Period-End Checklist
1. Review all `pending` transactions
2. Match to invoices or investigate
3. Ensure suspense accounts (1300, 2300) are zero or justified
4. Document any remaining suspense items

---

## Related Documentation

- **Complete Flow Details**: `SUSPENSE_ACCOUNTING_SYSTEM.md`
- **Settlement Logic**: `src/lib/suspenseSettlementService.ts`
- **Bank Service**: `src/lib/bankService.ts`

---

**Version**: 1.0
**Last Updated**: 2024-12-20
