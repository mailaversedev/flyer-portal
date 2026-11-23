import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import i18n from "../../src/i18n";
import ApiService from "../../src/services/ApiService";
import JetsoBlogEditorPage from "../../src/pages/JetsoBlog/JetsoBlogEditorPage";
import JetsoBlogListPage from "../../src/pages/JetsoBlog/JetsoBlogListPage";
import { emptyBlogDraft } from "../../src/pages/JetsoBlog/blogUtils";

jest.mock("../../src/pages/JetsoBlog/BlogRichTextEditor", () => () => (
  <div data-testid="rich-text-editor" />
));

const mountRoutes = (initialPath) => render(
  <I18nextProvider i18n={i18n}>
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/jetso-blog" element={<><LocationMarker /><JetsoBlogListPage /></>} />
        <Route path="/jetso-blog/new" element={<><LocationMarker /><JetsoBlogEditorPage /></>} />
        <Route path="/jetso-blog/:postId/edit" element={<><LocationMarker /><JetsoBlogEditorPage /></>} />
        <Route path="/platform-admin" element={<div>Platform admin</div>} />
      </Routes>
    </MemoryRouter>
  </I18nextProvider>,
);

const LocationMarker = () => {
  const location = useLocation();
  return <output data-testid="current-path">{location.pathname}</output>;
};

