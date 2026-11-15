import { ResizableNodeView } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import { Image } from "@tiptap/extension-image";
import { TextAlign } from "@tiptap/extension-text-align";

const imageStyle = (attrs) => {
  const width = attrs.widthPercent
    ? `${attrs.widthPercent}%`
    : attrs.width ? `${attrs.width}px` : "100%";
  const left = attrs.align === "left" ? "0" : "auto";
  const right = attrs.align === "right" ? "0" : "auto";
  return `width:${width};max-width:100%;margin-left:${left};margin-right:${right}`;
};

const BlogImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent(),
      align: { default: "center", rendered: false },
      widthPercent: { default: null, rendered: false },
      caption: { default: "", rendered: false },
    };
  },
  parseHTML() {
    return [{
      tag: "figure[data-blog-image]",
      getAttrs: (element) => {
        const image = element.querySelector("img");
        if (!image) return false;
        return {
          src: image.getAttribute("src"),
          alt: image.getAttribute("alt") || "",
          title: image.getAttribute("title"),
          width: Number(image.getAttribute("width")) || null,
          height: Number(image.getAttribute("height")) || null,
          align: element.getAttribute("data-align") || "center",
          widthPercent: Number(element.getAttribute("data-width-percent")) || null,
          caption: element.querySelector("figcaption")?.textContent || "",
        };
      },
    }, ...this.parent()];
  },
  renderHTML({ node }) {
    const { src, alt, title, width, height, caption, align, widthPercent } = node.attrs;
    const image = ["img", {
      src, alt: alt || "", ...(title ? { title } : {}),
      ...(width ? { width } : {}), ...(height ? { height } : {}),
      loading: "lazy",
    }];
    return ["figure", {
      "data-blog-image": "",
      "data-align": align,
      ...(widthPercent ? { "data-width-percent": widthPercent } : {}),
      style: imageStyle(node.attrs),
    }, image, ...(caption ? [["figcaption", {}, caption]] : [])];
  },
  addNodeView() {
    if (!this.options.resize?.enabled || typeof document === "undefined") return null;
    return ({ node, editor, getPos }) => {
      const image = document.createElement("img");
      const caption = document.createElement("figcaption");
      const sync = (current, view) => {
        const attrs = current.attrs;
        image.src = attrs.src || "";
        image.alt = attrs.alt || "";
        image.title = attrs.title || "";
        image.style.width = "100%";
        image.style.height = "auto";
        view.dom.style.cssText = `${imageStyle(attrs)};display:block`;
        view.dom.dataset.align = attrs.align;
        caption.textContent = attrs.caption || "";
        caption.hidden = !attrs.caption;
      };
      const view = new ResizableNodeView({
        element: image, node, editor, getPos,
        onResize: (width) => {
          view.dom.style.width = `${width}px`;
          image.style.width = "100%";
          image.style.height = "auto";
        },
        onCommit: (width, height) => {
          const pos = getPos();
          if (pos === undefined) return;
          editor.chain().setNodeSelection(pos).updateAttributes("image", {
            width: Math.round(width), height: Math.round(height), widthPercent: null,
          }).run();
        },
        onUpdate: (updated) => { sync(updated, view); return true; },
        options: {
          directions: ["bottom-left", "bottom-right"],
          min: { width: 50, height: 50 },
          max: { width: 8192, height: 8192 },
          preserveAspectRatio: true,
          className: { container: "blog-image-node", handle: "blog-image-resize-handle" },
        },
      });
      view.dom.appendChild(caption);
      view.dom.contentEditable = "false";
      sync(node, view);
      return view;
    };
  },
});

const createBlogExtensions = ({ editable = false } = {}) => [
  StarterKit.configure({
    heading: { levels: [2, 3] }, codeBlock: false,
    link: { openOnClick: false, autolink: false, defaultProtocol: "https" },
  }),
  TextAlign.configure({ types: ["heading", "paragraph"], alignments: ["left", "center", "right"] }),
  BlogImage.configure({ allowBase64: false, resize: editable ? { enabled: true } : false }),
];

export { createBlogExtensions, BlogImage, imageStyle };
