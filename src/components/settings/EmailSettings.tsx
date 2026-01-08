import { useState, useEffect } from 'react';
import { Mail, Send, Check, AlertCircle, Loader2, ExternalLink } from 'lucide-react';
import { getCompanySettings, updateCompanySettings, sendTestEmail, isEmailJSConfigured } from '../../lib/emailService';
import type { CompanySettings } from '../../lib/emailService';

export function EmailSettings() {
  const [settings, setSettings] = useState<CompanySettings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      setLoading(true);
      const data = await getCompanySettings();
      if (data) {
        setSettings(data);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    try {
      setSaving(true);
      setMessage(null);

      const success = await updateCompanySettings(settings);

      if (success) {
        setMessage({ type: 'success', text: 'Email instellingen opgeslagen!' });
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ type: 'error', text: 'Er is een fout opgetreden bij het opslaan.' });
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      setMessage({ type: 'error', text: 'Er is een fout opgetreden bij het opslaan.' });
    } finally {
      setSaving(false);
    }
  }

  async function handleSendTest() {
    if (!testEmail) {
      setMessage({ type: 'error', text: 'Voer een email adres in voor de test.' });
      return;
    }

    try {
      setSendingTest(true);
      setMessage(null);

      const result = await sendTestEmail(testEmail);

      if (result.success) {
        setMessage({ type: 'success', text: `Test email succesvol verzonden naar ${testEmail}!` });
        setTestEmail('');
      } else {
        setMessage({ type: 'error', text: result.error || 'Fout bij versturen test email.' });
      }
    } catch (error) {
      console.error('Error sending test email:', error);
      setMessage({ type: 'error', text: 'Er is een fout opgetreden bij het versturen.' });
    } finally {
      setSendingTest(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const isConfigured = isEmailJSConfigured(settings);

  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Mail className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Email Configuratie</h2>
            <p className="text-sm text-slate-600">
              Configureer EmailJS om emails te versturen vanuit de applicatie
            </p>
          </div>
        </div>

        {isConfigured && (
          <div className="mt-4 flex items-center gap-2 text-green-700 bg-green-50 px-4 py-3 rounded-lg">
            <Check className="w-5 h-5" />
            <span className="font-semibold">Email is geconfigureerd en klaar voor gebruik</span>
          </div>
        )}
      </div>

      {message && (
        <div
          className={`mb-6 flex items-center gap-3 px-4 py-3 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 text-green-900 border border-green-200'
              : 'bg-red-50 text-red-900 border border-red-200'
          }`}
        >
          {message.type === 'success' ? (
            <Check className="w-5 h-5 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900">
            <p className="font-semibold mb-2">EmailJS Account Vereist</p>
            <p className="mb-2">
              Deze applicatie gebruikt EmailJS voor het versturen van emails.
              Maak een gratis account aan en koppel je Gmail of Outlook.
            </p>
            <a
              href="https://www.emailjs.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold"
            >
              Maak een EmailJS account aan
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm divide-y divide-slate-200">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">EmailJS Configuratie</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Service ID *
              </label>
              <input
                type="text"
                value={settings.emailjs_service_id || ''}
                onChange={(e) => setSettings({ ...settings, emailjs_service_id: e.target.value })}
                placeholder="service_xxxxxxx"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
              />
              <p className="text-xs text-slate-500 mt-1">
                Bijv. service_gmail of service_outlook
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Template ID *
              </label>
              <input
                type="text"
                value={settings.emailjs_template_id || ''}
                onChange={(e) => setSettings({ ...settings, emailjs_template_id: e.target.value })}
                placeholder="template_xxxxxxx"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
              />
              <p className="text-xs text-slate-500 mt-1">
                De template ID uit je EmailJS dashboard
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Public Key *
              </label>
              <input
                type="text"
                value={settings.emailjs_public_key || ''}
                onChange={(e) => setSettings({ ...settings, emailjs_public_key: e.target.value })}
                placeholder="user_xxxxxxxxxxxxxxx"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
              />
              <p className="text-xs text-slate-500 mt-1">
                Je public key uit Account Settings
              </p>
            </div>

            <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
              <p className="text-sm font-semibold text-slate-900 mb-2">Waar vind ik deze gegevens?</p>
              <ol className="text-sm text-slate-600 space-y-1 list-decimal list-inside">
                <li>Log in op <a href="https://dashboard.emailjs.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">EmailJS Dashboard</a></li>
                <li>Klik op "Email Services" en noteer je Service ID</li>
                <li>Klik op "Email Templates" en noteer je Template ID</li>
                <li>Ga naar "Account" en kopieer je Public Key</li>
              </ol>
            </div>
          </div>
        </div>

        <div className="p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Afzender Informatie</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Afzender Naam *
              </label>
              <input
                type="text"
                value={settings.sender_name || ''}
                onChange={(e) => setSettings({ ...settings, sender_name: e.target.value })}
                placeholder="Jouw Bedrijf BV"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-slate-500 mt-1">
                Deze naam wordt getoond als afzender in emails
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Afzender Email *
              </label>
              <input
                type="email"
                value={settings.sender_email || ''}
                onChange={(e) => setSettings({ ...settings, sender_email: e.target.value })}
                placeholder="noreply@jouwbedrijf.nl"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-slate-500 mt-1">
                Het email adres dat als afzender wordt gebruikt
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 bg-slate-50">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Test Email Versturen</h3>

          <div className="flex gap-4">
            <div className="flex-1">
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="test@email.com"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={!isConfigured || sendingTest}
              />
            </div>
            <button
              onClick={handleSendTest}
              disabled={!isConfigured || sendingTest || !testEmail}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors font-semibold"
            >
              {sendingTest ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Verzenden...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Stuur Test
                </>
              )}
            </button>
          </div>

          {!isConfigured && (
            <p className="text-sm text-amber-700 mt-3">
              Sla eerst je SMTP-instellingen op voordat je een test email kunt versturen.
            </p>
          )}
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-4">
        <button
          onClick={loadSettings}
          disabled={saving}
          className="px-6 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-semibold"
        >
          Annuleren
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition-colors font-semibold"
        >
          {saving ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Opslaan...
            </>
          ) : (
            <>
              <Check className="w-5 h-5" />
              Instellingen Opslaan
            </>
          )}
        </button>
      </div>
    </div>
  );
}
