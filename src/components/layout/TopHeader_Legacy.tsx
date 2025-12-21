import { useState } from 'react';
import { Search, Plus, Bell, User, ChevronDown } from 'lucide-react';

interface TopHeaderProps {
  onNavigate: (view: string, data?: any) => void;
  fiscalYear: number;
  onFiscalYearChange: (year: number) => void;
}

export function TopHeader({ onNavigate, fiscalYear, onFiscalYearChange }: TopHeaderProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  return (
    <header className="bg-white border-b border-slate-200 h-14 flex items-center px-4 flex-shrink-0">
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-3 flex-1">
          <select
            value={fiscalYear}
            onChange={(e) => onFiscalYearChange(Number(e.target.value))}
            className="px-2 py-1 border border-slate-300 rounded text-xs font-medium text-slate-900 hover:border-blue-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-200 transition-colors bg-white"
          >
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>

          <div className="flex-1 max-w-md relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Zoek relaties, facturen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded text-xs placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-200"
            />
          </div>

          <div className="relative">
            <button
              onClick={() => setShowQuickAdd(!showQuickAdd)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Nieuw
              <ChevronDown className="w-3 h-3" />
            </button>

            {showQuickAdd && (
              <div className="absolute left-0 mt-1 w-48 bg-white rounded shadow-lg border border-slate-200 py-1 z-50">
                <button
                  onClick={() => {
                    onNavigate('memoriaal');
                    setShowQuickAdd(false);
                  }}
                  className="w-full px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50"
                >
                  Boeking
                </button>
                <button
                  onClick={() => {
                    onNavigate('inbox');
                    setShowQuickAdd(false);
                  }}
                  className="w-full px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50"
                >
                  Inkoopfactuur
                </button>
                <button
                  onClick={() => {
                    onNavigate('relations');
                    setShowQuickAdd(false);
                  }}
                  className="w-full px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50"
                >
                  Relatie
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button className="relative p-1.5 hover:bg-slate-100 rounded transition-colors">
            <Bell className="w-4 h-4 text-slate-600" />
            <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-red-500 rounded-full"></span>
          </button>

          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-1.5 p-1 hover:bg-slate-100 rounded transition-colors"
            >
              <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                <User className="w-3.5 h-3.5 text-white" />
              </div>
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-1 w-40 bg-white rounded shadow-lg border border-slate-200 py-1 z-50">
                <button
                  onClick={() => {
                    onNavigate('settings');
                    setShowUserMenu(false);
                  }}
                  className="w-full px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50"
                >
                  Instellingen
                </button>
                <div className="border-t border-slate-200 my-1"></div>
                <button className="w-full px-3 py-1.5 text-left text-xs text-red-600 hover:bg-red-50">
                  Uitloggen
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
