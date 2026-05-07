import { google } from "googleapis";

const SPREADSHEET_ID = process.env.SPREADSHEET_ID!;
const SERVICE_ACCOUNT_JSON = process.env.GOOGLE_SERVICE_ACCOUNT_JSON!;

function getAuth() {
  const creds = JSON.parse(SERVICE_ACCOUNT_JSON);
  return new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

async function getSheet(range: string): Promise<string[][]> {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range,
  });
  return (res.data.values as string[][]) ?? [];
}

// ── Types ────────────────────────────────────────────────────────────────────

export type EmailCategory = "New Order" | "Amendment" | "Cancellation" | "Unknown";

export type JobMatchStatus = "MATCH" | "PARTIAL" | "MISMATCH" | "UNKNOWN";

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
  business_type: string;
  service: string;
  goods_type: string;
  pallets: string;
  spaces: string;
  weight: string;
  work_type: string;
  booking_window: string;
  traffic_note: string;
  customer_ref: string;
  collection_postcode: string;
  // Scores
  composite_score: string;
  status: string;
  model_agreement_score: string;
  // Secondary model
  m2_collection_org: string;
  m2_delivery_org: string;
  m2_price: string;
  m2_order_number: string;
  m2_collection_date: string;
  m2_delivery_date: string;
  m2_collection_time: string;
  m2_delivery_time: string;
  // Email
  email_subject: string;
  email_body: string;
  // Comparison
  match_status: JobMatchStatus;
  collection_match: boolean;
  delivery_match: boolean;
  price_match: boolean;
  order_number_match: boolean;
  collection_date_match: boolean;
  delivery_date_match: boolean;
  proteo_collection: string;
  proteo_delivery: string;
  proteo_price: string;
  proteo_order_number: string;
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
  // Spot check
  spot_result: string;
  spot_confidence: string;
  spot_reason: string;
  spot_flag_category: string;
};

export type Email = {
  message_id: string;
  subject: string;
  category: EmailCategory;
  processed_at: string;
  jobs: Job[];
  // Aggregates
  job_count: number;
  fibre_count: number;
  reels_count: number;
  match_count: number;
  partial_count: number;
  mismatch_count: number;
  unknown_count: number;
  worst_status: JobMatchStatus;
  top_mismatch_reasons: string[];
};

// ── Category detection ────────────────────────────────────────────────────────

export function detectCategory(subject: string, body: string): EmailCategory {
  const subj = subject.toLowerCase();
  const bodyLower = body.toLowerCase();
  // Cancellation — check subject first, then body
  if (/\bcancel(led|lation)?\b/.test(subj)) return "Cancellation";
  if (/\bcancel(led|lation)?\b/.test(bodyLower)) return "Cancellation";
  // Amendment — subject only (body often contains "update" / "change" in boilerplate)
  // Require explicit amendment/revision words, not generic "update" or "change"
  if (/\bamend(ment|ed|ing)?\b|\brevised?\b|\brevision\b|\bcorrect(ed|ion)?\b|\bmodif(ied|ication)\b/.test(subj)) return "Amendment";
  return "New Order";
}

// ── Data fetching ─────────────────────────────────────────────────────────────

