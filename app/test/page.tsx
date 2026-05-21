"use client";

import { useEffect, useState, useMemo } from "react";

type SubjectMatch = "MATCH" | "MISMATCH" | "NOT_IN_SUBJECT" | "NO_PDF_JOBS";

type TestOrder = {
  id: number;
  message_id: string;
  email_subject: string;
  email_received_at: string;
  processed_at: string;
  subject_job_numbers: string;   // comma-separated
  pdf_job_numbers: string;       // comma-separated
  subject_match: SubjectMatch;
  job_number: string;
  collection_point: string;
  delivery_point: string;
  price: string;
  order_number: string;
  collection_date: string;
  collection_time: string;
  delivery_date: string;
  delivery_time: string;
  collection_postcode: string;
  delivery_postcode: string;
  composite_score: number | null;
  confidence_status: string;
  extraction_method: string;
};

const MATCH_STYLE: Record<SubjectMatch, string> = {
  MATCH:          "bg-emerald-900/50 text-emerald-300 border border-emerald-700/50",
  MISMATCH:       "bg-red-900/50 text-red-300 border border-red-700/50",
  NOT_IN_SUBJECT: "bg-amber-900/50 text-amber-300 border border-amber-700/50",
  NO_PDF_JOBS:    "bg-slate-800 text-slate-400 border border-slate-700",
};

const MATCH_BORDER: Record<SubjectMatch, string> = {
  MATCH:          "border-l-emerald-500",
  MISMATCH:       "border-l-red-500",
  NOT_IN_SUBJECT: "border-l-amber-500",
  NO_PDF_JOBS:    "border-l-slate-600",
};

const CONF_COLOUR: Record<string, string> = {
  GREEN:  "text-emerald-400",
  YELLOW: "text-amber-400",
  RED:    "text-red-400",
};

function StatBox({ label, value, colour }: { label: string; value: string | number; colour?: string }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded px-4 py-3">
      <div className="text-xs uppercase tracking-widest text-slate-500 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${colour ?? "text-slate-100"}`}>{value}</div>
    </div>
  );
}

