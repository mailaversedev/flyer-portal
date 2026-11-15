# Jetso marketing blog implementation plan

Status: Implemented and locally validated on 2026-11-15; not deployed.
Implementation authorized on 2026-11-15 following plan approval.

## Reviewed scope

- Separate `jetsoPosts` collection, reusing the common flyer fields.
- Super-admin-only authoring and publishing.
- Separate bilingual Blog section with a Jetso navigation link; no mixing
  articles into the Promotions feed.
- Self-hosted Tiptap with standard article layout, image upload, drag resizing,
  alignment, width presets, alt text and captions.
- No tables, two-column blocks or paid editor in the first release.
- Accepted defaults: JPEG/PNG/WebP, 5 MiB per image, 20 inline images and
  500 KiB serialized content including translated bodies.
- Optional authored English/Traditional Chinese translations, private drafts,
  explicit publish/update, scheduled initial publication and unpublish/archive.
- Stable ID-based URLs and optional merchant attribution as described below.

The alternatives below remain reference material, not approved scope.

## Goal

Publish marketing articles on Jetso only, using the existing portal for
authoring and reusing the common flyer fields and Jetso visual layout.
The article description must be editable using an existing WYSIWYG library,
including images and basic layout controls.

## Findings from the existing applications

- Jetso is a standalone Express/server-rendered application reading Firestore
  directly. Its cards, detail pages, company profiles, bilingual navigation,
  metadata and discovery routes live in
  [publicPromotions.js](../../mailaverse-jetso/routes/publicPromotions.js) and
  [publicSeo.js](../../mailaverse-jetso/routes/publicSeo.js).
- Descriptions currently come from `productDescriptions` or `adContent`.
  Rendering strips markup and escapes the resulting plain text. Merely saving
  HTML into these fields would not produce rich articles.
- The mobile application consumes the portal's `/api/flyers` endpoint.
  [listing.js](../routes/flyer/listing.js) reads the shared `flyers` collection
  without filtering by content type. Adding `type: "blog"` there is therefore
  not enough to make articles Jetso-only.
- Generic flyer creation can allocate rewards and schedule distribution jobs.
  Blog publishing should not use this path.
- [admin/index.js](../routes/admin/index.js) already provides authentication and
  the super-admin authorization boundary.
- Cloud Storage image upload already exists in
  [file.js](../routes/file.js), but blog uploads need their own authenticated,
  validated route; do not expose them through the generic upload handler.
- The CRM campaign screen has a hand-built `contentEditable`/`execCommand`
  editor. Do not extend it for this feature or change CRM behavior in this work.

## Recommended architecture

### Storage: reuse the schema, not the distribution collection

Use a separate Firestore collection, provisionally `jetsoPosts`.
Reuse these common fields where applicable:

| Existing field | Article use |
| --- | --- |
| `header` | Article title |
| `coverPhoto` | Listing/social/hero image |
| `tags` | Topics |
| `companyId`, company display name/icon | Optional merchant attribution |
| `hideCompanyDetail` | Whether to display merchant attribution |
| `createdAt`, `updatedAt`, `scheduledAt` | Creation, changes and publication timing |
| `translations.en`, `translations["zh-Hant-HK"]` | Optional authored translations |

Add article-specific fields:

- `kind: "blog"` and server-enforced `channel: "jetso"`.
- `status`: `draft`, `published` or `archived`.
- `body`: versioned Tiptap JSON, the editable source of truth.
- `bodyHtml`: server-generated, sanitized rendering of that JSON.
- `bodyText`: server-derived plain text for previews and metadata.
- Optional editorial `excerpt`, validated as plain text.
- `publishedAt`, `createdBy`, `updatedBy` and a revision value for edit conflicts.
- Private draft content and an explicit public snapshot. Saving a draft does
  not change a live page; Publish/Update published atomically replaces the
  public snapshot. Never return the private draft from Jetso.

Apply the same body format to authored translations. Reuse the current
language fallback behavior; no automatic translation.

No rewards, coupons, targeting, survey answers, event registration,
notification jobs or mobile feed entries are created.

**Alternative requiring explicit approval:** store blogs in `flyers` with a
Jetso-only visibility flag. This requires enforcing that flag across every
mobile/API/feed/distribution path, direct-ID access, editing and legacy reads.
It offers document-level reuse but materially increases regression risk.

### Authoring and permissions

