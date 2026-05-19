import { NextResponse } from "next/server";
import { Pool } from "pg";

let _pool: Pool | null = null;
function getPool(): Pool {
  if (!_pool) {
    _pool = new Pool({ connectionString: process.env.SUPABASE_POSTGRES_DSN, ssl: { rejectUnauthorized: false } });
  }
  return _pool;
}

export async function GET() {
  try {
    const pool = getPool();
    const { rows } = await pool.query<{
      id: number;
      message_id: string;
      email_subject: string;
      email_received_at: string;
      processed_at: string;
      subject_job_numbers: string;
      pdf_job_numbers: string;
      subject_match: string;
      job_number: string;
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
      composite_score: number | null;
      confidence_status: string;
      extraction_method: string;
    }>(
      `SELECT * FROM test_orders ORDER BY processed_at DESC`
    );

    return NextResponse.json({ orders: rows });
  } catch (e) {
    console.error("[test-orders] DB error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
