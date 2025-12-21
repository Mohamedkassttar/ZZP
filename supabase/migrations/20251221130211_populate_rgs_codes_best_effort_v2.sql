/*
  # Populate RGS Codes (Best-Effort Matching) - v2

  1. Overview
    - Intelligently matches existing accounts to RGS codes
    - Uses pattern matching on account codes, names, and categories
    - Does NOT create new accounts or overwrite existing data
    - All matches are best-effort and can be manually corrected via UI

  2. Matching Logic
    - Bank accounts (1000-1199) -> 'BLiqBan'
    - Debtors (1300-1399) -> 'BVorDeb'
    - Creditors (1500-1699) -> 'BSchCre'
    - VAT accounts (1800-1899) -> 'BSchOvrOmz'
    - Revenue accounts (Type = 'Revenue') -> 'WOmzOmzOhb'
    - Car/Vehicle expenses -> 'WBedAutBra'
    - Fuel expenses -> 'WBedAutBra'
    - Office costs -> 'WBedOvrKan'
    - Other expenses -> Appropriate WBed* codes

  3. Safety
    - Only updates NULL rgs_code values
    - Preserves any manually set RGS codes
    - User can correct via Settings UI
    - Casts enum types to text for pattern matching
*/

-- Best-effort RGS code population
DO $$
BEGIN
  -- BALANCE SHEET ACCOUNTS (B*)
  
  -- Bank accounts: BLiqBan (Liquide middelen - Bank)
  UPDATE accounts
  SET rgs_code = 'BLiqBan'
  WHERE rgs_code IS NULL
    AND (
      (code >= '1000' AND code < '1200')
      OR name ILIKE '%bank%'
      OR name ILIKE '%rekening-courant%'
    );

  -- Debtors: BVorDeb (Vorderingen - Debiteuren)
  UPDATE accounts
  SET rgs_code = 'BVorDeb'
  WHERE rgs_code IS NULL
    AND (
      (code >= '1300' AND code < '1400')
      OR name ILIKE '%debiteuren%'
      OR name ILIKE '%klanten%'
    );

  -- Creditors: BSchCre (Schulden - Crediteuren)
  UPDATE accounts
  SET rgs_code = 'BSchCre'
  WHERE rgs_code IS NULL
    AND (
      (code >= '1500' AND code < '1700')
      OR name ILIKE '%crediteuren%'
      OR name ILIKE '%leveranciers%'
    );

  -- VAT payable: BSchOvrOmz (Schulden - Overige - Omzetbelasting)
  UPDATE accounts
  SET rgs_code = 'BSchOvrOmz'
  WHERE rgs_code IS NULL
    AND (
      (code >= '1800' AND code < '1900')
      OR name ILIKE '%btw%'
      OR name ILIKE '%omzetbelasting%'
      OR name ILIKE '%vat%'
    );

  -- Private/Equity accounts: BEig (Eigen vermogen)
  UPDATE accounts
  SET rgs_code = 'BEig'
  WHERE rgs_code IS NULL
    AND type = 'Equity'
    AND (
      (code >= '0100' AND code < '2000')
      OR name ILIKE '%privé%'
      OR name ILIKE '%prive%'
      OR name ILIKE '%eigen vermogen%'
      OR name ILIKE '%resultaat%'
    );

  -- PROFIT & LOSS ACCOUNTS (W*)

  -- Revenue: WOmzOmzOhb (Omzet - Omzet - Omzet hoofdactiviteit)
  UPDATE accounts
  SET rgs_code = 'WOmzOmzOhb'
  WHERE rgs_code IS NULL
    AND type = 'Revenue'
    AND (
      (code >= '8000' AND code < '9000')
      OR name ILIKE '%omzet%'
      OR name ILIKE '%verkoop%'
      OR name ILIKE '%revenue%'
    );

  -- Car/Fuel expenses: WBedAutBra (Bedrijfskosten - Auto - Brandstof)
  UPDATE accounts
  SET rgs_code = 'WBedAutBra'
  WHERE rgs_code IS NULL
    AND (
      name ILIKE '%brandstof%'
      OR name ILIKE '%fuel%'
      OR name ILIKE '%benzine%'
      OR name ILIKE '%diesel%'
      OR tax_category::text ILIKE '%brandstof%'
    );

  -- Car maintenance: WBedAutOnd (Bedrijfskosten - Auto - Onderhoud)
  UPDATE accounts
  SET rgs_code = 'WBedAutOnd'
  WHERE rgs_code IS NULL
    AND (
      name ILIKE '%onderhoud%auto%'
      OR name ILIKE '%auto%onderhoud%'
      OR name ILIKE '%voertuig%onderhoud%'
      OR tax_category::text ILIKE '%auto%onderhoud%'
    );

  -- Office costs: WBedOvrKan (Bedrijfskosten - Overige - Kantoorkosten)
  UPDATE accounts
  SET rgs_code = 'WBedOvrKan'
  WHERE rgs_code IS NULL
    AND (
      name ILIKE '%kantoor%'
      OR name ILIKE '%office%'
      OR tax_category::text ILIKE '%kantoor%'
    );

  -- Housing costs: WBedHuiHuu (Bedrijfskosten - Huisvesting - Huur)
  UPDATE accounts
  SET rgs_code = 'WBedHuiHuu'
  WHERE rgs_code IS NULL
    AND (
      name ILIKE '%huur%'
      OR name ILIKE '%rent%'
      OR tax_category::text ILIKE '%huur%'
    );

  -- Energy: WBedHuiEne (Bedrijfskosten - Huisvesting - Energie)
  UPDATE accounts
  SET rgs_code = 'WBedHuiEne'
  WHERE rgs_code IS NULL
    AND (
      name ILIKE '%energie%'
      OR name ILIKE '%gas%elektra%'
      OR name ILIKE '%elektriciteit%'
      OR tax_category::text ILIKE '%energie%'
    );

  -- Representation: WBedOvrRep (Bedrijfskosten - Overige - Representatie)
  UPDATE accounts
  SET rgs_code = 'WBedOvrRep'
  WHERE rgs_code IS NULL
    AND (
      name ILIKE '%representatie%'
      OR name ILIKE '%relatie%'
      OR tax_category::text ILIKE '%representatie%'
    );

  -- Canteen: WBedOvrKan (Bedrijfskosten - Overige - Kantoorkosten)
  UPDATE accounts
  SET rgs_code = 'WBedOvrKan'
  WHERE rgs_code IS NULL
    AND (
      name ILIKE '%kantine%'
      OR name ILIKE '%canteen%'
    );

  -- Telephone/Telecom: WBedOvrTel (Bedrijfskosten - Overige - Telefoon)
  UPDATE accounts
  SET rgs_code = 'WBedOvrTel'
  WHERE rgs_code IS NULL
    AND (
      name ILIKE '%telefoon%'
      OR name ILIKE '%telecommunicatie%'
      OR name ILIKE '%internet%'
      OR tax_category::text ILIKE '%telefoon%'
      OR tax_category::text ILIKE '%telecommunicatie%'
    );

  -- Accountant/Administration: WBedOvrAdm (Bedrijfskosten - Overige - Administratie)
  UPDATE accounts
  SET rgs_code = 'WBedOvrAdm'
  WHERE rgs_code IS NULL
    AND (
      name ILIKE '%accountant%'
      OR name ILIKE '%administratie%'
      OR name ILIKE '%boekhouding%'
      OR tax_category::text ILIKE '%accountant%'
      OR tax_category::text ILIKE '%administratie%'
    );

  -- Insurance: WBedOvrVer (Bedrijfskosten - Overige - Verzekeringen)
  UPDATE accounts
  SET rgs_code = 'WBedOvrVer'
  WHERE rgs_code IS NULL
    AND (
      name ILIKE '%verzekering%'
      OR name ILIKE '%insurance%'
      OR tax_category::text ILIKE '%verzekering%'
    );

  -- Depreciation: WBedAfs (Bedrijfskosten - Afschrijvingen)
  UPDATE accounts
  SET rgs_code = 'WBedAfs'
  WHERE rgs_code IS NULL
    AND (
      name ILIKE '%afschrijving%'
      OR name ILIKE '%depreciation%'
      OR tax_category::text ILIKE '%afschrijving%'
    );

  -- Bank costs: WFinKos (Financiële baten en lasten - Kosten)
  UPDATE accounts
  SET rgs_code = 'WFinKos'
  WHERE rgs_code IS NULL
    AND (
      name ILIKE '%bankkosten%'
      OR name ILIKE '%bank charges%'
      OR name ILIKE '%kosten geldverkeer%'
      OR tax_category::text ILIKE '%bank%'
    );

  -- Generic expenses: WBedOvr (Bedrijfskosten - Overige)
  UPDATE accounts
  SET rgs_code = 'WBedOvr'
  WHERE rgs_code IS NULL
    AND type = 'Expense'
    AND code >= '4000'
    AND code < '5000';

END $$;
