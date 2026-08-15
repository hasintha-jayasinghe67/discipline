"use client";

import { useEffect, useRef } from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      dialog.showModal();
      document.body.style.overflow = "hidden";
    } else {
      dialog.close();
      document.body.style.overflow = "";
    }
  }, [isOpen]);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="m-auto p-0 rounded-[20px] bg-surface border border-hairline shadow-sheet max-w-md w-[calc(100%-2rem)] sm:w-full"
    >
      <div className="p-5 sm:p-6 flex flex-col gap-4">
        {/* Sheet grabber */}
        <div className="mx-auto -mt-1 h-1.5 w-9 rounded-full bg-fill shrink-0" />
        <div className="flex justify-between items-center gap-3">
          <h2 className="text-[17px] font-semibold text-label tracking-tight leading-snug">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-fill-secondary text-label-secondary hover:text-label hover:bg-fill text-base transition-colors shrink-0"
            aria-label="Close"
          >
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
                strokeWidth={2.2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <div>{children}</div>
      </div>
    </dialog>
  );
}
