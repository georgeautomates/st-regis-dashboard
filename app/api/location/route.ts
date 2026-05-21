import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

let _pool: Pool | null = null;
function getPool() {
  if (!_pool) {
    _pool = new Pool({
      connectionString: process.env.SUPABASE_POSTGRES_DSN,
      ssl: { rejectUnauthorized: false },
    });
  }
  return _pool;
}

export async function GET(req: NextRequest) {
  const point = req.nextUrl.searchParams.get("point");
  if (!point) return NextResponse.json({ full_address: null });

  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT full_address FROM "Location Points" WHERE "Description" = $1 LIMIT 1`,
      [point]
    );
    const full_address = result.rows[0]?.full_address ?? null;
    return NextResponse.json({ full_address });
  } catch (err) {
    console.error("[api/location]", err);
    return NextResponse.json({ full_address: null });
  }
}
