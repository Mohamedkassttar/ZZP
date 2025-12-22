import { ReactNode } from 'react';
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
  return (
    <div className="h-screen bg-gray-50 flex overflow-hidden">
      <Sidebar currentView={currentView} onNavigate={onNavigate} />

      <div className="flex-1 flex flex-col min-w-0 h-full">
        <TopHeader
          onNavigate={onNavigate}
          fiscalYear={fiscalYear}
          onFiscalYearChange={onFiscalYearChange}
        />

        <main className="flex-1 overflow-y-auto bg-gray-50">
          <div className="p-6">
            {children}
          </div>
        </main>

        <footer className="bg-white border-t border-gray-200 py-2 flex-shrink-0">
          <div className="px-6">
            <p className="text-center text-xs text-gray-500">
              Double-Entry Bookkeeping - ZZP Edition
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
