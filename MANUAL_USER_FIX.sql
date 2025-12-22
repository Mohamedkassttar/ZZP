-- ============================================================================
-- HANDMATIGE FIX: Koppel jezelf aan Demo Bedrijf
-- ============================================================================
--
-- Gebruik dit SQL script in de Supabase SQL Editor als je:
-- - De Company Switcher niet ziet
-- - "Mijn Kantoor" niet in het menu ziet
-- - Geen toegang hebt tot bedrijven
--
-- Dit script koppelt je automatisch als Expert aan Demo Bedrijf
-- ============================================================================

-- STAP 1: Roep de helper functie aan (automatisch koppelen)
SELECT ensure_user_has_company();

-- STAP 2: Controleer of het werkt
SELECT
  cu.id,
  cu.user_id,
  cu.role,
  c.name as company_name
FROM company_users cu
JOIN companies c ON c.id = cu.company_id
WHERE cu.user_id = auth.uid();

-- ============================================================================
-- ALTERNATIEF: Handmatige insert (als de functie niet werkt)
-- ============================================================================
--
-- Vervang 'jouw-email@example.com' door je eigen email adres!
-- ============================================================================

-- OPTIE A: Als je je email adres weet:
/*
INSERT INTO company_users (company_id, user_id, role)
SELECT
  c.id as company_id,
  u.id as user_id,
  'expert' as role
FROM companies c
CROSS JOIN auth.users u
WHERE c.name = 'Demo Bedrijf'
  AND u.email = 'jouw-email@example.com'  -- ← PAS DIT AAN!
  AND NOT EXISTS (
    SELECT 1 FROM company_users cu2
    WHERE cu2.user_id = u.id
    AND cu2.company_id = c.id
  );
*/

-- OPTIE B: Koppel alle bestaande users aan Demo Bedrijf (als je meerdere test-users hebt)
/*
INSERT INTO company_users (company_id, user_id, role)
SELECT
  c.id as company_id,
  u.id as user_id,
  'expert' as role
FROM companies c
CROSS JOIN auth.users u
WHERE c.name = 'Demo Bedrijf'
  AND NOT EXISTS (
    SELECT 1 FROM company_users cu2
    WHERE cu2.user_id = u.id
    AND cu2.company_id = c.id
  );
*/

-- ============================================================================
-- VERIFICATIE: Check alle gekoppelde users
-- ============================================================================

SELECT
  u.email,
  c.name as company_name,
  cu.role,
  cu.created_at
FROM company_users cu
JOIN companies c ON c.id = cu.company_id
JOIN auth.users u ON u.id = cu.user_id
ORDER BY cu.created_at DESC;

-- ============================================================================
-- TROUBLESHOOTING: Debug info
-- ============================================================================

-- Toon alle companies
SELECT id, name, legal_form, is_active FROM companies ORDER BY created_at;

-- Toon alle company_users
SELECT
  cu.id,
  (SELECT email FROM auth.users WHERE id = cu.user_id) as user_email,
  (SELECT name FROM companies WHERE id = cu.company_id) as company_name,
  cu.role
FROM company_users cu;

-- Toon huidige user info
SELECT
  auth.uid() as current_user_id,
  (SELECT email FROM auth.users WHERE id = auth.uid()) as current_user_email;
