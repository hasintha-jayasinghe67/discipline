"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/lib/supabase";

export interface UserInfo {
  id: number;
  username: string;
  role: "superuser" | "admin" | "view-only";
}

export type Role = UserInfo["role"];

// Admins AND superusers pass the old `role === "admin"` checks.
// Superusers additionally pass `role === "superuser"` (user management).
export const isAdminOrAbove = (user: UserInfo | null): boolean =>
  user?.role === "admin" || user?.role === "superuser";

export const isSuperuser = (user: UserInfo | null): boolean =>
  user?.role === "superuser";

interface AuthContextType {
  authenticated: boolean;
  user: UserInfo | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  authenticated: false,
  user: null,
  login: async () => false,
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate auth state from localStorage on mount, then re-verify the
  // user's role against the DB so role changes / the superuser migration
  // take effect without a manual re-login.
  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as UserInfo;
        setUser(parsed);
        setAuthenticated(true);
        // Re-verify: fetch the freshest role for this user id.
        (async () => {
          try {
            const { data } = await supabase
              .from("users")
              .select("username, role")
              .eq("id", parsed.id)
              .maybeSingle();
            if (data && data.username === parsed.username) {
              const fresh: UserInfo = {
                ...parsed,
                role: data.role as Role,
              };
              setUser(fresh);
              localStorage.setItem("user", JSON.stringify(fresh));
            } else {
              // Account was deleted or renamed — log out.
              setAuthenticated(false);
              setUser(null);
              localStorage.removeItem("user");
            }
          } catch {
            // Offline / query failed — keep the cached session as-is.
          }
        })();
      } catch {
        // Corrupted localStorage entry — ignore
      }
    }
    setHydrated(true);
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    // 1. Try Supabase users table
    const { data, error } = await supabase
      .from("users")
      .select("id, username, password, role")
      .eq("username", username)
      .maybeSingle();

    if (data && !error && data.username) {
      // Use bcryptjs (loaded asynchronously and cached)
      const bcryptjs = await import("bcryptjs");
      const match = bcryptjs.compareSync(password, data.password);
      if (match) {
        const loggedInUser: UserInfo = {
          id: data.id,
          username: data.username,
          role: data.role as Role,
        };
        setUser(loggedInUser);
        setAuthenticated(true);
        localStorage.setItem("user", JSON.stringify(loggedInUser));
        return true;
      }
      return false; // Password mismatch
    }

    return false;
  };

  const logout = () => {
    setAuthenticated(false);
    setUser(null);
    localStorage.removeItem("user");
  };

  return (
    <AuthContext.Provider value={{ authenticated, user, login, logout }}>
      {hydrated ? children : null}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}