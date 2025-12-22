import { supabase } from './supabase';
import type { Database } from './database.types';

type Company = Database['public']['Tables']['companies']['Row'];
type CompanyInsert = Database['public']['Tables']['companies']['Insert'];
type CompanyUser = Database['public']['Tables']['company_users']['Row'];

export interface CreateCompanyInput {
  name: string;
  address?: string;
  zip_code?: string;
  city?: string;
  vat_number?: string;
  coc_number?: string;
  legal_form?: 'eenmanszaak' | 'bv' | 'vof' | 'stichting' | 'maatschap' | 'cv' | 'andere';
  fiscal_year_start?: string;
}

export interface CreateUserInput {
  email: string;
  role: 'expert' | 'client' | 'viewer';
  companyId: string;
}

export async function createCompany(input: CreateCompanyInput): Promise<{ success: boolean; company?: Company; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const { data: company, error: companyError } = await supabase
      .from('companies')
      .insert({
        name: input.name,
        address: input.address,
        zip_code: input.zip_code,
        city: input.city,
        vat_number: input.vat_number,
        coc_number: input.coc_number,
        legal_form: input.legal_form,
        fiscal_year_start: input.fiscal_year_start,
        is_active: true,
        created_by: user.id,
      })
      .select()
      .single();

    if (companyError) {
      return { success: false, error: companyError.message };
    }

    await seedCompanyAccounts(company.id);

    return { success: true, company };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function updateCompany(companyId: string, updates: Partial<CreateCompanyInput>): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('companies')
      .update(updates)
      .eq('id', companyId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function deleteCompany(companyId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('companies')
      .delete()
      .eq('id', companyId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function addUserToCompany(companyId: string, userId: string, role: 'expert' | 'client' | 'viewer'): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('company_users')
      .insert({
        company_id: companyId,
        user_id: userId,
        role,
      });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function removeUserFromCompany(companyId: string, userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('company_users')
      .delete()
      .eq('company_id', companyId)
      .eq('user_id', userId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function updateUserRole(companyId: string, userId: string, role: 'expert' | 'client' | 'viewer'): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('company_users')
      .update({ role })
      .eq('company_id', companyId)
      .eq('user_id', userId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function getCompanyUsers(companyId: string): Promise<{ success: boolean; users?: CompanyUser[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('company_users')
      .select('*')
      .eq('company_id', companyId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, users: data };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function seedCompanyAccounts(companyId: string): Promise<void> {
  const { dutchChartOfAccounts } = await import('../data/dutchChartOfAccounts');

  const accountsToInsert = dutchChartOfAccounts.map((acc) => ({
    company_id: companyId,
    code: acc.code,
    name: acc.name,
    type: acc.type,
    tax_category: acc.tax_category,
    rgs_code: acc.rgs_code,
    is_active: true,
  }));

  const { error } = await supabase.from('accounts').insert(accountsToInsert);

  if (error) {
    console.error('Failed to seed company accounts:', error);
    throw new Error(`Failed to seed accounts: ${error.message}`);
  }

  console.log(`✓ Seeded ${accountsToInsert.length} accounts for company ${companyId}`);
}
