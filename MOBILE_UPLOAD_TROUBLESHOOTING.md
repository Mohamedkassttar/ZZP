# Mobile Upload Troubleshooting Guide - Diepgaande Analyse

## Probleem Situatie
Uploads werken op desktop maar NIET op mobiele Chrome browser.

## Diepgaande Analyse - Gevonden Root Causes

### **KRITIEKE OORZAAK #1: Supabase Storage Bucket MIME Type Whitelist** ⚠️

**Locatie**: Supabase Storage `invoices` bucket configuratie

**Probleem**:
De storage bucket had `allowed_mime_types` ingesteld die **NIET** alle mobiele foto formaten ondersteunde:

**Originele Configuratie**:
```json
{
  "allowed_mime_types": [
    "application/pdf",
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp"
  ]
}
```

**Wat ontbrak**:
- ❌ `image/heic` - iPhone foto's (standaard formaat sinds iOS 11)
- ❌ `image/heif` - Alternative HEIF formaat
- ❌ `text/csv` - Bank bestanden
- ❌ `application/xml` - Bank bestanden (CAMT.053)
- ❌ `text/xml` - Alternative XML MIME type
- ❌ `text/plain` - MT940 bestanden

**Impact**:
- iPhone gebruikers konden GEEN foto's uploaden
- Upload faalde op server-side met 422 of 403 error
- Geen duidelijke error message in UI
- Client-side validatie liet het door, maar server weigerde

**Oplossing Toegepast**:
```sql
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',        -- ✅ TOEGEVOEGD
  'image/heif',        -- ✅ TOEGEVOEGD
  'text/csv',          -- ✅ TOEGEVOEGD
  'application/xml',   -- ✅ TOEGEVOEGD
  'text/xml',          -- ✅ TOEGEVOEGD
  'text/plain'         -- ✅ TOEGEVOEGD
]
WHERE name = 'invoices';
```

### **OORZAAK #2: MIME Type Detection Problemen op Mobiel**

**Probleem**:
Mobiele browsers rapporteren soms **geen** of **verkeerde** MIME types voor bestanden:

**Voorbeelden**:
| Browser | OS | Bestand | Gerapporteerd MIME Type |
|---------|----|---------|-----------------------|
| Chrome | iOS | HEIC foto | `""` (leeg) of `application/octet-stream` |
| Safari | iOS | HEIC foto | `image/heic` (correct) |
| Chrome | Android | Camera foto | Soms `""` (leeg) |
| Safari | iOS | PDF | `application/pdf` (correct) |

**Impact**:
- Client-side validatie faalde onterecht
- Upload kreeg verkeerde content-type header
- Supabase weigerde bestand

**Oplossing Toegepast**:
```typescript
// 1. Fallback detectie via bestandsextensie
const fileName = selectedFile.name.toLowerCase();
const fileExtension = fileName.split('.').pop() || '';

// 2. Triple validatie methode
const isValidByMimeType = validTypes.some(type =>
  selectedFile.type === type || selectedFile.type.includes(type.split('/')[1])
);
const isValidByExtension = validExtensions.includes(fileExtension);
const isValidByName = /\.(jpe?g|png|webp|heic|heif|pdf)$/i.test(fileName);

// 3. Accepteer als MINIMAAL 1 methode klopt
if (!isValidByMimeType && !isValidByExtension && !isValidByName && selectedFile.type !== '') {
  // Alleen error als GEEN enkele methode klopt
}

// 4. Content-Type detectie via extensie als MIME type leeg is
let detectedContentType = selectedFile.type;
if (!detectedContentType || detectedContentType === '') {
  if (fileExtension === 'heic' || fileExtension === 'heif') {
    detectedContentType = 'image/heic';
  } else if (fileExtension === 'jpg' || fileExtension === 'jpeg') {
    detectedContentType = 'image/jpeg';
  }
  // ... etc
}
```

### **OORZAAK #3: Incomplete Accept Attributen**

**Probleem**:
Accept attributen op `<input type="file">` waren te beperkt:

**Voor**:
```html
<input type="file" accept="application/pdf,image/*" />
```

