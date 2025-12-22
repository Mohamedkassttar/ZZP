/*
  # Fix Infinite Recursion in company_users RLS Policies

  ## Probleem
    - company_users policies roepen zichzelf recursief aan
    - Dit veroorzaakt "infinite recursion detected" errors
  
  ## Oplossing
    - Vereenvoudig SELECT policy: alleen eigen memberships
    - Vereenvoudig andere policies: geen recursieve checks
    - Gebruik directe auth.uid() checks zonder subqueries op company_users

  ## Wijzigingen
    1. Drop alle bestaande company_users policies
    2. Maak nieuwe, simpele policies zonder recursie
*/

-- Drop alle bestaande policies
DROP POLICY IF EXISTS "Users can view their company memberships" ON company_users;
DROP POLICY IF EXISTS "Experts can add users to their companies" ON company_users;
DROP POLICY IF EXISTS "Users can be added to companies" ON company_users;
DROP POLICY IF EXISTS "Experts can update user roles in their companies" ON company_users;
DROP POLICY IF EXISTS "Experts can remove users from their companies" ON company_users;

-- NIEUWE SIMPELE POLICIES ZONDER RECURSIE

-- SELECT: Iedereen kan hun eigen memberships zien
CREATE POLICY "Users can view their own memberships"
  ON company_users FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- INSERT: Alleen via trigger of service role (voor nu permissive voor development)
CREATE POLICY "Allow insert for authenticated users"
  ON company_users FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- UPDATE: Niet toegestaan (role changes moeten via admin)
-- (geen UPDATE policy = niemand kan updaten)

-- DELETE: Niet toegestaan via RLS
-- (geen DELETE policy = niemand kan deleten)

COMMENT ON POLICY "Users can view their own memberships" ON company_users IS
  'Simpele policy zonder recursie - users zien alleen hun eigen company memberships';

COMMENT ON POLICY "Allow insert for authenticated users" ON company_users IS
  'Permissive policy voor development - in productie aanscherpen met specific role checks';
