const { test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const sharp = require("sharp");
const createRouter = require("../routes/admin/jetsoPosts");
const { createPostDb } = require("./helpers/jetsoPostsFixture");
const { normalizeDraft, publicContent } = require("../services/jetsoPostContent");
const { unreferencedImages } = require("../scripts/reportJetsoBlogImages");

const body = (text = "Campaign description") => ({
  version: 1, doc: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] },
});
const draft = (header = "Marketing article") => ({
  header, body: body(), coverPhoto: "https://images.example/cover.webp", tags: ["Campaign"],
});

async function withRouter(t) {
  const db = createPostDb();
  const savedImages = [];
  const bucket = {
    name: "test-bucket",
    file(path) { return { async save(buffer, options) { savedImages.push({ path, buffer, options }); } }; },
  };
  const app = express();
  app.use(express.json({ limit: "2mb" }));
  app.use((req, _res, next) => {
    if (req.get("x-role") !== "anonymous") req.user = { userId: "admin-a", role: req.get("x-role") || "super-admin" };
    next();
  });
  app.use("/api/admin", createRouter({ db, bucket }));
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(() => new Promise((resolve) => {
    server.close(resolve);
    server.closeAllConnections();
  }));
  const request = (path = "", options = {}) => fetch(`http://127.0.0.1:${server.address().port}/api/admin/jetso-posts${path}`, {
    ...options,
    headers: { ...(options.body instanceof FormData ? {} : { "content-type": "application/json" }), ...options.headers },
  });
  const json = async (path, method, data) => request(path, { method, body: JSON.stringify(data) });
  return { db, savedImages, request, json };
}

test("articles are isolated, revision-protected, and have explicit public snapshots", async (t) => {
  const { db, request, json } = await withRouter(t);
  const createdResponse = await json("", "POST", { draft: draft() });
  assert.equal(createdResponse.status, 201);
  const created = (await createdResponse.json()).data;
  assert.equal(created.status, "draft");
  assert.equal(created.publicSnapshot, null);
  assert.equal(created.kind, "blog");
  assert.equal(created.channel, "jetso");
  assert.equal(created.createdBy, "admin-a");
  assert.equal(created.draft.hideCompanyDetail, true);
  assert.equal(db.collections.jetsoPosts.size, 1);

  const publish = await json(`/${created.id}/publish`, "POST", { revision: 1 });
  assert.equal(publish.status, 200);
  const published = (await publish.json()).data;
  assert.equal(published.publicSnapshot.header, "Marketing article");
  assert.equal(published.publicSnapshot.body, undefined);
  assert.equal(published.status, "published");

  const save = await json(`/${created.id}`, "PUT", { revision: 2, draft: draft("PRIVATE EDIT") });
  assert.equal(save.status, 200);
  const edited = (await save.json()).data;
  assert.equal(edited.draft.header, "PRIVATE EDIT");
  assert.equal(edited.publicSnapshot.header, "Marketing article");
  assert.equal(edited.publicSnapshot.updatedAt, published.publicSnapshot.updatedAt);
  assert.equal((await json(`/${created.id}`, "PUT", { revision: 2, draft: draft("STALE") })).status, 409);

  const republish = (await (await json(`/${created.id}/publish`, "POST", { revision: 3 })).json()).data;
  assert.equal(republish.publicSnapshot.header, "PRIVATE EDIT");
  assert.equal(republish.publicSnapshot.publishedAt, published.publicSnapshot.publishedAt);
  const unpublished = await json(`/${created.id}/unpublish`, "POST", { revision: 4 });
  assert.equal(unpublished.status, 200);
  assert.equal((await unpublished.json()).data.publicSnapshot, null);
  const archived = await json(`/${created.id}/archive`, "POST", { revision: 5 });
  assert.equal((await archived.json()).data.status, "archived");
  assert.equal((await request(`/${created.id}`)).headers.get("cache-control"), "no-store");
});

test("concurrent edits cannot overwrite the same revision", async (t) => {
  const { json } = await withRouter(t);
  const post = (await (await json("", "POST", { draft: draft() })).json()).data;
  const updates = await Promise.all([
    json(`/${post.id}`, "PUT", { revision: 1, draft: draft("First edit") }),
    json(`/${post.id}`, "PUT", { revision: 1, draft: draft("Other edit") }),
  ]);
  assert.deepEqual(updates.map((response) => response.status).sort(), [200, 409]);
});

