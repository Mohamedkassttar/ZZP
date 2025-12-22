/*
  # Auto-koppel User aan Nieuw Bedrijf

  ## Probleem
    - Als user een nieuw bedrijf aanmaakt, heeft die geen toegang tot het nieuwe bedrijf
    - company_users entry ontbreekt waardoor SELECT query het bedrijf niet returned
    - User ziet het nieuw aangemaakte bedrijf niet in de lijst
  
  ## Oplossing
    - Trigger die automatisch een company_users entry maakt
    - User die bedrijf aanmaakt krijgt automatisch 'owner' role
    - Werkt alleen voor authenticated users
  
  ## Wijzigingen
    1. Trigger functie: link_user_to_new_company()
    2. Trigger: AFTER INSERT op companies table
    3. Maakt automatisch company_users entry aan met 'owner' role
*/

-- Functie om user te koppelen aan nieuw bedrijf
CREATE OR REPLACE FUNCTION link_user_to_new_company()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Koppel de huidige user aan het nieuwe bedrijf als owner
  IF auth.uid() IS NOT NULL THEN
    INSERT INTO company_users (company_id, user_id, role, created_at)
    VALUES (NEW.id, auth.uid(), 'owner', now())
    ON CONFLICT (company_id, user_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger die automatisch user koppelt aan nieuw bedrijf
DROP TRIGGER IF EXISTS on_company_created ON companies;
CREATE TRIGGER on_company_created
  AFTER INSERT ON companies
  FOR EACH ROW
  EXECUTE FUNCTION link_user_to_new_company();

-- Commentaar
COMMENT ON FUNCTION link_user_to_new_company() IS 
  'Trigger functie: koppelt user automatisch aan nieuw aangemaakt bedrijf met owner role';
