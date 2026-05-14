"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";

type ReviewEntry = {
  job_number: string;
  client_name: string;
  message_id: string;
  email_subject: string;
  collection_point: string;
  delivery_point: string;
  price: string;
  category: string;
  processed_at: string;
  verdict: "PASS" | "FAIL";
  reason: string;
};

const CATEGORY_COLOURS: Record<string, string> = {
  "New Order":    "bg-sky-900/50 text-sky-300 border border-sky-700/50",
  "Amendment":    "bg-amber-900/50 text-amber-300 border border-amber-700/50",
  "Cancellation": "bg-red-900/50 text-red-300 border border-red-700/50",
  "Unknown":      "bg-slate-800 text-slate-400 border border-slate-700",
};

export default function ManagerPage() {
  const router = useRouter();
  const [reviews, setReviews] = useState<ReviewEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [verdictFilter, setVerdictFilter] = useState<"ALL" | "PASS" | "FAIL">("ALL");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/reviews")
      .then(r => r.json())
      .then(d => { setReviews(d.reviews ?? []); setLoading(false); })
      .catch(e => { setError(String(e)); setLoading(false); });
  }, []);

  const filtered = useMemo(() => {
    return reviews.filter(r => {
      if (verdictFilter !== "ALL" && r.verdict !== verdictFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !r.job_number.toLowerCase().includes(q) &&
          !r.email_subject.toLowerCase().includes(q) &&
          !r.collection_point.toLowerCase().includes(q) &&
          !r.delivery_point.toLowerCase().includes(q) &&
          !r.reason.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [reviews, verdictFilter, search]);

  const passCount = reviews.filter(r => r.verdict === "PASS").length;
  const failCount = reviews.filter(r => r.verdict === "FAIL").length;

  if (loading) return (
    <div className="flex items-center justify-center h-full text-slate-500 text-sm">Loading reviews…</div>
  );
  if (error) return (
    <div className="flex items-center justify-center h-full text-red-400 text-sm">Error: {error}</div>
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Stats */}
      <div className="px-6 py-4 border-b border-slate-800 flex items-center gap-6 shrink-0">
        <div className="bg-slate-900 border border-slate-800 rounded px-4 py-3">
          <div className="text-xs uppercase tracking-widest text-slate-500 mb-1">Total Reviews</div>
          <div className="text-2xl font-bold text-slate-100">{reviews.length}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded px-4 py-3">
          <div className="text-xs uppercase tracking-widest text-slate-500 mb-1">Pass</div>
          <div className="text-2xl font-bold text-emerald-400">{passCount}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded px-4 py-3">
          <div className="text-xs uppercase tracking-widest text-slate-500 mb-1">Fail</div>
          <div className="text-2xl font-bold text-red-400">{failCount}</div>
        </div>
        {reviews.length > 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded px-4 py-3">
            <div className="text-xs uppercase tracking-widest text-slate-500 mb-1">Pass Rate</div>
            <div className="text-2xl font-bold text-slate-100">
              {Math.round((passCount / reviews.length) * 100)}%
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="px-6 py-3 border-b border-slate-800 flex items-center gap-4 shrink-0">
        <input
          type="text"
          placeholder="Search job, subject, location, reason…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-slate-500 w-80"
        />
        <div className="flex gap-1.5">
          {(["ALL", "PASS", "FAIL"] as const).map(v => (
            <button key={v} onClick={() => setVerdictFilter(v)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                verdictFilter === v
                  ? "bg-slate-600 text-white"
                  : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
              }`}>
              {v}
            </button>
          ))}
        </div>
        <span className="text-slate-600 text-xs ml-auto">{filtered.length} result{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Table header */}
      <div className="px-6 py-2 border-b border-slate-800 grid grid-cols-12 gap-3 text-xs uppercase tracking-widest text-slate-600 shrink-0">
        <div className="col-span-1">Job</div>
        <div className="col-span-1">Verdict</div>
        <div className="col-span-2">Category</div>
        <div className="col-span-2">Collection</div>
        <div className="col-span-2">Delivery</div>
        <div className="col-span-1">Price</div>
        <div className="col-span-3">Reason / Subject</div>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <div className="text-center text-slate-600 text-sm py-16">No reviews found</div>
        )}
        {filtered.map(r => (
          <div
            key={r.job_number}
            onClick={() => router.push(`/email/${r.message_id}`)}
            className={`px-6 py-3 border-b border-slate-800/60 border-l-2 ${
              r.verdict === "PASS" ? "border-l-emerald-600" : "border-l-red-600"
            } grid grid-cols-12 gap-3 items-center cursor-pointer hover:bg-slate-900/50 transition-colors`}
          >
            <div className="col-span-1 font-mono text-xs text-slate-300">{r.job_number}</div>

            <div className="col-span-1">
              <span className={`text-xs font-bold px-2 py-0.5 rounded border ${
                r.verdict === "PASS"
                  ? "bg-emerald-950/50 text-emerald-400 border-emerald-800"
                  : "bg-red-950/50 text-red-400 border-red-800"
              }`}>
                {r.verdict}
              </span>
            </div>

            <div className="col-span-2">
              <span className={`text-xs px-2 py-0.5 rounded font-medium ${CATEGORY_COLOURS[r.category] ?? CATEGORY_COLOURS["Unknown"]}`}>
                {r.category || "Unknown"}
              </span>
            </div>

            <div className="col-span-2 text-xs text-slate-400 truncate" title={r.collection_point}>
              {r.collection_point || <span className="text-slate-700">—</span>}
            </div>

            <div className="col-span-2 text-xs text-slate-400 truncate" title={r.delivery_point}>
              {r.delivery_point || <span className="text-slate-700">—</span>}
            </div>

            <div className="col-span-1 text-xs text-slate-400">{r.price || "—"}</div>

            <div className="col-span-3 text-xs space-y-0.5">
              {r.reason && (
                <div className="text-red-300">{r.reason}</div>
              )}
              {r.email_subject && (
                <div className="text-slate-600 truncate" title={r.email_subject}>{r.email_subject}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
