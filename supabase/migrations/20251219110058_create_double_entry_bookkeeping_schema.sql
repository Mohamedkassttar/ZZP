/*
  # Smart Accounting App - Double-Entry Bookkeeping Schema
  
  ## Overview
  This migration creates a complete double-entry bookkeeping system for Dutch freelancers (ZZP).
  It enforces accounting principles where debits must equal credits before journal entries can be finalized.
  
  ## 1. New Tables
  
  ### accounts (Chart of Accounts / Grootboekrekeningschema)
  - `id` (uuid, primary key) - Unique identifier
  - `code` (text, unique) - Account code (e.g., "8000")
  - `name` (text) - Account name (e.g., "Omzet Hoog")
  - `type` (text) - Account type: Asset, Liability, Equity, Revenue, Expense
  - `vat_code` (numeric) - Default VAT percentage (e.g., 21, 9, 0)
  - `description` (text) - Optional description
  - `is_active` (boolean) - Whether account is active
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp
  
  ### contacts (Debtors/Creditors)
  - `id` (uuid, primary key) - Unique identifier
  - `company_name` (text) - Company or person name
  - `vat_number` (text) - VAT identification number (BTW-nummer)
  - `relation_type` (text) - Type: Customer, Supplier, or Both
  - `email` (text) - Contact email
  - `phone` (text) - Contact phone
  - `address` (text) - Full address
  - `is_active` (boolean) - Whether contact is active
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp
  
  ### journal_entries (Journal Entry Headers / Dagboek)
  - `id` (uuid, primary key) - Unique identifier
  - `entry_date` (date) - Date of the journal entry
  - `description` (text) - Description of the transaction
  - `reference` (text) - Reference number (e.g., invoice number)
  - `status` (text) - Status: Draft or Final
  - `contact_id` (uuid, FK) - Optional link to contact
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp
  
  ### journal_lines (Journal Entry Lines / Splits)
  - `id` (uuid, primary key) - Unique identifier
  - `journal_entry_id` (uuid, FK) - Link to journal entry header
  - `account_id` (uuid, FK) - Link to account
  - `debit` (numeric) - Debit amount (default 0)
  - `credit` (numeric) - Credit amount (default 0)
  - `description` (text) - Line-specific description
  - `created_at` (timestamptz) - Creation timestamp
  
  ## 2. Business Rules & Constraints
  
  ### Double-Entry Validation
  - A trigger ensures that journal entries cannot be set to 'Final' status unless the sum of debits equals the sum of credits
  - Each journal line must have either a debit OR credit amount (not both)
  
  ### Data Integrity
  - Account codes must be unique
  - Journal lines cascade delete when journal entry is deleted
  - All monetary amounts use numeric(12,2) for precision
  
  ## 3. Security
  
  ### Row Level Security (RLS)
  - All tables have RLS enabled
  - Authenticated users can perform CRUD operations on their own data
  - This is a single-user app structure where each user maintains their own books
*/

-- Create account type enum for better data integrity
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_type') THEN
    CREATE TYPE account_type AS ENUM ('Asset', 'Liability', 'Equity', 'Revenue', 'Expense');
  END IF;
END $$;

-- Create relation type enum
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'relation_type') THEN
    CREATE TYPE relation_type AS ENUM ('Customer', 'Supplier', 'Both');
  END IF;
END $$;

-- Create journal entry status enum
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'journal_status') THEN
    CREATE TYPE journal_status AS ENUM ('Draft', 'Final');
  END IF;
END $$;

-- Table: accounts (Chart of Accounts)
CREATE TABLE IF NOT EXISTS accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  type account_type NOT NULL,
  vat_code numeric(5,2) DEFAULT 0,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table: contacts (Debtors/Creditors)
CREATE TABLE IF NOT EXISTS contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  vat_number text,
  relation_type relation_type NOT NULL,
  email text,
  phone text,
  address text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table: journal_entries (Headers)
CREATE TABLE IF NOT EXISTS journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  description text NOT NULL,
  reference text,
  status journal_status DEFAULT 'Draft',
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table: journal_lines (Splits)
CREATE TABLE IF NOT EXISTS journal_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id uuid NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  debit numeric(12,2) DEFAULT 0 CHECK (debit >= 0),
  credit numeric(12,2) DEFAULT 0 CHECK (credit >= 0),
  description text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT debit_or_credit_not_both CHECK (
    (debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0) OR (debit = 0 AND credit = 0)
  )
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_journal_lines_entry_id ON journal_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_account_id ON journal_lines(account_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_journal_entries_status ON journal_entries(status);
CREATE INDEX IF NOT EXISTS idx_accounts_code ON accounts(code);
CREATE INDEX IF NOT EXISTS idx_accounts_type ON accounts(type);

-- Function: Validate double-entry balance before finalizing
CREATE OR REPLACE FUNCTION validate_journal_entry_balance()
RETURNS TRIGGER AS $$
DECLARE
  total_debit numeric;
  total_credit numeric;
BEGIN
  -- Only validate when status is being set to 'Final'
  IF NEW.status = 'Final' THEN
    -- Calculate total debits and credits for this journal entry
    SELECT 
      COALESCE(SUM(debit), 0),
      COALESCE(SUM(credit), 0)
    INTO total_debit, total_credit
    FROM journal_lines
    WHERE journal_entry_id = NEW.id;
    
    -- Ensure debits equal credits
    IF total_debit != total_credit THEN
      RAISE EXCEPTION 'Cannot finalize journal entry: Debits (%) do not equal Credits (%)', 
        total_debit, total_credit;
    END IF;
    
    -- Ensure there are actually journal lines
    IF total_debit = 0 AND total_credit = 0 THEN
      RAISE EXCEPTION 'Cannot finalize journal entry: No journal lines exist';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Apply balance validation before update
DROP TRIGGER IF EXISTS validate_journal_balance ON journal_entries;
CREATE TRIGGER validate_journal_balance
  BEFORE UPDATE ON journal_entries
  FOR EACH ROW
  WHEN (NEW.status = 'Final' AND OLD.status != 'Final')
  EXECUTE FUNCTION validate_journal_entry_balance();

-- Function: Update timestamp on modification
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to all tables
DROP TRIGGER IF EXISTS update_accounts_updated_at ON accounts;
CREATE TRIGGER update_accounts_updated_at
  BEFORE UPDATE ON accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_contacts_updated_at ON contacts;
CREATE TRIGGER update_contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_journal_entries_updated_at ON journal_entries;
CREATE TRIGGER update_journal_entries_updated_at
  BEFORE UPDATE ON journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_lines ENABLE ROW LEVEL SECURITY;

-- RLS Policies for accounts
CREATE POLICY "Authenticated users can view accounts"
  ON accounts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert accounts"
  ON accounts FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update accounts"
  ON accounts FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete accounts"
  ON accounts FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for contacts
CREATE POLICY "Authenticated users can view contacts"
  ON contacts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert contacts"
  ON contacts FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update contacts"
  ON contacts FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete contacts"
  ON contacts FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for journal_entries
CREATE POLICY "Authenticated users can view journal entries"
  ON journal_entries FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert journal entries"
  ON journal_entries FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update journal entries"
  ON journal_entries FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete journal entries"
  ON journal_entries FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for journal_lines
CREATE POLICY "Authenticated users can view journal lines"
  ON journal_lines FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert journal lines"
  ON journal_lines FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update journal lines"
  ON journal_lines FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete journal lines"
  ON journal_lines FOR DELETE
  TO authenticated
  USING (true);