**Probleem met dit patroon**:
- `image/*` werkt NIET voor `.heic` op sommige browsers
- Sommige browsers checken accept attribuut heel strikt
- File picker toont soms niet alle toegestane bestanden

**Oplossing**:
```html
<input
  type="file"
  accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif"
/>
```

**Waarom dit werkt**:
- Extensions eerst (`.heic`) → browser herkent bestandstype
- Daarna MIME types → voor systemen die op MIME type checken
- Beide methoden samen → maximale compatibiliteit

### **OORZAAK #4: Ontbrekende Debug Informatie**

**Probleem**:
- Geen console logging
- Geen visibility in waar het fout ging
- Gebruiker zag alleen "iets werkt niet"
- Developer kon niet debuggen zonder source code access

**Oplossing**:
Uitgebreide debug logging op alle kritieke punten:

```typescript
console.log('[Mobile Upload Debug] File selected:', {
  name: selectedFile.name,
  type: selectedFile.type,
  size: selectedFile.size,
  lastModified: selectedFile.lastModified
});

console.log('[Mobile Upload Debug] File validation passed:', {
  isValidByMimeType,
  isValidByExtension,
  isValidByName,
  mimeType: selectedFile.type,
  extension: fileExtension
});

console.log('[Mobile Upload Debug] Starting upload to Supabase Storage...');
console.log('[Mobile Upload Debug] Content-Type (original):', selectedFile.type);
console.log('[Mobile Upload Debug] Content-Type (detected):', detectedContentType);
```

## Implementatie Overzicht

### Fixes in `PortalUpload.tsx`:

1. ✅ **Triple File Validatie**
   - MIME type check
   - File extension check
   - Filename pattern check

2. ✅ **Smart Content-Type Detection**
   - Gebruikt originele MIME type als beschikbaar
   - Fallback naar extensie-based detectie
   - Altijd een valide content-type

3. ✅ **Comprehensive Debug Logging**
   - Elke stap wordt gelogd
   - File properties worden getoond
   - Errors worden volledig gelogd

4. ✅ **Better Error Messages**
   - Toon bestandsgrootte in error
   - Toon MIME type en extensie
   - Duidelijke instructies

5. ✅ **Improved Accept Attributes**
   - Extensions eerst, MIME types daarna
   - Expliciet `.heic` en `.heif`
   - Separate camera input met juiste accept

### Fixes in `FactuurInbox.tsx`:

1. ✅ **Better Accept Attributes**
   - Zelfde pattern als PortalUpload
   - Expliciete extensies

2. ✅ **Input Reset**
   - `e.target.value = ''` na elke upload
   - Voorkomt "stuck" file input

### Database Fixes:

1. ✅ **Storage Bucket Whitelist**
   - HEIC/HEIF toegevoegd
   - Alle bank formaten toegevoegd
   - 10MB size limit behouden

## Test Strategie voor Mobiel

### Stap 1: Open Browser Console op Mobiel

**iPhone (Safari)**:
1. Instellingen → Safari → Geavanceerd → Web Inspector: AAN
2. Mac: Safari → Ontwikkel → [Jouw iPhone] → [Tab naam]

**Android (Chrome)**:
1. Chrome op telefoon: Open pagina
2. Desktop Chrome: `chrome://inspect`
3. Selecteer je device en pagina

### Stap 2: Test Upload Flow

Upload een test bestand en kijk naar console output:

**Verwachte Console Output (SUCCESS)**:
```
[Mobile Upload Debug] File selected: {name: "IMG_1234.heic", type: "image/heic", size: 2458392, ...}
[Mobile Upload Debug] File validation passed: {isValidByMimeType: true, isValidByExtension: true, ...}
[Mobile Upload Debug] Getting company ID...
[Mobile Upload Debug] Company ID: "abc-123-..."
[Mobile Upload Debug] Starting upload to Supabase Storage...
[Mobile Upload Debug] Content-Type (original): "image/heic"
[Mobile Upload Debug] Content-Type (detected): "image/heic"
[Mobile Upload Debug] Upload successful: {path: "invoices/1703345678_IMG_1234.heic", ...}
[Mobile Upload Debug] Creating document record in database...
[Mobile Upload Debug] Document record created: "doc-123"
[Mobile Upload Debug] Starting AI analysis...
```

