"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import GenerateDailyReportButton from "./GenerateDailyReportButton";

export default () => {
  const { user, logout } = useAuth();
  const router = useRouter();
  const isAdmin = user?.role === "admin";
  const handleLogout = () => {
    logout();
    router.push("/authenticate");
  };
  return (
    <div className="w-full bg-gradient-to-r from-indigo-600 to-blue-500 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full overflow-hidden shrink-0 bg-white/20">
            <img src="/ICON.jpeg" alt="Prefects Discipline" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-white text-xl sm:text-2xl font-bold tracking-tight truncate">Discipline</h1>
        </div>
        <div className="flex items-center gap-3 sm:gap-5">
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
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span className="hidden sm:inline">Logout</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
