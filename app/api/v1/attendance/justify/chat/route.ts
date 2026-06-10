import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";
  const targetUrl = `${backendUrl}/attendance/justify/chat`;

  const authHeader = req.headers.get("authorization") || "";

  try {
    const bodyText = await req.text();

    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": authHeader,
      },
      body: bodyText,
    });

    if (!response.body) {
      return new Response("No body from backend", { status: 500 });
    }

    // Pass the response body (stream) directly to the client
    const headers = new Headers();
    headers.set("Content-Type", "text/event-stream");
    headers.set("Cache-Control", "no-cache, no-transform");
    headers.set("Connection", "keep-alive");

    return new Response(response.body, {
      status: response.status,
      headers,
    });
  } catch (error) {
    console.error("[chat-proxy] Error forwarding request to backend:", error);
    return new Response(
      JSON.stringify({ error: "Failed to connect to the backend agent service" }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
}
