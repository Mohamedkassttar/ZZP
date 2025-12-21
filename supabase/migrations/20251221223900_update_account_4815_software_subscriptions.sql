/*
  # Update Account 4815 - Contributies en abonnementen

  1. Changes
    - Update account 4815 with proper description containing software-related keywords
    - Set VAT code to 21% (standard rate for most SaaS/software subscriptions)
    - Ensure proper matching for software vendors like StackBlitz, GitHub, etc.

  2. Keywords Added (via description)
    - software, abonnement, subscription, contributie, saas, lidmaatschap, licentie, cloud
    
  3. Purpose
    - Enable smart matching for software/SaaS invoices to the correct expense account
    - Prevent incorrect matching to personnel accounts (40xx range)
*/

-- Update account 4815 with software-friendly description and VAT code
UPDATE accounts
SET 
  description = 'Software abonnementen, SaaS subscriptions, contributies, lidmaatschappen, cloud services en licenties',
  vat_code = 21,
  updated_at = now()
WHERE code = '4815';

-- Ensure the account is active
UPDATE accounts
SET is_active = true
WHERE code = '4815' AND is_active = false;
