"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import type { ManifestReviewEmail, ManifestReviewJob, ManifestAction } from "@/lib/db";

const ACTIONS: ManifestAction[] = ["Add", "Update", "Cancel", "Ignore"];

const ACTION_STYLES: Record<ManifestAction, { active: string; idle: string }> = {
  Add:    { active: "bg-sky-700 text-white border-sky-700",       idle: "border-slate-700 text-slate-400 hover:text-sky-300 hover:border-sky-700/60" },
  Update: { active: "bg-amber-700 text-white border-amber-700",   idle: "border-slate-700 text-slate-400 hover:text-amber-300 hover:border-amber-700/60" },
  Cancel: { active: "bg-red-700 text-white border-red-700",       idle: "border-slate-700 text-slate-400 hover:text-red-300 hover:border-red-700/60" },
  Ignore: { active: "bg-slate-600 text-white border-slate-600",   idle: "border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500" },
};

function FieldRow({ label, value, changed }: { label: string; value: string; changed?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 py-1 px-2 rounded ${changed ? "bg-amber-950/30" : ""}`}>
      <span className="text-xs text-slate-500 shrink-0">{label}</span>
      <span className={`text-xs font-mono text-right truncate ${changed ? "text-amber-200 font-medium" : "text-slate-200"}`}>
        {value || <span className="text-slate-600">—</span>}
      </span>
    </div>
  );
}

function ActionPicker({
  job,
  onDecide,
  saving,
}: {
  job: ManifestReviewJob;
  onDecide: (jobNumber: string, action: ManifestAction, source: "suggested" | "override") => void;
  saving: boolean;
}) {
  const current = job.review_action;
  return (
    <div className="flex gap-1.5 flex-wrap">
      {ACTIONS.map(action => {
        const isCurrent = current === action;
        const isSuggested = job.suggested_action === action;
        const style = ACTION_STYLES[action];
        return (
          <button
            key={action}
            disabled={saving}
            onClick={() => onDecide(job.job_number, action, isSuggested ? "suggested" : "override")}
            className={`text-xs font-bold px-3 py-1.5 rounded border transition-colors disabled:opacity-40 ${
              isCurrent ? style.active : style.idle
            }`}
            title={isSuggested ? "System-suggested action" : undefined}
          >
            {action}
            {isSuggested && !isCurrent && <span className="ml-1 opacity-60">•</span>}
          </button>
        );
      })}
    </div>
  );
}

function JobRow({
  job,
  onDecide,
  saving,
}: {
  job: ManifestReviewJob;
  onDecide: (jobNumber: string, action: ManifestAction, source: "suggested" | "override") => void;
  saving: string | null;
}) {
  const changedFields = new Set(
    job.suggested_action === "Update"
      ? (job.suggested_reason.match(/differs on: (.+)$/)?.[1] ?? "").split(",").map(s => s.trim())
      : []
  );

  return (
    <div className={`border rounded overflow-hidden ${job.review_action ? "border-slate-800" : "border-slate-700"}`}>
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-mono text-sm font-bold text-slate-100 shrink-0">{job.job_number}</span>
          {job.client_name === "St Regis Reels" && (
            <span className="text-xs font-bold text-purple-300 border border-purple-700/60 bg-purple-950/40 px-1.5 py-0.5 shrink-0">Reels</span>
          )}
          {job.client_name === "St Regis Fibre A/C" && (
            <span className="text-xs font-bold text-emerald-300 border border-emerald-700/60 bg-emerald-950/40 px-1.5 py-0.5 shrink-0">Fibre</span>
          )}
          {job.suggested_reason && (
            <span className="text-xs text-slate-500 truncate" title={job.suggested_reason}>{job.suggested_reason}</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-4 px-4 py-3">
        <div className="grid grid-cols-2 gap-x-4 min-w-0">
          <FieldRow label="Collection" value={job.collection_point} changed={changedFields.has("collection_point")} />
          <FieldRow label="Delivery" value={job.delivery_point} changed={changedFields.has("delivery_point")} />
          <FieldRow label="Collection date" value={`${job.collection_date} ${job.collection_time}`.trim()} changed={changedFields.has("collection_date") || changedFields.has("collection_time")} />
          <FieldRow label="Delivery date" value={`${job.delivery_date} ${job.delivery_time}`.trim()} changed={changedFields.has("delivery_date") || changedFields.has("delivery_time")} />
          <FieldRow label="Price" value={job.price} changed={changedFields.has("price")} />
          <FieldRow label="Order number" value={job.order_number} />
        </div>
        <div className="flex flex-col items-end justify-center gap-2 shrink-0">
          <ActionPicker job={job} onDecide={onDecide} saving={saving === job.job_number} />
        </div>
      </div>
    </div>
  );
}

function ManifestReviewInner({ messageId }: { messageId: string }) {
  const router = useRouter();
  const [manifest, setManifest] = useState<ManifestReviewEmail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [reviewerName, setReviewerName] = useState("");

  useEffect(() => {
    fetch(`/api/manifest-reviews/${encodeURIComponent(messageId)}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error);
        setManifest(d.manifest ?? null);
        setLoading(false);
      })
      .catch(e => { setError(String(e)); setLoading(false); });
  }, [messageId]);

  async function handleDecide(jobNumber: string, action: ManifestAction, source: "suggested" | "override") {
    setSaving(jobNumber);
    try {
      const res = await fetch("/api/manifest-reviews/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_number: jobNumber, action, source, reviewed_by: reviewerName }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to save");
      setManifest(prev => prev ? {
        ...prev,
        jobs: prev.jobs.map(j => j.job_number === jobNumber ? { ...j, review_action: action, review_action_source: source } : j),
        pending_count: prev.jobs.filter(j => j.job_number !== jobNumber && !j.review_action).length,
      } : prev);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(null);
    }
  }

  function acceptAllSuggested() {
    if (!manifest) return;
    manifest.jobs.forEach(j => {
      if (!j.review_action && j.suggested_action) {
        handleDecide(j.job_number, j.suggested_action, "suggested");
      }
    });
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full text-slate-500 text-sm">Loading…</div>
  );
  if (error || !manifest) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <span className="text-sm text-red-400">{error || "Manifest not found"}</span>
        <button onClick={() => router.push("/manifest-review")} className="text-xs text-slate-500 hover:text-slate-300">← Back to manifests</button>
      </div>
    );
  }

  const remaining = manifest.jobs.filter(j => !j.review_action).length;
  const pdfUrl = manifest.jobs.find(j => j.pdf_url)?.pdf_url;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-6 py-3 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3 mb-1">
          <button onClick={() => router.push("/manifest-review")} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">← Back</button>
          <span className="text-slate-700">/</span>
          <span className="font-mono text-xs text-slate-500">{manifest.message_id}</span>
        </div>
        <div className="text-sm text-slate-300 truncate" title={manifest.subject}>
          {manifest.subject || <span className="text-slate-600 italic">No subject</span>}
        </div>
        <div className="text-xs text-slate-600 mt-0.5">
          {manifest.jobs.length} order{manifest.jobs.length !== 1 ? "s" : ""}
          {remaining > 0 && <span className="ml-2 text-violet-400">{remaining} still to review</span>}
        </div>
      </div>

      <div className="px-6 py-2.5 border-b border-slate-800 flex items-center gap-3 shrink-0">
        <input
          placeholder="Your name"
          value={reviewerName}
          onChange={e => setReviewerName(e.target.value)}
          className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs text-slate-200 placeholder-slate-600 focus:outline-none w-36"
        />
        <button
          onClick={acceptAllSuggested}
          disabled={remaining === 0}
          className="text-xs font-semibold px-3 py-1.5 rounded bg-slate-800 text-slate-300 border border-slate-700 hover:border-slate-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Accept all suggested
        </button>
        <span className="text-xs text-slate-600">Click a job&rsquo;s action to confirm or override it individually.</span>
      </div>

      <div className="flex-1 overflow-hidden flex gap-4 px-6 py-4">
        {pdfUrl && (
          <div className="w-72 shrink-0 border border-slate-800 rounded overflow-hidden">
            <iframe src={pdfUrl.replace("/view", "/preview")} className="w-full h-full" title="Booking form PDF" />
          </div>
        )}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {manifest.jobs.map(job => (
            <JobRow key={job.job_number} job={job} onDecide={handleDecide} saving={saving} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ManifestReviewDetailPage({ params }: { params: Promise<{ messageId: string }> }) {
  const { messageId } = use(params);
  return <ManifestReviewInner messageId={messageId} />;
}
