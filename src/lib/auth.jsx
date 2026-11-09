import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api';

const AuthContext = createContext(null);

const RETRIES = 4;
const wait = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const queryClient = useQueryClient();

  const [unreachable, setUnreachable] = useState(false);

  const loadUser = useCallback(async () => {
    setUnreachable(false);
    // Only a 401 means signed out. During a server restart the check fails
    // briefly, and that must not send a signed in person to the login page.
    for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
      try {
        const data = await api.get('/auth/me');
        setUser(data.user);
        setReady(true);
        return;
      } catch (error) {
        if (error.status === 401) {
          setUser(null);
          setReady(true);
          return;
        }
        if (attempt < RETRIES) await wait(1000 * (attempt + 1));
      }
    }
    setUnreachable(true);
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  useEffect(() => {
    const onExpired = () => {
      setUser(null);
      queryClient.clear();
    };
    window.addEventListener('session-expired', onExpired);
    return () => window.removeEventListener('session-expired', onExpired);
  }, [queryClient]);

  const signIn = useCallback(async (credentials) => {
    const data = await api.post('/auth/login', credentials);
    setUser(data.user);
    return data.user;
  }, []);

  const signOut = useCallback(async () => {
    await api.post('/auth/logout').catch(() => {});
    setUser(null);
    queryClient.clear();
  }, [queryClient]);

  const value = useMemo(
    () => ({ user, ready, unreachable, retry: loadUser, signIn, signOut, setUser }),
    [user, ready, unreachable, loadUser, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
