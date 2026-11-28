# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Runs all server tests in `test` and frontend Jest tests in `test/frontend` once.
For focused runs, use `node --test test/example.test.js` or
`npm run test:frontend -- --watchAll=false --runInBand test/frontend/path/to/example.test.js`.
Arguments passed to `npm test` apply to the frontend suite; the server suite always
runs in full. Run `npm run test:frontend` to use Jest's interactive watch mode.

See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

### `npm run server`

Starts the Node.js API server from `server.js`.

### `npm run worker`

Starts the flyer job background worker from `worker.js`.

## Mobile flyer ordering and backfill

The mobile API can order flyers by `scheduledAt` descending. For an unscheduled
flyer this field equals its `createdAt`; a scheduled flyer uses its actual
release time. Future releases are excluded before the page limit is applied.
Existing `createdAt` ordering remains available to other clients.

Before deploying the mobile change:

1. Deploy the API changes so new flyers have a sortable `scheduledAt`.
2. Create and wait for a Firestore composite index on collection `flyers`,
   collection scope: `companyId` ascending, `scheduledAt` descending.
3. With Application Default Credentials for the intended project, review the
   backfill, then explicitly apply it:

   ```bash
   node scripts/backfillFlyerScheduledAt.js --project=PROJECT_ID
   node scripts/backfillFlyerScheduledAt.js --project=PROJECT_ID --apply
   ```

   The script uses transactions, normalizes timestamps to UTC and can be
   rerun. It reports invalid dates and exits nonzero; repair those records and
   rerun before proceeding. Firestore excludes missing sort fields from queries.
4. Deploy the mobile app after the backfill and index are complete.

The mobile promotion screen currently requests the first 100 flyers; its lazy
list/grid rendering is not network-level infinite scroll.

## Merchant products

The profile area has Profile and Products tabs. The Products tab opens the product
list, with separate add and edit pages using the same form for image uploads and
active/inactive status. Only active products appear in the mobile
company page and Jetso catalog. Public product pages use cursors that remain valid
when the cursor product is deactivated.

Create the Firestore composite index manually for collection ID `products`,
**Collection** scope, with `active` ascending and `createdAt` descending. Wait for
the index to finish building before using public catalogs; index deployment is
not managed by this project.

Regression checks:

```bash
node --test test/merchantProducts.test.js test/companyProducts.test.js
CI=true npm run test:frontend -- --watchAll=false --runInBand test/frontend/pages/Profile/MerchantProducts.test.js
```

## Flyer coupons

Leaflet and QR flyers can contain up to five coupons. Coupon details and order
are fixed after publication. The mobile app claims all currently eligible
coupons, skipping already claimed, expired and exhausted coupons individually.
Expiry dates are inclusive through the specified UTC calendar date. Each saved
coupon is redeemed separately. Older mobile apps display and claim only the
first coupon; the first claim keeps the original flyer-based ID.

Deploy the API and public site before the mobile app and merchant portal. For a
staged rollout, build the portal with `REACT_APP_ENABLE_MULTI_COUPONS=false`
to hide multi-coupon authoring until the clients are ready, then rebuild with
the flag unset or `true`. Existing flyers and coupon claims remain compatible.
Coupon download totals count coupons, not unique users; download rate is
coupon downloads divided by users reached times the number of flyer coupons.

Focused server checks:

```bash
node --test test/flyerCoupons.test.js test/couponBulkClaim.test.js
```

## Imported platform vouchers

Super admins import code and QR image pairs using a UTF-8 CSV with the header
`code,image_filename`, followed by one pair per row. Select all referenced
images; filenames must match exactly, including case, and must be unique.
Review the paired preview: the system does not verify QR image contents against
codes. Each pair is one voucher. CSV row order determines assignment order;
later batches follow earlier ones. Duplicate codes in a voucher are rejected.
Each import is limited to 100 pairs with PNG, JPEG, GIF, or WebP images, each
at most 5 MiB and 20 MiB combined. Codes retain leading zeros and spaces.

