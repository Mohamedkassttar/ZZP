/*
  # Automatische Demo Company Aanmaak voor Nieuwe Users

  ## Probleem
    - Nieuwe users worden gekoppeld aan Demo Bedrijf
    - Maar Demo Bedrijf bestaat mogelijk niet
    - Dit veroorzaakt RLS errors
  
  ## Oplossing
    - Update trigger om automatisch Demo Bedrijf aan te maken
    - Als Demo Bedrijf niet bestaat, maak die dan aan met SECURITY DEFINER
    - Koppel user automatisch aan Demo Bedrijf
  
  ## Voordelen
    - Geen handmatige setup nodig
    - Werkt out-of-the-box voor nieuwe users
    - SECURITY DEFINER bypassed RLS voor system operaties
*/

-- Update functie om automatisch Demo Bedrijf aan te maken
CREATE OR REPLACE FUNCTION link_new_user_to_demo_company()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  demo_company_id uuid;
BEGIN
  -- Probeer Demo Bedrijf te vinden
  SELECT id INTO demo_company_id
  FROM companies
  WHERE name = 'Demo Bedrijf'
  LIMIT 1;

  -- Als Demo Bedrijf niet bestaat, maak die aan
  IF demo_company_id IS NULL THEN
    INSERT INTO companies (
      name,
      registration_number,
      tax_number,
      is_active,
      created_at,
      updated_at
    ) VALUES (
      'Demo Bedrijf',
      '00000000',
      'NL000000000B01',
      true,
      now(),
      now()
    )
    RETURNING id INTO demo_company_id;
    
    RAISE NOTICE 'Demo Bedrijf aangemaakt met ID: %', demo_company_id;
  END IF;

  -- Koppel user aan Demo Bedrijf
  INSERT INTO company_users (company_id, user_id, role)
  VALUES (demo_company_id, NEW.id, 'expert')
  ON CONFLICT (company_id, user_id) DO NOTHING;
  
  RAISE NOTICE 'User % gekoppeld aan Demo Bedrijf', NEW.email;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error maar laat user aanmaken wel doorgaan
  RAISE WARNING 'Fout bij koppelen user aan Demo Bedrijf: %', SQLERRM;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION link_new_user_to_demo_company() IS
  'Maakt Demo Bedrijf aan als die niet bestaat en koppelt nieuwe user automatisch met role expert';
