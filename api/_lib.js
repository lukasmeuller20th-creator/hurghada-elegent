import BASE from "./_trips.js";
export const SITE = "https://www.hurghada-elegant.com";
export const LANGS = ["en", "de", "fr", "ru", "ar"];
const SB_URL = "https://menutaudynvwvvebsfkk.supabase.co";
const SB_KEY = "sb_publishable_9AOh9WJsEVEAN1GEtE6knA_KL9Vy9cq";
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export async function loadTrips() {
  let cfg = {};
  try {
    const r = await fetch(`${SB_URL}/rest/v1/docs?col=eq.tripcfg&select=id,data`, { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } });
    if (r.ok) for (const row of await r.json()) cfg[row.id] = row.data || {};
  } catch (e) {}
  const trips = BASE.map(t => JSON.parse(JSON.stringify(t)));
  for (const [id, c] of Object.entries(cfg)) {
    if (!trips.find(t => t.id === id) && c.custom && c.content) trips.push({ id, cat: "sea", price: c.price || 30, dur: "4 h", time: "09:00", t: { en: "" }, s: { en: "" }, hi: [], inc: [], exc: [], it: [] });
  }
  return trips.map(t => {
    const c = cfg[t.id] || {}, ct = c.content || {};
    if (ct.title) t.t = Object.assign({}, ct.tTr || {}, { en: ct.title });
    if (ct.short != null) t.s = Object.assign({}, ct.sTr || {}, { en: ct.short });
    for (const k of ["hi", "inc", "exc", "it"]) if (Array.isArray(ct[k])) t[k] = ct[k];
    if (ct.dur) t.dur = ct.dur; if (ct.cat) t.cat = ct.cat;
    if (c.price) t.price = c.price;
    if ("request" in ct) t.request = !!ct.request;
    t.request = !!t.request || !(t.price > 0);
    t.active = c.active !== false;
    t.photos = (c.photos || []).filter(p => /^https:\/\//.test(p));
    if (!t.photos.length && t.img) t.photos = t.img.map(p => SITE + p);
    t.tr = c.tr || {};
    return t;
  }).filter(t => t.active && t.t.en);
}
export function inLang(t, L) {
  const X = (t.tr && t.tr[L]) || (t.trB && t.trB[L]) || {};
  return {
    name: (t.t && t.t[L]) || X.t || t.t.en,
    short: X.s || (t.s && t.s[L]) || t.s.en || "",
    hi: (X.hi && X.hi.length ? X.hi : t.hi) || [],
    it: (X.it && X.it.length ? X.it : t.it) || []
  };
}
