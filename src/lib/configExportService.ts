/**
 * Configuration Export Service
 *
 * Exports critical configuration data (Accounts, Bank Rules) for backup purposes.
 * This allows restoration/seeding of a fresh database with your customized setup.
 */

import { supabase } from './supabase';

interface ExportData {
  exportDate: string;
  version: string;
  accounts: any[];
  bankRules: any[];
}

/**
 * Export all configuration data to a JSON file
 *
 * Exports:
 * - All accounts (grootboekrekeningen) with all columns
 * - All bank rules for automated processing
 *
 * @returns JSON string ready for download
 */
export async function exportConfiguration(): Promise<string> {
  try {
    // Fetch all accounts
    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select('*')
      .order('code', { ascending: true });

    if (accountsError) {
      throw new Error(`Failed to fetch accounts: ${accountsError.message}`);
    }

    // Fetch all bank rules
    const { data: bankRules, error: bankRulesError } = await supabase
      .from('bank_rules')
      .select('*')
      .order('priority', { ascending: true });

    if (bankRulesError) {
      throw new Error(`Failed to fetch bank rules: ${bankRulesError.message}`);
    }

    const exportData: ExportData = {
      exportDate: new Date().toISOString(),
      version: '1.0',
      accounts: accounts || [],
      bankRules: bankRules || [],
    };

    return JSON.stringify(exportData, null, 2);
  } catch (error) {
    console.error('[CONFIG_EXPORT] Error exporting configuration:', error);
    throw error;
  }
}

/**
 * Download configuration as JSON file
 *
 * Triggers browser download of config-backup.json
 */
export async function downloadConfigurationBackup(): Promise<void> {
  try {
    const jsonData = await exportConfiguration();

    // Create blob and download link
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    // Create temporary download link
    const link = document.createElement('a');
    link.href = url;
    link.download = `config-backup-${new Date().toISOString().split('T')[0]}.json`;

    // Trigger download
    document.body.appendChild(link);
    link.click();

    // Cleanup
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    console.log('[CONFIG_EXPORT] Configuration backup downloaded successfully');
  } catch (error) {
    console.error('[CONFIG_EXPORT] Error downloading configuration:', error);
    throw error;
  }
}

/**
 * Get statistics about configuration data
 *
 * @returns Object with counts of exportable items
 */
export async function getConfigurationStats() {
  try {
    const [accountsResult, bankRulesResult] = await Promise.all([
      supabase.from('accounts').select('id', { count: 'exact', head: true }),
      supabase.from('bank_rules').select('id', { count: 'exact', head: true }),
    ]);

    return {
      accountsCount: accountsResult.count || 0,
      bankRulesCount: bankRulesResult.count || 0,
    };
  } catch (error) {
    console.error('[CONFIG_EXPORT] Error fetching configuration stats:', error);
    return {
      accountsCount: 0,
      bankRulesCount: 0,
    };
  }
}
