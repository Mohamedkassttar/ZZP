import { ReactNode } from 'react';
import { Home, ScanLine, FileText, MessageCircle, Settings, Receipt, Clock } from 'lucide-react';
import { PortalAssistant } from './PortalAssistant';

interface PortalLayoutProps {
  children: ReactNode;
  currentView: string;
  onNavigate: (view: string) => void;
}

const navItems = [
  { id: 'portal-home', label: 'Home', icon: Home },
  { id: 'portal-expense', label: 'Inkoop', icon: Receipt },
  { id: 'portal-invoice', label: 'Factureren', icon: FileText },
  { id: 'portal-time', label: 'Uren', icon: Clock },
  { id: 'portal-scan', label: 'Bank', icon: ScanLine },
];

export function PortalLayout({ children, currentView, onNavigate }: PortalLayoutProps) {
  return (
    <div className="flex h-screen w-full flex-col bg-gradient-to-br from-blue-50 via-white to-slate-50 overflow-hidden">
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

      <main className="flex-1 overflow-y-auto overflow-x-hidden relative z-10 min-h-0">
        <div className="px-4 py-6 pb-24 pr-4 md:pr-4">
          {children}
        </div>
      </main>

      <nav className="flex-none z-30 bg-white border-t border-gray-200 shadow-lg">
        <div className="flex items-center justify-around px-2 py-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`flex flex-col items-center justify-center min-w-[70px] py-2 px-3 rounded-xl transition-all ${
                  isActive
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Icon className={`w-6 h-6 mb-1 ${isActive ? 'stroke-[2.5]' : 'stroke-[2]'}`} />
                <span className={`text-xs font-medium ${isActive ? 'font-semibold' : ''}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      <PortalAssistant />
    </div>
  );
}
