"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, isAdminOrAbove } from "@/lib/AuthContext";
export default () => {
  const { user, logout } = useAuth();
  const router = useRouter();
  const isAdmin = isAdminOrAbove(user);
  const [menuOpen, setMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  const handleLogout = () => {
    logout();
    router.push("/authenticate");
  };

  const navLinkClass =
    "text-label-secondary hover:text-label text-xs sm:text-sm font-medium px-3 py-1.5 rounded-full hover:bg-fill transition-colors";

  const menuItemClass =
    "block w-full text-left px-4 py-2.5 text-sm font-medium text-label hover:text-label hover:bg-fill rounded-lg transition-colors";

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
            <>
              <span className="hidden lg:inline-flex items-center gap-1.5 text-xs font-medium text-label-secondary select-none shrink-0 px-2">
                <span className="w-6 h-6 rounded-full bg-accent/15 text-accent flex items-center justify-center text-[11px] font-semibold">
                  {user.username.charAt(0).toUpperCase()}
                </span>
                {user.username}
              </span>
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 text-destructive hover:text-destructive-hover text-xs sm:text-sm font-semibold px-3.5 py-1.5 rounded-full transition-colors shrink-0 ml-1 hover:bg-destructive/10"
              >
                <svg
                  className="w-3.5 h-3.5"
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
                Logout
              </button>
            </>
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
            <div className="mt-2 border-t border-hairline pt-2 px-2 flex flex-col gap-2">
              <span className="text-xs text-label-tertiary select-none px-2">
                Signed in as {user.username}
              </span>
              <button
                onClick={handleLogout}
                className="inline-flex items-center justify-center gap-1.5 text-destructive hover:text-destructive-hover text-sm font-semibold px-4 py-2 rounded-lg hover:bg-destructive/10 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Logout
              </button>
            </div>
          )}
        </nav>
      )}
    </header>
  );
};
