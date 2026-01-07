import { ReactNode } from 'react';
import { Home, ScanLine, FileText, MessageCircle, Settings, Receipt, Clock, Wallet } from 'lucide-react';
import { PortalAssistant } from './PortalAssistant';

interface PortalLayoutProps {
  children: ReactNode;
  currentView: string;
  onNavigate: (view: string) => void;
}

const navItems = [
  { id: 'portal-home', label: 'Home', icon: Home },
  { id: 'portal-expense', label: 'Inkoop', icon: Receipt },
  { id: 'portal-finance', label: 'Financieel', icon: Wallet },
  { id: 'portal-invoice', label: 'Factureren', icon: FileText },
  { id: 'portal-time', label: 'Uren', icon: Clock },
  { id: 'portal-scan', label: 'Bank', icon: ScanLine },
];

export function PortalLayout({ children, currentView, onNavigate }: PortalLayoutProps) {
  return (
    <div className="flex min-h-[100dvh] w-full flex-col bg-gradient-to-br from-blue-50 via-white to-slate-50">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(59,130,246,0.06),transparent_60%)] pointer-events-none" />

      <header className="flex-none z-30 bg-white/80 backdrop-blur-xl border-b border-gray-200 shadow-sm relative">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Mijn Administratie</h1>
              <p className="text-xs text-gray-500 mt-0.5">Client Portal</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => onNavigate('dashboard')}
                className="w-10 h-10 bg-gradient-to-br from-slate-600 to-slate-700 rounded-full flex items-center justify-center text-white hover:from-slate-700 hover:to-slate-800 transition-all shadow-lg"
                title="Terug naar Admin"
              >
                <Settings className="w-5 h-5" />
              </button>
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold shadow-lg">
                ZZP
              </div>
            </div>
          </div>
        </div>
      </header>

      <nav className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
        <div className="overflow-x-auto scrollbar-hide">
          <div className="flex items-center justify-start md:justify-center gap-1 px-4 py-3 min-w-max md:min-w-0">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'stroke-[2.5]' : 'stroke-[2]'}`} />
                  <span className={`text-sm font-medium ${isActive ? 'font-semibold' : ''}`}>
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      <main className="flex-1 overflow-y-auto overflow-x-hidden relative z-10">
        <div className="px-4 py-6">
          {children}
        </div>
      </main>

      <PortalAssistant />
    </div>
  );
}
