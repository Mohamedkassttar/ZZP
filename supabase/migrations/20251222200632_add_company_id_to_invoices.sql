/*
  # Add company_id to invoices table

  1. Changes
    - Add company_id column to invoices table
    - Backfill existing invoices with company_id from their contact
    - Add foreign key constraint
    - Update RLS policies to use company_id

  2. Security
    - Update RLS policies to filter by company_id instead of contact
*/

-- Add company_id column (nullable first for backfill)
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS company_id uuid;

-- Backfill existing invoices with company_id from their contact
UPDATE invoices 
SET company_id = contacts.company_id
FROM contacts
WHERE invoices.contact_id = contacts.id
  AND invoices.company_id IS NULL;

-- Make company_id NOT NULL and add foreign key
ALTER TABLE invoices 
ALTER COLUMN company_id SET NOT NULL;

ALTER TABLE invoices
ADD CONSTRAINT fk_invoices_company
FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

-- Drop old RLS policies that used contact-based filtering
DROP POLICY IF EXISTS "Users can view invoices of their companies" ON invoices;
DROP POLICY IF EXISTS "Users can insert invoices in their companies" ON invoices;
DROP POLICY IF EXISTS "Users can update invoices in their companies" ON invoices;
DROP POLICY IF EXISTS "Users can delete invoices in their companies" ON invoices;

-- Create new RLS policies using company_id
CREATE POLICY "Users can view invoices of their companies"
  ON invoices FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT get_user_company_ids(auth.uid())));

CREATE POLICY "Users can insert invoices in their companies"
  ON invoices FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (SELECT get_user_company_ids(auth.uid())));

CREATE POLICY "Users can update invoices in their companies"
  ON invoices FOR UPDATE
  TO authenticated
  USING (company_id IN (SELECT get_user_company_ids(auth.uid())))
  WITH CHECK (company_id IN (SELECT get_user_company_ids(auth.uid())));

CREATE POLICY "Users can delete invoices in their companies"
  ON invoices FOR DELETE
  TO authenticated
  USING (company_id IN (SELECT get_user_company_ids(auth.uid())));
