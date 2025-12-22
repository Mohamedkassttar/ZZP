/*
  # Fix Accounts Unique Constraint for Multi-Tenant

  1. Problem
    - The `accounts_code_key` constraint makes `code` globally unique
    - This prevents multiple companies from having the same account codes
    - Each company should have its own chart of accounts with the same codes

  2. Changes
    - Drop the old global unique constraint on `code`
    - Add a new unique constraint on `(company_id, code)`
    - This allows each company to have accounts with code "1000", "8000", etc.

  3. Impact
    - Fixes the multi-tenant account system
    - Allows companies to have their own chart of accounts
*/

-- Drop the incorrect global unique constraint
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_code_key;

-- Add the correct per-company unique constraint
ALTER TABLE accounts ADD CONSTRAINT accounts_company_code_key UNIQUE (company_id, code);
