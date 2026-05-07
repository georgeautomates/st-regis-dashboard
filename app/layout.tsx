import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "St Regis Dashboard — Firmin",
  description: "St Regis order email review dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col bg-[#0a0f1e] text-slate-200">
        <header className="border-b border-slate-800 px-6 py-3 flex items-center gap-4 shrink-0">
          <span className="text-xs uppercase tracking-widest text-slate-500">Firmin</span>
          <span className="text-slate-700">/</span>
          <span className="font-bold text-slate-100 tracking-wide">St Regis Dashboard</span>
        </header>
        <main className="flex-1 overflow-hidden">{children}</main>
      </body>
    </html>
  );
}
