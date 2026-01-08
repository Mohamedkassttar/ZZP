/*
  # Switch to EmailJS Configuration

  1. Changes
    - Remove SMTP-related columns from company_settings
    - Add EmailJS configuration columns:
      - emailjs_service_id (text) - EmailJS service identifier
      - emailjs_template_id (text) - EmailJS template identifier  
      - emailjs_public_key (text) - EmailJS public API key

  2. Notes
    - EmailJS is a client-side email service that works without backend
    - Users need to create a free account at EmailJS.com
    - Existing SMTP data will be preserved in case rollback is needed
*/

-- Add EmailJS columns to company_settings
DO $$
BEGIN
  -- Add emailjs_service_id if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'company_settings' AND column_name = 'emailjs_service_id'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN emailjs_service_id text;
  END IF;

  -- Add emailjs_template_id if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'company_settings' AND column_name = 'emailjs_template_id'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN emailjs_template_id text;
  END IF;

  -- Add emailjs_public_key if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'company_settings' AND column_name = 'emailjs_public_key'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN emailjs_public_key text;
  END IF;
END $$;