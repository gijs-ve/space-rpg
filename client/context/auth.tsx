'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import { connectSocket, disconnectSocket } from '@/lib/socket';
import { apiFetch } from '@/lib/api';

interface PlayerInfo {
  id: string;
  username: string;
  email: string;
}

interface AuthContextValue {
  token:    string | null;
  player:   PlayerInfo | null;
  isLoaded: boolean;
  login:    (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout:   () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = 'rpg_token';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token,    setToken]    = useState<string | null>(null);
  const [player,   setPlayer]   = useState<PlayerInfo | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Restore session from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as { token: string; player: PlayerInfo };
      setToken(parsed.token);
      setPlayer(parsed.player);
      connectSocket(parsed.token);
    }
    setIsLoaded(true);
  }, []);

  const persist = useCallback((tok: string, p: PlayerInfo) => {
    localStorage.setItem(TOKEN_KEY, JSON.stringify({ token: tok, player: p }));
    setToken(tok);
    setPlayer(p);
    connectSocket(tok);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiFetch<{ token: string; player: PlayerInfo }>('/auth/login', {
      method: 'POST',
      body:   JSON.stringify({ email, password }),
    });
    persist(data.token, data.player);
  }, [persist]);

  const register = useCallback(async (username: string, email: string, password: string) => {
    const data = await apiFetch<{ token: string; player: PlayerInfo }>('/auth/register', {
      method: 'POST',
      body:   JSON.stringify({ username, email, password }),
    });
    persist(data.token, data.player);
  }, [persist]);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setPlayer(null);
    disconnectSocket();
  }, []);

  const value = useMemo(
    () => ({ token, player, isLoaded, login, register, logout }),
    [token, player, isLoaded, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
