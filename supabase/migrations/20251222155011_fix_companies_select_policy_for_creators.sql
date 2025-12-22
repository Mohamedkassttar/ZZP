/*
  # Fix Companies SELECT Policy for Creators

  ## Probleem
    - Na INSERT op companies faalt de SELECT omdat company_users entry nog niet bestaat
    - De trigger maakt pas DAARNA de company_users entry aan
    - SELECT policy checkt alleen get_user_company_ids() wat company_users entries vereist
  
  ## Oplossing
    - Update SELECT policy om ook bedrijven te tonen waar user de creator is
    - Check: created_by = auth.uid() OR id IN (SELECT get_user_company_ids())
  
  ## Wijzigingen
    - DROP oude SELECT policy
    - CREATE nieuwe SELECT policy met extra created_by check
*/

-- Drop bestaande SELECT policy
DROP POLICY IF EXISTS "Users can view their companies" ON companies;

-- Nieuwe SELECT policy die zowel company_users als created_by checkt
CREATE POLICY "Users can view their companies"
  ON companies FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid() 
    OR 
    id IN (SELECT get_user_company_ids(auth.uid()))
  );

-- Commentaar
COMMENT ON POLICY "Users can view their companies" ON companies IS 
  'Users kunnen bedrijven zien waar ze lid van zijn OF waar ze de creator van zijn';
