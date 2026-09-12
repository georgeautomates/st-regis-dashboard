"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ManifestReviewEmail } from "@/lib/db";

const ACTION_COLOURS: Record<string, string> = {
  Add:    "bg-sky-900/50 text-sky-300 border border-sky-700/50",
  Update: "bg-amber-900/50 text-amber-300 border border-amber-700/50",
  Cancel: "bg-red-900/50 text-red-300 border border-red-700/50",
  Ignore: "bg-slate-800 text-slate-400 border border-slate-700",
};

function ActionBadge({ action }: { action: string }) {
  if (!action) return <span className="text-xs text-slate-600">—</span>;
  return (
    <span className={`text-xs px-2 py-0.5 rounded font-medium ${ACTION_COLOURS[action] ?? "bg-slate-800 text-slate-400 border border-slate-700"}`}>
      {action}
    </span>
  );
}

function ManifestCard({ manifest }: { manifest: ManifestReviewEmail }) {
  const counts = manifest.jobs.reduce<Record<string, number>>((acc, j) => {
    const key = j.suggested_action || "Unclassified";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <Link
      href={`/manifest-review/${encodeURIComponent(manifest.message_id)}`}
      className="block bg-slate-900 border border-slate-800 rounded px-5 py-4 hover:border-slate-600 transition-colors"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm text-slate-200 truncate" title={manifest.subject}>
            {manifest.subject || <span className="text-slate-600 italic">No subject</span>}
          </div>
          <div className="text-xs text-slate-600 mt-1">
            {manifest.email_received_at
              ? new Date(manifest.email_received_at).toLocaleString("en-GB")
              : new Date(manifest.processed_at).toLocaleString("en-GB")}
            <span className="mx-2 text-slate-700">·</span>
            {manifest.jobs.length} order{manifest.jobs.length !== 1 ? "s" : ""}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {manifest.pending_count > 0 && (
            <span className="text-xs px-2 py-0.5 rounded font-bold bg-violet-900/50 text-violet-300 border border-violet-700/50">
              {manifest.pending_count} to review
            </span>
          )}
        </div>
      </div>
      <div className="flex gap-2 mt-3 flex-wrap">
        {Object.entries(counts).map(([action, n]) => (
          <span key={action} className="text-xs text-slate-500">
            <ActionBadge action={action === "Unclassified" ? "" : action} /> <span className="ml-1">×{n}</span>
          </span>
        ))}
      </div>
    </Link>
  );
}

export default function ManifestReviewListPage() {
  const [manifests, setManifests] = useState<ManifestReviewEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/manifest-reviews")
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error);
        setManifests(d.manifests ?? []);
        setLoading(false);
      })
      .catch(e => { setError(String(e)); setLoading(false); });
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-full text-slate-500 text-sm">Loading manifests…</div>
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-800 shrink-0">
        <div className="text-xs uppercase tracking-widest text-slate-500 mb-1">DS Smith</div>
        <div className="text-lg font-bold text-slate-100">Manifest Review</div>
        <p className="text-xs text-slate-500 mt-1 max-w-2xl">
          Every order extracted from a DS Smith manifest, with a suggested action based on what&rsquo;s
          already on file. Confirm or override each one, then submit.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        {error && (
          <div className="mb-4 px-3 py-2 rounded text-xs text-red-300 bg-red-950/40 border border-red-800">{error}</div>
        )}
        {manifests.length === 0 && !error ? (
          <div className="text-sm text-slate-500 py-16 text-center">
            No manifests awaiting review.
          </div>
        ) : (
          <div className="space-y-3 max-w-3xl">
            {manifests.map(m => <ManifestCard key={m.message_id} manifest={m} />)}
          </div>
        )}
      </div>
    </div>
  );
}
