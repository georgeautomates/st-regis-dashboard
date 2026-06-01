import { NextResponse } from "next/server";
import { Pool } from "pg";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _pool: any = null;
function getPool() {
  if (!_pool) _pool = new Pool({ connectionString: process.env.SUPABASE_POSTGRES_DSN, ssl: { rejectUnauthorized: false } });
  return _pool;
}

export const revalidate = 0;

export async function GET() {
  try {
    const { rows } = await getPool().query(`
      SELECT id, run_at, message_id, email_subject, client_name,
             status, job_count, jobs_written, jobs_skipped, jobs_failed, duration_ms, error
      FROM pipeline_runs
      ORDER BY run_at DESC
      LIMIT 200
    `);
    return NextResponse.json({ runs: rows });
  } catch (e) {
    console.error("[api/runs]", e);
    return NextResponse.json({ runs: [], error: String(e) }, { status: 500 });
  }
}
