import { NextResponse } from "next/server";
import { Pool } from "pg";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _pool: any = null;
function getPool() {
  if (!_pool) _pool = new Pool({ connectionString: process.env.SUPABASE_POSTGRES_DSN, ssl: { rejectUnauthorized: false } });
  return _pool;
}

export const revalidate = 0;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { rows } = await getPool().query(
      `SELECT id, run_at, job_number, client_name, status, success,
              failed_step, screenshot_url, order_found_on_list, duration_ms,
              steps, error, sqa_result
       FROM rpa_runs WHERE id = $1`,
      [id]
    );
    if (rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ run: rows[0] });
  } catch (e) {
    console.error("[api/rpa-runs/[id]]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
