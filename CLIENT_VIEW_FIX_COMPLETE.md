# Client View UI Fix - Volledige Zichtbaarheid & Feedback

## Het Probleem

Je zag **NIETS** in de client view en kon de upload/verwerkingsprocessen niet starten, maar uploads werkten wel op de achtergrond (zichtbaar in expert view).

## Root Cause

De PortalUpload component had **GEEN**:
1. Company loading check → Bleef mogelijk hangen in loading state
2. Company validation → Faalde stil als er geen company was
3. Dedicated error state UI → Errors werden niet duidelijk getoond
4. Debug logging → Onmogelijk om te zien waar het fout ging

## Toegepaste Fixes

### 1. Company Context Integration ✅

**Voor:**
```typescript
const companyId = await getCurrentCompanyId();  // Async call, geen loading state
```

**Na:**
```typescript
const { currentCompany, loading: companyLoading } = useCompany();

if (companyLoading) {
  return <LoadingSpinner />  // ✅ Zichtbare loading state
}

if (!currentCompany) {
  return <ErrorMessage />  // ✅ Duidelijke error als geen company
}
```

### 2. Dedicated Error State UI ✅

**Voor:**
```typescript
{error && <div className="...">Error banner</div>}
// Error was alleen een banner, niet een volledige state
```

**Na:**
```typescript
if (state === 'error' && error) {
  return (
    <div className="...">
      <AlertCircle />
      <h2>Fout opgetreden</h2>
      <p>{error}</p>
      <button onClick={reset}>Opnieuw proberen</button>
    </div>
  );
}
```

### 3. Comprehensive Debug Logging ✅

**Toegevoegd aan ALLE key points:**

```typescript
console.log('[PortalUpload] Component mounted', { type, companyLoading, hasCompany });
console.log('[PortalUpload] State changed:', { state, companyLoading, hasCompany });
console.log('[PortalUpload] handleFileSelect called', { hasFile, name, type });
console.log('[PortalUpload] Setting state to uploading...');
console.log('[PortalUpload] Upload result:', uploadResult);
console.log('[PortalUpload] Setting state to analyzing...');
console.log('[PortalUpload] AI processing complete, data:', invoiceData);
console.log('[PortalUpload] Setting state to preview...');
console.log('[PortalUpload] EXCEPTION CAUGHT:', err);
console.log('[PortalUpload] File button clicked');
console.log('[PortalUpload] Camera button clicked');
```

### 4. Visual State Indicators ✅

**Idle State:**
- Grote upload box met duidelijke buttons
- "Bestand kiezen" button (blauw)
- "Foto maken" button (grijs) - alleen voor invoices
- Company naam zichtbaar: `Company: {currentCompany.name}`

**Uploading State:**
- Spinner animatie
- "Uploaden..." tekst
- "Bestand wordt geüpload" subtekst
- State indicator: `State: uploading`

**Analyzing State:**
- Spinner animatie
- "AI analyseert..." tekst
- "De factuur wordt intelligent verwerkt" subtekst
- State indicator: `State: analyzing`

**Preview State:**
- Factuurgegevens overzicht
- Leverancier, bedragen, BTW
- "Akkoord & Boeken" button
- "Annuleren" button

**Success State:**
- Groen vinkje icoon
- "Gelukt!" tekst
- Success bericht
- "Nog een uploaden" button

**Error State:**
- Rood waarschuwing icoon
- "Fout opgetreden" tekst
- Error bericht (details)
- "Opnieuw proberen" button

### 5. Button Click Handlers ✅

**Voor:**
```typescript
onClick={() => fileInputRef.current?.click()}
```

**Na:**
```typescript
onClick={() => {
  console.log('[PortalUpload] File button clicked');
  fileInputRef.current?.click();
}}
```

Nu zie je in de console OF de buttons worden geklikt.

## Debugging Guide

### Open DevTools op Samsung

**Via USB:**
1. Desktop: Open Chrome → `chrome://inspect`
2. Connect Samsung via USB
3. Enable USB debugging op telefoon (Settings → Developer Options)
4. Selecteer device → Inspect

**Direct op Telefoon:**
1. Open app in Chrome
2. Chrome menu (⋮) → Meer tools → Console
3. Of: `chrome://inspect/#devices` op desktop

### Verwachte Console Output

#### Bij Component Mount:
```
[PortalUpload] Component mounted {type: "invoice", companyLoading: false, hasCompany: true}
[PortalUpload] State changed: {state: "idle", companyLoading: false, hasCompany: true}
```

