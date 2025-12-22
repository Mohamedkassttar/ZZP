/*
  # Fix Accounts Visibility - Remove Conflicting RLS Policies
  
  ## Problem
  - Old multi-tenant policies still active on accounts table
  - These policies check company_id via get_user_company_ids_optimized()
  - Single-tenant code doesn't provide company_id, causing 0 results
  - Account 1100 (bank account) cannot be found
  
  ## Solution
  1. Remove ALL old multi-tenant policies from accounts table
  2. Keep only the simple single-tenant policy (allow all authenticated)
  3. This ensures any authenticated user can access accounts (single-tenant mode)
  
  ## Result
  - Account 1100 will be visible
  - Bank imports will work
  - Invoice creation will work
*/

-- ==========================================
-- Remove Conflicting Multi-Tenant Policies
-- ==========================================

-- Drop old company-based policies
DROP POLICY IF EXISTS "Users can view accounts of their companies" ON accounts;
DROP POLICY IF EXISTS "Users can insert accounts in their companies" ON accounts;
DROP POLICY IF EXISTS "Users can update accounts in their companies" ON accounts;
DROP POLICY IF EXISTS "Users can delete accounts in their companies" ON accounts;

-- Drop any other variations
DROP POLICY IF EXISTS "Users can view accounts of their company" ON accounts;
DROP POLICY IF EXISTS "Users can insert accounts for their company" ON accounts;
DROP POLICY IF EXISTS "Users can update accounts of their company" ON accounts;
DROP POLICY IF EXISTS "Users can delete accounts of their company" ON accounts;

-- Keep the single-tenant policy (should already exist from previous migration)
-- If it doesn't exist, create it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'accounts' 
    AND policyname = 'Single tenant: Allow all authenticated users'
  ) THEN
    CREATE POLICY "Single tenant: Allow all authenticated users"
      ON accounts FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
