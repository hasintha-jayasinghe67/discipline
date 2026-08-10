"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import GenerateDailyReportButton from "./GenerateDailyReportButton";

export default () => {
  const { user, logout } = useAuth();
  const router = useRouter();
  const isAdmin = user?.role === "admin";
  const [menuOpen, setMenuOpen] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);

  // Close the mobile menu when tapping outside of the header or pressing Escape.
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

  const menuItemClass =
    "block w-full text-left px-4 py-2.5 text-sm font-medium text-white/85 hover:text-white hover:bg-white/10 rounded-lg transition-colors";

  return (
    <header
      ref={headerRef}
      className="w-full bg-gradient-to-r from-indigo-600 to-blue-500 shadow-lg"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full overflow-hidden shrink-0 bg-white/20">
            <img
              src="/ICON.jpeg"
              alt="Prefects Discipline"
              className="w-full h-full object-cover"
            />
          </div>
          <h1 className="text-white text-xl sm:text-2xl font-bold tracking-tight truncate">
            Discipline
          </h1>
        </div>

        {/* Desktop navigation */}
        <nav className="hidden sm:flex items-center gap-3 sm:gap-5">
          {isAdmin && <GenerateDailyReportButton />}
          {isAdmin && (
            <a
              href="/users"
              className="text-white/70 hover:text-white text-xs sm:text-sm font-medium transition-colors"
            >
              Users
            </a>
          )}
          {isAdmin && (
            <a
              href="/lists"
              className="text-white/70 hover:text-white text-xs sm:text-sm font-medium transition-colors"
            >
              Lists
            </a>
          )}
          <a
            href="/discipline"
            className="text-white/70 hover:text-white text-xs sm:text-sm font-medium transition-colors"
          >
            Records
          </a>
          <a
            href="/"
            className="text-white/60 hover:text-white sm:text-white/70 text-xs sm:text-sm shrink-0 transition-colors"
          >
            <span className="hidden sm:inline">Prefects </span>Dashboard
          </a>
          {user && (
            <>
              <span className="text-white/50 text-xs hidden sm:block shrink-0 select-none">
                {user.username}
              </span>
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 bg-red-500 hover:bg-red-600 text-white text-xs sm:text-sm font-medium px-3 sm:px-4 py-1.5 rounded-full shadow-sm transition-colors shrink-0"
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
                <span className="hidden sm:inline">Logout</span>
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
          className="sm:hidden inline-flex items-center justify-center w-10 h-10 -mr-2 rounded-lg text-white hover:bg-white/10 active:bg-white/20 transition-colors"
        >
          {menuOpen ? (
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          ) : (
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <nav
          id="mobile-menu"
          className="sm:hidden border-t border-white/15 px-3 pb-3 pt-1 animate-[menu-in_0.15s_ease-out]"
          aria-label="Mobile navigation"
        >
          {isAdmin && (
            <div className="px-2 py-2">
              <GenerateDailyReportButton />
            </div>
          )}
          <div className="flex flex-col gap-1 pt-1">
            {isAdmin && (
              <a
                href="/users"
                onClick={() => setMenuOpen(false)}
                className={menuItemClass}
              >
                Users
              </a>
            )}
            {isAdmin && (
              <a
                href="/lists"
                onClick={() => setMenuOpen(false)}
                className={menuItemClass}
              >
                Lists
              </a>
            )}
            <a
              href="/discipline"
              onClick={() => setMenuOpen(false)}
              className={menuItemClass}
            >
              Records
            </a>
            <a href="/" onClick={() => setMenuOpen(false)} className={menuItemClass}>
              Dashboard
            </a>
          </div>
          {user && (
            <div className="mt-2 border-t border-white/15 pt-2 px-2 flex flex-col gap-2">
              <span className="text-xs text-white/50 select-none">
                Signed in as {user.username}
              </span>
              <button
                onClick={handleLogout}
                className="inline-flex items-center justify-center gap-1.5 bg-red-500 hover:bg-red-600 text-white text-sm font-medium px-4 py-2 rounded-full shadow-sm transition-colors"
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
            </div>
          )}
        </nav>
      )}
    </header>
  );
};
