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
      SELECT id, run_at, job_number, client_name, status, success,
             failed_step, screenshot_url, order_found_on_list, duration_ms, error
      FROM rpa_runs
      ORDER BY run_at DESC
      LIMIT 500
    `);
    return NextResponse.json({ runs: rows });
  } catch (e) {
    console.error("[api/rpa-runs]", e);
    return NextResponse.json({ runs: [], error: String(e) }, { status: 500 });
  }
}