export async function getEmails(): Promise<Email[]> {
  const [actualRows, compRows, spotRows] = await Promise.all([
    getSheet("Actual Entry!A1:AZ5000"),
    getSheet("Comparison!A1:AZ5000").catch(() => []),
    getSheet("Spot Check!A1:Z5000").catch(() => []),
  ]);

  if (actualRows.length < 2) return [];

  const aiHeader = actualRows[0] as string[];
  const ai = (name: string) => aiHeader.indexOf(name);

  // Build comparison lookup by job_number
  const compHeader = compRows[0] as string[] ?? [];
  const cp = (name: string) => compHeader.indexOf(name);
  const compLookup: Record<string, string[]> = {};
  for (let i = 1; i < compRows.length; i++) {
    const r = compRows[i] as string[];
    const jn = r[cp("job_number")] ?? "";
    if (jn) compLookup[jn] = r;
  }

  // Build spot check lookup by job_number
  const spotHeader = spotRows[0] as string[] ?? [];
  const sp = (name: string) => spotHeader.indexOf(name);
  const spotLookup: Record<string, string[]> = {};
  for (let i = 1; i < spotRows.length; i++) {
    const r = spotRows[i] as string[];
    const jn = r[sp("job_number")] ?? "";
    if (jn) spotLookup[jn] = r;
  }

  const bool = (v: string) => ["yes", "true", "1"].includes((v ?? "").trim().toLowerCase());

  const matchStatus = (r: string[]): JobMatchStatus => {
    const v = (r[cp("overall_match")] ?? "").trim().toUpperCase();
    if (v.startsWith("FULL") || v === "YES" || v === "TRUE") return "MATCH";
    if (v.startsWith("PARTIAL")) return "PARTIAL";
    if (v.startsWith("NO") || v === "FALSE") return "MISMATCH";
    return "UNKNOWN";
  };

  // Group jobs by message_id
  const emailMap: Record<string, Job[]> = {};

  for (let i = 1; i < actualRows.length; i++) {
    const row = actualRows[i] as string[];
    const clientName = row[ai("client_name")] ?? "";
    if (!clientName.toLowerCase().includes("st regis")) continue;

    const jobNum = row[ai("delivery_order_number")] ?? "";
    const msgId = row[ai("message_id")] ?? "";
    if (!msgId) continue;

    const comp = compLookup[jobNum] ?? [];
    const spot = spotLookup[jobNum] ?? [];

    const splitDT = (dateVal: string, timeVal: string): [string, string] => {
      const m = dateVal.match(/^(\d{2}\/\d{2}\/\d{2,4})\s+(\d{2}:\d{2})$/);
      return m ? [m[1], m[2]] : [dateVal, timeVal];
    };
    const [pColDate, pColTime] = splitDT(comp[cp("collection_date_proteo")] ?? "", comp[cp("collection_time_proteo")] ?? "");
    const [pDelDate, pDelTime] = splitDT(comp[cp("delivery_date_proteo")] ?? "", comp[cp("delivery_time_proteo")] ?? "");

    const job: Job = {
      job_number: jobNum,
      client_name: clientName,
      message_id: msgId,
      processed_at: row[ai("processed_at")] ?? "",
      pdf_url: row[ai("pdf_url")] ?? "",
      collection_point: row[ai("collection_point")] ?? "",
      delivery_point: row[ai("delivery_point")] ?? "",
      price: row[ai("rate")] ?? "",
      order_number: row[ai("order_number")] ?? "",
      collection_date: row[ai("collection_date")] ?? "",
      collection_time: row[ai("collection_time")] ?? "",
      delivery_date: row[ai("delivery_date")] ?? "",
      delivery_time: row[ai("delivery_time")] ?? "",
      business_type: row[ai("business_type")] ?? "",
      service: row[ai("service")] ?? "",
      goods_type: row[ai(" goods_type")] ?? row[ai("goods_type")] ?? "",
      pallets: row[ai("pallets")] ?? "",
      spaces: row[ai("spaces")] ?? "",
      weight: row[ai("weight")] ?? "",
      work_type: row[ai("work_type")] ?? "",
      booking_window: row[ai("booking_window")] ?? "",
      traffic_note: row[ai("traffic_note")] ?? "",
      customer_ref: row[ai("customer_ref")] ?? "",
      collection_postcode: row[ai("collection_postcode")] ?? "",
      composite_score: row[ai("Composite_score")] ?? row[ai("composite_score")] ?? "",
      status: row[ai("Status")] ?? row[ai("status")] ?? "",
      model_agreement_score: row[ai("model_agreement_score")] ?? "",
      m2_collection_org: row[ai("m2_collection_org")] ?? "",
      m2_delivery_org: row[ai("m2_delivery_org")] ?? "",
      m2_price: row[ai("m2_price")] ?? "",
      m2_order_number: row[ai("m2_order_number")] ?? "",
      m2_collection_date: row[ai("m2_collection_date")] ?? "",
      m2_delivery_date: row[ai("m2_delivery_date")] ?? "",
      m2_collection_time: row[ai("m2_collection_time")] ?? "",
      m2_delivery_time: row[ai("m2_delivery_time")] ?? "",
      email_subject: row[ai("email_subject")] ?? "",
      email_body: row[ai("email_body")] ?? "",
      match_status: comp.length ? matchStatus(comp) : "UNKNOWN",
      collection_match: bool(comp[cp("collection_match")] ?? ""),
      delivery_match: bool(comp[cp("delivery_match")] ?? ""),
      price_match: bool(comp[cp("price_match")] ?? ""),
      order_number_match: bool(comp[cp("order_number_match")] ?? ""),
      collection_date_match: bool(comp[cp("collection_date_match")] ?? ""),
      delivery_date_match: bool(comp[cp("delivery_date_match")] ?? ""),
      proteo_collection: comp[cp("collection_point_proteo")] ?? "",
      proteo_delivery: comp[cp("delivery_point_proteo")] ?? "",
      proteo_price: comp[cp("price_proteo")] ?? "",
      proteo_order_number: comp[cp("order_number_proteo")] ?? "",
      proteo_collection_date: pColDate,
      proteo_delivery_date: pDelDate,
      proteo_collection_time: pColTime,
      proteo_delivery_time: pDelTime,
      proteo_business_type: comp[cp("business_type_proteo")] ?? "",
      proteo_service: comp[cp("service_proteo")] ?? "",
      proteo_goods_type: comp[cp("goods_type_proteo")] ?? "",
      proteo_pallets: comp[cp("pallets_proteo")] ?? "",
      proteo_spaces: comp[cp("spaces_proteo")] ?? "",
      proteo_weight: comp[cp("weight_proteo")] ?? "",
      spot_result: spot[sp("result")] ?? "",
      spot_confidence: spot[sp("confidence")] ?? "",
      spot_reason: spot[sp("reason")] ?? "",
      spot_flag_category: spot[sp("flag_category")] ?? "",
    };

    if (!emailMap[msgId]) emailMap[msgId] = [];
    emailMap[msgId].push(job);
  }

  // Build Email objects
  const emails: Email[] = Object.entries(emailMap).map(([msgId, jobs]) => {
    const first = jobs[0];
    const subject = first.email_subject;
    const body = first.email_body;

    const statusRank: Record<JobMatchStatus, number> = { MISMATCH: 0, PARTIAL: 1, UNKNOWN: 2, MATCH: 3 };
    const worst = jobs.reduce<JobMatchStatus>((acc, j) => {
      return statusRank[j.match_status] < statusRank[acc] ? j.match_status : acc;
    }, "MATCH");

    // Collect top mismatch reasons across jobs
    const reasons: string[] = [];
    for (const j of jobs) {
      if (!j.collection_match && j.proteo_collection) reasons.push("collection point");
      if (!j.delivery_match && j.proteo_delivery) reasons.push("delivery point");
      if (!j.price_match && j.proteo_price) reasons.push("price");
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
      message_id: msgId,
      subject,
      category: detectCategory(subject, body),
      processed_at: first.processed_at,
      jobs,
      job_count: jobs.length,
      fibre_count: jobs.filter(j => j.client_name.toLowerCase().includes("fibre")).length,
      reels_count: jobs.filter(j => j.client_name.toLowerCase().includes("reels")).length,
      match_count: jobs.filter(j => j.match_status === "MATCH").length,
      partial_count: jobs.filter(j => j.match_status === "PARTIAL").length,
      mismatch_count: jobs.filter(j => j.match_status === "MISMATCH").length,
      unknown_count: jobs.filter(j => j.match_status === "UNKNOWN").length,
      worst_status: worst,
      top_mismatch_reasons: topReasons,
    };
  });

  // Sort by most recent first
  return emails.sort((a, b) => b.processed_at.localeCompare(a.processed_at));
}

