import { supabase } from './supabase';
import { dutchChartOfAccounts } from '../data/dutchChartOfAccounts';

export async function seedAccounts(): Promise<{ success: boolean; message: string; count: number }> {
  try {
    console.log('seedAccounts: Starting...');
    const { data: existingAccounts, error: fetchError } = await supabase
      .from('accounts')
      .select('code');

    console.log('seedAccounts: Query result -', { count: existingAccounts?.length, error: fetchError });

    if (fetchError) {
      console.error('seedAccounts: Fetch error -', fetchError);
      return { success: false, message: `Error checking accounts: ${fetchError.message}`, count: 0 };
    }

    if (existingAccounts && existingAccounts.length > 0) {
      console.log(`seedAccounts: ${existingAccounts.length} accounts already exist`);
      return {
        success: true,
        message: 'Chart of Accounts already seeded',
        count: existingAccounts.length
      };
    }

    console.log('seedAccounts: No accounts found, will insert...');

    const accountsToInsert = dutchChartOfAccounts.map(account => ({
      code: account.code,
      name: account.name,
      type: account.type,
      vat_code: account.vat_code,
      description: account.description,
      is_active: true,
    }));

    const { error: insertError, count } = await supabase
      .from('accounts')
      .insert(accountsToInsert);

    if (insertError) {
      return { success: false, message: `Error seeding accounts: ${insertError.message}`, count: 0 };
    }

    return {
      success: true,
      message: `Successfully seeded ${count || accountsToInsert.length} accounts`,
      count: count || accountsToInsert.length
    };
  } catch (error) {
    return {
      success: false,
      message: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      count: 0
    };
  }
}
