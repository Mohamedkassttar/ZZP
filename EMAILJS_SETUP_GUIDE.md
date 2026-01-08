# EmailJS Setup Guide - 422 Error Oplossen

## Het Probleem

Je krijgt een `422 - The recipients address is empty` error. Dit betekent dat EmailJS de `to_email` parameter niet herkent in je template.

## De Oplossing: Template Correct Configureren

### Stap 1: Open je EmailJS Template

1. Ga naar [EmailJS Dashboard - Templates](https://dashboard.emailjs.com/admin/templates)
2. Klik op je template (of maak een nieuwe aan)

### Stap 2: Configureer de Template Settings

In het **Settings** gedeelte van je template:

#### To Email (VERPLICHT!)
```
{{to_email}}
```
Dit is het **belangrijkste veld**. Als dit niet correct staat, krijg je de 422 error.

#### From Name (Optioneel)
```
{{from_name}}
```

#### From Email (Optioneel)
```
{{from_email}}
```

#### Subject (Optioneel maar aanbevolen)
```
{{subject}}
```

### Stap 3: Template Body Content

Gebruik deze variabelen in je template body:

```
Hallo {{to_name}},

{{message}}

Met vriendelijke groet,
{{from_name}}
```

Of gebruik HTML:

```html
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
  </style>
</head>
<body>
  <div class="container">
    {{{message}}}
  </div>
</body>
</html>
```

**Let op:** Gebruik `{{{message}}}` (3 accolades) voor HTML content!

### Stap 4: Test de Configuratie

1. Klik op **Save** in het EmailJS dashboard
2. Ga terug naar de applicatie
3. Open de **Browser Console** (F12)
4. Ga naar **Instellingen > Email Configuratie**
5. Voer een test email adres in
6. Klik op "Stuur Test"
7. Check de console voor debugging logs

## Debugging in de Console

Als je de test verstuurt, zie je deze logs:

```
🧪 Preparing test email to: test@example.com
📧 Sending email via EmailJS with params: {
  to_email: "test@example.com",
  from_name: "Mijn Bedrijf",
  subject: "Test Email - EmailJS Configuratie",
  serviceId: "service_xxxxx",
  templateId: "template_xxxxx"
}
```

Als je dit ziet, stuurt de applicatie de juiste data. Het probleem is dan in je EmailJS template configuratie.

## Veelgemaakte Fouten

### ❌ Fout 1: Verkeerde variabele naam
```
To Email: {{email}}  ← FOUT
```

### ✅ Correct:
```
To Email: {{to_email}}  ← CORRECT
```

### ❌ Fout 2: Geen dubbele accolades
```
To Email: to_email  ← FOUT
```

### ✅ Correct:
```
To Email: {{to_email}}  ← CORRECT
```

### ❌ Fout 3: Spaties in de variabele naam
```
To Email: {{ to_email }}  ← FOUT (spaties)
```

### ✅ Correct:
```
To Email: {{to_email}}  ← CORRECT (geen spaties)
```

## Complete Voorbeeld Template

### Settings Tab:
- **Template Name**: Mijn Bedrijf - Email Template
- **To Email**: `{{to_email}}`
- **From Name**: `{{from_name}}`
- **From Email**: `{{from_email}}`
- **Subject**: `{{subject}}`

### Content Tab:
```html
<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    {{{message}}}
  </div>
</body>
</html>
```

## Variabelen die de Applicatie Verstuurt

De applicatie stuurt altijd deze parameters naar EmailJS:

| Parameter | Beschrijving | Voorbeeld |
|-----------|--------------|-----------|
| `to_email` | Het emailadres van de ontvanger | `klant@example.com` |
| `to_name` | De naam van de ontvanger | `Jan Jansen` |
| `from_name` | De naam van de afzender | `Mijn Bedrijf BV` |
| `from_email` | Het emailadres van de afzender | `info@mijnbedrijf.nl` |
| `subject` | Het onderwerp van de email | `Factuur 2024-001` |
| `message` | De HTML content van het bericht | `<html>...</html>` |

## Hulp Nodig?

Als je nog steeds problemen hebt:

1. Check de browser console (F12) voor debugging informatie
2. Controleer of je EmailJS template exact `{{to_email}}` gebruikt bij "To Email"
3. Zorg dat je template is opgeslagen in het EmailJS dashboard
4. Test met een ander template ID om uit te sluiten dat het aan caching ligt

## EmailJS Account Instellingen

Vergeet niet om ook je EmailJS Service correct te configureren:

1. Ga naar [Email Services](https://dashboard.emailjs.com/admin)
2. Klik op je service (bijv. Gmail of Outlook)
3. Volg de verificatie stappen
4. Test je service met de EmailJS test functie

## Success!

Als alles correct is geconfigureerd, krijg je:

1. ✅ Geen 422 error meer
2. ✅ Een succesmelding in de applicatie
3. ✅ Een ontvangen email in je inbox
4. ✅ Console logs die de verzonden parameters tonen

Good luck!
