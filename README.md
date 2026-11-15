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

Super admins can import arbitrary codes (pasted or CSV) and individual voucher
images. Each code or image is one voucher; within each import, codes are assigned
first, followed by images in upload order. Later batches follow earlier batches.
Duplicate codes in the same voucher are rejected.
Administrators must verify that image contents are unique. Each import is limited
to 100 items, including at most 20 PNG, JPEG, GIF, or WebP images, each at most
5 MiB and 20 MiB combined. Import more stock in additional batches.

Set `VOUCHER_IMAGE_ENCRYPTION_KEY` on every API instance to the same base64
encoding of a securely generated 32-byte key before importing images. Store it
in a secrets manager, back it up securely, and do not rotate or remove it without
first migrating all encrypted images; existing vouchers become unreadable if it
is lost or changed. For example, generate a key locally with
`openssl rand -base64 32` and configure the result as a secret, not in source
control. Image imports fail explicitly if the key is not configured.

Images are encrypted in Cloud Storage and served only through an authenticated,
redemption-owner-checked API. For an assigned image, the redeemed voucher's
`voucherImage` contains this authenticated API path instead of the shared card
artwork; imported code vouchers continue to use the shared artwork. Ensure
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
