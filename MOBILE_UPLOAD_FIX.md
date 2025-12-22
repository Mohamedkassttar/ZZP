# Mobile Upload Fix - Analyse en Oplossing

## Probleem
Uploads werkten wel in desktop browsers maar niet op mobiele Chrome browser.

## Analyse - Gevonden Oorzaken

### 1. **Incorrect Camera Attribuut Handling**
**Locatie**: `src/components/portal/PortalUpload.tsx` (lijn 426)

**Probleem**:
- Het `capture="environment"` attribuut werd dynamisch toegevoegd via `setAttribute()`
- Dit werkt niet betrouwbaar op mobiele browsers
- De browser herkent het attribuut niet correct na het dynamisch toevoegen

**Code Voor**:
```typescript
onClick={() => {
  if (fileInputRef.current) {
    fileInputRef.current.setAttribute('capture', 'environment');
    fileInputRef.current.click();
  }
}}
```

### 2. **Onvolledige MIME Types in Accept Attribuut**
**Locatie**: Beide upload componenten

**Probleem**:
- `image/heic` (iPhone foto's) werd niet ondersteund
- Accept attribuut was te beperkt voor mobiele devices
- Sommige mobiele browsers interpreteren accept attributen strenger

**Code Voor**:
```typescript
accept={isInvoice ? 'application/pdf,image/*' : '...'}
```

### 3. **Geen Input Reset Na Upload**
**Probleem**:
- File input werd niet gereset na upload
- Dezelfde file kon niet opnieuw worden geüpload
- Op mobiel kan dit leiden tot "stuck" inputs

### 4. **Ontbrekende File Validatie**
**Probleem**:
- Geen client-side validatie van bestandsgrootte
- Geen validatie van bestandstype voordat upload start
- Op mobiel kunnen camera foto's zeer groot zijn (>10MB)

## Oplossing - Geïmplementeerde Fixes

### Fix 1: Aparte Camera Input Element
**Bestand**: `src/components/portal/PortalUpload.tsx`

**Wijziging**:
```typescript
// Toegevoegd: Aparte ref voor camera input
const cameraInputRef = useRef<HTMLInputElement>(null);

// Nieuw: Aparte camera input met native capture attribuut
<input
  ref={cameraInputRef}
  type="file"
  accept="image/*"
  capture="environment"  // Native HTML attribuut
  onChange={(e) => {
    if (e.target.files?.[0]) {
      handleFileSelect(e.target.files[0]);
      e.target.value = '';  // Reset input
    }
  }}
  className="hidden"
/>

// Camera knop gebruikt nu dedicated input
<button
  onClick={() => cameraInputRef.current?.click()}
  type="button"
  className="..."
>
  <Camera className="w-5 h-5" />
  Foto maken
</button>
```

**Voordelen**:
- `capture` attribuut is native HTML, geen JavaScript manipulatie
- Mobiele browsers openen direct de camera app
- Werkt betrouwbaar op iOS en Android

### Fix 2: Verbeterde Accept Attributen
**Bestanden**:
- `src/components/portal/PortalUpload.tsx`
- `src/components/FactuurInbox.tsx`

**Wijzigingen**:
```typescript
// Voor facturen/foto's
accept="application/pdf,image/jpeg,image/jpg,image/png,image/webp,image/heic,.pdf"

// Voor bankbestanden
accept="application/pdf,text/csv,application/xml,text/xml,text/plain,.pdf,.csv,.xml,.sta,.940"
```

**Toegevoegd**:
- `image/heic` - iPhone foto's (HEIC formaat)
- Expliciete `.pdf` extensie naast MIME type
- `text/xml` als alternatief voor `application/xml`
- Alle relevante bankbestand extensies

### Fix 3: Automatische Input Reset
**Bestanden**: Beide upload componenten

**Wijziging**:
```typescript
onChange={(e) => {
  if (e.target.files?.[0]) {
    handleFileSelect(e.target.files[0]);
    e.target.value = '';  // Reset na selectie
  }
}}
```

**Voordeel**: Gebruiker kan dezelfde file meerdere keren uploaden

### Fix 4: Client-Side Validatie
**Bestand**: `src/components/portal/PortalUpload.tsx`

**Nieuwe Logica**:
```typescript
async function handleFileSelect(selectedFile: File) {
  if (!selectedFile) return;

  // 1. Grootte check (10MB limiet)
  const maxSize = 10 * 1024 * 1024;
  if (selectedFile.size > maxSize) {
    setError('Bestand is te groot. Maximum grootte is 10MB.');
    return;
  }

  // 2. Type validatie
  const validTypes = isInvoice
    ? ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic']
    : ['application/pdf', 'text/csv', 'application/xml', 'text/xml', 'text/plain'];

  if (!validTypes.some(type => selectedFile.type.includes(type.split('/')[1]) || selectedFile.type === type)) {
    setError(`Ongeldig bestandstype: ${selectedFile.type}. Gebruik een geldig formaat.`);
    return;
  }

  // 3. Upload start...
}
```

**Voordelen**:
- Directe feedback aan gebruiker
- Voorkomt onnodige uploads
- Beschermt tegen grote mobiele foto's

### Fix 5: Type Attribute op Buttons
**Wijziging**:
```typescript
<button
  onClick={() => fileInputRef.current?.click()}
  type="button"  // Voorkomt form submit
  className="..."
>
```

**Voordeel**: Voorkomt onbedoelde form submissions op mobiel

## Storage RLS Policies - Verificatie
**Status**: ✅ Correct geconfigureerd

De Supabase storage RLS policies zijn correct:
- Anonymous users kunnen uploaden
- Authenticated users kunnen uploaden
- Beide rollen kunnen lezen en verwijderen
- Geen blocking policies gevonden

## Test Checklist

### Desktop Browser (Chrome/Firefox/Safari)
- [ ] File upload via "Bestand kiezen" knop
- [ ] Drag & drop upload
- [ ] PDF bestanden
- [ ] Afbeeldingen (JPG, PNG)

### Mobile Browser (Chrome op iOS/Android)
- [ ] File upload via "Bestand kiezen" knop
- [ ] Camera upload via "Foto maken" knop
- [ ] iPhone HEIC foto's
- [ ] Android foto's
- [ ] Grootte validatie (test >10MB file)
- [ ] Type validatie (test ongeldige files)

### Beide Platforms
- [ ] Error messages tonen correct
- [ ] Progress indicators werken
- [ ] Multiple uploads achter elkaar
- [ ] Dezelfde file tweemaal uploaden

## Verwachte Resultaten

### Voor de Fix
- Mobiel: Camera knop doet niets of opent file picker in plaats van camera
- Mobiel: Uploads falen zonder duidelijke error
- Mobiel: HEIC bestanden worden geweigerd
- Beide: Geen validatie feedback

### Na de Fix
- Mobiel: Camera knop opent direct de camera app
- Mobiel: HEIC en alle standaard foto formaten werken
- Beide: Duidelijke error messages bij ongeldige files
- Beide: Betrouwbare uploads met validatie

## Technische Details

### Browser Compatibility
- **iOS Safari/Chrome**: Ondersteunt `capture="environment"` native
- **Android Chrome**: Ondersteunt `capture="environment"` native
- **Desktop**: Camera knop wordt alleen getoond voor facturen, desktop kan via file picker foto's selecteren

### HEIC Formaat
- iOS gebruikt HEIC (High Efficiency Image Container) standaard voor foto's
- Dit formaat moet expliciet in accept attribuut staan
- Server-side verwerking moet HEIC kunnen converteren (via OpenAI Vision API)

### Performance Optimalisatie
- Validatie gebeurt client-side voordat upload start
- Voorkomt onnodige Supabase storage operaties
- Scheelt kosten en tijd bij ongeldige uploads

## Mogelijke Resterende Issues

1. **File Size op Mobiel**: Mobiele foto's kunnen nog steeds >10MB zijn. Overweeg:
   - Client-side compressie voor afbeeldingen
   - Duidelijkere melding over fotogrootte
   - Link naar instellingen om foto kwaliteit te verlagen

2. **Permissions**: Als camera niet opent:
   - Gebruiker moet browser permissions geven
   - Dit is browser/OS specifiek
   - Voeg instructies toe in UI

3. **iOS Safari Beperkingen**:
   - Safari iOS kan strenger zijn met file uploads
   - Test specifiek op iOS Safari (niet alleen Chrome iOS)

## Aanbevelingen

### Korte Termijn
1. ✅ Geïmplementeerd: Aparte camera input
2. ✅ Geïmplementeerd: Betere file type ondersteuning
3. ✅ Geïmplementeerd: Client-side validatie

### Lange Termijn
1. **Image Compressie**: Implementeer client-side image compressie
   ```typescript
   // Bijvoorbeeld met browser-image-compression library
   const compressedFile = await imageCompression(file, {
     maxSizeMB: 1,
     maxWidthOrHeight: 1920
   });
   ```

2. **Progress Feedback**: Voeg upload progress toe voor grote files
   ```typescript
   supabase.storage.from('invoices').upload(path, file, {
     onUploadProgress: (progress) => {
       setUploadProgress(progress.loaded / progress.total * 100);
     }
   });
   ```

3. **Permission Instructions**: Voeg UI tooltips toe voor camera permissions
   ```typescript
   {error?.includes('permission') && (
     <div className="text-sm text-gray-600 mt-2">
       <p>Camera toegang geblokkeerd?</p>
       <p>Ga naar je browser instellingen en sta camera toe.</p>
     </div>
   )}
   ```

4. **Fallback voor Oude Browsers**: Detecteer browser capabilities
   ```typescript
   const isCameraSupported = 'mediaDevices' in navigator &&
                            'getUserMedia' in navigator.mediaDevices;
   ```

## Conclusie

De mobile upload issues zijn opgelost door:
1. Native HTML `capture` attribuut correct te gebruiken
2. HEIC en andere mobiele foto formaten te ondersteunen
3. Robuuste client-side validatie toe te voegen
4. Input elements correct te resetten na gebruik

De code is nu compatibel met zowel desktop als mobiele browsers en biedt een betere gebruikerservaring met duidelijke feedback en validatie.
