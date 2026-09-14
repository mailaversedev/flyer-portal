const express = require("express");

const PAGE_SIZE = 12;
const SCAN_BATCH_SIZE = 48;

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const escapeJsonForHtml = (value) =>
  JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e");

const escapeXml = (value) => escapeHtml(value);

const toPlainText = (value, maxLength = 600) => {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
};

const getSafeUrl = (value) => {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  try {
    const url = new URL(value.trim());
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch (_error) {
    return null;
  }
};

const getFlyerTitle = (flyer) => {
  if (typeof flyer.header === "string" && flyer.header.trim()) {
    return toPlainText(flyer.header, 160);
  }

  const titles = {
    leaflet: "Leaflet promotion",
    query: "Survey promotion",
    qr: "QR code promotion",
  };

  return titles[flyer.type] || "Promotion";
};

const getCompanyName = (flyer) => {
  const names = [flyer.companyDisplayName, flyer.companyName];
  const name = names.find(
    (value) => typeof value === "string" && value.trim(),
  );

  return name ? toPlainText(name, 100) : "Mailaverse partner";
};

const isVisiblePublicFlyer = (flyer, nowMs) => {
  if (!flyer.scheduledAt) {
    return true;
  }

  const scheduledAtMs = new Date(flyer.scheduledAt).getTime();
  return Number.isNaN(scheduledAtMs) || scheduledAtMs <= nowMs;
};

const getPublicOrigin = (req) => {
  const configuredUrl = getSafeUrl(process.env.PUBLIC_SITE_URL);
  if (configuredUrl) {
    return new URL(configuredUrl).origin;
  }

  const forwardedProtocol = req.get("x-forwarded-proto")?.split(",")[0];
  const protocol = forwardedProtocol || req.protocol || "https";
  const host = req.get("host");
  return `${protocol}://${host}`;
};

const getPageUrl = (page) =>
  page === 1 ? "/promotions" : `/promotions/page/${page}`;

async function getPromotionPage(db, page) {
  const numberOfFlyersNeeded = page * PAGE_SIZE + 1;
  const visibleFlyers = [];
  const nowMs = Date.now();
  let lastDocument = null;
  let hasMoreDocuments = true;

  while (visibleFlyers.length < numberOfFlyersNeeded && hasMoreDocuments) {
    let query = db
      .collection("flyers")
      .orderBy("createdAt", "desc")
      .limit(SCAN_BATCH_SIZE);

    if (lastDocument) {
      query = query.startAfter(lastDocument);
    }

    const snapshot = await query.get();
    hasMoreDocuments = snapshot.size === SCAN_BATCH_SIZE;

    snapshot.forEach((document) => {
      const flyer = document.data() || {};
      if (isVisiblePublicFlyer(flyer, nowMs)) {
        visibleFlyers.push({ id: document.id, ...flyer });
      }
    });

    lastDocument = snapshot.docs[snapshot.docs.length - 1] || null;
    if (!lastDocument) {
      break;
    }
  }

  const firstItemIndex = (page - 1) * PAGE_SIZE;
  return {
    flyers: visibleFlyers.slice(firstItemIndex, firstItemIndex + PAGE_SIZE),
    hasNextPage: visibleFlyers.length > firstItemIndex + PAGE_SIZE,
  };
}

const renderPromotionCard = (flyer) => {
  const title = getFlyerTitle(flyer);
  const companyName = getCompanyName(flyer);
  const description = toPlainText(
    flyer.productDescriptions || flyer.adContent || "",
  );
  const coverPhoto = getSafeUrl(flyer.coverPhoto);
  const companyIcon = getSafeUrl(flyer.companyIcon);
  const destination = getSafeUrl(flyer.website);
  const location = toPlainText(flyer.location, 160);
  const startingDate = toPlainText(flyer.startingDate, 80);
  const tags = Array.isArray(flyer.tags)
    ? flyer.tags
        .filter((tag) => typeof tag === "string" && tag.trim())
        .slice(0, 8)
    : [];
  const lottery = flyer.lottery && typeof flyer.lottery === "object" ? flyer.lottery : null;
  const lotteryMoney = Number(lottery?.lotteryMoney);
  const remaining = Number(lottery?.remaining);
  const hasReward = !flyer.noReward && Number.isFinite(lotteryMoney) && lotteryMoney > 0;
  const rewardProgress = hasReward && Number.isFinite(remaining)
    ? Math.min(100, Math.max(0, (remaining / lotteryMoney) * 100))
    : 0;
  const rewardText = hasReward
    ? `${Number.isFinite(remaining) ? remaining.toLocaleString() : "0"} of ${lotteryMoney.toLocaleString()} tokens remaining`
    : "";
  const companyDetails = flyer.hideCompanyDetail
    ? ""
    : `<div class="company"><span class="company-avatar">${
        companyIcon
          ? `<img src="${escapeHtml(companyIcon)}" alt="" loading="lazy" />`
          : escapeHtml(companyName.slice(0, 1).toUpperCase())
      }</span><span>${escapeHtml(companyName)}</span></div>`;
  const tagsMarkup = tags.length
    ? `<ul class="tags" aria-label="Promotion topics">${tags
        .map((tag) => `<li>${escapeHtml(toPlainText(tag, 40))}</li>`)
        .join("")}</ul>`
    : "";
  const rewardMarkup = hasReward
    ? `<div class="reward" aria-label="${escapeHtml(rewardText)}"><div class="reward-label"><span>Rewards remaining</span><span>${escapeHtml(rewardText)}</span></div><div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(rewardProgress)}"><span style="width: ${rewardProgress}%"></span></div></div>`
    : "";
  const details = [
    description ? `<p class="description">${escapeHtml(description)}</p>` : "",
    tagsMarkup,
    location ? `<p class="detail-row"><strong>Location</strong><span>${escapeHtml(location)}</span></p>` : "",
    startingDate ? `<p class="detail-row"><strong>Starts</strong><span>${escapeHtml(startingDate)}</span></p>` : "",
    destination
      ? `<a class="visit-link" href="${escapeHtml(destination)}" target="_blank" rel="noopener noreferrer">Visit promotion <span aria-hidden="true">↗</span></a>`
      : "",
  ].join("");

  return `<article class="promotion-card" id="flyer-${escapeHtml(flyer.id)}">
    <div class="cover ${coverPhoto ? "" : "cover-placeholder"}">
      ${coverPhoto ? `<img src="${escapeHtml(coverPhoto)}" alt="${escapeHtml(title)}" loading="lazy" />` : `<span>Mailaverse</span>`}
      <span class="type-badge">${escapeHtml(toPlainText(flyer.type || "Promotion", 30))}</span>
    </div>
    <div class="card-content">
      <h2>${escapeHtml(title)}</h2>
      ${companyDetails}
      ${rewardMarkup}
      <details>
        <summary>View promotion details</summary>
        <div class="details-content">${details || "<p class=\"description\">Details will be available soon.</p>"}</div>
      </details>
    </div>
  </article>`;
};

const renderPage = ({ flyers, page, hasNextPage, origin }) => {
  const pagePath = getPageUrl(page);
  const canonicalUrl = `${origin}${pagePath}`;
  const title = page === 1 ? "Latest Flyer Promotions | Mailaverse" : `Flyer Promotions – Page ${page} | Mailaverse`;
  const description = "Browse Mailaverse flyer promotions, offers, surveys, and reward opportunities from local businesses.";
  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Mailaverse flyer promotions",
    numberOfItems: flyers.length,
    itemListElement: flyers.map((flyer, index) => ({
      "@type": "ListItem",
      position: (page - 1) * PAGE_SIZE + index + 1,
      name: getFlyerTitle(flyer),
      url: `${canonicalUrl}#flyer-${flyer.id}`,
    })),
  };
  const previousPage = page > 1 ? page - 1 : null;
  const nextPage = hasNextPage ? page + 1 : null;
  const pagination = previousPage || nextPage
    ? `<nav class="pagination" aria-label="Promotion pages">
        ${previousPage ? `<a href="${getPageUrl(previousPage)}" rel="prev">← Newer promotions</a>` : ""}
        <span>Page ${page}</span>
        ${nextPage ? `<a href="${getPageUrl(nextPage)}" rel="next">Older promotions →</a>` : ""}
      </nav>`
    : "";
  const cards = flyers.length
    ? flyers.map(renderPromotionCard).join("\n")
    : `<section class="empty-state"><h2>No current promotions yet</h2><p>Please check back soon for new offers.</p></section>`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="theme-color" content="#1a1f37" />
  <meta name="description" content="${escapeHtml(description)}" />
  <meta name="robots" content="index,follow,max-image-preview:large" />
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
  ${previousPage ? `<link rel="prev" href="${escapeHtml(`${origin}${getPageUrl(previousPage)}`)}" />` : ""}
  ${nextPage ? `<link rel="next" href="${escapeHtml(`${origin}${getPageUrl(nextPage)}`)}" />` : ""}
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Mailaverse" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
  <meta name="twitter:card" content="summary" />
  <title>${escapeHtml(title)}</title>
  <script type="application/ld+json">${escapeJsonForHtml(itemList)}</script>
  <style>
    :root { color-scheme: dark; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #1a1f37; color: #f8fafc; }
    * { box-sizing: border-box; }
    body { margin: 0; min-width: 320px; background: radial-gradient(circle at 50% -15%, #30395d 0, #1a1f37 45rem); }
    a { color: inherit; }
    .shell { width: min(1200px, calc(100% - 32px)); margin: 0 auto; padding: 32px 0 56px; }
    .site-header { display: flex; align-items: center; gap: 12px; margin-bottom: 28px; }
    .brand-mark { display: grid; place-items: center; width: 38px; height: 38px; border-radius: 12px; background: linear-gradient(135deg, #f59e0b, #f76b1c); color: #1a1f37; font-weight: 800; }
    .brand-name { font-size: 1.05rem; font-weight: 750; letter-spacing: .01em; }
    .eyebrow { margin: 0 0 8px; color: #fbbf24; font-size: .78rem; font-weight: 800; letter-spacing: .11em; text-transform: uppercase; }
    h1 { max-width: 760px; margin: 0; font-size: clamp(2rem, 5vw, 3.45rem); line-height: 1.06; letter-spacing: -.035em; }
    .intro { max-width: 670px; margin: 14px 0 30px; color: #cbd5e1; font-size: 1.05rem; line-height: 1.65; }
    .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; }
    .promotion-card { min-width: 0; overflow: hidden; border: 1px solid rgba(255, 255, 255, .12); border-radius: 18px; background: rgba(25, 31, 55, .88); box-shadow: 0 14px 30px rgba(0, 0, 0, .18); }
    .cover { position: relative; aspect-ratio: 1.45 / 1; overflow: hidden; background: #27304f; }
    .cover > img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .cover-placeholder { display: grid; place-items: center; background: linear-gradient(135deg, #3b476f, #202842); color: #fbbf24; font-size: 1.15rem; font-weight: 800; }
    .type-badge { position: absolute; top: 12px; right: 12px; padding: 5px 9px; border: 1px solid rgba(255,255,255,.16); border-radius: 999px; background: rgba(13, 18, 35, .76); font-size: .72rem; font-weight: 700; text-transform: capitalize; }
    .card-content { padding: 16px; }
    h2 { margin: 0; font-size: 1.05rem; line-height: 1.38; }
    .company { display: flex; align-items: center; gap: 8px; min-width: 0; margin-top: 13px; color: #cbd5e1; font-size: .86rem; }
    .company-avatar { display: grid; flex: 0 0 auto; place-items: center; width: 27px; height: 27px; overflow: hidden; border-radius: 50%; background: #39466e; color: #fbbf24; font-size: .73rem; font-weight: 800; }
    .company-avatar img { width: 100%; height: 100%; object-fit: cover; }
    .reward { margin-top: 16px; }
    .reward-label { display: flex; justify-content: space-between; gap: 8px; color: #cbd5e1; font-size: .72rem; }
    .reward-label span:last-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #f8fafc; }
    .progress { height: 6px; margin-top: 7px; overflow: hidden; border-radius: 999px; background: #46516f; }
    .progress span { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, #fbbf24, #f59e0b); }
    details { margin-top: 17px; border-top: 1px solid rgba(255,255,255,.1); padding-top: 14px; }
    summary { cursor: pointer; color: #fbbf24; font-size: .88rem; font-weight: 750; }
    summary:focus-visible, a:focus-visible { outline: 3px solid #fbbf24; outline-offset: 3px; border-radius: 4px; }
    .details-content { padding-top: 13px; }
    .description { margin: 0; color: #dbe4ef; font-size: .9rem; line-height: 1.55; }
    .tags { display: flex; flex-wrap: wrap; gap: 6px; margin: 14px 0 0; padding: 0; list-style: none; }
    .tags li { padding: 4px 8px; border-radius: 999px; background: #303a5b; color: #dbe4ef; font-size: .72rem; }
    .detail-row { display: grid; grid-template-columns: 76px 1fr; gap: 8px; margin: 12px 0 0; color: #cbd5e1; font-size: .84rem; line-height: 1.45; }
    .detail-row strong { color: #f8fafc; }
    .visit-link { display: inline-flex; gap: 7px; margin-top: 16px; color: #1a1f37; background: #fbbf24; padding: 9px 12px; border-radius: 9px; text-decoration: none; font-size: .83rem; font-weight: 800; }
    .pagination { display: flex; align-items: center; justify-content: center; gap: 18px; margin: 36px 0 0; color: #cbd5e1; font-size: .9rem; }
    .pagination a { color: #fbbf24; font-weight: 750; text-decoration: none; }
    .empty-state { padding: 52px 24px; border: 1px dashed rgba(255,255,255,.24); border-radius: 18px; text-align: center; color: #cbd5e1; }
    .empty-state h2 { color: #f8fafc; font-size: 1.2rem; }
    .empty-state p { margin: 8px 0 0; }
    @media (max-width: 860px) { .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 540px) { .shell { width: min(100% - 24px, 1200px); padding-top: 20px; } .grid { grid-template-columns: 1fr; gap: 16px; } .intro { font-size: .98rem; } .pagination { gap: 12px; justify-content: space-between; } }
    @media (prefers-reduced-motion: reduce) { *, *::before, *::after { scroll-behavior: auto !important; } }
  </style>
</head>
<body>
  <main class="shell">
    <header class="site-header"><span class="brand-mark" aria-hidden="true">M</span><span class="brand-name">Mailaverse</span></header>
    <section aria-labelledby="promotions-heading">
      <p class="eyebrow">Discover local offers</p>
      <h1 id="promotions-heading">Current flyer promotions</h1>
      <p class="intro">Explore active offers, surveys, and reward opportunities from businesses on Mailaverse. Open a card to read the full promotion details.</p>
    </section>
    <section class="grid" aria-label="Flyer promotions">${cards}</section>
    ${pagination}
  </main>
</body>
</html>`;
};

module.exports = function createPublicPromotionsRouter({ db }) {
  const router = express.Router();

  const renderPromotions = async (req, res) => {
    const pageValue = req.params.page || "1";
    const page = Number(pageValue);
    if (!/^[1-9]\d*$/.test(pageValue) || !Number.isSafeInteger(page)) {
      return res.status(404).send("Promotion page not found.");
    }

    if (req.params.page && page === 1) {
      return res.redirect(301, "/promotions");
    }

    try {
      const promotionPage = await getPromotionPage(db, page);
      if (page > 1 && promotionPage.flyers.length === 0) {
        return res.status(404).send("Promotion page not found.");
      }

      res.set("Cache-Control", "public, max-age=300, s-maxage=900");
      return res.type("html").send(
        renderPage({
          ...promotionPage,
          page,
          origin: getPublicOrigin(req),
        }),
      );
    } catch (error) {
      console.error("Unable to render public promotions:", error);
      return res.status(500).type("html").send("Unable to load promotions.");
    }
  };

  router.get("/promotions", renderPromotions);
  router.get("/promotions/page/:page", renderPromotions);
  router.get("/sitemap.xml", (req, res) => {
    const origin = getPublicOrigin(req);
    res.type("application/xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${escapeXml(`${origin}/promotions`)}</loc></url>
</urlset>`);
  });

  return router;
};