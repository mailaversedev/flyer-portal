# Shared flyer content experience

Status: shared content editor implemented for Read, Scan and Event creation.

## Implemented

- All three creation pages render `FlyerContentStep`, which reuses `Step1ContentPro`.
  The wrapper shares upload/preview lifecycle and responsive layout; the editor
  supports injected validation, copy labels/limits and optional sections.
- Scan and Event expose the Pro design controls while preserving their 1:1 / 1K
  defaults. Read retains 4:5 / 2K. Scan billing and cost hints follow the selected
  resolution through the shared pricing helper.
- Scan uses a shared `QRDetails` section for creation and asset-locked editing.
  Its common-editor `adContent` maps to the existing persisted
  `productDescriptions` field, rather than storing two description fields that
  could diverge when an existing QR flyer is edited.
- Event retains its organizer/icon controls and event validation, separate
  publication endpoint, super-admin access and no-reward targeting. No coupon or
  payment step was added.
- Shared defaults, creative-image invalidation and transient-file filtering live
  in `FlyerContentUtil`. QR/Event reuse prepared images until creative inputs
  change; metadata changes do not unnecessarily regenerate image prompts.
- The generation API and page-specific payment/publication orchestration remain
  unchanged in structure. Read's direct-upload shortcut and KPay restoration are
  intentionally preserved; unifying the upload shortcut remains deferred.
- Regression tests cover the editor, all three pages, validation, selected
  resolution pricing, image reuse, uploads, organizer icons and QR compatibility.
- Verified: 60 focused frontend tests, 32 event-server tests and the production
  build pass. Browser checks with local API fixtures exercise Read/Scan through
  Coupon Builder and Event through targeting/preview, plus desktop/laptop layout.
  No live generation, payments or publication were performed.

## Goal and scope

Reuse `Step1ContentPro` for new Read to Earn (`leaflet`), Scan to Earn (`qr`),
and Event to Earn (`event`) flyers. Share the creative editor and image preparation
experience, not publication rules or a single all-purpose wizard.

Keep survey/query creation, existing flyer editing, event applications/check-in,
and reward/payment policy changes outside this refactor.

## Findings before implementation

| Surface | Read | Scan | Event |
| --- | --- | --- | --- |
| Page | `src/pages/Flyer/FlyerCreation/Leaflet.js` | `src/pages/Flyer/FlyerCreation/QRGeneration.js` | `src/pages/Flyer/FlyerCreation/EventCreation.js` |
| Content editor | `Step1ContentPro` | `QR/Step1Background` | Inline form |
| Generation default | 4:5, 2K | Forced 1:1, 1K | Forced 1:1, 1K |
| Current validation | Ratio, header, ad content, prompts | Website; prompts when generation is needed | Event details and dates; prompts when generation is needed |
| Next steps | Target/budget, optional coupons | QR confirmation, target/budget, optional coupons | Targeting/preview, publish |
| Direct upload | Skips content; metadata is collected in target/budget | Stays on step 1 | Stays on step 1 |
| Generation billing | Wallet/free attempts; super-admin exempt | Wallet/free attempts; super-admin exempt | Super-admin only; no token call |
| Publication | `createFlyer`, type `leaflet` | `createFlyer`, type `qr` | Separate `createEvent` endpoint |

Important integration details:

- All three already call `ApiService.generateLeaflet`. It supports colors,
  typography, brand voice, logo, moodboard, product images, ratio and resolution.
  Scan and Event currently do not expose most of those inputs.
- The generator sends `flyerPrompts` as `user_query`, not `header`, `adContent`,
  QR website, venue or dates. Showing those fields together does not automatically
  put their text in the generated image.
- Scan uses `productDescriptions` for its description, whereas Read and Event use
  `adContent`. Mobile code still reads `productDescriptions`, with description
  fallback behavior in `ProductPage.dart` and `CompanyController.dart`.
- `Step1ContentPro` emits a complete data object and exposes both ref-based and
  static validation. Event currently accepts `(key, value)` updates and clears
  its prepared cover for step-1 updates without an uploaded file.
- Pro upload controls use fixed DOM IDs. They need instance-safe inputs if reused
  in additional contexts. Event's enclosing form also requires explicit
  `type="button"` on non-submit controls and prevented Enter submission for tags.
- Event's logo currently serves both as generator input and the persisted
  organizer icon. These meanings must not accidentally diverge during reuse.
- Event persistence is allowlisted; new creative fields will not automatically
  be stored. Generic flyer creation overwrites company identity from the
  authenticated user and uses Mailaverse branding for super admins. A selected
  generation merchant is not proof of persisted merchant ownership.
- Existing QR tests cover generated/uploaded images, billing failures, going
  back without regenerating, and editing. Event validation is already shared
  between frontend and server.

## Proposed user experience

All three AI creation entries show the same core content form:

1. Copy: title/header and description.
2. Creative inputs: prompts, moodboard, product photos and logo.
3. Design: ratio, resolution, colors, typography and brand voice.
4. Type-specific details immediately below the shared editor.

Keep current ratio/resolution defaults. Pro controls can be shared without
silently switching Scan/Event to Read's 2K default. If Scan/Event receive editable
ratio/resolution controls, treat that as an explicit product change: Scan's cost
indicator and billing must follow the actual selected resolution.

Type-specific details:

- Read: tags and existing merchant selection behavior.
- Scan: required website, ad type, location, starting date and promotion message.
  Do not repeat its header/description fields. Preserve the QR preview and
  confirmation before target/budget.
