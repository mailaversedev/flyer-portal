const { getSchema } = require("@tiptap/core");
const { renderToHTMLString } = require("@tiptap/static-renderer/pm/html-string");
const sanitizeHtml = require("sanitize-html");
// Node 24's synchronous ESM loading keeps the backend and browser editor schema identical.
const { createBlogExtensions } = require("../src/utils/JetsoBlogExtensions");

const MAX_CONTENT_BYTES = 500 * 1024;
const MAX_IMAGES = 20;
const LOCALES = ["en", "zh-Hant-HK"];
const extensions = createBlogExtensions();
const schema = getSchema(extensions);
const EMPTY_BODY = { version: 1, doc: { type: "doc", content: [{ type: "paragraph" }] } };

class PostValidationError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
const invalid = (message) => { throw new PostValidationError(message); };
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const keys = (value, allowed, label) => {
  if (!object(value) || Object.keys(value).some((key) => !allowed.includes(key))) {
    invalid(`Invalid ${label} fields`);
  }
};
const text = (value, max, label) => {
  if (value == null) return "";
  if (typeof value !== "string" || value.length > max || /[<>]/.test(value)) {
    invalid(`${label} must be plain text of at most ${max} characters`);
  }
  return value.trim();
};
const safeUrl = (value, { image = false } = {}) => {
  if (typeof value !== "string" || value.length > 2048) invalid("Invalid URL");
  let url;
  try { url = new URL(value); } catch (_error) { invalid("Invalid URL"); }
  if (!(image ? ["https:"] : ["https:", "http:", "mailto:"]).includes(url.protocol)) {
    invalid(image ? "Images must use completed HTTPS uploads" : "Unsupported link URL");
  }
  if (url.username || url.password) invalid("URLs must not contain credentials");
  return url.href;
};
const schedule = (value) => {
  if (value == null || value === "") return null;
  const match = typeof value === "string" && value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/);
  if (!match) {
    invalid("Publication time must be an ISO date with a timezone");
  }
  const [, year, month, day, hour, minute, second] = match.map(Number);
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (month < 1 || month > 12 || day < 1 || day > days || hour > 23 || minute > 59 || second > 59) invalid("Invalid publication time");
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) invalid("Invalid publication time");
  return date.toISOString();
};
const sanitizeOptions = {
  allowedTags: ["p", "h2", "h3", "strong", "em", "s", "u", "code", "ul", "ol", "li", "blockquote", "hr", "br", "a", "figure", "img", "figcaption"],
  allowedAttributes: {
    p: ["style"], h2: ["style"], h3: ["style"], ol: ["start"],
    a: ["href", "target", "rel"],
    figure: ["style", "data-blog-image", "data-align", "data-width-percent"],
    img: ["src", "alt", "title", "width", "height", "loading"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: { img: ["https"] },
  allowProtocolRelative: false,
  allowedStyles: {
    "*": { "text-align": [/^(left|center|right)$/] },
    figure: {
      width: [/^(25|50|75|100)%$/, /^(?:[1-9]\d{0,3})px$/],
      "max-width": [/^100%$/],
      "margin-left": [/^(0|auto)$/], "margin-right": [/^(0|auto)$/],
    },
  },
  transformTags: { a: sanitizeHtml.simpleTransform("a", { target: "_blank", rel: "noopener noreferrer" }) },
};

function renderBody(body, counters) {
  keys(body, ["version", "doc"], "body");
  if (body.version !== 1 || !object(body.doc) || body.doc.type !== "doc") invalid("Unsupported body format");
  let nodes = 0;
  const walk = (node, depth) => {
    if (++nodes > 10000 || depth > 40) invalid("Article structure is too complex");
    keys(node, ["type", "attrs", "content", "marks", "text"], "document");
    const type = schema.nodes[node.type];
    if (!type) invalid(`Unsupported article node: ${node.type}`);
    const attrs = node.attrs || {};
    keys(attrs, Object.keys(type.spec.attrs || {}), "node attributes");
    if (node.text !== undefined && typeof node.text !== "string") invalid("Invalid article text");
    if (attrs.textAlign != null && !["left", "center", "right"].includes(attrs.textAlign)) invalid("Unsupported text alignment");
    if (node.type === "heading" && ![2, 3].includes(attrs.level)) invalid("Only heading levels 2 and 3 are supported");
    if (node.type === "orderedList" && attrs.start != null && (!Number.isInteger(attrs.start) || attrs.start < 1 || attrs.start > 10000)) invalid("Invalid list start");
    if (node.type === "image") {
      counters.images += 1;
      if (counters.images > MAX_IMAGES) invalid(`Articles support at most ${MAX_IMAGES} inline images, including translations`);
      attrs.src = safeUrl(attrs.src, { image: true });
      attrs.alt = text(attrs.alt, 300, "Image alt text");
      attrs.title = text(attrs.title, 300, "Image title");
      attrs.caption = text(attrs.caption, 1000, "Image caption");
      if (attrs.align != null && !["left", "center", "right"].includes(attrs.align)) invalid("Invalid image alignment");
      if (attrs.widthPercent != null && ![25, 50, 75, 100].includes(attrs.widthPercent)) invalid("Invalid image width preset");
      for (const dimension of ["width", "height"]) {
        if (attrs[dimension] != null && (!Number.isInteger(attrs[dimension]) || attrs[dimension] < 1 || attrs[dimension] > 8192)) invalid("Invalid image dimensions");
      }
      counters.imageUrls.add(attrs.src);
    }
    if (node.marks != null) {
      if (!Array.isArray(node.marks)) invalid("Invalid article formatting");
      for (const mark of node.marks) {
        keys(mark, ["type", "attrs"], "formatting");
        const markType = schema.marks[mark.type];
        if (!markType) invalid(`Unsupported article formatting: ${mark.type}`);
        keys(mark.attrs || {}, Object.keys(markType.spec.attrs || {}), "formatting attributes");
        if (mark.type === "link") {
          mark.attrs.href = safeUrl(mark.attrs?.href);
          mark.attrs.target = "_blank";
          mark.attrs.rel = "noopener noreferrer";
          delete mark.attrs.class;
        }
      }
    }
    if (node.content != null) {
      if (!Array.isArray(node.content)) invalid("Invalid article content");
      node.content.forEach((child) => walk(child, depth + 1));
    }
  };
  const cloned = structuredClone(body);
  walk(cloned.doc, 0);
  let doc;
  try { doc = schema.nodeFromJSON(cloned.doc); doc.check(); } catch (_error) { invalid("Invalid article structure"); }
  const bodyHtml = sanitizeHtml(renderToHTMLString({ extensions, content: doc }), sanitizeOptions);
  const bodyText = doc.textBetween(0, doc.content.size, "\n").slice(0, 20000);
  return { body: { version: 1, doc: doc.toJSON() }, bodyHtml, bodyText };
}

function normalizeDraft(input = {}) {
  keys(input, ["header", "excerpt", "coverPhoto", "tags", "companyId", "hideCompanyDetail", "scheduledAt", "body", "translations"], "draft");
  if (Buffer.byteLength(JSON.stringify(input), "utf8") > MAX_CONTENT_BYTES) invalid("Article content exceeds 500 KiB");
  if (input.coverPhoto != null && typeof input.coverPhoto !== "string") invalid("Invalid cover image");
  if (input.tags != null && !Array.isArray(input.tags)) invalid("Topics must be an array");
  if (input.companyId != null && typeof input.companyId !== "string") invalid("Invalid merchant");
  const counters = { images: 0, imageUrls: new Set() };
  const base = {
    header: text(input.header, 160, "Title"),
    excerpt: text(input.excerpt, 600, "Excerpt"),
    coverPhoto: input.coverPhoto ? safeUrl(input.coverPhoto, { image: true }) : "",
    tags: input.tags || [],
    companyId: input.companyId || null,
    hideCompanyDetail: !input.companyId || input.hideCompanyDetail !== false,
    scheduledAt: schedule(input.scheduledAt),
    ...renderBody(input.body ?? EMPTY_BODY, counters),
    translations: {},
  };
  if (!Array.isArray(base.tags) || base.tags.length > 8) invalid("Provide at most eight topics");
  base.tags = base.tags.map((tag) => text(tag, 40, "Topic")).filter(Boolean);
  if (base.companyId !== null && (typeof base.companyId !== "string" || !/^[^/]{1,150}$/.test(base.companyId))) invalid("Invalid merchant");
  if (input.hideCompanyDetail != null && typeof input.hideCompanyDetail !== "boolean") invalid("Invalid merchant visibility");
  if (input.translations != null) {
    keys(input.translations, LOCALES, "translation");
    for (const [locale, translation] of Object.entries(input.translations)) {
      keys(translation, ["header", "excerpt", "body"], "translated content");
      base.translations[locale] = {
        header: text(translation.header, 160, "Translated title"),
        excerpt: text(translation.excerpt, 600, "Translated excerpt"),
        ...renderBody(translation.body ?? EMPTY_BODY, counters),
      };
    }
  }
  base.imageUrls = [...counters.imageUrls, ...(base.coverPhoto ? [base.coverPhoto] : [])];
  return base;
}

const containsImage = (node) => node.type === "image" || (node.content || []).some(containsImage);
const hasBodyContent = (content) => Boolean(content.bodyText.trim()) || containsImage(content.body.doc);

function publicContent(draft) {
  const { body, imageUrls, ...snapshot } = draft;
  snapshot.translations = Object.fromEntries(Object.entries(draft.translations).map(([locale, translation]) => {
    const { body: _body, ...content } = translation;
    if (!content.header) delete content.header;
    if (!content.excerpt) delete content.excerpt;
    if (!hasBodyContent(translation)) {
      delete content.bodyHtml;
      delete content.bodyText;
    }
    return [locale, content];
  }));
  return { ...snapshot, imageUrls };
}

const escapeHtml = (value) => sanitizeHtml(String(value), { allowedTags: [], allowedAttributes: {} })
  .replace(/"/g, "&quot;");

function previewHtml(draft) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <style>body{margin:0;background:#0a1d33;color:#edf4ff;font-family:system-ui,sans-serif;--muted:#b8c7da;--purple:#6a5ae0}main{max-width:900px;margin:auto;padding:24px;overflow-wrap:anywhere}h1{font-size:2rem}.hero{width:100%;max-height:420px;object-fit:cover;border-radius:16px}.blog-body{max-width:800px;color:#dbe4ef;line-height:1.8;overflow-wrap:anywhere}.blog-body figure{max-width:100%;margin-top:1.5em;margin-bottom:1.5em}.blog-body img{display:block;max-width:100%;height:auto}.blog-body figure img{width:100%}.blog-body figcaption{color:var(--muted);font-size:.85rem}.blog-body blockquote{border-left:3px solid var(--purple);margin-left:0;padding-left:1em}.blog-body a{color:#87bfff}.blog-body pre{max-width:100%;overflow-x:auto}.blog-body hr{border:0;border-top:1px solid #43556d}</style></head>
  <body><main><p>Mailaverse Jetso · Preview</p><h1>${escapeHtml(draft.header)}</h1>
  ${draft.coverPhoto ? `<img class="hero" src="${escapeHtml(draft.coverPhoto)}" alt="${escapeHtml(draft.header)}">` : ""}
  <div class="blog-body">${draft.bodyHtml}</div></main></body></html>`;
}

module.exports = {
  PostValidationError, MAX_CONTENT_BYTES, MAX_IMAGES, EMPTY_BODY,
  normalizeDraft, publicContent, previewHtml, sanitizeOptions, hasBodyContent,
};
