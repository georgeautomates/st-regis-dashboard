"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { Email, EmailCategory, JobMatchStatus } from "@/lib/db";

const CATEGORY_COLOURS: Record<EmailCategory, string> = {
  "New Order":    "bg-sky-900/50 text-sky-300 border border-sky-700/50",
  "Amendment":    "bg-amber-900/50 text-amber-300 border border-amber-700/50",
  "Cancellation": "bg-red-900/50 text-red-300 border border-red-700/50",
  "Unknown":      "bg-slate-800 text-slate-400 border border-slate-700",
};

const STATUS_BORDER: Record<JobMatchStatus, string> = {
  MATCH:    "border-l-emerald-500",
  PARTIAL:  "border-l-amber-500",
  MISMATCH: "border-l-red-500",
  UNKNOWN:  "border-l-slate-700",
};

function StatBox({ label, value, colour }: { label: string; value: string | number; colour?: string }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded px-4 py-3">
      <div className="text-xs uppercase tracking-widest text-slate-500 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${colour ?? "text-slate-100"}`}>{value}</div>
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<EmailCategory | "ALL">("ALL");
  const [statusFilter, setStatusFilter] = useState<JobMatchStatus | "ALL">("ALL");

  useEffect(() => {
    fetch("/api/emails")
      .then(r => r.json())
      .then(d => { setEmails(d.emails ?? []); setLoading(false); })
      .catch(e => { setError(String(e)); setLoading(false); });
  }, []);

  const filtered = useMemo(() => {
    return emails.filter(e => {
      if (categoryFilter !== "ALL" && e.category !== categoryFilter) return false;
      if (statusFilter !== "ALL" && e.worst_status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!e.subject.toLowerCase().includes(q) && !e.message_id.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [emails, categoryFilter, statusFilter, search]);

  const stats = useMemo(() => ({
    total: emails.length,
    newOrders: emails.filter(e => e.category === "New Order").reduce((s, e) => s + e.job_count, 0),
    amendments: emails.filter(e => e.category === "Amendment").reduce((s, e) => s + e.job_count, 0),
    cancellations: emails.filter(e => e.category === "Cancellation").reduce((s, e) => s + e.job_count, 0),
    fullMatch: emails.reduce((s, e) => s + e.match_count, 0),
    partial: emails.reduce((s, e) => s + e.partial_count, 0),
    mismatch: emails.reduce((s, e) => s + e.mismatch_count, 0),
    totalJobs: emails.reduce((s, e) => s + e.job_count, 0),
  }), [emails]);

  if (loading) return (
    <div className="flex items-center justify-center h-full text-slate-500 text-sm">Loading emails…</div>
  );
  if (error) return (
    <div className="flex items-center justify-center h-full text-red-400 text-sm">Error: {error}</div>
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Stats */}
      <div className="px-6 py-4 border-b border-slate-800 grid grid-cols-7 gap-3 shrink-0">
        <StatBox label="Emails" value={stats.total} />
        <StatBox label="Total Jobs" value={stats.totalJobs} />
        <StatBox label="New Order Jobs" value={stats.newOrders} colour="text-sky-400" />
        <StatBox label="Amendment Jobs" value={stats.amendments} colour="text-amber-400" />
        <StatBox label="Full Match" value={stats.fullMatch} colour="text-emerald-400" />
        <StatBox label="Partial" value={stats.partial} colour="text-amber-400" />
        <StatBox label="Mismatch" value={stats.mismatch} colour="text-red-400" />
      </div>

      {/* Filters */}
      <div className="px-6 py-3 border-b border-slate-800 flex items-center gap-4 shrink-0 flex-wrap">
        <input
          type="text"
          placeholder="Search subject or email ID…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-slate-500 w-72"
        />
        <div className="flex gap-1.5">
          {(["ALL", "New Order", "Amendment", "Cancellation"] as const).map(c => (
            <button key={c} onClick={() => setCategoryFilter(c)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                categoryFilter === c
                  ? "bg-slate-600 text-white"
                  : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
              }`}>
              {c}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 ml-auto">
          {(["ALL", "MATCH", "PARTIAL", "MISMATCH", "UNKNOWN"] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                statusFilter === s
                  ? "bg-slate-600 text-white"
                  : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
              }`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table header */}
      <div className="px-6 py-2 border-b border-slate-800 grid grid-cols-12 gap-3 text-xs uppercase tracking-widest text-slate-600 shrink-0">
        <div className="col-span-1">Email ID</div>
        <div className="col-span-3">Subject</div>
        <div className="col-span-2">Category</div>
        <div className="col-span-2">Jobs</div>
        <div className="col-span-2">Match Summary</div>
        <div className="col-span-2">Top Mismatch Reasons</div>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <div className="text-center text-slate-600 text-sm py-16">No emails found</div>
        )}
        {filtered.map(email => (
          <div
            key={email.message_id}
            onClick={() => router.push(`/email/${email.message_id}`)}
            className={`px-6 py-3 border-b border-slate-800/60 border-l-2 ${STATUS_BORDER[email.worst_status]} grid grid-cols-12 gap-3 items-center cursor-pointer hover:bg-slate-900/50 transition-colors`}
          >
            <div className="col-span-1 font-mono text-xs text-slate-500 truncate" title={email.message_id}>
              {email.message_id.slice(0, 10)}…
            </div>

            <div className="col-span-3 text-sm text-slate-300 truncate" title={email.subject}>
              {email.subject || <span className="text-slate-600 italic">No subject</span>}
            </div>

            <div className="col-span-2">
              <span className={`text-xs px-2 py-0.5 rounded font-medium ${CATEGORY_COLOURS[email.category]}`}>
                {email.category}
              </span>
            </div>

            <div className="col-span-2 text-sm">
              <span className="text-slate-200 font-medium">{email.job_count}</span>
              <span className="text-slate-600 text-xs ml-1">job{email.job_count !== 1 ? "s" : ""}</span>
              {email.fibre_count > 0 && email.reels_count > 0 && (
                <div className="text-xs text-slate-500 mt-0.5">{email.fibre_count} Fibre · {email.reels_count} Reels</div>
              )}
              {email.fibre_count > 0 && email.reels_count === 0 && (
                <div className="text-xs text-slate-500 mt-0.5">Fibre A/C</div>
              )}
              {email.reels_count > 0 && email.fibre_count === 0 && (
                <div className="text-xs text-slate-500 mt-0.5">Reels A/C</div>
              )}
            </div>

            <div className="col-span-2 text-xs space-y-0.5">
              {email.match_count > 0 && <div className="text-emerald-400">{email.match_count} match</div>}
              {email.partial_count > 0 && <div className="text-amber-400">{email.partial_count} partial</div>}
              {email.mismatch_count > 0 && <div className="text-red-400">{email.mismatch_count} mismatch</div>}
              {email.unknown_count === email.job_count && <div className="text-slate-600">not compared yet</div>}
            </div>

            <div className="col-span-2 text-xs text-slate-500 space-y-0.5">
              {email.top_mismatch_reasons.length > 0
                ? email.top_mismatch_reasons.map((r, i) => <div key={i}>{r}</div>)
                : <span className="text-slate-700">—</span>
              }
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
