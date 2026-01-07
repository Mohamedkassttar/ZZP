/*
  # Add SMTP Email Settings to Company Settings

  1. Changes
    - Adds SMTP configuration columns to company_settings table
    - Enables email sending functionality with custom SMTP servers
    
  2. New Columns
    - `smtp_host` (text) - SMTP server hostname (e.g., smtp.office365.com)
    - `smtp_port` (integer) - SMTP server port (e.g., 587)
    - `smtp_user` (text) - SMTP username/email address
    - `smtp_password` (text) - SMTP password or app-specific password
    - `smtp_secure` (boolean) - Use TLS/SSL encryption (default: true)
    - `sender_name` (text) - Display name for outgoing emails
    - `sender_email` (text) - From email address for outgoing emails
  
  3. Notes
    - Passwords are stored as plain text for now (consider encryption in production)
    - Users should use app-specific passwords for Gmail/Outlook with 2FA
    - Settings are per-company for multi-tenant support
*/

-- Add SMTP configuration columns to company_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'company_settings' AND column_name = 'smtp_host'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN smtp_host text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'company_settings' AND column_name = 'smtp_port'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN smtp_port integer DEFAULT 587;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'company_settings' AND column_name = 'smtp_user'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN smtp_user text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'company_settings' AND column_name = 'smtp_password'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN smtp_password text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'company_settings' AND column_name = 'smtp_secure'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN smtp_secure boolean DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'company_settings' AND column_name = 'sender_name'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN sender_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'company_settings' AND column_name = 'sender_email'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN sender_email text;
  END IF;
END $$;

-- Add helpful comments
COMMENT ON COLUMN company_settings.smtp_host IS 'SMTP server hostname (e.g., smtp.gmail.com, smtp.office365.com)';
COMMENT ON COLUMN company_settings.smtp_port IS 'SMTP server port (587 for TLS, 465 for SSL, 25 for unencrypted)';
COMMENT ON COLUMN company_settings.smtp_user IS 'SMTP username or email address for authentication';
COMMENT ON COLUMN company_settings.smtp_password IS 'SMTP password or app-specific password';
COMMENT ON COLUMN company_settings.smtp_secure IS 'Enable TLS/SSL encryption for SMTP connection';
COMMENT ON COLUMN company_settings.sender_name IS 'Display name shown in From field of emails';
COMMENT ON COLUMN company_settings.sender_email IS 'Email address shown in From field';
