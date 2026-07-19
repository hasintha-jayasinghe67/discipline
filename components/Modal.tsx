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
      document.body.style.overflow = "hidden"; // Prevent background scrolling
    } else {
      dialog.close();
      document.body.style.overflow = "";
    }
  }, [isOpen]);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="backdrop:bg-black/50 p-6 rounded-lg shadow-xl max-w-md w-full bg-white open:flex open:flex-col gap-4 animate-in fade-in zoom-in-95 duration-200"
    >
      <div className="flex justify-between items-center border-b pb-2">
        <h2 className="text-xl font-semibold">{title}</h2>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700 font-bold text-lg"
          aria-label="Close modal"
        >
          ✕
        </button>
      </div>
      <div>{children}</div>
    </dialog>
  );
}
