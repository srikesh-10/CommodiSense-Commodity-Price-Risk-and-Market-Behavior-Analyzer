import { createFileRoute } from "@tanstack/react-router";

// Forwards /api/* to the Python analysis backend running next to the app server.
// The browser preview can't reach the backend's localhost port directly.
const BACKEND = "http://127.0.0.1:8000";

async function forward(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const target = BACKEND + url.pathname + url.search;
  try {
    const res = await fetch(target, {
      method: request.method,
      headers: { "Content-Type": "application/json" },
      body: request.method === "GET" || request.method === "HEAD" ? null : await request.text(),
    });
    return new Response(await res.text(), {
      status: res.status,
      headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/json" },
    });
  } catch {
    return Response.json({ detail: "Analysis server is not running." }, { status: 503 });
  }
}

export const Route = createFileRoute("/api/$")({
  server: {
    handlers: {
      GET: ({ request }) => forward(request),
      POST: ({ request }) => forward(request),
    },
  },
});
