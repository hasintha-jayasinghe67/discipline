import React from "react";

export default () => {
  return (
    <div className="w-full bg-gradient-to-r from-indigo-600 to-blue-500 shadow-lg">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
            <span className="text-white font-bold text-lg">D</span>
          </div>
          <h1 className="text-white text-2xl font-bold tracking-tight">Discipline</h1>
        </div>
        <div className="text-white/70 text-sm">Prefects Dashboard</div>
      </div>
    </div>
  );
};
