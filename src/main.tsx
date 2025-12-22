import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import { CompanyProvider } from './lib/CompanyContext';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <CompanyProvider>
        <App />
      </CompanyProvider>
    </ErrorBoundary>
  </StrictMode>
);
