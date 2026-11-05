// Fihma Advisory: mobile speed check via Google PageSpeed Insights
// GET /api/speed?url=<website>
// Optional GOOGLE_PAGESPEED_API_KEY (works without one, at a lower rate limit).

import { speedPoints } from "../lib/score.mjs";

export const config = { path: "/api/speed" };

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": status === 200 ? "public, max-age=86400" : "no-store" },
  });

export default async (req) => {
  const url = new URL(req.url).searchParams.get("url") || "";
  if (!/^https?:\/\/[^\s]+$/i.test(url) || url.length > 300) return json({ error: "bad url" }, 400);

  const api = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
  api.searchParams.set("url", url);
  api.searchParams.set("strategy", "mobile");
  api.searchParams.set("category", "performance");
  const key = process.env.GOOGLE_PAGESPEED_API_KEY || process.env.GOOGLE_PLACES_API_KEY;
  if (key) api.searchParams.set("key", key);

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 25000);
  try {
    const res = await fetch(api, { signal: ctrl.signal });
    if (!res.ok) return json({ error: "speed check unavailable" }, 502);
    const data = await res.json();
    const lh = data.lighthouseResult || {};
    const perf = lh.categories?.performance?.score ?? null;
    const lcp = lh.audits?.["largest-contentful-paint"]?.numericValue ?? null;
    return json({
      performance: perf == null ? null : Math.round(perf * 100),
      loadSeconds: lcp == null ? null : Math.round(lcp / 100) / 10,
      points: speedPoints(perf),
    });
  } catch {
    return json({ error: "speed check timed out" }, 504);
  } finally {
    clearTimeout(t);
  }
};
