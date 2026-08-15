import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/AuthContext";

export const metadata: Metadata = {
  title: "Prefects Discipline",
  description: "Discipline management dashboard for prefects",
};

// Runs before first paint so the correct theme is applied without flashing.
// Reads the persisted choice, falling back to the system preference.
// The storage key must match THEME_STORAGE_KEY in lib/theme.ts.
const themeScript = `(function(){try{var s=localStorage.getItem("app-theme");var t=(s==="light"||s==="dark")?s:(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");document.documentElement.setAttribute("data-theme",t);}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
