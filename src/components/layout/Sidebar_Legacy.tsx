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
} from 'lucide-react';

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string, data?: any) => void;
}

export function Sidebar({ currentView, onNavigate }: SidebarProps) {
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
    <aside className="bg-slate-900 text-white w-64 flex flex-col border-r border-slate-800 h-full flex-shrink-0">
      <div className="h-14 px-4 flex items-center border-b border-slate-800 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-sm">Smart Accounting</span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        {menuItems.map((item) => (
          <div key={item.id}>
            {item.children ? (
              <div>
                <button
                  onClick={() => toggleMenu(item.id)}
                  className="w-full h-10 flex items-center gap-2 px-4 hover:bg-slate-800 transition-colors text-slate-300"
                >
                  <item.icon className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1 text-left text-sm font-medium">{item.label}</span>
                  {expandedMenus[item.id] ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </button>
                {expandedMenus[item.id] && (
                  <div className="bg-slate-950/50">
                    {item.children.map((child) => (
                      <button
                        key={child.id}
                        onClick={() => onNavigate(child.view)}
                        className={`w-full h-10 flex items-center px-12 text-sm hover:bg-slate-800 transition-colors ${
                          isActive(child.view)
                            ? 'bg-blue-600/20 text-blue-400 border-r-2 border-blue-500'
                            : 'text-slate-400'
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
                className={`w-full h-10 flex items-center gap-2 px-4 hover:bg-slate-800 transition-colors ${
                  isActive(item.view!)
                    ? 'bg-blue-600/20 text-blue-400 border-r-2 border-blue-500'
                    : 'text-slate-300'
                }`}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm font-medium">{item.label}</span>
              </button>
            )}
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-800 flex-shrink-0">
        <p className="text-xs text-slate-500">v2.0 - ZZP</p>
      </div>
    </aside>
  );
}
