"use client";

import { useEffect, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

type RpaRun = {
  id: number;
  run_at: string;
  job_number: string;
  client_name: string;
  status: "SUCCESS" | "PARTIAL" | "FAILED";
  success: boolean;
  failed_step: string | null;
  screenshot_url: string | null;
  order_found_on_list: boolean | null;
  duration_ms: number | null;
  error: string | null;
  steps?: RpaStep[];
  sqa_result?: SqaResult | null;
};

type RpaStep = {
  name: string;
  status: "ok" | "error";
  attempt: number;
  output: Record<string, unknown>;
  ts: string;
};

type SqaField = {
  field: string;
  rpa_value: string;
  truth_value: string | null;
  result: "MATCH" | "MISMATCH" | "MISSING" | "PRESENT";
};

type SqaResult = {
  status: "PASS" | "PARTIAL" | "FAIL" | "NO_PROTEO_DATA";
  run_at: string;
  match: number;
  mismatch: number;
  missing: number;
  present: number;
  has_proteo: boolean;
  fields: SqaField[];
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
};

const STEP_CHIP_ACTIVE: Record<string, string> = {
  ok:    "ring-2 ring-emerald-500",
  error: "ring-2 ring-red-500",
};

function driveEmbedUrl(url: string): string {
  // Drive blocks cross-origin <img> loads (CORP: same-site). Proxy through our
  // own API route which fetches server-side and serves without that restriction.
  const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return `/api/screenshot-proxy?id=${m[1]}`;
  return url;
}

function fmt(ms: number | null) {
  if (!ms) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function fmtTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-GB", {
      day: "2-digit", month: "2-digit", year: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
  } catch { return iso; }
}

// ── Step output panel ─────────────────────────────────────────────────────────

