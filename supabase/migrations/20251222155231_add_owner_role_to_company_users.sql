/*
  # Add 'owner' Role to Company Users

  ## Probleem
    - Trigger probeert 'owner' role in te voegen in company_users
    - Check constraint staat alleen 'expert', 'client', 'viewer' toe
    - Dit veroorzaakt 400 Bad Request bij aanmaken bedrijf
  
  ## Oplossing
    - Voeg 'owner' toe aan de toegestane roles
  
  ## Wijzigingen
    - DROP oude check constraint
    - ADD nieuwe check constraint met 'owner' erbij
*/

-- Drop oude constraint
ALTER TABLE company_users 
DROP CONSTRAINT IF EXISTS company_users_role_check;

-- Nieuwe constraint met 'owner' toegevoegd
ALTER TABLE company_users 
ADD CONSTRAINT company_users_role_check 
CHECK (role IN ('owner', 'expert', 'client', 'viewer'));

-- Commentaar
COMMENT ON CONSTRAINT company_users_role_check ON company_users IS 
  'Toegestane roles: owner (eigenaar), expert (accountant), client (klant), viewer (alleen lezen)';
