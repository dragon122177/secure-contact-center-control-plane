import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { apiRequest } from '../lib/api.js';
import type { AuthUser, LoginResponse } from '../types.js';

const STORAGE_KEY = 'relayops.session';

type StoredSession = { token: string; user: AuthUser | null };
type AuthContextValue = StoredSession & {
  authenticated: boolean;
  login(email: string, password: string): Promise<void>;
  logout(): void;
};

function loadStoredSession(): StoredSession {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    if (value) return JSON.parse(value) as StoredSession;
  } catch {
    // A disabled storage API should not prevent the login page from loading.
  }
  return { token: '', user: null };
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<StoredSession>(loadStoredSession);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...session,
      authenticated: Boolean(session.token && session.user),
      async login(email: string, password: string) {
        const response = await apiRequest<LoginResponse>('/api/v1/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
        const next = { token: response.accessToken, user: response.user };
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        setSession(next);
      },
      logout() {
        window.localStorage.removeItem(STORAGE_KEY);
        setSession({ token: '', user: null });
      },
    }),
    [session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
