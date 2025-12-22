# Multi-Tenant Implementatie Guide

## Overzicht

De applicatie ondersteunt nu multi-tenant architectuur waarbij experts meerdere bedrijven kunnen beheren.

## Database Structuur

### Nieuwe Tabellen

1. **companies** - Bevat alle bedrijfsinformatie
   - id, name, address, zip_code, city
   - vat_number (BTW), coc_number (KVK)
   - legal_form (eenmanszaak, bv, vof, stichting, etc.)
   - fiscal_year_start

2. **company_users** - Koppeltabel voor gebruikerstoegang
   - company_id, user_id, role (expert/client/viewer)

### Aangepaste Tabellen

Alle transactionele tabellen hebben nu een `company_id` kolom:
- accounts
- contacts
- bank_transactions
- documents_inbox
- sales_invoices
- purchase_invoices
- journal_entries
- bank_rules
- fiscal_years
- tax_returns_private
- assets
- mileage_logs

## Security (RLS)

Alle tabellen hebben Row Level Security (RLS) policies die:
- Users kunnen alleen data zien van companies waar ze toegang toe hebben
- Automatisch filteren op company_id
- Voorkomen cross-company data lekkage

## Frontend Componenten

### 1. CompanyContext (`src/lib/CompanyContext.tsx`)
Centrale state management voor:
- Huidige geselecteerde company
- Lijst van accessible companies
- User role (expert/client/viewer)
- Company switching functionaliteit

### 2. CompanySwitcher (`src/components/CompanySwitcher.tsx`)
Dropdown component in de sidebar voor:
- Tonen huidige company
- Switchen tussen companies
- Visuele feedback van active company

### 3. Office Dashboard (`src/components/Office.tsx`)
Alleen voor experts:
- Overzicht van alle companies
- Nieuw bedrijf aanmaken
- Bedrijven bewerken/verwijderen
- Gebruikers beheren per bedrijf

## Services

### Company Service (`src/lib/companyService.ts`)
Functies voor:
- `createCompany()` - Maak nieuw bedrijf + seed accounts
- `updateCompany()` - Update bedrijfsgegevens
- `deleteCompany()` - Verwijder bedrijf (cascade)
- `addUserToCompany()` - Voeg gebruiker toe met rol
- `removeUserFromCompany()` - Verwijder gebruikerstoegang
- `getCompanyUsers()` - Lijst van gebruikers

### Company Helper (`src/lib/companyHelper.ts`)
Utility functies:
- `getCurrentCompanyId()` - Haal actieve company_id op
- `addCompanyIdToData()` - Voeg company_id toe aan single object
- `addCompanyIdToArray()` - Voeg company_id toe aan array

## Services Updaten

### Voorbeeld: INSERT met company_id

```typescript
import { getCurrentCompanyId } from './companyHelper';

async function createContact(contactData: ContactInput) {
  const companyId = await getCurrentCompanyId();

  const { data, error } = await supabase
    .from('contacts')
    .insert({
      ...contactData,
      company_id: companyId,  // ← Voeg toe
    })
    .select()
    .single();

  return { data, error };
}
```

### SELECT queries

SELECT queries hoeven NIET aangepast te worden! RLS policies filteren automatisch op de juiste company_id.

```typescript
// Dit werkt automatisch correct:
const { data } = await supabase
  .from('contacts')
  .select('*');
// ↑ Geeft alleen contacts van de current company
```

## Gebruikersrollen

### Expert
- Kan meerdere companies beheren
- Kan nieuwe companies aanmaken
- Kan gebruikers toevoegen/verwijderen
- Toegang tot "Mijn Kantoor" dashboard
- Volledige toegang tot alle features

### Client
- Toegang tot alleen Portal routes
- Kan alleen eigen company data zien
- Geen toegang tot admin functionaliteit
- Beperkte functionaliteit

### Viewer
- Read-only toegang
- Kan data bekijken maar niet wijzigen
- Geen toegang tot gevoelige informatie

## Routes

### Admin Routes (Experts)
- `/office` - Mijn Kantoor dashboard
- Alle bestaande routes met volledige toegang

### Portal Routes (Clients)
- `/portal-home` - Client dashboard
- `/portal-scan` - Bank upload
- `/portal-invoice` - Factuur maken
- `/portal-expense` - Uitgave registreren
- `/portal-assistant` - AI assistent

## Workflow Voorbeeld

### Als Expert:
1. Log in
2. Zie "Mijn Kantoor" in sidebar
3. Maak "Bakkerij Jansen BV" aan
4. Voeg gebruiker "jan@bakkerij.nl" toe als Client
5. Switch naar "Bakkerij Jansen" via dropdown
6. Doe administratie voor dit bedrijf
7. Switch terug naar ander bedrijf indien nodig

### Als Client (jan@bakkerij.nl):
1. Log in
2. Zie alleen Portal interface
3. Zie alleen data van "Bakkerij Jansen"
4. Kan uploaden, facturen maken, etc.
5. Geen toegang tot andere bedrijven

## Migratie Bestaande Data

Alle bestaande data is automatisch gekoppeld aan "Demo Bedrijf":
- Bij eerste gebruik wordt Demo Bedrijf aangemaakt
- Alle bestaande accounts, transacties, etc. worden gekoppeld
- Gebruiker wordt automatisch expert van Demo Bedrijf

## Toekomstige Uitbreidingen

- Gebruiker uitnodigingen via email
- Role-based permissions op feature niveau
- Audit logging per company
- Company-specific settings
- White-label branding per company