**Mogelijke Errors en Oplossingen**:

#### Error: "File too large"
```
[Mobile Upload Debug] File too large: 12.45MB. Maximum is 10MB.
```
**Oplossing**:
- Gebruik kleinere foto
- Of: Verhoog limit in storage bucket (niet aanbevolen)

#### Error: "Invalid file type"
```
[Mobile Upload Debug] Invalid file type: application/octet-stream (.heic)
```
**Dit zou NIET meer moeten gebeuren!**
Maar als het wel gebeurt:
- Check of storage bucket whitelist correct is
- Check of bestand echt een valide extensie heeft

#### Error: "Supabase Storage Error: new row violates row-level security policy"
```
[Mobile Upload Debug] Supabase Storage Error: {message: "new row violates row-level security policy"}
```
**Oplossing**:
- RLS policy probleem
- Check of user ingelogd is
- Check of company_id correct is

#### Error: "Database error: violates foreign key constraint"
```
[Mobile Upload Debug] Database Error: {message: 'insert or update on table "documents_inbox" violates foreign key constraint "documents_inbox_company_id_fkey"'}
```
**Oplossing**:
- Company ID bestaat niet
- Check of `getCurrentCompanyId()` correct werkt

### Stap 3: Specifieke Test Cases

Test deze scenarios op je mobiel:

| Test Case | Verwacht Resultaat |
|-----------|-------------------|
| **iPhone Camera Foto (HEIC)** | ✅ Upload succesvol |
| **Android Camera Foto** | ✅ Upload succesvol |
| **PDF van Files app** | ✅ Upload succesvol |
| **Screenshot (PNG)** | ✅ Upload succesvol |
| **Bestand >10MB** | ❌ Error: "File too large" |
| **Word document (.docx)** | ❌ Error: "Invalid file type" |
| **Dezelfde foto 2x** | ✅ Beide keren succesvol |

## Mogelijke Resterende Issues

### Issue 1: Camera Permissions

**Symptoom**: Camera knop opent file picker in plaats van camera

**Oorzaken**:
- Browser heeft geen camera permission
- Device heeft geen camera (tablet)
- `capture` attribuut wordt niet ondersteund (oude browser)

**Debug**:
```javascript
// Check of camera beschikbaar is
navigator.mediaDevices?.getUserMedia({ video: true })
  .then(() => console.log('Camera access: OK'))
  .catch(e => console.error('Camera access: DENIED', e));
```

**Oplossing**:
- Gebruiker moet browser permission geven
- Settings → Chrome → Site Settings → Camera → Allow
- Of: Gebruik "Bestand kiezen" knop als workaround

### Issue 2: CORS Errors

**Symptoom**:
```
Access to fetch at 'https://xxx.supabase.co' from origin 'https://yyy' has been blocked by CORS
```

**Oorzaak**:
- Supabase storage CORS niet correct geconfigureerd
- Origin niet toegestaan

**Debug**:
Check network tab voor preflight OPTIONS request

**Oplossing**:
Supabase dashboard → Storage → Configuration → Allowed Origins

### Issue 3: File Size Limits

**Server-side limit**: 10MB (storage bucket)
**Client-side limit**: 10MB (validatie)

**Mobiele foto groottes**:
- iPhone 13 Pro camera: 2-8MB (HEIC compressed)
- Android high-res: 3-12MB
- Screenshots: 0.5-2MB

**Als fotos te groot zijn**:
1. Verlaag camera kwaliteit in phone settings
2. Implementeer client-side image compression
3. Verhoog server limit (niet aanbevolen)

### Issue 4: Slow Network / Timeouts

**Symptoom**: Upload start maar stopt halverwege

**Oorzaak**:
- Mobiel internet is traag
- Upload timeout
- Connection lost

**Oplossing**:
Voeg upload progress toe:

```typescript
const { data, error } = await supabase.storage
  .from('invoices')
  .upload(path, file, {
    upsert: false,
    onUploadProgress: (progress) => {
      const percent = (progress.loaded / progress.total) * 100;
      console.log(`Upload progress: ${percent.toFixed(0)}%`);
      // Update UI progress bar
    }
  });
```

