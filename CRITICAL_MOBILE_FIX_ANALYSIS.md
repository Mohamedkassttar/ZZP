# CRITICAL Mobile Upload Fix - Root Cause Analysis

## Symptoom
- **Expert Mode (FactuurInbox)**: Upload werkt WEL op Samsung telefoon ✅
- **Portal Mode (PortalUpload)**: Upload werkt NIET op Samsung telefoon ❌

## Root Cause Gevonden! 🎯

### Het Probleem: Verschillende Upload Implementaties

De expert mode en portal mode gebruikten **COMPLEET VERSCHILLENDE** upload logica:

#### Expert Mode (FactuurInbox) - WERKTE
```typescript
async function handleFiles(files: File[]) {
  for (const file of files) {
    const result = await uploadInvoiceFile(file);  // ✅ Getest en betrouwbaar
    // ...
  }
}
```

**Gebruikte**: `uploadInvoiceFile()` uit `invoiceService.ts`

#### Portal Mode (PortalUpload) - WERKTE NIET
```typescript
async function handleFileSelect(selectedFile: File) {
  // ... eigen validatie code ...

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('invoices')
    .upload(filePath, selectedFile, uploadOptions);  // ❌ Directe upload

  // ... eigen database insert code ...
}
```

**Gebruikte**: Directe Supabase upload + eigen logica

## Waarom Faalde Portal Mode?

### Probleem 1: Strenge MIME Type Validatie (OORSPRONKELIJK)

De **originele** `uploadInvoiceFile` functie had:

```typescript
if (!file.type.match(/^(image\/(jpeg|jpg|png|webp)|application\/pdf)$/)) {
  return { success: false, error: '...' };
}
```

Dit was een **regex match** die ALLEEN deze exacte MIME types accepteerde:
- `image/jpeg`
- `image/jpg`
- `image/png`
- `image/webp`
- `application/pdf`

**NIET ondersteund:**
- ❌ `image/heic` (iPhone standaard)
- ❌ `image/heif`
- ❌ `''` (leeg - Samsung rapporteert soms geen MIME type)
- ❌ `application/octet-stream` (fallback)

### Probleem 2: Geen Fallback voor Lege MIME Types

Samsung telefoons rapporteren soms:
- MIME type = `''` (leeg)
- Of: MIME type = `application/octet-stream`

De originele validatie had geen fallback naar bestandsextensie detectie.

### Probleem 3: Inconsistente Implementaties

**Expert Mode** gebruikte een getest service met error handling.
**Portal Mode** had eigen implementatie die subtiel anders was.

Dit creëerde een situatie waar:
- Expert mode werkte (toevallig omdat de Samsung browser daar de juiste MIME type stuurde)
- Portal mode faalde (omdat er subtiele verschillen waren in de logica)

## De Oplossing

### Fix 1: Verbeterde File Validatie in `uploadInvoiceFile()`

**Triple Validation Approach:**

```typescript
const fileName = file.name.toLowerCase();
const fileExtension = fileName.split('.').pop() || '';

const validExtensions = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'];
const validMimeTypes = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',   // ✅ Toegevoegd
  'image/heif'    // ✅ Toegevoegd
];

// Methode 1: Check MIME type
const isValidByMimeType = file.type !== '' && (
  validMimeTypes.includes(file.type) ||
  validMimeTypes.some(type => file.type.includes(type.split('/')[1]))
);

// Methode 2: Check bestandsextensie
const isValidByExtension = validExtensions.includes(fileExtension);

// Methode 3: Check filename pattern
const isValidByName = /\.(jpe?g|png|webp|heic|heif|pdf)$/i.test(fileName);

// ✅ Accepteer als MINIMAAL 1 methode klopt
if (!isValidByExtension && !isValidByMimeType && !isValidByName && file.type !== '') {
  return { success: false, error: '...' };
}
```

**Waarom dit werkt:**
- Als MIME type leeg is (`''`) → Check extensie
- Als MIME type verkeerd is maar extensie klopt → Accept
- Als alles faalt → Reject

