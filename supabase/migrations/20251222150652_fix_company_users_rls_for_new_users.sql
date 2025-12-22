/*
  # Fix Company Users RLS voor Nieuwe Gebruikers

  ## Probleem
    Nieuwe gebruikers kunnen zichzelf niet toevoegen aan Demo Bedrijf
    door te strikte RLS policies.

  ## Oplossing
    - Update INSERT policy om nieuwe gebruikers toe te staan zichzelf
      toe te voegen aan Demo Bedrijf als ze nog nergens lid van zijn
    - Voeg helper function toe om users automatisch te koppelen

  ## Security
    - Users kunnen alleen zichzelf toevoegen
    - Alleen aan Demo Bedrijf als ze nog nergens lid zijn
    - Experts kunnen nog steeds users toevoegen aan hun companies
*/

-- DROP OUDE INSERT POLICY
DROP POLICY IF EXISTS "Experts can add users to their companies" ON company_users;

-- NIEUWE FLEXIBELE INSERT POLICY
CREATE POLICY "Users can be added to companies"
  ON company_users FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Experts kunnen users toevoegen aan hun companies
    EXISTS (
      SELECT 1 FROM company_users cu
      WHERE cu.company_id = company_users.company_id
      AND cu.user_id = auth.uid()
      AND cu.role = 'expert'
    )
    OR
    -- Als er helemaal geen company_users zijn (eerste user)
    NOT EXISTS (
      SELECT 1 FROM company_users
    )
    OR
    -- Users kunnen zichzelf toevoegen aan Demo Bedrijf als ze nog nergens lid zijn
    (
      company_users.user_id = auth.uid()
      AND company_users.company_id IN (
        SELECT id FROM companies WHERE name = 'Demo Bedrijf'
      )
      AND NOT EXISTS (
        SELECT 1 FROM company_users cu2
        WHERE cu2.user_id = auth.uid()
      )
    )
  );

-- FUNCTIE OM HUIDIGE USER AAN DEMO BEDRIJF TE KOPPELEN
CREATE OR REPLACE FUNCTION ensure_user_has_company()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  demo_company_id uuid;
  user_has_access boolean;
BEGIN
  -- Check of user al toegang heeft tot een bedrijf
  SELECT EXISTS (
    SELECT 1 FROM company_users
    WHERE user_id = auth.uid()
  ) INTO user_has_access;

  -- Als user nog geen toegang heeft, koppel aan Demo Bedrijf
  IF NOT user_has_access THEN
    -- Haal Demo Bedrijf ID op
    SELECT id INTO demo_company_id
    FROM companies
    WHERE name = 'Demo Bedrijf'
    LIMIT 1;

    -- Als Demo Bedrijf bestaat, koppel user eraan
    IF demo_company_id IS NOT NULL THEN
      INSERT INTO company_users (company_id, user_id, role)
      VALUES (demo_company_id, auth.uid(), 'expert')
      ON CONFLICT (company_id, user_id) DO NOTHING;
      
      RAISE NOTICE 'User % gekoppeld aan Demo Bedrijf', auth.uid();
    END IF;
  END IF;
END;
$$;

-- GRANT EXECUTE AAN AUTHENTICATED USERS
GRANT EXECUTE ON FUNCTION ensure_user_has_company() TO authenticated;