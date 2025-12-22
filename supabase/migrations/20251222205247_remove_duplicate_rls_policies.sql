/*
  # Remove Duplicate RLS Policies
  
  This migration removes duplicate permissive policies that cause security warnings.
  When multiple permissive policies exist for the same action, Postgres uses OR logic,
  which can create unintended security holes.
  
  ## Changes
  - Remove old "Enable all access for all users" policies from fiscal_years
  - Remove old duplicate policies from invoices
  - Keep only the company-scoped policies
  
  ## Security Impact
  - Eliminates redundant access paths
  - Ensures consistent security model across all tables
  - Maintains same access for legitimate users
*/

-- Remove old fiscal_years policies
DROP POLICY IF EXISTS "Enable all access for all users" ON fiscal_years;

-- Remove old invoices policies (keeping the company-scoped ones we just created)
DROP POLICY IF EXISTS "Users can view invoices" ON invoices;
DROP POLICY IF EXISTS "Users can insert invoices" ON invoices;
DROP POLICY IF EXISTS "Users can update invoices" ON invoices;
DROP POLICY IF EXISTS "Users can delete invoices" ON invoices;
