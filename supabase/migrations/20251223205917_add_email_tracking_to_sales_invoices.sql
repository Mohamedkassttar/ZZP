/*
  # Add email tracking to sales invoices

  1. Changes
    - Add `sent_to_email` column to track recipient email address
    - Add `last_sent_at` column to track when invoice was last emailed

  2. Notes
    - These fields support the invoice email functionality
    - sent_to_email is nullable (invoices don't have to be emailed)
    - last_sent_at tracks the most recent email send timestamp

  3. Security
    - No RLS changes needed (inherits existing policies)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales_invoices' AND column_name = 'sent_to_email'
  ) THEN
    ALTER TABLE sales_invoices ADD COLUMN sent_to_email text DEFAULT NULL;
    COMMENT ON COLUMN sales_invoices.sent_to_email IS 'Email address where invoice was sent';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales_invoices' AND column_name = 'last_sent_at'
  ) THEN
    ALTER TABLE sales_invoices ADD COLUMN last_sent_at timestamptz DEFAULT NULL;
    COMMENT ON COLUMN sales_invoices.last_sent_at IS 'Timestamp when invoice was last emailed';
  END IF;
END $$;
