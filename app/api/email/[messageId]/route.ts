import { NextRequest, NextResponse } from "next/server";
import { getEmailById, getReviewsForEmail } from "@/lib/db";

export const revalidate = 30;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  const { messageId } = await params;
  try {
    const [email, reviews] = await Promise.all([
      getEmailById(messageId),
      getReviewsForEmail(messageId),
    ]);
    if (!email) return NextResponse.json({ email: null, reviews: {} }, { status: 404 });
    return NextResponse.json({ email, reviews });
  } catch (e) {
    console.error("[api/email]", e);
    return NextResponse.json({ email: null, reviews: {}, error: String(e) }, { status: 500 });
  }
}
