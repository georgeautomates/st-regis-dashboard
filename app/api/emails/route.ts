import { NextResponse } from "next/server";
import { getEmails } from "@/lib/db";

export const revalidate = 60;

export async function GET() {
  try {
    const emails = await getEmails();
    return NextResponse.json({ emails });
  } catch (e) {
    console.error("[api/emails]", e);
    return NextResponse.json({ emails: [], error: String(e) }, { status: 500 });
  }
}
