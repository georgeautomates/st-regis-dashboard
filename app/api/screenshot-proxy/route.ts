import { NextRequest, NextResponse } from "next/server";

export const revalidate = 3600;

export async function GET(req: NextRequest) {
  const fileId = req.nextUrl.searchParams.get("id");
  if (!fileId || !/^[a-zA-Z0-9_-]+$/.test(fileId)) {
    return new NextResponse("Missing or invalid id", { status: 400 });
  }

  const url = `https://drive.usercontent.google.com/download?id=${fileId}&export=view`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      return new NextResponse("Drive fetch failed", { status: 502 });
    }
    const buf = await res.arrayBuffer();
    return new NextResponse(buf, {
      headers: {
        "Content-Type": res.headers.get("Content-Type") ?? "image/png",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (e) {
    return new NextResponse("Proxy error", { status: 502 });
  }
}
