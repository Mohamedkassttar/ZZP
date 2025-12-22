import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from './supabase';
import type { Database } from './database.types';

type Company = Database['public']['Tables']['companies']['Row'];
type CompanyUser = Database['public']['Tables']['company_users']['Row'];

interface CompanyContextType {
  currentCompany: Company | null;
  companies: Company[];
  userRole: string | null;
  loading: boolean;
  switchCompany: (companyId: string) => void;
  refreshCompanies: () => Promise<void>;
  isExpert: boolean;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [currentCompany, setCurrentCompany] = useState<Company | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadCompanies() {
    try {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      await supabase.rpc('ensure_user_has_company');

      const { data: companyUsers, error: cuError } = await supabase
        .from('company_users')
        .select('company_id, role, companies!inner(*)')
        .eq('user_id', user.id);

      if (cuError) {
        console.error('Error loading company users:', cuError);
        setLoading(false);
        return;
      }

      if (!companyUsers || companyUsers.length === 0) {
        const { data: demoCompany } = await supabase
          .from('companies')
          .select('*')
          .eq('name', 'Demo Bedrijf')
          .maybeSingle();

        if (demoCompany) {
          const { error: insertError } = await supabase
            .from('company_users')
            .insert({
              company_id: demoCompany.id,
              user_id: user.id,
              role: 'expert',
            });

          if (!insertError) {
            setCompanies([demoCompany]);
            setCurrentCompany(demoCompany);
            setUserRole('expert');
            localStorage.setItem('currentCompanyId', demoCompany.id);
          }
        }

        setLoading(false);
        return;
      }

      const companiesData = companyUsers.map((cu: any) => cu.companies);
      setCompanies(companiesData);

      const storedCompanyId = localStorage.getItem('currentCompanyId');
      let selectedCompany = companiesData[0];

      if (storedCompanyId) {
        const found = companiesData.find((c: Company) => c.id === storedCompanyId);
        if (found) {
          selectedCompany = found;
        }
      }

      setCurrentCompany(selectedCompany);

      const userCompany = companyUsers.find((cu: any) => cu.company_id === selectedCompany.id);
      setUserRole(userCompany?.role || null);

      setLoading(false);
    } catch (error) {
      console.error('Error loading companies:', error);
      setLoading(false);
    }
  }

  function switchCompany(companyId: string) {
    const company = companies.find((c) => c.id === companyId);
    if (company) {
      setCurrentCompany(company);
      localStorage.setItem('currentCompanyId', companyId);

      const userCompany = companies.find((c) => c.id === companyId);
      if (userCompany) {
        supabase
          .from('company_users')
          .select('role')
          .eq('company_id', companyId)
          .eq('user_id', (async () => {
            const { data: { user } } = await supabase.auth.getUser();
            return user?.id;
          })())
          .single()
          .then(({ data }) => {
            if (data) {
              setUserRole(data.role);
            }
          });
      }

      window.location.reload();
    }
  }

  async function refreshCompanies() {
    await loadCompanies();
  }

  useEffect(() => {
    loadCompanies();
  }, []);

  const isExpert = userRole === 'expert';

  return (
    <CompanyContext.Provider
      value={{
        currentCompany,
        companies,
        userRole,
        loading,
        switchCompany,
        refreshCompanies,
        isExpert,
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const context = useContext(CompanyContext);
  if (context === undefined) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return context;
}
