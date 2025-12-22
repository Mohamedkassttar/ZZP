/*
  # Automatische User-Company Koppeling Trigger

  ## Functionaliteit
    - Elke nieuwe user wordt automatisch gekoppeld aan Demo Bedrijf
    - Werkt direct na registratie
    - Geen handmatige actie nodig

  ## Details
    1. Trigger functie: link_new_user_to_demo_company()
    2. Trigger: after insert on auth.users
    3. Zoekt Demo Bedrijf en koppelt nieuwe user als 'expert'
*/

-- Functie die nieuwe user koppelt aan Demo Bedrijf
CREATE OR REPLACE FUNCTION link_new_user_to_demo_company()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  demo_company_id uuid;
BEGIN
  -- Haal Demo Bedrijf ID op
  SELECT id INTO demo_company_id
  FROM public.companies
  WHERE name = 'Demo Bedrijf'
  LIMIT 1;

  -- Als Demo Bedrijf bestaat, koppel user
  IF demo_company_id IS NOT NULL THEN
    INSERT INTO public.company_users (company_id, user_id, role)
    VALUES (demo_company_id, NEW.id, 'expert')
    ON CONFLICT (company_id, user_id) DO NOTHING;
    
    RAISE NOTICE 'User % gekoppeld aan Demo Bedrijf', NEW.email;
  ELSE
    RAISE WARNING 'Demo Bedrijf niet gevonden voor user %', NEW.email;
  END IF;

  RETURN NEW;
END;
$$;

-- Drop oude trigger als die bestaat
DROP TRIGGER IF EXISTS on_auth_user_created_link_to_company ON auth.users;

-- Maak trigger aan
CREATE TRIGGER on_auth_user_created_link_to_company
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION link_new_user_to_demo_company();

-- Commentaar
COMMENT ON FUNCTION link_new_user_to_demo_company() IS 
  'Koppelt nieuwe users automatisch aan Demo Bedrijf met role expert';