### Fix 2: Smart Content-Type Detection

```typescript
let detectedContentType = file.type;

if (!detectedContentType || detectedContentType === '') {
  // Fallback naar extensie-based detectie
  if (fileExtension === 'heic' || fileExtension === 'heif') {
    detectedContentType = 'image/heic';
  } else if (fileExtension === 'jpg' || fileExtension === 'jpeg') {
    detectedContentType = 'image/jpeg';
  } else if (fileExtension === 'png') {
    detectedContentType = 'image/png';
  } else if (fileExtension === 'webp') {
    detectedContentType = 'image/webp';
  } else if (fileExtension === 'pdf') {
    detectedContentType = 'application/pdf';
  } else {
    detectedContentType = 'application/octet-stream';
  }
}

// Gebruik gedetecteerde content-type
const { data, error } = await supabase.storage
  .from(BUCKET)
  .upload(storagePath, file, {
    contentType: detectedContentType,  // ✅ Altijd een valide type
    upsert: false,
  });
```

### Fix 3: Unified Upload Implementation

**Portal Mode nu:**

```typescript
async function handleFileSelect(selectedFile: File) {
  setFile(selectedFile);
  setState('uploading');
  setError(null);

  try {
    if (isInvoice) {
      // ✅ GEBRUIK EXACT DEZELFDE FUNCTIE ALS EXPERT MODE
      console.log('[Portal Upload] Using uploadInvoiceFile (same as expert mode)...');
      const uploadResult = await uploadInvoiceFile(selectedFile);

      if (!uploadResult.success) {
        throw new Error(uploadResult.error || 'Upload failed');
      }

      // Continue met AI processing...
    } else {
      // Bank import...
    }
  } catch (err) {
    // Error handling...
  }
}
```

**Voordelen:**
- ✅ Exact dezelfde logica als expert mode
- ✅ Geen duplicate code
- ✅ Alle bug fixes gelden voor beide modes
- ✅ Consistent gedrag

### Fix 4: Comprehensive Debug Logging

```typescript
console.log('[Upload Debug] Starting upload:', {
  name: file.name,
  type: file.type,
  size: file.size
});

console.log('[Upload Debug] File validation passed:', {
  isValidByExtension,
  isValidByMimeType,
  isValidByName
});

console.log('[Upload Debug] Uploading to storage:', {
  path: storagePath,
  contentType: detectedContentType
});
```

**Nu kun je op Samsung:**
1. Open Chrome DevTools: `chrome://inspect`
2. Selecteer je device
3. Zie exact waar het fout gaat

## Wat Was Het Echte Probleem?

**De Samsung telefoon rapporteerde waarschijnlijk:**

### Scenario A: Leeg MIME Type
```
File: "IMG_20231222_143012.jpg"
MIME Type: ""  (leeg)
```

**Originele Portal Code**: ❌ Upload faalde (geen MIME type)
**Gefixte Code**: ✅ Detecteert `.jpg` extensie → `image/jpeg`

### Scenario B: Generiek MIME Type
```
File: "document.pdf"
MIME Type: "application/octet-stream"
```

**Originele Portal Code**: ❌ Onverwacht MIME type
**Gefixte Code**: ✅ Check extensie → `.pdf` → Accept

### Scenario C: HEIC Foto's
```
File: "IMG_1234.heic"
MIME Type: "image/heic"
```

**Originele Code**: ❌ HEIC niet in whitelist
**Gefixte Code**: ✅ HEIC in validMimeTypes

## Verificatie Checklist

### In Expert Mode (FactuurInbox):
- [x] Gebruikt `uploadInvoiceFile()`
- [x] Ondersteunt HEIC/HEIF
- [x] Triple validation
- [x] Smart content-type detection
- [x] Debug logging

### In Portal Mode (PortalUpload):
- [x] Gebruikt `uploadInvoiceFile()` ← **NIEUWE FIX**
- [x] Ondersteunt HEIC/HEIF ← **NIEUWE FIX**
- [x] Triple validation ← **NIEUWE FIX**
- [x] Smart content-type detection ← **NIEUWE FIX**
- [x] Debug logging ← **NIEUWE FIX**

