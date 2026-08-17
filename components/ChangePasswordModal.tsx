"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import Modal from "./Modal";
import PasswordInput from "./PasswordInput";

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Self-service password change. The current password is verified with a real
 * sign-in (which also satisfies Supabase's recent-authentication requirement
 * for password updates), then the new password is set via updateUser.
 */
export default function ChangePasswordModal({
  isOpen,
  onClose,
}: ChangePasswordModalProps) {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setBusy(false);
      setError("");
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!user || busy) return;
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("All fields are required.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }
    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      // Re-authenticate with the current password.
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (reauthError) {
        setError("Current password is incorrect.");
        return;
      }
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateError) {
        setError(updateError.message);
        return;
      }
      onClose();
      alert("Password changed successfully.");
    } catch (err) {
      setError(
        "Failed to change password: " +
          (err instanceof Error ? err.message : String(err))
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Change password">
      <div className="flex flex-col gap-4">
        <div>
          <label
            htmlFor="change-current-password"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            Current password
          </label>
          <PasswordInput
            id="change-current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Your current password"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSubmit();
              }
            }}
            className="bg-slate-50 border border-slate-200/70 rounded-xl px-3 py-2.5 text-slate-900 placeholder-slate-400 focus:border-accent focus:bg-white"
          />
        </div>
        <div>
          <label
            htmlFor="change-new-password"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            New password
          </label>
          <PasswordInput
            id="change-new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="At least 6 characters"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSubmit();
              }
            }}
            className="bg-slate-50 border border-slate-200/70 rounded-xl px-3 py-2.5 text-slate-900 placeholder-slate-400 focus:border-accent focus:bg-white"
          />
        </div>
        <div>
          <label
            htmlFor="change-confirm-password"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            Confirm new password
          </label>
          <PasswordInput
            id="change-confirm-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repeat the new password"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSubmit();
              }
            }}
            className="bg-slate-50 border border-slate-200/70 rounded-xl px-3 py-2.5 text-slate-900 placeholder-slate-400 focus:border-accent focus:bg-white"
          />
        </div>
        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
        <div className="flex w-full gap-2 pt-2 border-t border-slate-100">
          <button
            onClick={handleSubmit}
            disabled={busy}
            className="btn-primary flex-1 px-4 py-2.5"
          >
            {busy ? "Changing..." : "Change password"}
          </button>
          <button
            onClick={onClose}
            disabled={busy}
            className="btn-secondary flex-1 px-4 py-2.5"
          >
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}
