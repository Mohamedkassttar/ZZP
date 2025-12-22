import { useState } from 'react';
import { LogIn, UserPlus, Mail, Lock, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface AuthProps {
  onAuthSuccess: () => void;
}

export function Auth({ onAuthSuccess }: AuthProps) {
  const [mode, setMode] = useState<'login' | 'signup'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (mode === 'signup') {
        console.log('Attempting signup for:', email);
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
          }
        });

        console.log('Signup response:', { data, error: signUpError });

        if (signUpError) throw signUpError;

        if (data.user) {
          // Check if email confirmation is required
          if (data.session) {
            console.log('User signed up with active session');
            setSuccess('Account aangemaakt! Je wordt automatisch ingelogd...');
            setTimeout(() => {
              onAuthSuccess();
            }, 1500);
          } else {
            console.log('User signed up but needs email confirmation');
            setSuccess('Account aangemaakt! Controleer je email voor de bevestigingslink. (Let op: Als je geen email ontvangt, is email confirmatie mogelijk uitgeschakeld en ben je direct ingelogd)');
            // Still try to proceed after a delay
            setTimeout(() => {
              onAuthSuccess();
            }, 2000);
          }
        } else {
          throw new Error('Geen gebruiker ontvangen na signup');
        }
      } else {
        console.log('Attempting login for:', email);
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        console.log('Login response:', { data, error: signInError });

        if (signInError) throw signInError;

        if (data.user && data.session) {
          console.log('User logged in successfully');
          setSuccess('Ingelogd! Laden...');
          setTimeout(() => {
            onAuthSuccess();
          }, 1000);
        } else {
          throw new Error('Geen sessie ontvangen na login');
        }
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      setError(err.message || 'Er is een fout opgetreden');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4">
            <span className="text-2xl font-bold text-white">B</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Boekhoud Systeem
          </h1>
          <p className="text-gray-600">
            {mode === 'signup' ? 'Maak een account aan om te starten' : 'Log in om verder te gaan'}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => {
                setMode('signup');
                setError(null);
                setSuccess(null);
              }}
              className={`flex-1 py-2.5 px-4 rounded-lg font-medium transition-all ${
                mode === 'signup'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <UserPlus className="w-4 h-4 inline mr-2" />
              Registreren
            </button>
            <button
              onClick={() => {
                setMode('login');
                setError(null);
                setSuccess(null);
              }}
              className={`flex-1 py-2.5 px-4 rounded-lg font-medium transition-all ${
                mode === 'login'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <LogIn className="w-4 h-4 inline mr-2" />
              Inloggen
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-green-800">{success}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jouw@email.nl"
                  required
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Wachtwoord
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              {mode === 'signup' && (
                <p className="mt-1.5 text-xs text-gray-500">
                  Minimaal 6 karakters
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Bezig...</span>
                </>
              ) : mode === 'signup' ? (
                <>
                  <UserPlus className="w-5 h-5" />
                  <span>Account Aanmaken</span>
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  <span>Inloggen</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-center text-sm text-gray-600">
              {mode === 'signup' ? (
                <>
                  Al een account?{' '}
                  <button
                    onClick={() => {
                      setMode('login');
                      setError(null);
                      setSuccess(null);
                    }}
                    className="text-blue-600 font-medium hover:text-blue-700"
                  >
                    Log in
                  </button>
                </>
              ) : (
                <>
                  Nog geen account?{' '}
                  <button
                    onClick={() => {
                      setMode('signup');
                      setError(null);
                      setSuccess(null);
                    }}
                    className="text-blue-600 font-medium hover:text-blue-700"
                  >
                    Registreer nu
                  </button>
                </>
              )}
            </p>
          </div>
        </div>

        {mode === 'signup' && (
          <div className="mt-6 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <p className="text-sm text-green-800">
                Je wordt automatisch gekoppeld aan Demo Bedrijf
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
