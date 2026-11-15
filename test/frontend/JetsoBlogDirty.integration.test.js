import React from "react";
import { render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter, Route, Routes } from "react-router";
import ApiService from "../../src/services/ApiService";
import i18n from "../../src/i18n";
import JetsoBlogEditorPage from "../../src/pages/JetsoBlog/JetsoBlogEditorPage";

test("reopening a backend-shaped article with a final image stays clean", async () => {
  localStorage.setItem("user", JSON.stringify({ role: "super-admin" }));
  jest.spyOn(ApiService, "getAdminCompanies").mockResolvedValue({ success: true, data: [] });
  jest.spyOn(ApiService, "getJetsoBlogPost").mockResolvedValue({
    success: true,
    data: {
      id: "post-1",
      revision: 3,
      status: "published",
      draft: {
        header: "Saved article",
        excerpt: "",
        coverPhoto: "https://example.test/cover.webp",
        tags: [],
        companyId: null,
        hideCompanyDetail: true,
        scheduledAt: null,
        translations: {},
        bodyHtml: "<p>Saved article</p>",
        bodyText: "Saved article",
        imageUrls: ["https://example.test/inline.webp"],
        body: {
          version: 1,
          doc: {
            type: "doc",
            content: [
              { type: "paragraph", attrs: { textAlign: null }, content: [{ type: "text", text: "Saved article" }] },
              { type: "image", attrs: { src: "https://example.test/inline.webp", alt: "", title: null, width: 640, height: 480, widthPercent: 50, align: "right", caption: "Caption" } },
            ],
          },
        },
      },
    },
  });
  try {
    render(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter initialEntries={["/jetso-blog/post-1/edit"]}>
          <Routes><Route path="/jetso-blog/:postId/edit" element={<JetsoBlogEditorPage />} /></Routes>
        </MemoryRouter>
      </I18nextProvider>,
    );
    await screen.findByDisplayValue("Saved article");
    expect(screen.getByText("All changes saved")).toBeInTheDocument();
    expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument();
  } finally {
    jest.restoreAllMocks();
    localStorage.clear();
  }
});
