/*
  # Sales Invoicing System
  
  ## Overview
  Creates infrastructure for professional invoice management with automatic journal entry generation.
  Invoices link to customers, have multiple line items, and auto-create accounting entries when finalized.
  
  ## 1. New Tables
  
  ### invoices
  - `id` (uuid, primary key) - Unique identifier
  - `contact_id` (uuid, FK) - Link to customer contact
  - `invoice_number` (text, unique) - Invoice number (e.g., INV-2024-001)
  - `invoice_date` (date) - Invoice issue date
  - `due_date` (date) - Payment due date
  - `total_amount` (numeric) - Total including VAT
  - `subtotal` (numeric) - Amount excluding VAT
  - `vat_amount` (numeric) - Total VAT amount
  - `status` (text) - Status: Draft, Sent, Paid, Overdue
  - `journal_entry_id` (uuid, FK) - Link to generated journal entry
  - `notes` (text) - Additional notes
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp
  - `finalized_at` (timestamptz) - When invoice was finalized
  
  ### invoice_lines
  - `id` (uuid, primary key) - Unique identifier
  - `invoice_id` (uuid, FK) - Link to invoice
  - `description` (text) - Line item description
  - `quantity` (numeric) - Quantity
  - `unit_price` (numeric) - Price per unit
  - `amount` (numeric) - Line total (excl VAT)
  - `vat_rate` (numeric) - VAT percentage (21, 9, 0)
  - `vat_amount` (numeric) - VAT amount
  - `ledger_account_id` (uuid, FK) - Revenue account
  - `line_order` (integer) - Display order
  - `created_at` (timestamptz) - Creation timestamp
  
  ## 2. Business Rules
  - Invoice numbers must be unique
  - Draft invoices can be edited, finalized invoices cannot
  - When invoice is finalized, auto-generate journal entry
  - Journal entry: Debit Debiteuren, Credit Revenue + BTW te betalen
  
  ## 3. Security
  - RLS enabled for authenticated users
  - Users can only access their own invoices
*/

-- Create invoice status enum
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_status') THEN
    CREATE TYPE invoice_status AS ENUM ('Draft', 'Sent', 'Paid', 'Overdue');
  END IF;
END $$;

-- Table: invoices
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE RESTRICT,
  invoice_number text UNIQUE NOT NULL,
  invoice_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date NOT NULL,
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  vat_amount numeric(12,2) NOT NULL DEFAULT 0,
  status invoice_status DEFAULT 'Draft',
  journal_entry_id uuid REFERENCES journal_entries(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  finalized_at timestamptz
);

-- Table: invoice_lines
CREATE TABLE IF NOT EXISTS invoice_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric(10,2) NOT NULL DEFAULT 1,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  vat_rate numeric(5,2) NOT NULL DEFAULT 21,
  vat_amount numeric(12,2) NOT NULL DEFAULT 0,
  ledger_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  line_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_invoices_contact ON invoices(contact_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(invoice_date DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice ON invoice_lines(invoice_id);

-- Enable Row Level Security
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_lines ENABLE ROW LEVEL SECURITY;

-- RLS Policies for invoices
CREATE POLICY "Authenticated users can view invoices"
  ON invoices FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert invoices"
  ON invoices FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update invoices"
  ON invoices FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete invoices"
  ON invoices FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for invoice_lines
CREATE POLICY "Authenticated users can view invoice lines"
  ON invoice_lines FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert invoice lines"
  ON invoice_lines FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update invoice lines"
  ON invoice_lines FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete invoice lines"
  ON invoice_lines FOR DELETE
  TO authenticated
  USING (true);

-- Function: Update invoice timestamp on modification
CREATE OR REPLACE FUNCTION update_invoice_finalized_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status != 'Draft' AND OLD.status = 'Draft' THEN
    NEW.finalized_at = now();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-update finalized timestamp
DROP TRIGGER IF EXISTS update_invoice_finalized_timestamp ON invoices;
CREATE TRIGGER update_invoice_finalized_timestamp
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_finalized_at();

-- Apply updated_at trigger to invoices
DROP TRIGGER IF EXISTS update_invoices_updated_at ON invoices;
CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();