export async function getEmailById(messageId: string): Promise<Email | null> {
  const emails = await getEmails();
  return emails.find(e => e.message_id === messageId) ?? null;
}

// ── Manual Review ─────────────────────────────────────────────────────────────

export type ReviewVerdict = "PASS" | "FAIL" | "PENDING";

export type ManualReview = {
  job_number: string;
  verdict: ReviewVerdict;
  reason: string;
  notes: string;
  reviewed_by: string;
  reviewed_at: string;
};

export async function getReviewsForEmail(messageId: string): Promise<Record<string, ManualReview>> {
  const emails = await getEmails();
  const email = emails.find(e => e.message_id === messageId);
  if (!email) return {};

  const jobNumbers = email.jobs.map(j => j.job_number);
  const rows = await getSheet("Manual Review!A1:G5000").catch(() => [] as string[][]);
  if (rows.length < 2) return {};

  const header = rows[0] as string[];
  const h = (name: string) => header.indexOf(name);

  const result: Record<string, ManualReview> = {};
  for (let i = rows.length - 1; i >= 1; i--) {
    const r = rows[i] as string[];
    const jn = r[h("job_number")] ?? "";
    if (!jobNumbers.includes(jn) || result[jn]) continue;
    result[jn] = {
      job_number: jn,
      verdict: (r[h("verdict")] ?? "PENDING") as ReviewVerdict,
      reason: r[h("reason")] ?? "",
      notes: r[h("notes")] ?? "",
      reviewed_by: r[h("reviewed_by")] ?? "",
      reviewed_at: r[h("reviewed_at")] ?? "",
    };
  }
  return result;
}

export async function saveReview(review: Omit<ManualReview, "reviewed_at">): Promise<void> {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const reviewed_at = new Date().toISOString();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: "'Manual Review'!A1",
    valueInputOption: "RAW",
    requestBody: {
      values: [[
        review.job_number,
        review.verdict,
        review.reason,
        review.notes,
        review.reviewed_by,
        reviewed_at,
      ]],
    },
  });
}
