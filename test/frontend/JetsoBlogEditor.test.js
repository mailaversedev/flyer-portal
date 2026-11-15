import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { emptyBlogBody } from "../../src/pages/JetsoBlog/blogUtils";

jest.mock("@tiptap/react", () => {
  const ReactRuntime = require("react");
  let currentOptions = {};
  let currentDoc = null;
  let imageAttrs = null;
  let pendingAttrs = null;
  const editor = {
    chain() {
      const chain = {
        focus: () => chain,
        setImage: (attrs) => { pendingAttrs = attrs; return chain; },
        run: () => {
          if (pendingAttrs) {
            imageAttrs = pendingAttrs;
            currentDoc = {
              type: "doc",
              content: [...(currentDoc?.content || []), { type: "image", attrs: imageAttrs }],
            };
            pendingAttrs = null;
            currentOptions.onUpdate?.({ editor });
            currentOptions.onSelectionUpdate?.({ editor });
          }
          return true;
        },
      };
      return new Proxy(chain, {
        get: (target, key) => key in target ? target[key] : () => chain,
      });
    },
    commands: {
      setContent: (doc) => { currentDoc = doc; },
    },
    getJSON: () => currentDoc || { type: "doc", content: [] },
    getAttributes: (name) => name === "image" ? imageAttrs || {} : {},
    isActive: (name) => name === "image" && Boolean(imageAttrs),
    setEditable: jest.fn(),
  };
  return {
    useEditor: (options) => {
      currentOptions = options;
      currentDoc ||= options.content;
      return editor;
    },
    EditorContent: ({ className }) => {
      const image = currentDoc?.content?.find((node) => node.type === "image");
      return ReactRuntime.createElement(
        "div",
        { className, "data-testid": "mock-editor-content" },
        image ? ReactRuntime.createElement("img", { src: image.attrs.src, alt: image.attrs.alt }) : null,
      );
    },
  };
});

jest.mock("../../src/utils/JetsoBlogExtensions", () => ({
  createBlogExtensions: jest.fn(() => []),
}));

const BlogRichTextEditor = require("../../src/pages/JetsoBlog/BlogRichTextEditor").default;

test("uploads an image and stores URL and dimensions in canonical editor JSON", async () => {
  const onChange = jest.fn();
  const onUploadImage = jest.fn().mockResolvedValue({
    url: "https://cdn.example.test/blog-image.webp",
    fileId: "image-1",
    width: 640,
    height: 480,
  });
  render(
    <BlogRichTextEditor
      value={emptyBlogBody()}
      onChange={onChange}
      onUploadImage={onUploadImage}
      label="Article content"
    />,
  );
  const file = new File(["image bytes"], "cover.webp", { type: "image/webp" });
  fireEvent.change(screen.getByLabelText("Upload inline image", { selector: "input" }), {
    target: { files: [file] },
  });

  expect(onUploadImage).toHaveBeenCalledWith(file);
  expect(await screen.findByRole("img", { name: "cover.webp" })).toHaveAttribute(
    "src",
    "https://cdn.example.test/blog-image.webp",
  );
  await waitFor(() => {
    const savedBody = onChange.mock.calls.at(-1)?.[0];
    expect(savedBody?.doc?.content?.find((node) => node.type === "image")?.attrs).toMatchObject({
      src: "https://cdn.example.test/blog-image.webp",
      alt: "cover.webp",
      width: 640,
      height: 480,
      widthPercent: null,
      align: "center",
      caption: "",
    });
  });
});