Set `VOUCHER_IMAGE_ENCRYPTION_KEY` on every API instance to the same base64
encoding of a securely generated 32-byte key before importing images. Store it
in a secrets manager, back it up securely, and do not rotate or remove it without
first migrating all encrypted images; existing vouchers become unreadable if it
is lost or changed. For example, generate a key locally with
`openssl rand -base64 32` and configure the result as a secret, not in source
control. Image imports fail explicitly if the key is not configured.

Images are encrypted in Cloud Storage and served only through an authenticated,
redemption-owner-checked API. Redeemed vouchers keep the shared artwork in
`voucherImage` and expose the authenticated QR image path in `importedQrImageUrl`.
Ensure
Firestore security rules deny direct client
access to `vouchers/{id}/inventory`, `vouchers/{id}/importedCodeIndex`,
`vouchers/{id}/imports`, and other users' `voucherRedemptions`; the API uses the
Admin SDK. Verify deployed rules separately before enabling this feature.
Imported voucher deletion is a soft delete so previously redeemed images remain
available. If an upload or transaction fails unexpectedly, the server logs the
encrypted object paths for cleanup review. Before deleting such an object,
confirm it is not referenced by voucher inventory or a redemption; a transaction
may have committed despite a lost response.

Deploy the API and updated mobile client before enabling imported vouchers:
older mobile clients cannot display an imported image. Focused server checks:

```bash
node --test test/importedVouchers.test.js
```

## Super Admin Registration

Super admin accounts should not be created through the public company onboarding form or the staff registration API.

Use the setup script instead.

Requirements:

- `GOOGLE_APPLICATION_CREDENTIALS` points to a service account JSON file with Firestore access
- dependencies are installed with `npm install`

Run:

```bash
npm run create:super-admin -- \
  --username platform-root \
  --displayName "Platform Root" \
  --password "change-this-password" \
  --locale en
```

The script creates a `staffs` document with:

- `role: "super-admin"`
- `companyId: null`
- `profile.locale` from `--locale` or `en`

You can also provide values through environment variables:

```bash
SUPER_ADMIN_USERNAME=platform-root \
SUPER_ADMIN_DISPLAY_NAME="Platform Root" \
SUPER_ADMIN_PASSWORD="change-this-password" \
SUPER_ADMIN_LOCALE=en \
npm run create:super-admin
```

## Jetso marketing blog

Super admins can manage articles at `/jetso-blog` in the portal. Articles use
the separate Firestore `jetsoPosts` collection and never create flyers, reward
budgets or distribution jobs. They appear only in Jetso's bilingual `/blog`
section. Tiptap 3 is self-hosted and MIT-licensed; no paid editor/cloud service
is required. CRM editing is unchanged.

The WYSIWYG description supports headings, links, lists, text alignment,
image uploads, drag resizing, percentage widths, image alignment, alt text and
captions. Tables and two-column layouts are not included. Optional authored
English/Traditional Chinese translations retain the original content fallback.

Save draft does not modify a live article. Preview renders the current unsaved
draft without writing it. Publish/Update published atomically replaces the public
snapshot, with optimistic revision checking. Initial publication can be scheduled;
scheduled replacements of live articles are rejected. Unpublish and archive remove
the public snapshot. Public blog HTML and blog sitemaps use `no-store` so later
requests see publication changes immediately; this cannot erase pages already
downloaded or search-engine caches.

Uploads require super-admin authentication and accept static JPEG/PNG/WebP up
to 5 MiB and 8192 pixels per dimension (40 million input pixels maximum). Images
are decoded, orientation-corrected, stripped of metadata and converted to WebP
in the existing Cloud Storage bucket under `jetso-blog/`. SVGs, animated files
and invalid image bytes are rejected. Uploaded marketing images are public,
including images in unpublished drafts; do not upload confidential material.
There are at most 20 inline images across the original and translations,
and 500 KiB of submitted content. Large draft/public combinations are also
rejected before exceeding Firestore's 1 MiB document limit.

