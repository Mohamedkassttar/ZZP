import { useState, useEffect } from 'react';
import { Mail, Send, Check, AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react';
import { getCompanySettings, updateCompanySettings, sendTestEmail, isSMTPConfigured } from '../../lib/emailService';
import type { CompanySettings } from '../../lib/emailService';

export function EmailSettings() {
  const [settings, setSettings] = useState<CompanySettings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
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

  const isConfigured = isSMTPConfigured(settings);

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
              Configureer je SMTP-instellingen om emails te versturen vanuit de applicatie
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

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm divide-y divide-slate-200">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">SMTP Server Instellingen</h3>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  SMTP Host *
                </label>
                <input
                  type="text"
                  value={settings.smtp_host || ''}
                  onChange={(e) => setSettings({ ...settings, smtp_host: e.target.value })}
                  placeholder="smtp.gmail.com"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Bijv. smtp.gmail.com, smtp.office365.com
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  SMTP Poort *
                </label>
                <input
                  type="number"
                  value={settings.smtp_port || 587}
                  onChange={(e) => setSettings({ ...settings, smtp_port: parseInt(e.target.value) })}
                  placeholder="587"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Standaard: 587 (TLS) of 465 (SSL)
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Gebruikersnaam / Email *
              </label>
              <input
                type="email"
                value={settings.smtp_user || ''}
                onChange={(e) => setSettings({ ...settings, smtp_user: e.target.value })}
                placeholder="jouw@email.com"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Wachtwoord / App-wachtwoord *
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={settings.smtp_password || ''}
                  onChange={(e) => setSettings({ ...settings, smtp_password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full px-4 py-2 pr-12 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-xs text-amber-900">
                  <strong>Let op:</strong> Gebruik een app-wachtwoord als je Gmail of Outlook gebruikt met 2-factor authenticatie.
                  <br />
                  Gmail: <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="underline">Maak app-wachtwoord aan</a>
                  <br />
                  Outlook: <a href="https://account.microsoft.com/security" target="_blank" rel="noopener noreferrer" className="underline">Beheer app-wachtwoorden</a>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="smtp_secure"
                checked={settings.smtp_secure !== false}
                onChange={(e) => setSettings({ ...settings, smtp_secure: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="smtp_secure" className="text-sm font-medium text-slate-700">
                Gebruik beveiligde verbinding (TLS/SSL)
              </label>
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
