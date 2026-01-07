/*
  # Add notes field to sales_invoices

  1. Changes
    - Add notes column to sales_invoices table for invoice notes/remarks

  2. Notes
    - This field is optional and used for displaying additional information on invoices
    - Can be displayed on invoice preview and PDF

  3. Security
    - No RLS changes needed (inherits existing policies)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales_invoices' AND column_name = 'notes'
  ) THEN
    ALTER TABLE sales_invoices ADD COLUMN notes text DEFAULT NULL;
    COMMENT ON COLUMN sales_invoices.notes IS 'Optional notes or remarks for the invoice';
  END IF;
END $$;
