import { NextResponse } from "next/server";
import { getAllReviews } from "@/lib/db";

export const revalidate = 0;

export async function GET() {
  try {
    const reviews = await getAllReviews();
    return NextResponse.json({ reviews });
  } catch (e) {
    console.error("[api/reviews]", e);
    return NextResponse.json({ reviews: [], error: String(e) }, { status: 500 });
  }
}
