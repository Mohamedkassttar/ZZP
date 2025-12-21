# AI Bank Reconciliation Guide

## Overview
The AI Bank Reconciliation feature uses OpenAI's GPT-4 to automatically analyze unmatched bank transactions and suggest bookings with creditor creation, ledger accounts, and VAT rates.

## How It Works

### 1. Automatic Detection
When bank transactions are imported and cannot be matched to:
- Existing invoices in the system
- Configured bank rules

The system automatically triggers AI analysis for these unmatched transactions.

### 2. AI Analysis Process
The AI analyzes each unmatched transaction and provides:

**Creditor Extraction:**
- Extracts or infers the company name from the transaction description
- Examples: "Afschrijving Bol.com Zakelijk" → "Bol.com"
- Checks if creditor already exists in contacts

**Ledger Account Prediction:**
- Predicts the most appropriate expense account
- Based on creditor name and transaction context
- Examples:
  - "Shell" → Brandstof (Fuel)
  - "Bol.com" → Kantoorkosten (Office costs)
  - "KPN" → Internetkosten (Internet costs)

**VAT Rate Prediction:**
- Predicts appropriate VAT rate (21%, 9%, or 0%)
- Guidelines:
  - 21% (High): Electronics, software, services, fuel
  - 9% (Low): Food, books, newspapers
  - 0% (None): Financial services, insurance

### 3. User Interface

The AI suggestions appear as special purple gradient cards above the transaction table:

**Card Features:**
- **Confidence Score:** Shows AI's confidence level (0-100%)
- **Transaction Details:** Date, amount, and description
- **Editable Fields:**
  - **Crediteur:** Pre-filled company name (with "New - will be created" badge if new)
  - **Kostenplaats:** Dropdown with expense accounts (pre-selected by AI)
  - **BTW Tarief:** VAT rate selector (21%, 9%, 0%)
- **Action Button:** "Maak aan & Boek" (Create & Book)

### 4. Atomic Booking Transaction

When the user clicks "Maak aan & Boek", the system executes a complete booking sequence:

#### Step A: Create Creditor (If New)
```sql
INSERT INTO contacts (company_name, relation_type)
VALUES ('Bol.com', 'Supplier')
```

#### Step B: Create "Ghost" Invoice
```sql
INSERT INTO invoices (contact_id, invoice_number, status, ...)
VALUES (creditor_id, 'AUTO-12345', 'Paid', ...)
```

#### Step C: Book the Cost (With VAT)
```sql
-- Journal Entry 1: The Cost
Debit:  6220 Kantoorkosten          €82.64
Debit:  1500 BTW Te Vorderen        €17.36
Credit: 1600 Crediteuren           €100.00
```

#### Step D: Book the Payment
```sql
-- Journal Entry 2: The Payment
Debit:  1600 Crediteuren           €100.00
Credit: 1000 Bank                  €100.00
```

#### Step E: Link Everything
- Links payment journal entry to bank transaction
- Updates bank transaction status to "Booked"
- Links invoice to payment

## Usage Example

### Scenario
You import a bank statement with this transaction:
- Date: 2024-03-15
- Description: "Afschrijving Bol.com Zakelijk Ref 8832"
- Amount: -€100.00

### AI Analysis Result
The AI suggests:
- **Creditor:** Bol.com (New - will be created)
- **Account:** 6220 - Kantoorkosten
- **VAT:** 21% (High)
- **Confidence:** 85%

### User Action
1. Review the suggestions
2. Adjust if needed (e.g., change account to "Inventaris" if it was equipment)
3. Click "Maak aan & Boek"

### Result
- New contact "Bol.com" created as Supplier
- Invoice created and marked as Paid
- Cost booked with proper VAT split
- Payment booked and linked to bank transaction
- Bank transaction marked as "Booked"

## Best Practices

### 1. Review AI Suggestions
While the AI is highly accurate, always review:
- Creditor name spelling
- Account classification
- VAT rate appropriateness

### 2. Create Bank Rules for Recurring Transactions
After booking transactions manually or via AI:
- Navigate to Settings → Bankregels
- Create rules for frequently recurring suppliers
- This bypasses AI analysis and speeds up future imports

### 3. Training the AI
The AI learns from:
- Your existing chart of accounts
- Your existing contacts
- Common Dutch accounting patterns

The more you use the system, the better the suggestions become.

## Technical Details

### OpenAI Integration
- Model: GPT-4o
- Temperature: 0.1 (for consistent, deterministic results)
- Max Tokens: 500
- Response Format: Structured JSON

### Error Handling
If AI analysis fails:
- Error message is displayed
- "Retry Analysis" button available
- Can still book manually via normal flow

### Performance
- AI analysis: ~2-3 seconds per transaction
- Shows up to 3 transactions at once
- Progressive loading as transactions are completed

## Security & Privacy

### Data Processing
- Transaction descriptions are sent to OpenAI for analysis
- No sensitive banking details (account numbers) are sent
- Only description and amount are analyzed

### Data Storage
- All bookings stored in your Supabase database
- No transaction data stored by OpenAI (ephemeral processing)
- Full audit trail maintained in journal entries

## Requirements

### Environment Variables
Ensure your `.env` file contains:
```
VITE_OPENAI_API_KEY=sk-...
```

### Database Setup
Required tables (already configured):
- `contacts` - For creditor storage
- `accounts` - Chart of accounts
- `invoices` - For ghost invoices
- `journal_entries` - For cost and payment entries
- `journal_lines` - For double-entry bookkeeping
- `bank_transactions` - For transaction tracking

### Accounts Required
The system expects these account types:
- Asset account with "bank" in name (e.g., "1000 Bank")
- Liability account with "crediteuren" or "leveranciers" in name
- Asset account with "btw te vorderen" for VAT receivable
- Expense accounts for cost booking

## Troubleshooting

### "OpenAI API key is not configured"
- Add `VITE_OPENAI_API_KEY` to your `.env` file
- Restart the development server

### "No bank account found"
- Ensure you have an Asset account with "bank" in the name
- Check that the account is marked as active

### "No creditors account found"
- Create a Liability account named "Crediteuren" or "Leveranciers"
- This is used for payables tracking

### AI Suggestions Seem Incorrect
- The AI is trained on Dutch accounting practices
- You can always edit suggestions before booking
- Consider creating bank rules for better automation

## Future Enhancements

Potential improvements:
- Batch processing of multiple transactions
- Learning from user corrections
- Custom AI prompts per business type
- Integration with receipt scanning
- Automatic duplicate detection
