import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/upload-proxy
 *
 * Server-side relay that forwards a binary file body to a Cloudflare R2
 * presigned PUT URL, bypassing the browser's same-origin CORS policy.
 *
 * Cloudflare R2 requires a Content-Length header on PUT requests (returns
 * HTTP 411 without it). We buffer the full body here (max 6 MB per the UI
 * validation) so we can supply the exact byte count.
 *
 * Query params:
 *   putUrl      – the full presigned PUT URL (percent-encoded)
 *   contentType – the MIME type to set on the PUT request (e.g. "image/jpeg")
 */
export async function POST(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const putUrl = searchParams.get("putUrl");
  const contentType = searchParams.get("contentType") ?? "application/octet-stream";

  if (!putUrl) {
    return Response.json({ error: "Missing putUrl parameter" }, { status: 400 });
  }

  let decodedPutUrl: string;
  try {
    decodedPutUrl = decodeURIComponent(putUrl);
  } catch {
    return Response.json({ error: "Invalid putUrl encoding" }, { status: 400 });
  }

  // Buffer the entire body so we can send Content-Length to R2.
  // The UI limits uploads to 6 MB, so this is safe to hold in memory.
  let buffer: ArrayBuffer;
  try {
    buffer = await req.arrayBuffer();
  } catch {
    return Response.json({ error: "Failed to read file body" }, { status: 400 });
  }

  if (buffer.byteLength === 0) {
    return Response.json({ error: "No file body received" }, { status: 400 });
  }

  let r2Response: Response;
  try {
    r2Response = await fetch(decodedPutUrl, {
      method: "PUT",
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(buffer.byteLength),
      },
      body: buffer,
    });
  } catch (err) {
    console.error("[upload-proxy] Network error:", err);
    return Response.json({ error: "Network error reaching storage" }, { status: 502 });
  }

  if (!r2Response.ok) {
    const text = await r2Response.text().catch(() => "");
    console.error(`[upload-proxy] R2 responded ${r2Response.status}:`, text);
    return Response.json(
      { error: `Storage responded with ${r2Response.status}` },
      { status: r2Response.status }
    );
  }

  return new Response(null, { status: 200 });
}
