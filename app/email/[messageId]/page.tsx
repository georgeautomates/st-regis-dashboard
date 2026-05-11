"use client";

import { useEffect, useState, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import type { Email, Job, ManualReview } from "@/lib/sheets";

// ── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORY_COLOURS: Record<string, string> = {
  "New Order":    "bg-sky-900/50 text-sky-300 border border-sky-700/50",
  "Amendment":    "bg-amber-900/50 text-amber-300 border border-amber-700/50",
  "Cancellation": "bg-red-900/50 text-red-300 border border-red-700/50",
  "Unknown":      "bg-slate-800 text-slate-400 border border-slate-700",
};

const STATUS_COLOURS: Record<string, string> = {
  MATCH:    "text-emerald-400",
  PARTIAL:  "text-amber-400",
  MISMATCH: "text-red-400",
  UNKNOWN:  "text-slate-500",
};

function normVal(v: string) {
  return v.trim().toLowerCase().replace(/^(\d):/, "0$1:").replace(/^£/, "").replace(/\.00$/, "");
}

function liveMatch(a: string, b: string) {
  return !a || !b || normVal(a) === normVal(b);
}

function splitDT(dateVal: string, timeVal: string): [string, string] {
  const m = dateVal.match(/^(\d{2}\/\d{2}\/\d{2,4})\s+(\d{2}:\d{2})$/);
  return m ? [m[1], m[2]] : [dateVal, timeVal];
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Field({ label, our, proteo }: { label: string; our: string; proteo?: string }) {
  const mismatch = proteo !== undefined && !liveMatch(our, proteo);
  return (
    <div className={`mb-2 p-2 rounded ${mismatch ? "bg-red-950/40 border border-red-800/50" : "border border-transparent"}`}>
      <div className={`text-xs uppercase tracking-widest mb-0.5 ${mismatch ? "text-red-400" : "text-slate-500"}`}>
        {label}{mismatch && <span className="ml-2 text-red-500 font-bold">✗</span>}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className={`font-mono text-sm font-medium ${mismatch ? "text-red-200" : "text-slate-100"}`}>
          {our || <span className="text-slate-600">—</span>}
        </div>
        {proteo !== undefined && (
          <div className={`font-mono text-sm ${mismatch ? "text-red-300" : "text-slate-400"}`}>
            {proteo || <span className="text-slate-600">—</span>}
          </div>
        )}
      </div>
    </div>
  );
}

const FAIL_REASONS = [
  "Incorrect collection/delivery locations",
  "Model mismatch",
  "Order number mismatch",
  "Price mismatch",
  "Subject line / body mismatch",
  "Date / time mismatch",
  "Other",
];

function ManualReviewPanel({ job, existing, onSaved }: {
  job: Job;
  existing?: ManualReview;
  onSaved: (r: ManualReview) => void;
}) {
  const [verdict, setVerdict] = useState<"PASS" | "FAIL" | "">(
    existing?.verdict === "PASS" || existing?.verdict === "FAIL" ? existing.verdict : ""
  );
  const [reason, setReason] = useState(existing?.reason ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [reviewer, setReviewer] = useState(existing?.reviewed_by ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(!!existing);

  const canSave = !!verdict && !!reviewer && (verdict === "PASS" || !!reason);

  async function handleSave() {
    setSaving(true);
    const review = { job_number: job.job_number, verdict, reason, notes, reviewed_by: reviewer };
    await fetch("/api/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(review),
    });
    setSaving(false);
    setSaved(true);
    onSaved({ ...review, reviewed_at: new Date().toISOString() } as ManualReview);
  }

  return (
    <div className="mt-4 pt-4 border-t border-slate-700">
      <div className="text-xs uppercase tracking-widest text-slate-500 mb-3">Manual Review</div>

      {saved && existing && (
        <div className={`mb-3 px-3 py-2 rounded text-xs font-medium border ${
          existing.verdict === "PASS" ? "bg-emerald-950/40 border-emerald-800 text-emerald-300"
          : "bg-red-950/40 border-red-800 text-red-300"
        }`}>
          {existing.verdict} · {existing.reason || "No reason"} · {existing.reviewed_by}
        </div>
      )}

      <div className="flex gap-2 mb-3">
        <button onClick={() => { setVerdict("PASS"); setSaved(false); }}
          className={`flex-1 py-1.5 rounded text-xs font-bold transition-colors ${
            verdict === "PASS" ? "bg-emerald-700 text-white" : "bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700"
          }`}>✓ PASS</button>
        <button onClick={() => { setVerdict("FAIL"); setSaved(false); }}
          className={`flex-1 py-1.5 rounded text-xs font-bold transition-colors ${
            verdict === "FAIL" ? "bg-red-700 text-white" : "bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700"
          }`}>✗ FAIL</button>
      </div>

      {verdict === "FAIL" && (
        <select value={reason} onChange={e => setReason(e.target.value)}
          className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-sm text-slate-200 mb-2 focus:outline-none">
          <option value="">Select reason…</option>
          {FAIL_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      )}

      <textarea
        placeholder="Additional notes (optional)"
        value={notes}
        onChange={e => setNotes(e.target.value)}
        rows={2}
        className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none resize-none mb-2"
      />

      <input
        placeholder="Reviewer name"
        value={reviewer}
        onChange={e => setReviewer(e.target.value)}
        className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none mb-3"
      />

      <button onClick={handleSave} disabled={!canSave || saving}
        className="w-full py-1.5 rounded text-xs font-bold bg-slate-700 text-white hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
        {saving ? "Saving…" : "Save Review"}
      </button>
    </div>
  );
}

function EmailCoherencePanel({ job }: { job: Job }) {
  const subject = job.email_subject;
  const body = job.email_body?.slice(0, 500);

  if (!subject && !body) return null;

  // Simple coherence checks
  const checks: { label: string; pass: boolean; note: string }[] = [];

  // Order number in subject?
  const orderNum = job.order_number.replace(/^PO-/, "");
  if (orderNum && subject) {
    const inSubject = subject.includes(orderNum);
    checks.push({
      label: "Order number in subject",
      pass: inSubject,
      note: inSubject ? `Found "${orderNum}"` : `"${orderNum}" not found in subject`,
    });
  }

  // Spot check result
  if (job.spot_result) {
    checks.push({
      label: "Automated spot check",
      pass: job.spot_result === "PASS",
      note: job.spot_result === "PASS"
        ? `PASS (${job.spot_confidence})`
        : job.spot_result === "FLAG"
        ? `FLAG — ${job.spot_reason}`
        : `SKIP — ${job.spot_reason || "not checkable"}`,
    });
  }

  // Model agreement
  if (job.model_agreement_score) {
    const score = parseInt(job.model_agreement_score);
    checks.push({
      label: "Model agreement",
      pass: score >= 80,
      note: `${score}% agreement between gpt-4o and gpt-4o-mini`,
    });
  }

  const allPass = checks.every(c => c.pass);
  const anyFail = checks.some(c => !c.pass);

  return (
    <div className="mt-4 pt-4 border-t border-slate-700">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs uppercase tracking-widest text-slate-500">Email Coherence</span>
        {checks.length > 0 && (
          <span className={`text-xs px-2 py-0.5 rounded font-bold border ${
            allPass ? "bg-emerald-950/40 border-emerald-800 text-emerald-300"
            : anyFail ? "bg-red-950/40 border-red-800 text-red-300"
            : "bg-slate-800 border-slate-700 text-slate-400"
          }`}>
            {allPass ? "COHERENT" : anyFail ? "ISSUES FOUND" : "PARTIAL"}
          </span>
        )}
      </div>

      {checks.map((c, i) => (
        <div key={i} className="flex items-start gap-2 mb-1.5 text-xs">
          <span className={c.pass ? "text-emerald-400 mt-0.5" : "text-red-400 mt-0.5"}>
            {c.pass ? "✓" : "✗"}
          </span>
          <div>
            <span className="text-slate-400">{c.label}</span>
            <span className="text-slate-600 ml-2">{c.note}</span>
          </div>
        </div>
      ))}

      {subject && (
        <div className="mt-3">
          <div className="text-xs uppercase tracking-widest text-slate-600 mb-1">Subject</div>
          <div className="text-xs text-slate-400 bg-slate-900 rounded px-3 py-2 break-all">{subject}</div>
        </div>
      )}
      {body && (
        <div className="mt-2">
          <div className="text-xs uppercase tracking-widest text-slate-600 mb-1">Body (preview)</div>
          <div className="text-xs text-slate-500 bg-slate-900 rounded px-3 py-2 whitespace-pre-wrap break-words max-h-32 overflow-y-auto">{body}</div>
        </div>
      )}
    </div>
  );
}

function JobView({ job, review, onReviewSaved }: {
  job: Job;
  review?: ManualReview;
  onReviewSaved: (r: ManualReview) => void;
}) {
  const [pColDate, pColTime] = splitDT(job.proteo_collection_date, job.proteo_collection_time);
  const [pDelDate, pDelTime] = splitDT(job.proteo_delivery_date, job.proteo_delivery_time);

  const hasProteo = !!job.proteo_collection;

  return (
    <div className="flex gap-4 h-full overflow-hidden">

      {/* PDF */}
      {job.pdf_url && (
        <div className="w-64 shrink-0 border border-slate-800 rounded overflow-hidden">
          <iframe src={job.pdf_url.replace("/view", "/preview")} className="w-full h-full" title="Booking form PDF" />
        </div>
      )}

      {/* Extraction vs Proteo */}
      <div className="flex-1 overflow-y-auto space-y-1 pr-2">

        {/* Column headers if Proteo data exists */}
        {hasProteo && (
          <div className="grid grid-cols-2 gap-2 mb-3 px-2">
            <div className="text-xs uppercase tracking-widest text-pink-500">Our Extraction</div>
            <div className="text-xs uppercase tracking-widest text-emerald-500">Proteo — Real Order</div>
          </div>
        )}

        <Field label="Job Number" our={job.job_number} />
        <Field label="Collection Point" our={job.collection_point} proteo={hasProteo ? job.proteo_collection : undefined} />
        <Field label="Delivery Point"   our={job.delivery_point}   proteo={hasProteo ? job.proteo_delivery : undefined} />
        <Field label="Price"            our={job.price}            proteo={hasProteo ? job.proteo_price : undefined} />
        <Field label="Order Number"     our={job.order_number}     proteo={hasProteo ? job.proteo_order_number : undefined} />

        <div className="grid grid-cols-2 gap-2">
          <Field label="Business Type" our={job.business_type} proteo={hasProteo ? job.proteo_business_type : undefined} />
          <Field label="Service"       our={job.service}       proteo={hasProteo ? job.proteo_service : undefined} />
        </div>
        <Field label="Goods Type" our={job.goods_type} proteo={hasProteo ? job.proteo_goods_type : undefined} />
        <div className="grid grid-cols-3 gap-2">
          <Field label="Pallets" our={job.pallets} proteo={hasProteo ? job.proteo_pallets : undefined} />
          <Field label="Spaces"  our={job.spaces}  proteo={hasProteo ? job.proteo_spaces : undefined} />
          <Field label="Weight"  our={job.weight}  proteo={hasProteo ? job.proteo_weight : undefined} />
        </div>

        <div className="mt-2 pt-2 border-t border-slate-800">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Collection Date" our={job.collection_date} proteo={hasProteo ? pColDate : undefined} />
            <Field label="Collection Time" our={job.collection_time} proteo={hasProteo ? pColTime : undefined} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Delivery Date" our={job.delivery_date} proteo={hasProteo ? pDelDate : undefined} />
            <Field label="Delivery Time" our={job.delivery_time} proteo={hasProteo ? pDelTime : undefined} />
          </div>
        </div>

        {(job.booking_window || job.traffic_note || job.work_type || job.customer_ref) && (
          <div className="mt-2 pt-2 border-t border-slate-800 grid grid-cols-2 gap-2">
            {job.booking_window && <Field label="Booking Window" our={job.booking_window} />}
            {job.work_type && <Field label="Work Type" our={job.work_type} />}
            {job.traffic_note && <Field label="Traffic Note" our={job.traffic_note} />}
            {job.customer_ref && <Field label="Customer Ref" our={job.customer_ref} />}
          </div>
        )}

        {/* Confidence */}
        {job.status && (
          <div className={`mt-2 px-3 py-2 rounded text-xs font-bold border ${
            job.status === "GREEN" ? "bg-emerald-950/40 border-emerald-800 text-emerald-300"
            : job.status === "YELLOW" ? "bg-amber-950/40 border-amber-800 text-amber-300"
            : "bg-red-950/40 border-red-800 text-red-300"
          }`}>
            Confidence: {job.composite_score} — {job.status}
          </div>
        )}

        <EmailCoherencePanel job={job} />
        <ManualReviewPanel job={job} existing={review} onSaved={onReviewSaved} />
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

function EmailDetailInner({ messageId }: { messageId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState<Email | null>(null);
  const [reviews, setReviews] = useState<Record<string, ManualReview>>({});
  const [loading, setLoading] = useState(true);
  const [jobIndex, setJobIndex] = useState(0);

  useEffect(() => {
    const idx = parseInt(searchParams.get("job") ?? "0");
    setJobIndex(isNaN(idx) ? 0 : idx);
  }, [searchParams]);

  useEffect(() => {
    fetch("/api/emails")
      .then(r => r.json())
      .then(d => {
        const found = (d.emails as Email[]).find(e => e.message_id === messageId) ?? null;
        setEmail(found);
        setLoading(false);
      });
  }, [messageId]);

  if (loading) return <div className="flex items-center justify-center h-full text-slate-500 text-sm">Loading…</div>;
  if (!email) return <div className="flex items-center justify-center h-full text-red-400 text-sm">Email not found</div>;

  const job = email.jobs[jobIndex] ?? email.jobs[0];
  const totalJobs = email.jobs.length;

  function navigate(newIdx: number) {
    const url = `/email/${messageId}?job=${newIdx}`;
    router.push(url);
    setJobIndex(newIdx);
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Email header */}
      <div className="px-6 py-3 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3 mb-1">
          <button onClick={() => router.push("/")}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors">← Back</button>
          <span className="text-slate-700">/</span>
          <span className="font-mono text-xs text-slate-500">{email.message_id}</span>
          <span className={`text-xs px-2 py-0.5 rounded font-medium ml-1 ${CATEGORY_COLOURS[email.category]}`}>
            {email.category}
          </span>
          {email.job_count > 1 && (
            <span className="text-xs text-slate-500 ml-1">{email.job_count} orders from this email</span>
          )}
        </div>
        <div className="text-sm text-slate-300 truncate" title={email.subject}>
          {email.subject || <span className="text-slate-600 italic">No subject</span>}
        </div>
        <div className="text-xs text-slate-600 mt-0.5">
          {new Date(email.processed_at).toLocaleString("en-GB")}
          {email.fibre_count > 0 && email.reels_count > 0 && ` · ${email.fibre_count} Fibre / ${email.reels_count} Reels`}
        </div>
      </div>

      {/* Pagination — only shown for multi-job emails */}
      {totalJobs > 1 && (
        <div className="px-6 py-2 border-b border-slate-800 flex items-center gap-3 shrink-0">
          <button onClick={() => navigate(jobIndex - 1)} disabled={jobIndex === 0}
            className="text-xs text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed">‹ Prev</button>
          <span className="text-xs text-slate-400">
            Job <span className="text-slate-200 font-bold">{jobIndex + 1}</span> of {totalJobs}
            <span className="ml-2 text-slate-600">{job.job_number}</span>
            <span className={`ml-2 font-medium ${STATUS_COLOURS[job.match_status]}`}>{job.match_status}</span>
          </span>
          <button onClick={() => navigate(jobIndex + 1)} disabled={jobIndex === totalJobs - 1}
            className="text-xs text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed">Next ›</button>

          {/* Job number pills for quick navigation */}
          <div className="ml-4 flex gap-1 flex-wrap">
            {email.jobs.map((j, i) => (
              <button key={j.job_number} onClick={() => navigate(i)}
                className={`text-xs px-2 py-0.5 rounded font-mono transition-colors ${
                  i === jobIndex
                    ? "bg-slate-600 text-white"
                    : `${STATUS_COLOURS[j.match_status]} bg-slate-900 border border-slate-800 hover:border-slate-600`
                }`}>
                {j.job_number}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Job content */}
      <div className="flex-1 overflow-hidden px-6 py-4">
        <JobView
          job={job}
          review={reviews[job.job_number]}
          onReviewSaved={r => setReviews(prev => ({ ...prev, [r.job_number]: r }))}
        />
      </div>
    </div>
  );
}

export default function EmailDetailPage({ params }: { params: Promise<{ messageId: string }> }) {
  const { messageId } = use(params);
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-full text-slate-500 text-sm">Loading…</div>}>
      <EmailDetailInner messageId={messageId} />
    </Suspense>
  );
}
