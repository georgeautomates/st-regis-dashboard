import type { Metadata } from "next";
import Link from "next/link";
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
          <a href="/" className="font-bold text-slate-100 tracking-wide hover:text-slate-300">St Regis Dashboard</a>
          <span className="text-slate-700">|</span>
          <a href="/manager" className="text-xs text-violet-400 hover:text-violet-300 transition-colors">Manager Review</a>
          <Link href="/manifest-review" className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors">Manifest Review</Link>
          <a href="/log" className="text-xs text-sky-400 hover:text-sky-300 transition-colors">System Log</a>
          <a href="/rpa-log" className="text-xs text-purple-400 hover:text-purple-300 transition-colors">RPA Log</a>
        </header>
        <main className="flex-1 overflow-hidden">{children}</main>
      </body>
    </html>
  );
}