function StepOutputPanel({ step }: { step: RpaStep }) {
  const entries = Object.entries(step.output).filter(([, v]) => v !== "" && v !== null && v !== undefined);
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs uppercase tracking-widest text-slate-500">{step.name}</span>
        <span className={`text-xs px-2 py-0.5 rounded border font-bold ${STEP_CHIP_COLOURS[step.status]}`}>
          {step.status.toUpperCase()}
        </span>
        {step.attempt > 1 && (
          <span className="text-xs px-2 py-0.5 rounded border border-amber-700/60 bg-amber-950/40 text-amber-300">
            attempt {step.attempt}
          </span>
        )}
        <span className="text-xs text-slate-600 ml-auto">{fmtTime(step.ts)}</span>
      </div>

      {entries.length > 0 ? (
        <div className="space-y-1.5">
          {entries.map(([k, v]) => (
            <div key={k} className="rounded px-3 py-2 border border-slate-700 bg-slate-900">
              <div className="text-xs uppercase tracking-widest text-slate-500 mb-0.5">{k.replace(/_/g, " ")}</div>
              <div className="font-mono text-sm break-all text-slate-100">{String(v)}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-slate-600 text-sm italic">No output recorded for this step.</div>
      )}
    </div>
  );
}

// ── SQA panel ─────────────────────────────────────────────────────────────────

const SQA_STATUS_COLOURS: Record<string, string> = {
  PASS:           "bg-emerald-950/60 border-emerald-700/60 text-emerald-300",
  PARTIAL:        "bg-amber-950/60 border-amber-700/60 text-amber-300",
  FAIL:           "bg-red-950/60 border-red-700/60 text-red-300",
  NO_PROTEO_DATA: "bg-slate-800/60 border-slate-600/60 text-slate-400",
};

const FIELD_RESULT_COLOURS: Record<string, string> = {
  MATCH:   "text-emerald-400",
  MISMATCH:"text-red-400",
  MISSING: "text-slate-500",
  PRESENT: "text-sky-400",
};

const FIELD_RESULT_ICONS: Record<string, string> = {
  MATCH:   "✓",
  MISMATCH:"✗",
  MISSING: "—",
  PRESENT: "~",
};

function SqaPanel({ sqa }: { sqa: SqaResult | null | undefined }) {
  if (sqa === undefined) {
    return (
      <div className="border-t border-slate-800 px-6 py-4">
        <div className="text-xs uppercase tracking-widest text-slate-600 mb-3">SQA Check</div>
        <div className="text-slate-600 text-xs italic">Loading SQA data…</div>
      </div>
    );
  }

  if (sqa === null) {
    return (
      <div className="border-t border-slate-800 px-6 py-4">
        <div className="text-xs uppercase tracking-widest text-slate-600 mb-3">SQA Check</div>
        <div className="text-slate-600 text-xs italic">Not yet checked — runs nightly at 03:00</div>
      </div>
    );
  }

  const statusLabel = sqa.status === "NO_PROTEO_DATA" ? "NO PROTEO" : sqa.status;

  return (
    <div className="border-t border-slate-800 px-6 py-4 shrink-0">
      <div className="flex items-center gap-3 mb-3">
        <div className="text-xs uppercase tracking-widest text-slate-600">SQA Check</div>
        <span className={`text-xs px-2 py-0.5 rounded border font-bold ${SQA_STATUS_COLOURS[sqa.status] ?? SQA_STATUS_COLOURS.FAIL}`}>
          {statusLabel}
        </span>
        <span className="text-xs text-slate-500">
          {sqa.match}✓&nbsp; {sqa.mismatch}✗&nbsp; {sqa.missing}—&nbsp; {sqa.present ?? 0}~
        </span>
        <span className="ml-auto text-xs text-slate-600">{fmtTime(sqa.run_at)}</span>
      </div>

      {sqa.status === "NO_PROTEO_DATA" ? (
        <div className="text-slate-500 text-xs italic">No matching row in Verification sheet — order may not be in Proteo yet.</div>
      ) : (
        <div className="space-y-1.5">
          <div className="grid grid-cols-[180px_1fr_32px_1fr] gap-3 px-3 mb-1 text-xs text-slate-600 uppercase tracking-widest">
            <div>Field</div>
            <div>RPA filled</div>
            <div />
            <div>Ground truth</div>
          </div>
          {sqa.fields.map(f => (
            <div key={f.field} className={`grid grid-cols-[180px_1fr_32px_1fr] items-center gap-3 rounded px-3 py-2 border text-sm ${
              f.result === "MISMATCH" ? "border-red-800/60 bg-red-950/30"
              : f.result === "MISSING" ? "border-amber-900/40 bg-amber-950/20"
              : "border-slate-800 bg-slate-900/60"
            }`}>
              <div className="text-xs text-slate-500 uppercase tracking-widest">{f.field.replace(/_/g, " ")}</div>
              <div className={`font-mono ${f.result === "MISMATCH" ? "text-red-200" : "text-slate-200"}`}>
                {f.rpa_value || <span className="text-slate-600 italic text-xs">—</span>}
              </div>
              <div className={`text-center font-bold text-base ${FIELD_RESULT_COLOURS[f.result]}`}>
                {FIELD_RESULT_ICONS[f.result]}
              </div>
              <div className={`font-mono ${f.result === "MISMATCH" ? "text-red-300" : "text-slate-400"}`}>
                {f.result === "PRESENT"
                  ? <span className="text-slate-600 italic text-xs">presence only</span>
                  : (f.truth_value || <span className="text-slate-600 italic text-xs">—</span>)
                }
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function RpaLogPage() {
  const [runs, setRuns]               = useState<RpaRun[]>([]);
  const [loading, setLoading]         = useState(true);
  const [selectedRun, setSelectedRun] = useState<RpaRun | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [selectedStep, setSelectedStep]   = useState<RpaStep | null>(null);
  const [filter, setFilter] = useState<"ALL" | "SUCCESS" | "PARTIAL" | "FAILED">("ALL");

  useEffect(() => {
    fetch("/api/rpa-runs")
      .then(r => r.json())
      .then(d => { setRuns(d.runs ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function selectRun(run: RpaRun) {
    setSelectedStep(null);
    if (run.steps) { setSelectedRun(run); return; }
    setLoadingDetail(true);
    const d = await fetch(`/api/rpa-runs/${run.id}`).then(r => r.json());
    const full: RpaRun = {
      ...run,
      steps:      d.run?.steps ?? [],
      sqa_result: d.run?.sqa_result ?? null,
    };
    setRuns(prev => prev.map(r => r.id === run.id ? full : r));
    setSelectedRun(full);
    setLoadingDetail(false);
    if (full.steps && full.steps.length > 0) setSelectedStep(full.steps[0]);
  }

  const filteredRuns = filter === "ALL" ? runs : runs.filter(r => r.status === filter);

  const total    = runs.length;
  const success  = runs.filter(r => r.status === "SUCCESS").length;
  const partial  = runs.filter(r => r.status === "PARTIAL").length;
  const failed   = runs.filter(r => r.status === "FAILED").length;

  return (
    <div className="flex h-full overflow-hidden flex-col">

      {/* ── Stats bar ── */}
      <div className="border-b border-slate-800 px-6 py-2 shrink-0 flex items-center gap-6 text-xs">
        <span className="text-slate-500 uppercase tracking-widest">RPA Log</span>
        <span className="text-slate-400">{total} runs</span>
        <span className="text-emerald-400">✓ {success} success</span>
        {partial > 0 && <span className="text-amber-400">~ {partial} partial</span>}
        <span className="text-red-400">✗ {failed} failed</span>
        {total > 0 && (
          <span className="text-slate-500 ml-auto">
            {Math.round(success / total * 100)}% pass rate
          </span>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* ── Left panel: Run list ── */}
        <div className="w-80 shrink-0 border-r border-slate-800 flex flex-col overflow-hidden">

          {/* Filter tabs */}
          <div className="flex border-b border-slate-800 shrink-0">
            {(["ALL", "SUCCESS", "PARTIAL", "FAILED"] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex-1 py-2 text-xs font-medium transition-colors ${
                  filter === f
                    ? "text-slate-100 border-b-2 border-slate-400"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading && (
              <div className="text-slate-600 text-sm text-center py-8">Loading…</div>
            )}
            {!loading && filteredRuns.length === 0 && (
              <div className="text-slate-600 text-sm text-center py-8">
                No runs yet.<br />Runs appear after the next RPA execution.
              </div>
            )}
            {filteredRuns.map(run => (
              <button
                key={run.id}
                onClick={() => selectRun(run)}
                className={`w-full text-left px-4 py-3 border-b border-slate-800/60 hover:bg-slate-900/60 transition-colors ${
                  selectedRun?.id === run.id
                    ? "bg-slate-800/80 border-l-2 border-l-slate-500"
                    : "border-l-2 border-l-transparent"
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
                <div className="text-sm text-slate-200 font-mono">{run.job_number}</div>
                <div className="text-xs text-slate-500 truncate mt-0.5">{run.client_name}</div>
                <div className="flex items-center gap-3 mt-1 text-xs text-slate-600">
                  {run.failed_step && (
                    <span className="text-red-500 truncate">✗ {run.failed_step}</span>
                  )}
                  {run.order_found_on_list === true  && <span className="text-emerald-600">on list ✓</span>}
                  {run.order_found_on_list === false && <span className="text-amber-600">not on list</span>}
                  {run.sqa_result?.status === "PASS"    && <span className="text-emerald-500">SQA ✓</span>}
                  {run.sqa_result?.status === "FAIL"    && <span className="text-red-500">SQA ✗</span>}
                  {run.sqa_result?.status === "PARTIAL" && <span className="text-amber-500">SQA ~</span>}
                  <span className="ml-auto">{fmt(run.duration_ms)}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── Right panel: Run detail ── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!selectedRun && !loadingDetail && (
            <div className="flex items-center justify-center h-full text-slate-600 text-sm">
              Select a run from the left to inspect it
            </div>
          )}
          {loadingDetail && (
            <div className="flex items-center justify-center h-full text-slate-500 text-sm">
              Loading run detail…
            </div>
          )}
          {selectedRun && !loadingDetail && (
            <>
              {/* Run header */}
              <div className="px-6 py-3 border-b border-slate-800 shrink-0 flex items-center gap-3">
                <span className="text-base text-slate-100 font-mono font-bold">{selectedRun.job_number}</span>
                <span className="text-xs text-slate-500">{selectedRun.client_name}</span>
                <span className="text-xs text-slate-600 font-mono">{fmtTime(selectedRun.run_at)}</span>
                <span className="text-xs text-slate-600">{fmt(selectedRun.duration_ms)}</span>
              </div>

              {/* Screenshot inline */}
              {selectedRun.screenshot_url && (
                <div className="px-6 py-3 border-b border-slate-800 shrink-0">
                  <div className="text-xs uppercase tracking-widest text-slate-600 mb-2">
                    Screenshot
                    <a
                      href={selectedRun.screenshot_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-3 normal-case text-sky-500 hover:text-sky-400"
                    >
                      open full ↗
                    </a>
                  </div>
                  <img
                    src={driveEmbedUrl(selectedRun.screenshot_url)}
                    alt={`Screenshot for job ${selectedRun.job_number}`}
                    className="w-full rounded border border-slate-700 object-contain max-h-[520px]"
                  />
                </div>
              )}

              {/* Step chips */}
              <div className="px-6 py-3 border-b border-slate-800 shrink-0">
                <div className="text-xs uppercase tracking-widest text-slate-600 mb-2">Steps</div>
                <div className="flex items-center gap-2 flex-wrap">
                  {(selectedRun.steps ?? []).map((step, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedStep(step)}
                      className={`px-3 py-1.5 rounded border text-xs font-medium transition-all ${STEP_CHIP_COLOURS[step.status] ?? STEP_CHIP_COLOURS.error} ${
                        selectedStep === step ? (STEP_CHIP_ACTIVE[step.status] ?? "") : ""
                      }`}
                    >
                      {step.name}
                      {step.status === "error" && <span className="ml-1">✗</span>}
                      {step.attempt > 1 && <span className="ml-1 opacity-60">×{step.attempt}</span>}
                    </button>
                  ))}
                  {(!selectedRun.steps || selectedRun.steps.length === 0) && (
                    <span className="text-slate-600 text-xs italic">No steps recorded</span>
                  )}
                </div>
              </div>

              {/* Status Code — below steps, at a glance */}
              <div className="px-6 py-3 border-b border-slate-800 shrink-0">
                <div className="text-xs uppercase tracking-widest text-slate-600 mb-2">Status</div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded border font-bold ${STATUS_COLOURS[selectedRun.status] ?? STATUS_COLOURS.FAILED}`}>
                    {selectedRun.status}
                  </span>
                  {selectedRun.order_found_on_list === true && (
                    <span className="text-xs px-2 py-0.5 rounded border border-emerald-700/60 bg-emerald-950/40 text-emerald-300">
                      on list ✓
                    </span>
                  )}
                  {selectedRun.order_found_on_list === false && (
                    <span className="text-xs px-2 py-0.5 rounded border border-amber-700/60 bg-amber-950/40 text-amber-300">
                      not on list
                    </span>
                  )}
                  {selectedRun.failed_step && (
                    <span className="text-xs text-red-400 font-mono">✗ {selectedRun.failed_step}</span>
                  )}
                </div>
                {selectedRun.error && (
                  <div className="mt-2 px-2 py-1.5 rounded border border-red-800 bg-red-950/40 text-xs text-red-300 font-mono break-all">
                    {selectedRun.error}
                  </div>
                )}
              </div>

              {/* Step output */}
              <div className="px-6 py-4 border-b border-slate-800 shrink-0">
                <div className="text-xs uppercase tracking-widest text-slate-600 mb-3">Output</div>
                {selectedStep ? (
                  <StepOutputPanel step={selectedStep} />
                ) : (
                  <div className="text-slate-600 text-sm">Select a step above to see its output</div>
                )}
              </div>

              {/* SQA Review — full width */}
              <div className="flex-1 overflow-y-auto">
                <SqaPanel sqa={selectedRun.sqa_result} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
