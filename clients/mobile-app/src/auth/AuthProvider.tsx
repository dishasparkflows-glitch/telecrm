import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { endpoints } from '@/api/endpoints';
import { setUnauthorizedHandler } from '@/api/client';
import { tokenStore } from './tokenStore';
import type { User } from '@/types/models';

type AuthValue = { user: User | null; loading: boolean; login(email: string, password: string): Promise<void>; logout(): Promise<void> };
const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const logout = useCallback(async () => { await tokenStore.clear(); setUser(null); }, []);
  useEffect(() => { tokenStore.getUser().then(setUser).finally(() => setLoading(false)); }, []);
  useEffect(() => { setUnauthorizedHandler(() => { setUser(null); }); }, []);
  const login = useCallback(async (email: string, password: string) => {
    const result = await endpoints.login(email.trim().toLowerCase(), password);
    await tokenStore.save(result.data); setUser(result.data.user);
  }, []);
  const value = useMemo(() => ({ user, loading, login, logout }), [user, loading, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export const useAuth = () => { const value = useContext(AuthContext); if (!value) throw new Error('useAuth must be inside AuthProvider'); return value; };
