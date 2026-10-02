# Event to Earn rollout plan

## Product decisions

- A fourth flyer type, `event`, is created **only by super admins**, with a selected merchant or Mailaverse itself as organizer. Organizer icons default to the merchant icon or Mailaverse logo and can be overridden with an uploaded image.
- Use the existing prompt-based image generator to create the event's mobile hero/profile image. Store title and description as `header` and `adContent`.
- Events have no coupon, lottery, Mailcoin reward, or wallet budget. The term “earn” does not imply a payout in v1.
- Capture event start/end and timezone, venue, application deadline, optional capacity, and an opt-in `confirmationRequired` checkbox (default off). Applications close at deadline or start; check-in is permitted during the event window.
- Each signed-in user may apply once. For QR events, the applicant shows a personal QR code on mobile; anyone with a QR scanner can open a public portal page showing event details and **username only** and explicitly tap **Confirm Attendance**. Opening the URL alone must not check anyone in.
- Confirmation-free events count applicants as **self-reported joined**, not verified attendance. Cancellation, waitlists, and rewards are out of scope for v1.

## Phase 1: data model and APIs

1. Add an explicit `event` branch to flyer creation and editing. Enforce super-admin permission on the server; validate merchant existence and event fields; allowlist stored fields. Persist merchant branding and `hideCompanyDetail: false`. Do not create coupons, lottery records, wallet deductions, or reward jobs for events. Ensure existing flyer types' economics remain unchanged. Limit event edits after the first application (especially sponsor, capacity, timing, and confirmation mode).
2. Store applications under a dedicated Firestore ledger, keyed by event and authenticated user. Record `appliedAt`, and `confirmedAt` only for verified QR attendance. Use transactional, idempotent apply/confirm operations and a transactional capacity count on the event. Never trust submitted user IDs or usernames.
3. Create authenticated apply and current-application endpoints, plus super-admin list and aggregate endpoints. Generate a cryptographically random per-applicant nonce and use a server-secret HMAC to derive a reproducible capability; store its hash in a lookup index. Protect the nonce and secret as sensitive data so applicants can retrieve the same QR after app relaunch. Do not include the capability in general flyer APIs or logs. Configure `EVENT_CHECKIN_SECRET` (32+ characters) and `EVENT_PUBLIC_BASE_URL` (HTTPS origin) before enabling confirmation-required events; keep the secret stable until all existing check-ins expire.
4. Mount a public GET check-in page before the SPA fallback. Escape event title and username; show an explicit confirmation button; GET has no write side effects. POST verifies the capability, event window, application status, and single-use rule transactionally; repeats return already-confirmed. Use no-store, noindex, no-referrer headers and rate limiting, without third-party assets on capability pages.

## Phase 2: portal and mobile

5. Add a super-admin-only Event to Earn card and creation/edit screens to the portal. Use two creation steps: event details/icon and prompt generation or direct upload, then the existing target-budget/preview UI in no-reward event mode. Review the image before explicitly publishing; targeting and release scheduling are optional, and coupon/payment/reward-budget controls remain unavailable. Interpret event and release times in the selected IANA timezone, accept valid aliases and UTC, and return field-specific date errors. Provide merchant/Mailaverse branding and English/zh-HK strings. Build an admin list/report view.
6. Extend mobile flyer models and product details for events, hiding coupon/reward controls. Implement an Apply/Join CTA with restored status and a dedicated status view that shows a personal QR only when confirmation is on. Handle sign-in, full/closed events, retries and already-applied/confirmed states. Localize and log events without sending usernames or tokens to analytics.

## Phase 3: analytics, testing and rollout

7. Track unique authenticated event viewers (a purpose-built impression event, not every GET), unique applicants, verified confirmed attendees, self-reported joined count, capacity fill, apply delay, confirmation delay, and attributable channel. Compute application rate = applicants / unique viewers; verified show-up rate = confirmed / applicants **only for QR events**. Label no-QR joined/applicant as self-reported, not attendance. Segment CRM into applied-not-confirmed, confirmed and no-QR applicants; respect outreach opt-in and unsubscribe.
8. Test super-admin-only creation/editing, merchant validation, no coupons/rewards, capacity races, idempotent apply and check-in, invalid/repeated tokens, check-in windows, public GET read-only behavior, escaping/cache headers, and reporting authorization. Add portal/mobile tests, run portal build, Flutter analysis and tests, and manually exercise create → apply → QR → public confirm → conversion dashboard. Roll out behind a flag and monitor check-in failures and abuse.

## Risks and assumptions

- A public personal QR is a bearer credential: a forwarded image can falsely check someone in. Single-use prevents duplicate attendance, **not** remote attendance. If stronger proof is needed later, require organizer login or venue-bound/rotating challenges.
- Super-admin-created flyers currently override merchant branding; event creation must be deliberately separate rather than blindly reusing that branch.
- Generated flyer art may need a square crop for the mobile event image.
- Publication scheduling and event start are separate concepts. Notification-only jobs may still be useful, but reward jobs must never run for events.