## Verificatie Checklist

Gebruik deze checklist om te verifiëren dat alles werkt:

### Backend Configuratie
- [ ] Storage bucket `invoices` bestaat
- [ ] Bucket heeft correcte `allowed_mime_types` (incl. HEIC)
- [ ] Bucket file_size_limit = 10485760 (10MB)
- [ ] RLS policies staan anonymous uploads toe
- [ ] CORS is correct geconfigureerd

### Frontend Code
- [ ] Accept attributen bevatten `.heic` en `.heif`
- [ ] Content-Type detectie met fallback
- [ ] Triple validatie (MIME + extension + name)
- [ ] Debug logging actief
- [ ] Error messages informatief
- [ ] Camera input apart van file input
- [ ] Input reset na upload

### Testing
- [ ] Test op iPhone (Safari & Chrome)
- [ ] Test op Android (Chrome)
- [ ] Test camera functie
- [ ] Test file picker
- [ ] Test HEIC bestanden
- [ ] Test PDF bestanden
- [ ] Test error cases (>10MB, wrong type)
- [ ] Check console logs
- [ ] Check network tab

## Next Steps - Als Het NOG STEEDS Niet Werkt

### 1. Collect Debug Info

Open je app op mobiel en probeer te uploaden. Stuur mij:

```
Browser Console Output:
[Plak hier alle regels met "[Mobile Upload Debug]"]

Network Tab Output:
- Request URL naar storage.supabase.co
- Request Method (POST/PUT)
- Status Code
- Response body

User Info:
- Browser: Chrome/Safari
- OS: iOS 17.2 / Android 14
- Device: iPhone 14 / Samsung Galaxy S23
```

### 2. Check Supabase Logs

Supabase Dashboard → Logs → Storage Logs

Kijk naar:
- 403 errors → Permission probleem
- 422 errors → MIME type niet toegestaan
- 413 errors → File te groot
- 500 errors → Server error

### 3. Test Simplified Version

Maak een minimale test pagina:

```html
<!DOCTYPE html>
<html>
<body>
  <input type="file" accept=".heic,.jpg,.pdf" id="fileInput" />
  <script type="module">
    import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

    const supabase = createClient('YOUR_URL', 'YOUR_ANON_KEY');

    document.getElementById('fileInput').onchange = async (e) => {
      const file = e.target.files[0];
      console.log('Selected:', file.name, file.type, file.size);

      const { data, error } = await supabase.storage
        .from('invoices')
        .upload(`test_${Date.now()}_${file.name}`, file);

      if (error) {
        console.error('ERROR:', error);
      } else {
        console.log('SUCCESS:', data);
      }
    };
  </script>
</body>
</html>
```

Test deze pagina op mobiel. Als DIT werkt maar je app niet, dan is het probleem in je app code.

### 4. Alternative Workaround

Als NIETS werkt, tijdelijke workaround:

```typescript
// Converteer HEIC naar JPEG client-side
// Gebruik: heic2any library
import heic2any from 'heic2any';

if (file.type === 'image/heic' || file.name.toLowerCase().endsWith('.heic')) {
  const convertedBlob = await heic2any({ blob: file, toType: 'image/jpeg' });
  file = new File([convertedBlob], file.name.replace(/\.heic$/i, '.jpg'), {
    type: 'image/jpeg'
  });
}
```

## Conclusie

De volgende kritieke fixes zijn toegepast:

1. ✅ **Storage bucket whitelist uitgebreid** met HEIC/HEIF en bank formaten
2. ✅ **Smart content-type detectie** met fallback naar extensie
3. ✅ **Triple file validatie** voor maximum compatibiliteit
4. ✅ **Comprehensive debug logging** voor troubleshooting
5. ✅ **Verbeterde accept attributen** met expliciete extensies
6. ✅ **Betere error messages** met specifieke details

**De mobiele upload zou nu moeten werken!**

Als het NIET werkt:
1. Open browser console op mobiel
2. Probeer upload
3. Kopieer ALLE console output
4. Deel met mij voor verdere analyse

**Test het nu op je telefoon en laat me weten wat je ziet in de console! 📱**
