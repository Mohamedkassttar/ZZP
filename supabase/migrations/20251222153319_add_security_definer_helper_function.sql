/*
  # Security Definer Helper om RLS Recursie te Voorkomen

  ## Probleem
    - Alle policies doen subqueries op company_users
    - Dit triggert de SELECT policy op company_users
    - Resultaat: infinite recursion
  
  ## Oplossing
    - Maak SECURITY DEFINER functie die RLS bypassed
    - Deze functie returned company IDs voor een user
    - Policies gebruiken deze functie ipv subqueries

  ## Functie
    get_user_company_ids(user_id) returns setof uuid
    - SECURITY DEFINER = bypass RLS
    - Direct query op company_users zonder policy check
*/

-- Helper functie die user's company IDs returned zonder RLS check
CREATE OR REPLACE FUNCTION get_user_company_ids(check_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT company_id 
  FROM public.company_users
  WHERE user_id = check_user_id;
$$;

COMMENT ON FUNCTION get_user_company_ids(uuid) IS
  'SECURITY DEFINER functie om RLS recursie te voorkomen - returned company IDs voor een user';

-- Grant execute rechten
GRANT EXECUTE ON FUNCTION get_user_company_ids(uuid) TO authenticated;
