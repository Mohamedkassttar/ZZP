import { ReactNode, useState } from 'react';
import { Sidebar } from './Sidebar';
import { TopHeader } from './TopHeader';

interface LayoutProps {
  children: ReactNode;
  currentView: string;
  onNavigate: (view: string, data?: any) => void;
  fiscalYear: number;
  onFiscalYearChange: (year: number) => void;
}

export function Layout({
  children,
  currentView,
  onNavigate,
  fiscalYear,
  onFiscalYearChange,
}: LayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-zinc-100 flex overflow-hidden relative">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.05),transparent_50%),radial-gradient(circle_at_70%_60%,rgba(99,102,241,0.04),transparent_50%)] pointer-events-none" />

      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-md z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <div
        className={`fixed lg:relative inset-y-0 left-0 z-50 lg:z-auto transform transition-transform duration-300 ease-in-out ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <Sidebar
          currentView={currentView}
          onNavigate={(view, data) => {
            onNavigate(view, data);
            setIsMobileMenuOpen(false);
          }}
        />
      </div>

      <div className="flex-1 flex flex-col min-w-0 h-full relative z-10">
        <TopHeader
          onNavigate={onNavigate}
          fiscalYear={fiscalYear}
          onFiscalYearChange={onFiscalYearChange}
          onMobileMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        />

        <main className="flex-1 overflow-y-auto">
          <div className="p-4 sm:p-6 lg:p-10">
            {children}
          </div>
        </main>

        <footer className="bg-white/40 backdrop-blur-xl py-4 flex-shrink-0">
          <div className="px-4 sm:px-6">
            <p className="text-center text-xs font-medium text-gray-600">
              Smart Accounting - Modern ZZP Edition
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