test("auth, allowlisted fields and publication prerequisites are enforced", async (t) => {
  const { request, json } = await withRouter(t);
  for (const [role, status] of [["anonymous", 401], ["merchant", 403]]) {
    assert.equal((await request("", { headers: { "x-role": role } })).status, status);
    assert.equal((await request("/images", { method: "POST", headers: { "x-role": role } })).status, status);
  }
  assert.equal((await json("", "POST", { draft: { ...draft(), status: "published" } })).status, 400);
  assert.equal((await json("", "POST", { draft: draft(), createdBy: "other" })).status, 400);
  assert.equal((await request("/missing")).status, 404);
  assert.equal((await request("?limit=101")).status, 400);
  assert.equal((await json("", "POST", { draft: { ...draft(), companyId: "missing" } })).status, 400);
  for (const input of [{ body: false }, { coverPhoto: false }, { companyId: 0 }, { tags: "topic" }]) {
    assert.equal((await json("", "POST", { draft: input })).status, 400);
  }
  const empty = (await (await json("", "POST", { draft: {} })).json()).data;
  assert.equal((await json(`/${empty.id}/publish`, "POST", { revision: 1 })).status, 400);
});

test("scheduling accepts valid times but rejects malformed dates and live replacements", async (t) => {
  const { json } = await withRouter(t);
  for (const scheduledAt of ["not-a-date", "2026-02-30T12:00:00Z", "2026-02-28T24:00:00Z", "2026-02-28T12:00:00"]) {
    assert.equal((await json("", "POST", { draft: { ...draft(), scheduledAt } })).status, 400);
  }
  const scheduledAt = "2099-01-01T00:00:00.000Z";
  const scheduled = (await (await json("", "POST", { draft: { ...draft(), scheduledAt } })).json()).data;
  const published = (await (await json(`/${scheduled.id}/publish`, "POST", { revision: 1 })).json()).data;
  assert.equal(published.publicSnapshot.scheduledAt, scheduledAt);
  assert.equal(published.publicSnapshot.publishedAt, scheduledAt);
  const live = (await (await json("", "POST", { draft: draft() })).json()).data;
  await json(`/${live.id}/publish`, "POST", { revision: 1 });
  await json(`/${live.id}`, "PUT", { revision: 2, draft: { ...draft(), scheduledAt } });
  assert.equal((await json(`/${live.id}/publish`, "POST", { revision: 3 })).status, 400);
});

test("formatted article/image/translation data survives validation and static HTML", () => {
  const input = draft();
  input.body.doc.content = [
    { type: "heading", attrs: { level: 2, textAlign: "right" }, content: [{ type: "text", text: "Heading" }] },
    { type: "paragraph", content: [{ type: "text", text: "<script>alert(1)</script>", marks: [{ type: "bold" }, { type: "link", attrs: { href: "https://example.com", target: "_self" } }] }] },
    { type: "image", attrs: { src: "https://images.example/inline.webp", alt: "Alt", caption: "Caption & text", width: 320, height: 240, widthPercent: 50, align: "right" } },
  ];
  input.translations = { "zh-Hant-HK": { header: "Translated title", body: body("Translated body") } };
  const normalized = normalizeDraft(input);
  assert.match(normalized.bodyHtml, /text-align:right/);
  assert.match(normalized.bodyHtml, /<strong><a|<a.*<strong>/);
  assert.match(normalized.bodyHtml, /rel="noopener noreferrer"/);
  assert.doesNotMatch(normalized.bodyHtml, /<script>/);
  assert.match(normalized.bodyHtml, /width:50%/);
  assert.match(normalized.bodyHtml, /data-align="right"/);
  assert.match(normalized.bodyHtml, /width="320" height="240"/);
  assert.match(normalized.bodyHtml, /<figcaption>Caption &amp; text/);
  assert.equal(normalized.body.doc.content[2].attrs.caption, "Caption & text");
  assert.match(normalized.translations["zh-Hant-HK"].bodyHtml, /Translated body/);
});

test("title-only translations retain the original body fallback", () => {
  const normalized = normalizeDraft({
    ...draft(), translations: { "zh-Hant-HK": { header: "Translated title" } },
  });

  test("no merchant cannot accidentally expose fictional merchant attribution", () => {
    assert.equal(normalizeDraft({ ...draft(), hideCompanyDetail: false }).hideCompanyDetail, true);
    assert.equal(normalizeDraft({ ...draft(), companyId: "merchant-a", hideCompanyDetail: false }).hideCompanyDetail, false);
  });
  const content = publicContent(normalized);
  assert.equal(content.translations["zh-Hant-HK"].header, "Translated title");
  assert.equal(content.translations["zh-Hant-HK"].bodyHtml, undefined);
  assert.match(content.bodyHtml, /Campaign description/);
});