#### Bij File Upload:
```
[PortalUpload] File button clicked
[PortalUpload] handleFileSelect called {hasFile: true, name: "photo.jpg", type: "image/jpeg"}
[PortalUpload] File selected: {name: "photo.jpg", type: "image/jpeg", size: 2458392, isInvoice: true, currentState: "idle"}
[PortalUpload] Setting state to uploading...
[Upload Debug] Starting upload: {name: "photo.jpg", type: "image/jpeg", size: 2458392}
[Upload Debug] File validation passed: {isValidByExtension: true, ...}
[Upload Debug] Uploading to storage: {path: "invoices/1703345678_photo.jpg", contentType: "image/jpeg"}
[Upload Debug] Storage upload successful, creating database record...
[PortalUpload] Upload result: {success: true, documentId: "abc-123-..."}
[PortalUpload] Upload successful, document ID: abc-123-...
[PortalUpload] Setting state to analyzing...
[PortalUpload] Fetching document file_url from database...
[PortalUpload] Document data: {file_url: "invoices/1703345678_photo.jpg"}
[PortalUpload] Creating signed URL...
[PortalUpload] Processing with AI...
[PortalUpload] AI processing complete, data: {...}
[PortalUpload] Setting state to preview...
[PortalUpload] Rendering PREVIEW state {...}
```

#### Bij Error:
```
[PortalUpload] EXCEPTION CAUGHT: Error: ...
[PortalUpload] Error message: ...
[PortalUpload] Setting state to error...
[PortalUpload] Rendering ERROR state: ...
```

### Mogelijke Scenarios

#### Scenario 1: Component Mount Faalt

**Console toont:**
```
[PortalUpload] Component mounted {type: "invoice", companyLoading: true, hasCompany: false}
[PortalUpload] Showing loading spinner - company is loading
```

**Blijft hangen in loading?**
- Check of CompanyContext correct is geïnitialiseerd
- Kijk in de Network tab of er database queries falen
- Check RLS policies voor companies en company_users tables

**Oplossing:**
```javascript
// In console:
const { data: { user } } = await supabase.auth.getUser();
const { data: companies } = await supabase.from('companies').select('*');
const { data: companyUsers } = await supabase
  .from('company_users')
  .select('*, companies(*)')
  .eq('user_id', user.id);

console.log('User:', user?.id);
console.log('Companies:', companies);
console.log('Company Users:', companyUsers);
```

#### Scenario 2: Geen Company Gevonden

**Console toont:**
```
[PortalUpload] Component mounted {type: "invoice", companyLoading: false, hasCompany: false}
[PortalUpload] No company found!
```

**Je ziet:**
- Rode error box
- "Geen bedrijf gevonden"
- "Selecteer eerst een bedrijf in de instellingen"

**Oplossing:**
1. Ga naar expert view (dashboard)
2. Check of je een bedrijf hebt geselecteerd
3. Of: Maak een nieuw bedrijf aan in Settings

#### Scenario 3: Buttons Werken Niet

**Console toont GEEN:**
```
[PortalUpload] File button clicked
```

**Mogelijke oorzaken:**
- CSS z-index probleem (nav overlay)
- Touch event niet geregistreerd
- Pointer-events disabled

**Test in console:**
```javascript
// Check of buttons aanwezig zijn:
document.querySelectorAll('button').forEach((btn, i) => {
  console.log(`Button ${i}:`, btn.textContent, btn.onclick);
});

// Check z-index:
document.querySelectorAll('*').forEach(el => {
  const z = window.getComputedStyle(el).zIndex;
  if (z && z !== 'auto') console.log(el, 'z-index:', z);
});
```

#### Scenario 4: File Select Maar Geen Upload

**Console toont:**
```
[PortalUpload] File button clicked
[PortalUpload] handleFileSelect called {hasFile: false, name: undefined, type: undefined}
[PortalUpload] No file selected
```

**Mogelijke oorzaken:**
- File input geeft geen file terug
- Browser security policy blokkeert file access
- Samsung Internet browser (niet Chrome) compatibility issue

**Oplossing:**
- Test in Chrome (niet Samsung Internet browser)
- Check file input accept attribute
- Test met verschillende bestandstypes

#### Scenario 5: Upload Start Maar Geen Progress

**Console toont:**
```
[PortalUpload] Setting state to uploading...
[Upload Debug] Starting upload: {name: "photo.jpg", ...}
// ... dan niets meer
```

**Mogelijke oorzaken:**
- Network timeout
- Supabase Storage upload faalt
- RLS policy blokkeert upload

**Debug:**
```javascript
// Check storage policies:
const { data, error } = await supabase.storage
  .from('invoices')
  .list('', { limit: 1 });

console.log('Storage access:', { data, error });

// Test upload direct:
const testFile = new File(['test'], 'test.txt', { type: 'text/plain' });
const { data: uploadData, error: uploadError } = await supabase.storage
  .from('invoices')
  .upload(`test_${Date.now()}.txt`, testFile);

console.log('Test upload:', { uploadData, uploadError });
```

