"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, isAdminOrAbove } from "@/lib/AuthContext";
import { useTheme } from "@/lib/theme";

export default () => {
  const { user, logout } = useAuth();
  const router = useRouter();
  const isAdmin = isAdminOrAbove(user);
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    if (!menuOpen && !userMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setUserMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen, userMenuOpen]);

  const handleLogout = () => {
    logout();
    router.push("/authenticate");
  };

  const navLinkClass =
    "text-label-secondary hover:text-label text-xs sm:text-sm font-medium px-3 py-1.5 rounded-full hover:bg-fill transition-colors";

  const menuItemClass =
    "block w-full text-left px-4 py-2.5 text-sm font-medium text-label hover:text-label hover:bg-fill rounded-lg transition-colors";

  const sunIcon = (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
      />
    </svg>
  );

  const moonIcon = (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
      />
    </svg>
  );

  const logoutIcon = (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
      />
    </svg>
  );

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-50 border-b border-hairline bg-surface/70 backdrop-blur-xl backdrop-saturate-150"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-2">
        <a href="/" className="flex items-center gap-2.5 sm:gap-3 min-w-0 group">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-[22%] overflow-hidden shrink-0 shadow-sm ring-1 ring-black/5 group-hover:ring-accent/40 transition-all">
            <img
              src="/ICON.jpeg"
              alt="Prefects Discipline"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="min-w-0">
            <h1 className="text-label text-[17px] font-semibold tracking-tight truncate leading-tight">
              Discipline
            </h1>
            <p className="hidden sm:block text-[11px] text-label-tertiary font-medium tracking-wide">
              Prefects Dashboard
            </p>
          </div>
        </a>

        {/* Desktop navigation */}
        <nav className="hidden sm:flex items-center gap-0.5 sm:gap-1">
          {isAdmin && (
            <a href="/users" className={navLinkClass}>
              Users
            </a>
          )}
          {isAdmin && (
            <a href="/lists" className={navLinkClass}>
              Lists
            </a>
          )}
          <a href="/discipline" className={navLinkClass}>
            Records
          </a>
          <a href="/" className={navLinkClass}>
            Dashboard
          </a>
          {user && (
            <div className="relative ml-1 shrink-0">
              <button
                onClick={() => setUserMenuOpen((o) => !o)}
                aria-haspopup="menu"
                aria-expanded={userMenuOpen}
                aria-label={`Account menu for ${user.username}`}
                title={user.username}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-accent/15 text-accent flex items-center justify-center text-xs sm:text-sm font-semibold ring-1 ring-black/5 hover:ring-accent/40 transition-all select-none"
              >
                {user.username.charAt(0).toUpperCase()}
              </button>

              {userMenuOpen && (
                <div
                  role="menu"
                  aria-label="Account menu"
                  className="absolute right-0 top-full mt-2 w-60 rounded-xl border border-hairline bg-surface shadow-sheet overflow-hidden animate-[menu-in_0.15s_ease-out]"
                >
                  <div className="flex items-center gap-3 px-4 py-3 border-b border-hairline">
                    <span className="w-10 h-10 rounded-full bg-accent/15 text-accent flex items-center justify-center text-sm font-semibold shrink-0">
                      {user.username.charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-label truncate">
                        {user.username}
                      </p>
                      <p className="text-xs text-label-tertiary">Signed in</p>
                    </div>
                  </div>

                  <div className="p-1.5">
                    <button
                      role="menuitem"
                      onClick={toggleTheme}
                      className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm font-medium text-label hover:bg-fill rounded-lg transition-colors"
                    >
                      <span className="inline-flex items-center gap-2.5">
                        {theme === "dark" ? moonIcon : sunIcon}
                        Dark mode
                      </span>
                      <span
                        aria-hidden="true"
                        className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${
                          theme === "dark" ? "bg-accent" : "bg-fill"
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${
                            theme === "dark" ? "left-[18px]" : "left-0.5"
                          }`}
                        />
                      </span>
                    </button>

                    <button
                      role="menuitem"
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-semibold text-destructive hover:text-destructive-hover hover:bg-destructive/10 rounded-lg transition-colors"
                    >
                      {logoutIcon}
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </nav>

        {/* Mobile hamburger toggle */}
        <button
          onClick={() => setMenuOpen((o) => !o)}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          className="sm:hidden inline-flex items-center justify-center w-10 h-10 -mr-2 rounded-lg text-label hover:bg-fill transition-colors"
        >
          {menuOpen ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <nav
          id="mobile-menu"
          className="sm:hidden border-t border-hairline px-3 pb-3 pt-1 animate-[menu-in_0.15s_ease-out] bg-surface/95 backdrop-blur-xl"
          aria-label="Mobile navigation"
        >
          <div className="flex flex-col gap-0.5 pt-1">
            {isAdmin && (
              <a href="/users" onClick={() => setMenuOpen(false)} className={menuItemClass}>
                Users
              </a>
            )}
            {isAdmin && (
              <a href="/lists" onClick={() => setMenuOpen(false)} className={menuItemClass}>
                Lists
              </a>
            )}
            <a href="/discipline" onClick={() => setMenuOpen(false)} className={menuItemClass}>
              Records
            </a>
            <a href="/" onClick={() => setMenuOpen(false)} className={menuItemClass}>
              Dashboard
            </a>
          </div>
          {user && (
            <div className="mt-2 border-t border-hairline pt-2 px-2 flex flex-col gap-1">
              <span className="text-xs text-label-tertiary select-none px-2 pb-1">
                Signed in as {user.username}
              </span>
              <button
                onClick={toggleTheme}
                className="inline-flex items-center gap-2.5 text-label text-sm font-medium px-4 py-2 rounded-lg hover:bg-fill transition-colors"
              >
                {theme === "dark" ? moonIcon : sunIcon}
                {theme === "dark" ? "Dark mode" : "Light mode"}
              </button>
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-2.5 text-destructive hover:text-destructive-hover text-sm font-semibold px-4 py-2 rounded-lg hover:bg-destructive/10 transition-colors"
              >
                {logoutIcon}
                Logout
              </button>
            </div>
          )}
        </nav>
      )}
    </header>
  );
};
