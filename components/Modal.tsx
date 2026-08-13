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
      className="p-0 rounded-2xl shadow-2xl shadow-slate-900/20 max-w-md w-[calc(100%-2rem)] sm:w-full bg-white border border-slate-200/80"
    >
      <div className="p-6 flex flex-col gap-4">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <h2 className="text-lg font-semibold text-slate-900 tracking-tight">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 text-lg transition-colors"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>
        <div>{children}</div>
      </div>
    </dialog>
  );
}
