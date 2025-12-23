import { useEffect, useState } from 'react';
import { Database, AlertCircle } from 'lucide-react';
import { Layout } from './components/layout/Layout';
import { Dashboard } from './components/Dashboard';
import { Boeken } from './components/Boeken';
import { MemorialOverview } from './components/MemorialOverview';
import { Bankboekingen } from './components/Bankboekingen';
import { FactuurInbox } from './components/FactuurInbox';
import { Bank } from './components/Bank';
import { Reports } from './components/Reports';
import { Settings } from './components/Settings';
import { OutstandingItems } from './components/OutstandingItems';
import { AccountDetail } from './components/AccountDetail';
import { Relations } from './components/Relations';
import { TaxPreparation } from './components/TaxPreparation';
import { IBAangifte } from './components/IBAangifte';
import { SalesInvoices } from './components/SalesInvoices';
import { TimeTracking } from './components/TimeTracking';
import { PortalLayout } from './components/portal/PortalLayout';
import { PortalDashboard } from './components/portal/PortalDashboard';
import { PortalBank } from './components/portal/PortalBank';
import { PortalCreateInvoice } from './components/portal/PortalCreateInvoice';
import { PortalAssistant } from './components/portal/PortalAssistant';
import { PortalExpense } from './components/portal/PortalExpense';
import { seedAccounts } from './lib/seedAccounts';
import { isSupabaseConfigured } from './lib/supabase';

type View = 'dashboard' | 'inbox' | 'boeken' | 'memoriaal-boekingen' | 'bankboekingen' | 'bank' | 'reports' | 'settings' | 'outstanding' | 'account-detail' | 'relations' | 'tax' | 'ib-aangifte' | 'sales' | 'time-tracking' | 'portal-home' | 'portal-scan' | 'portal-invoice' | 'portal-assistant' | 'portal-expense' | 'portal-time';

interface ViewState {
  view: View;
  data?: any;
}

function App() {
  const [viewState, setViewState] = useState<ViewState>({ view: 'dashboard' });
  const [fiscalYear, setFiscalYear] = useState(new Date().getFullYear() - 1);
  const [seeding, setSeeding] = useState(true);
  const [seedStatus, setSeedStatus] = useState<{
    success: boolean;
    message: string;
    count: number;
  } | null>(null);

  function navigate(view: View, data?: any) {
    setViewState({ view, data });
  }

  function handleFiscalYearChange(year: number) {
    setFiscalYear(year);
  }

  useEffect(() => {
    initializeApp();
  }, []);

  async function initializeApp() {
    try {
      console.log('App: Starting initialization...');
      const result = await seedAccounts();
      console.log('App: Seed result:', result);
      setSeedStatus(result);
      setSeeding(false);
      console.log('App: Initialization complete');
    } catch (error) {
      console.error('App: Initialization error:', error);
      setSeedStatus({ success: false, message: 'Failed to initialize', count: 0 });
      setSeeding(false);
    }
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100 flex items-center justify-center p-4">
        <div className="max-w-2xl bg-white rounded-lg shadow-xl p-8">
          <div className="flex items-start gap-4">
            <AlertCircle className="w-12 h-12 text-red-600 flex-shrink-0" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Database Configuratie Ontbreekt</h1>
              <p className="text-gray-700 mb-4">
                De Supabase database is niet correct geconfigureerd. De applicatie kan niet starten zonder database verbinding.
              </p>
              <div className="bg-gray-50 border border-gray-200 rounded p-4 mb-4">
                <p className="text-sm font-semibold text-gray-900 mb-2">Vereiste environment variabelen:</p>
                <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
                  <li><code className="bg-gray-200 px-1 rounded">VITE_SUPABASE_URL</code></li>
                  <li><code className="bg-gray-200 px-1 rounded">VITE_SUPABASE_ANON_KEY</code></li>
                </ul>
              </div>
              <p className="text-sm text-gray-600">
                Controleer je <code className="bg-gray-100 px-1 rounded">.env</code> bestand en herstart de development server.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (seeding) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <Database className="w-16 h-16 text-blue-600 mx-auto mb-4 animate-pulse" />
          <p className="text-gray-700 text-lg">Initializing database...</p>
        </div>
      </div>
    );
  }

  function renderView() {
    try {
      switch (viewState.view) {
        case 'dashboard':
          return <Dashboard onNavigate={navigate} />;
        case 'inbox':
          return <FactuurInbox />;
        case 'sales':
          return <SalesInvoices />;
        case 'time-tracking':
          return <TimeTracking />;
        case 'boeken':
          return <Boeken />;
        case 'memoriaal-boekingen':
          return <MemorialOverview />;
        case 'bankboekingen':
          return <Bankboekingen />;
        case 'bank':
          return <Bank />;
        case 'reports':
          return <Reports onNavigate={navigate} fiscalYear={fiscalYear} returnToTab={viewState.data?.returnToTab} />;
        case 'tax':
          return <TaxPreparation />;
        case 'ib-aangifte':
          return <IBAangifte />;
        case 'settings':
          return <Settings initialTab={viewState.data?.tab} />;
        case 'outstanding':
          return <OutstandingItems onBack={() => navigate('dashboard')} />;
        case 'relations':
          return <Relations />;
        case 'account-detail':
          if (viewState.data) {
            return (
              <AccountDetail
                accountId={viewState.data.accountId}
                startDate={viewState.data.startDate}
                endDate={viewState.data.endDate}
                onBack={() => navigate('reports', { returnToTab: viewState.data.returnTab })}
              />
            );
          }
          return <div>No data available</div>;
        case 'portal-home':
          return <PortalDashboard />;
        case 'portal-expense':
          return <PortalExpense />;
        case 'portal-scan':
          return <PortalBank />;
        case 'portal-invoice':
          return <PortalCreateInvoice />;
        case 'portal-time':
          return <TimeTracking />;
        case 'portal-assistant':
          return <PortalAssistant />;
        default:
          return <Dashboard onNavigate={navigate} />;
      }
    } catch (error) {
      console.error('Error rendering view:', error);
      return (
        <div className="p-8 bg-red-50 border border-red-200 rounded-lg">
          <h2 className="text-xl font-bold text-red-900 mb-2">View Render Error</h2>
          <p className="text-red-700 mb-4">
            {error instanceof Error ? error.message : 'Unknown error'}
          </p>
          <button
            onClick={() => navigate('dashboard')}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Terug naar Dashboard
          </button>
        </div>
      );
    }
  }

  const isPortalView = viewState.view.startsWith('portal-');

  if (isPortalView) {
    return (
      <PortalLayout currentView={viewState.view} onNavigate={navigate}>
        {renderView()}
      </PortalLayout>
    );
  }

  return (
    <Layout
      currentView={viewState.view}
      onNavigate={navigate}
      fiscalYear={fiscalYear}
      onFiscalYearChange={handleFiscalYearChange}
    >
      {renderView()}
    </Layout>
  );
}

export default App;
