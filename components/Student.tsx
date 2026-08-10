import React from "react";

export default ({
  name,
  Class,
  house,
  strikes,
  onStrikeClick,
  onBlackmarkClick,
  onGoldMarkClick,
  onCommentClick,
  blackmarks,
  goldmarks,
  admission,
  showActions = true,
  pendingBlackmark = false,
}: {
  name: string;
  Class: string;
  house: string;
  strikes: number | string;
  blackmarks: number | string;
  goldmarks: number | string;
  onStrikeClick: () => void;
  onBlackmarkClick: () => void;
  onGoldMarkClick: () => void;
  onCommentClick: () => void;
  admission: string;
  showActions?: boolean;
  pendingBlackmark?: boolean;
}) => {
  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4 sm:p-5 m-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <a href={`/student/${admission}`}>
            <h2 className="text-gray-900 text-base sm:text-lg font-semibold">{name}</h2>
          </a>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-500">
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
            <span className="text-xs sm:text-sm text-amber-700 font-medium">
              Strikes
            </span>
            <span className="text-base sm:text-lg font-bold text-amber-600">{strikes}</span>
          </div>
          {pendingBlackmark && (
            <div className="flex items-center justify-center gap-1.5 bg-rose-50 border border-rose-200 rounded-lg px-3 py-1.5">
              <svg
                className="w-3.5 h-3.5 text-rose-600 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <span className="text-[10px] sm:text-xs font-semibold text-rose-700">
                Pending Black Mark
              </span>
            </div>
          )}
          <div className="flex items-center justify-between bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
            <span className="text-xs sm:text-sm text-rose-700 font-medium">
              Blackmarks
            </span>
            <span className="text-base sm:text-lg font-bold text-rose-600">
              {blackmarks}
            </span>
          </div>
          <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
            <span className="text-xs sm:text-sm text-emerald-700 font-medium">
              Gold Marks
            </span>
            <span className="text-base sm:text-lg font-bold text-emerald-600">
              {goldmarks}
            </span>
          </div>
        </div>
      </div>
      {showActions && (
        <div className="grid grid-cols-2 sm:flex sm:gap-2 gap-2 mt-4 pt-4 border-t border-gray-100">
          <button
            onClick={onStrikeClick}
            className="sm:flex-1 hover:cursor-pointer bg-amber-500 hover:bg-amber-600 text-white font-medium text-xs sm:text-sm px-3 sm:px-4 py-2 rounded-lg shadow-sm"
          >
            <span className="flex items-center justify-center gap-1 sm:gap-1.5">
              <svg
                className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0"
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
              <span>Add Strike</span>
            </span>
          </button>
          <button
            onClick={onGoldMarkClick}
            className="sm:flex-1 hover:cursor-pointer bg-emerald-500 hover:bg-emerald-600 text-white font-medium text-xs sm:text-sm px-3 sm:px-4 py-2 rounded-lg shadow-sm"
          >
            <span className="flex items-center justify-center gap-1 sm:gap-1.5">
              <svg
                className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v13m0-13V6m0 2a2 2 0 100-4 2 2 0 000 4zm-6 8a6 6 0 0112 0"
                />
              </svg>
              <span>Gold Mark</span>
            </span>
          </button>
          <button
            onClick={onCommentClick}
            className="sm:flex-1 hover:cursor-pointer bg-violet-500 hover:bg-violet-600 text-white font-medium text-xs sm:text-sm px-3 sm:px-4 py-2 rounded-lg shadow-sm"
          >
            <span className="flex items-center justify-center gap-1 sm:gap-1.5">
              <svg
                className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            <span>Comment</span>
          </span>
        </button>
        <button
          onClick={onBlackmarkClick}
          className="sm:flex-1 hover:cursor-pointer bg-rose-500 hover:bg-rose-600 text-white font-medium text-xs sm:text-sm px-3 sm:px-4 py-2 rounded-lg shadow-sm"
        >
          <span className="flex items-center justify-center gap-1 sm:gap-1.5">
            <svg
              className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0"
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
            <span>Black Mark</span>
          </span>
        </button>
      </div>
      )}
    </div>
  );
};
