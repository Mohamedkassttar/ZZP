/*
  # Create sales_invoices table for portal functionality

  1. New Tables
    - `sales_invoices`
      - `id` (uuid, primary key) - Unique identifier for sales invoice
      - `created_at` (timestamptz) - When invoice was created
      - `invoice_number` (text) - Invoice number
      - `date` (date) - Invoice date
      - `contact_id` (uuid, foreign key) - References the customer
      - `total_amount` (numeric) - Total invoice amount
      - `vat_amount` (numeric) - VAT amount
      - `status` (text) - Invoice status (open, paid, overdue)
      - `pdf_url` (text, nullable) - URL to PDF document

  2. Security
    - Enable RLS on `sales_invoices` table
    - Add policies for anon access (portal functionality)
*/

CREATE TABLE IF NOT EXISTS sales_invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  invoice_number TEXT,
  date DATE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  total_amount NUMERIC(10,2) DEFAULT 0,
  vat_amount NUMERIC(10,2) DEFAULT 0,
  status TEXT DEFAULT 'open',
  pdf_url TEXT
);

ALTER TABLE sales_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon read access to sales_invoices"
  ON sales_invoices FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon insert access to sales_invoices"
  ON sales_invoices FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anon update access to sales_invoices"
  ON sales_invoices FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon delete access to sales_invoices"
  ON sales_invoices FOR DELETE
  TO anon
  USING (true);

CREATE INDEX IF NOT EXISTS idx_sales_invoices_contact_id ON sales_invoices(contact_id);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_status ON sales_invoices(status);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_date ON sales_invoices(date);