/*
  # Create Purchase Invoices Table

  1. New Tables
    - `purchase_invoices`
      - `id` (uuid, primary key) - Unique identifier
      - `contact_id` (uuid, foreign key to contacts) - The supplier
      - `invoice_number` (text, unique) - Supplier's invoice number
      - `invoice_date` (date) - Date on the invoice
      - `due_date` (date) - Payment due date
      - `total_amount` (numeric) - Total including VAT
      - `subtotal` (numeric) - Amount before VAT
      - `vat_amount` (numeric) - VAT amount
      - `net_amount` (numeric) - Net amount
      - `status` (enum) - Draft, Pending, Paid, Overdue
      - `journal_entry_id` (uuid, foreign key) - Link to journal entry when booked
      - `description` (text) - Invoice description
      - `document_id` (uuid, foreign key) - Link to inbox document
      - `payment_reference` (text) - Payment reference number
      - `notes` (text) - Additional notes
      - `created_at` (timestamptz) - Record creation timestamp
      - `updated_at` (timestamptz) - Last update timestamp
      - `paid_at` (timestamptz) - Payment date

  2. Security
    - Enable RLS on `purchase_invoices` table
    - Add policy for authenticated users (anon access for now)

  3. Purpose
    - Track supplier invoices (inkoopfacturen) separately from sales invoices
    - Enable bank transaction matching for expense transactions
    - Support automated booking from documents inbox
*/

-- Create purchase invoice status enum if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'purchase_invoice_status') THEN
    CREATE TYPE purchase_invoice_status AS ENUM ('Draft', 'Pending', 'Paid', 'Overdue');
  END IF;
END $$;

-- Create purchase_invoices table
CREATE TABLE IF NOT EXISTS purchase_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE RESTRICT,
  invoice_number text NOT NULL,
  invoice_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date NOT NULL,
  total_amount numeric NOT NULL DEFAULT 0,
  subtotal numeric NOT NULL DEFAULT 0,
  vat_amount numeric NOT NULL DEFAULT 0,
  net_amount numeric DEFAULT 0,
  status purchase_invoice_status DEFAULT 'Draft',
  journal_entry_id uuid REFERENCES journal_entries(id) ON DELETE SET NULL,
  description text,
  document_id uuid REFERENCES documents_inbox(id) ON DELETE SET NULL,
  payment_reference text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  paid_at timestamptz,
  
  CONSTRAINT unique_supplier_invoice UNIQUE (contact_id, invoice_number)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_contact_id ON purchase_invoices(contact_id);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_invoice_date ON purchase_invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_status ON purchase_invoices(status);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_total_amount ON purchase_invoices(total_amount);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_journal_entry_id ON purchase_invoices(journal_entry_id);

-- Enable Row Level Security
ALTER TABLE purchase_invoices ENABLE ROW LEVEL SECURITY;

-- Create policies for anon access (since app uses anon key)
CREATE POLICY "Allow anon to read purchase_invoices"
  ON purchase_invoices FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon to insert purchase_invoices"
  ON purchase_invoices FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anon to update purchase_invoices"
  ON purchase_invoices FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon to delete purchase_invoices"
  ON purchase_invoices FOR DELETE
  TO anon
  USING (true);

-- Create policies for authenticated users
CREATE POLICY "Allow authenticated to read purchase_invoices"
  ON purchase_invoices FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated to insert purchase_invoices"
  ON purchase_invoices FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated to update purchase_invoices"
  ON purchase_invoices FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated to delete purchase_invoices"
  ON purchase_invoices FOR DELETE
  TO authenticated
  USING (true);

-- Add comment explaining the difference
COMMENT ON TABLE purchase_invoices IS 'Purchase invoices (inkoopfacturen) received from suppliers. Separate from sales invoices which track revenue.';