The server validates versioned Tiptap JSON, derives and sanitizes its HTML, and
stores image references in both draft and public snapshot. Upload metadata is
tracked separately in `jetsoPostImages`. To report uploads older than seven days
that are not referenced by either copy, run
`node scripts/reportJetsoBlogImages.js` with application default credentials.
This is read-only: review current references again immediately before any manual
cleanup, since an editor may have saved during the report. Unexpected upload
failures log the specific object path for review; do not delete it until its
registry and article references have been checked.

Deployment prerequisites:

1. Deploy the backend and Jetso readers before enabling the new portal build.
   Run `npm ci` on the declared Node.js 24 runtime; Sharp's platform-specific
   optional packages must be installed for the image decoder.
2. Preserve Firestore single-field descending indexes for `jetsoPosts.createdAt`
   (portal) and `jetsoPosts.publicSnapshot.publishedAt` (Jetso). No composite
   index is required by the current post queries. Exempt `draft` and the rich
   body HTML/text/translation fields in `publicSnapshot` from unnecessary
   automatic indexing to reduce index fan-out; do not exempt the entire
   `publicSnapshot` map without restoring its `publishedAt` index. Index
   configuration is managed separately, not by this project's Firebase
   Functions configuration.
3. Verify Firestore rules deny all direct client reads/writes to `jetsoPosts`
   and `jetsoPostImages`, including drafts. Admin SDK access bypasses those
   rules: use the authenticated API for authoring and a read-only service
   account for Jetso. Grant the portal service account existing bucket upload
   and object-publication permissions. No new application secret is required.
4. `REACT_APP_JETSO_SITE_URL` may override the default
   `https://jetso.mailaverse.io` for public article links; it is a build-time value.
5. Verify publish, draft isolation, both language URLs, scheduling, unpublish,
   and the Jetso blog sitemaps. No mobile release or existing-data migration is
   needed.

Focused checks:

```bash
node --test test/jetsoPosts.test.js
CI=true npm run test:frontend -- --watchAll=false --runInBand JetsoBlog
npm run build
```

## Heroku background jobs

Flyer jobs are queued in Firestore and should be processed by a dedicated Heroku worker dyno.

### Why not `setImmediate()` in production

`setImmediate()` only defers work within the same Node.js process. On Heroku, web dynos are ephemeral and may restart before background work finishes, so in-process jobs are not reliable for production workloads.

Current behavior:

- production: the web dyno only enqueues flyer jobs
- local or non-production: inline processing is still allowed
- forced inline mode: set `NOTIFICATION_JOB_INLINE_PROCESSING=true`

### Procfile processes

This app now defines:

- `web: node server.js`
- `worker: node worker.js`

### Recommended Heroku setup

1. Deploy the app normally.
2. Scale the worker dyno to at least 1.
3. Keep the web dyno focused on HTTP traffic only.

Example:

- `heroku ps:scale web=1 worker=1`

### Optional worker environment variables

- `NOTIFICATION_WORKER_INTERVAL_MS` - polling interval in milliseconds, default `10000`
- `NOTIFICATION_WORKER_MAX_JOBS` - max queued jobs processed per cycle, default `3`
- `NOTIFICATION_WORKER_CLEANUP_BATCH` - max expired jobs deleted per cycle, default `200`
- `NOTIFICATION_WORKER_CLEANUP_INTERVAL_MS` - how often cleanup runs, default `300000`
- `FLYER_JOB_LEASE_MS` - stale processing lease timeout before a job can be reclaimed, default `600000`
- `FLYER_JOB_REWARD_CONCURRENCY` - max concurrent idempotent reward transactions per worker chunk, default `20`
- `NOTIFICATION_JOB_INLINE_PROCESSING` - set to `true` only if you explicitly want inline execution

### Notes

- The worker handles queued and failed jobs through Firestore-backed retry state.
- Expired flyer job records are cleaned up automatically by the worker.
- If you do not want a long-running worker dyno, Heroku Scheduler can call a protected worker endpoint instead, but a dedicated worker dyno is the more reliable pattern.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)
