"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, isAdminOrAbove } from "@/lib/AuthContext";
import GenerateDailyReportButton from "./GenerateDailyReportButton";

export default () => {
  const { user, logout } = useAuth();
  const router = useRouter();
  const isAdmin = isAdminOrAbove(user);
  const [menuOpen, setMenuOpen] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);

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
    "text-slate-300 hover:text-white text-xs sm:text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors";

  const menuItemClass =
    "block w-full text-left px-4 py-2.5 text-sm font-medium text-slate-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors";

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-50 w-full bg-slate-900/95 backdrop-blur-md border-b border-white/10 shadow-lg shadow-slate-900/20"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-3.5 flex items-center justify-between gap-2">
        <a href="/" className="flex items-center gap-2.5 sm:gap-3 min-w-0 group">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl overflow-hidden shrink-0 ring-2 ring-teal-400/40 group-hover:ring-teal-400/70 transition-all">
            <img
              src="/ICON.jpeg"
              alt="Prefects Discipline"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="min-w-0">
            <h1 className="text-white text-lg sm:text-xl font-bold tracking-tight truncate leading-tight">
              Discipline
            </h1>
            <p className="hidden sm:block text-[11px] text-slate-400 font-medium tracking-wide">
              Prefects Dashboard
            </p>
          </div>
        </a>

        {/* Desktop navigation */}
        <nav className="hidden sm:flex items-center gap-1 sm:gap-2">
          {isAdmin && <GenerateDailyReportButton />}
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
              <span className="text-slate-500 text-xs hidden lg:block shrink-0 select-none px-2">
                {user.username}
              </span>
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 bg-rose-500/90 hover:bg-rose-500 text-white text-xs sm:text-sm font-medium px-3.5 sm:px-4 py-1.5 rounded-lg shadow-sm transition-colors shrink-0 ml-1"
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
          className="sm:hidden inline-flex items-center justify-center w-10 h-10 -mr-2 rounded-lg text-white hover:bg-white/10 active:bg-white/15 transition-colors"
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
          className="sm:hidden border-t border-white/10 px-3 pb-3 pt-1 animate-[menu-in_0.15s_ease-out] bg-slate-900/98"
          aria-label="Mobile navigation"
        >
          {isAdmin && (
            <div className="px-2 py-2">
              <GenerateDailyReportButton />
            </div>
          )}
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
            <div className="mt-2 border-t border-white/10 pt-2 px-2 flex flex-col gap-2">
              <span className="text-xs text-slate-500 select-none px-2">
                Signed in as {user.username}
              </span>
              <button
                onClick={handleLogout}
                className="inline-flex items-center justify-center gap-1.5 bg-rose-500/90 hover:bg-rose-500 text-white text-sm font-medium px-4 py-2 rounded-lg shadow-sm transition-colors"
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
