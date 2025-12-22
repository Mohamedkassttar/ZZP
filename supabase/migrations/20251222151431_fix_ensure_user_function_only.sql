/*
  # Fix ensure_user_has_company Functie (alleen functie update)

  ## Probleem
    auth.uid() retourneert NULL binnen SECURITY DEFINER context

  ## Oplossing
    Vervang door SECURITY INVOKER zodat auth.uid() wel werkt
*/

-- DROP OUDE FUNCTIE
DROP FUNCTION IF EXISTS ensure_user_has_company();

-- NIEUWE FUNCTIE MET SECURITY INVOKER
CREATE OR REPLACE FUNCTION ensure_user_has_company()
RETURNS TABLE(success boolean, message text)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  demo_company_id uuid;
  user_has_access boolean;
  current_user_id uuid;
BEGIN
  -- Haal huidige user ID op
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN QUERY SELECT false, 'Geen authenticated user gevonden'::text;
    RETURN;
  END IF;

  -- Check of user al toegang heeft tot een bedrijf
  SELECT EXISTS (
    SELECT 1 FROM company_users
    WHERE user_id = current_user_id
  ) INTO user_has_access;

  -- Als user al toegang heeft, stop hier
  IF user_has_access THEN
    RETURN QUERY SELECT true, 'User heeft al toegang tot een bedrijf'::text;
    RETURN;
  END IF;

  -- Haal Demo Bedrijf ID op
  SELECT id INTO demo_company_id
  FROM companies
  WHERE name = 'Demo Bedrijf'
  LIMIT 1;

  -- Als Demo Bedrijf niet bestaat, geef bericht
  IF demo_company_id IS NULL THEN
    RETURN QUERY SELECT false, 'Demo Bedrijf niet gevonden'::text;
    RETURN;
  END IF;

  -- Koppel user aan Demo Bedrijf
  INSERT INTO company_users (company_id, user_id, role)
  VALUES (demo_company_id, current_user_id, 'expert')
  ON CONFLICT (company_id, user_id) DO NOTHING;
  
  RETURN QUERY SELECT true, format('User %s gekoppeld aan Demo Bedrijf', current_user_id)::text;
END;
$$;

-- GRANT EXECUTE AAN AUTHENTICATED USERS
GRANT EXECUTE ON FUNCTION ensure_user_has_company() TO authenticated;