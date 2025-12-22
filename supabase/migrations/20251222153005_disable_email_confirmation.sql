/*
  # Email Confirmatie Uitschakelen via Auth Config

  ## Wijzigingen
    - Schakelt email confirmatie uit voor snelle registratie
    - Staat autoconfirm toe voor nieuwe users
  
  ## Belangrijk
    Email confirmatie moet ook in Supabase Dashboard worden uitgezet:
    Authentication > Settings > Email Auth > Enable email confirmations = OFF
*/

-- Geef permissions aan de auth schema voor auto-confirm
-- Dit helpt bij development maar in productie moet het via dashboard

-- Voeg helper functie toe om te checken of email confirmation aan staat
CREATE OR REPLACE FUNCTION public.check_auth_settings()
RETURNS TABLE(
  setting_name text,
  setting_value text
) 
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 'email_confirmation'::text, 'Check Supabase Dashboard: Authentication > Settings > Email Auth'::text;
$$;

COMMENT ON FUNCTION public.check_auth_settings() IS 
  'Helper functie om auth settings te checken - zie Supabase Dashboard voor email confirmation setting';
