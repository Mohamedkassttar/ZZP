import { supabase } from './supabase';
import type { Database } from './database.types';

type Account = Database['public']['Tables']['accounts']['Row'];

export interface FinancialSettings {
  id: string;
  cash_account_id: string | null;
  private_account_id: string | null;
  cash_account?: Account;
  private_account?: Account;
}

export async function getFinancialSettings(): Promise<FinancialSettings | null> {
  try {
    const { data, error } = await supabase
      .from('company_settings')
      .select(`
        id,
        cash_account_id,
        private_account_id,
        cash_account:accounts!company_settings_cash_account_id_fkey(id, code, name),
        private_account:accounts!company_settings_private_account_id_fkey(id, code, name)
      `)
      .single();

    if (error) {
      console.error('Error fetching financial settings:', error);
      return null;
    }

    return data as unknown as FinancialSettings;
  } catch (err) {
    console.error('Unexpected error in getFinancialSettings:', err);
    return null;
  }
}

export async function updateFinancialSettings(
  cashAccountId: string | null,
  privateAccountId: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: currentSettings } = await supabase
      .from('company_settings')
      .select('id')
      .single();

    if (!currentSettings) {
      return {
        success: false,
        error: 'Instellingen niet gevonden. Neem contact op met support.',
      };
    }

    const { error } = await supabase
      .from('company_settings')
      .update({
        cash_account_id: cashAccountId,
        private_account_id: privateAccountId,
      })
      .eq('id', currentSettings.id);

    if (error) {
      console.error('Error updating financial settings:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    return { success: true };
  } catch (err) {
    console.error('Unexpected error in updateFinancialSettings:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Onbekende fout',
    };
  }
}

export async function getCashAccount(): Promise<Account | null> {
  const settings = await getFinancialSettings();

  if (!settings?.cash_account_id) {
    console.warn('No cash account configured in settings');
    return null;
  }

  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('id', settings.cash_account_id)
    .single();

  if (error) {
    console.error('Error fetching cash account:', error);
    return null;
  }

  return data;
}

export async function getPrivateAccount(): Promise<Account | null> {
  const settings = await getFinancialSettings();

  if (!settings?.private_account_id) {
    console.warn('No private account configured in settings');
    return null;
  }

  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('id', settings.private_account_id)
    .single();

  if (error) {
    console.error('Error fetching private account:', error);
    return null;
  }

  return data;
}
