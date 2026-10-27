"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ApiError, setUnauthorizedHandler } from "./api";
import { authApi } from "./endpoints";
import type { Role, User } from "./types";

interface AuthState {
  user: User | null;
  /** True until the first check of the existing session has finished. */
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (data: { name: string; email: string; password: string; website: string }) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

/** Where each role lands after signing in. */
export function homeFor(role: Role): string {
  if (role === "manager") return "/manager";
  if (role === "agent") return "/agent";
  return "/tickets";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    authApi
      .me()
      .then((me) => !cancelled && setUser(me))
      .catch((error) => {
        // 401 just means "not signed in"; anything else is surfaced by the page that fails.
        if (!(error instanceof ApiError) || error.status !== 401) console.error(error);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  // A 401 from any later request means the session expired: send the person to sign in.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      router.replace("/login");
    });
    return () => setUnauthorizedHandler(null);
  }, [router]);

  const login = useCallback(async (email: string, password: string) => {
    const result = await authApi.login(email, password);
    setUser(result.user);
    return result.user;
  }, []);

  const register = useCallback(
    async (data: { name: string; email: string; password: string; website: string }) => {
      const result = await authApi.register(data);
      setUser(result.user);
      return result.user;
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
      router.replace("/login");
    }
  }, [router]);

  const value = useMemo(
    () => ({ user, loading, login, register, logout }),
    [user, loading, login, register, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}
