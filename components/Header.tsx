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
        <div className="text-white/60 sm:text-white/70 text-xs sm:text-sm shrink-0">
          <span className="hidden sm:inline">Prefects </span>Dashboard
        </div>
      </div>
    </div>
  );
};
