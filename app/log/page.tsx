"use client";

import { useEffect, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

type Run = {
  id: number;
  run_at: string;
  message_id: string;
  email_subject: string;
  client_name: string;
  status: "SUCCESS" | "PARTIAL" | "FAILED";
  job_count: number;
  jobs_written: number;
  jobs_skipped: number;
  jobs_failed: number;
  duration_ms: number | null;
  error: string | null;
  steps?: Step[];
};

type Step = {
  name: string;
  status: "ok" | "error" | "skip";
  output: Record<string, unknown>;
  ts: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_COLOURS: Record<string, string> = {
  SUCCESS: "bg-emerald-950/60 border-emerald-700/60 text-emerald-300",
  PARTIAL: "bg-amber-950/60 border-amber-700/60 text-amber-300",
  FAILED:  "bg-red-950/60 border-red-700/60 text-red-300",
};

const STEP_CHIP_COLOURS: Record<string, string> = {
  ok:    "bg-emerald-950/60 border-emerald-700/60 text-emerald-300 hover:border-emerald-500",
  error: "bg-red-950/60 border-red-700/60 text-red-300 hover:border-red-500",
  skip:  "bg-slate-800 border-slate-700 text-slate-500 hover:border-slate-500",
};

const STEP_CHIP_ACTIVE: Record<string, string> = {
  ok:    "ring-2 ring-emerald-500",
  error: "ring-2 ring-red-500",
  skip:  "ring-2 ring-slate-500",
};

function fmt(ms: number | null) {
  if (!ms) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function fmtTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch { return iso; }
}

// ── Step output renderer ──────────────────────────────────────────────────────

function OutputPanel({ step }: { step: Step }) {
  const entries = Object.entries(step.output);
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs uppercase tracking-widest text-slate-500">{step.name}</span>
        <span className={`text-xs px-2 py-0.5 rounded border font-bold ${STEP_CHIP_COLOURS[step.status]}`}>
          {step.status.toUpperCase()}
        </span>
        <span className="text-xs text-slate-600 ml-auto">{fmtTime(step.ts)}</span>
      </div>

      <div className="space-y-1.5">
        {entries.map(([k, v]) => {
          const isEmpty = v === "" || v === null || v === undefined ||
            (Array.isArray(v) && v.length === 0);
          return (
            <div key={k} className={`rounded px-3 py-2 border ${isEmpty ? "border-slate-800 bg-slate-900/40" : "border-slate-700 bg-slate-900"}`}>
              <div className="text-xs uppercase tracking-widest text-slate-500 mb-0.5">{k.replace(/_/g, " ")}</div>
              <div className={`font-mono text-sm break-all ${isEmpty ? "text-slate-700 italic" : "text-slate-100"}`}>
                {isEmpty ? "—" : Array.isArray(v) ? (
                  v.length === 0 ? "—" :
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {(v as string[]).map((item, i) => (
                      <span key={i} className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-xs">{String(item)}</span>
                    ))}
                  </div>
                ) : typeof v === "boolean" ? (
                  <span className={v ? "text-emerald-400" : "text-red-400"}>{v ? "true" : "false"}</span>
                ) : String(v)}
              </div>
            </div>
          );
        })}
      </div>

      {entries.length === 0 && (
        <div className="text-slate-600 text-sm italic">No output recorded for this step.</div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SystemLogPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRun, setSelectedRun] = useState<Run | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [selectedStep, setSelectedStep] = useState<Step | null>(null);

  useEffect(() => {
    fetch("/api/runs")
      .then(r => r.json())
      .then(d => { setRuns(d.runs ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function selectRun(run: Run) {
    setSelectedStep(null);
    if (run.steps) { setSelectedRun(run); return; }
    setLoadingDetail(true);
    const d = await fetch(`/api/runs/${run.id}`).then(r => r.json());
    const full: Run = { ...run, steps: d.run?.steps ?? [] };
    setRuns(prev => prev.map(r => r.id === run.id ? full : r));
    setSelectedRun(full);
    setLoadingDetail(false);
    if (full.steps && full.steps.length > 0) setSelectedStep(full.steps[0]);
  }

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Left panel: Execution Log ── */}
      <div className="w-72 shrink-0 border-r border-slate-800 flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 shrink-0">
          <div className="text-xs uppercase tracking-widest text-slate-500">Execution Log</div>
          <div className="text-xs text-slate-600 mt-0.5">{runs.length} runs</div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="text-slate-600 text-sm text-center py-8">Loading…</div>
          )}
          {!loading && runs.length === 0 && (
            <div className="text-slate-600 text-sm text-center py-8">No runs yet.<br/>Runs appear after the next email is processed.</div>
          )}
          {runs.map(run => (
            <button
              key={run.id}
              onClick={() => selectRun(run)}
              className={`w-full text-left px-4 py-3 border-b border-slate-800/60 hover:bg-slate-900/60 transition-colors ${
                selectedRun?.id === run.id ? "bg-slate-800/80 border-l-2 border-l-slate-500" : "border-l-2 border-l-transparent"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-400 font-mono">
                  {fmtTime(run.run_at)}
                </span>
                <span className={`text-xs px-1.5 py-0.5 rounded border font-bold ${STATUS_COLOURS[run.status] ?? STATUS_COLOURS.FAILED}`}>
                  {run.status}
                </span>
              </div>
              <div className="text-xs text-slate-300 truncate" title={run.email_subject}>
                {run.email_subject || <span className="text-slate-600 italic">No subject</span>}
              </div>
              <div className="flex items-center gap-2 mt-1 text-xs text-slate-600">
                <span>{run.job_count} job{run.job_count !== 1 ? "s" : ""}</span>
                {run.jobs_written > 0 && <span className="text-emerald-600">✓{run.jobs_written}</span>}
                {run.jobs_failed  > 0 && <span className="text-red-600">✗{run.jobs_failed}</span>}
                {run.jobs_skipped > 0 && <span className="text-slate-500">↷{run.jobs_skipped}</span>}
                <span className="ml-auto">{fmt(run.duration_ms)}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Right panel: Detailed Execution View ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!selectedRun && (
          <div className="flex items-center justify-center h-full text-slate-600 text-sm">
            Select a run from the left to inspect it
          </div>
        )}
        {loadingDetail && (
          <div className="flex items-center justify-center h-full text-slate-500 text-sm">Loading run detail…</div>
        )}
        {selectedRun && !loadingDetail && (
          <>
            {/* Run header */}
            <div className="px-6 py-3 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-3 mb-1">
                <span className={`text-xs px-2 py-0.5 rounded border font-bold ${STATUS_COLOURS[selectedRun.status]}`}>
                  {selectedRun.status}
                </span>
                <span className="text-xs text-slate-500 font-mono">{fmtTime(selectedRun.run_at)}</span>
                <span className="text-xs text-slate-600">{fmt(selectedRun.duration_ms)}</span>
              </div>
              <div className="text-sm text-slate-300 truncate">{selectedRun.email_subject}</div>
              <div className="text-xs text-slate-600 mt-0.5 font-mono">{selectedRun.message_id}</div>
              {selectedRun.error && (
                <div className="mt-2 px-3 py-1.5 rounded border border-red-800 bg-red-950/40 text-xs text-red-300 font-mono">
                  {selectedRun.error}
                </div>
              )}
            </div>

            {/* Pipeline step chips */}
            <div className="px-6 py-3 border-b border-slate-800 shrink-0">
              <div className="text-xs uppercase tracking-widest text-slate-600 mb-2">Pipeline Steps</div>
              <div className="flex items-center gap-2 flex-wrap">
                {(selectedRun.steps ?? []).map((step, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedStep(step)}
                    className={`px-3 py-1.5 rounded border text-xs font-medium transition-all ${STEP_CHIP_COLOURS[step.status]} ${
                      selectedStep === step ? STEP_CHIP_ACTIVE[step.status] : ""
                    }`}
                  >
                    {step.name}
                    {step.status === "error" && <span className="ml-1">✗</span>}
                    {step.status === "skip"  && <span className="ml-1 opacity-50">↷</span>}
                  </button>
                ))}
                {(!selectedRun.steps || selectedRun.steps.length === 0) && (
                  <span className="text-slate-600 text-xs italic">No steps recorded</span>
                )}
              </div>
            </div>

            {/* Step output */}
            <div className="flex-1 overflow-hidden px-6 py-4">
              {selectedStep ? (
                <OutputPanel step={selectedStep} />
              ) : (
                <div className="text-slate-600 text-sm">Select a step above to see its output</div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
