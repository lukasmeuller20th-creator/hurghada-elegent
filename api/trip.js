import { loadTrips, inLang, esc, SITE, LANGS } from "./_lib.js";
const UI = {
  en: { book: "Check availability & book", from: "from", pp: "per person", hl: "Highlights", it: "Itinerary", inc: "Included", exc: "Not included", more: "More trips", dur: "Duration", pick: "Free hotel pickup · Pay 20% now · Free cancellation up to 24 h" },
  de: { book: "Verfügbarkeit prüfen & buchen", from: "ab", pp: "pro Person", hl: "Highlights", it: "Ablauf", inc: "Inklusive", exc: "Nicht inklusive", more: "Weitere Ausflüge", dur: "Dauer", pick: "Kostenlose Hotelabholung · 20 % anzahlen · kostenlos stornieren bis 24 Std. vorher" },
  fr: { book: "Voir les disponibilités et réserver", from: "dès", pp: "par personne", hl: "Points forts", it: "Programme", inc: "Inclus", exc: "Non inclus", more: "Autres excursions", dur: "Durée", pick: "Prise en charge à l'hôtel · 20 % à la réservation · annulation gratuite jusqu'à 24 h" },
  ru: { book: "Проверить даты и забронировать", from: "от", pp: "с человека", hl: "Главное", it: "Программа", inc: "Включено", exc: "Не включено", more: "Другие экскурсии", dur: "Длительность", pick: "Бесплатный трансфер из отеля · предоплата 20 % · бесплатная отмена за 24 ч" },
  ar: { book: "شوف المواعيد واحجز", from: "من", pp: "للفرد", hl: "أهم المميزات", it: "البرنامج", inc: "يشمل", exc: "لا يشمل", more: "رحلات تانية", dur: "المدة", pick: "بيك أب مجاني من الفندق · ادفع 20% بس · إلغاء مجاني لحد 24 ساعة" }
};
export default async function handler(req, res) {
  const id = String(req.query.id || ""), L = LANGS.includes(req.query.lang) ? req.query.lang : "en", U = UI[L];
  const trips = await loadTrips(), t = trips.find(x => x.id === id);
  if (!t) { res.statusCode = 302; res.setHeader("Location", "/"); return res.end(); }
  const X = inLang(t, L), url = `${SITE}${L === "en" ? "" : "/" + L}/t/${t.id}`, img = t.photos[0] || `${SITE}/og.png`;
  const ld = { "@context": "https://schema.org", "@type": "TouristTrip", name: X.name, description: X.short, url, image: t.photos.length ? t.photos : undefined, touristType: t.cat,
    provider: { "@type": "TravelAgency", name: "Hurghada Elegant", telephone: "+201515989383", url: SITE, address: { "@type": "PostalAddress", addressLocality: "Hurghada", addressCountry: "EG" } },
    offers: { "@type": "Offer", price: t.price, priceCurrency: "EUR", availability: "https://schema.org/InStock", url } };
  const alt = LANGS.map(l => `<link rel="alternate" hreflang="${l}" href="${SITE}${l === "en" ? "" : "/" + l}/t/${t.id}">`).join("") + `<link rel="alternate" hreflang="x-default" href="${SITE}/t/${t.id}">`;
  const others = trips.filter(x => x.id !== t.id).slice(0, 6).map(x => `<a class="o" href="${L === "en" ? "" : "/" + L}/t/${x.id}">${esc(inLang(x, L).name)} · ${U.from} €${x.price}</a>`).join("");
  const html = `<!DOCTYPE html><html lang="${L}" dir="${L === "ar" ? "rtl" : "ltr"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(X.name)} | Hurghada Elegant</title><meta name="description" content="${esc(X.short || X.name)} — ${esc(U.pick)}">
<link rel="canonical" href="${url}">${alt}
<meta property="og:type" content="product"><meta property="og:title" content="${esc(X.name)}"><meta property="og:description" content="${esc(X.short)}"><meta property="og:url" content="${url}"><meta property="og:image" content="${esc(img)}"><meta property="og:site_name" content="Hurghada Elegant"><meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>
<style>body{margin:0;font:16px/1.55 -apple-system,system-ui,Segoe UI,Roboto,sans-serif;background:#f2f2f7;color:#111}main{max-width:720px;margin:0 auto;padding:0 0 110px}.hero{height:300px;background:linear-gradient(160deg,#0a6c7a,#06343d) center/cover}.c{background:#fff;border-radius:16px;margin:12px 16px;padding:16px 18px}h1{font-size:28px;line-height:1.15;margin:16px 18px 6px}.p{margin:0 18px;color:#555}h2{font-size:18px;margin:0 0 8px}ul{margin:0;padding-inline-start:20px}.cta{position:fixed;inset:auto 0 0;background:#fff;border-top:1px solid #ddd;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px}.cta b{font-size:22px}.btn{background:#0a6c7a;color:#fff;text-decoration:none;font-weight:600;padding:14px 20px;border-radius:14px}.o{display:block;padding:10px 0;border-bottom:1px solid #eee;color:#0a6c7a;text-decoration:none}.lang a{margin-inline-end:10px;color:#0a6c7a}</style></head>
<body><main><div class="hero" style="${t.photos[0] ? `background-image:url('${esc(t.photos[0])}')` : ""}"></div>
<h1>${esc(X.name)}</h1><p class="p">${esc(X.short)}</p><p class="p">${U.dur}: ${esc(t.dur)} · ${esc(U.pick)}</p>
${X.hi.length ? `<div class="c"><h2>${U.hl}</h2><ul>${X.hi.map(h => `<li>${esc(h)}</li>`).join("")}</ul></div>` : ""}
${X.it.length ? `<div class="c"><h2>${U.it}</h2><ul>${X.it.map(s => `<li><b>${esc(s[0])}</b> — ${esc(s[1])}</li>`).join("")}</ul></div>` : ""}
${t.inc.length ? `<div class="c"><h2>${U.inc}</h2><ul>${t.inc.map(h => `<li>${esc(h)}</li>`).join("")}</ul>${t.exc.length ? `<h2 style="margin-top:12px">${U.exc}</h2><ul>${t.exc.map(h => `<li>${esc(h)}</li>`).join("")}</ul>` : ""}</div>` : ""}
<div class="c"><h2>${U.more}</h2>${others}</div>
<div class="c lang">${LANGS.map(l => `<a href="${l === "en" ? "" : "/" + l}/t/${t.id}" hreflang="${l}">${l.toUpperCase()}</a>`).join("")}</div>
</main><div class="cta"><div>${U.from} <b>€${t.price}</b> ${U.pp}</div><a class="btn" href="/?lang=${L}#trip-${t.id}">${U.book}</a></div></body></html>`;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=600, stale-while-revalidate=86400");
  res.end(html);
}
