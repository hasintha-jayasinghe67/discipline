"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";

export default function AuthenticatePage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const success = await login(username, password);
    if (success) {
      router.push("/");
    } else {
      setError("Invalid username or password");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background accents */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_-10%,rgba(13,148,136,0.25),transparent)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_30%_at_80%_100%,rgba(8,145,178,0.15),transparent)]" />

      <div className="w-full max-w-sm relative z-10">
        {/* Branding */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl overflow-hidden mx-auto mb-4 ring-2 ring-teal-400/30 shadow-xl shadow-teal-500/10">
            <img src="/ICON.jpeg" alt="Prefects Discipline" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-white text-2xl font-bold tracking-tight">
            Prefects Discipline
          </h1>
          <p className="text-slate-400 text-sm mt-1.5">
            Sign in to access the dashboard
          </p>
        </div>

        {/* Login Form */}
        <form
          onSubmit={handleSubmit}
          className="card-solid p-6 sm:p-8 flex flex-col gap-4 shadow-2xl shadow-slate-900/40"
        >
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-slate-700 mb-1.5">
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              required
              autoFocus
              className="input-field"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1.5">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              className="input-field"
            />
          </div>

          {error && (
            <div className="bg-rose-50 border border-rose-200/70 rounded-xl px-3 py-2.5 flex items-center gap-2">
              <svg className="w-4 h-4 text-rose-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm text-rose-700">{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary px-4 py-2.5 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Signing in...
              </>
            ) : (
              "Sign In"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
