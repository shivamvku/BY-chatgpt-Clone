import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, setCsrf, ApiError } from '../../shared/api';
import type { AuthState, User } from '../../shared/types';
import { useAppearance } from '../../theme/AppearanceProvider';
import { getSessionWebSocket, disconnectSessionWebSocket } from '../../shared/websocket';

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
  
  // Initial session check - only called once on app start
  const initialRefresh = useCallback(async () => {
    setError('');
    try {
      accept(await api<AuthState>('/auth/session'));
    } catch (failure) {
      if ((failure as ApiError).status !== 401) {
        setError((failure as Error).message);
      }
      // On 401, user is not logged in - that's fine
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [accept]);

  useEffect(() => {
    void initialRefresh();
    
    // Set up WebSocket for real-time session management
    const ws = getSessionWebSocket();
    
    const handleSessionExpired = () => {
      console.log('Session expired via WebSocket');
      setUser(null);
      queries.clear();
    };
    
    const handleSessionValid = (data: unknown) => {
      console.log('Session validated via WebSocket');
      // Update user data from WebSocket
      const sessionData = data as { user: User };
      setUser(sessionData.user);
    };
    
    const handleLogout = () => {
      console.log('Logout notification via WebSocket');
      setUser(null);
      queries.clear();
    };
    
    // Register WebSocket event handlers
    ws.on('session_expired', handleSessionExpired);
    ws.on('session_valid', handleSessionValid);
    ws.on('logout', handleLogout);
    
    // Clean up WebSocket handlers on unmount
    return () => {
      ws.off('session_expired', handleSessionExpired);
      ws.off('session_valid', handleSessionValid);
      ws.off('logout', handleLogout);
    };
  }, [queries, initialRefresh]);
  async function authenticate(path: string, data: unknown) {
    accept(await api<AuthState>(`/auth/${path}`, 'POST', data));
    queries.clear();
    
    // After successful login, the WebSocket will automatically connect
    // and start managing the session
  }
  
  async function logout(all = false) {
    await api(all ? '/auth/sessions' : '/auth/logout', all ? 'DELETE' : 'POST');
    setUser(null);
    queries.clear();
    
    // Disconnect WebSocket on logout
    disconnectSessionWebSocket();
    
    // No need to refresh - user is logged out
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
        refresh: () => {
          // Manual refresh via WebSocket session check
          const ws = getSessionWebSocket();
          ws.checkSession();
          return Promise.resolve();
        },
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
