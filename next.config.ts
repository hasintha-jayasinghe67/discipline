import type { NextConfig } from "next";

/**
 * Security headers applied to every response. These harden the app against
 * clickjacking, MIME-type sniffing, referrer leakage, and protocol downgrade
 * attacks, and lock down which external origins the browser may contact.
 */
const securityHeaders = [
  // The app only talks to its own Supabase project — pin the connect-src and
  // img-src allowlists to it so a stray script tag cannot exfiltrate data
  // elsewhere. Update SUPABASE_PROJECT_REF if you ever change Supabase hosts.
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Next.js requires 'unsafe-inline' for its inline bootstrap scripts and
      // inline styles; 'unsafe-eval' is needed in dev (React Refresh).
      `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline'",
      `connect-src 'self' ${
        process.env.NEXT_PUBLIC_SUPABASE_URL
          ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
          : "https://*.supabase.co"
      }`,
      `img-src 'self' data: ${
        process.env.NEXT_PUBLIC_SUPABASE_URL
          ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
          : "https://*.supabase.co"
      }`,
      "font-src 'self' data:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests",
    ].join("; "),
  },
  // Defence-in-depth for browsers that ignore CSP frame-ancestors.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
