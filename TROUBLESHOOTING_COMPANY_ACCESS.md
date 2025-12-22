# Troubleshooting: Company Access & "Mijn Kantoor"

## Symptomen

Je ziet één of meer van deze problemen:
- ❌ Geen Company Switcher in de sidebar
- ❌ "Mijn Kantoor" menu item ontbreekt
- ❌ Dashboard toont geen data
- ❌ Lege lijsten overal

## Oorzaak

Je gebruikersaccount is nog niet gekoppeld aan een bedrijf in de `company_users` tabel.

---

## Oplossing 1: Automatische Fix (Frontend)

De app probeert dit **automatisch** te fixen bij het opstarten via de `ensure_user_has_company()` functie.

**Stappen:**
1. Herlaad de pagina volledig (Ctrl+R / Cmd+R)
2. Wacht 2-3 seconden
3. Kijk rechtsonder voor de **"Company Debug"** knop
4. Klik erop om de status te zien

**Als het werkt zie je:**
```
✅ User Role: expert (Expert ✓)
✅ Current Company: Demo Bedrijf
✅ Total Companies: 1
```

**Als het NIET werkt zie je:**
```
❌ User Role: None
❌ No company selected
⚠️ No Companies Found
```

→ Ga naar **Oplossing 2** hieronder

---

## Oplossing 2: Handmatige SQL Fix

Open de **Supabase SQL Editor** en voer dit uit:

### Snelle Fix (Aanbevolen)
```sql
-- Koppel jezelf automatisch aan Demo Bedrijf
SELECT ensure_user_has_company();

-- Verificatie: check of het werkt
SELECT
  cu.user_id,
  cu.role,
  c.name as company_name
FROM company_users cu
JOIN companies c ON c.id = cu.company_id
WHERE cu.user_id = auth.uid();
```

**Verwachte output:**
| user_id | role | company_name |
|---------|------|--------------|
| abc-123 | expert | Demo Bedrijf |

---

### Alternatief: Handmatige Insert

Als de functie niet werkt, gebruik deze query (vervang je email!):

```sql
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
```

---

## Oplossing 3: Debug Info Verzamelen

Als beide oplossingen niet werken, verzamel debug info:

```sql
-- 1. Toon huidige user
SELECT
  auth.uid() as my_user_id,
  (SELECT email FROM auth.users WHERE id = auth.uid()) as my_email;

-- 2. Toon alle companies
SELECT id, name, is_active FROM companies;

-- 3. Toon alle company_users
SELECT
  (SELECT email FROM auth.users WHERE id = cu.user_id) as user_email,
  (SELECT name FROM companies WHERE id = cu.company_id) as company_name,
  cu.role
FROM company_users cu;

-- 4. Check RLS policies
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename IN ('companies', 'company_users')
ORDER BY tablename, policyname;
```

Stuur deze output als je verdere hulp nodig hebt.

---

## Verwachte Resultaat

Na het fixen zou je moeten zien:

### In de Sidebar (linksboven):
```
┌─────────────────────────┐
│ 🏢 Demo Bedrijf         │
│ eenmanszaak         ▼   │
└─────────────────────────┘
```

### In het Menu:
```
🏢 Mijn Kantoor      ← NIEUW!
🏠 Dashboard
📚 Boekhouding
📄 Facturatie
...
```

### Debug Info (rechtsonder):
```
Loading: ✅ No
User Role: expert (Expert ✓)
Current Company: Demo Bedrijf
Total Companies: 1
```

---

## Veelgestelde Vragen

**Q: Waarom gebeurt dit?**
A: Bij de multi-tenant implementatie moet elke gebruiker expliciet gekoppeld worden aan bedrijven via de `company_users` tabel. Dit is een veiligheidsmaatregel om te voorkomen dat gebruikers elkaars data zien.

**Q: Gebeurt dit elke keer?**
A: Nee, alleen de eerste keer of als je account nog niet gekoppeld is. Daarna wordt je company_id opgeslagen in localStorage.

**Q: Kan ik mezelf aan meerdere bedrijven koppelen?**
A: Ja! Als expert kun je via "Mijn Kantoor" nieuwe bedrijven aanmaken. Je wordt automatisch als expert toegevoegd.

**Q: Hoe voeg ik andere gebruikers toe?**
A: Ga naar "Mijn Kantoor" → Klik op het Users icoon bij een bedrijf. Functionaliteit komt binnenkort.

---

## Extra Hulp Nodig?

Zie ook:
- `MANUAL_USER_FIX.sql` - Volledige SQL scripts
- `MULTI_TENANT_IMPLEMENTATION.md` - Technische documentatie
- Debug knop rechtsonder in de app

Als het probleem aanhoudt, check de browser console (F12) voor errors.
