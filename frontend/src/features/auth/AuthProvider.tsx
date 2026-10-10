import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, setCsrf } from '../../shared/api';
import type { AuthState, User } from '../../shared/types';
import { useAppearance } from '../../theme/AppearanceProvider';

interface AuthContext {
  user: User | null;
  loading: boolean;
  error: string;
  authenticate: (path: string, data: unknown) => Promise<void>;
  logout: (all?: boolean) => Promise<void>;
  updateUser: (user: User) => void;
  refresh: () => Promise<void>;
}
const Context = createContext<AuthContext | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  const queries = useQueryClient();
  const { setPreferences } = useAppearance();
  const accept = useCallback(
    (state: AuthState) => {
      setCsrf(state.csrf);
      setUser(state.user);
      if (!state.user) queries.clear();
      if (state.user)
        setPreferences({
          appearance: state.user.appearance,
          contrast: state.user.contrast,
        });
    },
    [queries, setPreferences],
  );
  const refresh = useCallback(async () => {
    setError('');
    try {
      accept(await api<AuthState>('/auth/session'));
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setLoading(false);
    }
  }, [accept]);
  useEffect(() => {
    void refresh();
    const expired = () => {
      setUser(null);
      queries.clear();
      void refresh();
    };
    window.addEventListener('session-expired', expired);
    return () => window.removeEventListener('session-expired', expired);
  }, [queries, refresh]);
  async function authenticate(path: string, data: unknown) {
    accept(await api<AuthState>(`/auth/${path}`, 'POST', data));
    queries.clear();
  }
  async function logout(all = false) {
    await api(all ? '/auth/sessions' : '/auth/logout', all ? 'DELETE' : 'POST');
    setUser(null);
    queries.clear();
    await refresh();
  }
  return (
    <Context.Provider
      value={{
        user,
        loading,
        error,
        authenticate,
        logout,
        updateUser: setUser,
        refresh,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useAuth() {
  const context = useContext(Context);
  if (!context) throw new Error('Auth provider is missing');
  return context;
}
