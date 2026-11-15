const { Editor } = require("@tiptap/core");
const { createBlogExtensions } = require("../../../src/utils/JetsoBlogExtensions");

describe("Jetso WYSIWYG image round trips", () => {
  let editor;
  let element;
  beforeEach(() => {
    element = document.createElement("div");
    document.body.appendChild(element);
    editor = new Editor({ element, extensions: createBlogExtensions({ editable: true }) });
  });
  afterEach(() => {
    editor.destroy();
    element.remove();
  });

  const content = {
    type: "doc",
    content: [
      { type: "heading", attrs: { level: 2, textAlign: "center" }, content: [{ type: "text", text: "Heading" }] },
      { type: "image", attrs: {
        src: "https://example.com/image.webp", alt: "Meaningful alt", title: "Image",
        caption: "Image caption", align: "right", widthPercent: 50, width: 300, height: 200,
      } },
    ],
  };

  test("JSON, editable DOM and serialized HTML preserve image layout and captions", () => {
    editor.commands.setContent(content);
    const image = editor.getJSON().content.find((node) => node.type === "image");
    expect(image.attrs).toMatchObject(content.content[1].attrs);
    expect(element.querySelector(".blog-image-node").style.width).toBe("50%");
    expect(element.querySelector(".blog-image-node").style.marginLeft).toBe("auto");
    expect(element.querySelector("figcaption").textContent).toBe("Image caption");
    const html = editor.getHTML();
    expect(html).toContain('data-align="right"');
    expect(html).toMatch(/width:\s*50%/);
    expect(html).toContain("<figcaption>Image caption</figcaption>");
    editor.commands.setContent(html);
    expect(editor.getJSON().content.find((node) => node.type === "image").attrs).toMatchObject(content.content[1].attrs);
  });

  test("drag resizing uses library handles and stores pixel dimensions instead of the preset", () => {
    editor.commands.setContent(content);
    const image = element.querySelector("img");
    const renderedWidth = () => {
      const width = element.querySelector(".blog-image-node").style.width;
      return width.endsWith("px") ? Number.parseFloat(width) : 300;
    };
    Object.defineProperties(image, {
      offsetWidth: { configurable: true, get: renderedWidth },
      offsetHeight: { configurable: true, get: () => renderedWidth() * 2 / 3 },
    });
    const handle = element.querySelector('[data-resize-handle="bottom-right"]');
    expect(handle).not.toBeNull();
    handle.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, clientX: 300, clientY: 200 }));
    document.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, clientX: 450, clientY: 300 }));
    document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, clientX: 450, clientY: 300 }));
    const resized = editor.getJSON().content.find((node) => node.type === "image");
    expect(resized.attrs.widthPercent).toBeNull();
    expect(resized.attrs.width).toBeGreaterThan(300);
    expect(resized.attrs.height / resized.attrs.width).toBeCloseTo(2 / 3);
    expect(editor.getHTML()).toMatch(new RegExp(`width:\\s*${resized.attrs.width}px`));
    expect(element.querySelector(".blog-image-node").style.width).toBe(`${resized.attrs.width}px`);
  });
});
