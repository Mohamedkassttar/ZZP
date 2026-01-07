/*
  # Add company details to company_settings

  1. Changes
    - Add company_name column for company name
    - Add address column for street address
    - Add postal_code column for postal code
    - Add city column for city name
    - Add phone column for phone number
    - Add email column for email address
    - Add vat_number column for VAT/BTW number
    - Add kvk_number column for KVK (Chamber of Commerce) number
    - Add bank_account column for IBAN bank account

  2. Notes
    - These fields are used for invoice generation and display
    - All fields are nullable (optional)
    - Company can fill these in via Settings

  3. Security
    - No RLS changes needed (inherits existing policies)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'company_name'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN company_name text DEFAULT NULL;
    COMMENT ON COLUMN company_settings.company_name IS 'Company name for invoices';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'address'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN address text DEFAULT NULL;
    COMMENT ON COLUMN company_settings.address IS 'Street address';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'postal_code'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN postal_code text DEFAULT NULL;
    COMMENT ON COLUMN company_settings.postal_code IS 'Postal code';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'city'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN city text DEFAULT NULL;
    COMMENT ON COLUMN company_settings.city IS 'City name';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'phone'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN phone text DEFAULT NULL;
    COMMENT ON COLUMN company_settings.phone IS 'Phone number';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'email'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN email text DEFAULT NULL;
    COMMENT ON COLUMN company_settings.email IS 'Company email address';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'vat_number'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN vat_number text DEFAULT NULL;
    COMMENT ON COLUMN company_settings.vat_number IS 'VAT/BTW number';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'kvk_number'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN kvk_number text DEFAULT NULL;
    COMMENT ON COLUMN company_settings.kvk_number IS 'Chamber of Commerce number';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'bank_account'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN bank_account text DEFAULT NULL;
    COMMENT ON COLUMN company_settings.bank_account IS 'IBAN bank account number';
  END IF;
END $$;
