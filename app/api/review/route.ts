import { NextRequest, NextResponse } from "next/server";
import { saveReview } from "@/lib/sheets";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    await saveReview(body);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[api/review]", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