Add a Blogs area in the existing portal, initially super-admin-only:

- List articles with publication status and public links.
- Create/edit title, cover, excerpt, topics, attribution and description.
- Save draft, preview, publish, update published, schedule initial publication,
  and unpublish/archive.
- Preview uses the Jetso article styles at desktop and mobile widths.
- Show upload/save/publish errors explicitly; retain unsaved edits.
- Warn before discarding unsaved changes and reject stale overwrites using
  the revision value.

Add `/api/admin/jetso-posts` list/create/detail/update/publication endpoints
under the existing admin authorization middleware. Validate allowed fields,
document structure, dates and attribution server-side; callers cannot set
ownership or bypass the publication rules.

For initial scheduling, store the public snapshot with a future `scheduledAt`.
Jetso makes it visible only when that time is reached; no distribution worker
is needed. Scheduled replacements of already-live articles are outside the
initial scope unless requested.

### Jetso presentation

Recommended URLs:

- `/blog` and `/blog/page/:page`
- `/blog/:postId`
- Corresponding `/zh-hant/blog` routes

Reuse Jetso navigation, page shell, card appearance, hero image, typography,
topics, optional company attribution and footer. Extract only the shared
rendering pieces needed; preserve existing promotion URLs and output.

Render the rich description as an expanded article body, not an escaped
plain-text paragraph or collapsed promotion disclosure. Do not display reward,
coupon or event widgets on articles.

Keep Blogs separate from the Promotions feed by default, with a visible
navigation link. Stable document IDs are sufficient initially; readable
slugs/redirects can be added if requested.

Use one publication predicate for listing, detail and sitemaps:
published snapshot exists, not archived/unpublished, and a valid schedule is
due. Draft, future and archived detail URLs return 404. Malformed dates must
not accidentally publish content.

Extend canonical/hreflang, Open Graph, Twitter metadata, robots allowances,
`llms.txt` and sitemaps. Use `BlogPosting` structured data, with real publication
dates and attribution, instead of `Offer` or `Event`. Keep new blog sitemap
files within URL limits rather than exhausting the existing promotion budget.

Use non-cacheable private previews. Propose `no-store` for public blog HTML
initially so unpublishing takes effect on subsequent requests without waiting
for the promotion pages' existing cache lifetime. Existing promotion caching
is unchanged.

## WYSIWYG editor investigation

### Recommendation: self-hosted Tiptap

Tiptap's core repository is MIT-licensed. Its React integration fits the
existing portal, while the public Jetso site remains server-rendered and does
not download an editor. No Tiptap cloud service is required.

| Capability | Implementation |
| --- | --- |
| Paragraphs, headings, bold/italic, lists, quotes, undo/redo | Existing Tiptap extensions |
| Links and horizontal rules | Existing extensions with URL validation |
| Text alignment | Official TextAlign extension |
| Inline article images | Official Image extension plus upload integration |
| Drag resize, minimum dimensions, aspect-ratio preservation | Current official Image extension's `resize` configuration |
| Image left/center/right and width presets | Small bounded extension/controls over Image; not a new editor |
| Alt text | Image attributes plus toolbar/dialog input |
| Captions | Small figure/caption extension; not guaranteed by the default Image node |
| Tables and resizable columns | Official TableKit; responsive public styling |
| Two-column image/text sections | Possible with a bounded custom block; optional, stacks on mobile |

Proposed first release: headings, standard text formatting, links, lists,
quotes, separators, text alignment, upload/insert images, drag resize,
25/50/75/100% width presets, image alignment, alt text and captions.
Tables are optional. Two-column blocks, text wrapping around images,
galleries, cropping, arbitrary HTML/CSS and free-position page design are not
included by default.

Tiptap is headless: it supplies the editor engine and extensions, not a complete
turnkey toolbar. Reuse suitable official UI components where compatible;
otherwise add a compact toolbar in the portal's existing visual style.
Verify the selected package versions with React 19 and the current CRA build
before committing to them. Verify resize/alignment/caption round trips in the
editor and static HTML, not just their appearance during editing.

### Alternatives

- **TinyMCE:** more turnkey toolbar; its image plugin supports dimensions,
  alignment and captions. Current self-hosted TinyMCE uses GPLv2+ or a commercial
  license. Confirm license suitability and commercial cost before choosing it;
  do not assume proprietary use is free. Upload still needs backend integration.
