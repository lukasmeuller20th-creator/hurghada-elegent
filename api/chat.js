// Vercel serverless function: trip assistant. Keys live in Vercel env vars, never in the page.
// Set ONE of: GEMINI_API_KEY (free tier at aistudio.google.com) or ANTHROPIC_API_KEY.
const HITS = new Map(); // best-effort per-instance rate limit
const ALLOWED = /^https:\/\/(www\.)?hurghada-elegant\.com$|^https:\/\/[a-z0-9-]+\.vercel\.app$/;
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const origin = req.headers.origin || "";
  if (origin && !ALLOWED.test(origin)) return res.status(403).json({ error: "forbidden" });
  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "x";
  const now = Date.now(), h = (HITS.get(ip) || []).filter(t => now - t < 60000);
  if (h.length >= 15) return res.status(429).json({ error: "slow down" });
  h.push(now); HITS.set(ip, h); if (HITS.size > 5000) HITS.clear();
  const { messages = [], catalogue = "", lang = "en" } = req.body || {};
  const msgs = messages.slice(-12).map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content || "").slice(0, 1000) }));
  if (!msgs.length) return res.status(400).json({ error: "no message" });
  const sys = `You are the friendly trip assistant of Hurghada Elegant, a tour company in Hurghada, Egypt.
Always answer in the language the guest writes in (site language: ${lang}).
Help guests choose trips and build day-by-day programs ONLY from the catalogue below. Never invent trips, prices or policies.
When you mention a trip, write its id in double brackets like [[orangebay]] right after the name so it becomes a booking link.
If the guest just greets, greet back warmly and ask who is travelling, what they enjoy and how many days they have.
For a program: one trip per day, mix types, avoid two long trips back to back, give the total price per person.
Policies: hotel pickup included, pay 20% deposit online and the rest at pickup, free cancellation up to 24 hours before.
Keep answers under 120 words, simple formatting with short lines.
Catalogue (id: name — description, price per adult, duration, type):
${String(catalogue).slice(0, 6000)}`;
  try {
    let text = "";
    if (process.env.ANTHROPIC_API_KEY) {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || "claude-haiku-5-5", max_tokens: 500, system: sys, messages: msgs })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error?.message || "anthropic error");
      text = (d.content || []).map(c => c.text || "").join("");
    } else if (process.env.GEMINI_API_KEY) {
      const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: sys }] }, contents: msgs.map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })), generationConfig: { maxOutputTokens: 600, temperature: 0.6 } })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error?.message || "gemini error");
      text = (d.candidates?.[0]?.content?.parts || []).map(p => p.text || "").join("");
    } else return res.status(503).json({ error: "no AI key configured" });
    return res.status(200).json({ text });
  } catch (e) { return res.status(502).json({ error: String(e.message || e) }); }
}
