import { Pool } from "pg";
import { hasLocationFlag, clientGroup } from "@/lib/utils";

// ── Connection ────────────────────────────────────────────────────────────────

let _pool: Pool | null = null;

function getPool(): Pool {
  if (!_pool) {
    _pool = new Pool({ connectionString: process.env.SUPABASE_POSTGRES_DSN, ssl: { rejectUnauthorized: false } });
  }
  return _pool;
}

// ── Types (kept compatible with lib/sheets.ts so UI components need no changes) ──

export type EmailCategory = "New Order" | "Amendment" | "Cancellation" | "Unknown";
export type JobMatchStatus = "MATCH" | "PARTIAL" | "MISMATCH" | "UNKNOWN";
export type ReviewVerdict = "PASS" | "FAIL" | "PENDING";

export type Job = {
  job_number: string;
  client_name: string;
  message_id: string;
  processed_at: string;
  pdf_url: string;
  // Extraction
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
  work_type: string;
  booking_window: string;
  traffic_note: string;
  customer_ref: string;
  pallets: string;
  // Category
  category: EmailCategory;
  category_method: string;
  category_confidence: string;
  category_reasoning: string;
  referenced_job_number: string;
  // Email
  email_subject: string;
  email_received_at: string;
  // Extraction method
  extraction_method: string;
  // Scores
  composite_score: string;
  confidence_status: string;
  // Comparison
  match_status: JobMatchStatus;
  collection_match: boolean;
  delivery_match: boolean;
  price_match: boolean;
  order_number_match: boolean;
  proteo_collection: string;
  proteo_delivery: string;
  proteo_price: string;
  proteo_order_number: string;
  // RPA
  rpa_status: string;
  rpa_type: string;
  // Spot check
  spot_result: string;
  spot_reason: string;
  // Unused fields kept for UI compat (always empty from DB)
  business_type: string;
  service: string;
  goods_type: string;
  spaces: string;
  weight: string;
  model_agreement_score: string;
  m2_collection_org: string;
  m2_delivery_org: string;
  m2_price: string;
  m2_order_number: string;
  m2_collection_date: string;
  m2_delivery_date: string;
  m2_collection_time: string;
  m2_delivery_time: string;
  email_body: string;
  collection_date_match: boolean;
  delivery_date_match: boolean;
  proteo_collection_date: string;
  proteo_delivery_date: string;
  proteo_collection_time: string;
  proteo_delivery_time: string;
  proteo_business_type: string;
  proteo_service: string;
  proteo_goods_type: string;
  proteo_pallets: string;
  proteo_spaces: string;
  proteo_weight: string;
  spot_confidence: string;
  spot_flag_category: string;
  // Subject-line parsing
  subject_job_numbers: string;
  subject_instructions: string;
  subject_explanation: string;
};

export type Email = {
  message_id: string;
  subject: string;
  category: EmailCategory;
  processed_at: string;
  email_received_at: string;
  jobs: Job[];
  job_count: number;
  fibre_count: number;
  reels_count: number;
  match_count: number;
  partial_count: number;
  mismatch_count: number;
  unknown_count: number;
  worst_status: JobMatchStatus;
  top_mismatch_reasons: string[];
  has_location_flag: boolean;
  client_group: string;
};

export type ManualReview = {
  job_number: string;
  verdict: ReviewVerdict;
  reason: string;
  notes: string;
  reviewed_by: string;
  reviewed_at: string;
};

// ── Manifest review (Add / Update / Cancel / Ignore triage) ──────────────────

export type ManifestAction = "Add" | "Update" | "Cancel" | "Ignore";

export type ManifestReviewJob = Job & {
  suggested_action: ManifestAction | "";
  suggested_reason: string;
  review_action: ManifestAction | "";
  review_action_source: "suggested" | "override" | "";
};

export type ManifestReviewEmail = {
  message_id: string;
  subject: string;
  email_received_at: string;
  processed_at: string;
  client_group: string;
  jobs: ManifestReviewJob[];
  pending_count: number; // jobs with no review_action set yet
};

function rowToManifestReviewJob(r: Record<string, unknown>): ManifestReviewJob {
  const job = rowToJob(r as Record<string, any>); // eslint-disable-line @typescript-eslint/no-explicit-any
  return {
    ...job,
    suggested_action: (r.suggested_action as ManifestAction) || "",
    suggested_reason: String(r.suggested_reason ?? ""),
    review_action: (r.review_action as ManifestAction) || "",
    review_action_source: (r.review_action_source as "suggested" | "override") || "",
  };
}

