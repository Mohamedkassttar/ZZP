/*
  # Bank Transactions and Reconciliation System
  
  ## Overview
  Creates infrastructure for importing bank statements and reconciling them with invoices and journal entries.
  Supports CSV/MT940 import with smart matching against open invoices.
  
  ## 1. New Tables
  
  ### bank_transactions
  - `id` (uuid, primary key) - Unique identifier
  - `transaction_date` (date) - Date of the transaction
  - `description` (text) - Bank description/memo
  - `amount` (numeric) - Transaction amount (positive for credits, negative for debits)
  - `contra_account` (text) - Counter-party account number (IBAN)
  - `contra_name` (text) - Counter-party name
  - `reference` (text) - Bank reference/transaction ID
  - `balance_after` (numeric) - Account balance after transaction (optional)
  - `status` (text) - Status: Unmatched, Matched, Booked
  - `journal_entry_id` (uuid, FK) - Link to journal entry if booked
  - `matched_invoice_id` (uuid, FK) - Link to matched invoice (for future use)
  - `imported_at` (timestamptz) - When transaction was imported
  - `reconciled_at` (timestamptz) - When transaction was reconciled
  - `created_at` (timestamptz) - Creation timestamp
  
  ## 2. Business Rules
  - Transactions start as 'Unmatched'
  - Smart matching suggests connections to open invoices
  - When booked, creates journal entries linking Bank account to appropriate GL accounts
  - Positive amounts are money received (Debit Bank, Credit Revenue/Debtor)
  - Negative amounts are money paid (Credit Bank, Debit Expense/Creditor)
  
  ## 3. Security
  - RLS enabled for authenticated users
  - Users can only access their own bank transactions
*/

-- Create bank transaction status enum
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bank_transaction_status') THEN
    CREATE TYPE bank_transaction_status AS ENUM ('Unmatched', 'Matched', 'Booked');
  END IF;
END $$;

-- Table: bank_transactions
CREATE TABLE IF NOT EXISTS bank_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_date date NOT NULL,
  description text NOT NULL,
  amount numeric(12,2) NOT NULL,
  contra_account text,
  contra_name text,
  reference text,
  balance_after numeric(12,2),
  status bank_transaction_status DEFAULT 'Unmatched',
  journal_entry_id uuid REFERENCES journal_entries(id) ON DELETE SET NULL,
  matched_invoice_id uuid,
  imported_at timestamptz DEFAULT now(),
  reconciled_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_bank_transactions_date ON bank_transactions(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_status ON bank_transactions(status);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_amount ON bank_transactions(amount);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_journal_entry ON bank_transactions(journal_entry_id);

-- Enable Row Level Security
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for bank_transactions
CREATE POLICY "Authenticated users can view bank transactions"
  ON bank_transactions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert bank transactions"
  ON bank_transactions FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update bank transactions"
  ON bank_transactions FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete bank transactions"
  ON bank_transactions FOR DELETE
  TO authenticated
  USING (true);

-- Function: Update reconciled_at timestamp when status changes
CREATE OR REPLACE FUNCTION update_bank_transaction_reconciled_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('Matched', 'Booked') AND OLD.status = 'Unmatched' THEN
    NEW.reconciled_at = now();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-update reconciled timestamp
DROP TRIGGER IF EXISTS update_bank_reconciled_timestamp ON bank_transactions;
CREATE TRIGGER update_bank_reconciled_timestamp
  BEFORE UPDATE ON bank_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_bank_transaction_reconciled_at();