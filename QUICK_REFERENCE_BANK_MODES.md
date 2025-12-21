# Quick Reference: Bank Processing Modes

## Mode Selection Decision Tree

```
┌─────────────────────────────────────┐
│   Bank Transaction to Process       │
└──────────────┬──────────────────────┘
               │
               ▼
    ┌──────────────────────┐
    │  Need Invoice Match? │
    └──────────┬───────────┘
               │
         ┌─────┴─────┐
         │           │
        NO          YES
         │           │
         ▼           ▼
    ┌────────┐  ┌──────────┐
    │ DIRECT │  │ RELATION │
    │  MODE  │  │   MODE   │
    └────────┘  └──────────┘
```

---

## Direct Mode: "Directe Kosten/Omzet"

### Function
`bookBankTransaction(transactionId, accountId, description)`

### Requires
- Account ID (Cost or Revenue)
- Description

### Journal Entries

| Scenario | Debit | Credit |
|----------|-------|--------|
| **Expense** | Cost Account (4xxx) | Bank (1000) |
| **Income** | Bank (1000) | Revenue Account (8xxx) |

### Status Flow
`Unmatched` → `Booked` ✓ (DONE)

### Use Cases
- Bank fees
- Interest
- Transfers
- One-time expenses
- Cash withdrawals

---

## Relation Mode: "Factuur / Relatie"

### Function
`bookBankTransactionViaRelatie(transactionId, contactId, ledgerAccountId, description)`

### Requires
- Contact ID (Debtor/Creditor) **MANDATORY**
- Ledger Account ID (for context)
- Description

### Journal Entries (3-Step Flow)

#### Purchase (Expense)

| Step | Debit | Credit |
|------|-------|--------|
| **1. Bank** | Suspense 2300 | Bank 1000 |
| **2. Invoice** | Cost 4xxx | Creditor 1600 |
| **3. Settlement** | Creditor 1600 | Suspense 2300 |

#### Sales (Income)

| Step | Debit | Credit |
|------|-------|--------|
| **1. Bank** | Bank 1000 | Suspense 1300 |
| **2. Invoice** | Debtor 1200 | Revenue 8xxx |
| **3. Settlement** | Suspense 1300 | Debtor 1200 |

### Status Flow
`Unmatched` → `pending` ⏳ → `reconciled` ✓ (DONE)

### Use Cases
- Supplier invoices
- Customer payments
- Recurring vendors
- Prepayments
- Any transaction needing invoice match

---

## Suspense Accounts Reference

| Code | Name | Type | Purpose |
|------|------|------|---------|
| **1300** | Nog te vorderen verkoopfacturen | Asset | Holds bank receipts until matched to sales invoice |
| **2300** | Nog te ontvangen inkoopfacturen | Liability | Holds bank payments until matched to purchase invoice |

**Important**: These accounts should be ZERO at period-end after all matching is complete.

---

## Status Codes

| Status | Meaning | Mode | Next Action |
|--------|---------|------|-------------|
| `Unmatched` | Not yet processed | Both | User must select mode and process |
| `Booked` | Fully processed (direct) | Direct | None (complete) |
| `pending` | On suspense account | Relation | Match to invoice |
| `reconciled` | Fully matched and cleared | Relation | None (complete) |

---

## Code Implementation Example

```typescript
// In UI handler
async function handleProcessTransaction(mode: 'direct' | 'relation', data: any) {
  if (mode === 'direct') {
    // Simple, immediate booking
    return await bookBankTransaction(
      data.transactionId,
      data.accountId,     // Revenue or Cost account
      data.description
    );
  } else {
    // Bridge accounting with suspense
    return await bookBankTransactionViaRelatie(
      data.transactionId,
      data.contactId,     // REQUIRED: Debtor or Creditor
      data.ledgerAccountId,
      data.description
    );
  }
}
```

---

## AI Reconciliation

**Mode Used**: Always uses **Relation Mode** with automatic 3-step completion

**Process**:
1. Creates invoice entry
2. Creates bank entry (to suspense)
3. Creates settlement entry (clears suspense)
4. Final status: `reconciled`

**Result**: Complete audit trail with all three journal entries.

---

## Period-End Checklist

### Direct Mode Transactions
- ✅ Review descriptions for clarity
- ✅ Verify accounts are correct
- ✅ No further action needed

### Relation Mode Transactions
- ✅ Check suspense account balances (1300, 2300)
- ✅ Match all `pending` transactions to invoices
- ✅ Investigate unmatched items
- ✅ Suspense balances should be ZERO or documented

---

## File References

| Document | Purpose |
|----------|---------|
| `BANK_PROCESSING_MODES.md` | Detailed comparison and flows |
| `SUSPENSE_ACCOUNTING_SYSTEM.md` | Complete bridge accounting guide |
| `src/lib/bankService.ts` | Implementation (lines 266, 382) |
| `src/lib/suspenseSettlementService.ts` | Settlement logic |

---

**Quick Tip**: When in doubt, use **Relation Mode** for anything involving suppliers or customers. Use **Direct Mode** only for true one-off transactions like bank fees.
