/*
  # Fix time_entries foreign key constraint
  
  1. Problem
    - time_entries.invoice_id has a foreign key constraint pointing to sales_invoices
    - The application creates invoices in the invoices table
    - This causes a 409 Conflict error when updating time_entries with an invoice_id
  
  2. Changes
    - Drop the incorrect foreign key constraint time_entries_invoice_id_fkey
    - Add a new foreign key constraint pointing to invoices table instead
    - Use ON DELETE SET NULL so time entries become available again if invoice is deleted
  
  3. Impact
    - Fixes the 409 Conflict error when linking time entries to invoices
    - Time entries can now be properly linked to invoices created via the application
*/

-- Drop the old, incorrect foreign key constraint
ALTER TABLE time_entries
DROP CONSTRAINT IF EXISTS time_entries_invoice_id_fkey;

-- Add the correct foreign key constraint pointing to invoices table
ALTER TABLE time_entries
ADD CONSTRAINT time_entries_invoice_id_fkey
  FOREIGN KEY (invoice_id)
  REFERENCES invoices(id)
  ON DELETE SET NULL;
