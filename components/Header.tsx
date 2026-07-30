import React from "react";

export default () => {
  return (
    <div className="w-full bg-gradient-to-r from-indigo-600 to-blue-500 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-7 h-7 sm:w-8 sm:h-8 bg-white/20 rounded-full flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-sm sm:text-lg">D</span>
          </div>
          <h1 className="text-white text-xl sm:text-2xl font-bold tracking-tight truncate">Discipline</h1>
        </div>
        <div className="flex items-center gap-3 sm:gap-5">
          <a
            href="/lists"
            className="text-white/70 hover:text-white text-xs sm:text-sm font-medium transition-colors"
          >
            Lists
          </a>
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
        </div>
      </div>
    </div>
  );
};
