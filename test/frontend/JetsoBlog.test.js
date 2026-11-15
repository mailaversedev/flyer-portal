import ApiService from "../../src/services/ApiService";
import {
  BLOG_BODY_VERSION,
  countBlogImages,
  emptyBlogBody,
  emptyBlogDraft,
  getBlogImageSources,
  normalizeBlogDraft,
  toBlogDraftPayload,
  validateBlogDraft,
} from "../../src/pages/JetsoBlog/blogUtils";

describe("Jetso blog draft helpers", () => {
  test("creates the canonical versioned empty body", () => {
    expect(emptyBlogBody()).toEqual({
      version: BLOG_BODY_VERSION,
      doc: { type: "doc", content: [{ type: "paragraph" }] },
    });
  });

  test("counts image nodes in the default and translated content", () => {
    const body = {
      version: 1,
      doc: {
        type: "doc",
        content: [
          { type: "image", attrs: { src: "https://cdn.example/a.png" } },
          { type: "paragraph", content: [{ type: "image", attrs: { src: "https://cdn.example/b.png" } }] },
        ],
      },
    };
    expect(countBlogImages(body)).toBe(2);
    expect(getBlogImageSources(body)).toEqual([
      "https://cdn.example/a.png",
      "https://cdn.example/b.png",
    ]);
  });

  test("rejects empty titles, unresolved local image URLs, and oversized content", () => {
    const draft = emptyBlogDraft();
    expect(validateBlogDraft(draft)).toHaveLength(0);
    expect(validateBlogDraft(draft, { forPublish: true })).toContain("Enter an article title.");
    draft.header = "A story";
    draft.body.doc.content = [{ type: "image", attrs: { src: "blob:pending" } }];
    expect(validateBlogDraft(draft).some((message) => message.includes("image uploads"))).toBe(true);

    draft.body.doc.content = [{ type: "paragraph", content: [{ type: "text", text: "x".repeat(520 * 1024) }] }];
    expect(validateBlogDraft(draft).some((message) => message.includes("500 KiB"))).toBe(true);
  });

  test("normalizes incomplete records without changing valid rich body JSON", () => {
    const body = { version: 1, doc: { type: "doc", content: [{ type: "paragraph" }] } };
    expect(normalizeBlogDraft({ header: "Hello", body })).toMatchObject({
      header: "Hello",
      body,
      tags: [],
      translations: {},
      companyId: null,
      hideCompanyDetail: true,
    });
  });

  test("hides attribution when no merchant is selected", () => {
    const draft = { ...emptyBlogDraft(), hideCompanyDetail: false, companyId: null };
    expect(normalizeBlogDraft(draft).hideCompanyDetail).toBe(true);
    expect(toBlogDraftPayload(draft).hideCompanyDetail).toBe(true);
    expect(toBlogDraftPayload({ ...draft, companyId: "merchant-1" }).hideCompanyDetail).toBe(false);
  });

  test("sends only writable article fields and strips server-derived fields", () => {
      const body = { version: 1, doc: { type: "doc", content: [{ type: "paragraph" }] } };
      const payload = toBlogDraftPayload({
        ...emptyBlogDraft(),
        header: "Hello",
        bodyHtml: "<p>server generated</p>",
        bodyText: "server generated",
        imageUrls: ["server-owned"],
        translations: {
          en: { header: "Hello", excerpt: "", body, bodyHtml: "<p>generated</p>", bodyText: "generated", imageUrls: ["owned"] },
        },
      });
      expect(payload).toEqual(expect.objectContaining({
        header: "Hello",
        body,
        translations: { en: { header: "Hello", excerpt: "", body } },
      }));
      expect(payload).not.toHaveProperty("bodyHtml");
      expect(payload).not.toHaveProperty("bodyText");
      expect(payload).not.toHaveProperty("imageUrls");
      expect(payload.translations.en).not.toHaveProperty("bodyHtml");
      expect(payload.translations.en).not.toHaveProperty("imageUrls");
  });
});

describe("Jetso blog API methods", () => {
  afterEach(() => jest.restoreAllMocks());

  test("uses cursor pagination and the documented admin collection path", async () => {
    const request = jest.spyOn(ApiService, "makeRequest").mockResolvedValue({});
    await ApiService.getJetsoBlogPosts("post 2", 20);
    expect(request).toHaveBeenCalledWith("/api/admin/jetso-posts?limit=20&after=post+2");
  });

  test("sends revisions with publication actions and multipart image uploads", async () => {
    const request = jest.spyOn(ApiService, "makeRequest").mockResolvedValue({});
    await ApiService.publishJetsoBlogPost("post/1", 4);
    expect(request).toHaveBeenCalledWith("/api/admin/jetso-posts/post%2F1/publish", {
      method: "POST",
      body: JSON.stringify({ revision: 4 }),
    });

    const file = new File(["image"], "cover.webp", { type: "image/webp" });
    await ApiService.uploadJetsoBlogImage(file);
    const [path, options] = request.mock.calls[1];
    expect(path).toBe("/api/admin/jetso-posts/images");
    expect(options.method).toBe("POST");
    expect(options.body).toBeInstanceOf(FormData);
    expect(options.body.get("file")).toBe(file);
  });
});
