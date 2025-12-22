import { useState } from 'react';
import { Search, Plus, Bell, User, ChevronDown, Menu } from 'lucide-react';

interface TopHeaderProps {
  onNavigate: (view: string, data?: any) => void;
  fiscalYear: number;
  onFiscalYearChange: (year: number) => void;
  onMobileMenuToggle: () => void;
}

export function TopHeader({
  onNavigate,
  fiscalYear,
  onFiscalYearChange,
  onMobileMenuToggle,
}: TopHeaderProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  return (
    <header className="bg-white/60 backdrop-blur-2xl h-20 flex items-center px-4 sm:px-8 flex-shrink-0 mx-4 sm:mx-6 lg:mx-8 mt-4 rounded-3xl shadow-xl shadow-slate-200/40">
      <div className="flex items-center justify-between w-full gap-4">
        <div className="flex items-center gap-4 flex-1">
          <button
            onClick={onMobileMenuToggle}
            className="lg:hidden p-3 hover:bg-blue-50 rounded-2xl transition-colors"
            aria-label="Toggle menu"
          >
            <Menu className="w-5 h-5 text-slate-700" />
          </button>

          <select
            value={fiscalYear}
            onChange={(e) => onFiscalYearChange(Number(e.target.value))}
            className="px-4 py-3 bg-white/80 backdrop-blur-sm rounded-full text-sm font-bold text-slate-800 hover:bg-white focus:bg-white transition-all shadow-lg shadow-slate-200/40 min-h-[44px] border-0"
          >
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>

          <div className="flex-1 max-w-lg relative hidden sm:block">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-400" />
            <input
              type="text"
              placeholder="Zoek relaties, facturen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-5 py-3.5 bg-white/80 backdrop-blur-sm rounded-full text-sm font-medium placeholder:text-slate-400 placeholder:font-normal focus:bg-white transition-all shadow-lg shadow-slate-200/40 border-0"
            />
          </div>

          <div className="relative">
            <button
              onClick={() => setShowQuickAdd(!showQuickAdd)}
              className="flex items-center gap-2.5 px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full text-sm font-bold hover:shadow-2xl hover:shadow-blue-300/50 transition-all shadow-xl shadow-blue-300/40 min-h-[44px]"
            >
              <Plus className="w-5 h-5" />
              <span className="hidden sm:inline">Nieuw</span>
              <ChevronDown className="w-4 h-4" />
            </button>

            {showQuickAdd && (
              <div className="absolute left-0 mt-3 w-56 bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl shadow-slate-200/50 py-3 z-50 border-0">
                <button
                  onClick={() => {
                    onNavigate('memoriaal');
                    setShowQuickAdd(false);
                  }}
                  className="w-full px-5 py-3 text-left text-sm font-bold text-slate-700 hover:bg-blue-50 transition-colors min-h-[44px] flex items-center rounded-2xl mx-2"
                >
                  Boeking
                </button>
                <button
                  onClick={() => {
                    onNavigate('inbox');
                    setShowQuickAdd(false);
                  }}
                  className="w-full px-5 py-3 text-left text-sm font-bold text-slate-700 hover:bg-blue-50 transition-colors min-h-[44px] flex items-center rounded-2xl mx-2"
                >
                  Inkoopfactuur
                </button>
                <button
                  onClick={() => {
                    onNavigate('relations');
                    setShowQuickAdd(false);
                  }}
                  className="w-full px-5 py-3 text-left text-sm font-bold text-slate-700 hover:bg-blue-50 transition-colors min-h-[44px] flex items-center rounded-2xl mx-2"
                >
                  Relatie
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button className="relative p-3 hover:bg-blue-50 rounded-full transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center">
            <Bell className="w-5 h-5 text-slate-700" />
            <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-gradient-to-br from-orange-500 to-red-500 rounded-full ring-2 ring-white shadow-lg"></span>
          </button>

          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 p-1.5 hover:bg-blue-50 rounded-full transition-colors min-h-[44px]"
            >
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-full flex items-center justify-center shadow-xl shadow-blue-300/50">
                <User className="w-5 h-5 text-white" />
              </div>
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-3 w-52 bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl shadow-slate-200/50 py-3 z-50 border-0">
                <button
                  onClick={() => {
                    onNavigate('settings');
                    setShowUserMenu(false);
                  }}
                  className="w-full px-5 py-3 text-left text-sm font-bold text-slate-700 hover:bg-blue-50 transition-colors min-h-[44px] flex items-center rounded-2xl mx-2"
                >
                  Instellingen
                </button>
                <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent my-2 mx-4"></div>
                <button className="w-full px-5 py-3 text-left text-sm font-bold text-red-600 hover:bg-red-50 transition-colors min-h-[44px] flex items-center rounded-2xl mx-2">
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
