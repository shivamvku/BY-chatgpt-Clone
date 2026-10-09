import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './app/App';
import { AppearanceProvider } from './theme/AppearanceProvider';
import { AuthProvider } from './features/auth/AuthProvider';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 15000, retry: 1, refetchOnWindowFocus: false } },
});
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AppearanceProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </AppearanceProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
