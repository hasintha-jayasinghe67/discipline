import React from "react";

export default ({
  name,
  Class,
  house,
  strikes,
  onStrikeClick,
  onBlackmarkClick,
  blackmarks,
  admission,
}: {
  name: string;
  Class: string;
  house: string;
  strikes: number | string;
  blackmarks: number | string;
  onStrikeClick: () => void;
  onBlackmarkClick: () => void;
  admission: string;
}) => {
  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-100 p-5 m-2">
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <a href={`/student/${admission}`}>
            <h2 className="text-gray-900 text-lg font-semibold">{name}</h2>
          </a>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span className="inline-flex items-center gap-1">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
              {Class}
            </span>
            <span className="inline-flex items-center gap-1">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                />
              </svg>
              {house}
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-2 justify-center">
          <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <span className="text-sm text-amber-700 font-medium">
              Current Strikes
            </span>
            <span className="text-lg font-bold text-amber-600">{strikes}</span>
          </div>
          <div className="flex items-center justify-between bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
            <span className="text-sm text-rose-700 font-medium">
              Current Blackmarks
            </span>
            <span className="text-lg font-bold text-rose-600">
              {blackmarks}
            </span>
          </div>
        </div>
      </div>
      <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
        <button
          onClick={onStrikeClick}
          className="flex-1 hover:cursor-pointer bg-amber-500 hover:bg-amber-600 text-white font-medium text-sm px-4 py-2 rounded-lg shadow-sm"
        >
          <span className="flex items-center justify-center gap-1.5">
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Add Strike
          </span>
        </button>
        <button className="flex-1 hover:cursor-pointer bg-blue-500 hover:bg-blue-600 text-white font-medium text-sm px-4 py-2 rounded-lg shadow-sm">
          <span className="flex items-center justify-center gap-1.5">
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
              />
            </svg>
            Add to Punishment
          </span>
        </button>
        <button
          onClick={onBlackmarkClick}
          className="flex-1 hover:cursor-pointer bg-rose-500 hover:bg-rose-600 text-white font-medium text-sm px-4 py-2 rounded-lg shadow-sm"
        >
          <span className="flex items-center justify-center gap-1.5">
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
            Add Black Mark
          </span>
        </button>
      </div>
    </div>
  );
};