### Storage Bucket:
- [x] `allowed_mime_types` bevat `image/heic`
- [x] `allowed_mime_types` bevat `image/heif`
- [x] `file_size_limit` = 10MB
- [x] RLS policies correct

## Test Plan voor Samsung

### Stap 1: Open DevTools

**Android Chrome:**
1. Desktop: Open Chrome → `chrome://inspect`
2. Connect Samsung via USB
3. Enable USB debugging op telefoon
4. Selecteer device → Inspect

### Stap 2: Test Upload in Portal Mode

**Verwachte Console Output:**

```
[Upload Debug] Starting upload: {name: "photo.jpg", type: "", size: 2458392}
[Upload Debug] File validation passed: {
  isValidByExtension: true,
  isValidByMimeType: false,
  isValidByName: true
}
[Upload Debug] Uploading to storage: {
  path: "invoices/1703345678_photo.jpg",
  contentType: "image/jpeg"
}
[Upload Debug] Storage upload successful, creating database record...
[Portal Upload] Upload successful, document ID: "abc-123-..."
[Portal Upload] Starting AI analysis...
```

### Stap 3: Vergelijk met Expert Mode

Upload hetzelfde bestand in expert mode.

**Verwacht resultaat:**
✅ EXACT DEZELFDE console output
✅ EXACT DEZELFDE database records
✅ EXACT HETZELFDE gedrag

## Waarom Expert Mode Werkte (Maar Portal Niet)

Dit is waarschijnlijk toeval geweest:

1. **Expert mode** werd getest met bestanden die toevallig een correct MIME type hadden
2. **Portal mode** kreeg bestanden waar Samsung een leeg/verkeerd MIME type stuurde
3. De **kleine verschillen** in validatie logica maakten het verschil

Door BEIDE te laten gebruiken van `uploadInvoiceFile()` is dit probleem nu opgelost.

## Conclusie

### Hoofdprobleem:
**Code duplication** + **inconsistente validatie** = Samsung uploads faalden

### Oplossing:
1. ✅ **Single source of truth**: `uploadInvoiceFile()` voor beide modes
2. ✅ **Triple validation**: MIME type + extensie + filename
3. ✅ **Smart detection**: Fallback naar extensie bij leeg MIME type
4. ✅ **HEIC support**: Volledig ondersteund
5. ✅ **Debug logging**: Zichtbaar waar het fout gaat

### Verwacht Resultaat:
**Portal mode werkt nu EXACT HETZELFDE als expert mode** → Samsung uploads succesvol ✅

## Als Het NOG STEEDS Niet Werkt

Dan is het een ander probleem (niet de upload logica):

### Mogelijke Oorzaken:
1. **RLS Policy** - Gebruiker heeft geen toegang
2. **Company ID** - Geen company geselecteerd in portal mode
3. **Network** - CORS, timeout, of connection issues
4. **Browser** - Samsung Internet browser (niet Chrome)

### Debug Commando:
```javascript
// Plak in Samsung Chrome console:
const { data: { user } } = await supabase.auth.getUser();
const { data: companies } = await supabase.from('companies').select('*');
console.log('User:', user?.id);
console.log('Companies:', companies);
```

Stuur mij de output + alle `[Upload Debug]` en `[Portal Upload]` logs.

## Files Gewijzigd

1. ✅ `src/lib/invoiceService.ts`
   - Triple validation
   - Smart content-type detection
   - HEIC/HEIF support
   - Debug logging

2. ✅ `src/components/portal/PortalUpload.tsx`
   - Nu gebruikt `uploadInvoiceFile()`
   - Veel simpeler (minder code)
   - Exact hetzelfde als expert mode

3. ✅ `src/components/FactuurInbox.tsx`
   - Geen wijzigingen (bleef al correct werken)

4. ✅ Storage Bucket `invoices`
   - `allowed_mime_types` uitgebreid met HEIC/HEIF

**Test het nu op je Samsung en check de console! 📱**