- Event: organizer with Mailaverse fallback, organizer icon preview/reset, venue,
  start/end, application deadline, timezone, capacity and confirmation toggle.
  Use event-specific copy labels and length limits. Keep event no-reward targeting,
  access restrictions, two-step navigation and explicit publication.

### Direct upload

Recommended final UX: uploads also enter the common Content step, with an image
preview and a clear Upload / Generate choice. Keep metadata and type-specific
details visible; hide generation-only controls and never charge for uploads.
Read's existing content controls in target/budget then move to step 1 rather than
appearing twice.

This changes Read's current upload shortcut and should be approved explicitly.
Until approved, preserve that shortcut while reusing Pro for AI creation and
the Scan/Event content paths.

## Implementation design

### 1. Make Pro composable, not a workflow controller

Extend `Step1ContentPro` with a small explicit contract for:

- Shared `data` and `onUpdate(nextData)`.
- Optional type-specific section composition.
- Copy labels/limits and tag/merchant visibility where types differ.
- Injected validation policy, while retaining current Read defaults and both
  validation entry points.

Keep API calls, navigation, billing and event-date conversion outside the editor.
Do not pass unrelated type flags through every field or build a dynamic form engine.
Use instance-safe file inputs, accessible labels and safe tag keyboard behavior.
Initialize `productPhoto`, tags and typography consistently before rendering.

### 2. Adapt data at page boundaries

- Keep a shared creative draft shape using `header` and `adContent`.
- For QR creation, use `adContent` inside the shared editor and serialize it to
  the legacy `productDescriptions` field. Do not persist a second independently
  editable description. Leave QR edit payloads and existing records backward compatible.
- Adapt Event updates to complete-object updates while preserving cover
  invalidation and all event-specific values.
- Keep organizer-icon persistence explicit. Either retain the current combined
  logo/icon meaning with clear labels, or approve separate fields before splitting it.
- Strip transient File/preview objects from publication payloads. Keep event's
  current server allowlist; creative-input persistence is not required for reuse.
- Do not change merchant ownership/branding semantics in this refactor.

### 3. Compose validation by type and image source

- Preserve existing required fields initially; reusing Pro must not unexpectedly
  make QR header/description mandatory.
- Require prompts and generation settings only when a new generated image is
  needed, never for a valid uploaded cover.
- Compose QR website validation and Event's existing shared date/detail validator
  with common creative validation. Preserve Event's 160/5000 title/description limits.
- Show localized inline errors and prevent proceeding on invalid data.
- Validate current details again before publishing, including edits made in preview.
- Keep the distinction between stored copy and image prompts explicit in helper text.
  Automatically merging copy/event facts into prompts is a separate product decision.

### 4. Share image preparation only after page integration

Extract common upload/generate/result validation and wallet/billing orchestration
from the three pages once their behavior has regression tests.

- Use the existing API service and normalization helpers.
- Use actual selected resolution for wallet checks, cost display and consumption.
- Validate the generated HTTPS URL before accepting an image.
- Do not advance on upload, generation or billing failure.
- Preserve each flow's history/free-attempt preview behavior initially.
- Reuse a prepared image when returning without creative changes. Invalidate it
  for changes to prompts, design, references or generation branding; changing a QR
  website must refresh its QR without unnecessarily regenerating the cover.
- Keep explicit regeneration distinct from Next so retries/back navigation do not
  accidentally consume another generation.
- Keep Read's KPay payment return/draft restoration isolated and working.
- Keep Event outside generic flyer creation, coupons, wallet budget and rewards.

## Delivery sequence

1. Add characterization tests for Read/Event and extend QR coverage before refactoring.
2. Make Pro composable and validation configurable; verify Read remains unchanged.
3. Integrate Scan with QR-specific fields and description compatibility.
4. Integrate Event with event-specific fields and organizer handling.
5. Extract proven shared image-preparation logic; retain thin per-type pages.
6. If approved, unify direct-upload entry and remove Read's duplicate budget-stage copy fields.
7. Update English/zh-HK strings and directly related documentation; remove obsolete
   creation-only UI only after checking its edit-mode consumers.

## Verification and acceptance

- Component tests: common fields appear in all three types; correct type-only fields,
  upload mode, localized errors, tags, input IDs and optional photo defaults.
- Flow tests: defaults, selected ratio/resolution reaching the generator, correct
  token cost, free/exempt cases, invalid input and explicit error reporting.
- Asset tests: prompt/reference/logo/color changes invalidate prepared artwork;
  unchanged Back/Next reuses it; failed billing never opens the next step.
- Compatibility tests: QR description survives publish/reload and remains readable
  by existing mobile consumers; legacy QR editing remains asset-locked.
- Event tests: organizer fallback/override, timezone conversion, deadline/capacity
  rules, access control, no reward/coupon/payment calls and allowlisted payload.
- Read tests: existing generation, direct upload, optional coupons, wallet checks,
  payment return restoration and asset-locked editing remain intact.
- Run focused frontend tests, relevant event/flyer server tests, then portal build.
  Manually exercise AI and upload flows on desktop and narrow/mobile layouts.

## Decision outcomes

1. Keep current per-type defaults, but unlock all Pro ratio/resolution choices for
   Scan/Event? Implemented, with resolution-aware Scan pricing.
2. Route Read uploads through Content rather than directly to target/budget?
   Deferred; the existing shortcut is preserved.
3. Require header/description for Scan, or preserve their optional status?
   Preserved existing requirements.
4. Automatically include copy/event facts in the generator prompt?
   Kept explicit prompts; automatic merging remains a separate decision.
