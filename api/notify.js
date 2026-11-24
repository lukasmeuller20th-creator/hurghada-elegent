// Sends the owner a Telegram message for every real new booking.
// Vercel env vars: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID (comma-separated for several people)
const SB_URL = "https://menutaudynvwvvebsfkk.supabase.co";
const SB_KEY = "sb_publishable_9AOh9WJsEVEAN1GEtE6knA_KL9Vy9cq";
const SENT = new Set();
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { id = "", key = "" } = req.body || {};
  if (!/^TR-[A-Z0-9]{3,10}$/.test(id) || !/^\d{4}$/.test(key)) return res.status(400).json({ error: "bad request" });
  if (SENT.has(id)) return res.status(200).json({ ok: true });
  const token = process.env.TELEGRAM_BOT_TOKEN, chats = (process.env.TELEGRAM_CHAT_ID || "").split(",").map(s => s.trim()).filter(Boolean);
  if (!token || !chats.length) return res.status(503).json({ error: "telegram not configured" });
  // only notify for bookings that really exist in the database
  const r = await fetch(`${SB_URL}/rest/v1/rpc/get_booking`, { method: "POST", headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "content-type": "application/json" }, body: JSON.stringify({ p_id: id, p_key: key }) });
  const b = r.ok ? await r.json() : null;
  if (!b || !b.id) return res.status(404).json({ error: "not found" });
  SENT.add(id); if (SENT.size > 5000) SENT.clear();
  const pax = (+b.adults || 0) + (+b.children || 0);
  const text = [`🆕 New booking ${b.id}`, `👤 ${b.name || "-"}  📞 ${b.phone || "-"}`, `🚤 ${b.tripId} · ${b.date} ${b.slot || ""}`, `🏨 ${b.hotel || "-"} ${b.room || ""} · pickup ${b.pickup || "-"}`, `👥 ${pax} pax · 💶 €${b.total} (deposit €${b.deposit || 0})`, `https://www.hurghada-elegant.com/#biz-bk`].join("\n");
  await Promise.all(chats.map(c => fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chat_id: c, text, disable_web_page_preview: true }) }).catch(() => null)));
  return res.status(200).json({ ok: true });
}
