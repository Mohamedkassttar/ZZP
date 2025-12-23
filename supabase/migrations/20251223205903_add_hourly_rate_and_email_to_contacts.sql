/*
  # Add hourly rate and email improvements to contacts

  1. Changes
    - Add `hourly_rate` column to contacts table for time tracking billing
    - Email column already exists, no changes needed

  2. Notes
    - Hourly rate is optional (nullable) - not all contacts need hourly billing
    - Email validation will be handled in application layer

  3. Security
    - No RLS changes needed (inherits existing policies)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contacts' AND column_name = 'hourly_rate'
  ) THEN
    ALTER TABLE contacts ADD COLUMN hourly_rate numeric(10,2) DEFAULT NULL;
    COMMENT ON COLUMN contacts.hourly_rate IS 'Hourly billing rate for time tracking. Used when converting time entries to invoices.';
  END IF;
END $$;