describe("Jetso blog authoring pages", () => {
  beforeEach(() => {
    localStorage.setItem("user", JSON.stringify({ role: "super-admin" }));
    jest.spyOn(ApiService, "getAdminCompanies").mockResolvedValue({ success: true, data: [] });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    localStorage.clear();
  });

  test("lists article status and public link for published records", async () => {
    jest.spyOn(ApiService, "getJetsoBlogPosts").mockResolvedValue({
      success: true,
      data: [{
        id: "post-1",
        status: "published",
        draft: { header: "Summer guide", excerpt: "A useful guide" },
        updatedAt: "2026-01-02T00:00:00.000Z",
        publishedAt: "2026-01-03T00:00:00.000Z",
      }],
      pagination: { nextCursor: null },
    });

    mountRoutes("/jetso-blog");
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
    expect(await screen.findByText("Summer guide")).toBeInTheDocument();
    const table = screen.getByRole("table");
    expect(table).toHaveClass("campaigns-table");
    expect(table.parentElement).toHaveClass("table-container");
    expect(table.closest("section")).toHaveClass("campaign-table");
    expect(screen.getAllByText("Published").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Open public page" })).toHaveAttribute(
      "href",
      "https://jetso.mailaverse.io/blog/post-1",
    );
  });

  test("loads more articles from the table panel", async () => {
    const getPosts = jest.spyOn(ApiService, "getJetsoBlogPosts")
      .mockResolvedValueOnce({
        data: [{ id: "post-1", status: "draft", draft: { header: "First article" } }],
        pagination: { nextCursor: "next-page" },
      })
      .mockResolvedValueOnce({
        data: [{ id: "post-2", status: "draft", draft: { header: "Second article" } }],
        pagination: { nextCursor: null },
      });

    mountRoutes("/jetso-blog");
    await screen.findByText("First article");
    fireEvent.click(screen.getByRole("button", { name: /load more/i }));
    expect(await screen.findByText("Second article")).toBeInTheDocument();
    expect(screen.getByText("First article")).toBeInTheDocument();
    expect(getPosts).toHaveBeenLastCalledWith("next-page", 20);
  });

  test("renders an article editor and confirms before discarding unsaved changes", async () => {
    const draft = { ...emptyBlogDraft(), header: "Existing story" };
    jest.spyOn(ApiService, "getJetsoBlogPost").mockResolvedValue({
      success: true,
      data: {
        id: "post-2",
        kind: "blog",
        channel: "jetso",
        revision: 3,
        status: "draft",
        draft,
      },
    });
    jest.spyOn(ApiService, "getJetsoBlogPosts").mockResolvedValue({
      success: true,
      data: [],
      pagination: { nextCursor: null },
    });
    const confirm = jest.spyOn(window, "confirm").mockReturnValue(false);

    mountRoutes("/jetso-blog/post-2/edit");
    const title = await screen.findByDisplayValue("Existing story");
    expect(screen.getByTestId("rich-text-editor")).toBeInTheDocument();
    fireEvent.change(title, { target: { value: "Updated story" } });
    fireEvent.click(screen.getByRole("link", { name: "Jetso Blog" }));
    expect(confirm).toHaveBeenCalled();
    expect(screen.getByDisplayValue("Updated story")).toBeInTheDocument();

    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole("link", { name: "Jetso Blog" }));
    expect(await screen.findByText("No articles yet")).toBeInTheDocument();
  });

  test("creates an empty draft without requiring publish-ready fields", async () => {
    const savedDraft = emptyBlogDraft();
    const createPost = jest.spyOn(ApiService, "createJetsoBlogPost").mockResolvedValue({
      success: true,
      data: { id: "new-post", kind: "blog", channel: "jetso", revision: 1, status: "draft", draft: savedDraft },
    });
    const getPost = jest.spyOn(ApiService, "getJetsoBlogPost").mockResolvedValue({
      success: true,
      data: { id: "new-post", kind: "blog", channel: "jetso", revision: 1, status: "draft", draft: savedDraft },
    });

    mountRoutes("/jetso-blog/new");
    fireEvent.click(await screen.findByRole("button", { name: "Save draft" }));
    expect(await screen.findByText("Revision 1")).toBeInTheDocument();
    expect(await screen.findByTestId("current-path")).toHaveTextContent("/jetso-blog/new-post/edit");
    expect(screen.getAllByText("Edit article").length).toBeGreaterThan(0);
    expect(getPost).not.toHaveBeenCalled();
    expect(createPost).toHaveBeenCalledWith(expect.objectContaining({
      header: "",
      coverPhoto: "",
      body: { version: 1, doc: { type: "doc", content: [{ type: "paragraph" }] } },
    }));
    expect(createPost.mock.calls[0][0]).not.toHaveProperty("bodyHtml");
    expect(createPost.mock.calls[0][0]).not.toHaveProperty("imageUrls");
  });

  test("unpublishes using the current revision", async () => {
    const draft = { ...emptyBlogDraft(), header: "Published story" };
    const unpublish = jest.spyOn(ApiService, "unpublishJetsoBlogPost").mockResolvedValue({
      success: true,
      data: { id: "post-live", revision: 6, status: "draft", draft },
    });
    jest.spyOn(ApiService, "getJetsoBlogPost").mockResolvedValue({
      success: true,
      data: { id: "post-live", revision: 5, status: "published", draft },
    });
    jest.spyOn(window, "confirm").mockReturnValue(true);

    mountRoutes("/jetso-blog/post-live/edit");
    await screen.findByDisplayValue("Published story");
    fireEvent.click(screen.getByRole("button", { name: "Unpublish" }));
    expect(await screen.findByText("Article unpublished.")).toBeInTheDocument();
    expect(unpublish).toHaveBeenCalledWith("post-live", 5);
  });

  test("previews the current draft in a sandboxed iframe and reports preview failures", async () => {
    const draft = { ...emptyBlogDraft(), header: "Preview story", imageUrls: ["derived"] };
    jest.spyOn(ApiService, "getJetsoBlogPost").mockResolvedValue({
      success: true,
      data: { id: "preview-post", revision: 1, status: "draft", draft },
    });
    const preview = jest.spyOn(ApiService, "previewJetsoBlogPost")
      .mockResolvedValueOnce({ success: true, data: { html: "<h1>Preview story</h1>" } })
      .mockRejectedValueOnce(new Error("Preview service unavailable"));

    mountRoutes("/jetso-blog/preview-post/edit");
    await screen.findByDisplayValue("Preview story");
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    expect(await screen.findByRole("dialog", { name: "Preview" })).toBeInTheDocument();
    expect(screen.getByTitle("Preview")).toHaveAttribute("srcdoc", "<h1>Preview story</h1>");
    expect(screen.getByTitle("Preview")).toHaveAttribute("sandbox", "");
    expect(preview.mock.calls[0][0]).not.toHaveProperty("bodyHtml");
    expect(preview.mock.calls[0][0]).not.toHaveProperty("imageUrls");

    fireEvent.click(screen.getByRole("button", { name: "Close preview" }));
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Preview service unavailable");
  });

  test("redirects non-super-admin users away from the authoring area", async () => {
    localStorage.setItem("user", JSON.stringify({ role: "merchant" }));
    mountRoutes("/jetso-blog");
    expect(await screen.findByText("Platform admin")).toBeInTheDocument();
  });
});
