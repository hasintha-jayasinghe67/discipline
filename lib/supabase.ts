import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be set.\n" +
      "  - Local dev: add them to .env.local\n" +
      "  - Vercel: add them under Project → Settings → Environment Variables " +
      "(Production, and Preview/Development if needed), then redeploy."
  );
}

/**
 * Browser client used by all client components. Sessions are persisted in
 * cookies (via @supabase/ssr), so the access token is attached to every
 * request automatically when logged in and readable by proxy.ts / server code.
 */
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