- **CKEditor 5:** strong ready-made image and layout tooling. Uses GPLv2+ or
  commercial terms, with feature availability depending on the commercial plan.
  Appropriate if a paid turnkey editor is preferred.

Neither image insertion nor resizing implies image cropping/editing or a media
library. Those are separate scope and, in some products, paid features.

### Content and media safeguards

- Validate JSON against a bounded allowed node/mark schema. Generate HTML on
  the server using Tiptap's static renderer and sanitize with an established
  library such as `sanitize-html`; never trust client-supplied rendered HTML.
- Allow only supported tags/attributes and bounded alignment/dimension styles.
  Reject scripts, event handlers, unsafe links, arbitrary CSS and embeds.
- Use the same content contract for authoring and rendering; keep the preview
  stylesheet consistent with Jetso.
- Add an authenticated blog-image upload endpoint using existing Cloud Storage
  infrastructure and response conventions, with generated object names.
- Proposed limits for approval: JPEG/PNG/WebP, 5 MiB per image, 20 inline images
  and 500 KiB serialized content per article including translated bodies.
  Verify actual file signatures, reject SVG and never persist blob/base64 URLs.
- Track image object references and failed/abandoned uploads for cleanup.
  Do not delete images still referenced by a public snapshot or another draft.
  Public marketing images are not confidential; strictly private draft media
  would require a separate private-storage/delivery design.
- Constrain rendered images to the available width, preserve aspect ratio,
  lazy-load body images, and ensure tables/optional columns work on mobile.

## Delivery sequence and acceptance checks

1. **Editor compatibility spike:** prove React/CRA build compatibility, image
   uploads, resize/alignment/caption persistence, server rendering and sanitizing.
2. **Backend/storage:** implement admin CRUD/publication, private draft/public
   snapshot separation, uploads, limits, conflict handling and indexes.
3. **Portal authoring:** implement list/form/editor/preview and both UI languages.
4. **Jetso rendering/discovery:** reusable shell, blog routes, rich body, metadata
   and sitemap updates.
5. **Validation and rollout:** focused portal server/frontend tests, frontend
   build, Jetso syntax/integration tests and real browser checks.

Acceptance checks:

- Article with formatted text and multiple images can be saved, reopened and
  published without losing image size, alignment, alt text or captions.
- Draft edits never appear publicly until explicitly published.
- Future, draft and archived posts are absent from lists, detail access and
  sitemaps, including both locale routes and pagination boundaries.
- Articles never appear in mobile feeds/company feeds or trigger rewards/jobs.
- Unauthorized authoring/uploads are denied; invalid content/uploads and
  unsafe markup are rejected; stale saves do not overwrite another editor.
- Rich body and preview agree at 375px and desktop widths with no page-level
  horizontal overflow. Article content is present with JavaScript disabled.
- Existing promotion cards/details, coupons, company catalogs and SEO tests
  continue to pass.

Deploy admin backend/indexes and Jetso readers before enabling authoring in the
portal. Document required Firestore rules/indexes and service-account access.
Jetso's service account remains read-only. No production migration or mobile
release is expected with the separate-collection recommendation.

## Approval record

The scope choices and proposed defaults were reviewed, incorporated above and
approved. The user subsequently authorized implementation on 2026-11-15.
Production deployment and production data changes are not part of this task.

## Official editor references

Investigated on 2026-11-15; pin and verify actual package versions at implementation.

- [Tiptap MIT license](https://github.com/ueberdosis/tiptap/blob/main/LICENSE.md)
- [Tiptap Image, including resize configuration](https://tiptap.dev/docs/editor/extensions/nodes/image)
- [Tiptap TextAlign](https://tiptap.dev/docs/editor/extensions/functionality/textalign)
- [Tiptap Table/TableKit](https://tiptap.dev/docs/editor/extensions/nodes/table)
- [Tiptap Image Upload Node](https://tiptap.dev/docs/ui-components/node-components/image-upload-node)
- [Tiptap static rendering](https://tiptap.dev/docs/editor/api/utilities/static-renderer)
- [TinyMCE image controls](https://www.tiny.cloud/docs/tinymce/latest/image/)
- [TinyMCE licensing](https://www.tiny.cloud/docs/tinymce/latest/license-key/)
- [CKEditor licensing and feature availability](https://ckeditor.com/docs/ckeditor5/latest/getting-started/licensing/license-and-legal.html)