## Verschillen Expert vs Client View

### Expert Mode (FactuurInbox):
- Lijst van alle documenten
- Bulk processing
- Directe database access
- Geen company context check (assumes admin)

### Client Mode (PortalUpload):
- Single file upload
- Immediate processing
- Company context required
- Mobile-first UI

## Files Gewijzigd

### `/src/components/portal/PortalUpload.tsx` ✅

**Wijzigingen:**
1. Import `useCompany` from CompanyContext
2. Company loading/validation checks
3. Dedicated error state render
4. Comprehensive logging (20+ log statements)
5. Visual company name indicator
6. Button click logging
7. State change logging

**Voor:** 465 regels
**Na:** ~530 regels

### `/src/lib/invoiceService.ts` ✅

**Wijzigingen:**
1. Triple file validation (MIME + extension + pattern)
2. Smart content-type detection
3. HEIC/HEIF support
4. Debug logging

**Status:** Al gefixt in vorige commit

## Test Checklist

### Op Samsung Telefoon (Chrome):

- [ ] 1. Open app in Chrome (NIET Samsung Internet)
- [ ] 2. Open DevTools via `chrome://inspect` (desktop)
- [ ] 3. Navigeer naar client view (Portal)
- [ ] 4. Check console: Zie je `[PortalUpload] Component mounted`?
- [ ] 5. Check UI: Zie je "Factuur Uploaden" header?
- [ ] 6. Check UI: Zie je company naam onder description?
- [ ] 7. Klik "Bestand kiezen": Zie je console log?
- [ ] 8. Selecteer foto: Zie je "Uploaden..." spinner?
- [ ] 9. Wacht op AI: Zie je "AI analyseert..." spinner?
- [ ] 10. Check preview: Zie je factuurgegevens?
- [ ] 11. Klik "Akkoord & Boeken": Zie je success screen?
- [ ] 12. Check expert view: Zie je de factuur in inbox?

### Verwachte Resultaat:

**ALLE stappen zouden moeten werken** en **ELKE stap zichtbaar** in console.

## Als Het NOG STEEDS Niet Werkt

### Debug Checklist:

1. **Check Console Logs:**
   ```
   Zoek naar: [PortalUpload]
   Eerste log zou moeten zijn: "Component mounted"
   ```

2. **Check Company Status:**
   ```javascript
   // Plak in console:
   const { data: { user } } = await supabase.auth.getUser();
   const { data: cu } = await supabase
     .from('company_users')
     .select('*, companies(*)')
     .eq('user_id', user.id);
   console.log('Current user companies:', cu);
   ```

3. **Check RLS Policies:**
   ```sql
   -- Via Supabase Dashboard → SQL Editor:
   SELECT * FROM company_users WHERE user_id = auth.uid();
   SELECT * FROM companies WHERE id IN (
     SELECT company_id FROM company_users WHERE user_id = auth.uid()
   );
   ```

4. **Check Storage Access:**
   ```javascript
   // Plak in console:
   const { data, error } = await supabase.storage.getBucket('invoices');
   console.log('Bucket access:', { data, error });
   ```

5. **Check Network Tab:**
   - Zie je requests naar Supabase?
   - Zijn er 401/403 errors?
   - Zijn er CORS errors?

### Stuur Mij:

1. **Volledige console output** vanaf page load tot error
2. **Screenshot** van wat je ziet (of niet ziet)
3. **Network tab** screenshot van failed requests
4. **Browser info**: Chrome versie, Android versie

## Verwachte Verbetering

### Voor:
- ❌ Niets zichtbaar in client view
- ❌ Geen feedback tijdens upload
- ❌ Geen error messages
- ❌ Onmogelijk te debuggen

### Na:
- ✅ Company loading state zichtbaar
- ✅ Company error state zichtbaar
- ✅ Upload progress zichtbaar (spinner + text)
- ✅ AI processing zichtbaar (spinner + text)
- ✅ Preview state zichtbaar (factuurgegevens)
- ✅ Success state zichtbaar (groen vinkje)
- ✅ Error state zichtbaar (rood + details)
- ✅ Company naam zichtbaar (debug info)
- ✅ State indicator zichtbaar (debug info)
- ✅ 20+ console logs (volledige tracing)

## Conclusie

De client view zou nu **VOLLEDIG ZICHTBAAR** moeten zijn met **DUIDELIJKE FEEDBACK** voor elke stap van het proces.

Als je nog steeds niets ziet, is het een ander probleem (CSS, layout, browser compatibility) en NIET de component zelf.

**Test het en stuur me de console output!** 📱🔍
