"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface AuthContextType {
  authenticated: boolean;
  login: (username: string, password: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  authenticated: false,
  login: () => false,
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate auth state from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("authenticated");
    if (stored === "true") {
      setAuthenticated(true);
    }
    setHydrated(true);
  }, []);

  const login = (username: string, password: string): boolean => {
    if (username === "admin" && password === "password") {
      setAuthenticated(true);
      localStorage.setItem("authenticated", "true");
      return true;
    }
    return false;
  };

  const logout = () => {
    setAuthenticated(false);
    localStorage.removeItem("authenticated");
  };

  return (
    <AuthContext.Provider value={{ authenticated, login, logout }}>
      {/* Don't render children until hydration is complete to avoid flash of wrong content */}
      {hydrated ? children : null}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
