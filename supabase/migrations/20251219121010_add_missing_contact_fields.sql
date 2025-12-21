/*
  # Add Missing Contact Fields for CRM

  1. Changes to `contacts` table
    - Add `contact_person` (text) - Name of the contact person
    - Add `postal_code` (text) - Postal/ZIP code
    - Add `city` (text) - City name
    - Add `country` (text) - Country name with default 'Netherlands'
    - Add `coc_number` (text) - KvK (Chamber of Commerce) number
    - Add `payment_term_days` (integer) - Payment terms in days, default 14
    - Add `iban` (text) - Bank account number

  2. Notes
    - All new fields are nullable except country and payment_term_days which have defaults
    - Existing data is preserved
*/

-- Add missing fields to contacts table
DO $$
BEGIN
  -- Add contact_person if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contacts' AND column_name = 'contact_person'
  ) THEN
    ALTER TABLE contacts ADD COLUMN contact_person text;
  END IF;

  -- Add postal_code if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contacts' AND column_name = 'postal_code'
  ) THEN
    ALTER TABLE contacts ADD COLUMN postal_code text;
  END IF;

  -- Add city if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contacts' AND column_name = 'city'
  ) THEN
    ALTER TABLE contacts ADD COLUMN city text;
  END IF;

  -- Add country if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contacts' AND column_name = 'country'
  ) THEN
    ALTER TABLE contacts ADD COLUMN country text DEFAULT 'Netherlands';
  END IF;

  -- Add coc_number if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contacts' AND column_name = 'coc_number'
  ) THEN
    ALTER TABLE contacts ADD COLUMN coc_number text;
  END IF;

  -- Add payment_term_days if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contacts' AND column_name = 'payment_term_days'
  ) THEN
    ALTER TABLE contacts ADD COLUMN payment_term_days integer DEFAULT 14;
  END IF;

  -- Add iban if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contacts' AND column_name = 'iban'
  ) THEN
    ALTER TABLE contacts ADD COLUMN iban text;
  END IF;
END $$;