// ── Normalise DB row → Job ────────────────────────────────────────────────────

function dbMatchStatus(v: string | null): JobMatchStatus {
  if (!v) return "UNKNOWN";
  const u = v.toUpperCase();
  if (u === "FULL") return "MATCH";
  if (u === "PARTIAL") return "PARTIAL";
  if (u === "NONE") return "MISMATCH";
  return "UNKNOWN";
}

function dbBool(v: boolean | null): boolean {
  return v === true;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToJob(r: Record<string, any>): Job {
  return {
    job_number:           String(r.job_number ?? ""),
    client_name:          String(r.client_name ?? ""),
    message_id:           String(r.message_id ?? ""),
    processed_at:         r.processed_at ? String(r.processed_at) : "",
    pdf_url:              String(r.pdf_url ?? ""),
    collection_point:     String(r.collection_point ?? ""),
    delivery_point:       String(r.delivery_point ?? ""),
    price:                String(r.price ?? ""),
    order_number:         String(r.order_number ?? ""),
    collection_date:      String(r.collection_date ?? ""),
    collection_time:      String(r.collection_time ?? ""),
    delivery_date:        String(r.delivery_date ?? ""),
    delivery_time:        String(r.delivery_time ?? ""),
    collection_postcode:  String(r.collection_postcode ?? ""),
    delivery_postcode:    String(r.delivery_postcode ?? ""),
    work_type:            String(r.work_type ?? ""),
    booking_window:       String(r.booking_window ?? ""),
    traffic_note:         String(r.traffic_note ?? ""),
    customer_ref:         String(r.customer_ref ?? ""),
    pallets:              r.pallets != null ? String(r.pallets) : "",
    category:             (r.category as EmailCategory) ?? "Unknown",
    category_method:      String(r.category_method ?? ""),
    category_confidence:  String(r.category_confidence ?? ""),
    category_reasoning:   String(r.category_reasoning ?? ""),
    referenced_job_number: String(r.referenced_job_number ?? ""),
    email_subject:        String(r.email_subject ?? ""),
    email_received_at:    String(r.email_received_at ?? ""),
    extraction_method:    String(r.extraction_method ?? ""),
    composite_score:      r.composite_score != null ? String(r.composite_score) : "",
    confidence_status:    String(r.confidence_status ?? ""),
    match_status:         dbMatchStatus(r.match_status),
    collection_match:     dbBool(r.collection_match),
    delivery_match:       dbBool(r.delivery_match),
    price_match:          dbBool(r.price_match),
    order_number_match:   dbBool(r.order_number_match),
    proteo_collection:    String(r.proteo_collection ?? ""),
    proteo_delivery:      String(r.proteo_delivery ?? ""),
    proteo_price:         String(r.proteo_price ?? ""),
    proteo_order_number:  String(r.proteo_order_number ?? ""),
    rpa_status:           String(r.rpa_status ?? ""),
    rpa_type:             String(r.rpa_type ?? ""),
    spot_result:          String(r.spot_result ?? ""),
    spot_reason:          String(r.spot_reason ?? ""),
    business_type:        String(r.business_type ?? ""),
    service:              String(r.service ?? ""),
    goods_type:           String(r.goods_type ?? ""),
    spaces:               r.spaces != null ? String(r.spaces) : "",
    weight:               r.weight != null ? String(r.weight) : "",
    model_agreement_score: "", email_body: String(r.email_body ?? ""),
    m2_collection_org: "", m2_delivery_org: "", m2_price: "", m2_order_number: "",
    m2_collection_date: "", m2_delivery_date: "", m2_collection_time: "", m2_delivery_time: "",
    collection_date_match: false, delivery_date_match: false,
    proteo_collection_date: "", proteo_delivery_date: "",
    proteo_collection_time: "", proteo_delivery_time: "",
    proteo_business_type: "", proteo_service: "", proteo_goods_type: "",
    proteo_pallets: "", proteo_spaces: "", proteo_weight: "",
    spot_confidence: "", spot_flag_category: "",
    subject_job_numbers:  String(r.subject_job_numbers ?? ""),
    subject_instructions: String(r.subject_instructions ?? ""),
    subject_explanation:  String(r.subject_explanation ?? ""),
  };
}

// ── Email aggregation ─────────────────────────────────────────────────────────

function buildEmail(msgId: string, jobs: Job[]): Email {
  const first = jobs[0];
  const statusRank: Record<JobMatchStatus, number> = { MISMATCH: 0, PARTIAL: 1, UNKNOWN: 2, MATCH: 3 };
  const worst = jobs.reduce<JobMatchStatus>(
    (acc, j) => statusRank[j.match_status] < statusRank[acc] ? j.match_status : acc,
    "MATCH"
  );

  const reasons: string[] = [];
  for (const j of jobs) {
    if (!j.collection_match && j.proteo_collection) reasons.push("collection point");
    if (!j.delivery_match && j.proteo_delivery)     reasons.push("delivery point");
    if (!j.price_match && j.proteo_price)           reasons.push("price");
    if (!j.order_number_match && j.proteo_order_number) reasons.push("order number");
  }
  const reasonCounts = reasons.reduce<Record<string, number>>((acc, r) => {
    acc[r] = (acc[r] ?? 0) + 1; return acc;
  }, {});
  const topReasons = Object.entries(reasonCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([r, n]) => n > 1 ? `${r} (×${n})` : r);

  return {
    message_id:        msgId,
    subject:           first.email_subject,
    category:          first.category,
    processed_at:      first.processed_at,
    email_received_at: first.email_received_at,
    jobs,
    job_count:    jobs.length,
    fibre_count:  jobs.filter(j => j.client_name.toLowerCase().includes("fibre")).length,
    reels_count:  jobs.filter(j => j.client_name.toLowerCase().includes("reels")).length,
    match_count:    jobs.filter(j => j.match_status === "MATCH").length,
    partial_count:  jobs.filter(j => j.match_status === "PARTIAL").length,
    mismatch_count: jobs.filter(j => j.match_status === "MISMATCH").length,
    unknown_count:  jobs.filter(j => j.match_status === "UNKNOWN").length,
    worst_status: worst,
    top_mismatch_reasons: topReasons,
    has_location_flag: jobs.some(hasLocationFlag),
    client_group: clientGroup(first.client_name),
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getEmails(): Promise<Email[]> {
  const pool = getPool();
  const { rows } = await pool.query(`
    SELECT * FROM st_regis_orders
    ORDER BY processed_at DESC NULLS LAST
  `);

  const emailMap: Record<string, Job[]> = {};
  for (const row of rows) {
    const job = rowToJob(row);
    if (!emailMap[job.message_id]) emailMap[job.message_id] = [];
    emailMap[job.message_id].push(job);
  }

  return Object.entries(emailMap).map(([msgId, jobs]) => buildEmail(msgId, jobs));
}

export async function getEmailById(messageId: string): Promise<Email | null> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT * FROM st_regis_orders WHERE message_id = $1 ORDER BY job_number`,
    [messageId]
  );
  if (rows.length === 0) return null;
  const jobs = rows.map(rowToJob);
  return buildEmail(messageId, jobs);
}

export async function getReviewsForEmail(messageId: string): Promise<Record<string, ManualReview>> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT job_number, manual_verdict as verdict, manual_reason as reason, '' as notes,
            manual_reviewed_by as reviewed_by, manual_reviewed_at as reviewed_at
     FROM st_regis_orders
     WHERE message_id = $1 AND manual_verdict IS NOT NULL AND manual_verdict != ''`,
    [messageId]
  );
  const result: Record<string, ManualReview> = {};
  for (const r of rows) {
    result[r.job_number] = {
      job_number:   r.job_number,
      verdict:      r.verdict === "PASS" ? "PASS" : r.verdict === "FAIL" ? "FAIL" : "PENDING",
      reason:       r.reason ?? "",
      notes:        "",
      reviewed_by:  String(r.reviewed_by ?? ""),
      reviewed_at:  r.reviewed_at ? String(r.reviewed_at) : "",
    };
  }
  return result;
}

export async function getAllReviews(): Promise<(ManualReview & {
  job_number: string;
  client_name: string;
  message_id: string;
  email_subject: string;
  collection_point: string;
  delivery_point: string;
  price: string;
  category: string;
  processed_at: string;
})[]> {
  const pool = getPool();
  const { rows } = await pool.query(`
    SELECT job_number, client_name, message_id, email_subject,
           collection_point, delivery_point, price, category, processed_at,
           manual_verdict as verdict, manual_reason as reason,
           manual_reviewed_by as reviewed_by, manual_reviewed_at as reviewed_at
    FROM st_regis_orders
    WHERE manual_verdict IN ('PASS', 'FAIL')
    ORDER BY processed_at DESC NULLS LAST
  `);
  return rows.map(r => ({
    job_number:       String(r.job_number ?? ""),
    client_name:      String(r.client_name ?? ""),
    message_id:       String(r.message_id ?? ""),
    email_subject:    String(r.email_subject ?? ""),
    collection_point: String(r.collection_point ?? ""),
    delivery_point:   String(r.delivery_point ?? ""),
    price:            String(r.price ?? ""),
    category:         String(r.category ?? ""),
    processed_at:     r.processed_at ? String(r.processed_at) : "",
    verdict:          r.verdict === "PASS" ? "PASS" : "FAIL",
    reason:           String(r.reason ?? ""),
    notes:            "",
    reviewed_by:      String(r.reviewed_by ?? ""),
    reviewed_at:      r.reviewed_at ? String(r.reviewed_at) : "",
  }));
}

export async function saveReview(review: Omit<ManualReview, "reviewed_at">): Promise<void> {
  const pool = getPool();
  await pool.query(
    `UPDATE st_regis_orders
     SET manual_verdict = $1, manual_reason = $2, manual_reviewed_by = $3, manual_reviewed_at = now()
     WHERE job_number = $4`,
    [review.verdict, review.reason || review.notes, review.reviewed_by, review.job_number]
  );
}

// ── Manifest review (DS Smith Add/Update/Cancel/Ignore triage) ───────────────
//
// suggested_action/suggested_reason are computed by
// firmin.clients.manifest_review.classify_manifest_order() (Python, run via
// scripts/classify_manifest_review.py) — this file only reads and displays
// them, plus writes the reviewer's own review_action decision. See
// Plans/ds-smith-manifest-dashboard-prd.md.

function buildManifestReviewEmail(msgId: string, jobs: ManifestReviewJob[]): ManifestReviewEmail {
  const first = jobs[0];
  return {
    message_id: msgId,
    subject: first.email_subject,
    email_received_at: first.email_received_at,
    processed_at: first.processed_at,
    client_group: clientGroup(first.client_name),
    jobs,
    pending_count: jobs.filter(j => !j.review_action).length,
  };
}

/**
 * Manifests (grouped by email) that have at least one job still awaiting a
 * reviewer decision (review_action is unset). Most-recently-processed first.
 */
export async function getPendingManifestReviews(): Promise<ManifestReviewEmail[]> {
  const pool = getPool();
  const { rows } = await pool.query(`
    SELECT * FROM st_regis_orders
    WHERE message_id IN (
      SELECT message_id FROM st_regis_orders
      WHERE (client_name ILIKE '%st regis%' OR client_name ILIKE '%ds smith%')
        AND (review_action IS NULL OR review_action = '')
    )
    ORDER BY processed_at DESC NULLS LAST
  `);

  const emailMap: Record<string, ManifestReviewJob[]> = {};
  for (const row of rows) {
    const job = rowToManifestReviewJob(row);
    if (!emailMap[job.message_id]) emailMap[job.message_id] = [];
    emailMap[job.message_id].push(job);
  }
  return Object.entries(emailMap)
    .map(([msgId, jobs]) => buildManifestReviewEmail(msgId, jobs))
    .sort((a, b) => (b.processed_at || "").localeCompare(a.processed_at || ""));
}

export async function getManifestReviewByMessageId(messageId: string): Promise<ManifestReviewEmail | null> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT * FROM st_regis_orders WHERE message_id = $1 ORDER BY job_number`,
    [messageId]
  );
  if (rows.length === 0) return null;
  const jobs = rows.map(rowToManifestReviewJob);
  return buildManifestReviewEmail(messageId, jobs);
}

export type ManifestActionDecision = {
  job_number: string;
  action: ManifestAction;
  source: "suggested" | "override";
  reviewed_by: string;
};

/**
 * Save the reviewer's Add/Update/Cancel/Ignore decision for one job.
 * Writes review_action only — never touches suggested_action/suggested_reason
 * (those belong to the classifier) or manual_verdict/manual_reason (the
 * separate PASS/FAIL accuracy audit on /manager).
 */
export async function saveManifestAction(decision: ManifestActionDecision): Promise<void> {
  const pool = getPool();
  await pool.query(
    `UPDATE st_regis_orders
     SET review_action = $1, review_action_source = $2, review_action_by = $3, review_action_at = now()
     WHERE job_number = $4`,
    [decision.action, decision.source, decision.reviewed_by, decision.job_number]
  );
}
