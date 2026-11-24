import { loadTrips, SITE, LANGS } from "./_lib.js";
export default async function handler(req, res) {
  const trips = await loadTrips(), d = new Date().toISOString().slice(0, 10);
  const urls = [`<url><loc>${SITE}/</loc><lastmod>${d}</lastmod><priority>1.0</priority></url>`];
  for (const t of trips) for (const l of LANGS) urls.push(`<url><loc>${SITE}${l === "en" ? "" : "/" + l}/t/${t.id}</loc><lastmod>${d}</lastmod><priority>0.8</priority></url>`);
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=3600");
  res.end(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join("")}</urlset>`);
}
