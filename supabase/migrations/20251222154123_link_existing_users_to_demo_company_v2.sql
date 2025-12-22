/*
  # Koppel Bestaande Users aan Demo Bedrijf

  ## Probleem
    - Trigger werkt alleen voor NIEUWE users
    - Bestaande users zijn niet gekoppeld aan een company
    - Dit veroorzaakt RLS errors bij SELECT queries
  
  ## Oplossing
    - Maak Demo Bedrijf aan als die niet bestaat
    - Koppel ALLE bestaande users aan Demo Bedrijf
    - Eenmalige data migration voor bestaande users
  
  ## Wijzigingen
    1. Maak Demo Bedrijf aan (if not exists)
    2. Koppel alle users uit auth.users die nog niet in company_users staan
    3. Geeft alle users 'expert' role
*/

DO $$
DECLARE
  demo_company_id uuid;
  user_count integer;
BEGIN
  -- Stap 1: Maak Demo Bedrijf aan als die niet bestaat
  SELECT id INTO demo_company_id
  FROM companies
  WHERE name = 'Demo Bedrijf'
  LIMIT 1;

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
  ELSE
    RAISE NOTICE 'Demo Bedrijf bestaat al met ID: %', demo_company_id;
  END IF;

  -- Stap 2: Koppel alle bestaande users die nog niet gekoppeld zijn
  INSERT INTO company_users (company_id, user_id, role, created_at)
  SELECT 
    demo_company_id,
    au.id,
    'expert',
    now()
  FROM auth.users au
  WHERE NOT EXISTS (
    SELECT 1 FROM company_users cu
    WHERE cu.user_id = au.id
  )
  ON CONFLICT (company_id, user_id) DO NOTHING;

  GET DIAGNOSTICS user_count = ROW_COUNT;
  RAISE NOTICE 'Aantal users gekoppeld aan Demo Bedrijf: %', user_count;

END $$;

-- Commentaar
COMMENT ON TABLE company_users IS 
  'Koppeltabel tussen users en companies. Alle users moeten minimaal 1 company hebben.';
