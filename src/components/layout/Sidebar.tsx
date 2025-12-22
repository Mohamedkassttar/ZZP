import { useState } from 'react';
import {
  Home,
  BookOpen,
  FileText,
  Users,
  BarChart3,
  Calculator,
  Settings,
  ChevronDown,
  ChevronRight,
  Smartphone,
  Building2,
} from 'lucide-react';
import { CompanySwitcher } from '../CompanySwitcher';
import { useCompany } from '../../lib/CompanyContext';

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string, data?: any) => void;
}

export function Sidebar({ currentView, onNavigate }: SidebarProps) {
  const { hasAdminAccess } = useCompany();
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({
    boekhouding: true,
    facturatie: false,
    rapportage: false,
    fiscaal: false,
  });

  const toggleMenu = (menuKey: string) => {
    setExpandedMenus((prev) => ({
      ...prev,
      [menuKey]: !prev[menuKey],
    }));
  };

  const isActive = (view: string) => currentView === view;

  const menuItems = [
    ...(hasAdminAccess ? [{
      id: 'office',
      label: 'Mijn Kantoor',
      icon: Building2,
      view: 'office',
    }] : []),
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: Home,
      view: 'dashboard',
    },
    {
      id: 'boekhouding',
      label: 'Boekhouding',
      icon: BookOpen,
      children: [
        { id: 'boeken', label: 'Boeken', view: 'boeken' },
        { id: 'memoriaal-boekingen', label: 'Memoriaal boekingen', view: 'memoriaal-boekingen' },
        { id: 'bank', label: 'Bankverwerking', view: 'bank' },
        { id: 'bankboekingen', label: 'Bankboekingen', view: 'bankboekingen' },
      ],
    },
    {
      id: 'facturatie',
      label: 'Facturatie',
      icon: FileText,
      children: [
        { id: 'sales', label: 'Verkoop', view: 'sales' },
        { id: 'inbox', label: 'Inkoop', view: 'inbox' },
      ],
    },
    {
      id: 'relaties',
      label: 'Relaties',
      icon: Users,
      view: 'relations',
    },
    {
      id: 'rapportage',
      label: 'Rapportage',
      icon: BarChart3,
      children: [
        { id: 'reports', label: 'Balans & W&V', view: 'reports' },
        { id: 'outstanding', label: 'Open Posten', view: 'outstanding' },
      ],
    },
    {
      id: 'fiscaal',
      label: 'Fiscaal',
      icon: Calculator,
      children: [
        { id: 'ib-aangifte', label: 'IB Aangifte', view: 'ib-aangifte' },
        { id: 'tax', label: 'Belasting Wizard', view: 'tax' },
      ],
    },
    {
      id: 'beheer',
      label: 'Beheer',
      icon: Settings,
      view: 'settings',
    },
  ];

  return (
    <aside className="w-64 flex flex-col h-full flex-shrink-0 lg:p-4">
      <div className="bg-white/80 backdrop-blur-2xl h-full flex flex-col rounded-3xl shadow-2xl shadow-slate-200/50 lg:my-3 overflow-hidden">
        <div className="h-20 px-5 flex items-center flex-shrink-0 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-300/40">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="font-black text-base block text-slate-800">Smart Accounting</span>
              <span className="text-xs font-semibold text-blue-600">ZZP Edition</span>
            </div>
          </div>
        </div>

        <CompanySwitcher />

        <nav className="flex-1 overflow-y-auto py-4 px-3">
          {menuItems.map((item) => (
            <div key={item.id} className="mb-2">
              {item.children ? (
                <div>
                  <button
                    onClick={() => toggleMenu(item.id)}
                    className="w-full h-12 flex items-center gap-3 px-4 rounded-2xl hover:bg-blue-50 transition-all text-slate-700 min-h-[44px]"
                  >
                    <item.icon className="w-5 h-5 flex-shrink-0" />
                    <span className="flex-1 text-left text-sm font-bold">{item.label}</span>
                    {expandedMenus[item.id] ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </button>
                  {expandedMenus[item.id] && (
                    <div className="mt-2 space-y-1 ml-2">
                      {item.children.map((child) => (
                        <button
                          key={child.id}
                          onClick={() => onNavigate(child.view)}
                          className={`w-full h-11 flex items-center px-5 text-sm rounded-full transition-all min-h-[44px] ${
                            isActive(child.view)
                              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold shadow-xl shadow-blue-300/50'
                              : 'text-slate-600 hover:bg-blue-50 font-medium'
                          }`}
                        >
                          {child.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => onNavigate(item.view!)}
                  className={`w-full h-12 flex items-center gap-3 px-4 rounded-full transition-all min-h-[44px] ${
                    isActive(item.view!)
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold shadow-xl shadow-blue-300/50'
                      : 'text-slate-700 hover:bg-blue-50 font-medium'
                  }`}
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm font-bold">{item.label}</span>
                </button>
              )}
            </div>
          ))}
        </nav>

        <div className="p-3 flex-shrink-0 space-y-3">
          <button
            onClick={() => onNavigate('portal-home')}
            className="w-full h-12 flex items-center gap-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-600 hover:to-teal-700 transition-all shadow-lg shadow-emerald-200/50 min-h-[44px]"
          >
            <Smartphone className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm font-bold">Naar Client Portal</span>
          </button>

          <div className="bg-gradient-to-r from-slate-50 to-blue-50 rounded-2xl p-4">
            <div className="bg-white/80 backdrop-blur-sm rounded-xl p-3 shadow-lg shadow-slate-100/50">
              <p className="text-xs font-bold text-blue-600 mb-1">Version</p>
              <p className="text-sm font-black text-slate-800">2.0 - ZZP</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
