/*
  # Fix Companies RLS Policies
  
  ## Probleem
    - INSERT policy op companies is te restrictief voor nieuwe users
    - Policies gebruiken directe queries op company_users (recursie gevaar)
    
  ## Oplossing
    - Update policies om helper functie te gebruiken
    - Simplify INSERT policy: iedereen kan company aanmaken (wordt later via trigger gekoppeld)
    - De link naar company_users gebeurt via trigger, niet via RLS check
  
  ## Wijzigingen
    - DROP oude policies
    - CREATE nieuwe simpele policies
*/

-- Drop alle oude policies
DROP POLICY IF EXISTS "Users can view companies they have access to" ON companies;
DROP POLICY IF EXISTS "Experts can create companies" ON companies;
DROP POLICY IF EXISTS "Experts can update their companies" ON companies;
DROP POLICY IF EXISTS "Experts can delete their companies" ON companies;

-- SELECT: Gebruik helper functie
CREATE POLICY "Users can view their companies"
  ON companies FOR SELECT
  TO authenticated
  USING (
    id IN (SELECT get_user_company_ids(auth.uid()))
  );

-- INSERT: Iedereen kan company aanmaken (trigger zorgt voor koppeling)
CREATE POLICY "Authenticated users can create companies"
  ON companies FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- UPDATE: Alleen via helper functie check
CREATE POLICY "Users can update their companies"
  ON companies FOR UPDATE
  TO authenticated
  USING (
    id IN (SELECT get_user_company_ids(auth.uid()))
  )
  WITH CHECK (
    id IN (SELECT get_user_company_ids(auth.uid()))
  );

-- DELETE: Alleen via helper functie check
CREATE POLICY "Users can delete their companies"
  ON companies FOR DELETE
  TO authenticated
  USING (
    id IN (SELECT get_user_company_ids(auth.uid()))
  );

COMMENT ON POLICY "Users can view their companies" ON companies IS
  'Uses helper function to avoid recursion';
COMMENT ON POLICY "Authenticated users can create companies" ON companies IS
  'Permissive policy - trigger handles company_users link';
COMMENT ON POLICY "Users can update their companies" ON companies IS
  'Uses helper function to avoid recursion';
COMMENT ON POLICY "Users can delete their companies" ON companies IS
  'Uses helper function to avoid recursion';
