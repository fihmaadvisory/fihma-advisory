// Fihma Advisory: Business Scorecard API
// GET /api/scorecard?q=<business name and city>
// Needs the GOOGLE_PLACES_API_KEY environment variable set in Netlify.

import { analyzeWebsite, scoreBusiness } from "../lib/score.mjs";

export const config = { path: "/api/scorecard" };

const PLACES_URL = "https://places.googleapis.com/v1/places:searchText";
const FIELDS = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.rating",
  "places.userRatingCount",
  "places.websiteUri",
  "places.nationalPhoneNumber",
  "places.regularOpeningHours",
  "places.reviews",
  "places.googleMapsUri",
  "places.businessStatus",
  "places.primaryTypeDisplayName",
].join(",");

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": status === 200 ? "public, max-age=3600" : "no-store",
    },
  });

async function fetchWithTimeout(url, opts = {}, ms = 6000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function fetchSite(url) {
  try {
    const res = await fetchWithTimeout(
      url,
      {
        redirect: "follow",
        headers: {
          "user-agent":
            "Mozilla/5.0 (compatible; FihmaScorecard/1.0; +https://fihmaadvisory.com/scorecard)",
          accept: "text/html",
        },
      },
      6000
    );
    if (!res.ok) return { ok: false, finalUrl: res.url || url };
    const html = (await res.text()).slice(0, 1_500_000);
    return { ok: true, html, finalUrl: res.url || url };
  } catch {
    return { ok: false, finalUrl: url };
  }
}

export default async (req) => {
  const q = (new URL(req.url).searchParams.get("q") || "").trim().slice(0, 120);
  if (q.length < 3) return json({ error: "Enter a business name and city." }, 400);

  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return json({ error: "The scorecard isn't switched on yet. Please check back soon." }, 503);

  let place;
  try {
    const res = await fetchWithTimeout(
      PLACES_URL,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "X-Goog-Api-Key": key,
          "X-Goog-FieldMask": FIELDS,
        },
        body: JSON.stringify({ textQuery: q, pageSize: 1, regionCode: "US" }),
      },
      6000
    );
    if (!res.ok) {
      console.error("Places error", res.status, await res.text());
      return json({ error: "We couldn't look that up right now. Try again in a minute." }, 502);
    }
    place = ((await res.json()).places || [])[0];
  } catch (e) {
    console.error("Places fetch failed", e);
    return json({ error: "We couldn't look that up right now. Try again in a minute." }, 502);
  }

  if (!place) return json({ error: "We couldn't find that business on Google. Try adding the city or street." }, 404);

  const site = place.websiteUri ? await fetchSite(place.websiteUri) : null;
  const website = site ? analyzeWebsite(site) : null;
  const result = scoreBusiness(place, website);

  return json(result);
};
