import { NextResponse } from "next/server";
import { getPendingManifestReviews } from "@/lib/db";

export async function GET() {
  try {
    const manifests = await getPendingManifestReviews();
    return NextResponse.json({ manifests });
  } catch (e) {
    console.error("[api/manifest-reviews]", e);
    return NextResponse.json({ manifests: [], error: String(e) }, { status: 500 });
  }
}
