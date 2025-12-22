/*
  # Fix Companies INSERT Policy

  ## Probleem
    - INSERT op companies table geeft 403 error
    - WITH CHECK (true) werkt niet correct
    - Mogelijk conflict met created_by kolom check
  
  ## Oplossing
    - Drop bestaande INSERT policy
    - Maak nieuwe policy met expliciete created_by check
    - Zorg dat authenticated users altijd hun eigen bedrijven kunnen aanmaken
  
  ## Wijzigingen
    - DROP oude INSERT policy
    - CREATE nieuwe INSERT policy met created_by = auth.uid() check
*/

-- Drop bestaande policy
DROP POLICY IF EXISTS "Authenticated users can create companies" ON companies;

-- Nieuwe INSERT policy die checkt of created_by = auth.uid()
CREATE POLICY "Authenticated users can create companies"
  ON companies FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid() OR created_by IS NULL
  );

-- Commentaar
COMMENT ON POLICY "Authenticated users can create companies" ON companies IS 
  'Users kunnen bedrijven aanmaken als ze de created_by waarde op hun eigen user_id zetten';
