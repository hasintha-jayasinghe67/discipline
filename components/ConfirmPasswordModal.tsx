"use client";

import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import Modal from "./Modal";

interface ConfirmPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  /** Called only after the current user's password has been verified. */
  onVerified: () => Promise<void>;
}

/**
 * Destructive-action confirmation modal: requires the logged-in user to
 * re-enter their password (verified against the users table) before the
 * action in `onVerified` runs — the same flow as the "Clear Strikes" action.
 */
export default function ConfirmPasswordModal({
  isOpen,
  onClose,
  title,
  message,
  confirmLabel = "Confirm",
  onVerified,
}: ConfirmPasswordModalProps) {
  const { user } = useAuth();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Reset the form each time the modal opens
  useEffect(() => {
    if (isOpen) {
      setPassword("");
      setBusy(false);
      setError("");
    }
  }, [isOpen]);

  const handleConfirm = async () => {
    if (!user || busy || !password.trim()) return;
    setBusy(true);
    setError("");
    try {
      // Verify the user's password against their account
      const { data, error: fetchError } = await supabase
        .from("users")
        .select("password")
        .eq("id", user.id)
        .maybeSingle();
      if (fetchError || !data) {
        setError("Could not verify your account. Please try again.");
        return;
      }
      const bcryptjs = await import("bcryptjs");
      const match = bcryptjs.compareSync(password, data.password);
      if (!match) {
        setError("Incorrect password. Action aborted.");
        return;
      }
      await onVerified();
      onClose();
    } catch (err) {
      setError(
        "Action failed: " + (err instanceof Error ? err.message : String(err))
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="flex flex-col gap-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {message}
        </div>
        <div>
          <label
            htmlFor="confirm-password"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Enter your password to confirm
          </label>
          <input
            id="confirm-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your password"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleConfirm();
              }
            }}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:border-red-400 focus:bg-white"
          />
        </div>
        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
        <div className="flex w-full gap-2 pt-2 border-t border-gray-100">
          <button
            onClick={handleConfirm}
            disabled={busy || !password.trim()}
            className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white font-medium px-4 py-2.5 rounded-lg shadow-sm transition-all"
          >
            {busy ? "Verifying..." : confirmLabel}
          </button>
          <button
            onClick={onClose}
            disabled={busy}
            className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium px-4 py-2.5 rounded-lg transition-all"
          >
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}
