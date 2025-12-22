import { supabase } from './supabase';

export async function getCurrentCompanyId(): Promise<string | null> {
  try {
    const storedCompanyId = localStorage.getItem('currentCompanyId');
    if (storedCompanyId) {
      return storedCompanyId;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return null;
    }

    const { data: companyUsers } = await supabase
      .from('company_users')
      .select('company_id')
      .eq('user_id', user.id)
      .limit(1);

    if (companyUsers && companyUsers.length > 0) {
      const companyId = companyUsers[0].company_id;
      localStorage.setItem('currentCompanyId', companyId);
      return companyId;
    }

    const { data: demoCompany } = await supabase
      .from('companies')
      .select('id')
      .eq('name', 'Demo Bedrijf')
      .single();

    if (demoCompany) {
      await supabase
        .from('company_users')
        .insert({
          company_id: demoCompany.id,
          user_id: user.id,
          role: 'expert',
        });

      localStorage.setItem('currentCompanyId', demoCompany.id);
      return demoCompany.id;
    }

    return null;
  } catch (error) {
    console.error('Error getting current company ID:', error);
    return null;
  }
}

export function addCompanyIdToData<T extends Record<string, any>>(data: T, companyId: string | null): T & { company_id?: string } {
  if (!companyId) {
    return data;
  }
  return { ...data, company_id: companyId };
}

export function addCompanyIdToArray<T extends Record<string, any>>(dataArray: T[], companyId: string | null): Array<T & { company_id?: string }> {
  if (!companyId) {
    return dataArray;
  }
  return dataArray.map(data => ({ ...data, company_id: companyId }));
}
