export const BLOG_BODY_VERSION = 1;
export const BLOG_MAX_IMAGES = 20;
export const BLOG_MAX_SERIALIZED_BYTES = 500 * 1024;
export const BLOG_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const BLOG_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const BLOG_TRANSLATION_LOCALES = ["en", "zh-Hant-HK"];

export const emptyBlogBody = () => ({
  version: BLOG_BODY_VERSION,
  doc: { type: "doc", content: [{ type: "paragraph" }] },
});

export const emptyBlogDraft = () => ({
  header: "",
  coverPhoto: "",
  excerpt: "",
  tags: [],
  companyId: null,
  hideCompanyDetail: true,
  scheduledAt: null,
  body: emptyBlogBody(),
  bodyHtml: "",
  bodyText: "",
  translations: {},
});

export const countBlogImages = (value) => {
  let count = 0;
  const visit = (node) => {
    if (!node || typeof node !== "object") return;
    if (node.type === "image") count += 1;
    if (Array.isArray(node.content)) node.content.forEach(visit);
    if (node.doc) visit(node.doc);
  };
  visit(value);
  return count;
};

export const getBlogImageSources = (value) => {
  const sources = [];
  const visit = (node) => {
    if (!node || typeof node !== "object") return;
    if (node.type === "image" && node.attrs?.src) sources.push(node.attrs.src);
    if (Array.isArray(node.content)) node.content.forEach(visit);
    if (node.doc) visit(node.doc);
  };
  visit(value);
  return sources;
};

const hasAuthoredContent = (value) => {
  const doc = value?.doc;
  if (!doc) return false;
  const visit = (node) => {
    if (!node || typeof node !== "object") return false;
    if (node.type === "text" && node.text?.trim()) return true;
    if (node.type === "image") return true;
    return Array.isArray(node.content) && node.content.some(visit);
  };
  return visit(doc);
};

export const pruneEmptyTranslations = (translations = {}) => Object.fromEntries(
  Object.entries(translations).filter(([, translation]) => (
    Boolean(translation?.header?.trim())
    || Boolean(translation?.excerpt?.trim())
    || hasAuthoredContent(translation?.body)
  )),
);

export const toBlogDraftPayload = (draft = {}) => {
  const payload = {
    header: draft.header || "",
    coverPhoto: draft.coverPhoto || "",
    excerpt: draft.excerpt || "",
    tags: Array.isArray(draft.tags) ? draft.tags : [],
    companyId: draft.companyId || null,
    hideCompanyDetail: draft.companyId ? Boolean(draft.hideCompanyDetail) : true,
    scheduledAt: draft.scheduledAt || null,
    body: draft.body?.version === BLOG_BODY_VERSION && draft.body.doc
      ? draft.body
      : emptyBlogBody(),
  };
  const translations = Object.fromEntries(
    Object.entries(pruneEmptyTranslations(draft.translations || {}))
      .filter(([locale]) => BLOG_TRANSLATION_LOCALES.includes(locale)),
  );
  if (Object.keys(translations).length) {
    payload.translations = Object.fromEntries(
      Object.entries(translations).map(([locale, translation]) => [
        locale,
        {
          header: translation.header || "",
          excerpt: translation.excerpt || "",
          body: translation.body?.version === BLOG_BODY_VERSION && translation.body.doc
            ? translation.body
            : emptyBlogBody(),
        },
      ]),
    );
  }
  return payload;
};

export const blogDraftSignature = (draft) => {
  const payload = JSON.parse(JSON.stringify(toBlogDraftPayload(draft)));
  const normalizeBody = (body) => {
    const content = body?.doc?.content;
    if (!Array.isArray(content)) return;
    const last = content.at(-1);
    if (content.length > 1 && last?.type === "paragraph"
      && !last.content?.length && !last.attrs?.textAlign) {
      content.pop();
    }
  };
  normalizeBody(payload.body);
  Object.values(payload.translations || {}).forEach((translation) => normalizeBody(translation.body));
  const stable = (value) => {
    if (Array.isArray(value)) return value.map(stable);
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
    }
    return value;
  };
  return JSON.stringify(stable(payload));
};

export const validateBlogDraft = (draft, { forPublish = false } = {}) => {
  const errors = [];
  const writableDraft = toBlogDraftPayload(draft);
  const authoredBodies = [writableDraft.body, ...Object.values(writableDraft.translations || {}).map((item) => item.body).filter(Boolean)];
  const serialized = JSON.stringify(writableDraft);
  const byteLength = typeof TextEncoder !== "undefined"
    ? new TextEncoder().encode(serialized).length
    : unescape(encodeURIComponent(serialized)).length;

  if (forPublish && !writableDraft.header.trim()) errors.push("Enter an article title.");
  if (forPublish && !writableDraft.coverPhoto.trim()) errors.push("Add a cover image before publishing.");
  if (forPublish && !hasAuthoredContent(writableDraft.body)) errors.push("Add article description before publishing.");
  if (forPublish && writableDraft.scheduledAt && new Date(writableDraft.scheduledAt).getTime() <= Date.now()) {
    errors.push("Scheduled publication must be in the future.");
  }
  if (forPublish && Object.values(writableDraft.translations || {}).some((translation) => (
    (translation?.excerpt?.trim() || hasAuthoredContent(translation?.body))
    && !translation?.header?.trim()
  ))) errors.push("Enter a title for each authored translation.");
  if (byteLength > BLOG_MAX_SERIALIZED_BYTES) errors.push("Article content exceeds the 500 KiB limit.");
  if (authoredBodies.reduce((sum, body) => sum + countBlogImages(body), 0) > BLOG_MAX_IMAGES) {
    errors.push(`Use no more than ${BLOG_MAX_IMAGES} inline images across translations.`);
  }
  if (authoredBodies.some((body) => getBlogImageSources(body).some((src) => /^(blob:|data:)/i.test(src)))) {
    errors.push("Wait for image uploads to finish before publishing.");
  }
  return errors;
};

export const normalizeBlogDraft = (draft = {}) => ({
  ...emptyBlogDraft(),
  ...draft,
  tags: Array.isArray(draft.tags) ? draft.tags : [],
  hideCompanyDetail: draft.companyId ? Boolean(draft.hideCompanyDetail) : true,
  translations: draft.translations && typeof draft.translations === "object" ? draft.translations : {},
  body: draft.body?.version === BLOG_BODY_VERSION && draft.body.doc
    ? draft.body
    : emptyBlogBody(),
});

export const toLocalDateTimeValue = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};

export const toIsoDateTime = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

export const getJetsoPostUrl = (postId) => {
  const configured = process.env.REACT_APP_JETSO_SITE_URL
    || "https://jetso.mailaverse.io/blog/:id";
  const encodedId = encodeURIComponent(postId);
  if (configured.includes(":id")) return configured.replaceAll(":id", encodedId);
  return `${configured.replace(/\/+$/, "")}/${encodedId}`;
};
