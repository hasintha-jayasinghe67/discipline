"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { mapUsernameToEmail } from "@/lib/emailMap";

export interface UserInfo {
  /** auth.users.id (uuid) — the Supabase Auth account id */
  authId: string;
  /** users.id (BIGINT) — the app-level user row id */
  id: number;
  username: string;
  /** mapped auth email (username@prefects.local), used for re-auth checks */
  email: string;
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
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  authenticated: false,
  user: null,
  login: async () => false,
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Look up the app-level user (id/username/email/role) for an authenticated
  // Supabase Auth account. The role ALWAYS comes from the users table, so
  // stale or forged client-side state can never grant extra privileges.
  const resolveUser = async (authId: string): Promise<UserInfo | null> => {
    const { data } = await supabase
      .from("users")
      .select("id, username, email, role")
      .eq("auth_id", authId)
      .maybeSingle();
    if (data) {
      const resolved: UserInfo = {
        authId,
        id: data.id,
        username: data.username,
        email: data.email,
        role: data.role as Role,
      };
      setUser(resolved);
      setAuthenticated(true);
      return resolved;
    }
    // Authenticated with Supabase Auth but no users row (account deleted /
    // not yet migrated) — sign out rather than leave a half-authenticated app.
    await supabase.auth.signOut();
    setUser(null);
    setAuthenticated(false);
    return null;
  };

  useEffect(() => {
    // One-time cleanup of the legacy localStorage session key.
    try {
      localStorage.removeItem("user");
    } catch {
      // ignore
    }

    let active = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        void resolveUser(session.user.id);
      } else {
        setUser(null);
        setAuthenticated(false);
      }
    });

    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (active && session?.user) {
        await resolveUser(session.user.id);
      }
      if (active) setHydrated(true);
    })();

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    const email = mapUsernameToEmail(username);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error || !data.session) return false;
    // Wait for the users-row lookup so auth state is set before returning.
    await resolveUser(data.session.user.id);
    return true;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setAuthenticated(false);
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
