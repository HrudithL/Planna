import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from "react";
import { User } from "@/types";
import { authApi } from "@/lib/api";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("planna_user");
    if (stored) {
      try { setUser(JSON.parse(stored)); } catch {}
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    setUser(res.user);
    localStorage.setItem("planna_token", res.token);
    localStorage.setItem("planna_user", JSON.stringify(res.user));
  }, []);

  const signup = useCallback(async (email: string, password: string, name: string) => {
    const res = await authApi.signup(email, password, name);
    setUser(res.user);
    localStorage.setItem("planna_token", res.token);
    localStorage.setItem("planna_user", JSON.stringify(res.user));
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem("planna_token");
    localStorage.removeItem("planna_user");
  }, []);

  return (
    <AuthContext.Provider value={{
      user, isLoading, login, signup, logout,
      isAuthenticated: !!user,
      isAdmin: user?.is_admin ?? false,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