function MatchBadge({ value }: { value: SubjectMatch }) {
  const label: Record<SubjectMatch, string> = {
    MATCH:          "MATCH",
    MISMATCH:       "MISMATCH",
    NOT_IN_SUBJECT: "NO SUBJECT JOB",
    NO_PDF_JOBS:    "NO PDF JOBS",
  };
  return (
    <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded ${MATCH_STYLE[value]}`}>
      {label[value]}
    </span>
  );
}

function ExtractionBadge({ method }: { method: string }) {
  if (method === "table") return (
    <span className="text-xs text-sky-400 bg-sky-900/30 border border-sky-800/50 px-2 py-0.5 rounded">TABLE</span>
  );
  if (method === "ai") return (
    <span className="text-xs text-violet-400 bg-violet-900/30 border border-violet-800/50 px-2 py-0.5 rounded">AI</span>
  );
  if (method === "ai_failed") return (
    <span className="text-xs text-red-400 bg-red-900/30 border border-red-800/50 px-2 py-0.5 rounded">AI FAILED</span>
  );
  if (method === "not_in_pdf") return (
    <span className="text-xs text-slate-400 bg-slate-800 border border-slate-700 px-2 py-0.5 rounded">NOT IN PDF</span>
  );
  return null;
}

function formatDate(s: string): string {
  if (!s) return "—";
  // Try to parse ISO or RFC2822
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    + " " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export default function TestPage() {
  const [orders, setOrders] = useState<TestOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [matchFilter, setMatchFilter] = useState<SubjectMatch | "ALL">("ALL");

  useEffect(() => {
    fetch("/api/test-orders")
      .then(r => r.json())
      .then(d => { setOrders(d.orders ?? []); setLoading(false); })
      .catch(e => { setError(String(e)); setLoading(false); });
  }, []);

  const filtered = useMemo(() => {
    return orders.filter(o => {
      if (matchFilter !== "ALL" && o.subject_match !== matchFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          o.email_subject.toLowerCase().includes(q) ||
          o.job_number.toLowerCase().includes(q) ||
          o.subject_job_numbers.toLowerCase().includes(q) ||
          o.collection_point.toLowerCase().includes(q) ||
          o.delivery_point.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [orders, matchFilter, search]);

  const stats = useMemo(() => {
    const total = orders.length;
    const match = orders.filter(o => o.subject_match === "MATCH").length;
    const mismatch = orders.filter(o => o.subject_match === "MISMATCH").length;
    const noSubject = orders.filter(o => o.subject_match === "NOT_IN_SUBJECT").length;
    const noPdf = orders.filter(o => o.subject_match === "NO_PDF_JOBS").length;
    // Match rate: out of jobs where there was a job number in the subject
    const eligible = match + mismatch;
    const matchRate = eligible > 0 ? Math.round((match / eligible) * 100) : 0;
    return { total, match, mismatch, noSubject, noPdf, matchRate };
  }, [orders]);

  const FILTERS: Array<{ label: string; value: SubjectMatch | "ALL" }> = [
    { label: "ALL",            value: "ALL" },
    { label: "MATCH",          value: "MATCH" },
    { label: "MISMATCH",       value: "MISMATCH" },
    { label: "NO SUBJECT JOB", value: "NOT_IN_SUBJECT" },
    { label: "NO PDF JOBS",    value: "NO_PDF_JOBS" },
  ];

  if (loading) return (
    <div className="flex items-center justify-center h-full text-slate-500 text-sm">Loading test results…</div>
  );
  if (error) return (
    <div className="flex items-center justify-center h-full text-red-400 text-sm">Error: {error}</div>
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Stats */}
      <div className="px-6 py-4 border-b border-slate-800 grid grid-cols-6 gap-3 shrink-0">
        <StatBox label="Total Tests" value={stats.total} />
        <StatBox label="Match" value={stats.match} colour="text-emerald-400" />
        <StatBox label="Mismatch" value={stats.mismatch} colour="text-red-400" />
        <StatBox label="No Subject Job" value={stats.noSubject} colour="text-amber-400" />
        <StatBox label="No PDF Jobs" value={stats.noPdf} colour="text-slate-400" />
        <StatBox
          label="Match Rate"
          value={stats.total === 0 ? "—" : `${stats.matchRate}%`}
          colour={stats.matchRate === 100 ? "text-emerald-400" : stats.matchRate >= 80 ? "text-amber-400" : "text-red-400"}
        />
      </div>

      {/* Explanation banner */}
      <div className="px-6 py-2 border-b border-slate-800 bg-slate-900/40 shrink-0">
        <p className="text-xs text-slate-500">
          Send test emails from <span className="text-slate-300 font-mono">georgespainwarner@gmail.com</span> to{" "}
          <span className="text-slate-300 font-mono">george.automates.ai@gmail.com</span> with a DS Smith PDF attached.
          Put the job numbers you want processed in the subject line (e.g. <span className="text-slate-300 font-mono">2612345 2612346</span>).
          The system processes <strong className="text-slate-300">only those jobs</strong> — MATCH means the job was found in the PDF,
          MISMATCH means a subject-listed job was missing from the PDF.
        </p>
      </div>

      {/* Controls */}
      <div className="px-6 py-3 border-b border-slate-800 flex items-center gap-3 shrink-0">
        <div className="flex gap-1">
          {FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setMatchFilter(f.value)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                matchFilter === f.value
                  ? "bg-slate-700 text-slate-100"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {f.label}
              {f.value !== "ALL" && (
                <span className="ml-1 text-slate-600">
                  ({f.value === "MATCH" ? stats.match
                    : f.value === "MISMATCH" ? stats.mismatch
                    : f.value === "NOT_IN_SUBJECT" ? stats.noSubject
                    : stats.noPdf})
                </span>
              )}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Search subject, job number, location…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="ml-auto bg-slate-900 border border-slate-700 rounded px-3 py-1 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-slate-500 w-72"
        />
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-slate-600 text-sm">
            {orders.length === 0
              ? "No test emails processed yet. Send a test email to get started."
              : "No results match the current filter."}
          </div>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 bg-slate-950 border-b border-slate-800 z-10">
              <tr className="text-xs uppercase tracking-widest text-slate-500">
                <th className="px-4 py-2 text-left font-normal w-8">#</th>
                <th className="px-4 py-2 text-left font-normal">Email subject</th>
                <th className="px-4 py-2 text-left font-normal">Subject job</th>
                <th className="px-4 py-2 text-left font-normal">PDF job</th>
                <th className="px-4 py-2 text-left font-normal">Result</th>
                <th className="px-4 py-2 text-left font-normal">Collection</th>
                <th className="px-4 py-2 text-left font-normal">Delivery</th>
                <th className="px-4 py-2 text-left font-normal">Price</th>
                <th className="px-4 py-2 text-left font-normal">Score</th>
                <th className="px-4 py-2 text-left font-normal">Method</th>
                <th className="px-4 py-2 text-left font-normal">Received</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o, i) => (
                <tr
                  key={o.id}
                  className={`border-l-2 border-b border-slate-800/60 hover:bg-slate-900/40 transition-colors ${MATCH_BORDER[o.subject_match as SubjectMatch] ?? "border-l-slate-700"}`}
                >
                  <td className="px-4 py-3 text-slate-600 text-xs">{i + 1}</td>
                  <td className="px-4 py-3 text-slate-300 max-w-xs truncate" title={o.email_subject}>
                    {o.email_subject || <span className="text-slate-600">—</span>}
                  </td>
                  <td className="px-4 py-3 font-mono">
                    {o.subject_job_numbers
                      ? o.subject_job_numbers.split(",").map(j => (
                          <span key={j} className="text-sky-300 mr-1">{j.trim()}</span>
                        ))
                      : <span className="text-slate-600 text-xs">none</span>
                    }
                  </td>
                  <td className="px-4 py-3 font-mono">
                    {o.pdf_job_numbers
                      ? o.pdf_job_numbers.split(",").map(j => (
                          <span
                            key={j}
                            className={
                              o.subject_job_numbers?.split(",").map(s => s.trim()).includes(j.trim())
                                ? "text-emerald-300 mr-1"
                                : "text-slate-400 mr-1"
                            }
                          >
                            {j.trim()}
                          </span>
                        ))
                      : <span className="text-slate-600 text-xs">none</span>
                    }
                  </td>
                  <td className="px-4 py-3">
                    <MatchBadge value={o.subject_match as SubjectMatch} />
                  </td>
                  <td className="px-4 py-3 text-slate-300 text-xs max-w-[180px] truncate" title={o.collection_point}>
                    {o.collection_point || <span className="text-slate-600">—</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-300 text-xs max-w-[180px] truncate" title={o.delivery_point}>
                    {o.delivery_point || <span className="text-slate-600">—</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-300 text-xs whitespace-nowrap">
                    {o.price || <span className="text-slate-600">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs whitespace-nowrap">
                    {o.composite_score != null ? (
                      <span className={CONF_COLOUR[o.confidence_status] ?? "text-slate-400"}>
                        {o.composite_score} <span className="text-slate-600">({o.confidence_status})</span>
                      </span>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <ExtractionBadge method={o.extraction_method} />
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                    {formatDate(o.email_received_at || o.processed_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
