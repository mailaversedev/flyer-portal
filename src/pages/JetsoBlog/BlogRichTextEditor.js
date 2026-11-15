import React, { useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { createBlogExtensions } from "../../utils/JetsoBlogExtensions";

const BlogRichTextEditor = ({
  value,
  onChange,
  onUploadImage,
  onUploadStateChange,
  label,
  disabled = false,
}) => {
  const inputRef = useRef(null);
  const uploadStateCallback = useRef(onUploadStateChange);
  uploadStateCallback.current = onUploadStateChange;
  const [uploadError, setUploadError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [imageAttrs, setImageAttrs] = useState(null);
  const [linkError, setLinkError] = useState("");
  const extensions = useMemo(() => createBlogExtensions({ editable: true }), []);
  const editor = useEditor({
    extensions,
    content: value?.doc || { type: "doc", content: [{ type: "paragraph" }] },
    editable: !disabled,
    onUpdate: ({ editor: currentEditor }) => {
      onChange({ version: 1, doc: currentEditor.getJSON() });
    },
    onSelectionUpdate: ({ editor: currentEditor }) => {
      setImageAttrs(currentEditor.isActive("image") ? currentEditor.getAttributes("image") : null);
    },
  });

  useEffect(() => {
    if (editor) editor.setEditable(!disabled);
  }, [editor, disabled]);

  useEffect(() => {
    if (!editor || !value?.doc) return;
    if (JSON.stringify(editor.getJSON()) !== JSON.stringify(value.doc)) {
      editor.commands.setContent(value.doc, { emitUpdate: false });
    }
  }, [editor, value]);

  useEffect(() => {
    uploadStateCallback.current?.({ uploading, failed: Boolean(uploadError) });
  }, [uploading, uploadError]);

  const run = (command) => {
    if (!editor || disabled) return;
    command(editor.chain().focus()).run();
  };

  const handleImageFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !editor) return;
    setUploadError("");
    setUploading(true);
    try {
      const uploaded = await onUploadImage(file);
      editor.chain().focus().setImage({
        src: uploaded.url,
        alt: file.name,
        title: file.name,
        width: uploaded.width || null,
        height: uploaded.height || null,
        widthPercent: null,
        align: "center",
        caption: "",
      }).run();
    } catch (error) {
      setUploadError(error.message || "Image upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const setLink = () => {
    if (!editor) return;
    setLinkError("");
    const current = editor.getAttributes("link").href || "";
    const href = window.prompt("Enter a link URL", current);
    if (href === null) return;
    const trimmed = href.trim();
    if (trimmed && !/^(https?:\/\/|mailto:|\/(?!\/)|#)/i.test(trimmed)) {
      setLinkError("Use an http, https, mailto or site-relative link.");
      return;
    }
    if (!trimmed) editor.chain().focus().extendMarkRange("link").unsetLink().run();
    else editor.chain().focus().extendMarkRange("link").setLink({ href: trimmed }).run();
  };

  const isActive = (name, attrs) => editor?.isActive(name, attrs) || false;
  const updateSelectedImage = (attrs) => {
    editor?.chain().focus().updateAttributes("image", attrs).run();
    setImageAttrs((current) => current ? { ...current, ...attrs } : current);
  };
  const button = (text, action, active = false, title = text) => (
    <button
      type="button"
      key={text}
      className={`jetso-blog-toolbar-button${active ? " is-active" : ""}`}
      onClick={action}
      disabled={!editor || disabled}
      title={title}
      aria-label={title}
    >
      {text}
    </button>
  );

  return (
    <section className="jetso-blog-editor" aria-label={label}>
      <div className="jetso-blog-toolbar" role="toolbar" aria-label="Article formatting">
        <select
          aria-label="Text style"
          value={isActive("heading", { level: 2 }) ? "h2" : isActive("heading", { level: 3 }) ? "h3" : "p"}
          onChange={(event) => {
            if (event.target.value === "p") run((chain) => chain.setParagraph());
            else run((chain) => chain.toggleHeading({ level: Number(event.target.value.slice(1)) }));
          }}
          disabled={!editor || disabled}
        >
          <option value="p">Paragraph</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
        </select>
        {button("B", (e) => e.chain().focus().toggleBold().run(), isActive("bold"), "Bold")}
        {button("I", (e) => e.chain().focus().toggleItalic().run(), isActive("italic"), "Italic")}
        {button("S", (e) => e.chain().focus().toggleStrike().run(), isActive("strike"), "Strike")}
        {button("U", (e) => e.chain().focus().toggleUnderline().run(), isActive("underline"), "Underline")}
        {button("Link", setLink, isActive("link"), "Insert or edit link")}
        {button("• List", (e) => e.chain().focus().toggleBulletList().run(), isActive("bulletList"), "Bullet list")}
        {button("1. List", (e) => e.chain().focus().toggleOrderedList().run(), isActive("orderedList"), "Numbered list")}
        {button("Quote", (e) => e.chain().focus().toggleBlockquote().run(), isActive("blockquote"), "Block quote")}
        {button("Rule", (e) => e.chain().focus().setHorizontalRule().run(), false, "Horizontal rule")}
        {button("←", (e) => e.chain().focus().undo().run(), false, "Undo")}
        {button("→", (e) => e.chain().focus().redo().run(), false, "Redo")}
        <span className="jetso-blog-toolbar-separator" />
        {["left", "center", "right"].map((align) => button(
          align === "left" ? "⇤" : align === "center" ? "↔" : "⇥",
          (e) => e.chain().focus().setTextAlign(align).run(),
          editor?.getAttributes("paragraph").textAlign === align
            || editor?.getAttributes("heading").textAlign === align,
          `Align ${align}`,
        ))}
        <button type="button" className="jetso-blog-toolbar-button" onClick={() => inputRef.current?.click()} disabled={!editor || disabled || uploading}>
          {uploading ? "Uploading…" : "Image"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          aria-label="Upload inline image"
          hidden
          onChange={handleImageFile}
        />
      </div>
      {imageAttrs && (
        <div className="jetso-blog-image-controls" aria-label="Selected image options">
          <label>
            Width
            <select
              value={imageAttrs.widthPercent || "custom"}
              disabled={disabled}
              onChange={(event) => updateSelectedImage({
                widthPercent: event.target.value === "custom" ? null : Number(event.target.value),
                width: null,
              })}
            >
              <option value="custom">Custom</option>
              {[25, 50, 75, 100].map((width) => <option value={width} key={width}>{width}%</option>)}
            </select>
          </label>
          <label>
            Align
            <select
              value={imageAttrs.align || "center"}
              disabled={disabled}
              onChange={(event) => updateSelectedImage({ align: event.target.value })}
            >
              <option value="left">Left</option><option value="center">Center</option><option value="right">Right</option>
            </select>
          </label>
          <label>
            Alt text
            <input
              value={imageAttrs.alt || ""}
              disabled={disabled}
              onChange={(event) => updateSelectedImage({ alt: event.target.value })}
            />
          </label>
          <label>
            Caption
            <input
              value={imageAttrs.caption || ""}
              disabled={disabled}
              onChange={(event) => updateSelectedImage({ caption: event.target.value })}
            />
          </label>
        </div>
      )}
      {uploadError && (
        <div className="jetso-blog-message error" role="alert">
          {uploadError}
        </div>
      )}
      {linkError && <div className="jetso-blog-message error" role="alert">{linkError}</div>}
      <EditorContent editor={editor} className="jetso-blog-editor-content" />
    </section>
  );
};

export default BlogRichTextEditor;
