/*
  # Fix Function Search Paths v3
  
  This migration fixes security warnings related to mutable search paths in functions.
  Functions with role mutable search_path can be exploited via search_path attacks.
  
  ## Changes
  - Drop and recreate functions with explicit search_path
  - Uses 'SET search_path = public' to prevent search_path injection attacks
  - Recreates dependent triggers where necessary
  - Maintains exact same functionality, only improves security
  
  ## Functions Updated
  - update_company_settings_updated_at
  - ensure_user_has_company
  - check_auth_settings
  - get_user_company_ids
  - link_user_to_new_company
*/

-- Fix update_company_settings_updated_at (with CASCADE due to trigger dependency)
DROP FUNCTION IF EXISTS update_company_settings_updated_at() CASCADE;

CREATE FUNCTION update_company_settings_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS company_settings_updated_at ON company_settings;
CREATE TRIGGER company_settings_updated_at
  BEFORE UPDATE ON company_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_company_settings_updated_at();

-- Fix ensure_user_has_company
DROP FUNCTION IF EXISTS ensure_user_has_company() CASCADE;

CREATE FUNCTION ensure_user_has_company()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_demo_company_id uuid;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM company_users WHERE user_id = v_user_id) THEN
    RETURN;
  END IF;

  SELECT id INTO v_demo_company_id
  FROM companies
  WHERE name = 'Demo Bedrijf'
  LIMIT 1;

  IF v_demo_company_id IS NOT NULL THEN
    INSERT INTO company_users (company_id, user_id, role)
    VALUES (v_demo_company_id, v_user_id, 'expert')
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$;

-- Fix check_auth_settings
DROP FUNCTION IF EXISTS check_auth_settings() CASCADE;

CREATE FUNCTION check_auth_settings()
RETURNS TABLE(
  enable_email_confirmations boolean,
  password_min_length integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    COALESCE((current_setting('app.settings.enable_email_confirmations', true))::boolean, false) as enable_email_confirmations,
    COALESCE((current_setting('app.settings.password_min_length', true))::integer, 6) as password_min_length;
$$;

-- Fix get_user_company_ids (original one, not the optimized version)
DROP FUNCTION IF EXISTS get_user_company_ids(uuid) CASCADE;

CREATE FUNCTION get_user_company_ids(user_id uuid)
RETURNS TABLE(company_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id 
  FROM company_users 
  WHERE company_users.user_id = get_user_company_ids.user_id
$$;

-- Fix link_user_to_new_company
DROP FUNCTION IF EXISTS link_user_to_new_company() CASCADE;

CREATE FUNCTION link_user_to_new_company()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO company_users (company_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'owner')
  ON CONFLICT (company_id, user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Recreate the trigger for link_user_to_new_company
DROP TRIGGER IF EXISTS auto_link_user_to_new_company ON companies;
CREATE TRIGGER auto_link_user_to_new_company
  AFTER INSERT ON companies
  FOR EACH ROW
  EXECUTE FUNCTION link_user_to_new_company();
