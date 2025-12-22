/*
  # Multi-Tenant Architectuur: Companies & Company Users

  ## 1. Nieuwe Tabellen
    ### companies
      - `id` (uuid, primary key) - Unieke bedrijfs-ID
      - `name` (text) - Bedrijfsnaam
      - `address` (text) - Straat + huisnummer
      - `zip_code` (text) - Postcode
      - `city` (text) - Plaats
      - `vat_number` (text) - BTW-nummer
      - `coc_number` (text) - KVK-nummer
      - `legal_form` (text) - Rechtsvorm (eenmanszaak, bv, vof, stichting)
      - `fiscal_year_start` (date) - Start boekjaar
      - `is_active` (boolean) - Actief/inactief
      - `created_at` (timestamptz) - Aanmaakdatum
      - `created_by` (uuid) - Aangemaakt door (user)

    ### company_users
      - `id` (uuid, primary key) - Unieke koppeling-ID
      - `company_id` (uuid) - Referentie naar companies
      - `user_id` (uuid) - Referentie naar auth.users
      - `role` (text) - Rol: 'expert', 'client', 'viewer'
      - `created_at` (timestamptz) - Aanmaakdatum
      - Unique constraint op (company_id, user_id)

  ## 2. Security
    - Enable RLS op beide tabellen
    - Users kunnen alleen companies zien waar ze toegang toe hebben
    - Alleen experts kunnen companies aanmaken en beheren

  ## 3. Demo Company
    - Maak automatisch een "Demo Bedrijf" aan voor bestaande data
*/

-- 1. COMPANIES TABEL
CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  zip_code text,
  city text,
  vat_number text,
  coc_number text,
  legal_form text CHECK (legal_form IN ('eenmanszaak', 'bv', 'vof', 'stichting', 'maatschap', 'cv', 'andere')),
  fiscal_year_start date,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- 2. COMPANY_USERS KOPPELTABEL
CREATE TABLE IF NOT EXISTS company_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('expert', 'client', 'viewer')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(company_id, user_id)
);

-- 3. INDEXES
CREATE INDEX IF NOT EXISTS idx_company_users_company_id ON company_users(company_id);
CREATE INDEX IF NOT EXISTS idx_company_users_user_id ON company_users(user_id);
CREATE INDEX IF NOT EXISTS idx_companies_is_active ON companies(is_active);

-- 4. RLS POLICIES - COMPANIES
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view companies they have access to"
  ON companies FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = companies.id
      AND company_users.user_id = auth.uid()
    )
  );

CREATE POLICY "Experts can create companies"
  ON companies FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.user_id = auth.uid()
      AND company_users.role = 'expert'
    )
    OR NOT EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.user_id = auth.uid()
    )
  );

CREATE POLICY "Experts can update their companies"
  ON companies FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = companies.id
      AND company_users.user_id = auth.uid()
      AND company_users.role = 'expert'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = companies.id
      AND company_users.user_id = auth.uid()
      AND company_users.role = 'expert'
    )
  );

CREATE POLICY "Experts can delete their companies"
  ON companies FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = companies.id
      AND company_users.user_id = auth.uid()
      AND company_users.role = 'expert'
    )
  );

-- 5. RLS POLICIES - COMPANY_USERS
ALTER TABLE company_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company memberships"
  ON company_users FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM company_users cu
      WHERE cu.company_id = company_users.company_id
      AND cu.user_id = auth.uid()
      AND cu.role = 'expert'
    )
  );

CREATE POLICY "Experts can add users to their companies"
  ON company_users FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_users cu
      WHERE cu.company_id = company_users.company_id
      AND cu.user_id = auth.uid()
      AND cu.role = 'expert'
    )
    OR NOT EXISTS (
      SELECT 1 FROM company_users
    )
  );

CREATE POLICY "Experts can update user roles in their companies"
  ON company_users FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_users cu
      WHERE cu.company_id = company_users.company_id
      AND cu.user_id = auth.uid()
      AND cu.role = 'expert'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_users cu
      WHERE cu.company_id = company_users.company_id
      AND cu.user_id = auth.uid()
      AND cu.role = 'expert'
    )
  );

CREATE POLICY "Experts can remove users from their companies"
  ON company_users FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_users cu
      WHERE cu.company_id = company_users.company_id
      AND cu.user_id = auth.uid()
      AND cu.role = 'expert'
    )
  );

-- 6. MAAK DEMO BEDRIJF AAN
DO $$
DECLARE
  demo_company_id uuid;
BEGIN
  -- Check of er al een demo bedrijf bestaat
  IF NOT EXISTS (SELECT 1 FROM companies WHERE name = 'Demo Bedrijf') THEN
    INSERT INTO companies (
      id,
      name,
      address,
      zip_code,
      city,
      legal_form,
      fiscal_year_start,
      is_active
    ) VALUES (
      gen_random_uuid(),
      'Demo Bedrijf',
      'Democraat 1',
      '1234 AB',
      'Amsterdam',
      'eenmanszaak',
      '2024-01-01',
      true
    )
    RETURNING id INTO demo_company_id;

    -- Log de ID voor later gebruik
    RAISE NOTICE 'Demo Bedrijf aangemaakt met ID: %', demo_company_id;
  END IF;
END $$;