test("invalid document nodes, unsafe URLs, styles, oversized and excessive images fail explicitly", () => {
  const invalidBodies = [
    { type: "iframe", attrs: { src: "https://example.com" } },
    { type: "paragraph", attrs: { style: "position:absolute" } },
    { type: "image", attrs: { src: "data:image/png;base64,test" } },
    { type: "image", attrs: { src: "https://example.com/image", widthPercent: 900 } },
    { type: "image", attrs: { src: "https://example.com/image", width: 9000 } },
    { type: "image", attrs: { src: "https://example.com/image", align: 0 } },
    { type: "paragraph", content: [{ type: "text", text: "Link", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] }] },
  ];
  for (const node of invalidBodies) {
    assert.throws(() => normalizeDraft({ ...draft(), body: { version: 1, doc: { type: "doc", content: [node] } } }), { status: 400 });
  }
  const images = Array.from({ length: 20 }, () => ({ type: "image", attrs: { src: "https://example.com/image", alt: "Image" } }));
  const valid = { ...draft(), body: { version: 1, doc: { type: "doc", content: images } } };
  assert.equal(normalizeDraft(valid).body.doc.content.length, 20);
  assert.throws(() => normalizeDraft({ ...valid, translations: { en: { body: { version: 1, doc: { type: "doc", content: [images[0]] } } } } }), /at most 20/);
  assert.throws(() => normalizeDraft({ ...draft(), body: body("x".repeat(500 * 1024)) }), /500 KiB/);
});

test("list pagination is bounded and preview is nonpersistent", async (t) => {
  const { db, json, request } = await withRouter(t);
  for (let index = 0; index < 3; index += 1) await json("", "POST", { draft: draft(`Article ${index}`) });
  const first = await request("?limit=2");
  assert.equal(first.headers.get("cache-control"), "no-store");
  const page = await first.json();
  assert.equal(page.data.length, 2);
  assert.ok(page.pagination.nextCursor);
  const second = await (await request(`?limit=2&after=${page.pagination.nextCursor}`)).json();
  assert.equal(second.data.length, 1);
  assert.equal(second.pagination.nextCursor, null);
  const preview = await json("/preview", "POST", { draft: draft("Unsaved preview") });
  assert.equal(preview.status, 200);
  assert.match((await preview.json()).data.html, /Unsaved preview/);
  assert.equal(db.collections.jetsoPosts.size, 3);
});

test("images are decoded, converted and tracked; invalid, excess and large uploads fail", async (t) => {
  const { request, db, savedImages } = await withRouter(t);
  const png = await sharp({ create: { width: 64, height: 48, channels: 3, background: "#ff0000" } }).png().toBuffer();
  const form = new FormData();
  form.append("file", new Blob([png], { type: "image/png" }), "image.png");
  const response = await request("/images", { method: "POST", body: form });
  const uploaded = await response.json();
  assert.equal(response.status, 201, uploaded.message);
  assert.equal(uploaded.width, 64);
  assert.equal(uploaded.height, 48);
  assert.match(uploaded.url, /^https:\/\/storage.googleapis.com\/test-bucket\/jetso-blog\/.*\.webp$/);
  assert.equal(savedImages[0].options.contentType, "image/webp");
  assert.equal(db.collections.jetsoPostImages.get(uploaded.fileId).uploadedBy, "admin-a");
  for (const [buffer, mime, status] of [
    [Buffer.from("<svg></svg>"), "image/svg+xml", 400],
    [Buffer.from("not an image"), "image/png", 400],
    [Buffer.alloc(5 * 1024 * 1024 + 1), "image/png", 413],
  ]) {
    const invalid = new FormData();
    invalid.append("file", new Blob([buffer], { type: mime }), "bad.png");
    assert.equal((await request("/images", { method: "POST", body: invalid })).status, status);
  }
  assert.equal(savedImages.length, 1);
});

test("image cleanup reporting preserves references in both drafts and public snapshots", async () => {
  const db = createPostDb();
  db.collections.jetsoPosts.set("post", {
    draft: { imageUrls: ["https://example.com/draft"] },
    publicSnapshot: { imageUrls: ["https://example.com/public"] },
  });
  for (const name of ["draft", "public", "old-unused", "recent-unused"]) {
    db.collections.jetsoPostImages.set(name, {
      url: `https://example.com/${name}`, objectPath: `jetso-blog/${name}.webp`,
      uploadedAt: name === "recent-unused" ? "2099-01-01T00:00:00.000Z" : "2020-01-01T00:00:00.000Z",
    });
  }
  const report = await unreferencedImages(db, Date.now());
  assert.deepEqual(report.map((image) => image.imageId), ["old-unused"]);
  assert.equal(db.collections.jetsoPostImages.size, 4);
});
